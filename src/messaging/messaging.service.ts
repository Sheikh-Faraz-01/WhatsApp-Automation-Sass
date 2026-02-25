import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { lastValueFrom } from 'rxjs';
import { OutgoingMessage, OutgoingMessageDocument } from './schemas/outgoing-message.schema';

@Injectable()
export class MessagingService {
    private readonly logger = new Logger(MessagingService.name);
    private readonly graphApiVersion = process.env.META_GRAPH_VERSION || 'v19.0';
    private readonly metaAccessToken = process.env.META_ACCESS_TOKEN || 'test_token';
    // Note: Phone number ID should ideally be fetched from a Workspace/Config collection based on tenantContext
    private readonly defaultPhoneNumberId = process.env.META_PHONE_NUMBER_ID || '1234567890';

    constructor(
        private readonly httpService: HttpService,
        @InjectModel(OutgoingMessage.name) private readonly messageModel: Model<OutgoingMessageDocument>,
    ) { }

    async sendWhatsAppMessage(data: any): Promise<void> {
        const { to, type, template, text, phoneNumberId = this.defaultPhoneNumberId } = data;

        // Create initial pending log record in MongoDB
        // Mongoose tenant plugin will automatically set workspaceId
        const logEntry = new this.messageModel({
            recipientPhone: to,
            payload: data,
            status: 'pending',
        });
        await logEntry.save();

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

                this.logger.log(`WhatsApp message sent successfully on attempt ${attempt}`);

                logEntry.status = 'sent';
                logEntry.retryCount = attempt;
                await logEntry.save();
                success = true;

            } catch (error: any) {
                this.logger.error(`WhatsApp message failed on attempt ${attempt}: ${error.message}`);

                if (attempt >= maxRetries) {
                    logEntry.status = 'failed';
                    logEntry.errorReason = error.response?.data?.error?.message || error.message;
                    logEntry.retryCount = attempt;
                    await logEntry.save();
                } else {
                    // Exponential backoff before retry (e.g., 1s, 2s)
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
