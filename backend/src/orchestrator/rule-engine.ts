import { Injectable, Logger } from '@nestjs/common';

export interface RuleResult {
    matched: boolean;
    intent?: string;
    response?: string;
    event?: string;
    priority: number;
}

export interface Rule {
    id: string;
    name: string;
    priority: number;
    keywords: string[];
    patterns?: RegExp[];
    intent: string;
    response?: string;
    event?: string;
    isActive: boolean;
}

@Injectable()
export class RuleEngine {
    private readonly logger = new Logger(RuleEngine.name);

    /**
     * Gera as regras dinamicamente com base nas configurações atuais
     */
    private buildRules(settings: any): Rule[] {
        const therapyPrice = settings.priceTherapy || '150';
        const evalPrice = settings.priceEvaluation || '800';
        const openTime = settings.openTime || '09:00';
        const closeTime = settings.closeTime || '18:00';
        const address = settings.clinicAddress || 'Rua Principal, 123 - Centro';
        const clinicName = settings.clinicName || 'Nossa Clínica';

        // FEATURE 7: Gerar regras dinâmicas a partir das FAQs cadastradas
        const dynamicFaqRules: Rule[] = (settings.faqs || [])
            .filter((faq: any) => faq && faq.question && faq.answer && faq.keywords)
            .map((faq: any, index: number) => ({
                id: `custom_faq_${faq.id || index}`,
                name: `FAQ: ${faq.question.substring(0, 30)}...`,
                priority: 35, // Entre FAQ padrão e respostas genéricas
                keywords: faq.keywords.split(',').map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length > 0),
                intent: `CUSTOM_FAQ_${faq.id || index}`,
                event: 'FAQ_DETECTED',
                response: faq.answer,
                isActive: true,
            }));

        const services = settings.services || [
            { name: 'Terapia Individual', price: 150 },
            { name: 'Avaliação Psicológica', price: 800 }
        ];
        // Filter out services that might have been deleted or empty
        const validServices = services.filter((s: any) => s && s.name);
        const servicesList = validServices.map((s: any) => `• ${s.name.trim()}`).join('\n');

