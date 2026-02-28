import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientProxy } from '@nestjs/microservices';
import * as crypto from 'crypto';
import { Message, MessageDocument } from './schemas/message.schema';
import { WorkspaceService } from '../workspace/workspace.service';

@Injectable()
export class WebhookService {
    private readonly logger = new Logger(WebhookService.name);
    private readonly appSecret = process.env.APP_SECRET || 'test_secret';

    constructor(
        @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
        private readonly workspaceService: WorkspaceService,
        @Inject('RABBITMQ_SERVICE') private readonly rabbitClient: ClientProxy,
    ) { }

    verifySignature(signature: string, rawBody: Buffer): boolean {
        if (!signature || !rawBody) {
            return false;
        }

        try {
            const hmac = crypto.createHmac('sha256', this.appSecret);
            const digest = Buffer.from('sha256=' + hmac.update(rawBody).digest('hex'), 'utf8');
            const checksum = Buffer.from(signature, 'utf8');

            if (checksum.length !== digest.length || !crypto.timingSafeEqual(digest, checksum)) {
                return false;
            }
            return true;
        } catch (e) {
            this.logger.error('Signature validation failed', e);
            return false;
        }
    }

    async processMessage(payload: any): Promise<{ success: boolean }> {
        // Step 1: Extract phone_number_id from the Meta webhook envelope
        const phoneNumberId: string | undefined =
            payload?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

        if (!phoneNumberId) {
            this.logger.warn('Webhook payload missing phone_number_id - cannot resolve tenant. Skipping RabbitMQ emit.');
            return { success: false };
        }

        // Step 2: Resolve workspaceId via WorkspaceService
        const workspace = await this.workspaceService.findByPhoneNumberId(phoneNumberId);

        if (!workspace) {
            this.logger.error(
                `No workspace found for phoneNumberId "${phoneNumberId}". Message will NOT be published to RabbitMQ.`,
            );
            return { success: false };
        }

        const workspaceId = (workspace._id as any).toString();
        this.logger.log(`Resolved workspaceId ${workspaceId} for phoneNumberId ${phoneNumberId}`);

        // Step 3: Save raw payload to MongoDB (best-effort)
        try {
            const createdMessage = new this.messageModel({ payload });
            await createdMessage.save();
        } catch (dbError) {
            this.logger.error('Failed to persist raw webhook payload to MongoDB', dbError);
        }

        // Step 4: Emit structured event to RabbitMQ
        this.rabbitClient.emit('incoming.message.queue', { workspaceId, payload });
        this.logger.log(`Emitted incoming.message.queue event for workspace ${workspaceId}`);

        return { success: true };
    }
}
