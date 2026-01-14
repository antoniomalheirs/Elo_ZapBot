import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { ContextService } from '../context/context.service';

@Injectable()
export class SchedulerService {
    private readonly logger = new Logger(SchedulerService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly whatsapp: WhatsAppService,
        private readonly context: ContextService
    ) { }

    /**
     * Verifica conversas inativas a cada 30 minutos
     */
    @Cron('0 */30 * * * *') // Rodar a cada 30 min (ex: 10:00, 10:30, 11:00)
    async checkInactiveConversations() {
        this.logger.log('⏰ Verificando conversas inativas para re-engajamento...');

        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

        try {
            // Buscar conversas que pararam no meio do fluxo
            // Critérios:
            // 1. Atualizada há mais de 30 min
            // 2. Atualizada há menos de 2h (não reativar conversas muito antigas)
            // 3. Estado NÃO é final (COMPLETED, HUMAN_HANDOFF, etc)
            // 4. NÃO foi enviado nudge recentemente (verificar contexto)

            const conversations = await this.prisma.conversation.findMany({
                where: {
                    updatedAt: {
                        lt: thirtyMinutesAgo,
                        gt: twoHoursAgo
                    },
                    state: {
                        in: ['SCHEDULING_FLOW', 'CONFIRMATION_PENDING', 'INIT']
                    }
                },
                include: { user: true }
            });

            this.logger.log(`🔍 Encontradas ${conversations.length} conversas potenciais.`);

            for (const conv of conversations) {
                // Verificar contexto para evitar spam
                const contextData = await this.context.getContext(conv.userId, conv.id);

                // Se já enviamos nudge, pular
                if (contextData.proactiveNudgeSent) {
                    continue;
                }

                this.logger.log(`✨ Re-engajando usuário ${conv.user.name} (${conv.user.phone})...`);

                // Mensagem humilde e proativa
                const nudgeMsg = `Oi ${conv.user.name || ''}! 👋\n\nVi que não concluímos seu atendimento. Ficou alguma dúvida ou gostaria de continuar?`;

                // FIX: Usar phone ao invés de user.id (UUID) e formato Baileys
                const phone = conv.user.phone;
                const chatId = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
                const sent = await this.whatsapp.sendMessage(chatId, nudgeMsg);

                if (sent) {
                    // Marcar que já enviamos
                    await this.context.updateContext(conv.userId, conv.id, {
                        proactiveNudgeSent: true,
                        lastResponse: nudgeMsg
                    });
                    this.logger.log(`✅ Nudge enviado para ${conv.user.name} (${phone})`);
                } else {
                    this.logger.warn(`⚠️ Falha ao enviar nudge para ${conv.user.name}`);
                }
            }

        } catch (error) {
            this.logger.error(`❌ Erro no Cron de Re-engajamento: ${error}`);
        }
    }

