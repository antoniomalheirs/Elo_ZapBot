import { Module } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';
import { ReminderService } from './reminder.service';
import { AppointmentsController } from './appointments.controller';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { SystemConfigModule } from '../config/config.module';

@Module({
    imports: [WhatsAppModule, SystemConfigModule],
    controllers: [AppointmentsController],
    providers: [SchedulingService, ReminderService],
    exports: [SchedulingService],
})
export class SchedulingModule { }
