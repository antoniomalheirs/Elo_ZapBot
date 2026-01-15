import { Module } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { AppointmentsController } from './appointments.controller';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { SystemConfigModule } from '../config/config.module';
import { SchedulerModule } from '../scheduler/scheduler.module';

@Module({
    imports: [WhatsAppModule, SystemConfigModule, SchedulerModule],
    controllers: [AppointmentsController],
    providers: [SchedulingService],
    exports: [SchedulingService],
})
export class SchedulingModule { }
