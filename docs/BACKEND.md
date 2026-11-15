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
  users/              UsersService, пароли (argon2), сотрудники: список, создание,
                      смена роли, отключение                                       (есть)
  menu/               MenuService — публичное меню (GET /api/menu)                (есть)
                      MenuAdminService — правка позиций, категорий, стоп-лист,
                      порядок категорий; slug.ts — транслит для slug          (есть)
  orders/             OrdersService, OrdersGateway (/orders), order-status.ts      (есть)
socket-io.adapter.ts  Socket.IO с CORS сайта и cookie (подключается в main.ts)     (есть)
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
| `GET /auth/socket-token` (JWT на 60 с для WebSocket) | ✔ | | ✔ | ✔ | ✔ | ✔ |
| `GET /users/staff` | ✔ | | | | | ✔ |
| `GET /menu/manage` (все категории и позиции, со стоп-листом) | ✔ | | | | ✔ | ✔ |
| `POST /menu/items`, `PATCH/DELETE /menu/items/:id` | ✔ | | | | ✔ | ✔ |
| `PATCH /menu/items/:id/stop-list` | ✔ | | | | ✔ | ✔ |
| `POST /menu/categories`, `PATCH/DELETE /menu/categories/:id` | ✔ | | | | ✔ | ✔ |
| `PUT /menu/categories/order` | ✔ | | | | ✔ | ✔ |
| `POST /orders` | ✔ | | ✔ | | | |
| `GET /orders/my` (только свои) | ✔ | | ✔ | | | |
| `GET /orders/queue` | ✔ | | | ✔ | ✔ | ✔ |
| `PATCH /orders/:id/status` | ✔ | | | ✔ | ✔ | ✔ |
| WebSocket `/orders` | ✔ | | ✔ (свои заказы) | ✔ | ✔ | ✔ |
| `GET /stats/sales` | | | | | ✔ | ✔ |
| `POST /users/staff` (новый сотрудник с временным паролем) | ✔ | | | | | ✔ |
| `PATCH /users/staff/:id` (роль, `isActive`) | ✔ | | | | | ✔ |

### Сотрудники (есть)

- Только админ (`@Roles('admin')` на `UsersController`). Создаёт сотрудника с
  временным паролем (роль — бариста, менеджер или админ; клиента так не
  создать — `400`), меняет роль, отключает и включает (`isActive`).
- **Себя изменить нельзя** (`409`): ни роль, ни отключение. Так в системе
  всегда остаётся хотя бы один действующий админ — правит только админ.
- Клиента через `PATCH /users/staff/:id` не изменить — `404`.
- Новая роль и отключение действуют сразу, без перевыпуска токена: роль
  берётся из БД на каждый запрос (§2).
- Смены пароля и «забыл пароль» пока нет.

### Управление меню (есть)

- `@Roles('manager', 'admin')` на всём `MenuAdminController`.
- Новая позиция и категория — в конец (`sortOrder` = последний + 1).
- `PATCH` позиции меняет только переданные поля; пустая строка в
  `description` / `portion` — очистить (`@TrimToNull()`).
- Категорию с позициями удалить нельзя — `409`; пустую — `204`.
- Slug категории — транслит названия (`slug.ts`), дубль получает `-2`, `-3`;
  при переименовании slug не меняется, чтобы не ломать ссылки `#якорь`.
- Порядок категорий — `PUT /menu/categories/order` с id **всех** категорий,
  одной транзакцией; неполный список — `400`.
- Удаление позиции сейчас окончательное. С заказами (этап 5) позиция,
  попавшая в заказ, должна скрываться, а не удаляться — `onDelete: Restrict`
  на `OrderItem` это обеспечит.

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
- Модели (есть): `User` (email, passwordHash, role, name, isActive),
  `Order` (userId, status, total, comment, pickupAt) и `OrderItem`
  (menuItemId, name и price — копия на момент заказа, quantity).
- `MenuItem.isArchived`: позиция, которая есть в заказах, при удалении
  уходит в архив (скрыта из меню и панели, заказать нельзя), а не удаляется —
  `OrderItem.menuItem` с `onDelete: Restrict`. Категорию, где остались только
  архивные позиции, удалить нельзя (`409`), но она пустая и на сайте не видна.
- Таблицы и колонки — `snake_case` через `@@map`/`@map`, поля в коде — `camelCase`.
- Цена в `OrderItem` копируется при создании: правка меню не меняет старые
  заказы.
- Деньги — `Int` в целых тенге, не `Float`.
- Создание заказа с позициями — одна `$transaction`.
- Переход статуса — проверка допустимого перехода в сервисе
  (`new → accepted → preparing → ready → completed`, `cancelled` — из `new`
  и `accepted`).

### Заказы (есть)

- Оформляет только клиент. В запросе — `menuItemId` и `quantity`; **цен и
  суммы в запросе нет** (лишние поля — `400`), сумму и цены берёт сервер из
  меню через `MenuService.findItemsForOrder` (модуль заказов в таблицы меню
  не ходит).
- Позиция в стоп-листе или архиве — `409` с названием позиции. Повтор одной
  позиции в корзине — `400` («укажите количество»), до 20 штук и до 30 строк.
- `pickupAt` — от «сейчас» (5 минут на часы клиента) до суток вперёд; не
  передан — «как можно скорее».
- Переходы — `orders/order-status.ts`: `new → accepted → preparing → ready →
  completed`, `cancelled` — из `new` и `accepted`. Недопустимый — `409` с
  названиями статусов.
- Смена статуса — `updateMany` с условием на прежний статус: два бариста
  одновременно не переведут заказ дважды (второй получит `409`).
- Очередь — активные заказы (`new`…`ready`), старые сверху, с именем клиента.

## 5. WebSocket (есть)

- `OrdersGateway` (socket.io), namespace `/orders`. CORS и cookie —
  `SocketIoAdapter` в `main.ts` (тот же `FRONTEND_URL`, `credentials`).
- При подключении — токен из `handshake.auth.token` (сайт на другом домене:
  берёт его через `GET /auth/socket-token`, JWT на 60 с с `purpose: 'socket'`,
  для REST не годится) или cookie `access_token` из заголовка
  (`readAccessToken`, тот же домен) → `AuthService.userFromToken` (подпись, срок,
  активный пользователь). Нет — `disconnect`. Комнаты: `user:<id>` всем,
  `staff` — бариста, менеджеру, админу.
- События, **после** записи в БД:
  - `order.created` → `staff`, `StaffOrderDto`;
  - `order.updated` → `staff` — `StaffOrderDto`, `user:<владелец>` —
    `OrderDto` (без имени клиента).
- Один процесс API; несколько инстансов потребуют Redis-адаптер socket.io.

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
