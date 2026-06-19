# University Marketplace

Full-stack MVP marketplace for students: listings, services, realtime chat, favorites, reports, email verification, and admin moderation.

## Stack

- React + TypeScript + Tailwind CSS
- Node.js + Express + TypeScript
- PostgreSQL + Prisma
- Socket.io realtime chat
- JWT auth + Nodemailer verification
- PM2 + Nginx deployment target

## Local setup

```bash
npm install
cp .env.example apps/api/.env
docker compose up -d postgres
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev --workspace apps/api
npm run dev --workspace apps/web
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:4000`

Swagger API docs:

- UI: `http://localhost:4000/api/docs`
- OpenAPI JSON: `http://localhost:4000/api/docs.json`

## Demo defaults

`ALLOWED_EMAIL_DOMAIN=gmail.com` is configured for capstone demo convenience. Replace it with the real university email domain before production use.

Seeded admin credentials after `npm run seed`:

- Email: `admin@gmail.com`
- Password: `Admin12345!`

Seeded student credentials:

- Email: `diana@gmail.com`
- Password: `Student12345!`
- Email: `emil@gmail.com`
- Password: `Student12345!`

## Deployment

Use `ecosystem.config.cjs` with PM2 for the API and serve `apps/web/dist` through Nginx. See `deploy/nginx-university-marketplace.conf`.

For a self-managed Ubuntu server, upload or clone the project to `/var/www/university-marketplace`, then run:

```bash
cd /var/www/university-marketplace
DOMAIN_OR_IP=adelina.adilkan.com WEB_PORT=80 API_PORT=4000 JWT_SECRET="replace-with-secret" bash deploy/server-setup.sh
```

The default deployment URL is `http://adelina.adilkan.com`. Change `WEB_PORT` if port `80` is already used.
