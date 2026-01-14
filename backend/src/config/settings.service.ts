import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SettingsService {
    constructor(private readonly prisma: PrismaService) { }

    async getSetting(key: string) {
        const config = await this.prisma.systemConfig.findUnique({
            where: { key }
        });
        return config?.value || null;
    }

    async updateSetting(key: string, value: any) {
        return this.prisma.systemConfig.upsert({
            where: { key },
            update: { value },
            create: { key, value }
        });
    }

    async getAllSettings() {
        const configs = await this.prisma.systemConfig.findMany();
        return configs.reduce((acc: Record<string, any>, curr: any) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {} as Record<string, any>);
    }
}
