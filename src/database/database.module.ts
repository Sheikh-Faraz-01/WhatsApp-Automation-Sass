import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { tenantPlugin } from '../tenant/mongoose-tenant.plugin';

// Apply the multitenant plugin globally to all schemas
mongoose.plugin(tenantPlugin);

@Global()
@Module({
    imports: [
        MongooseModule.forRootAsync({
            useFactory: () => ({
                uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/whatsapp-saas',
            }),
        }),
    ],
    exports: [MongooseModule],
})
export class DatabaseModule { }
