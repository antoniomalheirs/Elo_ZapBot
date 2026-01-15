import { Injectable, Logger } from '@nestjs/common';
import { pipeline } from '@xenova/transformers';
import * as fs from 'fs';
import * as path from 'path';
import * as ffmpeg from 'fluent-ffmpeg';
import { WaveFile } from 'wavefile';

@Injectable()
export class TranscriptionService {
    private readonly logger = new Logger(TranscriptionService.name);
    private transcriber: any = null;
    private readonly modelName = 'Xenova/whisper-small'; // UPGRADED: Modelo mais preciso

    constructor() {
        this.initializeModel();
    }

    /**
     * Inicializa o modelo Whisper (carregamento lazy)
     */
    private async initializeModel() {
        try {
            this.logger.log(`📥 Carregando modelo Whisper (${this.modelName})...`);
            this.logger.log(`⚠️ Isso pode demorar alguns minutos na primeira vez (download ~500MB)...`);
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
            // Converter para WAV com redução de ruído
            const wavPath = await this.convertToWavWithNoiseReduction(audioPath);

            this.logger.log(`🎙️ Transcrevendo áudio: ${wavPath}`);

            // NODE.JS FIX: Ler WAV como Float32Array (AudioContext não existe no Node)
            const audioData = this.readWavAsFloat32(wavPath);

            const result = await this.transcriber(audioData, {
                language: 'portuguese',
                task: 'transcribe',
                sampling_rate: 16000,
                // Prompt de contexto para melhorar transcrição de vocabulário específico
                initial_prompt: 'Clínica de psicologia. Palavras-chave: consulta, agendamento, terapia, avaliação, remarcar, cancelar, horário, psicóloga, atendimento.'
            });

            // Limpar arquivo temporário WAV se criado
            if (wavPath !== audioPath && fs.existsSync(wavPath)) {
                fs.unlinkSync(wavPath);
            }
            // Limpar original também
            if (fs.existsSync(audioPath)) {
                fs.unlinkSync(audioPath);
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
     * Lê arquivo WAV e retorna Float32Array com samples normalizados
     */
    private readWavAsFloat32(wavPath: string): Float32Array {
        const buffer = fs.readFileSync(wavPath);
        const wav = new WaveFile(buffer);

        // Converter para 32-bit float se necessário
        wav.toBitDepth('32f');

        // Extrair samples e converter para Float32Array
        const samples = wav.getSamples(false, Float32Array);
        // getSamples pode retornar Float64Array, então convertemos explicitamente
        return new Float32Array(samples as unknown as ArrayLike<number>);
    }

    /**
     * Converte arquivo audio para WAV 16kHz COM processamento avançado
     * Filtros: Redução de ruído, remoção de silêncio, normalização de volume
     */
    private convertToWavWithNoiseReduction(inputPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const outputPath = inputPath.replace(path.extname(inputPath), '_clean.wav');

            this.logger.log(`🔇 Processando áudio: ${inputPath}`);

            // Filtros FFmpeg encadeados:
            // 1. silenceremove: Remove silêncio no início/fim
            // 2. afftdn: Redução de ruído adaptativa
            // 3. dynaudnorm: Normalização dinâmica de volume
            const audioFilters = [
                'silenceremove=start_periods=1:start_silence=0.5:start_threshold=-50dB:stop_periods=1:stop_silence=0.5:stop_threshold=-50dB',
                'afftdn=nf=-25',
                'dynaudnorm=p=0.9:m=10'
            ].join(',');

            ffmpeg(inputPath)
                .audioFilters(audioFilters)
                .toFormat('wav')
                .audioFrequency(16000)
                .audioChannels(1) // Mono para melhor transcrição
                .on('end', () => {
                    this.logger.log(`✅ Áudio processado: ${outputPath}`);
                    resolve(outputPath);
                })
                .on('error', (err) => {
                    this.logger.warn(`⚠️ Falha no processamento, usando simples: ${err.message}`);
                    // Fallback: converter sem filtros avançados
                    this.convertToWavSimple(inputPath).then(resolve).catch(reject);
                })
                .save(outputPath);
        });
    }

    /**
     * Fallback: Converte sem redução de ruído
     */
    private convertToWavSimple(inputPath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const outputPath = inputPath.replace(path.extname(inputPath), '.wav');

            ffmpeg(inputPath)
                .toFormat('wav')
                .audioFrequency(16000)
                .audioChannels(1)
                .on('end', () => resolve(outputPath))
                .on('error', (err) => reject(err))
                .save(outputPath);
        });
    }
}
