import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
    @Prop({ type: Object, required: true })
    payload: Record<string, any>;

    // The workspaceId will be dynamically added via the tenantPlugin!
}

export const MessageSchema = SchemaFactory.createForClass(Message);
