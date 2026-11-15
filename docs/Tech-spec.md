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

## План

| Технология | Этап | Для чего |
| --- | --- | --- |
| `@nestjs/swagger` | 2 | документация и контракт для фронта |
| `class-validator`, `class-transformer` | 2 | валидация DTO |
| `@nestjs/passport`, `passport-jwt`, `passport-local`, `@nestjs/jwt` | 3 | вход и JWT |
| `cookie-parser` | 3 | JWT в httpOnly-cookie |
| `argon2` | 3 | хеш паролей |
| `@nestjs/throttler` | 3 | лимит на вход |
| `@nestjs/websockets`, `@nestjs/platform-socket.io` | 5 | живая панель заказов |
| деплой образа | 6 | автодеплой по пушу в `main` |

## Качество и тесты

ESLint 9 + typescript-eslint + Prettier; Jest 30 + ts-jest (unit),
supertest (e2e).
