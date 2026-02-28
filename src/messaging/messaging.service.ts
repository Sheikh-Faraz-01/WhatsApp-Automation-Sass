import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { lastValueFrom } from "rxjs";
import { OutgoingMessage, OutgoingMessageDocument } from "./schemas/outgoing-message.schema";
import { ConversationService } from "../conversation/conversation.service";

@Injectable()
export class MessagingService {
    private readonly logger = new Logger(MessagingService.name);
    private readonly graphApiVersion = process.env.META_GRAPH_VERSION || "v19.0";
    private readonly metaAccessToken = process.env.META_ACCESS_TOKEN || "test_token";
    private readonly defaultPhoneNumberId = process.env.META_PHONE_NUMBER_ID || "1234567890";

    constructor(
        private readonly httpService: HttpService,
        @InjectModel(OutgoingMessage.name) private readonly outgoingModel: Model<OutgoingMessageDocument>,
        private readonly conversationService: ConversationService,
    ) {}

    async sendWhatsAppMessage(data: any): Promise<void> {
        const {
            workspaceId,
            to,
            type,
            template,
            text: textPayload,
            phoneNumberId = this.defaultPhoneNumberId,
        } = data;

        const requestPayload = this.buildMetaPayload(to, type, template, textPayload);
        const url = `https://graph.facebook.com/${this.graphApiVersion}/${phoneNumberId}/messages`;
        const sentAt = new Date();

        let whatsappMessageId: string | null = null;
        let success = false;
        let attempt = 0;
        let lastError: any = null;
        const maxRetries = 3;

        // ── Retry loop: call Meta Graph API ───────────────────────────────────────
        while (attempt < maxRetries && !success) {
            attempt++;
            try {
                const response = await lastValueFrom(
                    this.httpService.post(url, requestPayload, {
                        headers: {
                            Authorization: `Bearer ${this.metaAccessToken}`,
                            "Content-Type": "application/json",
                        },
                    }),
                );

                // Meta API returns { messages: [{ id: "wamid.xxx" }] }
                whatsappMessageId = response.data?.messages?.[0]?.id ?? null;
                this.logger.log(`WhatsApp message sent on attempt ${attempt}. wamid: ${whatsappMessageId}`);
                success = true;

            } catch (error: any) {
                lastError = error;
                this.logger.error(`WhatsApp send failed on attempt ${attempt}: ${error.message}`);

                if (attempt < maxRetries) {
                    await new Promise((r) => setTimeout(r, attempt * 1000));
                }
            }
        }

        // ── Persist OutgoingMessage ───────────────────────────────────────────────
        const plainText: string | undefined =
            type === "text" && textPayload?.body ? textPayload.body : undefined;

        try {
            const doc = new this.outgoingModel({
                workspaceId: workspaceId ?? "unknown",
                phoneNumberId,
                to,
                messageId: whatsappMessageId,   // null for failed sends (sparse index skips it)
                type,
                text: plainText,
                timestamp: sentAt,
                direction: "outbound",
                status: success ? "sent" : "failed",
                errorReason: success
                    ? null
                    : (lastError?.response?.data?.error?.message ?? lastError?.message),
                retryCount: attempt,
            });
            await doc.save();
            this.logger.log(`OutgoingMessage persisted (status=${success ? "sent" : "failed"})`);
        } catch (dbErr: any) {
            this.logger.error("Failed to persist outgoing message to MongoDB", dbErr.stack);
            // Best-effort — do not rethrow; message was already sent (or attempted)
        }

        // ── Update Conversation (only if workspaceId is known) ────────────────────
        if (workspaceId) {
            const lastMessage = plainText ?? `[${type ?? "unknown"}]`;
            try {
                if (success) {
                    // Successful outbound: update preview + reset unread count
                    await this.conversationService.upsertFromOutboundMessage({
                        workspaceId,
                        phoneNumberId,
                        contact: to,
                        lastMessage,
                        lastMessageAt: sentAt,
                    });
                } else {
                    // Failed send: update preview only, leave unreadCount untouched
                    await this.conversationService.updateLastMessageOnFailure({
                        workspaceId,
                        phoneNumberId,
                        contact: to,
                        lastMessage: `[failed] ${lastMessage}`,
                        lastMessageAt: sentAt,
                    });
                }
            } catch (convErr: any) {
                this.logger.error("Conversation update failed after outbound send", convErr.stack);
            }
        }
    }

    private buildMetaPayload(to: string, type: "template" | "text", template?: any, text?: any) {
        const payload: any = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to,
            type,
        };

        if (type === "template" && template) payload.template = template;
        else if (type === "text" && text) payload.text = text;

        return payload;
    }
}
