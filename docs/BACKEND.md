# Backend — техническое устройство

NestJS 11 + Prisma + PostgreSQL, REST + WebSocket. Что за продукт —
`OVERVIEW.md`, стек — `Tech-spec.md`.

В разделах помечено, что **есть** в коде и что **план** (этап N). Когда план
становится кодом — пометка снимается в том же коммите.

---

## 1. Структура

```
src/
  main.ts             bootstrap: порт 4000, ValidationPipe, CORS, cookie, Swagger   (есть: порт)
  app.module.ts       корневой модуль                                              (есть)
  config/             zod-схема env, ConfigModule                                  (план, этап 1)
  prisma/             PrismaModule, PrismaService (global)                         (план, этап 1)
  common/             декораторы @Public, @Roles, @CurrentUser; guards; фильтры    (план, этап 3)
  auth/               вход, регистрация, JWT, стратегии Passport                   (план, этап 3)
  users/              пользователи и роли                                          (план, этап 3)
  menu/               категории, позиции, цены, стоп-лист                          (план, этап 2)
  orders/             заказы, статусы, WebSocket-шлюз                              (план, этап 5)
prisma/
  schema.prisma       схема БД                                                     (план, этап 1)
  migrations/         миграции
  seed.ts             меню с примерными ценами
test/                 e2e (supertest)
docker-compose.yml    API + PostgreSQL                                             (план, этап 1)
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

- Префикс `/api` (план): `app.setGlobalPrefix('api')`; Swagger —
  `/api/docs`, JSON — `/api/docs-json`.
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

Переменные валидируются zod-схемой при старте (план, этап 1); новая
переменная — в схему и в `.env.example` в том же PR.

| Переменная | Для чего |
| --- | --- |
| `PORT` | порт API, по умолчанию 4000 |
| `DATABASE_URL` | строка подключения PostgreSQL |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | подпись и срок токена |
| `FRONTEND_URL` | разрешённый origin для CORS |

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
