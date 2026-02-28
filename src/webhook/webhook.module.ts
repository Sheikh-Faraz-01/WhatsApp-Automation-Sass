import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from './schemas/message.schema';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
    ]),
    WorkspaceModule,   // provides and exports WorkspaceService
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule { }

