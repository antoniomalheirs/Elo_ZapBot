import { Injectable, Logger } from '@nestjs/common';

/**
 * Serviço de Detecção Rápida por Keywords
 * Detecta intenções usando regex/palavras-chave ANTES de chamar a IA
 * Muito mais rápido e não depende do Ollama estar disponível
 */
@Injectable()
export class KeywordDetectorService {
    private readonly logger = new Logger(KeywordDetectorService.name);

    // Mapa de intenções com seus padrões de keywords (case-insensitive)
    // VERSÃO EXPANDIDA: Muitos sinônimos, variações e erros de digitação comuns
    private readonly intentPatterns: Map<string, RegExp[]> = new Map([
        // ═══════════════════════════════════════════════════════════════
        // SAUDAÇÕES - Todas as formas de "oi" e cumprimentos
        // ═══════════════════════════════════════════════════════════════
        ['GREETING', [
            /^(oi|oii+|oie|oiee|olá|ola|hey|ei|eii|eae|e ai|eaí|opa|oi+e?)$/i,
            /^(bom dia|boa tarde|boa noite|bom dio|boa tardi|boa noiti)$/i,
            /^(oi|olá|ola|hey|opa).{0,15}$/i,
            /^(fala|salve|suave|eai|iae|falaaa|iai|iaee)$/i,
            /^(hello|hi|hy|helo)$/i,
            /^(tudo bem|td bem|tdb|tudo bom|como vai)[\?\!]?$/i,
            /^(opa|opaa|opaaa)$/i,
        ]],

        // ═══════════════════════════════════════════════════════════════
        // MENU / AJUDA - Pedidos de informação geral
        // ═══════════════════════════════════════════════════════════════
        ['HELP', [
            /\b(menu|opções|opcoes|opçoes|ajuda|help|socorro)\b/i,
            /\b(o que (você|vc|voce|tu) faz|como funciona|comandos)\b/i,
            /^(menu|ajuda|\?|help|\?)$/i,
            /\b(quais são as opções|que opções tem|me ajuda)\b/i,
            /\b(como (uso|usar)|pode me ajudar|me orienta)\b/i,
            /\b(não entendi|nao entendi|n entendi|to perdid[oa]|tou perdid[oa])\b/i,
            /\b(o que posso fazer|oque posso fazer|oq posso fazer)\b/i,
            /\b(inicio|início|voltar|começo|início|ir pro início)\b/i,
        ]],

        // ═══════════════════════════════════════════════════════════════
        // AGENDAR CONSULTA - Pedidos de agendamento
        // ═══════════════════════════════════════════════════════════════
        ['SCHEDULE_NEW', [
            // Verbos de agendar
            /\b(agendar|marcar|agenda|marca|quero agendar|quero marcar)\b/i,
            /\b(preciso (de |)(uma |um |)?(consulta|sessão|sessao|atendimento))\b/i,
            /\b(quero (uma |um |)?(consulta|sessão|sessao|horário|horario))\b/i,
            /\b(gostaria de (agendar|marcar|uma consulta))\b/i,
            // Perguntas sobre disponibilidade
            /\b(horários?|horarios?) (disponíveis?|disponiveis?|livres?|vagos?)\b/i,
            /\b(tem (horário|horario|vaga|disponibilidade))\b/i,
            /\b(agenda livre|tem vaga|disponibilidade)\b/i,
            /\b(pode me encaixar|encaixa|encaixar)\b/i,
            // Serviços específicos
            /\b(terapia|psicoterapia|psico|psicologo|psicologa)\b/i,
            /\b(avaliação|avaliaçao|avaliacao|teste|qi|neuropsico)\b/i,
            /\b(atendimento|tratamento|acompanhamento)\b/i,
            // Dias e horários (contexto de agendamento)
            /\b(quero|preciso|posso).{0,20}(segunda|terça|quarta|quinta|sexta|sabado|domingo)\b/i,
            /\b(consulta|sessão|sessao|horário).{0,15}(manhã|manha|tarde|noite)\b/i,
            // Formas coloquiais
            /\b(bora marcar|vamo marcar|marca pra mim|agenda ai|agenda aí)\b/i,
            /\b(pode ser|tem como|da pra|dá pra).{0,15}(agendar|marcar|consulta)\b/i,
        ]],

        // ═══════════════════════════════════════════════════════════════
        // REMARCAR - Pedidos de remarcação
        // ═══════════════════════════════════════════════════════════════
        ['RESCHEDULE', [
            /\b(remarcar?|remarca|reagendar?|reagenda)\b/i,
            /\b(alterar?|altera|mudar?|muda|trocar?|troca)\s*(a |de |minha |)?(data|horário|horario|dia|consulta)\b/i,
            /\b(adiar?|adia|antecipar?|antecipa)\s*(a |minha |)?(consulta|sessão|sessao)\b/i,
            /\b(preciso (mudar|trocar|alterar) (a |o |)(data|horário|horario|dia))\b/i,
            /\b(posso (mudar|trocar|remarcar))\b/i,
            /\b(quero (mudar|trocar|outro) (horário|horario|dia))\b/i,
            /\b(tem como (mudar|remarcar|trocar))\b/i,
            /\b(muda pra|troca pra|passa pra)\b/i,
        ]],

        // ═══════════════════════════════════════════════════════════════
        // VER AGENDAMENTOS - Consultar seus agendamentos
        // ═══════════════════════════════════════════════════════════════
        ['VIEW_APPOINTMENTS', [
            /\b(minhas?\s*consultas?|meus?\s*agendamentos?)\b/i,
            /\b(quando\s*(é|e|seria)\s*minha\s*consulta)\b/i,
            /\b(ver|consultar|checar|visualizar)\s*(minha|meus|as|os)?\s*(consultas?|agendamentos?)\b/i,
            /\b(que dia|qual dia|que horas)\s*(é|e|seria)?\s*(minha\s*consulta|meu\s*agendamento)\b/i,
            /\b(tenho\s*consulta|tenho\s*agendamento|tenho\s*marcado)\b/i,
            /\b(qual\s*(é|e)\s*minha?\s*(próxima?|proxima?)\s*consulta)\b/i,
            /\b(ja\s*tenho|já\s*tenho)\s*(consulta|agendamento|algo\s*marcado)\b/i,
        ]],

        // ═══════════════════════════════════════════════════════════════
        // FAQ - HORÁRIOS DE FUNCIONAMENTO
        // ═══════════════════════════════════════════════════════════════
        ['FAQ_HOURS', [
            /\b(horário|horario)s?\s*de\s*(funcionamento|atendimento)\b/i,
            /\b(que\s*horas?|quando)\s*(abre|fecha|funciona|atende|começa|termina)\b/i,
            /\b(abre|funciona|atende)\s*(no|nos|de|aos?)?\s*(sábado|sabado|domingo|feriado|fim\s*de\s*semana)\b/i,
            /\b(até\s*que\s*horas?|ate\s*que\s*horas?)\b/i,
            /\b(abre\s*cedo|fecha\s*tarde|horário\s*comercial)\b/i,
            /\b(qual\s*(é|e)\s*o\s*horário|quais\s*são\s*os\s*horários)\b/i,
            /\b(funciona\s*(de|das)\s*\d{1,2}\s*(às|as|ate|até)\s*\d{1,2})\b/i,
        ]],

        // ═══════════════════════════════════════════════════════════════
        // FAQ - PREÇOS E VALORES
        // ═══════════════════════════════════════════════════════════════
        ['FAQ_PRICE', [
            /\b(quanto\s*custa|qual\s*(é|e|o)?\s*valor|preço|preco|valores?)\b/i,
            /\b(tabela\s*de\s*preços?|tabela\s*de\s*valores?)\b/i,
            /\b(quanto\s*(é|e|fica|sai|cobra[mns]?))\b/i,
            /\b(caro|barato|desconto|promoção|promocao|oferta)\b/i,
            /\b(forma\s*de\s*pagamento|como\s*pagar?|pix|cartão|cartao)\b/i,
            /\b(parcela|parcelamento|parcelar?)\b/i,
            /\b(valor\s*(da|de|do)\s*(consulta|sessão|sessao|terapia|avaliação))\b/i,
            /\b(custa\s*quanto|sai\s*quanto|fica\s*quanto)\b/i,
            /\b(investimento|custo)\b/i,
        ]],

        // ═══════════════════════════════════════════════════════════════
        // FAQ - SERVIÇOS OFERECIDOS
        // ═══════════════════════════════════════════════════════════════
        ['FAQ_SERVICES', [
            /\b(quais?\s*(são|sao)?\s*(os|as)?\s*(serviços|servicos))\b/i,
            /\b(o\s*que\s*(vocês|voces|vcs|a\s*clínica)\s*(fazem|oferecem|tem))\b/i,
            /\b(tipos?\s*de\s*(terapia|atendimento|tratamento|serviço))\b/i,
            /\b(especialidades?|tratamentos?|modalidades?)\b/i,
            /\b(trata\s*(de|o\s*que)|atende\s*(o\s*que|quais?\s*casos?))\b/i,
            /\b(trabalham?\s*com\s*(o\s*que|quais?))\b/i,
            /\b(quais?\s*terapias?|que\s*tipos?\s*de\s*atendimento)\b/i,
        ]],

        // ═══════════════════════════════════════════════════════════════
        // FAQ - LOCALIZAÇÃO E ENDEREÇO
        // ═══════════════════════════════════════════════════════════════
        ['FAQ_LOCATION', [
            /\b(onde\s*(fica|é|e|vocês?\s*ficam?))\b/i,
            /\b(qual\s*(é|e|o)?\s*endereço|endereco|localização|localizacao)\b/i,
            /\b(como\s*(chego|chegar|ir|vou))\b/i,
            /\b(mapa|maps|waze|google\s*maps|uber|99)\b/i,
            /\b(fica\s*(onde|aonde)|qual\s*bairro|qual\s*rua|perto\s*de\s*que)\b/i,
            /\b(tem\s*estacionamento|estacionar|parar\s*o\s*carro)\b/i,
            /\b(endereço\s*da\s*clínica|localização\s*da\s*clínica)\b/i,
            /\b(manda\s*(o\s*)?endereço|passa\s*(o\s*)?endereço)\b/i,
            /\b(referência|referencia|ponto\s*de\s*referência)\b/i,
        ]],

        // ═══════════════════════════════════════════════════════════════
        // FAQ - CONVÊNIO E PLANO DE SAÚDE
        // ═══════════════════════════════════════════════════════════════
        ['FAQ_INSURANCE', [
            /\b(convênio|convenio|plano\s*(de\s*saúde|de\s*saude)?)\b/i,
            /\b(aceita[mn]?|atende[mn]?|trabalha[mn]?\s*com)\s*(convênio|convenio|plano)\b/i,
            /\b(unimed|bradesco\s*saúde?|amil|sulamérica|sulamerica|hapvida|notredame|notre\s*dame)\b/i,
            /\b(particular|sem\s*convênio|sem\s*plano|só\s*particular)\b/i,
            /\b(meu\s*plano|meu\s*convênio)\b/i,
            /\b(reembolso|reembolsar?)\b/i,
        ]],

        // ═══════════════════════════════════════════════════════════════
        // FALAR COM HUMANO - Pedir atendimento humano
        // ═══════════════════════════════════════════════════════════════
        ['HUMAN_REQUEST', [
            /\b(atendente|humano|pessoa|gente|alguém|alguem|ser\s*humano)\b/i,
            /\b(falar\s*com\s*(alguém|alguem|pessoa|humano|atendente|recepcionista))\b/i,
            /\b(quero\s*(falar|conversar)\s*com)\b/i,
            /\b(não\s*(é|e)\s*bot|robô|robo|máquina|maquina)\b/i,
            /\b(atendimento\s*humano|suporte\s*humano)\b/i,
            /\b(passa\s*pra|transfere\s*pra|me\s*transfere)\b/i,
            /\b(chamar?(r)?\s*(alguém|alguem)|liga\s*pra\s*mim)\b/i,
            /\b(você\s*(é|e)\s*(um\s*)?bot|vc\s*(é|e)\s*bot|tu\s*(é|e)\s*robo)\b/i,
            /\b(quero\s*pessoa\s*de\s*verdade|gente\s*de\s*verdade)\b/i,
        ]],

        // ═══════════════════════════════════════════════════════════════
        // EMERGÊNCIA - Situações urgentes (PRIORIDADE ALTA)
        // ═══════════════════════════════════════════════════════════════
        ['EMERGENCY', [
            /\b(emergência|emergencia|urgente|urgência|urgencia)\b/i,
            /\b(crise|pânico|panico|ataque\s*de\s*pânico|ataque\s*de\s*panico)\b/i,
            /\b(me\s*ajuda|socorro|por\s*favor\s*me\s*ajuda)\b/i,
            /\b(não\s*aguento|nao\s*aguento|n\s*aguento|to\s*mal|tou\s*mal)\b/i,
            /\b(suicídio|suicidio|quero\s*morrer|vontade\s*de\s*morrer|me\s*matar)\b/i,
            /\b(ansiedade\s*forte|muito\s*ansios[oa]|surto|surtando)\b/i,
            /\b(depressão\s*forte|depressao\s*forte|muito\s*deprimid[oa])\b/i,
            /\b(não\s*sei\s*o\s*que\s*fazer|nao\s*sei\s*o\s*que\s*fazer|desesperado)\b/i,
            /\b(preciso\s*de\s*ajuda\s*(urgente|agora|rapido))\b/i,
            /\b(machucando|me\s*cortando|autolesão|autolesao)\b/i,
        ]],

        // ═══════════════════════════════════════════════════════════════
        // AGRADECIMENTO - Obrigado em várias formas
        // ═══════════════════════════════════════════════════════════════
        ['THANKS', [
            /\b(obrigad[oa]|muito\s*obrigad[oa]|brigadão|brigadao|vlw|valeu)\b/i,
            /\b(agradeço|agradeco|grato|grata|gratidão|gratidao)\b/i,
            /\b(thanks|thank\s*you|thx|ty)\b/i,
            /^(obrigad[oa]|valeu|vlw|thanks|brigado|brigada)[\!\.]?$/i,
            /\b(foi\s*(muito\s*)?(bom|otimo|ótimo)|ajudou\s*(muito|demais|bastante))\b/i,
            /\b(top|show|massa|perfeito|excelente)\b/i,
        ]],

        // ═══════════════════════════════════════════════════════════════
        // CONFIRMAÇÃO - Respostas afirmativas
        // ═══════════════════════════════════════════════════════════════
        ['CONFIRMATION', [
            /^(sim|s|sí|si|ss|simm|siim|yes|yeah|yep|yea)[\!\.]?$/i,
            /^(ok|okay|okk|okey|ta|tá|tah)[\!\.]?$/i,
            /^(beleza|blz|bele|bele te|fechou|feito)[\!\.]?$/i,
            /^(pode\s*ser|pode|bora|vamo|vamos|isso|iss|isso\s*mesmo)[\!\.]?$/i,
            /^(confirmo|confirmado|afirmativo|positivo|claro)[\!\.]?$/i,
            /^(certo|exato|correto|perfeito|massa|top|show)[\!\.]?$/i,
            /^(👍|✅|✔️|👌|🙏|💯)$/,
            /\b(sim,?\s*(pode|quero|confirmo|por\s*favor|pfv|pf))\b/i,
            /^(com\s*certeza|certeza|lógico|logico|obvio|óbvio)[\!\.]?$/i,
            /^(aceito|concordo|combinado)[\!\.]?$/i,
        ]],

        // ═══════════════════════════════════════════════════════════════
        // NEGAÇÃO - Respostas negativas
        // ═══════════════════════════════════════════════════════════════
        ['DENIAL', [
            /^(não|nao|n|nn|noo|naoo|no|nope|nah)[\!\.]?$/i,
            /^(nunca|nenhum|negativo|nada|nem)[\!\.]?$/i,
            /^(cancel|cancela|para|parar)[\!\.]?$/i,
            /\b(não\s*(quero|preciso|vou|é\s*isso)|nao\s*(quero|preciso|vou))\b/i,
            /\b(desisto|deixa\s*(pra|para)\s*lá)\b/i,
            /^(👎|❌|✖️|🙅|🙅‍♀️|🙅‍♂️)$/,
            /\b(acho\s*que\s*não|talvez\s*não|melhor\s*não)\b/i,
            /^(agora\s*não|depois|outra\s*hora)[\!\.]?$/i,
            /\b(sair|sai|voltar|volta|cancelar)\b/i,
        ]],
    ]);

