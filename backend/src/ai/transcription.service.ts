import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import * as fs from 'fs';

@Injectable()
export class TranscriptionService {
    private readonly logger = new Logger(TranscriptionService.name);
    private genAI: GoogleGenerativeAI;
    private model: GenerativeModel;

    constructor(private readonly config: ConfigService) {
        const apiKey = this.config.get<string>('GEMINI_API_KEY');
        if (apiKey) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        } else {
            this.logger.error('❌ GEMINI_API_KEY hianyet! Transcrição não funcionará.');
        }
    }

    /**
     * Transcreve um arquivo de áudio usando Google Gemini
     */
    async transcribe(audioPath: string): Promise<string> {
        if (!this.model) {
            this.logger.error('❌ Modelo Gemini não inicializado. Verifique a API Key.');
            return '';
        }

        try {
            this.logger.log(`🎙️ Enviando áudio para Gemini: ${audioPath}`);

            // Ler arquivo
            if (!fs.existsSync(audioPath)) {
                this.logger.error(`❌ Arquivo de áudio não encontrado: ${audioPath}`);
                return '';
            }

            const audioBuffer = fs.readFileSync(audioPath);
            const base64Audio = audioBuffer.toString('base64');

            // Tentar determinar mime type simples (WhatsApp geralmente é ogg ou m4a)
            // Gemini aceita audio/ogg, audio/mp3, audio/wav, audio/aiff, audio/aac, audio/flac
            let mimeType = 'audio/ogg';
            if (audioPath.endsWith('.mp3')) mimeType = 'audio/mp3';
            if (audioPath.endsWith('.wav')) mimeType = 'audio/wav';
            if (audioPath.endsWith('.m4a')) mimeType = 'audio/m4a';
            if (audioPath.endsWith('.aac')) mimeType = 'audio/aac';

            const result = await this.model.generateContent([
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Audio
                    }
                },
                { text: "Transcreva este áudio exatamente como falado. Se não houver fala, responda com string vazia." }
            ]);

            const text = result.response.text();
            this.logger.log(`📝 Transcrição Gemini: "${text}"`);

            // Limpar arquivo original para economizar espaço
            try {
                fs.unlinkSync(audioPath);
            } catch (e) {
                this.logger.warn(`⚠️ Erro ao deletar arquivo temporário: ${e}`);
            }

            return text.trim();

        } catch (error) {
            this.logger.error(`❌ Erro na transcrição Gemini: ${error}`);
            return '';
        }
    }
}
