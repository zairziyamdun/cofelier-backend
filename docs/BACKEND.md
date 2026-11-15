# Backend — техническое устройство

NestJS 11 + Prisma + PostgreSQL, REST + WebSocket. Что за продукт —
`OVERVIEW.md`, стек — `Tech-spec.md`.

В разделах помечено, что **есть** в коде и что **план** (этап N). Когда план
становится кодом — пометка снимается в том же коммите.

---

## 1. Структура

```
src/
  main.ts             bootstrap: порт, CORS, shutdown hooks, Swagger UI            (есть)
  app.setup.ts        префикс /api, ValidationPipe, документ OpenAPI               (есть)
  openapi-export.ts   openapi.json без БД (NestFactory preview)                    (есть)
  app.module.ts       корневой модуль: Config, Prisma, Health, Menu                (есть)
  config/             zod-схема env (env.ts), проверка при старте                  (есть)
  prisma/             PrismaModule, PrismaService (global, adapter-pg)             (есть)
  generated/prisma/   сгенерированный клиент Prisma, не коммитится                 (есть)
  health/             GET /api/health — API жив и видит БД                         (есть)
  common/             @Public, @Roles, @CurrentUser, @Trim; JwtAuthGuard, RolesGuard (есть)
  auth/               вход, регистрация, выход, /auth/me; JwtStrategy, cookie      (есть)
  users/              UsersService, пароли (argon2), GET /users/staff              (есть)
                      создание и правка сотрудников                                (план, этап 4)
  menu/               GET /api/menu: категории с позициями, mapper, DTO           (есть)
                      правка, цены, стоп-лист                                      (план, этап 4)
  orders/             заказы, статусы, WebSocket-шлюз                              (план, этап 5)
prisma/
  schema.prisma       схема БД: MenuCategory, MenuItem                             (есть)
  migrations/         миграции, первая — init_menu                                 (есть)
  seed.ts             меню с примерными ценами, идемпотентно                       (есть)
prisma.config.ts      конфиг Prisma CLI: путь схемы, миграций, DATABASE_URL        (есть)
test/                 e2e (supertest), нужна БД с сидами                           (есть: health, menu)
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

- Глобальные guards (есть, `APP_GUARD` в `app.module.ts`): `JwtAuthGuard` →
  `RolesGuard`. Порядок важен: сначала кто, потом можно ли.
- `@Public()` — без входа; `@Roles('manager', 'admin')` — список ролей;
  без декоратора — любой вошедший. Без входа — `401 «Нужно войти»`, без
  роли — `403 «Недостаточно прав»`.
- JWT: payload `{ sub: userId }`, срок — `JWT_TTL_SECONDS`. **Роль в токене не
  хранится**: `JwtStrategy` на каждый запрос берёт пользователя из БД, поэтому
  смена роли и отключение (`isActive = false`) действуют сразу.
- Cookie `access_token`: `httpOnly`, `sameSite: 'lax'`, `secure` в проде,
  `domain` — `COOKIE_DOMAIN`. Токен в теле ответа не отдаётся. Выход —
  `clearCookie` с теми же опциями.
- Вход: одно сообщение «Неверная почта или пароль» и для чужой почты, и для
  неверного пароля, и для отключённого — не выдаём, кто зарегистрирован.
- Регистрация — только клиенты (`role` в теле отклоняется ValidationPipe);
  сотрудников создаёт админ. Почта хранится в нижнем регистре, пробелы по
  краям обрезает `@Trim()`.
- Лимит: `ThrottlerGuard` на входе и регистрации, 10 запросов в минуту с IP.
- Первый админ — `pnpm db:seed` из `ADMIN_EMAIL` и `ADMIN_PASSWORD`; пароль
  существующему пользователю сиды не меняют.
- `GET /auth/me` — текущий пользователь; им пользуется фронт для redirect.

### Матрица доступа (новая ручка — строка здесь в том же PR)

Пути — без префикса `/api`. Колонка «Есть» — ручка уже в коде.

| Ручка | Есть | Public | client | barista | manager | admin |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /health` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `GET /menu` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `GET /auth/me` | ✔ | | ✔ | ✔ | ✔ | ✔ |
| `GET /users/staff` | ✔ | | | | | ✔ |
| `POST/PATCH/DELETE /menu/items` | | | | | ✔ | ✔ |
| `PATCH /menu/items/:id/stop-list` | | | | | ✔ | ✔ |
| `POST /orders` | | | ✔ | | | |
| `GET /orders/my` | | | ✔ | | | |
| `GET /orders/queue` | | | | ✔ | ✔ | ✔ |
| `PATCH /orders/:id/status` | | | | ✔ | ✔ | ✔ |
| `GET /stats/sales` | | | | | ✔ | ✔ |
| `POST/PATCH /users` (создать сотрудника, сменить роль) | | | | | | ✔ |

## 3. API и ошибки

- Префикс `/api` и Swagger (есть): UI — `/api/docs`, JSON — `/api/docs-json`.
  Тот же документ без запуска сервера — `pnpm openapi:export`.
- Ответ — DTO ответа без обёртки; список без пагинации — массив
  (`GET /menu` → `MenuCategoryDto[]`).
- Пути — существительные во множественном числе, `kebab-case`; поля JSON —
  `camelCase` (как в Prisma и TS).
- Списки с пагинацией — `{ items, total, page, pageSize }`.
- Ошибки — исключения Nest (`NotFoundException`, `ForbiddenException`,
  `ConflictException`) с русским `message`; HTTP-статус несёт смысл, тело 200
  с ошибкой не отдаётся.
- Позиция в стоп-листе при заказе — `409 Conflict` с понятным сообщением.
- Ломающее изменение DTO — в описании PR, чтобы фронт перегенерировал типы.

## 4. БД и Prisma

- Модели (есть): `MenuCategory` (slug, name, sortOrder), `MenuItem`
  (name, description, portion, price, imageUrl, inStopList, sortOrder).
  Наружу `inStopList` уходит как `isAvailable` — видна, но не заказать.
- Модели (план): `User` (email, passwordHash, role, name) — этап 3,
  `Order` (userId, status, total, comment, pickupAt) и `OrderItem`
  (menuItemId, qty, price на момент заказа) — этап 5.
- Таблицы и колонки — `snake_case` через `@@map`/`@map`, поля в коде — `camelCase`.
- Цена в `OrderItem` копируется при создании: правка меню не меняет старые
  заказы.
- Деньги — `Int` в целых тенге, не `Float`.
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
| `JWT_SECRET` | подпись JWT, минимум 32 символа | ✔ |
| `JWT_TTL_SECONDS` | срок токена и cookie, по умолчанию 604800 (7 дней) | ✔ |
| `COOKIE_DOMAIN` | домен cookie в проде (`.cofelier.kz`); пусто — текущий хост | ✔ |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | первый админ для `pnpm db:seed` (не для приложения) | ✔ |

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
