// Sends Firebase Cloud Messaging pushes to every registered Android device.
// Firebase Admin must receive explicit service-account fields; passing a URL/path
// here causes Google OAuth2 initialization failures on Vercel.
const { readTable, writeTable } = require('../db');
const { getFreshTable } = require('../mongo-table');

let messagingApp = null;
let initError = null;
try {
  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw && raw.trim()) {
    const parsed = JSON.parse(raw);
    const projectId = String(parsed.project_id || parsed.projectId || '').trim();
    const clientEmail = String(parsed.client_email || parsed.clientEmail || '').trim();
    let privateKey = String(parsed.private_key || parsed.privateKey || '');
    privateKey = privateKey.replace(/\\r?\\n/g, '\n').replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email, or private_key');
    }

    messagingApp = getApps().length
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
  } else {
    initError = 'FIREBASE_SERVICE_ACCOUNT_JSON is not set';
  }
} catch (err) {
  initError = err.message;
}

if (initError) console.warn(`[push] Push notifications are disabled: ${initError}`);

function isEnabled() { return !initError && !!messagingApp; }

async function sendPush(title, body, data = {}, appVariant) {
  if (!isEnabled()) return { enabled: false, sent: 0, failed: 0, error: initError };
  try {
    const allTokens = (await getFreshTable('pushTokens', readTable('pushTokens'))) || [];
    const tokens = appVariant ? allTokens.filter((t) => t.appVariant === appVariant) : allTokens;
    if (!tokens.length) return { enabled: true, sent: 0, failed: 0 };

    const dataPayload = { title: String(title), body: String(body) };
    Object.keys(data).forEach((key) => { dataPayload[key] = String(data[key] ?? ''); });
    const channelId = data.type === 'update_available' ? 'rizvi_update_channel' : 'rizvi_activity_channel';

    const { getMessaging } = require('firebase-admin/messaging');
    const response = await getMessaging(messagingApp).sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: { title: String(title), body: String(body) },
      data: dataPayload,
      android: {
        priority: 'high',
        notification: { channelId, priority: 'high', defaultSound: true, defaultVibrateTimings: true, visibility: 'public' },
      },
    });

    const invalidTokens = new Set();
    tokens.forEach((record, index) => {
      const result = response.responses[index];
      if (result?.success) return;
      const code = result?.error?.code || '';
      if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) invalidTokens.add(record.token);
    });
    if (invalidTokens.size) writeTable('pushTokens', allTokens.filter((record) => !invalidTokens.has(record.token)));

    return { enabled: true, sent: response.successCount || 0, failed: response.failureCount || 0 };
  } catch (err) {
    console.warn('[push] Failed to send push notification:', err.message);
    return { enabled: true, sent: 0, failed: 1, error: err.message };
  }
}

function sendPushToAll(title, body, data = {}) { return sendPush(title, body, data); }
function sendPushToVariant(appVariant, title, body, data = {}) { return sendPush(title, body, data, appVariant); }
module.exports = { sendPushToAll, sendPushToVariant, isEnabled };
