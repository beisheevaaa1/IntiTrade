import { Client } from 'ssh2';
import { clearSshPassword, createSshConfig } from './ssh_config.js';

const config = createSshConfig();
const projectDir = process.env.SERVER_PROJECT_DIR || '/var/www/university-marketplace';

if (!/^\/[A-Za-z0-9._/-]+$/.test(projectDir)) throw new Error('Invalid SERVER_PROJECT_DIR');

const command = [
  'set -e',
  'echo "== identity =="',
  'id',
  'echo "== project =="',
  `cd ${projectDir} && git branch --show-current && git log -1 --oneline && git remote -v && git branch -a && git status --short && git diff --stat`,
  'echo "== runtime config (secrets redacted) =="',
  `cd ${projectDir}/backend && awk -F= '/^(NODE_ENV|HOST|PORT|CLIENT_URL|API_URL|EMAIL_VERIFICATION_REQUIRED)=/{print} /^(JWT_SECRET|DATABASE_URL)=/{print $1 "=<configured,length=" length($0)-length($1)-1 ">"}' .env`,
  'echo "== processes =="',
  'systemctl status intitrade-api.service --no-pager --lines=20 2>/dev/null || true',
  'pm2 list 2>/dev/null || true',
  'echo "== listeners =="',
  'ss -lntp',
  'echo "== firewall =="',
  'ufw status verbose || true',
  'echo "== nginx upload limit =="',
  'nginx -T 2>/dev/null | grep -E "server_name|client_max_body_size|proxy_pass" || true',
  'grep -R -n -B 5 -A 40 "server_name intitrade.shop" /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null || true',
  'echo "== disk and backups =="',
  'df -h /',
  'ls -ld /var/backups/intitrade 2>/dev/null || true'
].join('; ');

const connection = new Client();
connection.on('ready', () => {
  clearSshPassword(config);
  connection.exec(command, (error, stream) => {
    if (error) throw error;
    stream.on('close', (code) => {
      connection.end();
      process.exitCode = code || 0;
    }).on('data', (data) => process.stdout.write(data));
    stream.stderr.on('data', (data) => process.stderr.write(data));
  });
}).on('error', (error) => {
  console.error(`SSH preflight failed: ${error.message}`);
  process.exitCode = 1;
}).connect(config);
