import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation extends Document {
    @Prop({ type: String, required: true })
    workspaceId: string;

    @Prop({ type: String, required: true })
    phoneNumberId: string;

    @Prop({ type: String, required: true })
    contact: string;

    @Prop({ type: String, required: false, default: "" })
    lastMessage: string;

    @Prop({ type: Date, required: false })
    lastMessageAt: Date;

    @Prop({ type: Number, required: true, default: 0 })
    unreadCount: number;

    @Prop({ type: String, required: true, default: "open", enum: ["open", "closed"] })
    status: "open" | "closed";

    @Prop({ type: String, required: false, default: null })
    assignedAgentId?: string;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

ConversationSchema.index(
    { workspaceId: 1, phoneNumberId: 1, contact: 1 },
    { unique: true },
);

ConversationSchema.index({ workspaceId: 1, lastMessageAt: -1 });
