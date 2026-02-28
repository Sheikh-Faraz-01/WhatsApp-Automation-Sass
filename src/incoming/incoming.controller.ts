import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { IncomingService } from './incoming.service';
import { tenantContext } from '../tenant/tenant.context';

@Controller()
export class IncomingController {
    private readonly logger = new Logger(IncomingController.name);

    constructor(private readonly incomingService: IncomingService) { }

    @EventPattern('incoming.message.queue')
    async handleIncomingMessage(@Payload() data: { workspaceId: string; payload: any }, @Ctx() context: RmqContext) {
        // WebhookService guarantees workspaceId is always resolved before emit.
        const { workspaceId, payload } = data;

        if (!workspaceId) {
            this.logger.warn('Received RabbitMQ message without workspaceId — message dropped.');
            return;
        }

        // Run inside tenant context so Mongoose middleware can tag all writes with workspaceId
        await tenantContext.run({ workspaceId }, async () => {
            try {
                this.logger.log(`[incoming.message.queue] Processing message for workspace ${workspaceId}`);
                await this.incomingService.processIncomingMessage(payload, workspaceId);
            } catch (error) {
                this.logger.error(
                    `Failed to process inbound message for workspace ${workspaceId}`,
                    error,
                );
            }
        });
    }
}

