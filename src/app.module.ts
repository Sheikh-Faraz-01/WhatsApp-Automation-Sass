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
@Module({
  imports: [
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
    TenantModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