    /**
     * Detecta intenção baseada em keywords
     * Retorna null se nenhuma intenção foi detectada com confiança
     */
    detectIntent(message: string): { intent: string; confidence: number } | null {
        if (!message || message.trim().length === 0) {
            return null;
        }

        const normalizedMsg = this.normalizeText(message);
        this.logger.debug(`🔍 Analisando: "${normalizedMsg}"`);

        // Verificar cada padrão
        for (const [intent, patterns] of this.intentPatterns) {
            for (const pattern of patterns) {
                if (pattern.test(normalizedMsg)) {
                    // Calcular confiança baseada na especificidade do match
                    const confidence = this.calculateConfidence(normalizedMsg, pattern, intent);

                    if (confidence >= 70) { // Só retorna se tiver boa confiança
                        this.logger.log(`⚡ Keyword Match: ${intent} (${confidence}% confiança)`);
                        return { intent, confidence };
                    }
                }
            }
        }

        // Detecção especial para dias da semana (para agendamento)
        const dayMatch = this.detectDayOfWeek(normalizedMsg);
        if (dayMatch) {
            return { intent: 'SCHEDULE_NEW', confidence: 75 };
        }

        // Detecção de horário (para agendamento)
        const timeMatch = this.detectTime(normalizedMsg);
        if (timeMatch) {
            return { intent: 'SCHEDULE_NEW', confidence: 70 };
        }

        return null; // Não detectou com confiança suficiente
    }

