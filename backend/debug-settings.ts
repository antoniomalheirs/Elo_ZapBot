
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Debug Settings Script Iniciado');

    // 1. Ler TUDO antes
    console.log('📖 Lendo configurações atuais...');
    const all = await prisma.systemConfig.findMany();
    console.log('Current Configs:', JSON.stringify(all, null, 2));

    // 2. Tentar escrever um valor de teste
    console.log('✍️ Tentando salvar TEST_KEY...');
    const testVal = { testedAt: new Date(), working: true };

    try {
        const saved = await prisma.systemConfig.upsert({
            where: { key: 'TEST_KEY' },
            update: { value: testVal },
            create: { key: 'TEST_KEY', value: testVal }
        });
        console.log('✅ TEST_KEY salva com sucesso:', saved);
    } catch (e) {
        console.error('❌ Erro ao salvar TEST_KEY:', e);
    }

    // 3. Tentar ler settings reais se existirem
    const price = await prisma.systemConfig.findUnique({ where: { key: 'priceTherapy' } });
    console.log('💰 priceTherapy no DB:', price);

}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
