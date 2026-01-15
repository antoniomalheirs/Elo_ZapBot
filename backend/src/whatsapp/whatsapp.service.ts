import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TranscriptionService } from '../ai/transcription.service';
import { VisionService } from '../ai/vision.service';
import * as fs from 'fs';
import * as path from 'path';
import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    WASocket,
    proto,
    downloadMediaMessage,
} from '@whiskeysockets/baileys';
// @ts-ignore - no types available for qrcode-terminal
import * as qrcode from 'qrcode-terminal';
import pino from 'pino';

export interface IncomingMessage {
    from: string;        // Phone number
    fromId: string;      // Full ID for replying
    contactName: string; // Nome do WhatsApp do usuário
    body: string;
    timestamp: Date;
    messageId: string;
    hasMedia: boolean;
    type: string;
    isFromMe: boolean;  // FEATURE: Agent First Rule
}

@Injectable()
export class WhatsAppService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(WhatsAppService.name);
    private sock: WASocket | null = null;
    private isReady = false;
    public currentQrCode: string | null = null;
    private sessionPath: string;

    // Callback para processar mensagens (será injetado pelo Orquestrador)
    private messageHandler: ((msg: IncomingMessage) => Promise<string | null>) | null = null;

    // FEATURE: Debounce de mensagens - espera 2s antes de processar
    private pendingMessages: Map<string, { msg: proto.IWebMessageInfo; timeout: NodeJS.Timeout }> = new Map();
    private readonly DEBOUNCE_DELAY = 2000; // 2 segundos

    // FEATURE: Watchdog (Cão de Guarda) 🐕
    private watchdogInterval: NodeJS.Timeout | null = null;
    private lastConnectionUpdate: Date = new Date();

    constructor(
        private readonly prisma: PrismaService,
        private readonly transcriptionService: TranscriptionService,
        private readonly visionService: VisionService
    ) {
        this.sessionPath = path.resolve(process.cwd(), '.baileys_auth');
        this.logger.log(`📁 Configurando Sessão Baileys em: ${this.sessionPath}`);
    }

    async onModuleInit() {
        await this.initialize();
    }

    async onModuleDestroy() {
        this.logger.log('🛑 Fechando sessão do WhatsApp gracefully...');
        try {
            if (this.sock) {
                this.sock.end(undefined);
            }
            this.logger.log('✅ Sessão encerrada com sucesso.');
        } catch (error) {
            this.logger.error(`❌ Erro ao fechar sessão: ${error}`);
        }
        this.stopWatchdog();
    }

    private isInitializing = false;

    private async initialize() {
        // PREVENÇÃO DE CORRIDA: Se já estiver inicializando, não faz nada
        if (this.isInitializing) {
            this.logger.warn('⚠️ Tentativa de inicialização duplicada ignorada (Já em andamento).');
            return;
        }

        // CLEANUP: Garantir que não existam sockets órfãos (Isso causava erro 440 de conflito)
        if (this.sock) {
            this.logger.log('♻️ Fechando socket anterior antes de reinicializar...');
            try { this.sock.end(undefined); } catch (e) { }
            this.sock = undefined as any;
        }

        this.isInitializing = true;
        this.lastConnectionUpdate = new Date(); // FIX: Resetar timer para evitar Watchdog prematuro durante boot

        try {
            this.logger.log('🚀 Inicializando cliente WhatsApp (Baileys)...');

            // Criar pasta de sessão se não existir
            if (!fs.existsSync(this.sessionPath)) {
                fs.mkdirSync(this.sessionPath, { recursive: true });
            }

            // Carregar estado de autenticação
            const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);

            // Criar socket do WhatsApp
            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: false, // Vamos gerar nosso próprio QR
                logger: pino({ level: 'silent' }), // Silenciar logs do Baileys
                browser: ['ZapBot', 'Chrome', '122.0.0'], // Identificação do browser
                connectTimeoutMs: 60000,
                defaultQueryTimeoutMs: 60000,
            });

            // Handler de atualização de conexão
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr } = update;

                // QR Code recebido
                if (qr) {
                    this.currentQrCode = qr;
                    this.logger.log('📱 Escaneie o QR Code abaixo para conectar:');
                    qrcode.generate(qr, { small: true });
                }

                // Conexão estabelecida
                if (connection === 'open') {
                    this.currentQrCode = null;
                    this.isReady = true;
                    this.logger.log('✅ WhatsApp conectado com sucesso!');
                    // this.startWatchdog(); // FIX: Reativar Watchdog após conexão estável
                }
                this.lastConnectionUpdate = new Date();

                // Conexão fechada
                if (connection === 'close') {
                    this.isReady = false;
                    const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                    this.logger.warn(`⚠️ WhatsApp desconectado. Código: ${statusCode}`);

                    if (shouldReconnect) {
                        this.logger.log('🔄 Tentando reconectar em 5 segundos...');
                        setTimeout(() => this.initialize(), 5000);
                    } else {
                        this.logger.warn('🔓 Sessão invalidada (logout). Precisa escanear QR novamente.');
                        // Limpar sessão antiga
                        try {
                            fs.rmSync(this.sessionPath, { recursive: true, force: true });
                            fs.mkdirSync(this.sessionPath, { recursive: true });
                        } catch (e) {
                            // Ignorar erros de limpeza
                        }
                        setTimeout(() => this.initialize(), 2000);
                    }
                }
            });

            // Salvar credenciais quando atualizadas
            this.sock.ev.on('creds.update', saveCreds);

            // Handler de mensagens recebidas com DEBOUNCE
            this.sock.ev.on('messages.upsert', async (m) => {
                if (m.type !== 'notify') return;

                for (const msg of m.messages) {
                    const remoteJid = msg.key.remoteJid || '';

                    // FEATURE: Agent First - Não ignorar 'fromMe' se for chat com usuário
                    // Mas ignorar se for broadcast ou status
                    if (remoteJid === 'status@broadcast' || remoteJid.includes('@g.us')) continue;

                    // Cancelar timeout anterior do mesmo usuário (debounce)
                    const pending = this.pendingMessages.get(remoteJid);
                    if (pending) {
                        clearTimeout(pending.timeout);
                        this.logger.log(`⏱️ Debounce: Cancelando mensagem anterior de ${remoteJid}`);
                    }

                    // Agendar processamento após delay
                    const timeout = setTimeout(async () => {
                        this.pendingMessages.delete(remoteJid);
                        await this.handleIncomingMessage(msg);
                    }, this.DEBOUNCE_DELAY);

                    this.pendingMessages.set(remoteJid, { msg, timeout });
                }
            });

        } catch (error) {
            this.logger.error(`❌ Erro ao inicializar WhatsApp: ${error}`);
            this.logger.warn('⚠️ Tentando novamente em 5 segundos...');
            setTimeout(() => this.initialize(), 5000);
        } finally {
            // Liberar flag apenas se NÃO for um reload agendado por erro (para evitar duplo finally)
            // Mas aqui o setTimeout é assíncrono, então podemos liberar.
            this.isInitializing = false;
        }
    }

    private async handleIncomingMessage(msg: proto.IWebMessageInfo) {
        try {
            // Check essential data
            if (!msg.key) return;

            const isFromMe = msg.key.fromMe || false;
            const remoteJid = msg.key.remoteJid || '';

            // Filters
            if (remoteJid === 'status@broadcast') return;
            if (remoteJid?.includes('@g.us')) return;

            // FIX CRÍTICO: Extrair número de telefone REAL, não LID
            // Baileys fornece campos "Alt" com o número real quando o principal é LID
            let phoneNumber: string;

            // 1. Tentar pegar do remoteJidAlt (campo com número real para chats individuais)
            // @ts-ignore - Campo existe mas tipo pode não estar definido
            const remoteJidAlt = msg.key.remoteJidAlt;
            // @ts-ignore
            const participantAlt = msg.key.participantAlt;

            if (remoteJidAlt && remoteJidAlt.includes('@s.whatsapp.net')) {
                // Melhor caso: temos o número real no campo Alt
                phoneNumber = remoteJidAlt.replace('@s.whatsapp.net', '').replace('@c.us', '');
                this.logger.log(`📱 Número real extraído de remoteJidAlt: ${phoneNumber}`);
            } else if (participantAlt && participantAlt.includes('@s.whatsapp.net')) {
                // Segundo melhor: participantAlt tem o número
                phoneNumber = participantAlt.replace('@s.whatsapp.net', '').replace('@c.us', '');
                this.logger.log(`📱 Número real extraído de participantAlt: ${phoneNumber}`);
            } else if (remoteJid.includes('@lid')) {
                // LID format sem Alt disponível
                this.logger.warn(`⚠️ Recebido LID sem Alt disponível: ${remoteJid}`);
                const participant = msg.key.participant;
                if (participant && participant.includes('@s.whatsapp.net')) {
                    phoneNumber = participant.replace('@s.whatsapp.net', '');
                } else {
                    // Fallback: remover @lid e logar para debug
                    phoneNumber = remoteJid.replace('@lid', '');
                    this.logger.warn(`⚠️ Usando LID como fallback: ${phoneNumber} (LOG PARA DEBUG)`);
                }
            } else {
                // Formato normal @s.whatsapp.net
                phoneNumber = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');
            }

            // Extrair texto da mensagem
            let body = '';
            const messageContent = msg.message;

            if (messageContent?.conversation) {
                body = messageContent.conversation;
            } else if (messageContent?.extendedTextMessage?.text) {
                body = messageContent.extendedTextMessage.text;
            } else if (messageContent?.audioMessage) {
                // Audio message - tentar transcrever
                try {
                    this.logger.log(`🎙️ Áudio recebido de ${phoneNumber}. Baixando e transcrevendo...`);
                    // @ts-ignore - Baileys type issue
                    const buffer = await downloadMediaMessage(msg, 'buffer', {});

                    const tempDir = path.join(__dirname, '../../temp');
                    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

                    const fileName = `audio_${Date.now()}_${phoneNumber}.ogg`;
                    const filePath = path.join(tempDir, fileName);
                    fs.writeFileSync(filePath, buffer as Buffer);

                    const text = await this.transcriptionService.transcribe(filePath);
                    if (text && text.length > 0) {
                        this.logger.log(`✅ Transcrição obtida: "${text}"`);
                        body = text;
                    } else {
                        body = '[Áudio não compreendido]';
                    }
                } catch (err) {
                    this.logger.error(`❌ Erro ao processar áudio: ${err}`);
                    body = '[Erro ao processar áudio]';
                }
            } else if (messageContent?.imageMessage) {
                // FEATURE: Análise de imagens com Gemini Vision + Confiança
                try {
                    this.logger.log(`🖼️ Imagem recebida de ${phoneNumber}. Analisando...`);

                    // @ts-ignore - Baileys type issue
                    const buffer = await downloadMediaMessage(msg, 'buffer', {});
                    const mimeType = messageContent.imageMessage.mimetype || 'image/jpeg';

                    // Analisar imagem com Vision AI (retorna { description, confidence, category })
                    const analysis = await this.visionService.analyzeImage(buffer as Buffer, mimeType);

                    // Combinar legenda (se houver) com a descrição da imagem
                    const caption = messageContent.imageMessage.caption || '';

                    if (analysis.description && analysis.confidence > 0) {
                        // Formatar body com informações de confiança para o Orquestrador
                        const confidenceTag = analysis.confidence >= 80 ? '' : ` (confiança: ${analysis.confidence}%)`;
                        body = caption
                            ? `[Imagem/${analysis.category}: ${analysis.description}${confidenceTag}] Legenda: ${caption}`
                            : `[Imagem/${analysis.category}: ${analysis.description}${confidenceTag}]`;

                        this.logger.log(`✅ Imagem analisada: "${analysis.description.substring(0, 50)}..." (${analysis.confidence}%, ${analysis.category})`);
                    } else {
                        // Fallback: usar só a legenda
                        body = caption || '[Imagem recebida - não foi possível analisar]';
                    }
                } catch (err) {
                    this.logger.error(`❌ Erro ao processar imagem: ${err}`);
                    body = messageContent.imageMessage.caption || '[Erro ao processar imagem]';
                }
            } else if (messageContent?.videoMessage) {
                body = messageContent.videoMessage.caption || '[Vídeo recebido]';
            } else if (messageContent?.documentMessage) {
                body = '[Documento recebido]';
            } else {
                // Tipo de mensagem não suportado
                return;
            }

            if (!body || body.trim() === '') return;

            const pushName = msg.pushName || 'Sem nome';
            const timestamp = msg.messageTimestamp
                ? new Date(Number(msg.messageTimestamp) * 1000)
                : new Date();

            const incomingMessage: IncomingMessage = {
                from: phoneNumber,
                fromId: remoteJid,
                contactName: pushName,
                body: body,
                timestamp: timestamp,
                messageId: msg.key?.id || '',
                hasMedia: !!(messageContent?.audioMessage || messageContent?.imageMessage || messageContent?.videoMessage || messageContent?.documentMessage),
                type: Object.keys(messageContent || {})[0] || 'text',
                isFromMe: isFromMe
            };

            this.logger.log(`📨 [DEBUG] Mensagem recebida de ${phoneNumber}: ${body}`);

            // Se houver um handler registrado, processar a mensagem
            if (this.messageHandler) {
                const response = await this.messageHandler(incomingMessage);
                if (response) {
                    await this.sendMessage(remoteJid, response);
                }
            } else {
                this.logger.warn('⚠️ Nenhum handler de mensagens registrado no WhatsAppService');
            }
        } catch (error) {
            this.logger.error(`❌ Erro ao processar mensagem recebida: ${error}`);
        }
    }

    // Registrar o handler de mensagens (chamado pelo Orquestrador)
    setMessageHandler(handler: (msg: IncomingMessage) => Promise<string | null>) {
        this.messageHandler = handler;
        this.logger.log('✅ Handler de mensagens registrado');
    }

    // Enviar mensagem
    async sendMessage(chatId: string, message: string): Promise<boolean> {
        if (!this.isReady || !this.sock) {
            this.logger.warn('⚠️ WhatsApp não está conectado. Aguardando até 10s...');

            let attempts = 0;
            while ((!this.isReady || !this.sock) && attempts < 20) {
                await new Promise(r => setTimeout(r, 500));
                attempts++;
            }

            if (!this.isReady || !this.sock) {
                this.logger.error('❌ WhatsApp não está conectado após espera.');
                return false;
            }
        }

        // Bloquear envio para grupos
        if (chatId.includes('@g.us')) {
            this.logger.debug(`👥 Bloqueado envio para grupo: ${chatId}`);
            return false;
        }

        try {
            // Simular digitação
            await this.sock.presenceSubscribe(chatId);
            await this.sock.sendPresenceUpdate('composing', chatId);

            // Delay baseado no tamanho da mensagem
            const baseDelay = 800;
            const charDelay = 20;
            const maxDelay = 3500;
            const typingDelay = Math.min(baseDelay + (message.length * charDelay), maxDelay);
            await new Promise(resolve => setTimeout(resolve, typingDelay));

            // Parar de digitar
            await this.sock.sendPresenceUpdate('paused', chatId);

            // Parar de digitar
            await this.sock.sendPresenceUpdate('available', chatId);

            await this.sock.sendMessage(chatId, { text: message });
            return true;
        } catch (error) {
            this.logger.error(`❌ Erro ao enviar mensagem: ${error}`);
            return false;
        }
    }

    // --- WATCHDOG SYSTEM ---
    private startWatchdog() {
        if (this.watchdogInterval) clearInterval(this.watchdogInterval);

        this.logger.log('🐕 Watchdog iniciado: monitorando conexão...');

        this.watchdogInterval = setInterval(async () => {
            const now = new Date();
            const diff = now.getTime() - this.lastConnectionUpdate.getTime(); // Em ms

            // 1. Verificar se socket existe
            if (!this.sock) {
                this.logger.warn('🐕 Watchdog: Socket perdido (null). Reiniciando...');
                await this.initialize();
                return;
            }

            // 2. Verificar estado do WebSocket (se disponível)
            // @ts-ignore - Acesso interno ao WS
            const wsState = this.sock.ws?.readyState;
            const isOpen = wsState === 1; // 1 = OPEN

            if (isOpen) {
                // Se está aberto, atualizamos o timestamp para não expirar
                this.lastConnectionUpdate = new Date();
                return;
            }

            // 3. Se não está aberto e passou muito tempo (> 5 min) sem update, reinicia
            if (diff > 5 * 60 * 1000) {
                this.logger.error(`🐕 Watchdog: Conexão travada (Diff: ${diff}ms, State: ${wsState}). Reiniciando...`);
                await this.initialize();
            }
        }, 60000); // Checar a cada minuto
    }

    private stopWatchdog() {
        if (this.watchdogInterval) {
            clearInterval(this.watchdogInterval);
            this.watchdogInterval = null;
        }
    }

    // Verificar status da conexão
    isConnected(): boolean {
        return this.isReady;
    }

    // Obter estado da conexão
    async getConnectionState(): Promise<string> {
        return this.isReady ? 'CONNECTED' : 'DISCONNECTED';
    }

    // Obter informações do cliente conectado
    async getInfo() {
        if (!this.isReady || !this.sock) return null;
        return {
            pushname: this.sock.user?.name,
            wid: this.sock.user?.id,
            platform: 'Baileys',
        };
    }

    // Obter QR Code atual (para Admin Panel)
    getQrCode(): string | null {
        return this.currentQrCode;
    }

    // Desconectar WhatsApp
    async disconnect(): Promise<boolean> {
        try {
            if (this.sock) {
                await this.sock.logout();
            }
            this.isReady = false;
            this.currentQrCode = null;
            this.logger.log('🔌 WhatsApp desconectado pelo Admin');
            return true;
        } catch (error: any) {
            this.logger.error(`❌ Erro ao desconectar: ${error}`);
            return false;
        }
    }

    // Reconectar (reinicializar cliente)
    async reconnect(): Promise<boolean> {
        try {
            if (this.sock) {
                this.sock.end(undefined);
            }
            await this.initialize();
            return true;
        } catch (error) {
            this.logger.error(`❌ Erro ao reconectar: ${error}`);
            return false;
        }
    }
}
