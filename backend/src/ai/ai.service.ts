import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationState } from '@prisma/client';
import { SettingsService } from '../config/settings.service';

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
    private readonly ollamaUrl: string;
    private readonly model = 'llama3.2';

    constructor(
        private readonly config: ConfigService,
        private readonly settingsService: SettingsService
    ) {
        this.ollamaUrl = this.config.get<string>('OLLAMA_URL') || 'http://localhost:11434';
    }

    /**
     * Analisa a mensagem para extrair intenção, entidades e confiança
     * UPGRADED: Now includes confidence scoring and dynamic services
     */
    async analyzeMessage(message: string, conversationContext?: any): Promise<{ intent: string; entities: any; confidence: number }> {
        if (!message) return { intent: 'UNKNOWN', entities: {}, confidence: 0 };

        // Get current date info (MELHORIA 1: Consciência Temporal)
        const now = new Date();
        const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const currentDay = dayNames[now.getDay()];
        const currentDate = now.toLocaleDateString('pt-BR');

        // Get conversation history (MELHORIA 2: Memória de Curto Prazo)
        const lastMsg = conversationContext?.lastMessage || '';
        const lastResp = conversationContext?.lastResponse || '';
        const historyBlock = lastMsg ? `
CONTEXTO DA CONVERSA (O que foi dito antes):
- Última mensagem do paciente: "${lastMsg}"
- Última resposta do bot: "${lastResp}"
` : '';

        // Carregar serviços dinâmicos das configurações
        const settings = await this.settingsService.getAllSettings();
        const services = settings.services || [
            { name: 'Terapia Individual', price: 150 },
            { name: 'Avaliação Psicológica', price: 800 }
        ];
        const servicesList = services.map((s: any) => `- "${s.name}" (Valores sob consulta)`).join('\n');

        const prompt = `
Você é um analisador de intenções para uma CLÍNICA DE PSICOLOGIA.
Sua ÚNICA tarefa é identificar a INTENÇÃO do paciente e extrair dados relevantes.

=== DATA E HORA ATUAL ===
Hoje é: ${currentDay}, ${currentDate}
Horário: ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
${historyBlock}
=== SERVIÇOS DA CLÍNICA ===
${servicesList}

=== INTENÇÕES POSSÍVEIS (escolha a mais adequada) ===
- GREETING: Saudação inicial (oi, olá, bom dia, boa tarde, boa noite)
- HELP: Pede ajuda, menu, opções, "o que você faz?"
- SCHEDULE_NEW: Quer agendar, marcar consulta, ver horários disponíveis
- CANCEL: Quer cancelar agendamento existente
- RESCHEDULE: Quer remarcar, mudar data/horário
- VIEW_APPOINTMENTS: Quer ver suas consultas agendadas, "minhas consultas"
- FAQ_HOURS: Pergunta sobre horários de funcionamento da clínica
- FAQ_PRICE: Pergunta sobre valores, preços, quanto custa
- FAQ_SERVICES: Pergunta sobre serviços oferecidos, "o que vocês fazem?"
- FAQ_LOCATION: Pergunta sobre endereço, localização, como chegar, mapa
- FAQ_INSURANCE: Pergunta sobre convênio, plano de saúde
- HUMAN_REQUEST: Quer falar com humano, atendente, pessoa real
- EMERGENCY: Situação de urgência, crise, emergência
- THANKS: Agradecimento (obrigado, valeu, agradeço)
- CONFIRMATION: Confirmação (sim, ok, pode ser, confirmo)
- DENIAL: Negação (não, nào quero, cancelar)
- UNKNOWN: Não conseguiu identificar claramente

=== REGRAS PARA DATAS ===
- "amanhã" = dia seguinte ao atual
- "hoje" = data atual
- "segunda", "terça", etc = próximo dia da semana correspondente
- SEMPRE converta para o formato "Segunda-feira", "Terça-feira", etc.

=== FORMATO DE RESPOSTA (APENAS JSON) ===
Responda SOMENTE com um JSON válido, sem explicações:
{
  "intent": "CODIGO_DA_INTENCAO",
  "confidence": 85,
  "entities": {
    "service": "Nome do Serviço (se mencionado)",
    "day": "Dia da semana (Segunda-feira, Terça-feira, etc)",
    "time": "Horário (ex: 15h, 10:00)"
  }
}

=== REGRAS DE CONFIANÇA ===
- confidence: número de 0 a 100 indicando sua certeza
- 90-100: Mensagem muito clara e direta
- 70-89: Razoavelmente claro, mas pode ter ambiguidade
- 50-69: Ambíguo, múltiplas interpretações possíveis
- 0-49: Muito confuso, não entendeu bem

=== EXEMPLOS ===
"Quero terapia sexta às 15h" -> {"intent": "SCHEDULE_NEW", "confidence": 95, "entities": {"service": "Terapia", "day": "Sexta-feira", "time": "15h"}}
"Qual o valor?" -> {"intent": "FAQ_PRICE", "confidence": 90, "entities": {}}
"hmm talvez" -> {"intent": "UNKNOWN", "confidence": 30, "entities": {}}
"ok" -> {"intent": "CONFIRMATION", "confidence": 75, "entities": {}}

=== MENSAGEM ATUAL DO PACIENTE ===
"${message}"

JSON:`;

        try {
            const response = await this.callOllama(prompt);

            // Tentar extrair JSON de forma robusta (lidando com objetos aninhados)
            const result = this.extractJson(response);

            if (result) {
                const confidence = result.confidence || 50;
                this.logger.log(`🤖 IA Analisou: ${result.intent} (confiança: ${confidence}%)`);
                return {
                    intent: result.intent || 'UNKNOWN',
                    entities: result.entities || {},
                    confidence: confidence
                };
            }

            return { intent: 'UNKNOWN', entities: {}, confidence: 0 };
        } catch (error) {
            this.logger.error(`❌ Erro na análise IA: ${error}`);
            return { intent: 'UNKNOWN', entities: {}, confidence: 0 };
        }
    }

    /**
     * Processa mensagem usando Ollama (IA Local)
     */
    async process(input: AIProcessInput): Promise<AIProcessResult> {
        this.logger.log(`🤖 Processando com IA: "${input.message}"`);
        // Buscar configs atuais
        const settings = await this.settingsService.getAllSettings();

        try {
            const prompt = this.buildPrompt(input, settings);
            const response = await this.callOllama(prompt);

            return this.parseAIResponse(response);
        } catch (error) {
            this.logger.error(`❌ Erro na IA: ${error}`);

            // Fallback quando Ollama não está disponível
            return this.fallbackResponse(input);
        }
    }

    /**
     * Monta o prompt para a IA (Clínica de Psicologia)
     */
    private buildPrompt(input: AIProcessInput, settings: any): string {
        const therapyPrice = settings.priceTherapy || '150';
        const evalPrice = settings.priceEvaluation || '800';
        const openTime = settings.openTime || '09:00';
        const closeTime = settings.closeTime || '18:00';
        const address = settings.clinicAddress || 'Endereço não configurado';
        const city = settings.clinicCity || '';
        const clinicName = settings.clinicName || 'Nossa Clínica';
        const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address + ' ' + city)}`;

        return `Você é a secretária virtual da clínica "${clinicName}".
