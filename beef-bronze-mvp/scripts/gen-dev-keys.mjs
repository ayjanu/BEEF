#!/usr/bin/env node
// Generates local-only secrets for docker compose:
//   - an ES256 (P-256) keypair: core-api signs access tokens, every service verifies
//   - an internal service token for service-to-service calls
// Writes .env (gitignored). In AWS these come from Secrets Manager via Terraform.
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const envPath = new URL('../.env', import.meta.url);
if (existsSync(envPath) && !process.argv.includes('--force')) {
  console.log('.env already exists; pass --force to regenerate');
  process.exit(0);
}

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const priv = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const pub = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const oneLine = (pem) => pem.trim().replace(/\n/g, '\\n');

const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const env = example
  .replace(/^JWT_PRIVATE_KEY=.*$/m, `JWT_PRIVATE_KEY="${oneLine(priv)}"`)
  .replace(/^JWT_PUBLIC_KEY=.*$/m, `JWT_PUBLIC_KEY="${oneLine(pub)}"`)
  .replace(/^INTERNAL_TOKEN=.*$/m, `INTERNAL_TOKEN=${randomBytes(24).toString('hex')}`)
  .replace(/^PII_HASH_KEY=.*$/m, `PII_HASH_KEY=${randomBytes(32).toString('hex')}`)
  .replace(/^SECRET_KEY_BASE=.*$/m, `SECRET_KEY_BASE=${randomBytes(48).toString('base64url')}`);

writeFileSync(envPath, env, { mode: 0o600 });
console.log('wrote .env with a fresh ES256 keypair, internal token, PII hash key, and chat secret');
