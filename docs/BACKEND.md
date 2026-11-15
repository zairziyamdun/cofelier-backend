# Backend — техническое устройство

NestJS 11 + Prisma + PostgreSQL, REST + WebSocket. Что за продукт —
`OVERVIEW.md`, стек — `Tech-spec.md`.

В разделах помечено, что **есть** в коде и что **план** (этап N). Когда план
становится кодом — пометка снимается в том же коммите.

---

## 1. Структура

```
src/
  main.ts             bootstrap: порт, префикс /api, CORS, shutdown hooks          (есть)
                      ValidationPipe, cookie, Swagger                              (план, этапы 2–3)
  app.module.ts       корневой модуль: ConfigModule, PrismaModule, HealthModule    (есть)
  config/             zod-схема env (env.ts), проверка при старте                  (есть)
  prisma/             PrismaModule, PrismaService (global, adapter-pg)             (есть)
  generated/prisma/   сгенерированный клиент Prisma, не коммитится                 (есть)
  health/             GET /api/health — API жив и видит БД                         (есть)
  common/             декораторы @Public, @Roles, @CurrentUser; guards; фильтры    (план, этап 3)
  auth/               вход, регистрация, JWT, стратегии Passport                   (план, этап 3)
  users/              пользователи и роли                                          (план, этап 3)
  menu/               категории, позиции, цены, стоп-лист                          (план, этап 2)
  orders/             заказы, статусы, WebSocket-шлюз                              (план, этап 5)
prisma/
  schema.prisma       схема БД (пока без моделей)                                  (есть)
  migrations/         миграции                                                     (с этапа 2)
  seed.ts             меню с примерными ценами                                     (план, этап 2)
prisma.config.ts      конфиг Prisma CLI: путь схемы, миграций, DATABASE_URL        (есть)
test/                 e2e (supertest), нужна БД                                    (есть: health)
docker-compose.yml    db (PostgreSQL 16) + api                                     (есть)
Dockerfile            многоступенчатая сборка; при старте — migrate deploy         (есть)
```

### Связи модулей

| Модуль | Зависит от | Экспортирует |
| --- | --- | --- |
| `auth` | `users` | — |
| `users` | `prisma` | `UsersService` |
| `menu` | `prisma` | `MenuService` (проверка цены и стоп-листа для заказа) |
| `orders` | `prisma`, `menu` | — |

Циклов нет; `forwardRef` — признак ошибки в границах, а не решение.

### Слои внутри модуля

- **Контроллер** — маршрут, guard, роль, DTO, Swagger. Без `prisma.*` и
  бизнес-правил.
- **Сервис** — правила и транзакции. Единственное место, где модуль ходит в
  Prisma.
- **Mapper** — строка БД → DTO ответа. Ответ никогда не содержит
  `passwordHash` и внутренних полей.
- **Gateway** (orders) — только рассылка событий и подписка; изменение
  статуса идёт через сервис.

## 2. Авторизация и роли

- Глобальные guards в `app.module.ts` (план, этап 3): `JwtAuthGuard` →
  `RolesGuard`. Порядок важен: сначала кто, потом можно ли.
- `@Public()` — без входа; `@Roles('manager', 'admin')` — список ролей;
  без декоратора — любой вошедший.
- JWT: payload `{ sub: userId, role }`, срок — из env. Cookie `access_token`:
  `httpOnly`, `sameSite: 'lax'`, `secure` в проде. Выход — очистка cookie.
- `GET /auth/me` — текущий пользователь; им пользуется фронт для redirect.

### Матрица доступа (план; новая ручка — строка здесь в том же PR)

