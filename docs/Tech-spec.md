# Tech spec — backend

Версии — из `package.json`. Менеджер пакетов — `pnpm@10.34.1`.

## Ядро

| Технология | Для чего |
| --- | --- |
| NestJS 11 (`@nestjs/core`, `platform-express`) | HTTP-фреймворк, DI, модули |
| TypeScript 5 | язык |
| RxJS 7 | зависимость Nest |
| PostgreSQL 16 (`postgres:16-alpine`, docker-compose) | БД |
| Prisma 7.10 (`prisma`, `@prisma/client`, `@prisma/adapter-pg` + `pg`) | ORM, миграции; генератор `prisma-client`, CJS |
| `@nestjs/config` + zod 4 | конфиг и проверка env |
| dotenv | `.env` для Prisma CLI в `prisma.config.ts` |
| Docker (node:22-alpine), GitHub Actions | образ API, CI |
| `@nestjs/swagger` 11 | Swagger UI и OpenAPI — контракт для фронта |
| `class-validator`, `class-transformer` | валидация входных DTO (глобальный ValidationPipe) |
| `@nestjs/passport` 11 + `passport-jwt`, `@nestjs/jwt` 11 | JWT из httpOnly-cookie |
| `cookie-parser` | чтение cookie |
| `argon2` (argon2id) | хеш паролей |
| `@nestjs/throttler` 6 | лимит попыток входа и регистрации |

## План

| Технология | Этап | Для чего |
| --- | --- | --- |
| `@nestjs/websockets`, `@nestjs/platform-socket.io` | 5 | живая панель заказов |
| деплой образа | 6 | автодеплой по пушу в `main` |

## Качество и тесты

ESLint 9 + typescript-eslint + Prettier; Jest 30 + ts-jest (unit),
supertest (e2e).
