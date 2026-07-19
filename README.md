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

На Windows весь проект можно запустить одной командой из корня репозитория:

```powershell
.\manage.ps1
```

Скрипт устанавливает отсутствующие зависимости, применяет Prisma migrations и запускает backend и frontend в фоне. Доступные команды:

```powershell
.\manage.ps1 start                 # Запустить проект (команда по умолчанию)
.\manage.ps1 stop                  # Остановить проект и управляемую Docker PostgreSQL
.\manage.ps1 restart               # Перезапустить
.\manage.ps1 status                # Показать состояние
.\manage.ps1 logs                  # Последние строки логов
.\manage.ps1 logs -Follow          # Следить за логами
.\manage.ps1 start -OpenBrowser    # Запустить и открыть сайт
.\manage.ps1 start -Database docker   # Явно использовать Docker PostgreSQL
.\manage.ps1 start -Database external # Использовать PostgreSQL из backend/.env
```

В режиме `auto` существующая доступная PostgreSQL используется без Docker. Если локальная PostgreSQL недоступна, но Docker Desktop запущен, скрипт автоматически настраивает Docker PostgreSQL и сохраняет резервную копию прежнего `backend/.env` в `.manage/`. Для запрета автоматического переключения используйте `-Database external`.

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

Деплой закрепляет проверенные SSH fingerprints, собирает код от изолированного build-пользователя без доступа к production-БД, выполняет тесты, запускает опциональный read-only hook `backend/prisma/predeploy-data-checks.sql`, делает проверенный backup, применяет миграции и атомарно переключает backend/frontend releases. Predeploy hook обязан только читать данные и завершаться ошибкой при нарушении prerequisites; runner дополнительно оборачивает его в PostgreSQL `TRANSACTION READ ONLY`. Проверка выполняется до backup, повторяется сразу после него и ещё раз после остановки writes. Поэтому обычный отказ оставляет старый API и схему без изменений, а две повторные проверки закрывают race с действиями пользователей. Backend-релиз содержит неизменяемый `.schema-compatibility`, а состояние production-схемы и незавершённого перехода хранится отдельно от рабочей копии в `/var/lib/intitrade-deploy`.

Rollback выбирается по совместимости, а не только по HTTP health-check:

- до начала миграций старый backend остаётся без изменений;
- после совместимой миграции можно вернуть только релиз с тем же schema marker;
- после завершённой несовместимой миграции деплой делает roll-forward на новый проверенный backend, даже если frontend/Nginx-проверка не прошла;
- перед несовместимой миграцией API переходит в явный persistent maintenance mode и отвечает `503` с `DEPLOYMENT_MAINTENANCE`; старый upload-cleanup cron останавливается под тем же lock, который использует media cleanup;
- после завершённой миграции запускается только совместимый новый backend, а если переход прервался, maintenance сохраняется после выхода deploy-процесса и перезагрузки сервера. Старый backend не может раскрыть черновики или удалить snapshot media.

`deploy/backend-schema-compatibility` консервативно привязан к имени последней Prisma migration и меняется при каждой новой миграции; CI проверяет это правило. Поэтому совместимость никогда не предполагается автоматически, даже для миграции, которая выглядит additive. Нельзя присваивать старому релизу новый marker вручную.

Состояние безопасного восстановления на сервере:

```bash
cat /var/lib/intitrade-deploy/schema-compatibility
cat /var/lib/intitrade-deploy/schema-compatibility.pending 2>/dev/null || true
cat /var/lib/intitrade-deploy/maintenance.json 2>/dev/null || true
cat /var/www/university-marketplace/backend/runtime-current/.schema-compatibility 2>/dev/null || echo legacy
systemctl status intitrade-api.service intitrade-maintenance.service --no-pager
```

Для выхода из maintenance повторно запустите обычный deploy релиза с marker, указанным в `schema-compatibility.pending`. Скрипт повторно и идемпотентно проверит миграции, запустит совместимый backend и только после readiness уберёт maintenance marker. `build-backend-release.sh` требует `BACKEND_REQUIRED_SCHEMA_COMPATIBILITY` для activation/rollback и откажется переключать несовместимый runtime; `ExecStartPre` в systemd независимо повторяет проверку marker и блокирует запуск при pending migration. Raw-переключение symlink запрещено. Frontend rollback не меняет это правило.

## Backup

`deploy/backup-intitrade.sh` создаёт PostgreSQL dump и архив uploads, проверяет их чтение и сохраняет SHA-256 checksums. По умолчанию локальные копии хранятся 14 дней в `/var/backups/intitrade`.

Для второй проверенной копии на отдельном смонтированном хранилище задайте `OFFSITE_BACKUP_DIR` при запуске скрипта или в cron-конфигурации. Каталог на том же диске не считается offsite backup.

## Безопасность конфигурации

- Никогда не добавляйте `.env`, SSH private keys, пароли или дампы БД в Git.
- После утечки credential сначала замените его в рабочей системе, затем согласованно очистите Git history.
- Production `JWT_SECRET` должен быть уникальным и содержать не менее 32 символов.
- Production-регистрация требует демонстрационный код с экрана. Реальную отправку писем можно включить позже через `EMAIL_VERIFICATION_DELIVERY=email` после настройки SMTP.

Репозиторий: https://github.com/beisheevaaa1/IntiTrade
