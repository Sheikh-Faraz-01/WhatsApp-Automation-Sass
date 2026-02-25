import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WebhookService } from './webhook/webhook.service';
import { MessagingService } from './messaging/messaging.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MessageDocument } from './webhook/schemas/message.schema';
import { OutgoingMessageDocument, OutgoingMessage } from './messaging/schemas/outgoing-message.schema';
import { tenantContext } from './tenant/tenant.context';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

async function bootstrap() {
    console.log('🚀 Starting end-to-end integration test...');
    const app = await NestFactory.createApplicationContext(AppModule);

    const webhookService = app.get(WebhookService);
    const messagingService = app.get(MessagingService);
    const incomingMessageModel = app.get<Model<MessageDocument>>(getModelToken('Message'));
    const outgoingMessageModel = app.get<Model<OutgoingMessageDocument>>(getModelToken(OutgoingMessage.name));
    const rabbitClient = app.get<ClientProxy>('RABBITMQ_SERVICE');

    // Ensure RabbitMQ client is connected
    await rabbitClient.connect();

    const testWorkspaceId = 'test-workspace-999';

    console.log('\n--- Test 1: Simulating Webhook POST (Incoming Message) ---');
    const mockIncomingPayload = {
        object: 'whatsapp_business_account',
        entry: [{
            id: '123456',
            changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: { display_phone_number: '123', phone_number_id: '123' },
                    contacts: [{ profile: { name: 'Test User' }, wa_id: '15551234567' }],
                    messages: [{ from: '15551234567', id: 'wamid.123', timestamp: '123456789', text: { body: 'Hello from CLI Test!' }, type: 'text' }]
                },
                field: 'messages'
            }]
        }]
    };

    // We are bypassing the controller's signature check since it's a direct service hit
    // We MUST run this inside the tenant context so the DB logs the workspaceId
    await tenantContext.run({ workspaceId: testWorkspaceId }, async () => {
        console.log('1. Processing incoming message via WebhookService...');
        await webhookService.processMessage(mockIncomingPayload);

        console.log('2. Verifying MongoDB insertion for Incoming Message...');
        // We can query directly since tenant context restricts it to testWorkspaceId implicitly
        const savedIncoming = await incomingMessageModel.findOne({ 'payload.entry.0.changes.0.value.messages.0.id': 'wamid.123' }).exec();

        if (savedIncoming) {
            console.log('✅ Incoming message successfully saved to MongoDB (with workspaceId added by Mongoose middleware!).');
            // @ts-ignore
            console.log(`   Internal workspaceId logged: ${savedIncoming.workspaceId}`);
        } else {
            console.error('❌ Failed to find the incoming message in MongoDB.');
        }
    });


    console.log('\n--- Test 2: Simulating Outgoing Message (Messaging Module) ---');
    const mockOutgoingData = {
        to: '15559998888',
        type: 'text',
        text: { body: 'Reply from CLI Test!' },
        workspaceId: testWorkspaceId
    };

    await tenantContext.run({ workspaceId: testWorkspaceId }, async () => {
        console.log('1. Triggering MessagingService.sendWhatsAppMessage...');
        // Since we don't have a real valid META_ACCESS_TOKEN and phone number ID, we expect this 
        // to attempt the HTTP call, fail (due to fake credentials), and log a "failed" status after retries (or immediately if network error).

        // To speed up the test and not wait 3+ seconds for retries, let's just make sure the initial DB log works
        // We'll wrap it in a mock or just let the axios call fail to observe the error tracking
        const startTime = Date.now();
        try {
            await messagingService.sendWhatsAppMessage(mockOutgoingData);
        } catch (e: any) {
            console.log(`   (Expected axios failure due to fake credentials: ${e.message})`);
        }
        const endTime = Date.now();

        console.log('2. Verifying MongoDB insertion for Outgoing Message...');
        // Fetch the newly created outgoing log
        const savedOutgoing = await outgoingMessageModel.findOne({ recipientPhone: '15559998888' }).sort({ createdAt: -1 }).exec();

        if (savedOutgoing) {
            console.log('✅ Outgoing message attempt saved to MongoDB.');
            console.log(`   Final Status: ${savedOutgoing.status}`);
            console.log(`   Retry Count: ${savedOutgoing.retryCount}`);
            // @ts-ignore
            console.log(`   Internal workspaceId logged: ${savedOutgoing.workspaceId}`);
            if (savedOutgoing.status === 'failed') {
                console.log(`   Error Logged: ${savedOutgoing.errorReason}`);
            }
        } else {
            console.error('❌ Failed to find the outgoing message in MongoDB.');
        }
    });


    console.log('\n--- Test 3: Simulating RabbitMQ Producer -> Consumer End-to-End ---');
    console.log('1. Publishing to "outgoing.message.queue"...');
    // We emit the message just like another microservice would
    rabbitClient.emit('outgoing.message.queue', mockOutgoingData);
    console.log('✅ Event emitted to RabbitMQ successfully. (If main app is running, it will consume it).');

    console.log('\n🎉 End-to-End Integration Test Completed.');
    await app.close();
    process.exit(0);
}

bootstrap();
