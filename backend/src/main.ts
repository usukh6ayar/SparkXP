import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { join } from 'path';
import type { IncomingMessage } from 'http';
import { AppModule } from './app.module';
import { initSentry } from './common/observability/sentry';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // Before anything else: Sentry patches the runtime at init and cannot
  // instrument code that has already run.
  initSentry();
  // Disable the default body parser so we can raise the limit: batch image jobs
  // POST thousands of word ids (5000 UUIDs ≈ 200KB > the 100KB default → 500).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  // Railway puts one proxy in front of the app. Without this, `req.ip` is the
  // proxy's address for EVERY request, so each per-IP @Throttle (login 5/min,
  // phone sign-up 5/min) became one bucket shared by all users nationwide.
  // `1` = trust exactly that one hop (the client can't spoof past it).
  app.set('trust proxy', 1);
  // Baseline security headers. `crossOriginResourcePolicy` is relaxed because
  // /uploads/* serves images consumed by the mobile app and the admin web app
  // from different origins; the default 'same-origin' would block them.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  // The Byl webhook signs the RAW body; keep the bytes for that one route only
  // (storing them for every 15 MB batch request would double memory for nothing).
  app.use(
    json({
      limit: '15mb',
      verify: (req: IncomingMessage & { rawBody?: Buffer }, _res, buf) => {
        if (req.url?.startsWith('/api/payments/webhook/')) req.rawBody = buf;
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: '15mb' }));
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
    // Marketing site (web checkout, spec 2026-10-14) — comma-separated too.
    ...config
      .get<string>('WEB_ORIGIN', '')
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
  Logger.log(`SparkXP API running on port ${port} (prefix /api)`, 'Bootstrap');
}

// A rejected bootstrap (bad DB creds, missing JWT_SECRET) must exit non-zero so
// the platform restarts / marks the deploy failed instead of exiting quietly.
bootstrap().catch((err) => {
  Logger.error(`Failed to start: ${err.message}`, 'Bootstrap');
  process.exit(1);
});
