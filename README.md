# 🎓 IntiTrade — Buy & Sell Within INTI

> Безопасная университетская торговая площадка для студентов INTI International University

[![Status](https://img.shields.io/badge/status-active-brightgreen)]()
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-blue)]()
[![License](https://img.shields.io/badge/license-MIT-yellow)]()

---

## 📋 О проекте

**IntiTrade** — это закрытый маркетплейс, созданный специально для студентов и сотрудников INTI International University. Платформа позволяет безопасно покупать, продавать товары и предлагать услуги внутри кампуса, обеспечивая доверие через верификацию университетского email и модерацию объявлений.

### Ключевые возможности:
- 🔒 **Регистрация только по @student.newinti.edu.my** — никаких посторонних
- 🛍️ **Товары и услуги** — продажа учебников, электроники, репетиторство
- 💬 **Чат в реальном времени (Socket.io)** — мгновенные сообщения покупатель-продавец
- 🛡️ **Модерация** — админ проверяет объявления перед публикацией
- 📍 **Безопасные зоны встреч** — рекомендации по встречам на территории кампуса
- 💰 **Без комиссий** — все сделки напрямую между студентами (валюта RM)

---

## 🏗️ Архитектура проекта

Проект организован как **монорепозиторий** с раздельными приложениями для бэкенда и фронтенда:

```
IntiTrade/
├── apps/
│   ├── api/                    ← 🛠️ BACKEND (Backend Developer)
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Схема БД (все модели)
│   │   │   ├── migrations/     # SQL миграции
│   │   │   └── seed.ts         # Начальные данные (демо-аккаунты)
│   │   ├── src/
│   │   │   ├── app.ts          # Express-приложение, middleware, CORS
│   │   │   ├── index.ts        # Точка входа сервера (порт, Socket.io)
│   │   │   ├── socket.ts       # WebSocket логика (чат)
│   │   │   ├── env.ts          # Переменные окружения
│   │   │   ├── prisma.ts       # Prisma client
│   │   │   ├── swagger.ts      # OpenAPI документация
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts     # JWT авторизация middleware
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts     # /api/auth — регистрация, вход, верификация
│   │   │   │   ├── listings.ts # /api/listings — CRUD объявлений, фильтры
│   │   │   │   ├── admin.ts    # /api/admin — модерация, блокировка
│   │   │   │   ├── conversations.ts # /api/conversations — чаты
│   │   │   │   ├── favorites.ts     # /api/favorites — избранное
│   │   │   │   ├── reports.ts       # /api/reports — жалобы
│   │   │   │   └── uploads.ts       # /api/uploads — загрузка фото
│   │   │   └── utils/          # Вспомогательные функции
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                    ← 🎨 FRONTEND (Frontend Developer)
│       ├── public/             # Статические файлы
│       ├── src/
│       │   ├── App.tsx         # Главный роутер приложения
│       │   ├── main.tsx        # Точка входа React
│       │   ├── styles.css      # Глобальные стили (Tailwind)
│       │   ├── types.ts        # TypeScript типы (Listing, User и т.д.)
│       │   ├── api/
│       │   │   └── client.ts   # Axios клиент с JWT интерцепторами
│       │   ├── components/
│       │   │   ├── Layout.tsx          # Общий шаблон навигации
│       │   │   ├── ListingCard.tsx     # Карточка товара (RM, торг)
│       │   │   └── ProtectedRoute.tsx  # Гард маршрутов авторизации
│       │   ├── pages/
│       │   │   ├── MarketplacePage.tsx   # Главная лента (фильтры, чипсы)
│       │   │   ├── ListingDetailPage.tsx # Детали товара (галерея, безопасность)
│       │   │   ├── CreateListingPage.tsx # 5-шаговый мастер создания
│       │   │   ├── MyListingsPage.tsx    # Кабинет продавца (вкладки)
│       │   │   ├── MessagesPage.tsx      # Чат-инбокс (Socket.io)
│       │   │   ├── AuthPage.tsx          # Вход / Регистрация
│       │   │   ├── VerifyEmailPage.tsx   # Подтверждение email
│       │   │   ├── FavoritesPage.tsx     # Избранные товары
│       │   │   └── AdminPage.tsx         # Админ-панель модерации
│       │   └── state/
│       │       └── AuthContext.tsx  # Глобальный контекст авторизации
│       ├── index.html
│       ├── tailwind.config.ts
│       ├── vite.config.ts
│       └── package.json
│
├── docs/                       ← 📚 ДОКУМЕНТАЦИЯ
│   ├── product-plan.md         # Полный план продукта
│   ├── final-documentation.md  # Финальная документация (для защиты)
│   ├── team-dev-plan.md        # План командной разработки
│   └── database-uml.md        # UML диаграмма базы данных
│
├── deploy/                     ← 🚀 ДЕПЛОЙ
│   ├── server-setup.sh         # Скрипт настройки сервера
│   └── nginx-*.conf            # Конфигурация Nginx
│
├── docker-compose.yml          # PostgreSQL для локальной разработки
├── ecosystem.config.cjs        # PM2 конфигурация для продакшн
├── .env.example                # Шаблон переменных окружения
├── .gitignore
└── package.json                # Корневой (npm workspaces)
```

---

## 🛠️ Технологический стек

| Слой | Технологии |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, React Router, Axios |
| **Backend** | Node.js 20+, Express, TypeScript, Socket.io, JSON Web Tokens (JWT), Nodemailer |
| **База данных** | PostgreSQL 15+, Prisma ORM |
| **Инфраструктура** | PM2, Nginx, Docker Compose (dev), Git/GitHub |

---

## 🚀 Быстрый старт (Local Setup)

### Требования:
- Node.js ≥ 20
- PostgreSQL 15+ (или Docker)
- Git

### Установка и запуск:

```bash
# 1. Клонирование репозитория
git clone https://github.com/beisheevaaa1/IntiTrade.git
cd IntiTrade

# 2. Установка зависимостей
npm install

# 3. Настройка переменных окружения
cp .env.example apps/api/.env

# 4. Запуск PostgreSQL через Docker (опционально)
docker compose up -d postgres

# 5. Генерация Prisma Client и миграции
npm run prisma:generate
npm run prisma:migrate

# 6. Загрузка тестовых данных
npm run seed

# 7. Запуск разработки (API + Web одновременно)
npm run dev
```

### Адреса разработки:
| Сервис | URL |
| :--- | :--- |
| 🎨 Frontend | `http://localhost:5173` |
| 🛠️ Backend API | `http://localhost:4000` |
| 📖 Swagger Docs | `http://localhost:4000/api/docs` |

---

## 🔐 Демо-аккаунты (после `npm run seed`)

| Роль | Email | Пароль |
| :--- | :--- | :--- |
| 🛡️ Администратор | `admin@gmail.com` | `Admin12345!` |
| 🎓 Студент 1 | `diana@gmail.com` | `Student12345!` |
| 🎓 Студент 2 | `emil@gmail.com` | `Student12345!` |

> **Примечание**: `ALLOWED_EMAIL_DOMAIN=gmail.com` используется для удобства демо. В продакшне замените на `student.newinti.edu.my`.

---

## 👥 Распределение по ролям разработчиков

| Зона ответственности | Backend Developer | Frontend Developer |
| :--- | :--- | :--- |
| **Каталог** | `routes/listings.ts`, `schema.prisma` | `MarketplacePage.tsx`, `ListingCard.tsx` |
| **Авторизация** | `routes/auth.ts`, `middleware/auth.ts` | `AuthPage.tsx`, `AuthContext.tsx` |
| **Чат** | `socket.ts`, `routes/conversations.ts` | `MessagesPage.tsx` |
| **Модерация** | `routes/admin.ts` | `AdminPage.tsx` |
| **Создание товара** | `routes/uploads.ts`, `routes/listings.ts` | `CreateListingPage.tsx` |

---

## 🚀 Продакшн деплой

```bash
# На сервере (Ubuntu):
cd /var/www/IntiTrade
DOMAIN_OR_IP=adellina.adilkan.com WEB_PORT=80 API_PORT=4099 \
  JWT_SECRET="your-secret-here" bash deploy/server-setup.sh
```

---

## 📄 Лицензия

MIT © 2026 IntiTrade Team — INTI International University