        const staticRules: Rule[] = [
            // === REGRAS CRÍTICAS ===
            {
                id: 'emergency',
                name: 'Emergência',
                priority: 100,
                keywords: ['urgente', 'emergência', 'emergencia', 'urgencia', 'socorro', 'ajuda urgente'],
                intent: 'EMERGENCY',
                event: 'HANDOFF_REQUESTED',
                response: '🚨 Identificamos uma situação urgente. Um atendente humano entrará em contato em breve.',
                isActive: true,
            },
            {
                id: 'human_request',
                name: 'Solicita Humano',
                priority: 95,
                keywords: ['falar com atendente', 'falar com humano', 'atendente humano', 'quero falar com alguém', 'pessoa real'],
                patterns: [
                    /(quero|gostaria|preciso)\s+(de\s+)?(falar|conversar)\s+(com\s+)?(alguém|atendente|humano|pessoa)/i,
                    /não\s+(quero|gostei|estou)\s+(falar|falando)\s+(com|do|da)\s+(robô|bot|ia)/i
                ],
                intent: 'HUMAN_REQUEST',
                event: 'HANDOFF_REQUESTED',
                response: '👤 Claro! Vou transferir você para nossa atendente. Aguarde um momento.',
                isActive: true,
            },
            {
                id: 'optout',
                name: 'Opt-out LGPD',
                priority: 90,
                keywords: ['parar de receber', 'sair da lista', 'não quero mais mensagens', 'me remova', 'cancelar inscrição'],
                intent: 'OPTOUT',
                event: 'USER_BLOCKED',
                response: '✅ Entendido. Você foi removido da nossa lista de mensagens.',
                isActive: true,
            },

            // === AGENDAMENTO ===
            {
                id: 'schedule_new',
                name: 'Agendar',
                priority: 60,
                keywords: ['agendar', 'marcar', 'quero agendar', 'fazer agendamento', 'marcar horário', 'gostaria de agendar', 'quero um horário', 'quero horário', 'horário de consulta', 'horário para consulta'],
                patterns: [
                    /(quero|gostaria|preciso|vou)\s+(de\s+)?(marcar|agendar|fazer)\s+(um\s+|uma\s+)?(horário|consulta|avaliação|sessão)/i,
                    /tem\s+(vaga|horário|livre|disponível)/i,
                    /(quero|gostaria|preciso)\s+(de\s+)?(um\s+|uma\s+)?(horário|hora)\s*(de|para)?\s*(consulta|atendimento)?/i,
                ],
                intent: 'SCHEDULE_NEW',
                event: 'SCHEDULING_INTENT',
                response: `📅 Vamos agendar sua consulta!\n\nNossos serviços:\n${servicesList}\n\nQual serviço você deseja ?`,
                isActive: true,
            },

            // === FAQ ===
            {
                id: 'faq_hours',
                name: 'Horário de Funcionamento',
                priority: 40,
                keywords: ['horário de funcionamento', 'horarios', 'horário', 'funciona', 'aberto', 'fechado', 'que horas abre', 'que horas fecha', 'a que horas'],
                patterns: [
                    /^hor[aá]rios?$/i, // Só "horário" ou "horários" sozinho
                    /ver hor[aá]rios?(?! de consulta| para consulta| pra consulta)/i, // "ver horários" mas não "ver horários de consulta"
                ],
                intent: 'FAQ_HOURS',
                event: 'FAQ_DETECTED',
                response: `A ${clinicName} funciona todos os dias da semana, segunda a sexta.\n\nHorários:\n• ${openTime} ☀️ às ${closeTime} 🌕`,
                isActive: true,
            },
            {
                id: 'faq_location',
                name: 'Localização',
                priority: 40,
                keywords: ['endereço', 'endereco', 'onde fica', 'localização', 'localizacao', 'como chegar', 'onde vocês ficam', 'onde vcs ficam', 'cidade', 'município', 'municipio'],
                intent: 'FAQ_LOCATION',
                event: 'FAQ_DETECTED',
                response: `📍 Estamos localizados na: ${address}${settings.clinicCity ? ` - ${settings.clinicCity}` : ''}\n\n🗺️ Ver no Mapa: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address + (settings.clinicCity ? ' ' + settings.clinicCity : ''))}`,
                isActive: true,
            },

            // === GESTÃO DE CONSULTAS (Prioridade 55-59) ===
            {
                id: 'cancel_appointment',
                name: 'Cancelar Consulta',
                priority: 58,
                keywords: ['cancelar', 'cancelar consulta', 'desmarcar', 'cancelamento', 'quero cancelar', 'preciso cancelar'],
                intent: 'CANCEL_APPOINTMENT',
                event: 'CANCEL_FLOW',
                response: 'Para cancelar um agendamento, por favor entre em contato com nossa secretaria ou digite "Falar com atendente".', // Placeholder enquanto fluxo automático não é implementado
                isActive: true,
            },
            {
                id: 'reschedule_appointment',
                name: 'Remarcar Consulta',
                priority: 65, // MAIOR que Agendar (60) para capturar "reagendar" primeiro
                keywords: ['remarcar', 'reagendar', 'quero remarcar', 'quero reagendar', 'mudar horário', 'trocar dia', 'adiar', 'antecipar', 'remarcação', 'mudar data', 'trocar horário'],
                patterns: [
                    /(quero|preciso|vou|gostaria)\s+(de\s+)?(remarcar|reagendar)/i,
                    /(remarcar|reagendar)\s+(a\s+|minha\s+)?(consulta|sessão|sessao)?/i,
                ],
                intent: 'RESCHEDULE', // Usar o mesmo intent que o handler espera
                event: 'RESCHEDULE_REQUEST',
                response: undefined, // Tratado dinamicamente pelo Orchestrator
                isActive: true,
            },
            {
                id: 'view_appointments',
                name: 'Ver Consultas',
                priority: 56,
                keywords: ['minhas consultas', 'meus agendamentos', 'ver consultas', 'consultas agendadas', 'tenho consulta', 'quando é minha consulta'],
                intent: 'VIEW_APPOINTMENTS',
                event: 'VIEW_APPOINTMENTS',
                response: undefined, // Tratado dinamicamente pelo Orchestrator para mostrar consultas reais
                isActive: true,
            },
            {
                id: 'info_consultas',
                name: 'Info Consultas',
                priority: 50,
                keywords: ['info consultas', 'informações sobre consultas', 'como ver consultas', 'como remarcar', 'ajuda agendamento', 'comandos'],
                intent: 'INFO_CONSULTAS',
                event: 'INFO_REQUESTED',
                response: `ℹ️ *Gerenciamento de Consultas*\n\nVocê pode usar os seguintes comandos:\n\n📅 *Ver Consultas*: Lista seus agendamentos futuros.\n🔄 *Remarcar*: Altera a data de um agendamento.\n\nDigite um dos comandos acima!`,
                isActive: true,
            },

            // === AJUDA GERAL ===
            {
                id: 'help_general',
                name: 'Ajuda Geral',
                priority: 30,
                keywords: ['ajuda', 'ajudar', 'orienta', 'socorro', 'duvida', 'dúvida', 'opções', 'menu'],
                intent: 'HELP',
                event: 'MENU_REQUESTED',
                response: `🏥 *${clinicName}*\n\nBem-vindo(a)!\n\nMenu:\n📅 *Agendar Consulta*\n📋 *Listar Serviços*\nℹ️ *Info Consultas*\n🕐 *Horários*\n📍 *Endereço/Mapa*\n👤 *Falar com Atendente* (Valores/Informações)\n\nDigite uma das opções!`,
                isActive: true,
            },
            {
                id: 'faq_services',
                name: 'Serviços',
                priority: 40,
                keywords: ['serviços', 'servicos', 'o que vocês fazem', 'que serviços', 'quais serviços', 'opções'],
                intent: 'FAQ_SERVICES',
                event: 'FAQ_DETECTED',
                response: `💼 Serviços: \n\n${servicesList}\n\nDigite *Agendamento* para consultas`,
                isActive: true,
            },
            {
                id: 'faq_price',
                name: 'Preços',
                priority: 40,
                keywords: ['preço', 'preco', 'valor', 'quanto custa', 'tabela de preços', 'orçamento', 'quanto', 'custo', 'valores'],
                intent: 'FAQ_PRICE',
                event: 'FAQ_DETECTED',
                response: `💰 Para informações detalhadas sobre valores e formas de pagamento, por favor, converse com nossa secretaria.\n\nDigite *Atendente* para ser transferido!`,
                isActive: true,
            },
            {
                id: 'faq_insurance',
                name: 'Convênio',
                priority: 40,
                keywords: ['convênio', 'convenio', 'plano de saúde', 'plano de saude', 'unimed', 'bradesco saúde'],
                intent: 'FAQ_INSURANCE',
                event: 'FAQ_DETECTED',
                response: `❌ Infelizmente não trabalhamos com convênios.\n\nAceitamos Dinheiro e PIX.`,
                isActive: true,
            },

            // === SAUDAÇÕES ===
            {
                id: 'greeting',
                name: 'Saudação',
                priority: 20,
                keywords: ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'eai'],
                intent: 'GREETING',
                event: 'FIRST_MESSAGE',
                response: `Olá! Você está falando com a *${clinicName}* , sou a secretária virtual. Estou à disposição para ajudar com agendamentos, informações e outros assuntos. Digite *Menu* para ver todas as opções!`,
                isActive: true,
            },
            {
                id: 'thanks',
                name: 'Agradecimento',
                priority: 15,
                keywords: ['obrigado', 'obrigada', 'valeu', 'agradeço', 'muito obrigado'],
                intent: 'THANKS',
                event: 'CONVERSATION_END',
                response: '😊 Por nada! Se precisar de mais alguma coisa, é só chamar.',
                isActive: true,
            },
            {
                id: 'confirmation',
                name: 'Confirmação',
                priority: 10,
                keywords: ['sim', 'isso', 'correto', 'confirmo', 'pode ser', 'ok', 'beleza', 'combinado'],
                intent: 'CONFIRMATION',
                event: 'USER_CONFIRMED',
                response: undefined, // Tratado pelo fluxo de confirmação
                isActive: true,
            },
            {
                id: 'denial',
                name: 'Negação',
                priority: 10,
                keywords: ['não', 'nao', 'cancela', 'deixa pra lá', 'esquece', 'não quero'],
                intent: 'DENIAL',
                event: 'USER_DENIED',
                response: 'Ok, sem problemas! Se precisar de algo, é só chamar. 🙂',
                isActive: true,
            },

