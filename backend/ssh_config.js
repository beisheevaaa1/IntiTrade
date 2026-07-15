import { createHash } from 'node:crypto';
import fs from 'node:fs';

function hostFingerprint(key) {
  const digest = createHash('sha256').update(Buffer.from(key)).digest('base64').replace(/=+$/u, '');
  return `SHA256:${digest}`;
}

export function createSshConfig() {
  const privateKeyPath = process.env.SSH_PRIVATE_KEY_PATH;
  const trustedFingerprints = (process.env.SSH_HOST_FINGERPRINTS || process.env.SSH_HOST_FINGERPRINT || '')
    .split(/[\s,]+/u)
    .map((value) => value.trim())
    .filter(Boolean);
  if (trustedFingerprints.length === 0 || trustedFingerprints.some((value) => !/^SHA256:[A-Za-z0-9+/]{43}$/u.test(value))) {
    throw new Error('Set SSH_HOST_FINGERPRINTS to the verified SHA-256 host key fingerprint(s)');
  }

  const port = Number.parseInt(process.env.SSH_PORT || '22', 10);
  if (!process.env.SSH_HOST || !process.env.SSH_USER || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Set a valid SSH_HOST, SSH_PORT and SSH_USER');
  }
  if (!privateKeyPath && !process.env.SSH_PASSWORD) {
    throw new Error('Set either SSH_PRIVATE_KEY_PATH or SSH_PASSWORD');
  }

  return {
    host: process.env.SSH_HOST,
    port,
    username: process.env.SSH_USER,
    hostVerifier: (key) => trustedFingerprints.includes(hostFingerprint(key)),
    ...(privateKeyPath
      ? { privateKey: fs.readFileSync(privateKeyPath) }
      : { password: process.env.SSH_PASSWORD })
  };
}

export function clearSshPassword(config) {
  delete process.env.SSH_PASSWORD;
  if ('password' in config) config.password = undefined;
}
