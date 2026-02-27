import { Injectable, Inject, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientProxy } from '@nestjs/microservices';
import * as crypto from 'crypto';
import { Message, MessageDocument } from './schemas/message.schema';
import { OutgoingMessage, OutgoingMessageDocument } from '../messaging/schemas/outgoing-message.schema';
import { WorkspaceService } from '../workspace/workspace.service';
import { tenantContext } from '../tenant/tenant.context';

import { lastValueFrom } from 'rxjs';
import { retry, timeout, catchError } from 'rxjs/operators';

import { ConfigService } from '@nestjs/config';

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);

    constructor(
        @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
        @InjectModel(OutgoingMessage.name) private outgoingMessageModel: Model<OutgoingMessageDocument>,
        @Inject('RABBITMQ_SERVICE') private readonly rabbitClient: ClientProxy,
        private readonly workspaceService: WorkspaceService,
        private readonly configService: ConfigService,
    ) { }

    private get appSecret(): string {
        return this.configService.get<string>('META_APP_SECRET')!;
    }

    verifySignature(signature: string, rawBody: Buffer, ip?: string): boolean {
        if (!signature || !rawBody) {
            this.logger.warn(`Signature validation attempt without signature or body from IP: ${ip || 'unknown'}`);
            return false;
        }

        try {
            const hmac = crypto.createHmac('sha256', this.appSecret);
            const digest = Buffer.from('sha256=' + hmac.update(rawBody).digest('hex'), 'utf8');
            const checksum = Buffer.from(signature, 'utf8');

            if (checksum.length !== digest.length || !crypto.timingSafeEqual(digest, checksum)) {
                this.logger.error(`Invalid signature detected from IP: ${ip || 'unknown'}`);
                return false;
            }
            return true;
        } catch (e) {
            this.logger.error(`Signature validation failed for IP: ${ip || 'unknown'}:`, e);
            return false;
        }
    }

    async processMessage(payload: any) {
        this.logger.debug(`Raw Webhook Payload: ${JSON.stringify(payload)}`);
        try {
            const entry = payload?.entry?.[0];
            const change = entry?.changes?.[0];
            const value = change?.value;
            const metadata = value?.metadata;
            const phoneNumberId = metadata?.phone_number_id;

            if (!phoneNumberId) {
                this.logger.debug('Ignoring non-WhatsApp event: missing phone_number_id');
                return { success: true, message: 'Ignored' };
            }

            const workspace = await this.workspaceService.findByPhoneNumberId(phoneNumberId);
            if (!workspace) {
                this.logger.warn(`No workspace found for phone_number_id: ${phoneNumberId}`);
                throw new HttpException('Workspace not found', HttpStatus.FORBIDDEN);
            }

            const workspaceId = workspace._id.toString();

            return await tenantContext.run({ workspaceId }, async () => {
                // 1. Handle Status Updates
                if (value?.statuses?.[0]) {
                    this.logger.log(`Processing status update for workspace: ${workspaceId}`);
                    return await this.handleStatusUpdate(value.statuses[0], workspaceId);
                }

                // 2. Handle Incoming Messages
                const waMessage = value?.messages?.[0];
                if (!waMessage) {
                    this.logger.debug('Ignored non-message event (e.g. identity change)');
                    return { success: true, message: 'No actionable content' };
                }

                // Defensive check for metadata
                if (!metadata) {
                    this.logger.warn(`Webhook value has messages but missing metadata. phoneNumberId: ${phoneNumberId}`);
                }

                const messageData = this.extractMessageData(waMessage, metadata || {}, payload);
                this.logger.log(`Extracted message data: ${messageData.waMessageId} [${messageData.messageType}]`);

                // Save structured message
                const createdMessage = new this.messageModel(messageData);
                await createdMessage.save();
                this.logger.log(`Message saved to MongoDB: ${messageData.waMessageId} (Workspace: ${workspaceId})`);

                // Publish to RabbitMQ
                await this.publishToRabbitMQ(payload, workspaceId, messageData.waMessageId);

                return { success: true, workspaceId, waMessageId: messageData.waMessageId };
            });

        } catch (error) {
            if (error instanceof HttpException) throw error;
            this.logger.error(`CRITICAL Error in processMessage: ${error.message}`);
            this.logger.error(error.stack);
            throw new HttpException(`Internal Server Error: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private extractMessageData(waMessage: any, metadata: any, rawPayload: any) {
        const type = waMessage.type;
        let textBody = waMessage.text?.body;
        const messageMetadata: any = {};

        switch (type) {
            case 'image':
                messageMetadata.mediaId = waMessage.image?.id;
                messageMetadata.caption = waMessage.image?.caption;
                textBody = textBody || waMessage.image?.caption;
                break;
            case 'audio':
                messageMetadata.mediaId = waMessage.audio?.id;
                messageMetadata.voice = waMessage.audio?.voice;
                break;
            case 'video':
                messageMetadata.mediaId = waMessage.video?.id;
                messageMetadata.caption = waMessage.video?.caption;
                break;
            case 'document':
                messageMetadata.mediaId = waMessage.document?.id;
                messageMetadata.filename = waMessage.document?.filename;
                messageMetadata.caption = waMessage.document?.caption;
                break;
            case 'interactive':
                const interactive = waMessage.interactive;
                messageMetadata.interactiveType = interactive.type;
                if (interactive.type === 'button_reply') {
                    messageMetadata.buttonId = interactive.button_reply?.id;
                    messageMetadata.buttonText = interactive.button_reply?.title;
                    textBody = interactive.button_reply?.title;
                } else if (interactive.type === 'list_reply') {
                    messageMetadata.rowId = interactive.list_reply?.id;
                    messageMetadata.rowTitle = interactive.list_reply?.title;
                    textBody = interactive.list_reply?.title;
                }
                break;
            case 'location':
                messageMetadata.latitude = waMessage.location?.latitude;
                messageMetadata.longitude = waMessage.location?.longitude;
                textBody = `Location: ${messageMetadata.latitude}, ${messageMetadata.longitude}`;
                break;
        }

        return {
            waMessageId: waMessage.id,
            from: waMessage.from,
            to: metadata.display_phone_number || 'unknown',
            messageType: type,
            textBody,
            metadata: messageMetadata,
            timestamp: new Date(parseInt(waMessage.timestamp) * 1000),
            rawPayload,
            status: 'received'
        };
    }

    private async handleStatusUpdate(waStatus: any, workspaceId: string) {
        const waMessageId = waStatus.id;
        const status = waStatus.status; // sent, delivered, read, failed
        const statusTimestamp = new Date(parseInt(waStatus.timestamp) * 1000);
        const recipientPhone = waStatus.recipient_id;

        try {
            // 1. Try updating incoming message (rare, but possible for some event types)
            const inboundUpdate = await this.messageModel.updateOne(
                { waMessageId },
                { $set: { status, statusTimestamp } }
            );

            if (inboundUpdate.matchedCount > 0) {
                this.logger.log(`[Inbound] Status updated: ${waMessageId} -> ${status} (Workspace: ${workspaceId})`);
                return { success: true, waMessageId, status };
            }

            // 2. Try updating outgoing message
            const outboundUpdate = await this.outgoingMessageModel.findOneAndUpdate(
                { waMessageId },
                { $set: { status, statusTimestamp } },
                { new: true }
            );

            if (outboundUpdate) {
                this.logger.log(`[Outbound] Status updated: ${waMessageId} -> ${status} (Workspace: ${workspaceId})`);
            } else {
                // 3. AUTO-PERSIST EXTERNAL MESSAGES:
                // If no record exists, this message was likely sent from the Meta Portal directly.
                // We create a skeleton record so it's visible in our DB.
                this.logger.log(`[Outbound] Externally sent message detected. Creating record: ${waMessageId}`);

                const externalMessage = new this.outgoingMessageModel({
                    waMessageId,
                    recipientPhone: recipientPhone || 'unknown',
                    textBody: '(Sent externally via Meta Portal)',
                    messageType: 'unknown',
                    status,
                    statusTimestamp,
                    payload: { waStatus }, // Store the status payload for reference
                    workspaceId, // Important: tenant isolation
                });
                await externalMessage.save();
                this.logger.debug(`[Outbound] External message persisted: ${waMessageId}`);
            }

            return { success: true, waMessageId, status };
        } catch (error) {
            this.logger.error(`Failed to update status for ${waMessageId}: ${error.message}`, error.stack);
            throw error;
        }
    }

    private async publishToRabbitMQ(payload: any, workspaceId: string, waMessageId: string) {
        try {
            await lastValueFrom(
                this.rabbitClient.emit('incoming.message.queue', payload).pipe(
                    timeout(5000),
                    retry(3),
                ),
            );
            this.logger.log(`Successfully published to RabbitMQ (Workspace: ${workspaceId}, Message: ${waMessageId})`);
        } catch (publishError: any) {
            this.logger.error(`Failed to publish to RabbitMQ after retries: ${publishError.message}`, publishError.stack);
        }
    }
}
