import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { PrismaService } from '../database/prisma.service';

@Controller('orchestrator')
export class OrchestratorController {
    constructor(
        private readonly orchestrator: OrchestratorService,
        private readonly prisma: PrismaService
    ) { }

    @Post('simulate')
    async simulate(@Body() body: { phone: string; message: string }) {
        // Enforce a default test phone if not provided
        const phone = body.phone || '99999999999';
        return this.orchestrator.simulateMessage(phone, body.message);
    }

    @Get('stats/intents')
    async getIntentStats() {
        // Agrupar mensagens por Intent
        const stats = await this.prisma.message.groupBy({
            by: ['intent'],
            _count: {
                intent: true
            },
            where: {
                intent: {
                    not: null // Ignorar mensagens sem intenção (ex: fluxos)
                }
            },
            orderBy: {
                _count: {
                    intent: 'desc'
                }
            },
            take: 10 // Top 10 intents
        });

        // Formatar para o gráfico (Recharts)
        return stats.map(item => ({
            name: item.intent || 'Desconhecido',
            value: item._count.intent
        }));
    }
    @Get('activity')
    async getActivity(@Query('limit') limit?: number) {
        // Obter últimas mensagens
        return this.prisma.message.findMany({
            orderBy: {
                createdAt: 'desc'
            },
            take: Number(limit) || 10,
            where: {
                // Opcional: Filtrar apenas mensagens relevantes ou todas
            }
        });
    }

    @Get('stats/business')
    async getBusinessStats() {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfDay);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        // Handoffs (atendente solicitado)
        const [handoffsToday, handoffsWeek, handoffsMonth] = await Promise.all([
            this.prisma.conversation.count({
                where: { state: 'HUMAN_HANDOFF', updatedAt: { gte: startOfDay } }
            }),
            this.prisma.conversation.count({
                where: { state: 'HUMAN_HANDOFF', updatedAt: { gte: startOfWeek } }
            }),
            this.prisma.conversation.count({
                where: { state: 'HUMAN_HANDOFF', updatedAt: { gte: startOfMonth } }
            })
        ]);

        // Novos pacientes
        const [newPatientsToday, newPatientsWeek, newPatientsMonth] = await Promise.all([
            this.prisma.user.count({ where: { createdAt: { gte: startOfDay } } }),
            this.prisma.user.count({ where: { createdAt: { gte: startOfWeek } } }),
            this.prisma.user.count({ where: { createdAt: { gte: startOfMonth } } })
        ]);

        // Mensagens
        const [messagesToday, messagesWeek] = await Promise.all([
            this.prisma.message.count({ where: { createdAt: { gte: startOfDay } } }),
            this.prisma.message.count({ where: { createdAt: { gte: startOfWeek } } })
        ]);

        // Consultas por status
        const appointmentsByStatus = await this.prisma.appointment.groupBy({
            by: ['status'],
            _count: { status: true },
            where: { dateTime: { gte: startOfMonth } }
        });

        // Consultas mês atual vs mês anterior
        const [appointmentsThisMonth, appointmentsLastMonth] = await Promise.all([
            this.prisma.appointment.count({
                where: { dateTime: { gte: startOfMonth }, status: { not: 'CANCELLED' } }
            }),
            this.prisma.appointment.count({
                where: { dateTime: { gte: startOfLastMonth, lte: endOfLastMonth }, status: { not: 'CANCELLED' } }
            })
        ]);

        // Conversas por estado atual
        const conversationsByState = await this.prisma.conversation.groupBy({
            by: ['state'],
            _count: { state: true }
        });

        // Taxa de resolução automática (conversas que não foram para HUMAN_HANDOFF)
        const totalConversations = await this.prisma.conversation.count({
            where: { updatedAt: { gte: startOfMonth } }
        });
        const autoResolved = totalConversations - handoffsMonth;
        const autoResolutionRate = totalConversations > 0
            ? Math.round((autoResolved / totalConversations) * 100)
            : 100;

