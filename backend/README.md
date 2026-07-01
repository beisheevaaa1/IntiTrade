# IntiTrade Backend API

> Node.js + Express + TypeScript + Prisma + PostgreSQL + Socket.io

## Быстрый старт

```bash
npm install
cp .env.example .env
# Настрой DATABASE_URL в .env на свою PostgreSQL
npx prisma generate
npx prisma migrate dev
npm run seed      # Загрузить демо-данные
npm run dev       # http://localhost:4000
```

## API Docs: `http://localhost:4000/api/docs`
