import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AppointmentStatus } from '@prisma/client';

export interface CreateAppointmentDto {
    userId: string;
    service: string;
    dateTime: Date;
    description?: string;
    duration?: number;
}

export interface TimeSlot {
    time: string;
    available: boolean;
}

@Injectable()
export class SchedulingService {
    private readonly logger = new Logger(SchedulingService.name);

    // Horários de funcionamento padrão
    private readonly workingHours = {
        start: 8, // 8:00
        end: 18,  // 18:00
        slotDuration: 60, // minutos
    };

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Cria um novo agendamento
     */
    async createAppointment(data: CreateAppointmentDto) {
        // Verificar disponibilidade
        const isAvailable = await this.checkAvailability(data.dateTime, data.duration || 60);

        if (!isAvailable) {
            throw new Error('Horário não disponível');
        }

        const appointment = await this.prisma.appointment.create({
            data: {
                userId: data.userId,
                service: data.service,
                dateTime: data.dateTime,
                description: data.description,
                duration: data.duration || 60,
                status: 'PENDING',
            },
        });

        this.logger.log(`📅 Agendamento criado: ${appointment.id}`);
        return appointment;
    }

    /**
     * Verifica disponibilidade de um horário
     */
    async checkAvailability(dateTime: Date, duration: number): Promise<boolean> {
        const endTime = new Date(dateTime.getTime() + duration * 60 * 1000);

        // Buscar conflitos
        const conflicts = await this.prisma.appointment.findMany({
            where: {
                status: { in: ['PENDING', 'CONFIRMED'] },
                OR: [
                    {
                        AND: [
                            { dateTime: { lte: dateTime } },
                            { dateTime: { gte: new Date(dateTime.getTime() - duration * 60 * 1000) } },
                        ],
                    },
                    {
                        AND: [
                            { dateTime: { gte: dateTime } },
                            { dateTime: { lt: endTime } },
                        ],
                    },
                ],
            },
        });

        return conflicts.length === 0;
    }

    /**
     * Lista horários disponíveis para uma data
     */
    async getAvailableSlots(date: Date): Promise<TimeSlot[]> {
        const slots: TimeSlot[] = [];

        // Gerar slots do dia
        for (let hour = this.workingHours.start; hour < this.workingHours.end; hour++) {
            const slotTime = new Date(date);
            slotTime.setHours(hour, 0, 0, 0);

            // Verificar se já passou (para hoje)
            const now = new Date();
            if (slotTime < now) {
                continue;
            }

            const available = await this.checkAvailability(slotTime, this.workingHours.slotDuration);

            slots.push({
                time: `${hour.toString().padStart(2, '0')}:00`,
                available,
            });
        }

        return slots;
    }

    /**
     * Confirma um agendamento
     */
    async confirmAppointment(appointmentId: string) {
        const appointment = await this.prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                status: 'CONFIRMED',
                confirmedAt: new Date(),
            },
        });

        this.logger.log(`✅ Agendamento confirmado: ${appointmentId}`);
        return appointment;
    }

    /**
     * Cancela um agendamento
     */
    async cancelAppointment(appointmentId: string) {
        const appointment = await this.prisma.appointment.update({
            where: { id: appointmentId },
            data: {
                status: 'CANCELLED',
                cancelledAt: new Date(),
            },
        });

        this.logger.log(`❌ Agendamento cancelado: ${appointmentId}`);
        return appointment;
    }

    /**
     * Lista agendamentos de um usuário
     */
    async getUserAppointments(userId: string, status?: AppointmentStatus) {
        return this.prisma.appointment.findMany({
            where: {
                userId,
                ...(status && { status }),
            },
            orderBy: { dateTime: 'asc' },
        });
    }

    /**
     * Busca próximo agendamento do usuário
     */
    async getNextAppointment(userId: string) {
        return this.prisma.appointment.findFirst({
            where: {
                userId,
                status: { in: ['PENDING', 'CONFIRMED'] },
                dateTime: { gte: new Date() },
            },
            orderBy: { dateTime: 'asc' },
        });
    }

    /**
     * Formata informações do agendamento para mensagem
     */
    formatAppointmentMessage(appointment: any): string {
        const date = new Date(appointment.dateTime);
        const dateStr = date.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
        });
        const timeStr = date.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
        });

        return `📅 **Agendamento**
🔹 Serviço: ${appointment.service}
📆 Data: ${dateStr}
⏰ Horário: ${timeStr}
📋 Status: ${this.formatStatus(appointment.status)}`;
    }

    private formatStatus(status: AppointmentStatus): string {
        const statusMap: Record<AppointmentStatus, string> = {
            PENDING: '⏳ Pendente',
            CONFIRMED: '✅ Confirmado',
            CANCELLED: '❌ Cancelado',
            COMPLETED: '✔️ Concluído',
            NO_SHOW: '⚠️ Não compareceu',
        };
        return statusMap[status] || status;
    }
}
