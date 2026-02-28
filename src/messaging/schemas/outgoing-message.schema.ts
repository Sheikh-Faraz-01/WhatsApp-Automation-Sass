import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type OutgoingMessageDocument = OutgoingMessage & Document;

@Schema({ timestamps: true })
export class OutgoingMessage extends Document {
    @Prop({ type: String, required: true })
    workspaceId: string;

    @Prop({ type: String, required: true })
    phoneNumberId: string;

    /** Recipient WhatsApp phone number */
    @Prop({ type: String, required: true })
    to: string;

    /** WhatsApp message ID returned by the Graph API on successful send; empty on failure */
    @Prop({ type: String, required: false, default: null })
    messageId?: string;

    @Prop({ type: String, required: true })
    type: string;

    /** Plain-text body (for text messages) */
    @Prop({ type: String, required: false, default: null })
    text?: string;

    @Prop({ type: Date, required: true })
    timestamp: Date;

    @Prop({ type: String, required: true, default: "outbound", enum: ["outbound"] })
    direction: string;

    @Prop({ type: String, required: true, enum: ["sent", "failed"] })
    status: "sent" | "failed";

    /** Populated only on failure */
    @Prop({ type: String, required: false, default: null })
    errorReason?: string;

    @Prop({ type: Number, required: true, default: 0 })
    retryCount: number;
}

export const OutgoingMessageSchema = SchemaFactory.createForClass(OutgoingMessage);

// Unique index on messageId — only index rows where messageId is not null
// (failed messages have null messageId, so we use a sparse index)
OutgoingMessageSchema.index({ messageId: 1 }, { unique: true, sparse: true });
