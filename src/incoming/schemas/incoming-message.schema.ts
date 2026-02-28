import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IncomingMessageDocument = IncomingMessage & Document;

@Schema({ timestamps: true })
export class IncomingMessage extends Document {
    @Prop({ type: String, required: true })
    workspaceId: string;

    @Prop({ type: String, required: true })
    phoneNumberId: string;

    @Prop({ type: String, required: true })
    from: string;

    @Prop({ type: String, required: true, unique: true })
    messageId: string;

    @Prop({ type: String, required: true })
    type: string;

    @Prop({ type: Object, required: false })
    text?: { body: string };

    @Prop({ type: Date, required: true })
    timestamp: Date;

    @Prop({ type: String, required: true, default: 'inbound', enum: ['inbound'] })
    direction: string;

    @Prop({ type: Object, required: true })
    rawPayload: any;
}

export const IncomingMessageSchema = SchemaFactory.createForClass(IncomingMessage);

// ── Compound indexes for SaaS-scale tenant-scoped queries ──────────────────
// List messages per workspace, newest first (default inbox/timeline view)
IncomingMessageSchema.index({ workspaceId: 1, createdAt: -1 });

// Contact message history per workspace (e.g. CRM conversation thread)
IncomingMessageSchema.index({ workspaceId: 1, from: 1, createdAt: -1 });

// Phone number routing lookup per workspace
IncomingMessageSchema.index({ workspaceId: 1, phoneNumberId: 1 });

