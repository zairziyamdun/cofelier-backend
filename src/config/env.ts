import { z } from 'zod';

// Новая переменная — сюда и в .env.example в том же PR (BE-ENV-1).
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  FRONTEND_URL: z.url().default('http://localhost:3000'),
  // Подпись JWT: длинная случайная строка, своя на каждом окружении.
  JWT_SECRET: z.string().min(32),
  // Срок жизни токена и cookie, по умолчанию 7 дней.
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(604_800),
  // Домен cookie в проде, когда API и сайт на разных поддоменах (.cofelier.kz).
  // Пустая строка из .env.example считается «не задано».
  COOKIE_DOMAIN: z
    .string()
    .optional()
    .transform((value) => value || undefined),
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
