import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Serve uploaded files at /uploads/<filename>
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  const config = app.get(ConfigService);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  app.setGlobalPrefix('api');

  const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    // Production admin — set ADMIN_ORIGIN env var to your Vercel URL.
    // Supports a comma-separated list (e.g. prod + preview deploys).
    ...config
      .get<string>('ADMIN_ORIGIN', '')
      .split(',')
      .map((o) => o.trim()),
  ].filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  const port = config.get<number>('PORT', 3000);
  // Bind 0.0.0.0 so the container is reachable on cloud hosts (Railway, Render).
  await app.listen(port, '0.0.0.0');
  Logger.log(`EnglishXP API running on port ${port} (prefix /api)`, 'Bootstrap');
}

bootstrap();
