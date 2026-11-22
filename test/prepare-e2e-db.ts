// Готовит базу для e2e перед запуском jest: создаёт `<имя>_test`, если её нет,
// применяет миграции и сиды. `--reset` — пересоздать базу с нуля.
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { Client } from 'pg';

import {
  databaseName,
  resolveTestDatabaseUrl,
} from '../src/config/test-database';

const reset = process.argv.includes('--reset');

async function ensureDatabase(url: string, name: string): Promise<void> {
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    if (reset) {
      await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    }
    const found = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [name],
    );
    if (found.rowCount === 0) {
      await client.query(`CREATE DATABASE "${name}"`);
      process.stdout.write(`e2e: создана база ${name}\n`);
    }
  } finally {
    await client.end();
  }
}

function prisma(url: string, args: string[]): void {
  const result = spawnSync('pnpm', ['exec', 'prisma', ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: url },
  });
  if (result.status !== 0) {
    throw new Error(`prisma ${args.join(' ')} завершилась с ошибкой`);
  }
}

async function main(): Promise<void> {
  const url = resolveTestDatabaseUrl(process.env);
  const name = databaseName(url);
  // Имя попадает в CREATE/DROP DATABASE без параметров — только безопасные символы.
  if (!/^[a-z0-9_]+$/i.test(name)) {
    throw new Error(
      `имя базы для e2e — латиница, цифры и «_», сейчас «${name}»`,
    );
  }
  process.stdout.write(`e2e: база ${name}\n`);
  await ensureDatabase(url, name);
  prisma(url, ['migrate', 'deploy']);
  prisma(url, ['db', 'seed']);
}

main().catch((error: unknown) => {
  process.stderr.write(
    `e2e: база не готова — ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
