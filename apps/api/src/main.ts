import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser = require('cookie-parser');
import * as dotenv from 'dotenv';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';

/** Load env from apps/api and repo root (cwd alone is unreliable when started as dist/main.js). */
function loadEnvFiles() {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
    resolve(__dirname, '../.env'), // apps/api/.env when running dist/main.js
    resolve(__dirname, '../../.env'), // repo root from dist/, or apps/api from src/
    resolve(__dirname, '../../../.env'), // repo root from dist/
  ];
  const loaded: string[] = [];
  for (const file of candidates) {
    if (!existsSync(file) || loaded.includes(file)) continue;
    dotenv.config({ path: file, override: true });
    loaded.push(file);
  }
  if (loaded.length === 0) {
    dotenv.config();
  }
}

loadEnvFiles();

/** On Windows, nest --watch often leaves the previous process holding the port. */
function freePortIfNeeded(port: number) {
  if (process.platform !== 'win32') return;
  const portStr = String(port);
  try {
    const stdout = execSync(`netstat -ano | findstr :${portStr}`, { encoding: 'utf8' });
    const pids = new Set<string>();
    for (const line of stdout.split(/\r?\n/)) {
      if (!/LISTENING/i.test(line)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== String(process.pid)) {
        pids.add(pid);
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`Freed port ${portStr} (stopped PID ${pid})`);
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* nothing listening */
  }
}

async function bootstrap() {
  const rawPort = process.env.PORT || process.env.API_PORT || '4000';
  if (!/^\d+$/.test(rawPort)) {
    throw new Error(`Invalid PORT: ${rawPort}`);
  }
  const port = Number(rawPort);
  freePortIfNeeded(port);

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !process.env.CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN is required when NODE_ENV=production');
  }

  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use(cookieParser());

  app.use(
    helmet({
      contentSecurityPolicy: isProd
        ? {
            useDefaults: true,
            directives: {
              defaultSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3002',
      'http://localhost:5173',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (process.env.OPENAPI_ENABLED === 'true') {
    const config = new DocumentBuilder()
      .setTitle('SPHEAR API')
      .setDescription('Clinic Management System API')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('refreshToken')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    console.log(`Swagger docs: http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api/v1`);
}

bootstrap();
