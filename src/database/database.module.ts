import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import * as mongoose from 'mongoose';
import { tenantPlugin } from '../tenant/mongoose-tenant.plugin';

// Apply the multitenant plugin globally to all schemas
mongoose.plugin(tenantPlugin);

@Global()
@Module({
    imports: [
        MongooseModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                uri: configService.get<string>('MONGODB_URI')!,
            }),
        }),
    ],
    exports: [MongooseModule],
})
export class DatabaseModule { }
