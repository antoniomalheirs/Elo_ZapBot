import { Injectable, Logger } from '@nestjs/common';

/**
 * HumanizeService - Torna as respostas do bot mais naturais e humanas
 * Features: Response variations, time greetings, empathy, small talk, fluency
 */
@Injectable()
export class HumanizeService {
    private readonly logger = new Logger(HumanizeService.name);

    // FEATURE 2: Variações de resposta para evitar repetição
    private readonly variations = {
        confirmations: [
            'Claro!', 'Com certeza!', 'Pode deixar!', 'Certo!', 'Sem problemas!',
            'Tá certo!', 'Beleza!', 'Ok!', 'Perfeito!', 'Combinado!'
        ],
        acknowledgments: [
            'Entendi!', 'Compreendo.', 'Ah sim!', 'Hm, entendi!', 'Certo, entendi.',
            'Boa!', 'Legal!', 'Show!', 'Ótimo!'
        ],
        thanks: [
            '😊 Por nada!', 'Imagina!', 'De nada!', 'Disponha!', '🙂 Que isso!',
            'Por nada, estou aqui para ajudar!', 'Sem problemas!'
        ],
        farewells: [
            'Até mais!', 'Tchau! 👋', 'Até logo!', 'Qualquer coisa, é só chamar!',
            'Até a próxima! 😊', 'Foi um prazer ajudar!'
        ],
        help: [
            'Posso ajudar sim!', 'Claro, estou aqui para isso!', 'Com certeza posso ajudar!',
            'É para isso que estou aqui! 😊'
        ],
        // FEATURE 6: Conectores naturais
        connectors: [
            'Então, ', 'Olha só, ', 'Vamos lá: ', 'Bom, ', '', '', '' // alguns vazios para variar
        ]
    };

    // FEATURE 5: Respostas para small talk
    private readonly smallTalk = {
        howAreYou: [
            'Estou ótima, obrigada por perguntar! 😊 E você?',
            'Tudo bem sim! E contigo?',
            'Muito bem! Pronta para ajudar! E você, como está?',
            'Super bem! 🌟 Posso ajudar com algo?',
            'Tudo tranquilo por aqui! E aí, como posso te ajudar?'
        ],
        goodMorning: [
            'Bom dia! ☀️ Tudo bem?',
            'Bom dia! 🌞 Como posso ajudar?',
            'Bom dia! Espero que seu dia esteja sendo ótimo!'
        ],
        goodAfternoon: [
            'Boa tarde! ☀️ Como posso ajudar?',
            'Boa tarde! Tudo bem?',
            'Boa tarde! 😊 Em que posso ser útil?'
        ],
        goodEvening: [
            'Boa noite! 🌙 Como posso ajudar?',
            'Boa noite! Tudo bem?',
            'Boa noite! 😊 Posso ajudar com algo?'
        ]
    };

    // FEATURE 4: Palavras-chave de frustração/emoção
    private readonly emotionKeywords = {
        frustration: ['frustrado', 'irritado', 'chateado', 'bravo', 'raiva', 'porcaria', 'droga', 'difícil', 'não funciona', 'problema'],
        urgency: ['urgente', 'emergência', 'agora', 'já', 'rápido', 'dói', 'muito mal'],
        happiness: ['obrigado', 'maravilha', 'ótimo', 'perfeito', 'show', 'valeu', 'legal', 'incrível'],
        confusion: ['confuso', 'não entendi', 'como assim', 'que', 'hã', 'não sei']
    };

    // FEATURE 4: Respostas empáticas
    private readonly empathyResponses = {
        frustration: [
            'Entendo sua frustração e peço desculpas por qualquer inconveniente. ',
            'Lamento que você esteja passando por isso. ',
            'Sinto muito por essa situação. Vou fazer o possível para ajudar. '
        ],
        urgency: [
            'Entendo que é urgente! Vou te ajudar o mais rápido possível. ',
            'Compreendo a urgência. '
        ],
        confusion: [
            'Sem problemas, vou explicar melhor! ',
            'Entendo, vou ser mais claro. ',
            'Deixa eu explicar de outra forma. '
        ]
    };

    // ============ MÉTODOS PÚBLICOS ============

