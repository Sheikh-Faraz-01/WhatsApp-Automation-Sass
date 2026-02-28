import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Conversation, ConversationSchema } from "./schemas/conversation.schema";
import { ConversationService } from "./conversation.service";

@Module({
    imports: [
        MongooseModule.forFeature([{ name: Conversation.name, schema: ConversationSchema }]),
    ],
    providers: [ConversationService],
    exports: [ConversationService],
})
export class ConversationModule {}
