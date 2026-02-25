import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Global()
@Module({
    imports: [
        ClientsModule.register([
            {
                name: 'RABBITMQ_SERVICE',
                transport: Transport.RMQ,
                options: {
                    urls: [process.env.RABBITMQ_URL || 'amqp://localhost:5672'],
                    queue: 'whatsapp_saas_queue',
                    queueOptions: {
                        durable: true,
                    },
                },
            },
        ]),
    ],
    exports: [ClientsModule],
})
export class RabbitMQModule { }