    /**
     * Normaliza texto para comparação
     */
    private normalizeText(text: string): string {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove acentos
            .replace(/[^\w\sáéíóúãõâêîôûàèìòù]/g, '') // Remove pontuação mantendo acentos básicos
            .trim();
    }

    /**
     * Calcula confiança baseada no tipo de match
     */
    private calculateConfidence(message: string, pattern: RegExp, intent: string): number {
        const matchResult = message.match(pattern);
        if (!matchResult) return 0;

        const matchedText = matchResult[0];
        const messageLength = message.length;
        const matchLength = matchedText.length;

        // Se o match cobre a maior parte da mensagem, alta confiança
        const coverage = matchLength / messageLength;

        // Intenções que precisam de match exato têm boost
        const exactMatchIntents = ['GREETING', 'CONFIRMATION', 'DENIAL', 'THANKS'];
        const isExactMatch = exactMatchIntents.includes(intent);

        let confidence = 70; // Base

        if (coverage > 0.8) confidence += 20; // Match cobre maior parte
        else if (coverage > 0.5) confidence += 10;

        if (isExactMatch && coverage > 0.6) confidence += 10; // Boost para exatos

        // Penalidade para mensagens muito longas com match pequeno
        if (messageLength > 50 && coverage < 0.3) confidence -= 20;

        return Math.min(100, Math.max(0, confidence));
    }