| Ручка | Public | client | barista | manager | admin |
| --- | --- | --- | --- | --- | --- |
| `GET /menu` | ✔ | ✔ | ✔ | ✔ | ✔ |
| `POST/PATCH/DELETE /menu/items` | | | | ✔ | ✔ |
| `PATCH /menu/items/:id/stop-list` | | | | ✔ | ✔ |
| `POST /orders` | | ✔ | | | |
| `GET /orders/my` | | ✔ | | | |
| `GET /orders/queue` | | | ✔ | ✔ | ✔ |
| `PATCH /orders/:id/status` | | | ✔ | ✔ | ✔ |
| `GET /stats/sales` | | | | ✔ | ✔ |
| `GET/PATCH /users` (сотрудники, роли) | | | | | ✔ |

## 3. API и ошибки

- Префикс `/api` (есть): `app.setGlobalPrefix('api')`; Swagger (план,
  этап 2) — `/api/docs`, JSON — `/api/docs-json`.
- Пути — существительные во множественном числе, `kebab-case`; поля JSON —
  `camelCase` (как в Prisma и TS).
- Списки с пагинацией — `{ items, total, page, pageSize }`.
- Ошибки — исключения Nest (`NotFoundException`, `ForbiddenException`,
  `ConflictException`) с русским `message`; HTTP-статус несёт смысл, тело 200
  с ошибкой не отдаётся.
- Позиция в стоп-листе при заказе — `409 Conflict` с понятным сообщением.
- Ломающее изменение DTO — в описании PR, чтобы фронт перегенерировал типы.

## 4. БД и Prisma

- Модели (план): `User` (email, passwordHash, role, name), `MenuCategory`,
  `MenuItem` (price, isAvailable/inStopList, imageUrl), `Order` (userId,
  status, total, comment, pickupAt), `OrderItem` (menuItemId, qty, price на
  момент заказа).
- Цена в `OrderItem` копируется при создании: правка меню не меняет старые
  заказы.
- Деньги — `Int` в тиынах или `Decimal`, не `Float`.
- Создание заказа с позициями — одна `$transaction`.
- Переход статуса — проверка допустимого перехода в сервисе
  (`new → accepted → preparing → ready → completed`, `cancelled` — из `new`
  и `accepted`).

## 5. WebSocket (этап 5)

- `OrdersGateway` (`@nestjs/websockets`, socket.io), namespace `/orders`.
- Авторизация при подключении — по той же cookie; клиент без роли
  персонала в комнату `staff` не попадает.
- События: `order.created`, `order.status-changed` — с DTO заказа. Шлются
  сервисом **после** коммита транзакции.

## 6. Окружение

Переменные проверяются zod-схемой `src/config/env.ts` при старте: неполный
env роняет приложение сразу с перечнем ошибок. Читать — через
`ConfigService<Env, true>` с `{ infer: true }`, не через `process.env`.
Новая переменная — в схему и в `.env.example` в том же PR.

| Переменная | Для чего | Есть |
| --- | --- | --- |
| `NODE_ENV` | `development` / `test` / `production` | ✔ |
| `PORT` | порт API, по умолчанию 4000 | ✔ |
| `DATABASE_URL` | строка подключения PostgreSQL | ✔ |
| `FRONTEND_URL` | разрешённый origin для CORS, по умолчанию `http://localhost:3000` | ✔ |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | подпись и срок токена | этап 3 |

---

## Правила

**Процесс**

- Код — источник истины; док правится в том же коммите, что и поведение.
- Объём задачи не расширять молча; неоднозначность — спросить.
- Удаление и исправление — разные коммиты.

**Код**

- Файл больше 300–400 строк — делить. Сервис не знает про `Request`/`Response`.
- Полные имена; DTO — `CreateMenuItemDto`, `MenuItemResponseDto`.
- Комментарий — одно предложение про «почему».
- `console.*` в `src` нельзя — `Logger` из `@nestjs/common` с контекстом.
- Форматирование — `.prettierrc` (одинарные кавычки, trailing comma).

**Безопасность**

- Не логировать пароли, токены, cookie, тела запросов авторизации.
- Сырой SQL — только параметризованный.
- Rate limit на `/auth/login` (`@nestjs/throttler`, план этап 3).

**Язык.** Комментарии, доки и `message` ошибок — русский; идентификаторы,
коммиты, ветки — английский.
