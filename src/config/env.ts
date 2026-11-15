import { z } from 'zod';

// Новая переменная — сюда и в .env.example в том же PR (BE-ENV-1).
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  FRONTEND_URL: z.url().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

// Падаем при старте, а не на первом запросе, если env неполный.
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Неверные переменные окружения: ${details}`);
  }
  return result.data;
}
