import { z } from 'zod';

export const ADMIN_PASSWORD_MIN_LENGTH = 12;

// Пустая строка (как в .env.example и пустых полях Railway) — «не задано».
const emptyAsUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

// Новая переменная — сюда и в .env.example в том же PR (BE-ENV-1).
const envSchema = z
  .object({
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
    COOKIE_DOMAIN: z.preprocess(emptyAsUndefined, z.string().optional()),
    // Сколько прокси перед API доверять в X-Forwarded-For (IP для лимита входа).
    // 0 — не доверять: подделанный заголовок не обходит лимит.
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    // Первый админ: создаётся при старте API (AdminBootstrapService), если его нет.
    ADMIN_EMAIL: z.preprocess(
      (value) =>
        typeof value === 'string'
          ? value.trim().toLowerCase() || undefined
          : value,
      z
        .email({ message: 'ADMIN_EMAIL — почта в формате name@example.com' })
        .optional(),
    ),
    ADMIN_PASSWORD: z.preprocess(emptyAsUndefined, z.string().optional()),
    // Фото меню: S3 (RustFS локально, любое S3-совместимое на проде) или,
    // если S3 не задан, — диск API в UPLOADS_DIR (на Railway — Volume).
    UPLOADS_DIR: z.preprocess(emptyAsUndefined, z.string().optional()),
    S3_ENDPOINT: z.preprocess(emptyAsUndefined, z.url().optional()),
    S3_REGION: z.preprocess(emptyAsUndefined, z.string().default('auto')),
    S3_BUCKET: z.preprocess(emptyAsUndefined, z.string().optional()),
    S3_ACCESS_KEY_ID: z.preprocess(emptyAsUndefined, z.string().optional()),
    S3_SECRET_ACCESS_KEY: z.preprocess(emptyAsUndefined, z.string().optional()),
    // Откуда браузер берёт файлы: публичный домен бакета, без «/» в конце.
    S3_PUBLIC_URL: z.preprocess(
      emptyAsUndefined,
      z
        .url()
        .transform((value) => value.replace(/\/+$/, ''))
        .optional(),
    ),
    // true — разово: роль «админ», включить аккаунт и пароль из ADMIN_PASSWORD.
    ADMIN_RESET_PASSWORD: z.preprocess(
      (value) =>
        typeof value === 'string'
          ? value.trim().toLowerCase() || undefined
          : value,
      z
        .enum(['true', 'false'], {
          message: 'ADMIN_RESET_PASSWORD — true или false',
        })
        .optional()
        .transform((value) => value === 'true'),
    ),
  })
  .superRefine((env, ctx) => {
    // Хранилище — всё или ничего: наполовину заданное — ошибка при старте.
    const storage = {
      S3_ENDPOINT: env.S3_ENDPOINT,
      S3_BUCKET: env.S3_BUCKET,
      S3_ACCESS_KEY_ID: env.S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: env.S3_SECRET_ACCESS_KEY,
      S3_PUBLIC_URL: env.S3_PUBLIC_URL,
    };
    const missing = Object.entries(storage).filter(([, value]) => !value);
    if (missing.length > 0 && missing.length < Object.keys(storage).length) {
      for (const [key] of missing) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'хранилище фото задаётся целиком: все переменные S3_*',
        });
      }
    }
  })
  .superRefine((env, ctx) => {
    const email = env.ADMIN_EMAIL;
    const password = env.ADMIN_PASSWORD;
    if (!email && !password) {
      if (env.ADMIN_RESET_PASSWORD) {
        ctx.addIssue({
          code: 'custom',
          path: ['ADMIN_RESET_PASSWORD'],
          message:
            'сброс работает только вместе с ADMIN_EMAIL и ADMIN_PASSWORD',
        });
      }
      return;
    }
    // Полузаданный или слабый админ — не стартуем: иначе «вроде задал, а админа нет».
    if (!email || !password) {
      ctx.addIssue({
        code: 'custom',
        path: [email ? 'ADMIN_PASSWORD' : 'ADMIN_EMAIL'],
        message: 'ADMIN_EMAIL и ADMIN_PASSWORD задаются вместе',
      });
      return;
    }
    if (
      password.length < ADMIN_PASSWORD_MIN_LENGTH ||
      password.toLowerCase() === email
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['ADMIN_PASSWORD'],
        message: `пароль админа — от ${ADMIN_PASSWORD_MIN_LENGTH} символов и не совпадает с почтой`,
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

// Падаем при старте, а не на первом запросе, если env неполный.
// В сообщение попадают только имена переменных, не значения.
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
