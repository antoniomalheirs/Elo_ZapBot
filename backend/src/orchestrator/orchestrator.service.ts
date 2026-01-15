import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConversationState } from '@prisma/client';
import { WhatsAppService, IncomingMessage } from '../whatsapp/whatsapp.service';
import { AIService } from '../ai/ai.service';
import { ContextService, ConversationContext } from '../context/context.service';
import { StateMachine } from './state-machine';
import { RuleEngine } from './rule-engine';
import { HumanizeService } from './humanize.service';
import { PrismaService } from '../database/prisma.service';
import { SettingsService } from '../config/settings.service';
import { startOfDay, endOfDay, parse, format, isBefore, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContextVariables {
    selectedService?: string;
    servicePrice?: number;
    serviceDuration?: number;
    selectedDay?: string;
    selectedTime?: string;
    dateObj?: string; // ISO String
    schedulingStep?: 'SELECT_SERVICE' | 'SELECT_DATE' | 'SELECT_TIME' | 'CONFIRMATION';
    failedAttempts?: number;
    suggestedSlot?: string;
    rejectedSlots?: string[];
    pendingDateSuggestion?: string;
}

@Injectable()
export class OrchestratorService implements OnModuleInit {
    private readonly logger = new Logger(OrchestratorService.name);

    constructor(
        private readonly whatsapp: WhatsAppService,
        private readonly ai: AIService,
        private readonly context: ContextService,
        private readonly stateMachine: StateMachine,
        private readonly ruleEngine: RuleEngine,
        private readonly humanize: HumanizeService,
        private readonly prisma: PrismaService,
        private readonly settingsService: SettingsService,
    ) { }

    async onModuleInit() {
        this.whatsapp.setMessageHandler(this.handleMessage.bind(this));
        this.logger.log('🧠 Orquestrador inicializado');
    }

    async handleMessage(msg: IncomingMessage): Promise<string | null> {
        this.logger.log(`🔄 Processando mensagem de ${msg.from}: ${msg.body}`);

        // FEATURE: Agent First Rule (Se o atendente mandar mensagem, o bot pausa)
        if (msg.isFromMe) {
            this.logger.log(`👤 Agente enviou mensagem para ${msg.from}: "${msg.body}"`);
            try {
                const user = await this.getOrCreateUser(msg.from, msg.contactName);
                const conversation = await this.getOrCreateConversation(user.id);

                // Salvar mensagem no histórico
                await this.saveMessage(conversation.id, 'OUTBOUND', msg.body);

                const msgLower = msg.body.toLowerCase().trim();

                // FEATURE: Detectar comando de encerramento do atendente
                const exitCommands = ['encerrar', 'finalizar', 'voltar bot', 'ativar bot', '/encerrar', '/finalizar'];
                const isExitCommand = exitCommands.some(cmd => msgLower.includes(cmd));

                if (isExitCommand && conversation.state === 'HUMAN_HANDOFF') {
                    // ENCERRAR ATENDIMENTO - REATIVAR BOT
                    this.logger.log(`✅ Atendente encerrou atendimento para ${msg.from}. Reativando bot.`);
                    await this.updateConversationState(conversation.id, 'AUTO_ATTENDANCE');

                    // Notificar cliente
                    const clientChatId = msg.from.includes('@') ? msg.from : `${msg.from}@s.whatsapp.net`;
                    const closeMsg = `✅ Seu atendimento foi finalizado!\n\nEstou de volta para ajudá-lo(a). Digite *Menu* se precisar de algo mais! 😊`;
                    await this.whatsapp.sendMessage(clientChatId, closeMsg);

                    return null;
                }

                // Se não é comando de encerramento, apenas pausar o bot
                if (conversation.state !== 'COMPLETED' && conversation.state !== 'BLOCKED' && conversation.state !== 'HUMAN_HANDOFF') {
                    await this.updateConversationState(conversation.id, 'HUMAN_HANDOFF');
                    this.logger.log(`⏸️ Conversa com ${msg.from} colocada em PAUSA (Agent First).`);
                }

            } catch (e) {
                this.logger.error(`Erro ao processar mensagem do agente: ${e}`);
            }
            return null; // Não responder
        }

        try {
            const user = await this.getOrCreateUser(msg.from, msg.contactName);
            const conversation = await this.getOrCreateConversation(user.id);
            await this.saveMessage(conversation.id, 'INBOUND', msg.body);
            this.logger.log(`🔍 State: ${conversation.state} | Msg: ${msg.body}`);


            const context = await this.context.getContext(user.id, conversation.id);

            // Buscar configurações dinâmicas
            const settings = await this.settingsService.getAllSettings();

            // FEATURE: Comandos do Admin - responde com lista de pacientes
            const adminPhone = settings.adminPhone?.replace(/\D/g, '');
            // FIX: Baileys pode usar @s.whatsapp.net, @c.us ou @lid como sufixo
            const senderPhone = msg.from.replace(/@(s\.whatsapp\.net|c\.us|lid)$/i, '');
            const isAdmin = adminPhone && senderPhone === adminPhone;
            const msgLower = msg.body.toLowerCase().trim();

            if (isAdmin) {
                this.logger.log(`👑 Admin detectado: ${msg.body}`);
                let agendaResponse: string | null = null;

                // Agenda da semana
                if (msgLower.includes('semana') || msgLower.includes('semanal')) {
                    agendaResponse = await this.getAdminWeekAgenda();
                }
                // Agenda do mês
                else if (msgLower.includes('mes') || msgLower.includes('mês') || msgLower.includes('mensal')) {
                    agendaResponse = await this.getAdminMonthAgenda();
                }
                // Agenda de amanhã
                else if (msgLower.includes('amanha') || msgLower.includes('amanhã')) {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    agendaResponse = await this.getAdminAgendaByDate(tomorrow);
                }
                // Agenda por data específica (DD/MM ou DD-MM)
                else if (/agenda\s*(\d{1,2})[\/\-](\d{1,2})/.test(msgLower)) {
                    const match = msgLower.match(/agenda\s*(\d{1,2})[\/\-](\d{1,2})/);
                    if (match) {
                        const day = parseInt(match[1]);
                        const month = parseInt(match[2]) - 1; // 0-indexed
                        const year = new Date().getFullYear();
                        const targetDate = new Date(year, month, day);
                        agendaResponse = await this.getAdminAgendaByDate(targetDate);
                    }
                }
                // Agenda de hoje (default)
                else if (['agenda', 'pacientes', 'consultas hoje', 'pacientes hoje', 'agenda do dia', 'agenda hoje'].some(cmd => msgLower.includes(cmd))) {
                    agendaResponse = await this.getAdminDailyAgenda();
                }

                if (agendaResponse) {
                    await this.saveMessage(conversation.id, 'OUTBOUND', agendaResponse, 'ADMIN_AGENDA');
                    return agendaResponse;
                }
            }

            // FEATURE: Quando estado é HUMAN_HANDOFF, bot não responde ao cliente
            // (exceto comandos de admin para encerrar a sessão)
            if (conversation.state === 'HUMAN_HANDOFF') {
                // Se é admin encerrando a sessão
                if (isAdmin && ['encerrar', 'finalizar', 'finalizar atendimento', 'encerrar atendimento', 'voltar bot', 'ativar bot'].some(cmd => msgLower.includes(cmd))) {
                    this.logger.log(`👑 Admin encerrando atendimento humano para ${user.phone}`);

                    await this.updateConversationState(conversation.id, 'AUTO_ATTENDANCE');

                    // Notificar cliente que atendimento foi encerrado
                    const closeMsg = `✅ Seu atendimento foi finalizado!\n\nEstou de volta para ajudá-lo(a). Digite *Menu* se precisar de algo mais! 😊`;

                    // Enviar para o cliente
                    const clientChatId = user.phone.includes('@') ? user.phone : `${user.phone}@s.whatsapp.net`;
                    await this.whatsapp.sendMessage(clientChatId, closeMsg);

                    await this.saveMessage(conversation.id, 'OUTBOUND', closeMsg, 'HANDOFF_COMPLETE');
                    return `✅ Atendimento de ${user.name || user.phone} encerrado. Bot reativado para este cliente.`;
                }

                // Se é o cliente mandando mensagem durante handoff - não responde
                if (!isAdmin) {
                    this.logger.log(`🔇 Mensagem do cliente ignorada (HUMAN_HANDOFF ativo): ${msg.body}`);
                    await this.saveMessage(conversation.id, 'INBOUND', msg.body, 'HANDOFF_PENDING');
                    return null; // Não responde nada
                }
            }

            let response: string | undefined;
            let newState = conversation.state;
            let intent: string | undefined;
            let ruleResult: any;

            // FEATURE: Detectar resposta a Lembrete de Consulta (Interactive Flow)
            // Se estado for CONFIRMATION_PENDING, assumimos que é confirmação de agendamento OU lembrete
            // Para diferenciar, podemos checar o histórico, mas 'CONFIRMATION_PENDING' é um bom bloqueio
            if (conversation.state === 'CONFIRMATION_PENDING') {
                const lower = msg.body.toLowerCase().trim();

                // 1. CONFIRMAR
                if (['sim', 'confirmo', 'ok', 'pode', 'vou'].some(k => lower.includes(k))) {
                    this.logger.log(`✅ Lembrete/Agendamento confirmado por ${msg.from}`);
                    response = '✅ Ótimo! Sua presença está confirmada. Te aguardamos! 😊';
                    newState = 'AUTO_ATTENDANCE';

                    // Tenta confirmar no banco se houver agendamento pendente/confirmado para amanhã
                    // O ideal seria passar o contexto, mas por simplificação vamos assumir o fluxo
                    // Se for fluxo de agendamento novo, o handleConfirmation já tratou.
                    // Se for lembrete, não precisa mudar status (já é CONFIRMED), mas logamos.
                }
                // 2. CANCELAR - AQUI É A CRÍTICA
                else if (['não', 'nao', 'cancelar', 'cancela', 'desmarcar'].some(k => lower.includes(k))) {
                    this.logger.log(`❌ Lembrete/Agendamento sendo CANCELADO por ${msg.from}`);
                    const cancelMsg = await this.handleReminderCancellation(user.id);
                    if (cancelMsg) {
                        response = cancelMsg;
                        newState = 'AUTO_ATTENDANCE';
                    } else {
                        response = 'Não encontrei agendamento para cancelar. Digite *Menu*.';
                        newState = 'AUTO_ATTENDANCE';
                    }
                }
                // 3. Resposta Inválida
                else {
                    response = '⚠️ Não entendi. Responda apenas *SIM* para confirmar ou *CANCELAR* para liberar o horário.';
                    // Mantém o estado CONFIRMATION_PENDING
                    newState = 'CONFIRMATION_PENDING';
                }

                if (response) {
                    const sent = await this.whatsapp.sendMessage(msg.from, response);
                    await this.saveMessage(conversation.id, 'OUTBOUND', response, 'REMINDER_REPLY');
                    await this.updateConversationState(conversation.id, newState);
                    return null; // Stop processing
                }
            }

            // Fallback para lógica antiga de 'lastOutbound' (pode ser removido depois se quiser limpar)
            const lastOutbound = await this.prisma.message.findFirst({
                where: { conversationId: conversation.id, direction: 'OUTBOUND' },
                orderBy: { createdAt: 'desc' }
            });

            if (lastOutbound?.content.includes('Lembrete de Consulta') && conversation.state !== 'CONFIRMATION_PENDING') {
                // Se o estado não foi setado (legado), tentamos capturar
                // ... Lógica similar ...
            }

            // 1. Processar regras / intenções PRIMEIRO para detectar interrupções 
            // Mas só aplicamos se for FAQ, MENU ou CANCEL
            ruleResult = this.ruleEngine.process(msg.body, settings);
            intent = ruleResult.intent;

            // Se for comando de cancelamento explícito
            if (intent === 'CANCEL_APPOINTMENT') {
                await this.context.clearContext(user.id, conversation.id);
                newState = 'AUTO_ATTENDANCE';
                response = ruleResult.response;
            }
            // FEATURE: Prevent FAQ interruption during Scheduling Flow
            // If we are in the middle of scheduling, ignore generic FAQs like "Horário" or "Preço" because user might be saying "Quero outro horário"
            else if (conversation.state === 'SCHEDULING_FLOW' && intent && intent.startsWith('FAQ_')) {
                this.logger.log(`🛡️ Bloqueando FAQ ${intent} pois estamos no fluxo de agendamento.`);
                // Let the flow handle it (it will likely be treated as rejection or date input)
                intent = undefined;
                ruleResult.intent = undefined;

                const result = await this.handleSchedulingFlow(msg.body, context, user.id, conversation.id, settings, intent);
                response = result.response;
                if (result.completed) newState = 'AUTO_ATTENDANCE';
            }

            // Logica de Fluxo (State Machine)
            else if (conversation.state === 'SCHEDULING_FLOW') {
                this.logger.log('🔄 Entering handleSchedulingFlow...');
                // Passamos o intent detectado para o flow saber se deve interromper
                const result = await this.handleSchedulingFlow(msg.body, context, user.id, conversation.id, settings, intent);
                response = result.response;

                // Se a resposta vier vazia, significa que o flow decidiu não tratar (ex: interrupção tratada fora ou ignorada)
                // Mas aqui esperamos que handleSchedulingFlow trate a interrupção devolvendo a resposta do FAQ + Resume

                if (result.completed) {
                    newState = 'AUTO_ATTENDANCE';
                }
            }
            else if (conversation.state === 'CONFIRMATION_PENDING') {
                const result = await this.handleConfirmation(msg.body, context, user.id);
                response = result.response;
                if (result.confirmed || result.cancelled) {
                    newState = 'AUTO_ATTENDANCE';
                    await this.context.updateContext(user.id, conversation.id, {
                        schedulingStep: undefined,
                        selectedService: undefined,
                        servicePrice: undefined,
                        selectedDay: undefined,
                        selectedTime: undefined,
                        suggestedSlot: undefined,
                        rejectedSlots: undefined
                    });
                }
            }

            else {
                // 1. Prioridade para Regras (Já processado no início)
                // ruleResult e intent já estão populados

                if (ruleResult.matched) {
                    response = ruleResult.response;

                    // FEATURE: Transição de Estado Explícita baseada na Regra
                    if (ruleResult.event === 'SCHEDULING_INTENT') {
                        newState = 'SCHEDULING_FLOW';
                        // Limpar contexto de agendamento anterior
                        await this.context.updateContext(user.id, conversation.id, {
                            schedulingStep: 'SELECT_SERVICE',
                            selectedService: undefined,
                            servicePrice: undefined,
                            selectedDay: undefined
                        });
                    } else if (ruleResult.event === 'HANDOFF_REQUESTED') {
                        newState = 'HUMAN_HANDOFF';

                        // FEATURE: Notificar admin quando cliente pede humano
                        // FEATURE: Notificar admin quando cliente pede humano
                        // FEATURE: Notificar admin quando cliente pede humano
                        await this.notifyAdminHandoff(user, msg, settings);
                    }
                    // FEATURE: Meus Agendamentos (suporta MY_APPOINTMENTS e VIEW_APPOINTMENTS)
                    else if (intent === 'MY_APPOINTMENTS' || intent === 'VIEW_APPOINTMENTS') {
                        response = await this.handleMyAppointments(user.id);
                    }
                    // FEATURE: Remarcar
                    else if (intent === 'RESCHEDULE') {
                        const rescheduleResult = await this.handleRescheduleRequest(user.id, conversation.id);
                        response = rescheduleResult.response;
                        if (rescheduleResult.startScheduling) {
                            newState = 'SCHEDULING_FLOW';
                        }
                    }
                }
                else {
                    // 2. Se não for regra, vai direto para IA
                    // (Small Talk removido - Fallback Inteligente cuida de tudo)

                    // Análise de IA (complexo)
                    // MELHORIA: Passando contexto da conversa para a IA (memória de curto prazo)
                    const analysis = await this.ai.analyzeMessage(msg.body, context);
                    const aiIntent = analysis.intent;
                    const entities = analysis.entities;
                    const confidence = analysis.confidence || 0;

                    // FEATURE 1 + 6: Nível de confiança - se baixo, pedir esclarecimento ou escalar
                    if (confidence < 60) {
                        const attempts = (context.failedAttempts || 0) + 1;
                        await this.context.updateContext(user.id, conversation.id, { failedAttempts: attempts });

                        // FEATURE 6: Após 3 tentativas falhas, escalar para humano
                        if (attempts >= 3) {
                            this.logger.warn(`🚨 3 tentativas falhas - escalando para humano`);
                            const firstName = user.name ? user.name.split(' ')[0] : '';
                            response = `${firstName ? firstName + ', ' : ''}tudo bem! �\n\nVou chamar alguém da nossa equipe para te ajudar melhor.\n\n👤 Um atendente vai te responder em breve!\n\n_Enquanto isso, pode continuar mandando mensagens._`;
                            intent = 'HUMAN_ESCALATION';
                            newState = 'HUMAN_HANDOFF';

                            // FEATURE: Notificar ADMIN quando auto-escalar
                            const adminPhone = settings.adminPhone;
                            if (adminPhone) {
                                const cleanAdminPhone = adminPhone.replace(/\D/g, '');
                                if (cleanAdminPhone.length >= 10) {
                                    const adminChatId = `${cleanAdminPhone}@s.whatsapp.net`;
                                    const clientPhone = msg.from.replace('@s.whatsapp.net', '').replace('@c.us', '');
                                    const adminNotification = `🚨 *Auto-Escalação (IA falhou 3x)*\n\nCliente: ${user.name || 'Desconhecido'}\nTelefone: ${clientPhone}\nÚltima mensagem: "${msg.body}"\n\n📲 O bot não conseguiu ajudar. Entre em contato.`;

                                    this.logger.log(`📤 Notificando ADMIN sobre auto-escalação: ${adminChatId}`);
                                    await this.whatsapp.sendMessage(adminChatId, adminNotification);
                                }
                            }
                        } else {
                            this.logger.warn(`⚠️ Confiança baixa (${confidence}%) - tentativa ${attempts}/3`);
                            response = this.generateClarificationQuestion(msg.body, user.name);
                            intent = 'LOW_CONFIDENCE';
                        }
                    }
                    else if (aiIntent && aiIntent !== 'UNKNOWN') {
                        this.logger.log(`🤖 IA recuperou: ${aiIntent} (${confidence}% confiança)`);
                        intent = aiIntent;

                        ruleResult.matched = true;
                        ruleResult.intent = aiIntent;
                        // PASSANDO SETTINGS E NOME DO USUARIO (Feature 5)
                        ruleResult.response = this.ruleEngine.getResponseByIntent(aiIntent, settings, user.name);
                        ruleResult.event = this.ruleEngine.getEventByIntent(aiIntent);

                        // FEATURE: Notificar admin se IA detectou pedido de humano
                        if (ruleResult.event === 'HANDOFF_REQUESTED') {
                            await this.notifyAdminHandoff(user, msg, settings);
                            newState = 'HUMAN_HANDOFF';
                        }

                        // Adicionar transição de estado se a IA detectar agendamento
                        if (aiIntent === 'SCHEDULE_NEW') {
                            newState = 'SCHEDULING_FLOW';
                        }

                        // FIX: Tratamento explícito para 'Ver Consultas' via IA
                        if (aiIntent === 'VIEW_APPOINTMENTS') {
                            const listResponse = await this.handleMyAppointments(user.id);
                            ruleResult.response = listResponse;
                        }

                        // ... Lógica de Smart Filling ...
                        if (aiIntent === 'SCHEDULE_NEW' && entities && Object.keys(entities).length > 0) {
                            // FEATURE 5.1: Validar serviço dinâmico
                            const services = settings.services || [
                                { name: 'Terapia Individual', price: 150 },
                                { name: 'Avaliação Psicológica', price: 800 }
                            ];

                            // Tentar encontrar serviço correspondente
                            const matchedService = entities.service ? services.find((s: any) =>
                                entities.service.toLowerCase().includes(s.name.toLowerCase()) ||
                                s.name.toLowerCase().includes(entities.service.toLowerCase())
                            ) : null;

                            if (matchedService) {
                                newState = 'SCHEDULING_FLOW';
                                await this.context.updateContext(user.id, conversation.id, {
                                    selectedService: matchedService.name,
                                    servicePrice: Number(matchedService.price),
                                    serviceDuration: Number(matchedService.duration) || 60,
                                    schedulingStep: 'SELECT_DATE'
                                });
                                ruleResult.response = `📅 Entendi: ${matchedService.name}. Qual dia?`;
                            }
                            // Se não encontrar serviço válido, não faz auto-fill e deixa cair na pergunta padrão do RuleEngine
                        }
                        response = ruleResult.response;
                    }
                }      // Closes inner else
            }      // Closes outer else (294)

            // 4. Executar transição de estado se necessário
            if (response) {
                // FEATURE 6: Humanizar resposta antes de enviar (Variations + Connectors)
                // Evitar conectores em respostas estruturadas ou saudações
                const skipConnectorIntents = ['GREETING', 'MENU_REQUESTED', 'HELP', 'SCHEDULE_NEW', 'FAQ_HOURS', 'FAQ_ADDRESS', 'FAQ_SERVICES', 'FAQ_LOCATION', 'CONFIRMATION_PENDING', 'AUTO_ATTENDANCE'];
                const skipConnectors = skipConnectorIntents.includes(intent || '') || ['SCHEDULING_FLOW', 'CONFIRMATION_PENDING'].includes(conversation.state);

                const finalResponse = this.humanize.humanize(response, msg.body, {
                    addConnector: !skipConnectors,
                    checkEmpathy: true
                });


                // FIX: Não enviar mensagem aqui - o WhatsAppService já envia quando recebe o retorno do handler
                await this.saveMessage(conversation.id, 'OUTBOUND', finalResponse, intent);
                await this.updateConversationState(conversation.id, newState);

                // this.logger.log(`🔙 Retornando resposta para WhatsApp: "${finalResponse.substring(0, 50)}..."`);
                return finalResponse;
            }

            return null;

        } catch (error) {
            this.logger.error(`❌ Erro no orquestrador: ${error}`);
            return null;
        }
        return null;
    }

    // --- Métodos Privados de Fluxo ---

    private async handleSchedulingFlow(message: string, context: ConversationContext, userId: string, conversationId: string, settings: any, intent?: string): Promise<{ response: string, completed: boolean }> {
        let response = '';
        let completed = false;
        const msgLower = message.toLowerCase().trim();

        // FEATURE: Flow Interruption (Escape Hatch & FAQs)
        if (intent === 'CANCEL_APPOINTMENT') {
            await this.context.clearContext(userId, conversationId);
            return { response: '👍 Tudo bem! Agendamento cancelado.', completed: true };
        }
        if (intent === 'HUMAN_REQUEST') {
            return { response: '', completed: true };
        }

        // FEATURE: Permitir cancelar o fluxo de agendamento a qualquer momento (exceto nas confirmações sim/não)
        const step = context.schedulingStep || 'SELECT_SERVICE';
        // const isConfirmationStep = step === 'CONFIRM' || step === 'SELECT_TIME'; // Removing restriction
        const cancelKeywords = ['cancela', 'cancelar', 'sair', 'deixa pra lá', 'deixa pra la', 'esquece', 'não quero mais', 'nao quero mais', 'desisto', 'parar'];

        if (cancelKeywords.some(k => msgLower.includes(k))) {
            // Limpar contexto de agendamento
            await this.context.clearContext(userId, conversationId);
            this.logger.log(`🚪 Usuário cancelou o fluxo de agendamento. Gerando resposta...`);
            return {
                response: '👍 Entendido! Agendamento cancelado com sucesso. Se precisar, estou aqui!',
                completed: true
            };
        }

        // Se houver intenção global (FAQ, Menu) durante o fluxo
        if (intent && (intent.startsWith('FAQ_') || intent === 'MENU_REQUESTED')) {
            // Gerar resposta do FAQ
            const ruleResponse = this.ruleEngine.getResponseByIntent(intent, settings);
            if (ruleResponse) {
                // Adicionar "Lembrete" de onde paramos
                let resumeMsg = '';

                if (step === 'SELECT_DATE') resumeMsg = '\n\n(Voltando ao agendamento... Qual dia você prefere?)';
                if (step === 'SELECT_TIME') resumeMsg = `\n\n(Voltando ao agendamento... O horário *${context.suggestedSlot}* fica bom?)`;

                return { response: ruleResponse + resumeMsg, completed: false };
            }
        }

        switch (step) {
            case 'SELECT_SERVICE':
                const userMessage = message.toLowerCase();
                const services = settings.services || [
                    { name: 'Terapia Individual', price: 150 },
                    { name: 'Avaliação Psicológica', price: 800 }
                ];

                // Melhorando a validação: Evitar match falso com palavras genéricas como "Agendamento"
                const selectedService = services.find((s: any) => {
                    const sName = s.name.toLowerCase();
                    return userMessage.includes(sName) || sName.includes(userMessage);
                });

                // Validação extra: Se o usuario digitou algo mto curto ou genérico, ignorar
                const isGeneric = ['agendamento', 'consulta', 'marcar', 'horario'].some(k => userMessage.includes(k) && userMessage.length < 15);

                if (selectedService && !isGeneric) {
                    await this.context.updateContext(userId, conversationId, {
                        schedulingStep: 'SELECT_DATE',
                        selectedService: selectedService.name,
                        servicePrice: Number(selectedService.price),
                        serviceDuration: Number(selectedService.duration) || 60
                    });
                    response = `📅 ${selectedService.name.trim()}. Para qual dia você gostaria?`;
                } else {
                    const servicesList = services.map((s: any) => `*${s.name.trim()}*`).join(' ou ');
                    response = `Por favor, digite um dos serviços disponíveis: ${servicesList} para seguirmos.`;
                }
                break;

            case 'SELECT_DATE':
                // Check if we are waiting for a confirmation of a SUGGESTED date
                if (context.pendingDateSuggestion && ['sim', 'pode ser', 'topo', 'aceito', 'pode'].some(k => message.toLowerCase().includes(k))) {
                    // Accept the pending suggestion
                    // Recursively call with the confirmed date string
                    return this.handleSchedulingFlow(context.pendingDateSuggestion, { ...context, pendingDateSuggestion: undefined }, userId, conversationId, settings);
                }

                // Validação de Data
                let dateStr = message;
                // Tentar extrair data se for texto relativo (hoje, amanhã)
                if (message.toLowerCase().includes('hoje')) dateStr = format(new Date(), 'yyyy-MM-dd');
                if (message.toLowerCase().includes('amanhã') || message.toLowerCase().includes('amanha')) {
                    dateStr = format(addMinutes(new Date(), 24 * 60), 'yyyy-MM-dd');
                }

                // Regex simples para DD/MM
                const dateMatch = dateStr.match(/(\d{1,2})[\/-](\d{1,2})/);
                if (!dateMatch && !dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    response = '🗓️ Data inválida! Por favor, digite o dia e mês assim: *15/07* ou *15 de Julho*.';
                } else {
                    // Converter para Date Object
                    const now = new Date();
                    let targetDate: Date;

                    if (dateMatch) {
                        const day = parseInt(dateMatch[1]);
                        const month = parseInt(dateMatch[2]) - 1; // JS Month is 0-indexed
                        targetDate = new Date(now.getFullYear(), month, day);
                        if (isBefore(targetDate, startOfDay(now))) {
                            targetDate.setFullYear(now.getFullYear() + 1);
                        }
                    } else {
                        targetDate = parse(dateStr, 'yyyy-MM-dd', new Date());
                    }

                    // FEATURE: Validação de Dias de Funcionamento
                    const workDays = settings.workDays || { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false };
                    const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                    const dayKey = dayMap[targetDate.getDay()];
                    const dayNames: Record<string, string> = {
                        sunday: 'domingo', monday: 'segunda', tuesday: 'terça',
                        wednesday: 'quarta', thursday: 'quinta', friday: 'sexta', saturday: 'sábado'
                    };

                    if (workDays[dayKey] === false) {
                        // Encontrar próximo dia útil
                        let nextWorkDay = new Date(targetDate);
                        for (let i = 1; i <= 7; i++) {
                            nextWorkDay.setDate(nextWorkDay.getDate() + 1);
                            const nextDayKey = dayMap[nextWorkDay.getDay()];
                            if (workDays[nextDayKey] !== false) break;
                        }
                        const suggestedDate = format(nextWorkDay, 'dd/MM');

                        // Save suggestion to context so user can say "pode ser"
                        await this.context.updateContext(userId, conversationId, {
                            pendingDateSuggestion: suggestedDate
                        });

                        response = `🚫 Não funcionamos aos *${dayNames[dayKey]}s*.\n\nQue tal *${suggestedDate}* (${dayNames[dayMap[nextWorkDay.getDay()]]})?`;
                        break;
                    }

                    // Verificar disponibilidade (Single Slot Suggestion)
                    const formattedDate = format(targetDate, 'dd/MM/yyyy');
                    const rejectedSlots = context.rejectedSlots || [];

                    const nextSlot = await this.findNextAvailableSlot(targetDate, settings, rejectedSlots);

                    if (!nextSlot) {
                        // Oferecer Lista de Espera
                        await this.context.updateContext(userId, conversationId, {
                            selectedDay: formattedDate,
                            dateObj: targetDate.toISOString(),
                            schedulingStep: 'WAITLIST_OFFER'
                        });
                        response = `🚫 Poxa, para o dia *${formattedDate}* não tenho horários livres. 😔\n\n📋 Mas posso te colocar na *Lista de Espera*! Se surgir uma vaga, te aviso.\n\nQuer entrar na fila? (Sim/Não)`;
                    } else {
                        await this.context.updateContext(userId, conversationId, {
                            selectedDay: formattedDate,
                            dateObj: targetDate.toISOString(), // Salvar data completa para consultas futuras
                            schedulingStep: 'SELECT_TIME',
                            suggestedSlot: nextSlot,
                            rejectedSlots: [], // Resetar rejeições para o novo dia
                            pendingDateSuggestion: undefined // Limpar sugestão de data pendente
                        });
                        response = `Dia *${formattedDate}*.\n\n🕒 Tenho um horário às *${nextSlot}*.\n\nPosso confirmar ? (Sim/Não)`;
                    }
                }
                break;

            case 'SELECT_TIME':
                const targetDateObj = new Date(context.dateObj!);
                const suggested = context.suggestedSlot;
                const msgLower = message.toLowerCase();

                // 1. Aceitação
                if (['sim', 'pode', 'ok', 'claro', 'tá bom', 'ta bom', 'agendar', 'quero'].some(k => msgLower.includes(k))) {
                    await this.context.updateContext(userId, conversationId, {
                        selectedTime: suggested,
                        schedulingStep: 'CONFIRM' // Pular direto para confirmação se aceitar
                    });

                    // Respondemos diretamente com a pergunta de confirmação, sem recursão perigosa
                    const fullContext = await this.context.getContext(userId, conversationId);
                    response = `📝 Vamos confirmar:\n\nServiço: *${fullContext.selectedService}*\nDia: *${fullContext.selectedDay}*\nHorário: *${suggested}*\n\nAgendado ? (Sim/Não)`;
                    return { response, completed: false };
                }

                // 2. Rejeição / Pedir Outro
                else if (['não', 'nao', 'outro', 'tem outro', 'ocupado', 'ruim'].some(k => msgLower.includes(k))) {
                    const currentRejected = context.rejectedSlots || [];
                    const newRejected = [...currentRejected, suggested!];

                    const nextSlot = await this.findNextAvailableSlot(targetDateObj, settings, newRejected);

                    if (!nextSlot) {
                        response = `😕 É... para esse dia não tenho mais horários disponíveis.\n\nQuer tentar outro dia? (Digite a data)`;
                        await this.context.updateContext(userId, conversationId, { schedulingStep: 'SELECT_DATE' });
                    } else {
                        await this.context.updateContext(userId, conversationId, {
                            suggestedSlot: nextSlot,
                            rejectedSlots: newRejected
                        });
                        response = `Entendi. Que tal às *${nextSlot}*?`;
                    }
                }

                // 3. Digitação Explícita (Ex: "15:00")
                else {
                    // Tentar extrair horário
                    const timeMatch = message.match(/(\d{1,2})[:h](\d{2})?/); // 15:00 ou 15h
                    if (timeMatch) {
                        let hour = parseInt(timeMatch[1]);
                        const minute = timeMatch[2] || '00';
                        const inputSlot = `${hour.toString().padStart(2, '0')}:${minute}`;

                        // Verificar disponibilidade REAL
                        const availableToday = await this.getAvailableSlotsForDay(targetDateObj, settings);

                        if (availableToday.includes(inputSlot)) {
                            await this.context.updateContext(userId, conversationId, {
                                selectedTime: inputSlot,
                                schedulingStep: 'CONFIRM'
                            });
                            return this.handleSchedulingFlow('', { ...context, selectedTime: inputSlot, schedulingStep: 'CONFIRM' }, userId, conversationId, settings);
                        } else {
                            response = `❌ O horário *${inputSlot}* já está ocupado ou indisponível.\n\nQue tal o horário sugerido (*${suggested}*)?`;
                        }
                    } else {
                        response = `🤔 Não entendi. O horário *${suggested}* fica bom?\n\n(Responda Sim, Não, ou digite outro horário)`;
                    }
                }
                break;

            case 'CONFIRM':
                if (message.toLowerCase().includes('sim') || message.toLowerCase().includes('ok')) {
                    completed = true;
                    // Recuperar contexto
                    const current = await this.context.getContext(userId, conversationId);

                    // Parse Real Date Time
                    const datePart = current.selectedDay; // DD/MM/YYYY
                    const timePart = current.selectedTime; // HH:mm

                    let finalDate = new Date();
                    if (datePart && timePart) {
                        const [day, month, year] = datePart.split('/').map(Number);
                        const [hour, minute] = timePart.split(':').map(Number);
                        // Month is 0-index
                        finalDate = new Date(year, month - 1, day, hour, minute);
                    }

                    // Professional Confirmation Message
                    const formattedDisplay = format(finalDate, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });

                    response = `✅ Agendamento Confirmado!\n\nServiço: *${current.selectedService}*\nData: *${formattedDisplay}*\n\nGrata, Ana Paula Malheiros! 😉`;

                    // Criar agendamento no banco
                    try {
                        // FIX: Prevenir Double Booking (Race Condition)
                        const existing = await this.prisma.appointment.findFirst({
                            where: {
                                dateTime: finalDate,
                                status: { not: 'CANCELLED' }
                            }
                        });

                        if (existing) {
                            await this.context.updateContext(userId, conversationId, {
                                schedulingStep: 'SELECT_TIME', // Voltar um passo
                                selectedTime: undefined
                            });
                            return {
                                response: '⚠️ Poxa, alguém acabou de reservar esse horário! 😓\n\nPor favor, escolha outro horário.',
                                completed: false
                            };
                        }

                        await this.prisma.appointment.create({
                            data: {
                                userId: userId,
                                service: current.selectedService || 'Consulta',
                                dateTime: finalDate,
                                status: 'CONFIRMED'
                            }
                        });

                        // FEATURE: Processar cancelamento de reagendamento se houver
                        if (current.rescheduleFromAppointmentId) {
                            try {
                                await this.prisma.appointment.update({
                                    where: { id: current.rescheduleFromAppointmentId },
                                    data: { status: 'CANCELLED', cancelledAt: new Date() }
                                });
                                response += `\n\n🔄 Seu agendamento anterior foi cancelado e substituído.`;
                                // Limpar ID para evitar problemas futuros
                                await this.context.updateContext(userId, conversationId, { rescheduleFromAppointmentId: undefined });
                            } catch (e) {
                                this.logger.error(`Erro ao cancelar agendamento anterior durante remarcação: ${e}`);
                            }
                        }
                    } catch (e) {
                        this.logger.error(`Erro ao salvar agendamento: ${e}`);
                        response = '⚠️ Houve um erro interno ao salvar seu agendamento, mas anotei aqui. Um atendente humano irá confirmar com você em breve.';
                    }

                } else if (message.toLowerCase().includes('não') || message.toLowerCase().includes('nao') || message.toLowerCase().includes('cancelar')) {
                    response = '❌ Tudo bem, cancelamos o agendamento. Se quiser recomeçar, é só me chamar!';
                    completed = true; // Sai do fluxo mas sem confirmar
                } else {
                    // Resposta não reconhecida - pedir esclarecimento ao invés de cancelar
                    const current = await this.context.getContext(userId, conversationId);
                    response = `🤔 Desculpa, não entendi. Para confirmar seu agendamento de *${current.selectedService}* em *${current.selectedDay}* às *${current.selectedTime}*, responda *Sim* ou *Não*.`;
                }
                break;

            case 'WAITLIST_OFFER':
                const lower = message.toLowerCase().trim();
                if (lower === 'sim' || lower === 'ok' || lower.includes('quero')) {
                    // Adicionar à Lista de Espera
                    const currentContext = await this.context.getContext(userId, conversationId);
                    const preferredDate = currentContext.dateObj ? new Date(currentContext.dateObj) : new Date();

                    await this.prisma.waitlist.create({
                        data: {
                            userId: userId,
                            service: currentContext.selectedService || 'Consulta',
                            preferredDate: preferredDate,
                            status: 'WAITING'
                        }
                    });

                    response = `✅ Pronto! Você foi adicionado à *Lista de Espera* para o dia *${currentContext.selectedDay}*.\n\n📲 Se surgir uma vaga, te avisarei pelo WhatsApp!\n\nEnquanto isso, quer tentar outro dia? Digite uma nova data ou *Menu* para outras opções.`;
                    completed = true;
                } else {
                    response = '👍 Tudo bem! Quer tentar outro dia? Digite uma nova data.';
                    await this.context.updateContext(userId, conversationId, {
                        schedulingStep: 'SELECT_DATE'
                    });
                }
                break;
        }

        this.logger.log(`✅ [DEBUG] Exiting handleSchedulingFlow with response: "${response.substring(0, 30)}..."`);
        return { response, completed };
    }

    private async handleConfirmation(message: string, context: ConversationContext, userId: string) {
        if (message.toLowerCase().includes('sim') || message.toLowerCase().includes('ok')) {
            return { response: '✅ Confirmado! Obrigado.', confirmed: true };
        } else {
            return { response: '❌ Cancelado.', cancelled: true };
        }
    }

    // --- FEATURE: Meus Agendamentos ---
    private async handleMyAppointments(userId: string): Promise<string> {
        const appointments = await this.prisma.appointment.findMany({
            where: {
                userId: userId,
                dateTime: { gte: new Date() },
                status: { not: 'CANCELLED' }
            },
            orderBy: { dateTime: 'asc' },
            take: 5
        });

        if (appointments.length === 0) {
            return '📋 Você não tem agendamentos futuros no momento.\n\nDigite *Agendar* para marcar uma consulta!';
        }

        const list = appointments.map(apt => {
            const dateStr = format(apt.dateTime, "dd/MM 'às' HH:mm", { locale: ptBR });
            return `• *${apt.service}* - ${dateStr}`;
        }).join('\n');

        return `📋 Seus próximos agendamentos:\n\n${list}\n\nPara remarcar algum, digite *Remarcar consulta*.`;
    }

    // --- FEATURE: Cancelar Agendamento ---
    private async handleCancelRequest(userId: string, message: string): Promise<string> {
        // Tentar extrair data da mensagem (ex: "cancelar dia 15")
        const dateMatch = message.match(/(\d{1,2})[\/-]?(\d{1,2})?/);

        // Buscar agendamentos futuros do usuário
        const appointments = await this.prisma.appointment.findMany({
            where: {
                userId: userId,
                dateTime: { gte: new Date() },
                status: { not: 'CANCELLED' }
            },
            orderBy: { dateTime: 'asc' }
        });

        if (appointments.length === 0) {
            return '🤔 Não encontrei agendamentos futuros para cancelar.';
        }

        // Se só tem um, cancela direto
        if (appointments.length === 1) {
            await this.prisma.appointment.update({
                where: { id: appointments[0].id },
                data: { status: 'CANCELLED', cancelledAt: new Date() }
            });
            const dateStr = format(appointments[0].dateTime, "dd/MM 'às' HH:mm", { locale: ptBR });
            return `✅ Consulta de *${appointments[0].service}* no dia *${dateStr}* foi cancelada com sucesso.\n\nSe quiser reagendar, digite *Agendar*.`;
        }

        // Se tem mais de um, tenta encontrar pelo dia mencionado
        if (dateMatch) {
            const day = parseInt(dateMatch[1]);
            const month = dateMatch[2] ? parseInt(dateMatch[2]) - 1 : new Date().getMonth();

            const match = appointments.find(apt => {
                return apt.dateTime.getDate() === day && apt.dateTime.getMonth() === month;
            });

            if (match) {
                await this.prisma.appointment.update({
                    where: { id: match.id },
                    data: { status: 'CANCELLED', cancelledAt: new Date() }
                });
                const dateStr = format(match.dateTime, "dd/MM 'às' HH:mm", { locale: ptBR });
                return `✅ Consulta de *${match.service}* no dia *${dateStr}* foi cancelada com sucesso.`;
            }
        }

        // Se não conseguiu identificar, lista as opções
        const list = appointments.map((apt, i) => {
            const dateStr = format(apt.dateTime, "dd/MM 'às' HH:mm", { locale: ptBR });
            return `${i + 1}. *${apt.service}* - ${dateStr}`;
        }).join('\n');

        return `🗓️ Você tem mais de um agendamento. Qual deseja cancelar?\n\n${list}\n\n(Digite o dia, ex: "cancelar dia 15")`;
    }

    // --- FEATURE: Cancelar via Resposta ao Lembrete ---
    private async handleReminderCancellation(userId: string): Promise<string> {
        // Buscar agendamento de amanhã
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const dayAfterTomorrow = new Date(tomorrow);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

        const appointment = await this.prisma.appointment.findFirst({
            where: {
                userId: userId,
                dateTime: { gte: tomorrow, lt: dayAfterTomorrow },
                status: 'CONFIRMED'
            }
        });

        if (!appointment) {
            return '🤔 Não encontrei um agendamento para amanhã para cancelar.';
        }

        await this.prisma.appointment.update({
            where: { id: appointment.id },
            data: { status: 'CANCELLED', cancelledAt: new Date() }
        });

        const timeStr = format(appointment.dateTime, "HH:mm", { locale: ptBR });
        return `❌ Sua consulta de *${appointment.service}* amanhã às *${timeStr}* foi cancelada.\n\nSe quiser reagendar, digite *Agendar*.`;
    }

    // --- FEATURE: Remarcar Agendamento ---
    private async handleRescheduleRequest(userId: string, conversationId: string): Promise<{ response: string, startScheduling: boolean }> {
        // Buscar próximo agendamento
        const nextAppointment = await this.prisma.appointment.findFirst({
            where: {
                userId: userId,
                dateTime: { gte: new Date() },
                status: { not: 'CANCELLED' }
            },
            orderBy: { dateTime: 'asc' }
        });

        if (!nextAppointment) {
            return { response: '🤔 Não encontrei agendamentos futuros para remarcar.\n\nDigite *Agendar* para marcar uma consulta!', startScheduling: false };
        }

        // FIX: Não cancelar agora! Apenas salvar ID para cancelar DEPOIS de confirmar o novo.
        // await this.prisma.appointment.update({ ... });

        const dateStr = format(nextAppointment.dateTime, "dd/MM 'às' HH:mm", { locale: ptBR });

        // Preparar contexto para novo agendamento com o mesmo serviço
        await this.context.updateContext(userId, conversationId, {
            schedulingStep: 'SELECT_DATE',
            selectedService: nextAppointment.service,
            selectedDay: undefined,
            selectedTime: undefined,
            rescheduleFromAppointmentId: nextAppointment.id // Salvar ID para cancelar depois
        });

        return {
            response: `🔄 Vamos remarcar sua consulta de *${nextAppointment.service}* (Dia *${dateStr}*).\n\n📅 Para qual **novo dia** você gostaria?`,
            startScheduling: true
        };
    }

    private async getOrCreateUser(phone: string, name?: string) {
        return this.prisma.user.upsert({ where: { phone }, update: name ? { name } : {}, create: { phone, name } });
    }
    private async getOrCreateConversation(userId: string) {
        const oneDayAgo = new Date(Date.now() - 864e5);
        let c = await this.prisma.conversation.findFirst({ where: { userId, state: { not: 'COMPLETED' }, updatedAt: { gte: oneDayAgo } } });
        return c || await this.prisma.conversation.create({ data: { userId, state: 'INIT' } });
    }
    private async saveMessage(conversationId: string, direction: 'INBOUND' | 'OUTBOUND', content: string, intent?: string) {
        return this.prisma.message.create({ data: { conversationId, direction, content, intent, processed: true } });
    }
    private async updateConversationState(id: string, state: ConversationState) {
        return this.prisma.conversation.update({ where: { id }, data: { state } });
    }

    // FEATURE: Lista de pacientes do dia para o Admin
    private async getAdminDailyAgenda(): Promise<string> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const appointments = await this.prisma.appointment.findMany({
            where: {
                dateTime: { gte: today, lt: tomorrow },
                status: { not: 'CANCELLED' }
            },
            include: { user: true },
            orderBy: { dateTime: 'asc' }
        });

        if (appointments.length === 0) {
            return `📋 *Agenda de Hoje*\n\n✅ Nenhum paciente agendado para hoje!`;
        }

        const dateStr = today.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });

        let response = `📋 *Agenda de Hoje - ${dateStr}*\n\n`;
        response += `📊 *${appointments.length} paciente(s) agendado(s):*\n\n`;

        appointments.forEach((apt, index) => {
            const time = apt.dateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const name = apt.user.name || 'Sem nome';
            const phone = apt.user.phone.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '');

            response += `${index + 1}. *${time}* - ${name}\n`;
            response += `   📱 ${phone}\n`;
            response += `   🏥 ${apt.service}\n\n`;
        });

        response += `\n_Gerado automaticamente pelo ZapBot_`;

        return response;
    }

    // FEATURE: Lista de pacientes da SEMANA para o Admin
    private async getAdminWeekAgenda(): Promise<string> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(today);
        endOfWeek.setDate(endOfWeek.getDate() + 7);

        const appointments = await this.prisma.appointment.findMany({
            where: {
                dateTime: { gte: today, lt: endOfWeek },
                status: { not: 'CANCELLED' }
            },
            include: { user: true },
            orderBy: { dateTime: 'asc' }
        });

        if (appointments.length === 0) {
            return `📅 *Agenda da Semana*\n\n✅ Nenhum paciente agendado para os próximos 7 dias!`;
        }

        let response = `📅 *Agenda da Semana* (próximos 7 dias)\n\n`;
        response += `📊 *${appointments.length} paciente(s) agendado(s):*\n\n`;

        let currentDate = '';
        appointments.forEach((apt) => {
            const dateStr = apt.dateTime.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
            const time = apt.dateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const name = apt.user.name || 'Sem nome';

            if (dateStr !== currentDate) {
                currentDate = dateStr;
                response += `\n📆 *${dateStr}*\n`;
            }
            response += `   • ${time} - ${name} (${apt.service})\n`;
        });

        response += `\n_Gerado automaticamente pelo ZapBot_`;
        return response;
    }

    // FEATURE: Lista de pacientes do MÊS para o Admin
    private async getAdminMonthAgenda(): Promise<string> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

        const appointments = await this.prisma.appointment.findMany({
            where: {
                dateTime: { gte: today, lte: endOfMonth },
                status: { not: 'CANCELLED' }
            },
            include: { user: true },
            orderBy: { dateTime: 'asc' }
        });

        const monthName = today.toLocaleDateString('pt-BR', { month: 'long' });

        if (appointments.length === 0) {
            return `📅 *Agenda de ${monthName}*\n\n✅ Nenhum paciente agendado para o restante do mês!`;
        }

        let response = `📅 *Agenda de ${monthName}*\n\n`;
        response += `📊 *${appointments.length} paciente(s) agendado(s):*\n\n`;

        let currentDate = '';
        appointments.forEach((apt) => {
            const dateStr = apt.dateTime.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
            const time = apt.dateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const name = apt.user.name || 'Sem nome';

            if (dateStr !== currentDate) {
                currentDate = dateStr;
                response += `\n📆 *${dateStr}*\n`;
            }
            response += `   • ${time} - ${name} (${apt.service})\n`;
        });

        response += `\n_Gerado automaticamente pelo ZapBot_`;
        return response;
    }

    // FEATURE: Lista de pacientes por DATA ESPECÍFICA para o Admin
    private async getAdminAgendaByDate(targetDate: Date): Promise<string> {
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const appointments = await this.prisma.appointment.findMany({
            where: {
                dateTime: { gte: startOfDay, lte: endOfDay },
                status: { not: 'CANCELLED' }
            },
            include: { user: true },
            orderBy: { dateTime: 'asc' }
        });

        const dateStr = targetDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });

        if (appointments.length === 0) {
            return `📋 *Agenda - ${dateStr}*\n\n✅ Nenhum paciente agendado para esta data!`;
        }

        let response = `📋 *Agenda - ${dateStr}*\n\n`;
        response += `📊 *${appointments.length} paciente(s) agendado(s):*\n\n`;

        appointments.forEach((apt, index) => {
            const time = apt.dateTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const name = apt.user.name || 'Sem nome';
            const phone = apt.user.phone.replace('@s.whatsapp.net', '').replace('@c.us', '').replace('@lid', '');

            response += `${index + 1}. *${time}* - ${name}\n`;
            response += `   📱 ${phone}\n`;
            response += `   🏥 ${apt.service}\n\n`;
        });

        response += `\n_Gerado automaticamente pelo ZapBot_`;
        return response;
    }
    // Placeholder methods removed to use real implementations


    // FEATURE 1: Gerar pergunta de esclarecimento quando confiança é baixa
    // VERSÃO MELHORADA: Fallback inteligente com CTAs para fluxos do bot
    private generateClarificationQuestion(originalMessage: string, userName?: string | null): string {
        const name = userName ? userName.split(' ')[0] : '';
        const greeting = name ? `${name}, ` : '';

        // Analisar mensagem para dar dica contextual
        const msgLower = originalMessage.toLowerCase();

        // Fallbacks contextuais baseados em palavras-chave parciais
        if (msgLower.includes('hora') || msgLower.includes('quando') || msgLower.includes('abr')) {
            return `${greeting}você quer saber nosso *horário de funcionamento*? 🕐\n\nOu prefere *agendar* uma consulta?`;
        }

        if (msgLower.includes('onde') || msgLower.includes('local') || msgLower.includes('end')) {
            return `${greeting}quer saber o *endereço* da clínica? 📍\n\nDigite *endereço* que te mostro!`;
        }

        if (msgLower.includes('preç') || msgLower.includes('valor') || msgLower.includes('cust') || msgLower.includes('quant')) {
            return `${greeting}para informações sobre valores, digite *atendente* que conecto você! 💬`;
        }

        if (msgLower.includes('marc') || msgLower.includes('consult') || msgLower.includes('sess')) {
            return `${greeting}quer *agendar* uma consulta? 📅\n\nDigite *agendar* para começar!`;
        }

        // Fallbacks gerais variados (mais amigáveis)
        const generalFallbacks = [
            `${greeting}não entendi bem. 🤔\n\nVocê deseja:\n📅 *Agendar* consulta\n📋 *Listar Serviços*\nℹ️ *Info Consultas*\n🕐 *Horários* de funcionamento\n📍 *Endereço* da clínica\n🗣️ *Falar com Atendente*\n\nEscolha uma opção ou digite *Menu*!`,
            `${greeting}pode me explicar melhor? 😊\n\nPosso ajudar com:\n• Agendamentos\n• Informações\n\nQual você precisa?`,
            `${greeting}desculpe, não ficou claro para mim. 🙏\n\nDigite *Menu* para ver todas as opções ou me diga se quer *agendar* ou *falar com atendente*.`
        ];

        return generalFallbacks[Math.floor(Math.random() * generalFallbacks.length)];
    }

    private async notifyAdminHandoff(user: any, msg: IncomingMessage, settings: any, reason: string = 'Novo Atendimento Humano') {
        let adminPhone = settings.adminPhone;
        if (adminPhone) {
            let cleanPhone = adminPhone.replace(/\D/g, '');
            if (cleanPhone.length >= 10) {
                const targetId = `${cleanPhone}@s.whatsapp.net`;
                this.logger.log(`📤 Notificando admin no target: ${targetId}`);

                const clientName = user.name || 'Cliente';
                const clientPhone = msg.from.replace('@s.whatsapp.net', '').replace('@c.us', '');
                const adminNotification = `🔔 *${reason}*\n\nCliente: ${clientName}\nTelefone: ${clientPhone}\nMensagem: "${msg.body}"\n\n📲 Entre em contato com o cliente.`;

                const sent = await this.whatsapp.sendMessage(targetId, adminNotification);
                if (sent) this.logger.log(`✅ Notificação enviada.`);
                else this.logger.warn(`⚠️ Falha ao notificar admin.`);
            } else {
                this.logger.warn(`⚠️ adminPhone inválido: ${cleanPhone}`);
            }
        } else {
            this.logger.warn('⚠️ adminPhone não configurado nas settings');
        }
    }

    // FEATURE 12: Simulador (Sem WhatsApp)
    async simulateMessage(phone: string, content: string): Promise<any> {
        this.logger.log(`🎮 Simulando mensagem de ${phone}: ${content}`);

        // 1. Setup
        const user = await this.getOrCreateUser(phone, 'Test User');
        const conversation = await this.getOrCreateConversation(user.id);
        const context = await this.context.getContext(user.id, conversation.id);
        const settings = await this.settingsService.getAllSettings();

        let response: string | undefined;
        let intent: string | undefined = 'UNKNOWN';
        let confidence = 0;
        let newState: ConversationState = conversation.state;
        let debugInfo: any = {};

        // 2. Logic (Mirrors handleIncomingMessage)

        // Flow Control
        if (conversation.state === 'SCHEDULING_FLOW') {
            const result = await this.handleSchedulingFlow(content, context, user.id, conversation.id, settings);
            response = result.response;
            if (result.completed) newState = 'CONFIRMATION_PENDING';
            debugInfo.flowProcessed = true;
        }
        else if (conversation.state === 'CONFIRMATION_PENDING') {
            const result = await this.handleConfirmation(content, context, user.id);
            response = result.response;
            if (result.confirmed || result.cancelled) {
                newState = 'AUTO_ATTENDANCE';
                // Reset context logic omitted for brevity, assumes flow handles it or next cycle
            }
            debugInfo.flowProcessed = true;
        }
        else {
            // Small Talk
            const smallTalkResponse = this.humanize.handleSmallTalk(content);
            if (smallTalkResponse) {
                response = smallTalkResponse;
                intent = 'SMALL_TALK';
            }

            // Rules / AI
            if (!response) {
                const ruleResult = this.ruleEngine.process(content, settings);
                intent = ruleResult.intent || 'UNKNOWN';
                debugInfo.ruleMatched = ruleResult.matched;

                if (!ruleResult.matched) {
                    const analysis = await this.ai.analyzeMessage(content, context);
                    const aiIntent = analysis.intent;
                    const entities = analysis.entities;
                    confidence = analysis.confidence || 0;
                    debugInfo.aiAnalysis = analysis;

                    if (confidence < 60) {
                        intent = 'LOW_CONFIDENCE';
                        response = this.generateClarificationQuestion(content, user.name);
                    } else if (aiIntent && aiIntent !== 'UNKNOWN') {
                        intent = aiIntent;
                        const ir = this.ruleEngine.getResponseByIntent(aiIntent, settings, user.name);

                        // Smart Filling Simulation
                        if (aiIntent === 'SCHEDULE_NEW' && entities && entities.service) {
                            const contextUpdate: any = {
                                selectedService: entities.service,
                                schedulingStep: 'SELECT_DATE'
                            };
                            await this.context.updateContext(user.id, conversation.id, contextUpdate);
                            response = `📅 Entendi: ${entities.service}. Qual dia? (Simulação)`;
                            newState = 'SCHEDULING_FLOW';
                        } else {
                            response = ir;
                        }
                    }
                } else {
                    response = ruleResult.response;
                    confidence = 100;
                }
            }
        }

        // Fallback
        if (!response) {
            response = "Simulação: Não entendi. (Fallback)";
            intent = 'FALLBACK';
        }

        // State Update
        if (newState !== conversation.state) {
            await this.updateConversationState(conversation.id, newState);
        }

        return {
            response,
            intent,
            confidence,
            state: newState,
            context: await this.context.getContext(user.id, conversation.id),
            debug: debugInfo
        };
    }

    // --- Helper Methods for Availability ---

    private async getAvailableSlotsForDay(date: Date, settings: any): Promise<string[]> {
        const slots = settings.availableSlots || ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'];
        const workDays = settings.workDays || { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true };

        // 1. Check if day is enabled in settings
        const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayKey = dayMap[date.getDay()];

        if (workDays[dayKey] === false) {
            return [];
        }

        // 2. Fetch existing appointments from DB
        const start = startOfDay(date);
        const end = endOfDay(date);

        const appointments = await this.prisma.appointment.findMany({
            where: {
                dateTime: {
                    gte: start,
                    lte: end
                },
                status: {
                    not: 'CANCELLED'
                }
            }
        });

        // 3. Filter out booked slots
        // Normalizes DB time to HH:mm string to compare with slots
        const bookedTimes = appointments.map(apt => format(apt.dateTime, 'HH:mm'));

        // 4. FEATURE: Filter out blocked slots (admin blocks)
        const blockedSlots = await this.prisma.blockedSlot.findMany({
            where: {
                date: { gte: start, lte: end }
            }
        });

        // Check each slot against blocked time ranges
        const isBlocked = (slot: string): boolean => {
            for (const block of blockedSlots) {
                if (slot >= block.startTime && slot < block.endTime) {
                    return true;
                }
            }
            return false;
        };

        return slots.filter((slot: string) => !bookedTimes.includes(slot) && !isBlocked(slot));
    }

    private async findNextAvailableSlot(date: Date, settings: any, rejectedSlots: string[] = []): Promise<string | null> {
        const available = await this.getAvailableSlotsForDay(date, settings);
        // Retorna o primeiro que não foi rejeitado
        return available.find(slot => !rejectedSlots.includes(slot)) || null;
    }
}
