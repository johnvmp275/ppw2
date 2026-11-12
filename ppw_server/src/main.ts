import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:3000',
    methods: 'GET, PUT, POST, DELETE, PATCH',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With',
    credentials: false,
  });

  await app.listen(process.env.PORT ?? 8000);
}
bootstrap();
