import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationState } from '@prisma/client';
import { SettingsService } from '../config/settings.service';
import { KeywordDetectorService } from './keyword-detector.service';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export interface AIProcessInput {
    message: string;
    context: Record<string, any>;
    currentState: ConversationState;
    userName: string;
}

export interface AIProcessResult {
    response: string;
    intent?: string;
    entities?: Record<string, any>;
    confidence: number;
    suggestedEvent?: string;
}

@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;

    constructor(
        private readonly config: ConfigService,
        private readonly settingsService: SettingsService,
        private readonly keywordDetector: KeywordDetectorService
    ) {
        const apiKey = this.config.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
            this.logger.error('❌ GEMINI_API_KEY não configurada! A IA não funcionará.');
        } else {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({
                model: 'gemini-2.5-flash',
                generationConfig: {
                    responseMimeType: 'application/json'
                }
            });
            this.logger.log('✨ Google Gemini 2.5 Flash inicializado!');

            // Debug: Listar modelos disponíveis
            // this.listAvailableModels(); // Descomente para debug
        }
    }

    // Método auxiliar para debug (não bloqueia inicialização)
    // async listAvailableModels() {
    //     try {
    //         // Nota: O SDK Node atual pode não expor listModels diretamente de forma fácil
    //         // sem instanciar um ModelManager, mas vamos tentar manter simples.
    //     } catch (e) { console.error(e); }
    // }

    /**
     * Analisa a mensagem para extrair intenção, entidades e confiança
     */
    async analyzeMessage(message: string, conversationContext?: any): Promise<{ intent: string; entities: any; confidence: number }> {
        if (!message) return { intent: 'UNKNOWN', entities: {}, confidence: 0 };

        // === FASE 1: Detecção Rápida por Keywords ===
        const keywordResult = this.keywordDetector.detectIntent(message);
        if (keywordResult && keywordResult.confidence >= 85) {
            const entities = this.keywordDetector.extractEntities(message);
            this.logger.log(`⚡ Keyword Detection: ${keywordResult.intent} (${keywordResult.confidence}%) - Pulando IA`);
            return {
                intent: keywordResult.intent,
                entities,
                confidence: keywordResult.confidence
            };
        }

        // === FASE 2: Google Gemini IA ===
        this.logger.log('🤖 Keywords inconclusivo, chamando Gemini...');

        const now = new Date();
        const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const currentDay = dayNames[now.getDay()];
        const currentDate = now.toLocaleDateString('pt-BR');

        // Carregar serviços
        const settings = await this.settingsService.getAllSettings();
        const services = settings.services || [];
        const servicesList = services.map((s: any) => `- "${s.name}"`).join('\n');

        const prompt = `
Você é um classificador de intenções para clínica de psicologia.
Contexto: Hoje é ${currentDay}, ${currentDate}. Hora: ${now.toLocaleTimeString('pt-BR')}.
Serviços: ${servicesList}

Analise a mensagem do paciente: "${message}"

Responda APENAS com este JSON:
{
  "intent": "INTENÇÃO_DETECTADA",
  "confidence": 0-100,
  "entities": { "service": "...", "day": "...", "time": "..." }
}

Intenções possíveis:
GREETING, HELP, SCHEDULE_NEW, RESCHEDULE, VIEW_APPOINTMENTS, 
FAQ_HOURS, FAQ_PRICE, FAQ_SERVICES, FAQ_LOCATION, FAQ_INSURANCE,
HUMAN_REQUEST, EMERGENCY, THANKS, CONFIRMATION, DENIAL, UNKNOWN.
`;

        try {
            if (!this.model) throw new Error('Gemini não inicializado');

            const result = await this.model.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            const data = JSON.parse(text);

            this.logger.log(`🤖 Gemini Analisou: ${data.intent} (${data.confidence}%)`);

            return {
                intent: data.intent || 'UNKNOWN',
                entities: data.entities || {},
                confidence: data.confidence || 0
            };

        } catch (error) {
            this.logger.error(`❌ Erro na análise Gemini: ${error}`);
            return { intent: 'UNKNOWN', entities: {}, confidence: 0 };
        }
    }

    /**
     * Gera resposta conversacional
     */
    async process(input: AIProcessInput): Promise<AIProcessResult> {
        this.logger.log(`🤖 Processando resposta para: "${input.message}"`);
        const settings = await this.settingsService.getAllSettings();

        try {
            if (!this.model) throw new Error('Gemini não inicializado');

            // Modelo para texto livre (sem JSON enforcement)
            const chatModel = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash-001' });

            const prompt = this.buildPrompt(input, settings);
            const result = await chatModel.generateContent(prompt);
            const responseText = result.response.text();

            return this.parseAIResponse(responseText);

        } catch (error) {
            this.logger.error(`❌ Erro Gemini Process: ${error}`);
            return this.fallbackResponse(input);
        }
    }

    private buildPrompt(input: AIProcessInput, settings: any): string {
        const openTime = settings.openTime || '09:00';
        const closeTime = settings.closeTime || '18:00';
        const clinicName = settings.clinicName || 'Nossa Clínica';

        return `
Você é Ana, secretária virtual da ${clinicName}.
Horário: ${openTime} às ${closeTime}.
Paciente: ${input.userName || 'Cliente'}.
Estado conversa: ${input.currentState}.

Mensagem dele: "${input.message}"

Responda de forma curta, natural e brasileira. Máximo 2 frases.
Use 1 emoji.
Nunca invente preços. Se perguntar valor, mande digitar "atendente".
Objetivo: Guiar para agendamento ou tirar dúvida.

Sua resposta:
`;
    }

    private parseAIResponse(text: string): AIProcessResult {
        return {
            response: text.trim(),
            intent: 'UNKNOWN',
            confidence: 0.9
        };
    }

    private fallbackResponse(input: AIProcessInput): AIProcessResult {
        return {
            response: "Desculpe, estou com uma instabilidade momentânea. Poderia repetir?",
            intent: 'UNKNOWN',
            confidence: 0
        };
    }

    async isAvailable(): Promise<boolean> {
        return !!this.model;
    }
}
