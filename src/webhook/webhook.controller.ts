import { Controller, Get, Post, Query, Req, Res, Headers, HttpStatus, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { WebhookService } from './webhook.service';

@Controller('webhook')
export class WebhookController {
    private readonly verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || 'test_token';

    constructor(private readonly webhookService: WebhookService) { }

    @Get()
    verifyWebhook(
        @Query('hub.mode') mode: string,
        @Query('hub.verify_token') token: string,
        @Query('hub.challenge') challenge: string,
        @Res() res: Response,
    ) {
        if (mode && token) {
            if (mode === 'subscribe' && token === this.verifyToken) {
                console.log('WEBHOOK_VERIFIED');
                return res.status(HttpStatus.OK).send(challenge);
            } else {
                return res.sendStatus(HttpStatus.FORBIDDEN);
            }
        }
        return res.sendStatus(HttpStatus.BAD_REQUEST);
    }

    @Post()
    async receiveMessage(
        @Req() req: Request,
        @Headers('x-hub-signature-256') signature: string,
        @Res() res: Response,
    ) {
        const rawBody = (req as any).rawBody;

        if (!this.webhookService.verifySignature(signature, rawBody)) {
            throw new HttpException('Invalid signature', HttpStatus.FORBIDDEN);
        }

        // Process the validated payload
        await this.webhookService.processMessage(req.body);

        // Webhook expects a 200 OK response within a few seconds
        return res.status(HttpStatus.OK).send('EVENT_RECEIVED');
    }
}
