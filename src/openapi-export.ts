// Пишет openapi.json без подключения к БД: фронт генерирует из него типы (pnpm sync:api).
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApp, createOpenApiDocument } from './app.setup';

async function exportOpenApi() {
  // preview: провайдеры не создаются, поэтому Prisma не подключается к БД.
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });
  configureApp(app);
  const document = createOpenApiDocument(app);
  const target = resolve(process.argv[2] ?? 'openapi.json');
  writeFileSync(target, JSON.stringify(document, null, 2) + '\n');
  await app.close();
  process.stdout.write(`OpenAPI → ${target}\n`);
}

void exportOpenApi();
