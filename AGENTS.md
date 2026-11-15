# AGENTS.md

NestJS 11 + Prisma + PostgreSQL, REST + WebSocket, Swagger, pnpm. Комментарии,
доки и тексты ошибок для пользователя — на русском; идентификаторы, коммиты и
ветки — на английском.

Этот файл — главный файл правил для агентов. `CLAUDE.md` только подключает его.

**Текущий этап:** 5 — заказы (см. [docs/OVERVIEW.md](docs/OVERVIEW.md), «Этапы»).

## Главное

- **Один модуль Nest — одна предметная область:** `auth`, `users`, `menu`,
  `orders`. Чужой модуль — только через его экспортированные сервисы, не
  через его репозиторий или Prisma-модели напрямую.
- **Доступ к данным — только Prisma**, через `PrismaService` из `src/prisma`.
  Сырой SQL — `$queryRaw` с шаблоном, никогда не `$queryRawUnsafe` со
  склейкой строк.
- **Ручка закрыта по умолчанию:** глобальные `JwtAuthGuard` + `RolesGuard`;
  открытая ручка помечается `@Public()`, ручка для персонала — `@Roles(...)`.
- **Вход — DTO с `class-validator`**, глобальный `ValidationPipe`
  (`whitelist`, `forbidNonWhitelisted`, `transform`). Ответ — DTO ответа, а
  не строка БД целиком (без `passwordHash`).
- **Swagger — контракт для фронта:** у каждой ручки и DTO — декораторы
  `@nestjs/swagger` (nullable-поле — `@ApiProperty({ type: String, nullable: true })`);
  фронт генерирует типы из `pnpm openapi:export`. Настройка приложения —
  одна, `src/app.setup.ts`: её зовут `main.ts`, e2e и экспорт.
- **После правок:** `pnpm lint:check` + `pnpm typecheck` + `pnpm test`; если
  тронута БД — ещё `pnpm test:e2e` с поднятым docker-compose.
- Код — источник истины: если док разошёлся с кодом, док правится в том же
  коммите.
- Объём задачи не расширять молча; неоднозначность — спросить.

## Что читать

| Файл | Зачем |
| --- | --- |
| [docs/BACKEND.md](docs/BACKEND.md) | Как устроен код: §1 структура модулей, §2 авторизация и роли, §3 API и ошибки, §4 БД и Prisma, §5 WebSocket, §6 env, правила |
| [docs/OVERVIEW.md](docs/OVERVIEW.md) | Продукт, роли, страницы, этапы (общий с фронтом) |
| [docs/Tech-spec.md](docs/Tech-spec.md) | Стек и версии |
| [docs/PR-POLICY.md](docs/PR-POLICY.md) | Правила проверки PR, их строгость и ID |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Деплой на Railway: переменные, связка с Vercel, частые ошибки |

## Структура модуля

Подробно — [docs/BACKEND.md](docs/BACKEND.md) §1.

```
src/<module>/
  <module>.module.ts        Nest-модуль; exports — только сервисы для других модулей
  <module>.controller.ts    HTTP: маршруты, guards, Swagger; без бизнес-логики
  <module>.service.ts       бизнес-правила, транзакции
  dto/                      входные и выходные DTO (create-x.dto.ts, x-response.dto.ts)
  <module>.mapper.ts        строка Prisma → DTO ответа (когда маппинг не тривиален)
  <module>.gateway.ts       WebSocket (только orders)
  *.spec.ts                 unit-тесты рядом с кодом
```

- Контроллер тонкий: принять DTO → вызвать сервис → вернуть DTO ответа.
- Бизнес-правила (смена статуса заказа, стоп-лист) — в сервисе, не в
  контроллере и не в гейтвее.
- Перенос файлов модуля — отдельный PR: только `git mv` и импорты.

## Права доступа

- Роли: `client`, `barista`, `manager`, `admin` — enum `Role` в Prisma.
- Матрица ролей — в [docs/BACKEND.md](docs/BACKEND.md) §2; новая ручка —
  строка в матрице в том же PR.
- Роль берётся только из JWT (`req.user`), не из тела запроса и не из query.
- Клиент видит только **свои** заказы: фильтр по `userId` из токена в сервисе.
  Чужой заказ — `404`, как несуществующий.
- Админ — без ограничений; менеджер не может менять роли сотрудников.

## Авторизация

