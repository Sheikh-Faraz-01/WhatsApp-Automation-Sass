import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { WebhookModule } from './webhook/webhook.module';
import { RoutingModule } from './routing/routing.module';
import { ChatbotModule } from './chatbot/chatbot.module';
import { AiModule } from './ai/ai.module';
import { KnowledgeBaseModule } from './knowledge-base/knowledge-base.module';
import { InboxModule } from './inbox/inbox.module';
import { CrmModule } from './crm/crm.module';
import { MessagingModule } from './messaging/messaging.module';
import { DatabaseModule } from './database/database.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { TenantModule } from './tenant/tenant.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        PORT: Joi.number().default(3000),
        MONGODB_URI: Joi.string().required(),
        RABBITMQ_URL: Joi.string().required(),
        WHATSAPP_ACCESS_TOKEN: Joi.string().required(),
        WHATSAPP_PHONE_NUMBER_ID: Joi.string().required(),
        WHATSAPP_BUSINESS_ACCOUNT_ID: Joi.string().required(),
        META_APP_SECRET: Joi.string().required(),
        WEBHOOK_VERIFY_TOKEN: Joi.string().required(),
      }),
    }),
    AuthModule,
    WorkspaceModule,
    WebhookModule,
    RoutingModule,
    ChatbotModule,
    AiModule,
    KnowledgeBaseModule,
    InboxModule,
    CrmModule,
    MessagingModule,
    DatabaseModule,
    RabbitMQModule,
    TenantModule,
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 20,
    }]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
