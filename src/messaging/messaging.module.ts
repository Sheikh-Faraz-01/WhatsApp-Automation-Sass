import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { OutgoingMessage, OutgoingMessageSchema } from './schemas/outgoing-message.schema';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';
import { ConversationModule } from '../conversation/conversation.module';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([{ name: OutgoingMessage.name, schema: OutgoingMessageSchema }]),
    ConversationModule,
  ],
  controllers: [MessagingController],
  providers: [MessagingService]
})
export class MessagingModule { }