- Вход — `AuthService` + DTO, запросы — Passport `jwt` (`JwtStrategy`) из
  `httpOnly`-cookie `access_token` (`secure` в проде, `sameSite: 'lax'`); в
  теле ответа токен не отдаётся. Подробно — BACKEND.md §2.
- В токене только `sub`; роль и активность — из БД на каждый запрос.
- Пароли — `argon2id` (`users/password.ts`), хеш в `passwordHash`; в логи и
  ответы не попадает.
- В e2e пользователи создаются через `testUsers(() => app, '<файл>')` из
  `test/helpers/users.ts`: свой домен на файл, файлы идут параллельно.
- CORS — только адрес фронта из env, `credentials: true`.

## База

- Схема — `prisma/schema.prisma`; изменение схемы — только миграцией
  `pnpm db:migrate --name <snake_case>`; миграции не правятся после
  слияния в `main`. Таблицы и колонки — `snake_case` через `@@map`/`@map`.
- Деньги — `Int` в целых тенге (дробных сумм в меню нет), не `Float`.
- Несколько записей, которые должны измениться вместе (заказ + его позиции),
  — в `prisma.$transaction`.
- Сиды — `prisma/seed.ts` (меню с примерными ценами в тенге).

## Тесты

- **Unit:** Jest, `src/**/*.spec.ts`; логика сервисов (переходы статусов
  заказа, проверка стоп-листа). Prisma в unit не мокать глубоко — выносить
  чистые правила в функции и тестировать их.
- **E2E:** `test/**/*.e2e-spec.ts` через supertest на реальной БД из
  docker-compose; права (403/404) для каждой роли на новых ручках.

## CI и PR

- GitHub Actions (`.github/workflows/ci.yml`) на каждый PR в `main`: джоба
  `check` (lint, typecheck, unit, build) и `e2e` (PostgreSQL как сервис,
  `db:deploy`, `db:seed`, `test:e2e`). Слияние — после зелёных обеих.
- Перед PR — скилл `/pre-pr-review`, отчёт `READY` / `READY WITH WARNINGS` /
  `BLOCKED` / `INCOMPLETE`. С `BLOCKED` PR не создаём.
- Отклонение от правила — `policy-exception: <ID> <причина>` у кода и строка
  в разделе «Отклонения от PR Policy» описания PR.
- Изменён контракт (DTO, пути) — в описании PR так и написать: фронту нужно
  перегенерировать типы.

## Git

- В `main` не коммитить и не пушить напрямую; задача — своя ветка
  (`feat/menu-api`, `fix/order-status`); ветку выбирает человек.
- Коммиты маленькие, на простом английском с префиксом: `feat:`, `fix:`,
  `refactor:`, `docs:`, `test:`, `chore:`, `ci:`. Пример: `feat: add menu endpoint`.
- **Без атрибуции ИИ:** без строк `Co-Authored-By` и подписей Claude.
- `.env` не коммитится; список переменных без значений — `.env.example`.

## Команды

```bash
pnpm start:dev     # nest start --watch, http://localhost:4000
pnpm build         # nest build
pnpm lint:check    # eslint без --fix (как в CI)
pnpm lint          # eslint --fix
pnpm typecheck     # tsc --noEmit
pnpm test          # jest unit
pnpm test:e2e      # jest e2e (нужна БД)
pnpm format        # prettier

docker compose up -d db          # только PostgreSQL для разработки (:5432)
docker compose up -d --build     # API + PostgreSQL в контейнерах
pnpm db:migrate --name <name>    # новая миграция (prisma migrate dev)
pnpm db:deploy                   # применить миграции (как в CI и Docker)
pnpm db:seed                     # сиды меню (prisma/seed.ts), повторный запуск безопасен
pnpm db:studio                   # Prisma Studio
pnpm openapi:export [путь]       # openapi.json без подключения к БД (для фронта)
```

Первый запуск: `cp .env.example .env` → `docker compose up -d db` →
`pnpm install` (postinstall делает `prisma generate`) → `pnpm db:deploy` →
`pnpm db:seed` → `pnpm start:dev` → `http://localhost:4000/api/menu`,
Swagger — `http://localhost:4000/api/docs`.

Prisma 7: адрес БД — в `prisma.config.ts`, клиент генерируется в
`src/generated/prisma` (не коммитится), подключение — через `@prisma/adapter-pg`.
`migrate dev` клиент **не** перегенерирует — после правки схемы
`pnpm exec prisma generate`.
