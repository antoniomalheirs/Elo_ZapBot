
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- USERS ---');
    const users = await prisma.user.findMany();
    console.table(users.map(u => ({ id: u.id, name: u.name, phone: u.phone })));

    console.log('\n--- APPOINTMENTS ---');
    const appts = await prisma.appointment.findMany({
        include: { user: true }
    });
    console.table(appts.map(a => ({
        id: a.id,
        date: a.dateTime.toISOString(),
        userName: a.user?.name,
        userPhone: a.user?.phone,
        service: a.service
    })));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