    /**
     * FEATURE 3: Retorna saudação baseada no horário atual
     */
    getTimeBasedGreeting(): string {
        const hour = new Date().getHours();

        if (hour >= 6 && hour < 12) {
            return this.pickRandom(this.smallTalk.goodMorning);
        } else if (hour >= 12 && hour < 18) {
            return this.pickRandom(this.smallTalk.goodAfternoon);
        } else {
            return this.pickRandom(this.smallTalk.goodEvening);
        }
    }

    /**
     * FEATURE 2: Retorna uma variação aleatória de confirmação
     */
    getConfirmation(): string {
        return this.pickRandom(this.variations.confirmations);
    }

    /**
     * FEATURE 2: Retorna uma variação aleatória de agradecimento
     */
    getThanksResponse(): string {
        return this.pickRandom(this.variations.thanks);
    }

    /**
     * FEATURE 2: Retorna uma variação de despedida
     */
    getFarewell(): string {
        return this.pickRandom(this.variations.farewells);
    }

    /**
     * FEATURE 6: Adiciona conector natural ao início da mensagem
     */
    addConnector(message: string): string {
        const connector = this.pickRandom(this.variations.connectors);
        return connector + message;
    }

    /**
     * FEATURE 5: Verifica se é small talk e retorna resposta
     * NOTA: Saudações (bom dia, boa tarde, boa noite, oi, olá) são tratadas pelo RuleEngine.
     * Aqui tratamos APENAS papo furado como "tudo bem?", "como vai?"
     */
    handleSmallTalk(message: string): string | null {
        const lower = message.toLowerCase().trim();

        // APENAS "Tudo bem?", "Como vai?", "Como você está?" - sem saudações!
        // Saudações são tratadas pelo RuleEngine com a persona da clínica.
        if (/^(tudo bem\??|como vai\??|como está\??|como você está\??|tá bem\??|vc tá bem\??)$/i.test(lower)) {
            return this.pickRandom(this.smallTalk.howAreYou);
        }

        return null; // Não é small talk
    }

    /**
     * FEATURE 4: Detecta emoção na mensagem e retorna prefixo empático
     */
    getEmpathyPrefix(message: string): string {
        const lower = message.toLowerCase();

        // Verificar frustração
        if (this.emotionKeywords.frustration.some(kw => lower.includes(kw))) {
            return this.pickRandom(this.empathyResponses.frustration);
        }

        // Verificar confusão (DESATIVADO: Causava falsos positivos com 'que', 'quero', etc)
        // if (this.emotionKeywords.confusion.some(kw => lower.includes(kw))) {
        //    return this.pickRandom(this.empathyResponses.confusion);
        // }

        // Verificar urgência
        if (this.emotionKeywords.urgency.some(kw => lower.includes(kw))) {
            return this.pickRandom(this.empathyResponses.urgency);
        }

        return ''; // Sem emoção detectada
    }

    /**
     * FEATURE 2+4+6: Humaniza uma resposta completa
     */
    humanize(response: string, originalMessage: string, options: { addConnector?: boolean; checkEmpathy?: boolean } = {}): string {
        let result = response;

        // FIX: Evitar prefixos duplos (Ex: "Vamos lá: Ok...")
        const start = response.trim().toLowerCase();
        const firstChar = response.trim().charAt(0);

        // Skip connectors for:
        // 1. Responses starting with common words that already have flow
        // 2. Responses starting with emojis (codepoint > 255 indicates non-ASCII/emoji)
        // 3. Responses starting with icons like 👤, 📅, 🔔, etc.
        const skipWords = ['ok', 'certo', 'entendi', 'olá', 'ola', 'bom', 'boa', 'perfeito', 'claro', 'com certeza'];
        const startsWithEmoji = firstChar.charCodeAt(0) > 127 || /^[\u{1F300}-\u{1F9FF}]/u.test(response.trim());

        if (skipWords.some(p => start.startsWith(p)) || startsWithEmoji) {
            options.addConnector = false;
        }

        // Adicionar prefixo empático se detectar emoção
        if (options.checkEmpathy !== false) {
            const empathy = this.getEmpathyPrefix(originalMessage);
            if (empathy) {
                result = empathy + result;
            }
        }

        // Adicionar conector natural (50% das vezes)
        if (options.addConnector !== false && Math.random() > 0.5) {
            result = this.addConnector(result);
        }

        return result;
    }

    // ============ UTILITÁRIOS ============

    private pickRandom<T>(arr: T[]): T {
        return arr[Math.floor(Math.random() * arr.length)];
    }
}
