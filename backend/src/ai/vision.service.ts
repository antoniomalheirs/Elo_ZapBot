import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface VisionAnalysisResult {
    description: string;
    confidence: number;  // 0-100
    category: string;    // 'document', 'photo', 'medical', 'unknown'
}

@Injectable()
export class VisionService {
    private readonly logger = new Logger(VisionService.name);
    private genAI: GoogleGenerativeAI | null = null;
    private model: any = null;

    constructor() {
        this.initializeModel();
    }

    private initializeModel() {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            this.logger.warn('⚠️ GEMINI_API_KEY não configurada. Análise de imagens desabilitada.');
            return;
        }

        try {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            this.logger.log('✅ VisionService inicializado com Gemini 2.5 Flash');
        } catch (error) {
            this.logger.error(`❌ Erro ao inicializar Gemini: ${error}`);
        }
    }

    /**
     * Analisa uma imagem e retorna descrição com score de confiança
     * @param imageBuffer Buffer da imagem
     * @param mimeType Tipo MIME da imagem (image/jpeg, image/png, etc)
     * @returns { description, confidence, category }
     */
    async analyzeImage(imageBuffer: Buffer, mimeType: string): Promise<VisionAnalysisResult> {
        if (!this.model) {
            this.logger.warn('⚠️ Modelo Gemini não disponível');
            return { description: '', confidence: 0, category: 'unknown' };
        }

        try {
            this.logger.log(`🖼️ Analisando imagem (${mimeType}, ${Math.round(imageBuffer.length / 1024)}KB)...`);

            const base64Image = imageBuffer.toString('base64');

            // Prompt estruturado para retornar JSON com confiança
            const prompt = `Analise esta imagem e responda APENAS com um JSON válido, sem markdown:

{
  "description": "descrição clara e concisa em português brasileiro, máximo 2-3 frases",
  "category": "document" ou "medical" ou "photo" ou "id_card" ou "receipt" ou "screenshot" ou "payment_proof" ou "other",
  "confidence": número de 0 a 100 indicando sua certeza sobre a análise,
  "extracted_info": "se for documento/cartão/receita/comprovante, extraia informações relevantes como nomes, datas, valores"
}

Categorias:
- document: documentos, contratos, textos
- medical: receitas médicas, exames, laudos
- id_card: cartões de convênio, RG, CNH
- receipt: recibos, notas fiscais, boletos
- payment_proof: comprovantes de pagamento, PIX, transferências bancárias, depósitos
- screenshot: capturas de tela
- photo: fotos comuns (pessoas, lugares, objetos)
- other: não conseguiu identificar

Se for comprovante de pagamento (PIX, transferência, depósito), extraia: valor, data, nome do pagador/recebedor.
Seja honesto com a confiança: use 90+ apenas se tiver certeza absoluta.`;

            const result = await this.model.generateContent([
                prompt,
                {
                    inlineData: {
                        data: base64Image,
                        mimeType: mimeType
                    }
                }
            ]);

            const response = await result.response;
            const text = response.text()?.trim() || '';

            // Tentar parsear JSON
            try {
                // Remover possíveis backticks de markdown
                const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const parsed = JSON.parse(cleanJson);

                const description = parsed.description || '';
                const confidence = Math.min(100, Math.max(0, parsed.confidence || 50));
                const category = parsed.category || 'other';
                const extractedInfo = parsed.extracted_info || '';

                // Combinar descrição com info extraída se houver
                const fullDescription = extractedInfo && extractedInfo !== description
                    ? `${description} | Info: ${extractedInfo}`
                    : description;

                this.logger.log(`✅ Imagem analisada: "${description.substring(0, 50)}..." (${confidence}% confiança, cat: ${category})`);

                return {
                    description: fullDescription,
                    confidence,
                    category
                };

            } catch (parseError) {
                // Fallback: usar texto bruto com confiança média
                this.logger.warn(`⚠️ Não foi possível parsear JSON, usando texto bruto`);
                return {
                    description: text.substring(0, 200),
                    confidence: 50,
                    category: 'unknown'
                };
            }

        } catch (error: any) {
            const errorMsg = error?.message || error?.toString() || 'Erro desconhecido';
            this.logger.error(`❌ Erro Gemini: ${errorMsg}`);

            if (errorMsg.includes('quota') || errorMsg.includes('429')) {
                this.logger.warn('⚠️ Limite de requisições do Gemini atingido.');
            } else if (errorMsg.includes('API_KEY') || errorMsg.includes('401')) {
                this.logger.error('❌ API Key do Gemini inválida.');
            }

            return { description: '', confidence: 0, category: 'unknown' };
        }
    }

    /**
     * Verifica se o serviço está disponível
     */
    isAvailable(): boolean {
        return this.model !== null;
    }
}
