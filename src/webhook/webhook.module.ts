import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { Message, MessageSchema } from './schemas/message.schema';
import { OutgoingMessage, OutgoingMessageSchema } from '../messaging/schemas/outgoing-message.schema';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: OutgoingMessage.name, schema: OutgoingMessageSchema },
    ]),
    ClientsModule.register([
      {
        name: 'RABBITMQ_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
          queue: 'incoming_message_queue',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
    WorkspaceModule,
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule { }
