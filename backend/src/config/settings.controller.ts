import { Controller, Get, Post, Body, Logger, HttpCode, HttpStatus } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaService } from '../database/prisma.service';

@Controller('settings')
export class SettingsController {
    private readonly logger = new Logger(SettingsController.name);

    constructor(
        private readonly settingsService: SettingsService,
        private readonly prisma: PrismaService
    ) { }

    @Get()
    async getAll() {
        return this.settingsService.getAllSettings();
    }

    @Post()
    async updateAll(@Body() body: Record<string, any>) {
        const promises = Object.keys(body).map(key =>
            this.settingsService.updateSetting(key, body[key])
        );
        await Promise.all(promises);
        return { success: true };
    }

    @Post('reset-database')
    @HttpCode(HttpStatus.OK)
    async resetDatabase() {
        this.logger.warn('🗑️ Iniciando reset do banco de dados...');

        try {
            // Deletar em ordem para respeitar foreign keys
            await this.prisma.message.deleteMany();
            await this.prisma.conversation.deleteMany();
            await this.prisma.appointment.deleteMany();
            await this.prisma.waitlist.deleteMany();
            await this.prisma.blockedSlot.deleteMany();
            await this.prisma.user.deleteMany();
            // Manter settings

            this.logger.log('✅ Banco de dados resetado com sucesso!');
            return {
                success: true,
                message: 'Banco de dados resetado com sucesso! Todas as conversas, usuários e agendamentos foram removidos.'
            };
        } catch (error: any) {
            this.logger.error(`❌ Erro ao resetar banco: ${error.message}`);
            return {
                success: false,
                message: `Erro ao resetar: ${error.message}`
            };
        }
    }
}
