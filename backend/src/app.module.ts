import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerModule } from './scheduler/scheduler.module';

// Core Modules
import { DatabaseModule } from './database/database.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';
import { AIModule } from './ai/ai.module';
import { ContextModule } from './context/context.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { SystemConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';

@Module({
    imports: [
        // Configuration
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['.env', '../.env'],
        }),
        ScheduleModule.forRoot(), // Para Cron Jobs
        SchedulerModule, // Nosso módulo de cron

        // Core modules
        DatabaseModule,
        WhatsAppModule,
        OrchestratorModule,
        AIModule,
        ContextModule,
        SchedulingModule,
        SystemConfigModule,
        HealthModule,
    ],
})
export class AppModule { }
