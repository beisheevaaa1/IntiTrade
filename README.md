# 🎓 IntiTrade — Buy & Sell Within INTI

> Безопасная университетская торговая площадка для студентов INTI International University

---

## 📁 Структура проекта

```
Inti_trade/
├── backend/          🛠️ Backend API (Node.js + Express + Prisma + PostgreSQL)
├── frontend/         🎨 Frontend UI (React + Vite + Tailwind CSS)
├── docs/             📚 Проектная документация
└── archive/          📦 Архивные файлы (ZIP, старый монорепо)
```

## 🚀 Быстрый старт

### 1. Запуск Backend (http://localhost:4000)
```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run seed
npm run dev
```

### 2. Запуск Frontend (http://localhost:5173)
```bash
cd frontend
npm install
npm run dev
```

## 👥 Разработчики

| Роль | Папка | Технологии |
| :--- | :--- | :--- |
| 🛠️ Backend Developer | `backend/` | Node.js, Express, TypeScript, Prisma, PostgreSQL, Socket.io, JWT |
| 🎨 Frontend Developer | `frontend/` | React, TypeScript, Vite, Tailwind CSS, Axios, Socket.io-client |

## 🔗 GitHub
https://github.com/beisheevaaa1/IntiTrade
