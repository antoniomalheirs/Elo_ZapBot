import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { DatabaseModule } from '../database/database.module';
import { AIModule } from '../ai/ai.module';

@Module({
    imports: [
        ConfigModule,
        DatabaseModule,
        AIModule
    ],
    providers: [WhatsAppService],
    controllers: [WhatsAppController],
    exports: [WhatsAppService],
})
export class WhatsAppModule { }
