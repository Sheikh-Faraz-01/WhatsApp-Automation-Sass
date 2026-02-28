import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IncomingController } from './incoming.controller';
import { IncomingService } from './incoming.service';
import { IncomingMessage, IncomingMessageSchema } from './schemas/incoming-message.schema';
import { ConversationModule } from '../conversation/conversation.module';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: IncomingMessage.name, schema: IncomingMessageSchema }]),
        ConversationModule,   // provides ConversationService for upsert logic
    ],
    controllers: [IncomingController],
    providers: [IncomingService],
    exports: [IncomingService],
})
export class IncomingModule { }

