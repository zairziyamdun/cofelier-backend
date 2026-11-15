# AGENTS.md

NestJS 11 + Prisma + PostgreSQL, REST + WebSocket, Swagger, pnpm. Комментарии,
доки и тексты ошибок для пользователя — на русском; идентификаторы, коммиты и
ветки — на английском.

Этот файл — главный файл правил для агентов. `CLAUDE.md` только подключает его.

**Текущий этап:** 1 — каркас (см. [docs/OVERVIEW.md](docs/OVERVIEW.md), «Этапы»).

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
  `@nestjs/swagger`; фронт генерирует типы из `/api/docs-json`.
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

- Passport (`local` для входа, `jwt` для запросов). JWT — в `httpOnly`,
  `secure` (в проде), `sameSite: 'lax'` cookie `access_token`; в теле ответа
  токен не отдаётся.
- Пароли — `argon2` (или `bcrypt`), хеш в `passwordHash`; в логи и ответы не
  попадает.
- CORS — только адрес фронта из env, `credentials: true`.

## База

- Схема — `prisma/schema.prisma`; изменение схемы — только миграцией
  `pnpm prisma migrate dev --name <snake_case>`; миграции не правятся после
  слияния в `main`.
- Деньги — целое число в тиынах (`Int`) или `Decimal`, не `Float`.
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

- GitHub Actions на каждый PR в `main`: lint, typecheck, unit, build
  (этап 1 — настроить); e2e с сервисом PostgreSQL — с этапа 2.
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
```

Планируются (этап 1–2): `docker compose up -d` (API + PostgreSQL),
`pnpm prisma migrate dev`, `pnpm prisma db seed`, Swagger на
`http://localhost:4000/api/docs`.
