import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationState } from '@prisma/client';
import { SettingsService } from '../config/settings.service';
import { KeywordDetectorService } from './keyword-detector.service';

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
        private readonly settingsService: SettingsService,
        private readonly keywordDetector: KeywordDetectorService
    ) {
        this.ollamaUrl = this.config.get<string>('OLLAMA_URL') || 'http://localhost:11434';
    }

    /**
     * Analisa a mensagem para extrair intenção, entidades e confiança
     * UPGRADED: Now includes confidence scoring and dynamic services
     */
    async analyzeMessage(message: string, conversationContext?: any): Promise<{ intent: string; entities: any; confidence: number }> {
        if (!message) return { intent: 'UNKNOWN', entities: {}, confidence: 0 };

        // === FASE 1: Detecção Rápida por Keywords (sem IA) ===
        const keywordResult = this.keywordDetector.detectIntent(message);
        if (keywordResult && keywordResult.confidence >= 75) {
            // Extrair entidades também
            const entities = this.keywordDetector.extractEntities(message);
            this.logger.log(`⚡ Keyword Detection: ${keywordResult.intent} (${keywordResult.confidence}%) - Pulando IA`);
            return {
                intent: keywordResult.intent,
                entities,
                confidence: keywordResult.confidence
            };
        }

        // === FASE 2: Se keywords não tiveram confiança, usar IA ===
        this.logger.log('🤖 Keywords inconclusivo, chamando IA...');
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
Você é um CLASSIFICADOR DE INTENÇÕES para uma CLÍNICA DE PSICOLOGIA no Brasil.
ANALISE a mensagem e retorne APENAS um JSON com a intenção detectada.

=== CONTEXTO TEMPORAL ===
Hoje: ${currentDay}, ${currentDate}
Hora: ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
${historyBlock}

=== SERVIÇOS DA CLÍNICA ===
${servicesList}

=== INTENÇÕES POSSÍVEIS ===
GREETING       → Saudação (oi, olá, bom dia, boa tarde, eae, fala)
HELP           → Quer menu, ajuda, opções, não sabe o que fazer
SCHEDULE_NEW   → Quer agendar/marcar consulta ou sessão
RESCHEDULE     → Quer remarcar, mudar dia/hora de consulta existente
VIEW_APPOINTMENTS → Quer ver/consultar suas consultas agendadas
FAQ_HOURS      → Pergunta sobre horário de funcionamento
FAQ_PRICE      → Pergunta sobre valores, preços, custos
FAQ_SERVICES   → Pergunta sobre serviços, o que a clínica faz
FAQ_LOCATION   → Pergunta sobre endereço, como chegar
FAQ_INSURANCE  → Pergunta sobre convênio, plano de saúde
HUMAN_REQUEST  → Quer falar com humano/atendente
EMERGENCY      → Crise, urgência, precisa ajuda imediata
THANKS         → Obrigado, valeu, agradeço
CONFIRMATION   → Sim, ok, pode ser, confirmo, beleza
DENIAL         → Não, não quero, deixa pra lá
UNKNOWN        → Não conseguiu identificar

=== REGRAS ESPECIAIS ===
1. Erros de digitação comuns: "oi" = "oi" | "oiee" = "oi" | "obg" = "obrigado"
2. Gírias brasileiras: "blz" = "beleza" | "vlw" = "valeu" | "tmj" = "obrigado"
3. Abreviações: "qdo" = "quando" | "td" = "tudo" | "vc" = "você"
4. Se a pessoa menciona "amanhã", "segunda", "15h" = provavelmente SCHEDULE_NEW
5. Se já está no fluxo de agendamento e responde só com data/hora = SCHEDULE_NEW
6. "Remarcar" OU "reagendar" = sempre RESCHEDULE (nunca SCHEDULE_NEW)
7. "Minhas consultas" OU "meus agendamentos" = VIEW_APPOINTMENTS

=== ENTIDADES A EXTRAIR ===
- service: Nome do serviço mencionado (Terapia, Avaliação, etc)
- day: Dia mencionado (Segunda-feira, amanhã, hoje, 20/01)
- time: Horário mencionado (15h, 10:00, de manhã, à tarde)

=== EXEMPLOS DE CLASSIFICAÇÃO ===
"oi gostaria de marcar uma consulta" → {"intent":"SCHEDULE_NEW","confidence":95,"entities":{}}
"quero remarcar minha consulta" → {"intent":"RESCHEDULE","confidence":95,"entities":{}}
"quanto custa a terapia" → {"intent":"FAQ_PRICE","confidence":90,"entities":{"service":"Terapia"}}
"segunda às 14h" → {"intent":"SCHEDULE_NEW","confidence":85,"entities":{"day":"Segunda-feira","time":"14h"}}
"ok pode ser" → {"intent":"CONFIRMATION","confidence":85,"entities":{}}
"nao" → {"intent":"DENIAL","confidence":90,"entities":{}}
"vc eh um robo?" → {"intent":"HUMAN_REQUEST","confidence":70,"entities":{}}
"minhas consultas" → {"intent":"VIEW_APPOINTMENTS","confidence":95,"entities":{}}
"preciso de ajuda urgente" → {"intent":"EMERGENCY","confidence":95,"entities":{}}
"to muito ansiosa" → {"intent":"EMERGENCY","confidence":75,"entities":{}}
"hmm sei la" → {"intent":"UNKNOWN","confidence":30,"entities":{}}

=== MENSAGEM DO PACIENTE ===
"${message}"

=== RESPONDA APENAS COM JSON VÁLIDO ===
{"intent":"","confidence":0,"entities":{}}
`;

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
     * VERSÃO MELHORADA: Mais natural e contextual
     */
    private buildPrompt(input: AIProcessInput, settings: any): string {
        const openTime = settings.openTime || '09:00';
        const closeTime = settings.closeTime || '18:00';
        const address = settings.clinicAddress || 'Endereço não configurado';
        const city = settings.clinicCity || '';
        const clinicName = settings.clinicName || 'Nossa Clínica';
        const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address + ' ' + city)}`;

        // Serviços formatados (SEM PREÇOS - preços são conversados com humano)
        const servicesList = (settings.services || [])
            .map((s: any) => `• ${s.name}`)
            .join('\n') || '• Terapia Individual\n• Avaliação Psicológica';

        // Personalidade customizável
        const defaultPersona = `Você é Ana, a secretária virtual da ${clinicName}. 
Você é simpática, acolhedora e profissional. Fala de forma natural, como uma brasileira conversa no WhatsApp.
Use emojis com moderação (1-2 por mensagem). Seja BREVE (máximo 2-3 frases por resposta).`;

        const persona = settings.aiPersona || defaultPersona;
        const instructions = settings.aiInstructions || '';

        // Detectar nome do paciente para personalizar
        const patientName = input.userName ? `, ${input.userName.split(' ')[0]}` : '';

        return `${persona}

=== INFORMAÇÕES DA CLÍNICA ===
🏥 Nome: ${clinicName}
🕐 Horário: Segunda a Sexta, ${openTime} às ${closeTime}
📍 Endereço: ${address}${city ? ` - ${city}` : ''}

💼 Serviços Disponíveis:
${servicesList}

=== CONTEXTO DA CONVERSA ===
👤 Nome do paciente: ${input.userName || 'Não informado'}
📊 Estado atual: ${input.currentState}

=== MENSAGEM RECEBIDA ===
"${input.message}"

=== INSTRUÇÕES IMPORTANTES ===
${instructions}

1. NUNCA MENCIONE PREÇOS OU VALORES - Sobre valores, diga "Para informações sobre valores, digite *Falar com atendente*" ou "Posso te direcionar para nosso atendente que pode informar os valores!"
2. SEMPRE GUIE PARA AÇÕES DO BOT: Induza o cliente a responder palavras que ativam fluxos:
   - Para agendar: Pergunte "Quer *agendar* uma consulta?"
   - Para ver consultas: "Que tal ver suas *consultas*?"
   - Para remarcar: "Posso te ajudar a *remarcar*?"
   - Para falar com humano: "Digite *atendente* que conecto você!"
3. SEJA BREVE: Máximo 2-3 frases.
4. SEJA NATURAL: Fale como pessoa real, não robô.
5. USE EMOJIS: Com moderação (1-2 por mensagem).

=== EXEMPLOS DE RESPOSTAS BOAS ===
Pergunta: "oi"
Resposta: "Olá${patientName}! 👋 Posso te ajudar a *agendar* uma consulta ou tirar dúvidas?"

Pergunta: "quanto custa"
Resposta: "Para informações sobre valores, digite *atendente* que conecto você com nossa equipe! �"

Pergunta: "qual o valor"
Resposta: "Posso te direcionar para quem cuida dos valores! Digite *atendente* ou quer *agendar* primeiro? 😊"

Pergunta: "onde fica"
Resposta: "Ficamos na ${address}${city ? `, ${city}` : ''} 📍 Quer *agendar* uma visita?"

Pergunta: "quero agendar"
Resposta: "Ótimo${patientName}! 📅 Digite *agendar* para começar!"

Pergunta: "obrigado"
Resposta: "Por nada${patientName}! 😊 Se precisar de algo mais, é só chamar!"

=== O QUE NUNCA FAZER ===
❌ Mencionar preços ou valores específicos
❌ Textos longos (mais de 4 linhas)
❌ Terminar sem sugerir uma ação
❌ Formalidade excessiva

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
