import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Conversation, ConversationDocument } from "./schemas/conversation.schema";

export interface UpsertConversationDto {
    workspaceId: string;
    phoneNumberId: string;
    contact: string;
    lastMessage: string;
    lastMessageAt: Date;
}

@Injectable()
export class ConversationService {
    private readonly logger = new Logger(ConversationService.name);

    constructor(
        @InjectModel(Conversation.name) private readonly conversationModel: Model<ConversationDocument>,
    ) {}

    /**
     * Upsert conversation after a successful INBOUND message save.
     * First message from a contact: creates with status=open.
     * Subsequent messages: updates preview + increments unreadCount.
     */
    async upsertFromInboundMessage(dto: UpsertConversationDto): Promise<void> {
        const { workspaceId, phoneNumberId, contact, lastMessage, lastMessageAt } = dto;
        try {
            await this.conversationModel.findOneAndUpdate(
                { workspaceId, phoneNumberId, contact },
                {
                    $set:         { lastMessage, lastMessageAt },
                    $inc:         { unreadCount: 1 },
                    $setOnInsert: { status: "open", assignedAgentId: null },
                },
                { upsert: true, new: true },
            );
            this.logger.log(`[inbound] Conversation upserted workspace=${workspaceId} contact=${contact}`);
        } catch (err: any) {
            if (err.code === 11000) {
                this.logger.warn(`[inbound] Conversation upsert race (duplicate key) contact=${contact}. Ignoring.`);
                return;
            }
            this.logger.error(`[inbound] Conversation upsert failed workspace=${workspaceId} contact=${contact}`, err.stack);
            throw err;
        }
    }

    /**
     * Update conversation after a successful OUTBOUND send.
     * Updates preview + resets unreadCount to 0 (agent read everything).
     */
    async upsertFromOutboundMessage(dto: UpsertConversationDto): Promise<void> {
        const { workspaceId, phoneNumberId, contact, lastMessage, lastMessageAt } = dto;
        try {
            await this.conversationModel.findOneAndUpdate(
                { workspaceId, phoneNumberId, contact },
                {
                    $set:         { lastMessage, lastMessageAt, unreadCount: 0 },
                    $setOnInsert: { status: "open", assignedAgentId: null },
                },
                { upsert: true, new: true },
            );
            this.logger.log(`[outbound] Conversation updated workspace=${workspaceId} contact=${contact}`);
        } catch (err: any) {
            if (err.code === 11000) {
                this.logger.warn(`[outbound] Conversation upsert race (duplicate key) contact=${contact}. Ignoring.`);
                return;
            }
            this.logger.error(`[outbound] Conversation update failed workspace=${workspaceId} contact=${contact}`, err.stack);
            throw err;
        }
    }

    /**
     * Update conversation preview when an OUTBOUND send fails.
     * Does NOT modify unreadCount.
     */
    async updateLastMessageOnFailure(dto: UpsertConversationDto): Promise<void> {
        const { workspaceId, phoneNumberId, contact, lastMessage, lastMessageAt } = dto;
        try {
            await this.conversationModel.findOneAndUpdate(
                { workspaceId, phoneNumberId, contact },
                {
                    $set:         { lastMessage, lastMessageAt },
                    $setOnInsert: { status: "open", unreadCount: 0, assignedAgentId: null },
                },
                { upsert: true, new: true },
            );
            this.logger.log(`[outbound-failed] Conversation preview updated workspace=${workspaceId} contact=${contact}`);
        } catch (err: any) {
            if (err.code === 11000) {
                this.logger.warn(`[outbound-failed] Conversation upsert race (duplicate key) contact=${contact}. Ignoring.`);
                return;
            }
            this.logger.error(`[outbound-failed] Conversation update failed workspace=${workspaceId} contact=${contact}`, err.stack);
            throw err;
        }
    }
}
