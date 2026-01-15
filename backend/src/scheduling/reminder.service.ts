// DEPRECATED: Logic moved to SchedulerService for consolidation and dynamic timing.
// This file is kept temporarily as a placeholder to avoid breaking module imports immediately.
// It effectively does nothing.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class ReminderService implements OnModuleInit {
    private readonly logger = new Logger(ReminderService.name);

    onModuleInit() {
        this.logger.warn('⚠️ ReminderService is DEPRECATED and DISABLED. Using SchedulerService instead.');
    }
}
