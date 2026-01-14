import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
    schema: path.join(__dirname, 'prisma', 'schema.prisma'),

    datasource: {
        url: process.env.DATABASE_URL || 'postgresql://zapbot:zapbot_secret_2024@localhost:5432/zapbot_db',
    },
});
