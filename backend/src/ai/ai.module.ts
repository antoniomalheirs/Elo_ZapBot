import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SystemConfigModule } from '../config/config.module';
import { TranscriptionService } from './transcription.service';
import { AIService } from './ai.service';
import { KeywordDetectorService } from './keyword-detector.service';
import { VisionService } from './vision.service';

@Module({
    imports: [
        ConfigModule,
        SystemConfigModule
    ],
    providers: [AIService, TranscriptionService, KeywordDetectorService, VisionService],
    exports: [AIService, TranscriptionService, KeywordDetectorService, VisionService],
})
export class AIModule { }


