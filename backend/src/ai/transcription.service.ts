import { Injectable, Logger } from '@nestjs/common';
import { pipeline } from '@xenova/transformers';
import * as fs from 'fs';
import * as path from 'path';
import * as ffmpeg from 'fluent-ffmpeg';

@Injectable()
export class TranscriptionService {
    private readonly logger = new Logger(TranscriptionService.name);
    private transcriber: any = null;
    private readonly modelName = 'Xenova/whisper-tiny'; // Modelo leve para CPU

    constructor() {
        this.initializeModel();
    }

    /**
     * Inicializa o modelo Whisper (carregamento lazy)
     */
    private async initializeModel() {
        try {
            this.logger.log(`📥 Carregando modelo Whisper (${this.modelName})...`);
            // @ts-ignore
            this.transcriber = await pipeline('automatic-speech-recognition', this.modelName);
            this.logger.log('✅ Modelo Whisper carregado com sucesso!');
        } catch (error) {
            this.logger.error(`❌ Erro ao carregar Whisper: ${error}`);
        }
    }

    /**
     * Transcreve um arquivo de áudio (OGG/MP3/WAV) para texto
     */
    async transcribe(audioPath: string): Promise<string> {
        if (!this.transcriber) {
            await this.initializeModel();
        }

        try {
            // Converter para WAV se necessário (Whisper prefere WAV @ 16kHz)
            const wavPath = await this.convertToWav(audioPath);

            this.logger.log(`🎙️ Transcrevendo áudio: ${wavPath}`);
            const result = await this.transcriber(wavPath, {
                language: 'portuguese',
                task: 'transcribe'
            });

            // Limpar arquivo temporário WAV se criado
            if (wavPath !== audioPath && fs.existsSync(wavPath)) {
                fs.unlinkSync(wavPath);
            }

            const text = result.text?.trim() || '';
            this.logger.log(`📝 Transcrição: "${text}"`);
            return text;

        } catch (error) {
            this.logger.error(`❌ Erro na transcrição: ${error}`);
            return '';
        }
    }

    /**
     * Converte arquivo audio para WAV 16kHz usando ffmpeg
     */
    private convertToWav(inputPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const outputPath = inputPath.replace(path.extname(inputPath), '.wav');

            ffmpeg(inputPath)
                .toFormat('wav')
                .audioFrequency(16000)
                .on('end', () => resolve(outputPath))
                .on('error', (err) => reject(err))
                .save(outputPath);
        });
    }
}
