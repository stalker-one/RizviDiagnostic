// Sends Firebase Cloud Messaging pushes to every registered Android device
// (both the Staff and Superadmin apps). Patient/invoice pushes use both a
// notification payload and data payload: Android/Google Play services can
// therefore place the notification in the system tray when the app process is
// in the background or closed, while the data is still available to the app
// when it is foregrounded.
//
// Requires FIREBASE_SERVICE_ACCOUNT_JSON on the backend host. Never commit
// the service-account JSON itself to the repository.
const { readTable, writeTable } = require('../db');
const { getFreshTable } = require('../mongo-table');

let messagingApp = null;
let initError = null;
try {
  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw && raw.trim()) {
    const serviceAccount = JSON.parse(raw);
    messagingApp = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
  } else {
    initError = 'FIREBASE_SERVICE_ACCOUNT_JSON is not set';
  }
} catch (err) {
  initError = err.message;
}

if (initError) {
  console.warn(`[push] Push notifications are disabled: ${initError}`);
}

function isEnabled() {
  return !initError && !!messagingApp;
}

async function sendPush(title, body, data = {}, appVariant) {
  if (!isEnabled()) return { enabled: false, sent: 0 };

  try {
    const allTokens = (await getFreshTable('pushTokens', readTable('pushTokens'))) || [];
    const tokens = appVariant
      ? allTokens.filter((t) => t.appVariant === appVariant)
      : allTokens;

    if (!tokens.length) return { enabled: true, sent: 0 };

    const dataPayload = {
      title: String(title),
      body: String(body),
    };
    Object.keys(data).forEach((key) => {
      dataPayload[key] = String(data[key]);
    });

    const channelId = data.type === 'update_available'
      ? 'rizvi_update_channel'
      : 'rizvi_activity_channel';

    const { getMessaging } = require('firebase-admin/messaging');
    const response = await getMessaging(messagingApp).sendEachForMulticast({
      tokens: tokens.map((t) => t.token),

      // Keep the data payload for the existing Android Firebase service.
      data: dataPayload,

      // IMPORTANT: this notification payload lets Android/Google Play
      // services display the notification in the system tray when the app
      // is backgrounded or its process is not running. The old implementation
      // sent data-only messages, which depended on onMessageReceived running.
      notification: {
        title: String(title),
        body: String(body),
      },

      android: {
        priority: 'high',
        notification: {
          channelId,
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
          visibility: 'public',
        },
      },
    });

    const invalidTokens = new Set();
    tokens.forEach((tokenRecord, index) => {
      const result = response.responses[index];
      if (result?.success) return;
      const code = result?.error?.code || '';
      if (
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-argument')
      ) {
        invalidTokens.add(tokenRecord.token);
      }
    });

    if (invalidTokens.size) {
      writeTable(
        'pushTokens',
        allTokens.filter((tokenRecord) => !invalidTokens.has(tokenRecord.token)),
      );
    }

    return {
      enabled: true,
      sent: response.successCount || 0,
      failed: response.failureCount || 0,
    };
  } catch (err) {
    console.warn('[push] Failed to send push notification:', err.message);
    return { enabled: true, sent: 0, error: err.message };
  }
}

function sendPushToAll(title, body, data = {}) {
  return sendPush(title, body, data);
}

function sendPushToVariant(appVariant, title, body, data = {}) {
  return sendPush(title, body, data, appVariant);
}

module.exports = { sendPushToAll, sendPushToVariant, isEnabled };
