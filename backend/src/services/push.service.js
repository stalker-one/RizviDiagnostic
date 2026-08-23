// Sends Firebase Cloud Messaging pushes to every registered Android device
// (both the Staff and Superadmin apps) so a patient/invoice created from
// anywhere -- the website, the Windows app, or either Android app -- shows
// up as a real-time notification on Android even if that app is fully
// closed. This only works while the app is closed because FCM delivery is
// handled by Google Play services at the OS level, not by the app polling.
//
// Requires a Firebase service account key, provided via the
// FIREBASE_SERVICE_ACCOUNT_JSON environment variable (the full JSON key
// content as a string) on whatever host runs this backend. Deliberately not
// committed to the repo -- it grants full send access to the Firebase
// project. If that variable isn't set, push sending is skipped with a single
// warning at startup rather than crashing the server; every other feature
// keeps working normally.
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
  console.warn(`[push] Push notifications are disabled: ${initError}. Patient/invoice creation will still work normally.`);
}

function isEnabled() {
  return !initError && !!messagingApp;
}

/**
 * Sends a data-only push (title/body/extra fields all passed as string
 * "data", not FCM's built-in "notification" payload) to registered devices.
 * The Android apps render the notification themselves from this data, which
 * is what makes it work reliably whether the app is foregrounded,
 * backgrounded, or fully closed.
 *
 * @param {string} [appVariant] - When set ('staff' or 'superadmin'), only
 *   sends to devices registered for that variant -- used for update
 *   notifications, since a Staff-app update isn't relevant to a Superadmin
 *   device and vice versa. Left unset, sends to every registered device
 *   regardless of variant -- used for patient/invoice notifications, which
 *   both apps' users may want to see.
 */
async function sendPush(title, body, data = {}, appVariant) {
  if (!isEnabled()) return;
  try {
    const allTokens = (await getFreshTable('pushTokens', readTable('pushTokens'))) || [];
    const tokens = appVariant ? allTokens.filter((t) => t.appVariant === appVariant) : allTokens;
    if (!tokens.length) return;
    const dataPayload = { title: String(title), body: String(body) };
    Object.keys(data).forEach((k) => { dataPayload[k] = String(data[k]); });
    const { getMessaging } = require('firebase-admin/messaging');
    const response = await getMessaging(messagingApp).sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      data: dataPayload,
      android: { priority: 'high' },
    });
    // Prune tokens FCM reports as no-longer-valid (app uninstalled, token
    // rotated, etc.) so the list doesn't grow unbounded with dead entries.
    // Operates against the full unfiltered list so an appVariant-scoped
    // send doesn't accidentally drop unrelated tokens for the other app.
    const invalidTokens = new Set();
    tokens.forEach((t, i) => {
      const result = response.responses[i];
      if (result.success) return;
      const code = result.error?.code || '';
      if (code.includes('registration-token-not-registered') || code.includes('invalid-argument')) invalidTokens.add(t.token);
    });
    if (invalidTokens.size) writeTable('pushTokens', allTokens.filter((t) => !invalidTokens.has(t.token)));
  } catch (err) {
    console.warn('[push] Failed to send push notification:', err.message);
  }
}

function sendPushToAll(title, body, data = {}) {
  return sendPush(title, body, data);
}

function sendPushToVariant(appVariant, title, body, data = {}) {
  return sendPush(title, body, data, appVariant);
}

module.exports = { sendPushToAll, sendPushToVariant, isEnabled };
