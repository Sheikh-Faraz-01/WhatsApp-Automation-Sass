import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
    @Prop({ required: true, index: true })
    waMessageId: string;

    @Prop({ required: true, index: true })
    from: string;

    @Prop({ required: true })
    to: string;

    @Prop({ required: true })
    messageType: string;

    @Prop()
    textBody?: string;

    @Prop({ type: Object })
    metadata?: Record<string, any>;

    @Prop({ index: true })
    status?: string;

    @Prop({ required: true, index: true })
    timestamp: Date;

    @Prop({ type: Object })
    rawPayload?: Record<string, any>;

    // The workspaceId will be dynamically added via the tenantPlugin!
    // workspaceId is indexed in the plugin.
}

export const MessageSchema = SchemaFactory.createForClass(Message);
