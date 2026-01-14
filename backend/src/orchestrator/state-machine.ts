import { Injectable, Logger } from '@nestjs/common';
import { ConversationState } from '@prisma/client';

// Definição dos estados e transições válidas
export interface StateTransition {
    from: ConversationState;
    to: ConversationState;
    event: string;
    guard?: () => boolean;
}

@Injectable()
export class StateMachine {
    private readonly logger = new Logger(StateMachine.name);

    // Transições válidas do sistema
    private readonly transitions: StateTransition[] = [
        // INIT -> (primeiro contato pode ir para qualquer fluxo)
        { from: 'INIT', to: 'AUTO_ATTENDANCE', event: 'FIRST_MESSAGE' },
        { from: 'INIT', to: 'AUTO_ATTENDANCE', event: 'FAQ_DETECTED' },  // FAQ no primeiro contato
        { from: 'INIT', to: 'SCHEDULING_FLOW', event: 'SCHEDULING_INTENT' },  // Agendamento direto
        { from: 'INIT', to: 'HUMAN_HANDOFF', event: 'HANDOFF_REQUESTED' },  // Escalar direto
        { from: 'INIT', to: 'BLOCKED', event: 'USER_BLOCKED' },

        // AUTO_ATTENDANCE ->
        { from: 'AUTO_ATTENDANCE', to: 'FAQ_FLOW', event: 'FAQ_DETECTED' },
        { from: 'AUTO_ATTENDANCE', to: 'SCHEDULING_FLOW', event: 'SCHEDULING_INTENT' },
        { from: 'AUTO_ATTENDANCE', to: 'HUMAN_HANDOFF', event: 'HANDOFF_REQUESTED' },
        { from: 'AUTO_ATTENDANCE', to: 'PAUSED', event: 'OUT_OF_HOURS' },
        { from: 'AUTO_ATTENDANCE', to: 'COMPLETED', event: 'CONVERSATION_END' },

        // FAQ_FLOW ->
        { from: 'FAQ_FLOW', to: 'AUTO_ATTENDANCE', event: 'FAQ_ANSWERED' },
        { from: 'FAQ_FLOW', to: 'SCHEDULING_FLOW', event: 'SCHEDULING_INTENT' },
        { from: 'FAQ_FLOW', to: 'HUMAN_HANDOFF', event: 'HANDOFF_REQUESTED' },

        // SCHEDULING_FLOW ->
        { from: 'SCHEDULING_FLOW', to: 'CONFIRMATION_PENDING', event: 'AWAITING_CONFIRMATION' },
        { from: 'SCHEDULING_FLOW', to: 'AUTO_ATTENDANCE', event: 'SCHEDULING_CANCELLED' },
        { from: 'SCHEDULING_FLOW', to: 'HUMAN_HANDOFF', event: 'HANDOFF_REQUESTED' },

        // CONFIRMATION_PENDING ->
        { from: 'CONFIRMATION_PENDING', to: 'AUTO_ATTENDANCE', event: 'CONFIRMED' },
        { from: 'CONFIRMATION_PENDING', to: 'SCHEDULING_FLOW', event: 'REJECTED' },
        { from: 'CONFIRMATION_PENDING', to: 'AUTO_ATTENDANCE', event: 'TIMEOUT' },

        // HUMAN_HANDOFF ->
        { from: 'HUMAN_HANDOFF', to: 'AUTO_ATTENDANCE', event: 'HANDOFF_COMPLETE' },
        { from: 'HUMAN_HANDOFF', to: 'COMPLETED', event: 'CONVERSATION_END' },

        // PAUSED ->
        { from: 'PAUSED', to: 'AUTO_ATTENDANCE', event: 'IN_HOURS' },
        { from: 'PAUSED', to: 'HUMAN_HANDOFF', event: 'URGENT_MESSAGE' },

        // BLOCKED -> (terminal)
        // COMPLETED -> pode reiniciar
        { from: 'COMPLETED', to: 'INIT', event: 'NEW_MESSAGE' },
    ];

    /**
     * Verifica se uma transição é válida
     */
    canTransition(from: ConversationState, to: ConversationState): boolean {
        return this.transitions.some(t => t.from === from && t.to === to);
    }

    /**
     * Obtém o próximo estado baseado no evento
     */
    getNextState(currentState: ConversationState, event: string): ConversationState | null {
        const transition = this.transitions.find(
            t => t.from === currentState && t.event === event
        );

        if (!transition) {
            this.logger.warn(`⚠️ Transição inválida: ${currentState} + ${event}`);
            return null;
        }

        // Verificar guard se existir
        if (transition.guard && !transition.guard()) {
            this.logger.warn(`⚠️ Guard bloqueou transição: ${currentState} -> ${transition.to}`);
            return null;
        }

        this.logger.log(`🔄 Transição: ${currentState} -> ${transition.to} (evento: ${event})`);
        return transition.to;
    }

    /**
     * Lista todos os eventos válidos para um estado
     */
    getValidEvents(state: ConversationState): string[] {
        return this.transitions
            .filter(t => t.from === state)
            .map(t => t.event);
    }

    /**
     * Verifica se é um estado terminal
     */
    isTerminalState(state: ConversationState): boolean {
        return state === 'BLOCKED';
    }

    /**
     * Obtém o estado inicial
     */
    getInitialState(): ConversationState {
        return 'INIT';
    }
}
