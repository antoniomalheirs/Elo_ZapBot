import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsAppController {
    constructor(private readonly whatsappService: WhatsAppService) { }

    @Get('status')
    async getStatus() {
        const info = await this.whatsappService.getInfo();
        return {
            connected: this.whatsappService.isConnected(),
            qrCode: this.whatsappService.getQrCode(),
            phone: info?.wid || null,
            pushName: info?.pushname || null,
            timestamp: new Date().toISOString(),
        };
    }

    @Get('info')
    async getInfo() {
        const info = await this.whatsappService.getInfo();
        return {
            connected: this.whatsappService.isConnected(),
            info,
        };
    }

    @Post('disconnect')
    @HttpCode(HttpStatus.OK)
    async disconnect() {
        const success = await this.whatsappService.disconnect();
        return { success, message: success ? 'Desconectado' : 'Erro ao desconectar' };
    }

    @Post('reconnect')
    @HttpCode(HttpStatus.OK)
    async reconnect() {
        const success = await this.whatsappService.reconnect();
        return { success, message: success ? 'Reconectando...' : 'Erro ao reconectar' };
    }

    @Post('send')
    @HttpCode(HttpStatus.OK)
    async sendMessage(@Body() body: { phone: string; message: string }) {
        const success = await this.whatsappService.sendMessage(body.phone, body.message);
        return {
            success,
            timestamp: new Date().toISOString(),
        };
    }
}