    /**
     * Detecta menção de dia da semana
     */
    private detectDayOfWeek(message: string): string | null {
        const days = [
            { pattern: /\b(segunda|segunda-feira|seg)\b/i, day: 'Segunda-feira' },
            { pattern: /\b(terça|terca|terça-feira|terca-feira|ter)\b/i, day: 'Terça-feira' },
            { pattern: /\b(quarta|quarta-feira|qua)\b/i, day: 'Quarta-feira' },
            { pattern: /\b(quinta|quinta-feira|qui)\b/i, day: 'Quinta-feira' },
            { pattern: /\b(sexta|sexta-feira|sex)\b/i, day: 'Sexta-feira' },
            { pattern: /\b(sábado|sabado|sab)\b/i, day: 'Sábado' },
            { pattern: /\b(domingo|dom)\b/i, day: 'Domingo' },
            { pattern: /\b(hoje)\b/i, day: 'Hoje' },
            { pattern: /\b(amanhã|amanha)\b/i, day: 'Amanhã' },
        ];

        for (const { pattern, day } of days) {
            if (pattern.test(message)) {
                return day;
            }
        }
        return null;
    }

    /**
     * Detecta menção de horário
     */
    private detectTime(message: string): string | null {
        const timePatterns = [
            /\b(\d{1,2})\s*(h|hrs?|horas?)\b/i, // "15h", "10 horas"
            /\b(\d{1,2}):(\d{2})\b/, // "15:00"
            /\bàs?\s*(\d{1,2})/i, // "às 15"
        ];

        for (const pattern of timePatterns) {
            const match = message.match(pattern);
            if (match) {
                return match[0];
            }
        }
        return null;
    }

    /**
     * Extrai entidades de uma mensagem (serviço, dia, horário)
     */
    extractEntities(message: string): { service?: string; day?: string; time?: string } {
        const entities: { service?: string; day?: string; time?: string } = {};

        // Detectar serviço
        const servicePatterns = [
            { pattern: /\b(terapia individual|terapia)\b/i, service: 'Terapia Individual' },
            { pattern: /\b(avaliação|avaliaçao|avaliacao)\s*(psicológica|psicologica)?\b/i, service: 'Avaliação Psicológica' },
            { pattern: /\b(orientação|orientaçao|orientacao)\s*(vocacional)?\b/i, service: 'Orientação Vocacional' },
            { pattern: /\b(casal|terapia de casal)\b/i, service: 'Terapia de Casal' },
            { pattern: /\b(infantil|criança|crianca|criancas)\b/i, service: 'Psicoterapia Infantil' },
        ];

        for (const { pattern, service } of servicePatterns) {
            if (pattern.test(message)) {
                entities.service = service;
                break;
            }
        }

        // Detectar dia
        const day = this.detectDayOfWeek(message);
        if (day) entities.day = day;

        // Detectar horário
        const time = this.detectTime(message);
        if (time) entities.time = time;

        return entities;
    }
}
