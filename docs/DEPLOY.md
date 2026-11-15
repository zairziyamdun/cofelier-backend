# Деплой бэкенда — Railway

API и PostgreSQL живут в одном проекте Railway, сайт — на Vercel (см.
`cofelier-frontend/docs/DEPLOY.md`). Сборка — `Dockerfile` из корня
репозитория; при старте контейнер применяет миграции (`prisma migrate
deploy`) и запускает `node dist/main`.

## Как устроена связка с сайтом

Сайт (`*.vercel.app`) и API (`*.up.railway.app`) — разные сайты: браузер не
отправит cookie входа с одного на другой. Поэтому:

- **REST** браузер шлёт на сам сайт (`/api/...`), Next проксирует его на
  Railway (`rewrites` в `next.config.ts`). Cookie `access_token` ставится
  для домена сайта — `COOKIE_DOMAIN` на Railway **пустой**.
- **WebSocket** Vercel не проксирует: сайт берёт через прокси
  `GET /api/auth/socket-token` (JWT на 60 секунд, `purpose: 'socket'`) и
  подключается к `wss://<railway>/orders` с `auth: { token }`. Для REST такой
  токен не годится (`JwtStrategy` его отклоняет).
- CORS (REST и Socket.IO) разрешён только для `FRONTEND_URL`.

## Первый запуск

1. Railway → New Project → Deploy from GitHub → `cofelier-backend`.
2. В проекте: **+ New → Database → PostgreSQL**.
3. Сервис бэкенда → **Variables**:

   | Переменная | Значение |
   | --- | --- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` — ссылка на базу проекта, не адрес из локального `.env` |
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | новая случайная строка от 32 символов (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`) |
   | `FRONTEND_URL` | адрес сайта на Vercel, например `https://cofelier.vercel.app` (без `/` в конце) |
   | `COOKIE_DOMAIN` | не задавать |

   `PORT` Railway передаёт сам.
4. Сервис бэкенда → **Settings → Networking → Generate Domain**.
5. Проверка: `https://<домен>/api/health` → `{"status":"ok"}`.
6. Первый админ — переменные сервиса бэкенда:

   ```
   ADMIN_EMAIL=<почта админа>
   ADMIN_PASSWORD=<пароль от 12 символов>
   ```

   Railway перезапустит сервис; при старте API создаст админа (в логе
   «Админ из ADMIN_EMAIL создан»). Войти на сайте → `/admin`. После входа
   `ADMIN_PASSWORD` можно удалить: существующего админа он не трогает.

   Если эта почта уже была зарегистрирована на сайте как клиент, в логе будет
   «…не админ — не повышаю». Тогда разово добавить `ADMIN_RESET_PASSWORD=true`,
   дождаться перезапуска, войти с паролем из `ADMIN_PASSWORD` и флаг удалить.
   Забыли пароль админа — так же.
7. Меню — в панели `/admin/menu`. Демо-меню (`pnpm db:seed`) — только для
   локальной базы.

## Частые ошибки

| Симптом | Причина |
| --- | --- |
| `P1001: Can't reach database server at localhost:5432`, контейнер перезапускается | `DATABASE_URL` скопирован из локального `.env`; нужен `${{Postgres.DATABASE_URL}}` |
| Падает на старте с `Неверные переменные окружения: JWT_SECRET` | не задан или короче 32 символов |
| На сайте после входа снова страница входа | сайт ходит в API напрямую, а не через `/api` своего домена; на Vercel не задан `BACKEND_URL` или старая сборка |
| Очередь заказов «Нет связи» | `FRONTEND_URL` на Railway не совпадает с адресом сайта (CORS Socket.IO) или на Vercel не задан `NEXT_PUBLIC_SOCKET_URL` |
| `Cannot GET /api/` | это нормально: ручки начинаются с `/api/health`, `/api/menu`… |
| Падает на старте: `ADMIN_EMAIL и ADMIN_PASSWORD задаются вместе` или `пароль админа — от 12 символов` | задана одна из двух переменных или короткий пароль |
| В логе «Аккаунт ADMIN_EMAIL уже есть, но он не админ» | почта зарегистрирована на сайте как клиент — разово `ADMIN_RESET_PASSWORD=true` |

## Обновление

Пуш в `main` → Railway пересобирает образ и перезапускает сервис; новые
миграции применяются при старте. Откат — Deployments → предыдущий деплой →
Redeploy (миграции назад не откатываются: ломающие изменения схемы — в два
шага).
