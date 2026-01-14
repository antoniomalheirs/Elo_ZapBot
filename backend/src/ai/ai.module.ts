import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SystemConfigModule } from '../config/config.module';
import { TranscriptionService } from './transcription.service';
import { AIService } from './ai.service';

@Module({
    imports: [
        ConfigModule,
        SystemConfigModule
    ],
    providers: [AIService, TranscriptionService],
    exports: [AIService, TranscriptionService],
})
export class AIModule { }
