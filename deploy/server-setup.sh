#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/university-marketplace}"
DOMAIN_OR_IP="${DOMAIN_OR_IP:-adelina.adilkan.com}"
WEB_PORT="${WEB_PORT:-80}"
API_PORT="${API_PORT:-4099}"
DB_NAME="${DB_NAME:-university_marketplace}"
DB_USER="${DB_USER:-marketplace}"
DB_PASSWORD="${DB_PASSWORD:-marketplace}"
ALLOWED_EMAIL_DOMAIN="${ALLOWED_EMAIL_DOMAIN:-gmail.com}"
JWT_SECRET="${JWT_SECRET:-change-this-before-production}"

if [ "$WEB_PORT" = "80" ]; then
  PUBLIC_WEB_URL="http://${DOMAIN_OR_IP}"
else
  PUBLIC_WEB_URL="http://${DOMAIN_OR_IP}:${WEB_PORT}"
fi

if [ ! -d "$APP_DIR" ]; then
  echo "APP_DIR does not exist: $APP_DIR"
  echo "Upload or clone the project to this path first."
  exit 1
fi

apt-get update
apt-get install -y curl git nginx postgresql postgresql-contrib

if ! command -v node >/dev/null 2>&1 || ! node -v | grep -qE '^v2[0-9]\.'; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

npm install -g pm2

sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
fi
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

cat > "${APP_DIR}/apps/api/.env" <<ENV
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}?schema=public"
JWT_SECRET="${JWT_SECRET}"
JWT_EXPIRES_IN="7d"
ALLOWED_EMAIL_DOMAIN="${ALLOWED_EMAIL_DOMAIN}"
CLIENT_URL="${PUBLIC_WEB_URL}"
API_URL="${PUBLIC_WEB_URL}"
PORT="${API_PORT}"
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="University Marketplace <no-reply@marketplace.local>"
ENV

cd "$APP_DIR"
npm install
npm run prisma:generate
npm run prisma:deploy --workspace apps/api
npm run seed
npm run build

pm2 delete university-marketplace-api >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs --update-env
pm2 save

cat > /etc/nginx/sites-available/university-marketplace <<NGINX
server {
    listen ${WEB_PORT};
    server_name ${DOMAIN_OR_IP};

    root ${APP_DIR}/apps/web/dist;
    index index.html;

    location / {
        try_files \$uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:${API_PORT}/uploads/;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:${API_PORT}/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
NGINX

ln -sfn /etc/nginx/sites-available/university-marketplace /etc/nginx/sites-enabled/university-marketplace
nginx -t
systemctl reload nginx

echo "Deployment ready: ${PUBLIC_WEB_URL}"
