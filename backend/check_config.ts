
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Checking SystemConfig...');
    const config = await prisma.systemConfig.findUnique({
        where: { key: 'reminderTime' }
    });

    if (config) {
        console.log(`✅ Found reminderTime: "${config.value}" (Type: ${typeof config.value})`);

        const now = new Date();
        now.setHours(8, 20, 0, 0);
        const fmt = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        console.log(`🕒 JS Expected Format (08:20): "${fmt}"`);

        if (String(config.value) === fmt) {
            console.log('✅ MATCH! The scheduler will work.');
        } else {
            console.log('❌ MISMATCH! The scheduler requires format "HH:mm" (with leading zero).');
        }

    } else {
        console.log('❌ reminderTime key NOT FOUND in SystemConfig.');
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
