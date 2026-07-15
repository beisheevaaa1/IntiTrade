# IntiTrade

Университетская торговая площадка для студентов INTI: товары, курсы и услуги, объявления, личные сообщения, рейтинги, избранное, поддержка и обязательная модерация публикаций.

## Структура

```text
backend/   Express + TypeScript + Prisma + PostgreSQL + Socket.IO
frontend/  React + Vite + Tailwind CSS + Playwright
deploy/    атомарные релизы, Nginx, systemd, backup и monitoring
docs/      проектная документация
```

## Локальный запуск

Требования: Node.js 20+, npm и PostgreSQL 16+.

```bash
cd backend
npm ci
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run dev
```

В другом терминале:

```bash
cd frontend
npm ci
npm run dev
```

Backend доступен на `http://localhost:4000`, frontend — на `http://localhost:5173`, Swagger — на `http://localhost:4000/api/docs`.

Авторизация браузера использует host-only cookie `intitrade_session` с `HttpOnly` и `SameSite=Lax`; в production также включается `Secure`. Bearer JWT оставлен только для совместимости API-клиентов. Frontend не хранит токен в `localStorage`.

## Тестовые данные

Seed полностью удаляет данные, поэтому он запрещён в production и запускается только с явным подтверждением. Не используйте реальные пароли:

```bash
ALLOW_DESTRUCTIVE_SEED=true \
SEED_ADMIN_EMAIL=admin@example.test \
SEED_ADMIN_PASSWORD='replace-with-a-unique-test-password' \
SEED_STUDENT_PASSWORD='replace-with-another-test-password' \
npm run seed
```

Пароли seed должны иметь длину 12–72 байта. В репозитории нет стандартного пароля администратора.

## Проверки

```bash
cd backend
npm run build
npm test
npm audit --audit-level=high

cd ../frontend
npm run typecheck
npm run build
npm run test:e2e:install
npm run test:e2e
npm audit --audit-level=high
```

Playwright проверяет desktop Chromium и мобильный Pixel 7. API в E2E подменяется, поэтому тесты не создают production-данные.

GitHub Actions дополнительно проверяет Prisma, бюджет начального JavaScript, отсутствие новых credentials и каждые 15 минут выполняет production smoke-check.

## Docker только для локальной PostgreSQL

```bash
cp docker-compose.env.example .env
# задайте уникальный POSTGRES_PASSWORD в .env
docker compose up -d postgres
```

PostgreSQL публикуется только на `127.0.0.1`; файл `.env` не должен попадать в Git.

## Production и наблюдаемость

- `GET /api/health/live` — процесс API работает.
- `GET /api/health/ready` — API и PostgreSQL готовы; результат кратковременно кешируется.
- Админ-панель → **System Health** — запросы, память, WebSocket и обезличенные ошибки.
- Админ-панель → **Audit Log** — неизменяемый журнал модерации.
- Админ-панель → **Support** — обращения пользователей и ответы поддержки.
- `/support` — приватные обращения пользователя.
- Публикация появляется на площадке только после одобрения администратором.

Production API работает от отдельного системного пользователя `intitrade`, слушает только localhost и запускается через systemd. Nginx добавляет rate limits, CSP, HSTS и остальные browser security headers.

## Деплой

Перед запуском локально задаются `SSH_HOST`, `SSH_USER`, `SSH_HOST_FINGERPRINTS` и один способ входа: `SSH_PRIVATE_KEY_PATH` (предпочтительно) либо `SSH_PASSWORD`. При необходимости также задаются `SERVER_PROJECT_DIR` и `SERVER_API_PORT`.

```bash
node backend/ssh_preflight.js
node backend/ssh_deploy.js
```

Деплой закрепляет проверенные SSH fingerprints, собирает код от изолированного build-пользователя без доступа к production-БД, выполняет тесты, делает проверенный backup, применяет миграции и атомарно переключает backend/frontend releases. При ошибке readiness, Nginx или внешнего smoke-check автоматически возвращаются предыдущие релизы.

Ручной rollback на сервере:

```bash
PROJECT_DIR=/var/www/university-marketplace BACKEND_RELEASE_MODE=rollback bash deploy/build-backend-release.sh
PROJECT_DIR=/var/www/university-marketplace FRONTEND_RELEASE_MODE=rollback bash deploy/build-frontend-release.sh
systemctl restart intitrade-api.service
systemctl reload nginx
```

## Backup

`deploy/backup-intitrade.sh` создаёт PostgreSQL dump и архив uploads, проверяет их чтение и сохраняет SHA-256 checksums. По умолчанию локальные копии хранятся 14 дней в `/var/backups/intitrade`.

Для второй проверенной копии на отдельном смонтированном хранилище задайте `OFFSITE_BACKUP_DIR` при запуске скрипта или в cron-конфигурации. Каталог на том же диске не считается offsite backup.

## Безопасность конфигурации

- Никогда не добавляйте `.env`, SSH private keys, пароли или дампы БД в Git.
- После утечки credential сначала замените его в рабочей системе, затем согласованно очистите Git history.
- Production `JWT_SECRET` должен быть уникальным и содержать не менее 32 символов.
- Регистрация сейчас не требует проверки университета; домены можно ограничить через `ALLOWED_EMAIL_DOMAINS`.

Репозиторий: https://github.com/beisheevaaa1/IntiTrade
