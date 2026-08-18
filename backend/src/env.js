// Robust environment loading + safe fallbacks.
//
// This module MUST be required before anything else that reads process.env
// (db.js, the route handlers, etc.). It makes the API boot correctly whether
// it's launched inside the v0 sandbox, on a plain PC via `npm start`, or from
// the Electron desktop wrapper — each of which exposes environment variables
// in a slightly different place.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Pull values from every location one might live in, WITHOUT overriding
// anything already set in the real process environment (so a proper
// production deployment always wins over these dev/sandbox files).
const ENV_FILES = [
  path.join(__dirname, '../.env'), // backend/.env (self-hosted / Electron)
  path.join(__dirname, '../../.env.development.local'), // project root (v0 preview + Vite)
  path.join(__dirname, '../../.env'), // project root .env
  '/vercel/share/.env.project', // v0 sandbox mirror
];

for (const file of ENV_FILES) {
  try {
    if (fs.existsSync(file)) {
      dotenv.config({ path: file, override: false });
    }
  } catch {
    // Ignore unreadable/malformed env files — defaults below keep us running.
  }
}

// Sensible defaults for values that may be unset or empty in the environment.
if (!process.env.MONGODB_DB_NAME) process.env.MONGODB_DB_NAME = 'rizvi_diagnostic_center';
if (!process.env.JWT_EXPIRES_IN) process.env.JWT_EXPIRES_IN = '12h';
if (!process.env.CLINIC_NAME) process.env.CLINIC_NAME = 'Rizvi Diagnostic Center';

// JWT signing secret. Prefer a real configured secret; if none is set (as in
// this sandbox, where JWT_SECRET came through empty), fall back to a
// locally-persisted random secret. Persisting it means issued tokens stay
// valid across server restarts instead of crashing jwt.sign() or silently
// logging everyone out on every reboot.
if (!process.env.JWT_SECRET) {
  try {
    const isServerless =
      process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.NOW_REGION;
    const secretDir = process.env.RDC_DATA_DIR
      ? process.env.RDC_DATA_DIR
      : isServerless
        ? path.join('/tmp', 'rdc-data')
        : path.join(__dirname, 'data');
    const secretFile = path.join(secretDir, '.jwt-secret');
    if (fs.existsSync(secretFile)) {
      process.env.JWT_SECRET = fs.readFileSync(secretFile, 'utf8').trim();
    } else {
      const generated = crypto.randomBytes(48).toString('hex');
      fs.mkdirSync(path.dirname(secretFile), { recursive: true });
      fs.writeFileSync(secretFile, generated, 'utf8');
      process.env.JWT_SECRET = generated;
    }
    console.warn(
      '[env] JWT_SECRET was not set — using a locally-persisted development secret. Set a real JWT_SECRET in production.'
    );
  } catch {
    process.env.JWT_SECRET = 'rizvi-diagnostic-insecure-dev-secret-change-me';
    console.warn('[env] JWT_SECRET fallback could not be persisted; using an in-memory default.');
  }
}
