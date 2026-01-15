import { Controller, Get, Post, Delete, Query, Body, Param } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { SettingsService } from '../config/settings.service';

@Controller('appointments')
export class AppointmentsController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly schedulerService: SchedulerService,
        private readonly settingsService: SettingsService
    ) { }

    @Get('debug')
    async debug() {
        return this.prisma.appointment.findMany({
            include: { user: true },
            take: 50,
            orderBy: { dateTime: 'desc' }
        });
    }

    @Get('next')
    async getNextAppointments(@Query('limit') limit?: number) {
        return this.prisma.appointment.findMany({
            where: {
                dateTime: {
                    gte: new Date(), // Apenas futuros
                },
                status: {
                    not: 'CANCELLED'
                }
            },
            include: {
                user: true
            },
            orderBy: {
                dateTime: 'asc'
            },
            take: Number(limit) || 5
        });
    }

    @Get()
    async findAll(
        @Query('date') date?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('search') search?: string,
    ) {
        const where: any = {};

        // Lógica de Prioridade:
        // 1. Se tem SEARCH, faz busca GLOBAL (ignora datas)
        // 2. Se NÃO tem search, respeita o filtro de DATA (Calendar view)

        if (search) {
            where.OR = [
                { user: { name: { contains: search, mode: 'insensitive' } } },
                { user: { phone: { contains: search, mode: 'insensitive' } } }
            ];
        } else {
            // Filtro por dia específico (Lista de Agendamentos)
            if (date) {
                const start = new Date(date);
                start.setHours(0, 0, 0, 0);
                const end = new Date(date);
                end.setHours(23, 59, 59, 999);
                where.dateTime = { gte: start, lte: end };
            }
            // Filtro por intervalo (Calendário Mensal)
            else if (startDate && endDate) {
                where.dateTime = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }
        }

        const appointments = await this.prisma.appointment.findMany({
            where,
            include: {
                user: true
            },
            orderBy: {
                dateTime: 'asc'
            }
        });

        return appointments;
    }

    @Get('stats')
    async getStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [total, todayCount, pending] = await Promise.all([
            this.prisma.appointment.count(),
            this.prisma.appointment.count({
                where: {
                    dateTime: {
                        gte: today,
                        lt: tomorrow
                    }
                }
            }),
            this.prisma.appointment.count({
                where: {
                    status: 'PENDING'
                }
            })
        ]);

        return { total, today: todayCount, pending };
    }

    @Get('chart-data')
    async getChartData() {
        // Últimos 7 dias
        const days = [];
        const appointmentCounts = [];
        const messageCounts = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);

            const dayName = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
            days.push(dayName.charAt(0).toUpperCase() + dayName.slice(1));

            const [aptCount, msgCount] = await Promise.all([
                this.prisma.appointment.count({
                    where: {
                        createdAt: { gte: date, lt: nextDay }
                    }
                }),
                this.prisma.message.count({
                    where: {
                        createdAt: { gte: date, lt: nextDay }
                    }
                })
            ]);

            appointmentCounts.push(aptCount);
            messageCounts.push(msgCount);
        }

        return { days, appointments: appointmentCounts, messages: messageCounts };
    }

    @Get('reports')
    async getReports() {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Buscar dados dos últimos 30 dias
        const [totalAppointments, confirmedCount, cancelledCount, messages, hourlyData] = await Promise.all([
            this.prisma.appointment.count({
                where: { createdAt: { gte: thirtyDaysAgo } }
            }),
            this.prisma.appointment.count({
                where: { createdAt: { gte: thirtyDaysAgo }, status: 'CONFIRMED' }
            }),
            this.prisma.appointment.count({
                where: { createdAt: { gte: thirtyDaysAgo }, status: 'CANCELLED' }
            }),
            this.prisma.message.count({
                where: { createdAt: { gte: thirtyDaysAgo } }
            }),
            // Horários mais populares
            this.prisma.appointment.findMany({
                where: { createdAt: { gte: thirtyDaysAgo } },
                select: { dateTime: true }
            })
        ]);

        // Calcular horários populares
        const hourCounts: Record<number, number> = {};
        hourlyData.forEach(apt => {
            const hour = apt.dateTime.getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        const popularHours = Object.entries(hourCounts)
            .map(([hour, count]) => ({ hour: parseInt(hour), count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Taxa de conversão (agendamentos / mensagens de entrada)
        const inboundMessages = await this.prisma.message.count({
            where: { createdAt: { gte: thirtyDaysAgo }, direction: 'INBOUND' }
        });
        const conversionRate = inboundMessages > 0 ? ((confirmedCount / inboundMessages) * 100).toFixed(1) : '0';

        // Taxa de cancelamento
        const cancellationRate = totalAppointments > 0 ? ((cancelledCount / totalAppointments) * 100).toFixed(1) : '0';

        // Serviços mais procurados
        const serviceData = await this.prisma.appointment.groupBy({
            by: ['service'],
            _count: { service: true },
            where: { createdAt: { gte: thirtyDaysAgo } },
            orderBy: { _count: { service: 'desc' } },
            take: 5
        });

        const popularServices = serviceData.map(s => ({
            name: s.service,
            count: s._count.service
        }));

        return {
            period: '30 dias',
            totalAppointments,
            confirmedCount,
            cancelledCount,
            conversionRate: `${conversionRate}%`,
            cancellationRate: `${cancellationRate}%`,
            popularHours,
            popularServices,
            totalMessages: messages
        };
    }

    // --- BLOCKED SLOTS MANAGEMENT ---

    @Get('blocked-slots')
    async getBlockedSlots() {
        return this.prisma.blockedSlot.findMany({
            where: { date: { gte: new Date() } },
            orderBy: { date: 'asc' }
        });
    }

    @Post('blocked-slots')
    async createBlockedSlot(@Body() body: { date: string, startTime: string, endTime: string, reason?: string }) {
        return this.prisma.blockedSlot.create({
            data: {
                date: new Date(body.date),
                startTime: body.startTime,
                endTime: body.endTime,
                reason: body.reason
            }
        });
    }

    @Delete('blocked-slots/:id')
    async deleteBlockedSlot(@Param('id') id: string) {
        return this.prisma.blockedSlot.delete({ where: { id } });
    }

    // ENDPOINT - Status dos Lembretes (Pendentes e Enviados)
    @Get('reminders-status')
    async getRemindersStatus() {
        const now = new Date();

        // Início de HOJE (para mostrar consultas de hoje que ainda não receberam lembrete)
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        // Lembretes PENDENTES (TODAS consultas futuras que ainda não receberam lembrete)
        const pending = await this.prisma.appointment.findMany({
            where: {
                dateTime: { gte: todayStart }, // Hoje ou futuro
                status: 'CONFIRMED',
                reminderSent: false
            },
            include: { user: true },
            orderBy: { dateTime: 'asc' }
        });

        // Lembretes JÁ ENVIADOS (últimos 7 dias)
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const sent = await this.prisma.appointment.findMany({
            where: {
                reminderSent: true,
                dateTime: { gte: sevenDaysAgo }
            },
            include: { user: true },
            orderBy: { dateTime: 'desc' },
            take: 50
        });

        // Buscar horário real das configurações
        const settings = await this.settingsService.getAllSettings();
        const reminderTime = settings.reminderTime || '08:00';

        return {
            pending: pending.map(apt => ({
                id: apt.id,
                clientName: apt.user.name || 'Sem nome',
                clientPhone: apt.user.phone,
                service: apt.service,
                dateTime: apt.dateTime,
                reminderSent: apt.reminderSent
            })),
            sent: sent.map(apt => ({
                id: apt.id,
                clientName: apt.user.name || 'Sem nome',
                clientPhone: apt.user.phone,
                service: apt.service,
                dateTime: apt.dateTime,
                reminderSent: apt.reminderSent
            })),
            config: {
                reminderTime,
                nextRun: `Próximo envio: ${reminderTime}`
            }
        };
    }

    // ENDPOINT DE TESTE - Disparar lembretes manualmente
    @Get('test-reminders')
    async testReminders() {
        await this.schedulerService.checkAndSendReminders();
        return { success: true, message: 'Ciclo de lembretes acionado! Verifique os logs para saber se a hora bateu.' };
    }

    // ENDPOINT - Criar agendamento manualmente (Admin Panel)
    @Post('create-manual')
    async createManual(@Body() body: {
        clientName: string;
        clientPhone: string;
        service: string;
        date: string;
        time: string;
        notes?: string;
    }) {
        // Validar campos obrigatórios
        if (!body.clientPhone || !body.service || !body.date || !body.time) {
            return { success: false, error: 'Campos obrigatórios: clientPhone, service, date, time' };
        }

        // Sanitizar telefone
        const cleanPhone = body.clientPhone.replace(/\D/g, '');

        // Buscar ou criar usuário
        let user = await this.prisma.user.findFirst({
            where: { phone: cleanPhone }
        });

        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    phone: cleanPhone,
                    name: body.clientName || 'Cliente Manual'
                }
            });
        } else if (body.clientName && body.clientName !== user.name) {
            // Atualizar nome se fornecido e diferente
            user = await this.prisma.user.update({
                where: { id: user.id },
                data: { name: body.clientName }
            });
        }

        // Criar data/hora do agendamento
        const [year, month, day] = body.date.split('-').map(Number);
        const [hour, minute] = body.time.split(':').map(Number);
        const dateTime = new Date(year, month - 1, day, hour, minute);

        // Verificar se já existe agendamento nesse horário
        const existing = await this.prisma.appointment.findFirst({
            where: {
                dateTime,
                status: { not: 'CANCELLED' }
            }
        });

        if (existing) {
            return { success: false, error: 'Já existe um agendamento neste horário!' };
        }

        // Criar agendamento
        const appointment = await this.prisma.appointment.create({
            data: {
                userId: user.id,
                service: body.service,
                dateTime,
                status: 'CONFIRMED',
                notes: body.notes || 'Agendado manualmente pelo admin'
            },
            include: { user: true }
        });

        return {
            success: true,
            message: 'Agendamento criado com sucesso!',
            appointment
        };
    }
}
