import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { MessagingService } from './messaging.service';
import { tenantContext } from '../tenant/tenant.context';

@Controller()
export class MessagingController {
    private readonly logger = new Logger(MessagingController.name);

    constructor(private readonly messagingService: MessagingService) { }

    @EventPattern('outgoing.message.queue')
    async handleOutgoingMessage(@Payload() data: any, @Ctx() context: RmqContext) {
        // Extract workspaceId from payload directly, assuming the producer embeds it
        // Alternatively, if the producer emits the whole context, we unwrap it
        const workspaceId = data.workspaceId || data.payload?.workspaceId;

        if (!workspaceId) {
            this.logger.error('Received outgoing message without a workspaceId', data);
            return;
        }

        // Run the service logic inside the Tenant Context to ensure Mongoose logging tags the workspaceId
        await tenantContext.run({ workspaceId }, async () => {
            this.logger.log(`Processing outgoing message for workspace ${workspaceId}`);
            try {
                await this.messagingService.sendWhatsAppMessage(data);
            } catch (error) {
                this.logger.error(`Failed to process message for workspace ${workspaceId}`, error);
            }
        });
    }
}
