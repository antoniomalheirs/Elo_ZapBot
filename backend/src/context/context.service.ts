import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface ConversationContext {
    userId: string;
    conversationId: string;
    lastMessage?: string;
    lastIntent?: string;
    lastResponse?: string;
    // Campos para fluxo de agendamento
    schedulingStep?: string;
    selectedService?: string;
    servicePrice?: number;
    serviceDuration?: number;
    selectedDay?: string;
    selectedTime?: string;
    // New fields for Single Slot Suggestion
    suggestedSlot?: string;
    rejectedSlots?: string[];
    pendingDateSuggestion?: string;
    dateObj?: string; // ISO String
    // FEATURE 4: Memória de Conversa - Preferências do Usuário
    userPreferences?: {
        preferredService?: string;    // Serviço mais usado
        preferredDay?: string;        // Dia preferido (ex: "Segunda-feira")
        preferredTime?: string;       // Horário preferido (ex: "14:00")
        appointmentCount?: number;    // Quantidade de consultas já feitas
        lastVisit?: string;           // Data da última consulta
    };
    // FEATURE 6: Tracking de tentativas falhas para escalar para humano
    failedAttempts?: number;
    // FEATURE 9: Proatividade (Flag para evitar spam)
    proactiveNudgeSent?: boolean;
    // Dados genéricos
    schedulingData?: {
        service?: string;
        date?: string;
        time?: string;
        step: string;
    };
    customData?: Record<string, any>;
    updatedAt: Date;
}

@Injectable()
export class ContextService {
    private readonly logger = new Logger(ContextService.name);
    private redis: Redis | null = null;
    private useRedis: boolean = false;

    // Cache em memória como fallback
    private memoryCache: Map<string, ConversationContext> = new Map();

    // TTL padrão: 24 horas
    private readonly TTL_SECONDS = 24 * 60 * 60;

    constructor(private readonly config: ConfigService) {
        this.initializeRedis();
    }

    private async initializeRedis() {
        try {
            const redisHost = this.config.get<string>('REDIS_HOST') || 'localhost';
            const redisPort = this.config.get<number>('REDIS_PORT') || 6379;

            this.redis = new Redis({
                host: redisHost,
                port: redisPort,
                maxRetriesPerRequest: 3,
                lazyConnect: true,
            });

            await this.redis.connect();
            this.useRedis = true;
            this.logger.log('✅ Redis conectado para contexto');
        } catch (error) {
            this.logger.warn(`⚠️ Redis não disponível, usando cache em memória: ${error}`);
            this.useRedis = false;
        }
    }

    /**
     * Gera chave única para o contexto
     */
    private getContextKey(userId: string, conversationId: string): string {
        return `context:${userId}:${conversationId}`;
    }

    /**
     * Obtém contexto atual da conversa
     */
    async getContext(userId: string, conversationId: string): Promise<ConversationContext> {
        const key = this.getContextKey(userId, conversationId);

        try {
            if (this.useRedis && this.redis) {
                const data = await this.redis.get(key);
                if (data) {
                    return JSON.parse(data);
                }
            } else {
                const cached = this.memoryCache.get(key);
                if (cached) return cached;
            }
        } catch (error) {
            this.logger.error(`❌ Erro ao buscar contexto: ${error}`);
        }

        // Retorna contexto vazio
        return {
            userId,
            conversationId,
            updatedAt: new Date(),
        };
    }

    /**
     * Atualiza contexto da conversa
     */
    async updateContext(
        userId: string,
        conversationId: string,
        updates: Partial<ConversationContext>,
    ): Promise<void> {
        const key = this.getContextKey(userId, conversationId);

        try {
            const current = await this.getContext(userId, conversationId);
            const updated: ConversationContext = {
                ...current,
                ...updates,
                userId,
                conversationId,
                updatedAt: new Date(),
            };

            if (this.useRedis && this.redis) {
                await this.redis.setex(key, this.TTL_SECONDS, JSON.stringify(updated));
            } else {
                this.memoryCache.set(key, updated);
            }

            this.logger.debug(`📝 Contexto atualizado: ${key}`);
        } catch (error) {
            this.logger.error(`❌ Erro ao atualizar contexto: ${error}`);
        }
    }

    /**
     * Atualiza dados de agendamento no contexto
     */
    async updateSchedulingData(
        userId: string,
        conversationId: string,
        schedulingData: ConversationContext['schedulingData'],
    ): Promise<void> {
        await this.updateContext(userId, conversationId, { schedulingData });
    }

    /**
     * Limpa contexto da conversa
     */
    async clearContext(userId: string, conversationId: string): Promise<void> {
        const key = this.getContextKey(userId, conversationId);

        try {
            if (this.useRedis && this.redis) {
                await this.redis.del(key);
            } else {
                this.memoryCache.delete(key);
            }
            this.logger.log(`🗑️ Contexto limpo: ${key}`);
        } catch (error) {
            this.logger.error(`❌ Erro ao limpar contexto: ${error}`);
        }
    }

    /**
     * Obtém histórico resumido para a IA
     */
    async getContextSummary(userId: string, conversationId: string): Promise<string> {
        const context = await this.getContext(userId, conversationId);

        const parts: string[] = [];

        if (context.lastIntent) {
            parts.push(`Última intenção: ${context.lastIntent}`);
        }

        if (context.schedulingData) {
            parts.push(`Em agendamento: ${JSON.stringify(context.schedulingData)}`);
        }

        return parts.join('. ') || 'Conversa nova, sem histórico.';
    }
}
