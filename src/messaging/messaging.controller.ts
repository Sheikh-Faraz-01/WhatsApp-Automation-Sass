import { Controller, Logger, Post, Body } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { MessagingService } from './messaging.service';
import { tenantContext } from '../tenant/tenant.context';

@Controller('messaging')
export class MessagingController {
    private readonly logger = new Logger(MessagingController.name);

    constructor(private readonly messagingService: MessagingService) { }

    @EventPattern('outgoing.message.queue')
    async handleOutgoingMessage(@Payload() data: any, @Ctx() context: RmqContext) {
        const workspaceId = data.workspaceId || data.payload?.workspaceId;

        if (!workspaceId) {
            this.logger.error('Received outgoing message without a workspaceId', data);
            return;
        }

        await tenantContext.run({ workspaceId }, async () => {
            this.logger.log(`Processing RMQ outgoing message for workspace ${workspaceId}`);
            try {
                await this.messagingService.sendWhatsAppMessage(data);
            } catch (error) {
                this.logger.error(`Failed to process RMQ message for workspace ${workspaceId}`, error);
            }
        });
    }

    @Post('send')
    async sendMessage(@Body() body: any) {
        const workspaceId = body.workspaceId;
        if (!workspaceId) {
            throw new Error('workspaceId is required in body');
        }

        return await tenantContext.run({ workspaceId }, async () => {
            this.logger.log(`Direct API call to send message for workspace ${workspaceId}`);
            await this.messagingService.sendWhatsAppMessage(body);
            return { success: true, message: 'Message sending initiated' };
        });
    }
}
