import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { OutgoingMessage, OutgoingMessageSchema } from './schemas/outgoing-message.schema';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([{ name: OutgoingMessage.name, schema: OutgoingMessageSchema }]),
  ],
  controllers: [MessagingController],
  providers: [MessagingService]
})
export class MessagingModule { }
