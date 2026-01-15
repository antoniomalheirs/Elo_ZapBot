/**
 * Script para limpar/identificar usuários com LID ao invés de telefone real
 * 
 * COMO USAR:
 * 1. npx ts-node scripts/cleanup-lid-users.ts list    (Ver usuários afetados)
 * 2. npx ts-node scripts/cleanup-lid-users.ts delete  (Deletar usuários com LID)
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    const mode = process.argv[2] || 'list';

    console.log('🔍 Buscando usuários com LID no banco de dados...\n');

    // Buscar todos os usuários
    const allUsers = await prisma.user.findMany();

    // Filtrar usuários com LID (números > 15 dígitos ou contendo 'lid')
    const lidUsers = allUsers.filter((user: any) => {
        const phone = user.phone || '';
        const cleanPhone = phone.replace(/\D/g, ''); // Só números
        return phone.toLowerCase().includes('lid') ||
            (cleanPhone.length > 15 && !phone.startsWith('55'));
    });

    if (lidUsers.length === 0) {
        console.log('✅ Nenhum usuário com LID encontrado! Banco limpo.');
        await prisma.$disconnect();
        return;
    }

    console.log(`⚠️ Encontrados ${lidUsers.length} usuário(s) com possível LID:\n`);

    for (const user of lidUsers) {
        const aptCount = await prisma.appointment.count({ where: { userId: user.id } });
        console.log(`📱 ID: ${user.id}`);
        console.log(`   Nome: ${user.name || 'Sem nome'}`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   Agendamentos: ${aptCount}`);
        console.log('');
    }

    if (mode === 'delete') {
        console.log('\n🗑️ Modo DELETE ativado. Deletando usuários com LID...\n');

        for (const user of lidUsers) {
            try {
                // Deletar usuário (cascade vai cuidar do resto)
                await prisma.user.delete({
                    where: { id: user.id }
                });

                console.log(`✅ Deletado: ${user.phone} (${user.name || 'Sem nome'})`);
            } catch (error: any) {
                console.error(`❌ Erro ao deletar ${user.phone}: ${error.message}`);
            }
        }

        console.log('\n🎉 Limpeza concluída!');
    } else {
        console.log('💡 Para deletar esses usuários, execute:');
        console.log('   npx ts-node scripts/cleanup-lid-users.ts delete');
        console.log('\n⚠️ ATENÇÃO: Isso removerá permanentemente os usuários e seus agendamentos!');
    }

    await prisma.$disconnect();
}

main().catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