            // === FEATURES AVANÇADAS ===
            {
                id: 'my_appointments',
                name: 'Meus Agendamentos',
                priority: 45,
                keywords: ['meus agendamentos', 'minhas consultas', 'o que tenho marcado', 'ver agendamentos', 'listar minhas consultas'],
                intent: 'MY_APPOINTMENTS',
                event: 'VIEW_APPOINTMENTS',
                response: undefined, // Tratado dinamicamente pelo Orchestrator
                isActive: true,
            },
            {
                id: 'reschedule',
                name: 'Remarcar',
                priority: 48,
                keywords: ['remarcar', 'reagendar', 'trocar dia', 'mudar horário', 'alterar consulta'],
                intent: 'RESCHEDULE',
                event: 'RESCHEDULE_REQUEST',
                response: undefined, // Tratado dinamicamente pelo Orchestrator
                isActive: true,
            },
        ];

        // FEATURE 7: Combinar regras estáticas com FAQs dinâmicos
        return [...staticRules, ...dynamicFaqRules];
    }

    /**
     * Processa uma mensagem e retorna a regra que mais se aplica
     */
    process(message: string, settings: any = {}): RuleResult {
        const normalizedMessage = this.normalizeMessage(message);
        const rules = this.buildRules(settings);

        // Ordenar regras por prioridade (maior primeiro)
        const sortedRules = rules
            .filter(r => r.isActive)
            .sort((a, b) => b.priority - a.priority);

        for (const rule of sortedRules) {
            // Verificar keywords (NORMALIZADAS)
            // Agora normalizamos a keyword também para garantir match (endereço -> endereco)
            const keywordMatch = rule.keywords.some(keyword =>
                normalizedMessage.includes(this.normalizeMessage(keyword))
            );

            // Verificar patterns (regex)
            const patternMatch = rule.patterns?.some(pattern =>
                pattern.test(normalizedMessage)
            );

            if (keywordMatch || patternMatch) {
                this.logger.log(`✅ Regra "${rule.name}" ativada para: "${message}"`);

                return {
                    matched: true,
                    intent: rule.intent,
                    response: rule.response || undefined,
                    event: rule.event,
                    priority: rule.priority,
                };
            }
        }

        // Nenhuma regra encontrada
        this.logger.log(`❓ Nenhuma regra encontrada para: "${message}"`);
        return {
            matched: false,
            priority: 0,
        };
    }

    private normalizeMessage(message: string): string {
        return message
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .trim();
    }

    // FEATURE 5: Personalize responses with user name
    getResponseByIntent(intent: string, settings: any = {}, userName?: string | null): string | undefined {
        const rules = this.buildRules(settings);
        const rule = rules.find(r => r.intent === intent);
        let response = rule?.response;

        // Adicionar saudação personalizada se tiver nome
        if (response && userName) {
            // Para algumas respostas, adicionar nome no início
            if (['FAQ_HOURS', 'FAQ_PRICE', 'FAQ_LOCATION', 'FAQ_SERVICES'].includes(intent)) {
                response = `${userName}, ${response.charAt(0).toLowerCase()}${response.slice(1)}`;
            }
        }
        return response;
    }

    getEventByIntent(intent: string): string | undefined {
        const rules = this.buildRules({});
        const rule = rules.find(r => r.intent === intent);
        return rule?.event;
    }
}
