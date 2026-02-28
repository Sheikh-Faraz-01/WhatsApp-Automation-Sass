import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { IncomingMessage, IncomingMessageDocument } from "./schemas/incoming-message.schema";
import { ConversationService } from "../conversation/conversation.service";

@Injectable()
export class IncomingService {
    private readonly logger = new Logger(IncomingService.name);

    constructor(
        @InjectModel(IncomingMessage.name) private readonly messageModel: Model<IncomingMessageDocument>,
        private readonly conversationService: ConversationService,
    ) {}

    async processIncomingMessage(payload: any, workspaceId: string): Promise<void> {
        this.logger.debug(`Processing inbound message for workspace ${workspaceId}`);

        // ── Extract fields from the Meta webhook envelope ──────────────────────────
        const entry   = payload?.entry?.[0];
        const changes = entry?.changes?.[0];
        const value   = changes?.value;

        const phoneNumberId: string | undefined = value?.metadata?.phone_number_id;

        const messages = value?.messages;
        if (!messages || messages.length === 0) {
            this.logger.debug("No messages array found in payload, ignoring.");
            return;
        }

        const message = messages[0];
        const { from, id: messageId, timestamp: rawTimestamp, type, text } = message;

        if (!messageId) {
            this.logger.warn("Message missing ID, skipping insertion.");
            return;
        }

        // Convert Meta Unix epoch string (e.g. "1709123456") to a proper Date.
        const timestamp: Date = rawTimestamp
            ? new Date(parseInt(rawTimestamp, 10) * 1000)
            : new Date();

        // ── Step 1: Save inbound message ───────────────────────────────────────────
        try {
            const newDoc = new this.messageModel({
                workspaceId,
                phoneNumberId,
                from,
                messageId,
                type,
                timestamp,
                text,
                direction: "inbound",
                rawPayload: payload,
            });
            await newDoc.save();

            this.logger.log(`Stored inbound message ${messageId} from ${from} (workspace ${workspaceId})`);

        } catch (error: any) {
            if (error.code === 11000) {
                // Duplicate messageId — webhook re-delivery. Do NOT update conversation.
                this.logger.warn(`Duplicate message detected (messageId ${messageId}). Skipping conversation upsert.`);
                return;
            }
            this.logger.error(`Failed to save inbound message: ${error.message}`, error.stack);
            throw error;
        }

        // ── Step 2: Upsert conversation (only reached if message save succeeded) ───
        // Extract plain text body for the preview; fall back to message type label.
        const lastMessage: string =
            (text?.body as string | undefined) ??
            `[${type ?? "unknown"}]`;

        try {
            await this.conversationService.upsertFromInboundMessage({
                workspaceId,
                phoneNumberId: phoneNumberId ?? "",
                contact: from,
                lastMessage,
                lastMessageAt: timestamp,
            });
        } catch (convError: any) {
            // Log but do not rethrow — a failed conversation upsert should not
            // cause the message to be re-queued / re-processed by RabbitMQ.
            this.logger.error(
                `Conversation upsert failed for workspace=${workspaceId} contact=${from}: ${convError.message}`,
                convError.stack,
            );
        }
    }
}
