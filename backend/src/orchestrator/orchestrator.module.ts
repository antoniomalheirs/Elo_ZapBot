import { Module } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { StateMachine } from './state-machine';
import { RuleEngine } from './rule-engine';
import { HumanizeService } from './humanize.service';
import { ConversationsController } from './conversations.controller';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { AIModule } from '../ai/ai.module';
import { ContextModule } from '../context/context.module';
import { SystemConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';

import { OrchestratorController } from './orchestrator.controller';

@Module({
    imports: [
        WhatsAppModule,
        AIModule,
        ContextModule,
        SystemConfigModule,
        DatabaseModule
    ],
    controllers: [ConversationsController, OrchestratorController],
    providers: [OrchestratorService, StateMachine, RuleEngine, HumanizeService],
    exports: [OrchestratorService],
})
export class OrchestratorModule { }
