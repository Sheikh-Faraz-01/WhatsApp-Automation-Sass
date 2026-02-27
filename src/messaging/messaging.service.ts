import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { lastValueFrom } from 'rxjs';
import { OutgoingMessage, OutgoingMessageDocument } from './schemas/outgoing-message.schema';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MessagingService {
    private readonly logger = new Logger(MessagingService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        @InjectModel(OutgoingMessage.name) private readonly messageModel: Model<OutgoingMessageDocument>,
    ) { }

    private get graphApiVersion() { return this.configService.get<string>('META_GRAPH_VERSION') || 'v19.0'; }
    private get metaAccessToken() { return this.configService.get<string>('WHATSAPP_ACCESS_TOKEN'); }
    private get defaultPhoneNumberId() { return this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID'); }

    async sendWhatsAppMessage(data: any): Promise<void> {
        const { to, type, template, text, phoneNumberId = this.defaultPhoneNumberId } = data;
        const textBody = type === 'text' ? text?.body : (type === 'template' ? `Template: ${template?.name}` : 'Media');

        const requestPayload = this.buildMetaPayload(to, type, template, text);
        const url = `https://graph.facebook.com/${this.graphApiVersion}/${phoneNumberId}/messages`;

        let success = false;
        let attempt = 0;
        const maxRetries = 3;

        while (attempt < maxRetries && !success) {
            attempt++;
            try {
                const response = await lastValueFrom(
                    this.httpService.post(url, requestPayload, {
                        headers: {
                            Authorization: `Bearer ${this.metaAccessToken}`,
                            'Content-Type': 'application/json',
                        },
                    }),
                );

                const waMessageId = response.data?.messages?.[0]?.id;
                this.logger.log(`WhatsApp message sent successfully on attempt ${attempt}. ID: ${waMessageId}`);

                // PERSISTENCE: Save record AFTER getting the ID from Meta
                // This prevents race conditions where status webhooks arrive before the save completes
                const logEntry = new this.messageModel({
                    waMessageId,
                    recipientPhone: to,
                    from: phoneNumberId, // Store who sent it
                    textBody,
                    messageType: type,
                    payload: data,
                    status: 'sent',
                    retryCount: attempt,
                });
                await logEntry.save();
                this.logger.debug(`Outgoing message persisted: ${waMessageId}`);

                success = true;

            } catch (error: any) {
                this.logger.error(`WhatsApp message failed on attempt ${attempt}: ${error.message}`);

                if (attempt >= maxRetries) {
                    // Log failure even if no waMessageId exists
                    const logEntry = new this.messageModel({
                        recipientPhone: to,
                        from: phoneNumberId,
                        textBody,
                        messageType: type,
                        payload: data,
                        status: 'failed',
                        errorReason: error.response?.data?.error?.message || error.message,
                        retryCount: attempt,
                    });
                    await logEntry.save();
                } else {
                    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
                }
            }
        }
    }

    private buildMetaPayload(to: string, type: 'template' | 'text', template?: any, text?: any) {
        const payload: any = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type,
        };

        if (type === 'template' && template) {
            payload.template = template;
        } else if (type === 'text' && text) {
            payload.text = text;
        }

        return payload;
    }
}
