import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OutgoingMessageDocument = OutgoingMessage & Document;

@Schema({ timestamps: true })
export class OutgoingMessage {
    @Prop({ required: true, index: true })
    recipientPhone: string;

    @Prop({ index: true })
    from?: string;

    @Prop({ index: true })
    waMessageId?: string;

    @Prop()
    textBody?: string;

    @Prop()
    messageType?: string;

    @Prop({ type: Object, required: true })
    payload: Record<string, any>;

    @Prop({ required: true, enum: ['pending', 'sent', 'failed'], default: 'pending' })
    status: string;

    @Prop({ type: String })
    errorReason?: string;

    @Prop({ default: 0 })
    retryCount: number;

    // Expected dynamically added via tenantPlugin: workspaceId: string;
}

export const OutgoingMessageSchema = SchemaFactory.createForClass(OutgoingMessage);
