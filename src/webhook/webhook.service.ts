import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientProxy } from '@nestjs/microservices';
import * as crypto from 'crypto';
import { Message, MessageDocument } from './schemas/message.schema';

@Injectable()
export class WebhookService {
    private readonly appSecret = process.env.APP_SECRET || 'test_secret';

    constructor(
        @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
        @Inject('RABBITMQ_SERVICE') private readonly rabbitClient: ClientProxy,
    ) { }

    verifySignature(signature: string, rawBody: Buffer): boolean {
        if (!signature || !rawBody) {
            return false;
        }

        try {
            const hmac = crypto.createHmac('sha256', this.appSecret);
            const digest = Buffer.from('sha256=' + hmac.update(rawBody).digest('hex'), 'utf8');
            const checksum = Buffer.from(signature, 'utf8');

            if (checksum.length !== digest.length || !crypto.timingSafeEqual(digest, checksum)) {
                return false;
            }
            return true;
        } catch (e) {
            console.error('Signature validation failed:', e);
            return false;
        }
    }

    async processMessage(payload: any) {
        try {
            // 1. Save to MongoDB (tenant plugin will inject workspaceId from context)
            const createdMessage = new this.messageModel({ payload });
            await createdMessage.save();

            // 2. Publish to RabbitMQ for downstream processing
            this.rabbitClient.emit('incoming.message.queue', payload);

            return { success: true };
        } catch (error) {
            console.error('Error processing message:', error);
            throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
