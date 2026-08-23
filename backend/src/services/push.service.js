// Reliable Firebase Cloud Messaging sender for the Android applications.
// Uses the FCM HTTP v1 API with a short-lived OAuth2 access token created
// directly from the Firebase service-account JSON. This avoids the
// firebase-admin/google-auth URL/path issue seen on the Vercel runtime.
const crypto = require('crypto');
const { readTable, writeTable } = require('../db');
const { getFreshTable } = require('../mongo-table');

let credential = null;
let initError = null;
let accessToken = null;
let accessTokenExpiresAt = 0;

function loadCredential() {
  if (credential) return credential;
  if (initError) throw new Error(initError);

  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw || !String(raw).trim()) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set');
    }

    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const projectId = String(parsed.project_id || parsed.projectId || '').trim();
    const clientEmail = String(parsed.client_email || parsed.clientEmail || '').trim();
    const privateKey = String(parsed.private_key || parsed.privateKey || '')
      .replace(/\\r?\\n/g, '\n')
      .replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email, or private_key');
    }

    credential = { projectId, clientEmail, privateKey };
    return credential;
  } catch (err) {
    initError = err.message;
    throw err;
  }
}

function base64Url(value) {
  return Buffer.from(value).toString('base64')
    .replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (accessToken && accessTokenExpiresAt - 60 > now) return accessToken;

  const { clientEmail, privateKey } = loadCredential();
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = base64Url(signer.sign(privateKey));
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });

  const json = await response.json();
  if (!response.ok || !json.access_token) {
    throw new Error(`Firebase OAuth2 token request failed (${response.status}): ${json.error_description || json.error || 'no access token'}`);
  }

  accessToken = json.access_token;
  accessTokenExpiresAt = now + Number(json.expires_in || 3600);
  return accessToken;
}

async function sendToFcm(tokens, title, body, data, projectId) {
  const token = await getAccessToken();
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: tokens[0],
        notification: { title: String(title), body: String(body) },
        data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? '')])),
        android: {
          priority: 'HIGH',
          notification: {
            channel_id: data.type === 'update_available' ? 'rizvi_update_channel' : 'rizvi_activity_channel',
            sound: 'default',
            default_vibrate_timings: true,
            visibility: 'PUBLIC',
          },
        },
      },
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    const error = json?.error;
    const code = error?.status || error?.details?.[0]?.errorCode || 'FCM_ERROR';
    const err = new Error(`${code}: ${error?.message || 'FCM request failed'}`);
    err.fcmCode = code;
    throw err;
  }
  return json;
}

async function sendPush(title, body, data = {}, appVariant) {
  try {
    const { projectId } = loadCredential();
    const allTokens = (await getFreshTable('pushTokens', readTable('pushTokens'))) || [];
    const tokens = (appVariant ? allTokens.filter((t) => t.appVariant === appVariant) : allTokens)
      .filter((t) => t && t.token);
    if (!tokens.length) return { enabled: true, sent: 0, failed: 0 };

    let sent = 0;
    let failed = 0;
    const invalidTokens = new Set();

    // FCM HTTP v1 sends one registration token per request. Send independently
    // so one bad device cannot prevent the other Android application/device.
    for (const record of tokens) {
      try {
        await sendToFcm([record.token], title, body, data, projectId);
        sent += 1;
      } catch (err) {
        failed += 1;
        const code = String(err.fcmCode || err.message || '');
        if (/UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT/i.test(code)) {
          invalidTokens.add(record.token);
        }
        console.warn(`[push] FCM send failed for ${record.appVariant || 'android'} device:`, err.message);
      }
    }

    if (invalidTokens.size) {
      writeTable('pushTokens', allTokens.filter((record) => !invalidTokens.has(record.token)));
    }

    return { enabled: true, sent, failed };
  } catch (err) {
    console.warn('[push] Failed to send push notification:', err.message);
    return { enabled: false, sent: 0, failed: 1, error: err.message };
  }
}

function sendPushToAll(title, body, data = {}) {
  return sendPush(title, body, data);
}

function sendPushToVariant(appVariant, title, body, data = {}) {
  return sendPush(title, body, data, appVariant);
}

function isEnabled() {
  try {
    loadCredential();
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { sendPushToAll, sendPushToVariant, isEnabled };
