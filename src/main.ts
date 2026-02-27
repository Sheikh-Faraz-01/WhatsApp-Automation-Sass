import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import * as express from 'express';
import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  // Temporary log to confirm .env loading
  console.log('Runtime ENV TOKEN:', process.env.WEBHOOK_VERIFY_TOKEN);
  console.log(`[Startup] WEBHOOK_VERIFY_TOKEN (process.env): ${process.env.WEBHOOK_VERIFY_TOKEN?.substring(0, 5)}*****`);

  const app = await NestFactory.create(AppModule, {
    bodyParser: false, // Disable default body parser
  });

  const configService = app.get(ConfigService);
  const httpAdapter = app.get(HttpAdapterHost);

  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
  }));

  // Preserve raw body and enforce 1MB limit for /webhook
  app.use('/webhook', express.json({
    limit: '1mb',
    verify: (req: any, res, buf) => {
      if (buf && buf.length) {
        req.rawBody = buf;
      }
    },
  }));

  // Standard JSON parsing for other routes with 1MB limit
  app.use(express.json({ limit: '1mb' }));

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [configService.get<string>('RABBITMQ_URL')!],
      queue: 'outgoing_message_queue',
      queueOptions: {
        durable: true,
      },
    },
  });

  await app.startAllMicroservices();
  await app.listen(configService.get<number>('PORT') || 3000);
}
bootstrap();
