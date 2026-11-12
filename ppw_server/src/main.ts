// Lê o arquivo .env (DATABASE_URL, PORT...) antes de qualquer outro import usar process.env
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    methods: 'GET, PUT, POST, DELETE, PATCH',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With, X-Usuario-Id',
    credentials: false,
  });
  // Fecha o banco (PGlite grava em disco) quando o processo recebe Ctrl+C
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
