import { Client } from 'ssh2';
import dotenv from 'dotenv';

dotenv.config();

const conn = new Client();

const config = {
  host: process.env.SSH_HOST || 'localhost',
  port: parseInt(process.env.SSH_PORT || '22', 10),
  username: process.env.SSH_USER || 'root',
  password: process.env.SSH_PASSWORD
};

conn.on('ready', () => {
  console.log('SSH Client Connected. Starting Deployment...');

  const commands = [
    // 1. Бэкап переменных окружения во временную папку
    'mkdir -p /tmp/marketplace_backup',
    'cp /var/www/university-marketplace/backend/.env /tmp/marketplace_backup/backend_env 2>/dev/null || true',
    'cp /var/www/university-marketplace/frontend/.env /tmp/marketplace_backup/frontend_env 2>/dev/null || true',

    // 2. Инициализация Git, если ее нет, и обновление кода
    'cd /var/www/university-marketplace && [ -d .git ] || (git init && git remote add origin https://github.com/beisheevaaa1/IntiTrade.git)',
    'cd /var/www/university-marketplace && git fetch origin main && git reset --hard origin/main',

    // 3. Восстановление переменных окружения
    'cp /tmp/marketplace_backup/backend_env /var/www/university-marketplace/backend/.env 2>/dev/null || true',
    'cp /tmp/marketplace_backup/frontend_env /var/www/university-marketplace/frontend/.env 2>/dev/null || true',
    'rm -rf /tmp/marketplace_backup',

    // 4. Сборка Backend и применение миграций
    'cd /var/www/university-marketplace/backend && npm install --no-audit --no-fund',
    'cd /var/www/university-marketplace/backend && npx prisma generate',
    'cd /var/www/university-marketplace/backend && npx prisma migrate deploy',
    'cd /var/www/university-marketplace/backend && npm run build',

    // 5. Сборка Frontend
    'cd /var/www/university-marketplace/frontend && npm install --no-audit --no-fund',
    'cd /var/www/university-marketplace/frontend && npm run build',

    // 6. Перезапуск API в PM2
    'pm2 restart university-marketplace-api || pm2 start dist/index.js --name "university-marketplace-api" --cwd "/var/www/university-marketplace/backend"',
    'pm2 save',
    
    // 7. Итоговый статус
    'pm2 list'
  ];

  executeCommands(commands);
}).connect(config);

function executeCommands(list) {
  if (list.length === 0) {
    console.log('Deployment completed successfully!');
    conn.end();
    return;
  }

  const cmd = list.shift();
  console.log(`\nExecuting: ${cmd}`);

  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(`Error executing command: ${cmd}`, err);
      conn.end();
      return;
    }

    stream.on('close', (code, signal) => {
      if (code !== 0) {
        console.warn(`Command exited with code: ${code}`);
      }
      executeCommands(list);
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}