Seja simpática, profissional e sempre útil.

=== INFORMAÇÕES VIVAS DA CLÍNICA ===
- Horário: Segunda a Sexta | ${openTime} às ${closeTime}
- Endereço: ${address} ${city ? `(${city})` : ''}
- Link Mapa: ${mapsLink}
- Serviços e Valores ATUAIS:
  1. Terapia Individual/Infantil: Valores sob consulta.
  2. Avaliação Psicológica: Valores sob consulta.
- Pagamento: PIX ou Dinheiro.

=== CONTEXTO ATUAL ===
- Nome do paciente: ${input.userName}
- Estado da conversa: ${input.currentState}

=== MENSAGEM DO PACIENTE ===
"${input.message}"

=== INSTRUÇÕES ===
Responda de forma acolhedora, profissional e BREVE (máximo 3 frases).
Se identificar a intenção, coloque no início: [INTENT:tipo]

Intenções possíveis:
- SCHEDULING (quer agendar/remarcar/cancelar)
- FAQ (pergunta sobre a clínica)
- GREETING (saudação)
- THANKS (agradecimento)
- OFF_TOPIC (assunto fora do escopo)
- URGENT (crise ou emergência psicológica)

Resposta:`;
    }

    /**
     * Chama o Ollama API com timeout, retry e tratamento robusto de erros
     * OTIMIZADO: À prova de falhas
     */
    private async callOllama(prompt: string, retries = 2): Promise<string> {
        const TIMEOUT_MS = 15000; // 15 segundos timeout

        for (let attempt = 1; attempt <= retries; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

            try {
                const response = await fetch(`${this.ollamaUrl}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: this.model,
                        prompt,
                        stream: false,
                        options: {
                            temperature: 0.7,
                            top_p: 0.9,
                            num_predict: 300,
                        },
                    }),
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`Ollama HTTP ${response.status}`);
                }

                const data = await response.json();
                return data.response || '';

            } catch (error: any) {
                clearTimeout(timeoutId);

                const isTimeout = error.name === 'AbortError';
                const isNetworkError = error.code === 'ECONNREFUSED' || error.message?.includes('fetch failed');

                if (isTimeout) {
                    this.logger.warn(`⏱️ Timeout na chamada IA (tentativa ${attempt}/${retries})`);
                } else if (isNetworkError) {
                    this.logger.warn(`🔌 Ollama indisponível (tentativa ${attempt}/${retries})`);
                } else {
                    this.logger.warn(`❌ Erro IA: ${error.message} (tentativa ${attempt}/${retries})`);
                }

                // Se ainda há retries, aguardar e tentar novamente
                if (attempt < retries) {
                    const delay = 1000 * attempt; // Backoff: 1s, 2s, etc
                    await new Promise(r => setTimeout(r, delay));
                } else {
                    // Esgotou retries - lançar erro para ser tratado pelo chamador
                    throw new Error(`Ollama falhou após ${retries} tentativas: ${error.message}`);
                }
            }
        }

        throw new Error('Ollama: Todas as tentativas falharam');
    }

    /**
     * Faz parsing da resposta da IA
     */
    private parseAIResponse(rawResponse: string): AIProcessResult {
        // Extrair intent se estiver no formato [INTENT:xxx] ou variações
        const intentMatch = rawResponse.match(/\[INTENT?:?\s*(\w+)\]/i);
        const intent = intentMatch ? intentMatch[1] : 'UNKNOWN';

        // Remover TODAS as variações de marcação/tags da resposta
        // Inclui: [INTENT:xxx], [INTEN:xxx], [SCHEDULING], [FAQ], etc.
        let response = rawResponse
            .replace(/\[INTENT?:?\s*\w+\s*\]/gi, '')  // Remove [INTENT:xxx] e variações
            .replace(/\[INTEN\w*:?\s*\w+\s*\]/gi, '') // Remove qualquer [INTENxxx:xxx]
            .replace(/\[\w+\]/gi, '')                  // Remove qualquer [TAG] simples
            .replace(/\s{2,}/g, ' ')                   // Remove espaços duplos
            .trim();

        // Mapear intent para evento
        const eventMap: Record<string, string> = {
            SCHEDULING: 'SCHEDULING_INTENT',
            FAQ: 'FAQ_DETECTED',
            THANKS: 'CONVERSATION_END',
            COMPLAINT: 'HANDOFF_REQUESTED',
        };

        return {
            response,
            intent,
            confidence: 0.8,
            suggestedEvent: eventMap[intent],
        };
    }

    /**
     * Resposta de fallback quando IA não disponível
     */
    private fallbackResponse(input: AIProcessInput): AIProcessResult {
        this.logger.warn('⚠️ Usando resposta de fallback');

        const responses: Record<ConversationState, string> = {
            INIT: `Olá! Sou a Secretária Virtual. Posso ajudar com agendamentos e informações sobre nossos serviços. Como posso ajudá-lo?`,
            AUTO_ATTENDANCE: `Posso ajudar você com agendamento de consultas, horários de funcionamento, valores ou informações sobre nossos psicólogos. O que você precisa?`,
            FAQ_FLOW: `Deixe-me verificar essa informação. Um momento, por favor.`,
            SCHEDULING_FLOW: `Para agendar sua consulta, preciso de algumas informações. Qual especialidade você procura?`,
            CONFIRMATION_PENDING: `Por favor, confirme se as informações estão corretas.`,
            HUMAN_HANDOFF: `Um de nossos atendentes entrará em contato em breve para ajudá-lo. Aguarde um momento.`,
            PAUSED: `Nosso horário de atendimento é de segunda a sexta, das 8h às 20h, e sábados das 8h às 12h. Retornaremos seu contato assim que possível.`,
            BLOCKED: ``,
            COMPLETED: `Obrigada pelo contato! Se precisar agendar uma consulta ou tiver dúvidas, estamos à disposição.`,
        };

        return {
            response: responses[input.currentState] || 'Como posso ajudá-lo com nossos serviços?',
            intent: 'UNKNOWN',
            confidence: 0.5,
        };
    }

    /**
     * Verifica se Ollama está disponível
     */
    async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.ollamaUrl}/api/tags`);
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Extrai JSON de uma string de forma robusta (contando parênteses)
     */
    private extractJson(text: string): any | null {
        const start = text.indexOf('{');
        if (start === -1) return null;

        let balance = 0;
        let end = -1;
        let inString = false;
        let escape = false;

        for (let i = start; i < text.length; i++) {
            const char = text[i];

            if (char === '\\' && !escape) {
                escape = true;
                continue;
            }

            if (char === '"' && !escape) {
                inString = !inString;
            }

            if (!inString) {
                if (char === '{') balance++;
                else if (char === '}') {
                    balance--;
                    if (balance === 0) {
                        end = i;
                        break;
                    }
                }
            }

            escape = false;
        }

        if (end !== -1) {
            const jsonStr = text.substring(start, end + 1);
            try {
                return JSON.parse(jsonStr);
            } catch (e) {
                this.logger.warn(`⚠️ Falha ao fazer parse do JSON extraído: ${jsonStr}`);
                // Tentativa de recuperação: substituir aspas simples por duplas (comum em LLMs)
                try {
                    const fixed = jsonStr.replace(/'/g, '"');
                    // Remover vírgulas traidoras no final de objetos/arrays
                    const fixed2 = fixed.replace(/,(\s*[}\]])/g, '$1');
                    return JSON.parse(fixed2);
                } catch (e2) {
                    return null;
                }
            }
        }
        return null;
    }

    /**
     * Lista modelos disponíveis no Ollama
     */
    async listModels(): Promise<string[]> {
        try {
            const response = await fetch(`${this.ollamaUrl}/api/tags`);
            if (!response.ok) return [];

            const data = await response.json();
            return data.models?.map((m: any) => m.name) || [];
        } catch {
            return [];
        }
    }
}