    /**
     * Envia lembretes de consulta (24h antes)
     * Roda todos os dias às 9h da manhã
     */
    @Cron('0 9 * * *') // 09:00 todos os dias
    async sendAppointmentReminders() {
        this.logger.log('📅 Enviando lembretes de consulta para amanhã...');

        try {
            // Calcular janela de "amanhã" (próximas 24-48h)
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);

            const dayAfterTomorrow = new Date(tomorrow);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

            // Buscar agendamentos para amanhã
            const appointments = await this.prisma.appointment.findMany({
                where: {
                    dateTime: {
                        gte: tomorrow,
                        lt: dayAfterTomorrow
                    },
                    status: 'CONFIRMED'
                },
                include: { user: true }
            });

            this.logger.log(`📋 Encontrados ${appointments.length} agendamentos para amanhã.`);

            for (const apt of appointments) {
                const timeStr = apt.dateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const reminderMsg = `📅 *Lembrete de Consulta*\n\nOlá${apt.user.name ? `, ${apt.user.name}` : ''}! 👋\n\nLembrando que amanhã você tem:\n\n• *${apt.service}* às *${timeStr}*\n\nConfirma sua presença? (Sim/Não)`;

                // Fix: Ensure correct WhatsApp ID format
                const cleanPhone = apt.user.phone.replace(/\D/g, '');
                // FIX: Baileys usa @s.whatsapp.net ao invés de @c.us
                const chatId = cleanPhone + '@s.whatsapp.net';

                const sent = await this.whatsapp.sendMessage(chatId, reminderMsg);

                if (sent) {
                    this.logger.log(`✅ Lembrete enviado para ${apt.user.name} (${chatId})`);
                } else {
                    this.logger.warn(`⚠️ Falha ao enviar lembrete para ${apt.user.name}`);
                }
            }

        } catch (error) {
            this.logger.error(`❌ Erro no Cron de Lembretes: ${error}`);
        }
    }

    /**
     * Confirmação no Dia - Envia mensagem na MANHÃ do próprio dia da consulta
     * Roda todos os dias às 7:30 da manhã
     */
    @Cron('30 7 * * *') // 07:30 todos os dias
    async sendSameDayConfirmation() {
        this.logger.log('☀️ Enviando confirmações do dia para consultas de hoje...');

        try {
            // Janela de HOJE
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Buscar agendamentos para HOJE
            const appointments = await this.prisma.appointment.findMany({
                where: {
                    dateTime: {
                        gte: today,
                        lt: tomorrow
                    },
                    status: 'CONFIRMED'
                },
                include: { user: true }
            });

            this.logger.log(`☀️ ${appointments.length} consulta(s) para hoje`);

            for (const apt of appointments) {
                const timeStr = apt.dateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const confirmMsg = `☀️ *Bom dia${apt.user.name ? `, ${apt.user.name}` : ''}!*\n\n📅 Hoje você tem *${apt.service}* às *${timeStr}*.\n\nConfirma sua presença? (Sim/Não)`;

                // Fix: Ensure correct WhatsApp ID format
                const cleanPhone = apt.user.phone.replace(/\D/g, '');
                // FIX: Baileys usa @s.whatsapp.net ao invés de @c.us
                const chatId = cleanPhone + '@s.whatsapp.net';

                const sent = await this.whatsapp.sendMessage(chatId, confirmMsg);

                if (sent) {
                    this.logger.log(`✅ Confirmação do dia enviada para ${apt.user.name} (${chatId})`);
                } else {
                    this.logger.warn(`⚠️ Falha ao enviar confirmação do dia para ${apt.user.name}`);
                }
            }

        } catch (error) {
            this.logger.error(`❌ Erro no Cron de Confirmação do Dia: ${error}`);
        }
    }

    /**
     * Verifica cancelamentos recentes e notifica usuários na Lista de Espera
     * Roda a cada hora
     */
    @Cron('0 */1 * * *') // A cada hora
    async notifyWaitlistOnCancellation() {
        this.logger.log('📋 Verificando Lista de Espera para vagas disponíveis...');

        try {
            // Buscar cancelamentos recentes (última hora)
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

            const recentCancellations = await this.prisma.appointment.findMany({
                where: {
                    status: 'CANCELLED',
                    cancelledAt: { gte: oneHourAgo },
                    dateTime: { gte: new Date() } // Apenas futuros
                }
            });

            if (recentCancellations.length === 0) {
                this.logger.log('📋 Nenhum cancelamento recente encontrado.');
                return;
            }

            this.logger.log(`📋 ${recentCancellations.length} cancelamento(s) recente(s). Verificando waitlist...`);

            for (const apt of recentCancellations) {
                // Buscar na waitlist para a mesma data
                const dateStart = new Date(apt.dateTime);
                dateStart.setHours(0, 0, 0, 0);
                const dateEnd = new Date(dateStart);
                dateEnd.setDate(dateEnd.getDate() + 1);

                const waitlistEntries = await this.prisma.waitlist.findMany({
                    where: {
                        preferredDate: { gte: dateStart, lt: dateEnd },
                        status: 'WAITING'
                    },
                    include: { user: true },
                    take: 3 // Notificar até 3 pessoas
                });

                for (const entry of waitlistEntries) {
                    const dateStr = apt.dateTime.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                    const timeStr = apt.dateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                    const notifyMsg = `🎉 *Boa notícia!*\n\nSurgiu uma vaga para dia *${dateStr}* às *${timeStr}*!\n\nVocê estava na lista de espera. Deseja agendar? (Sim/Não)`;

                    // Fix: Ensure correct WhatsApp ID format
                    const cleanPhone = entry.user.phone.replace(/\D/g, '');
                    // FIX: Baileys usa @s.whatsapp.net ao invés de @c.us
                    const chatId = cleanPhone + '@s.whatsapp.net';

                    const sent = await this.whatsapp.sendMessage(chatId, notifyMsg);

                    if (sent) {
                        // Atualizar status para NOTIFIED
                        await this.prisma.waitlist.update({
                            where: { id: entry.id },
                            data: { status: 'NOTIFIED', notifiedAt: new Date() }
                        });
                        this.logger.log(`✅ Notificação enviada para ${entry.user.phone} (waitlist)`);
                    } else {
                        this.logger.warn(`⚠️ Falha ao notificar waitlist: ${entry.user.phone}`);
                    }

                }
            }

        } catch (error) {
            this.logger.error(`❌ Erro no Cron de Waitlist: ${error}`);
        }
    }

    /**
     * Limpa conversas abandonadas no meio do fluxo de agendamento
     * Reset após 30 minutos de inatividade
     * Roda a cada 15 minutos
     */
    @Cron('*/15 * * * *') // A cada 15 minutos
    async cleanupStaleConversations() {
        this.logger.log('🧹 Limpando conversas abandonadas...');

        try {
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

            // Buscar conversas em SCHEDULING_FLOW ou CONFIRMATION_PENDING sem atividade
            const staleConversations = await this.prisma.conversation.findMany({
                where: {
                    state: { in: ['SCHEDULING_FLOW', 'CONFIRMATION_PENDING'] },
                    updatedAt: { lt: thirtyMinutesAgo }
                }
            });

            if (staleConversations.length > 0) {
                await this.prisma.conversation.updateMany({
                    where: { id: { in: staleConversations.map(c => c.id) } },
                    data: { state: 'AUTO_ATTENDANCE' }
                });

                this.logger.log(`🧹 ${staleConversations.length} conversa(s) resetada(s) para AUTO_ATTENDANCE`);
            }

        } catch (error) {
            this.logger.error(`❌ Erro no cleanup de conversas: ${error}`);
        }
    }

    /**
     * Expira entradas antigas na lista de espera (mais de 7 dias)
     * Roda uma vez por dia à meia-noite
     */
    @Cron('0 0 * * *') // Meia-noite
    async expireOldWaitlistEntries() {
        this.logger.log('🗑️ Expirando entradas antigas da waitlist...');

        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            const result = await this.prisma.waitlist.updateMany({
                where: {
                    status: 'WAITING',
                    createdAt: { lt: sevenDaysAgo }
                },
                data: { status: 'EXPIRED' }
            });

            if (result.count > 0) {
                this.logger.log(`🗑️ ${result.count} entrada(s) da waitlist expirada(s)`);
            }

        } catch (error) {
            this.logger.error(`❌ Erro ao expirar waitlist: ${error}`);
        }
    }
}
