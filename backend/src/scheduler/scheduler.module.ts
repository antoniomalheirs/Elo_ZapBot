import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { DatabaseModule } from '../database/database.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { ContextModule } from '../context/context.module';

@Module({
    imports: [
        DatabaseModule,
        WhatsAppModule,
        ContextModule
    ],
    providers: [SchedulerService],
    exports: [SchedulerService]
})
export class SchedulerModule { }
