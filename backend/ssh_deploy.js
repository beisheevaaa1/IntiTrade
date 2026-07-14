import { Client } from 'ssh2';
import dotenv from 'dotenv';
import fs from 'node:fs';

dotenv.config();

const conn = new Client();
const remoteProjectDir = process.env.SERVER_PROJECT_DIR || '/var/www/university-marketplace';
const apiPort = Number.parseInt(process.env.SERVER_API_PORT || '4099', 10);
const backupRemoteChanges = process.env.BACKUP_REMOTE_CHANGES === 'true';

if (!/^\/[A-Za-z0-9._/-]+$/.test(remoteProjectDir) || !Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) {
  throw new Error('Invalid SERVER_PROJECT_DIR or SERVER_API_PORT');
}

const privateKeyPath = process.env.SSH_PRIVATE_KEY_PATH;
const config = {
  host: process.env.SSH_HOST,
  port: parseInt(process.env.SSH_PORT || '22', 10),
  username: process.env.SSH_USER,
  ...(privateKeyPath
    ? { privateKey: fs.readFileSync(privateKeyPath) }
    : { password: process.env.SSH_PASSWORD })
};

if (!config.host || !config.username || (!privateKeyPath && !process.env.SSH_PASSWORD)) {
  throw new Error('Set SSH_HOST, SSH_USER and either SSH_PRIVATE_KEY_PATH or SSH_PASSWORD');
}

conn.on('ready', () => {
  console.log('SSH Client Connected. Starting Deployment...');

  const prepareWorktree = backupRemoteChanges
    ? `cd ${remoteProjectDir} && backup_dir=/var/backups/intitrade-predeploy/$(date -u +%Y%m%dT%H%M%SZ) && mkdir -p "$backup_dir" && git diff --binary > "$backup_dir/tracked-changes.patch" && { tar -czf "$backup_dir/untracked-conflicts.tar.gz" --ignore-failed-read .gitattributes deploy 2>/dev/null || true; } && git restore -- backend/package-lock.json frontend/package-lock.json frontend/src/app/pages/Login.tsx frontend/src/app/pages/Register.tsx && if [ -e .gitattributes ]; then mv .gitattributes "$backup_dir/"; fi && if [ -d deploy ]; then mv deploy "$backup_dir/"; fi && echo "Remote changes backed up to $backup_dir"`
    : `cd ${remoteProjectDir} && test -d .git && git diff --quiet && git diff --cached --quiet`;

  const commands = [
    // Refuse dirty state by default. The explicit backup mode preserves the
    // four known hotfix files and conflicting untracked deployment files.
    prepareWorktree,
    `cd ${remoteProjectDir} && test -d .git && git diff --quiet && git diff --cached --quiet`,
    `cd ${remoteProjectDir} && git fetch origin main && if git show-ref --verify --quiet refs/heads/main; then git switch main; else git switch -c main --track origin/main; fi && git merge --ff-only origin/main`,
    `cd ${remoteProjectDir} && PROJECT_DIR=${remoteProjectDir} bash deploy/configure-production-env.sh`,

    // Reproducible installs and builds.
    `cd ${remoteProjectDir}/backend && npm ci --no-audit --no-fund`,
    `cd ${remoteProjectDir}/backend && npm run build`,
    `cd ${remoteProjectDir}/backend && npm test`,
    `cd ${remoteProjectDir}/backend && node --input-type=module -e "await import('./dist/env.js')"`,
    `cd ${remoteProjectDir}/frontend && npm ci --no-audit --no-fund`,
    `cd ${remoteProjectDir}/frontend && npm run typecheck && npm run build`,
    `cd ${remoteProjectDir} && bash deploy/configure-intitrade-nginx.sh`,

    // Back up production data, then apply checked-in migrations.
    `cd ${remoteProjectDir} && PROJECT_DIR=${remoteProjectDir} bash deploy/backup-intitrade.sh`,
    `cd ${remoteProjectDir}/backend && npx prisma migrate deploy`,

    // Restart and verify the local-only API.
    `pm2 restart university-marketplace-api --update-env || pm2 start dist/index.js --name "university-marketplace-api" --cwd "${remoteProjectDir}/backend"`,
    `for attempt in $(seq 1 20); do if curl --fail --silent http://127.0.0.1:${apiPort}/api/health >/dev/null; then exit 0; fi; sleep 1; done; echo "API health check failed" >&2; exit 1`,
    'pm2 save',
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
        console.error(`Deployment stopped: command exited with code ${code}${signal ? ` (${signal})` : ''}`);
        conn.end();
        process.exitCode = code || 1;
        return;
      }
      executeCommands(list);
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}

conn.on('error', (error) => {
  console.error('SSH connection failed:', error.message);
  process.exitCode = 1;
});