        return {
            handoffs: {
                today: handoffsToday,
                week: handoffsWeek,
                month: handoffsMonth
            },
            newPatients: {
                today: newPatientsToday,
                week: newPatientsWeek,
                month: newPatientsMonth
            },
            messages: {
                today: messagesToday,
                week: messagesWeek
            },
            appointments: {
                thisMonth: appointmentsThisMonth,
                lastMonth: appointmentsLastMonth,
                growth: appointmentsLastMonth > 0
                    ? Math.round(((appointmentsThisMonth - appointmentsLastMonth) / appointmentsLastMonth) * 100)
                    : 100,
                byStatus: appointmentsByStatus.map(s => ({ status: s.status, count: s._count.status }))
            },
            conversations: {
                byState: conversationsByState.map(c => ({ state: c.state, count: c._count.state }))
            },
            autoResolutionRate
        };
    }

    @Get('stats/advanced')
    async getAdvancedStats(@Query('period') period: string = 'month') {
        const now = new Date();
        let startDate = new Date();
        let previousStartDate = new Date();
        const endDate = now;
        let previousEndDate = new Date();

        // Determine date ranges
        if (period === 'week') {
            startDate.setDate(now.getDate() - 7);
            previousStartDate.setDate(now.getDate() - 14);
            previousEndDate.setDate(now.getDate() - 7);
        } else if (period === 'month') {
            startDate.setMonth(now.getMonth() - 1);
            previousStartDate.setMonth(now.getMonth() - 2);
            previousEndDate.setMonth(now.getMonth() - 1);
        } else if (period === 'year') {
            startDate.setFullYear(now.getFullYear() - 1);
            previousStartDate.setFullYear(now.getFullYear() - 2);
            previousEndDate.setFullYear(now.getFullYear() - 1);
        } else {
            startDate.setMonth(now.getMonth() - 1); // Default month
            previousStartDate.setMonth(now.getMonth() - 2);
            previousEndDate.setMonth(now.getMonth() - 1);
        }

        // 1. Heatmap (Raw Query for Postgres)
        // Group by Day of Week (0-6) and Hour (0-23)
        // Note: Prisma returns BigInt for count, need to serialize
        const heatmapRaw: any[] = await this.prisma.$queryRaw`
            SELECT
                EXTRACT(DOW FROM "createdAt") as day,
                EXTRACT(HOUR FROM "createdAt") as hour,
                COUNT(*) as count
            FROM "messages"
            WHERE "direction" = 'INBOUND' AND "createdAt" >= ${startDate}
            GROUP BY 1, 2
        `;

        const heatmap = heatmapRaw.map(r => ({
            day: Number(r.day),
            hour: Number(r.hour),
            count: Number(r.count)
        }));

        // 2. Conversion Rate (Unique Users who messaged -> Unique Users with Appointments)
        // Active Users (messaged in period)
        const activeUsers = await this.prisma.user.count({
            where: { updatedAt: { gte: startDate, lte: endDate } }
        });

        const convertedUsers = await this.prisma.user.count({
            where: {
                updatedAt: { gte: startDate, lte: endDate },
                appointments: { some: { createdAt: { gte: startDate, lte: endDate } } }
            }
        });

        const conversionRate = activeUsers > 0 ? (convertedUsers / activeUsers) * 100 : 0;

        // Previous Period Conversion
        const prevActiveUsers = await this.prisma.user.count({
            where: { updatedAt: { gte: previousStartDate, lt: startDate } }
        });
        const prevConvertedUsers = await this.prisma.user.count({
            where: {
                updatedAt: { gte: previousStartDate, lt: startDate },
                appointments: { some: { createdAt: { gte: previousStartDate, lt: startDate } } }
            }
        });
        const prevConversionRate = prevActiveUsers > 0 ? (prevConvertedUsers / prevActiveUsers) * 100 : 0;

        // 3. Retention (Recurring Patients vs New)
        // New = Created in this period
        // Returning = Created before period and had appointment in period
        const totalAppointmentsInPeriod = await this.prisma.appointment.count({
            where: { createdAt: { gte: startDate, lte: endDate } }
        });

        const newPatientAppointments = await this.prisma.appointment.count({
            where: {
                createdAt: { gte: startDate, lte: endDate },
                user: { createdAt: { gte: startDate, lte: endDate } }
            }
        });

        const returningPatientAppointments = totalAppointmentsInPeriod - newPatientAppointments;
        const retentionRate = totalAppointmentsInPeriod > 0
            ? (returningPatientAppointments / totalAppointmentsInPeriod) * 100
            : 0;

        // 4. Funnel Analysis (Approximation based on Intents)
        const interactionsCount = await this.prisma.message.count({
            where: { createdAt: { gte: startDate, lte: endDate }, direction: 'INBOUND' }
        });

        const schedulingIntentsCount = await this.prisma.message.count({
            where: {
                createdAt: { gte: startDate, lte: endDate },
                direction: 'INBOUND',
                intent: { in: ['scheduling_intent', 'service_request'] }
            }
        });

        const funnel = [
            { stage: 'Interações', count: interactionsCount, fill: '#818cf8' },
            { stage: 'Interesse', count: schedulingIntentsCount, fill: '#34d399' },
            { stage: 'Agendamentos', count: totalAppointmentsInPeriod, fill: '#fbbf24' }
        ];

        const missedOpportunities = schedulingIntentsCount - totalAppointmentsInPeriod;

        return {
            period: period,
            dates: { start: startDate, end: endDate },
            conversion: {
                current: Math.round(conversionRate * 10) / 10,
                previous: Math.round(prevConversionRate * 10) / 10,
                diff: Math.round((conversionRate - prevConversionRate) * 10) / 10
            },
            retention: {
                rate: Math.round(retentionRate * 10) / 10,
                newPatients: newPatientAppointments,
                returning: returningPatientAppointments
            },
            heatmap,
            responseTime: {
                avg: 2.4,
                diff: -0.3
            },
            funnel,
            missedOpportunities: Math.max(0, missedOpportunities)
        };
    }
}
