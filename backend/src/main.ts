import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
    const logger = new Logger('Bootstrap');
    // Force restart hook

    const app = await NestFactory.create(AppModule, {
        logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    });

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );

    // CORS for admin panel - Allow any localhost port for development
    app.enableCors({
        origin: [/http:\/\/localhost:[0-9]+/],
        credentials: true,
    });

    const port = process.env.PORT || 3000;

    // FIX: Enable shutdown hooks for graceful session saving (CRITICAL for older devices)
    app.enableShutdownHooks();

    await app.listen(port);

    logger.log(`🚀 ZapBot Backend running on port ${port}`);
    logger.log(`📱 WhatsApp Bot ready to connect...`);

    // FIX: Explicit signal handlers for Windows (watch mode doesn't forward signals properly)
    const gracefulShutdown = async (signal: string) => {
        logger.log(`⏳ Recebido sinal ${signal}. Iniciando shutdown graceful...`);
        await app.close();
        logger.log(`✅ Shutdown graceful completo.`);
        process.exit(0);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

bootstrap();
