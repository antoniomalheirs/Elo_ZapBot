import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { SettingsService } from '../config/settings.service';

@Injectable()
export class ReminderService implements OnModuleInit {
    private readonly logger = new Logger(ReminderService.name);
    private sentReminders: Set<string> = new Set(); // Controle em memória

    constructor(
        private readonly prisma: PrismaService,
        private readonly whatsapp: WhatsAppService,
        private readonly settingsService: SettingsService
    ) { }

    onModuleInit() {
        this.logger.log('📅 Serviço de Lembretes inicializado');
    }

    // Roda a cada hora para verificar consultas de amanhã
    @Cron(CronExpression.EVERY_HOUR)
    async sendReminders() {
        this.logger.log('⏰ Verificando consultas para lembrete...');

        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const dayAfterTomorrow = new Date(tomorrow);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

        // Buscar consultas de amanhã
        const appointments = await this.prisma.appointment.findMany({
            where: {
                dateTime: { gte: tomorrow, lt: dayAfterTomorrow },
                status: 'CONFIRMED'
            },
            include: { user: true }
        });

        if (appointments.length === 0) {
            this.logger.log('✅ Nenhum lembrete pendente.');
            return;
        }

        const settings = await this.settingsService.getAllSettings();
        const address = settings.clinicAddress || '';
        const city = settings.clinicCity || '';

        for (const apt of appointments) {
            // Evitar lembretes duplicados usando Set em memória
            if (this.sentReminders.has(apt.id)) continue;

            try {
                const dateFormatted = apt.dateTime.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
                const timeFormatted = apt.dateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                const message = `⏰ *Lembrete de Consulta!*\n\nOlá ${apt.user.name || 'paciente'}! 👋\n\nSua consulta é *AMANHÃ*:\n\n📅 *${dateFormatted}*\n🕐 *${timeFormatted}*\n🏥 *${apt.service}*\n📍 *${address}${city ? ` - ${city}` : ''}*\n\n_Grata, Ana Paula Malheiros! 🌸_`;

                const phone = apt.user.phone;
                // FIX: Baileys usa @s.whatsapp.net ao invés de @c.us
                const chatId = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
                const sent = await this.whatsapp.sendMessage(chatId, message);

                if (sent) {
                    // Marcar como enviado
                    this.sentReminders.add(apt.id);
                    this.logger.log(`📨 Lembrete enviado para ${phone}`);
                } else {
                    this.logger.warn(`⚠️ Falha ao enviar lembrete para ${phone} (WhatsApp desconectado ou erro)`);
                }
            } catch (error) {
                this.logger.error(`❌ Erro ao enviar lembrete: ${error}`);
            }
        }
    }
}
