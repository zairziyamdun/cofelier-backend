# Tech spec — backend

Версии — из `package.json`. Менеджер пакетов — `pnpm@10.34.1`.

## Ядро

| Технология | Для чего |
| --- | --- |
| NestJS 11 (`@nestjs/core`, `platform-express`) | HTTP-фреймворк, DI, модули |
| TypeScript 5 | язык |
| RxJS 7 | зависимость Nest |

## План

| Технология | Этап | Для чего |
| --- | --- | --- |
| PostgreSQL 16 (docker-compose) | 1 | БД |
| Prisma (`prisma`, `@prisma/client`) | 1 | ORM, миграции, сиды |
| `@nestjs/config` + zod | 1 | конфиг и проверка env |
| `@nestjs/swagger` | 2 | документация и контракт для фронта |
| `class-validator`, `class-transformer` | 2 | валидация DTO |
| `@nestjs/passport`, `passport-jwt`, `passport-local`, `@nestjs/jwt` | 3 | вход и JWT |
| `cookie-parser` | 3 | JWT в httpOnly-cookie |
| `argon2` | 3 | хеш паролей |
| `@nestjs/throttler` | 3 | лимит на вход |
| `@nestjs/websockets`, `@nestjs/platform-socket.io` | 5 | живая панель заказов |
| Docker, GitHub Actions | 1, 6 | CI и деплой |

## Качество и тесты

ESLint 9 + typescript-eslint + Prettier; Jest 30 + ts-jest (unit),
supertest (e2e).
