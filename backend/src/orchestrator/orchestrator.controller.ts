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
}
