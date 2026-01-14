import { Controller, Get, Param, Query, Delete } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Controller('conversations')
export class ConversationsController {
    constructor(private readonly prisma: PrismaService) { }

    @Get()
    async findAll(@Query('search') search?: string) {
        const where: any = {
            // Filtrar conversas de GRUPOS (apenas chats individuais)
            user: {
                NOT: {
                    phone: { contains: '@g.us' }
                }
            }
        };

        if (search) {
            where.user = {
                ...where.user,
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } }
                ]
            };
        }

        const conversations = await this.prisma.conversation.findMany({
            where,
            include: {
                user: true,
                messages: {
                    take: 1,
                    orderBy: { createdAt: 'desc' }
                }
            },
            orderBy: { updatedAt: 'desc' },
            take: 50
        });

        // Filtrar também usuários com telefone contendo @g.us no resultado
        const filtered = conversations.filter(c => !c.user.phone.includes('@g.us'));

        return filtered.map(c => ({
            id: c.id,
            userName: c.user.name || 'Desconhecido',
            userPhone: c.user.phone,
            state: c.state,
            lastMessage: c.messages[0]?.content || '',
            lastMessageTime: c.messages[0]?.createdAt || c.updatedAt,
            updatedAt: c.updatedAt
        }));
    }

    @Get(':id/messages')
    async getMessages(@Param('id') id: string) {
        const messages = await this.prisma.message.findMany({
            where: { conversationId: id },
            orderBy: { createdAt: 'asc' }
        });

        return messages.map(m => ({
            id: m.id,
            direction: m.direction,
            content: m.content,
            intent: m.intent,
            createdAt: m.createdAt
        }));
    }

    // Limpar TODAS as conversas e mensagens
    @Delete('clear-all')
    async clearAll() {
        // Deletar mensagens primeiro (FK)
        await this.prisma.message.deleteMany({});
        // Deletar conversas
        await this.prisma.conversation.deleteMany({});
        return { success: true, message: 'Todas as conversas foram limpas' };
    }
}
