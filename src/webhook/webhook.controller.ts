import { Controller, Get, Post, Query, Req, Headers, HttpStatus, HttpException, UseGuards, Body, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { WebhookService } from './webhook.service';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as WebhookDto from './dto/webhook-payload.dto';

import { ConfigService } from '@nestjs/config';

@Controller('webhook')
export class WebhookController {
    private readonly logger = new Logger(WebhookController.name);

    constructor(
        private readonly webhookService: WebhookService,
        private readonly configService: ConfigService,
    ) { }

    private get verifyToken(): string {
        return this.configService.get<string>('WEBHOOK_VERIFY_TOKEN')!;
    }

    @Get()
    verifyWebhook(
        @Query('hub.mode') mode: string,
        @Query('hub.verify_token') token: string,
        @Query('hub.challenge') challenge: string,
    ) {
        const expectedToken = this.verifyToken;
        this.logger.log(`Webhook Verification Request - Mode: ${mode}`);

        // Log masked tokens for debugging
        this.logger.debug(`Token Received: ${token?.substring(0, 5)}*****`);
        this.logger.debug(`Token Expected: ${expectedToken?.substring(0, 5)}*****`);

        if (mode === 'subscribe' && token === expectedToken) {
            this.logger.log('Webhook Verification SUCCESS');
            return challenge;
        }

        this.logger.error('Webhook Verification FAILED: Token mismatch or invalid mode');
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    @UseGuards(ThrottlerGuard)
    @Post()
    async receiveMessage(
        @Body() body: WebhookDto.WebhookPayloadDto,
        @Headers('x-hub-signature-256') signature: string,
        @Req() req: Request,
    ) {
        this.logger.log(`Incoming POST /webhook from IP: ${req.ip}`);
        const rawBody = (req as any).rawBody;

        if (!this.webhookService.verifySignature(signature, rawBody, req.ip)) {
            this.logger.warn(`Signature verification failed for request from IP: ${req.ip}`);
            throw new HttpException('Invalid signature', HttpStatus.FORBIDDEN);
        }

        try {
            const result = await this.webhookService.processMessage(body);
            this.logger.log(`Webhook message processed successfully`);
            return result;
        } catch (error) {
            this.logger.error(`Failed to process webhook message: ${error.message}`, error.stack);
            throw error;
        }
    }
}
