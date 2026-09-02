const crypto = require('crypto');

const INSTANCE_ID = `${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
const subscribers = new Set();
let lastVersion = 0;

function nextVersion() {
  const now = Date.now();
  lastVersion = Math.max(now, lastVersion + 1);
  return lastVersion;
}

function publishDataChange(table, extra = {}) {
  if (!table) return null;
  const event = {
    type: 'data.changed',
    table,
    tables: [table],
    version: nextVersion(),
    at: new Date().toISOString(),
    ...extra,
  };

  for (const subscriber of [...subscribers]) {
    try {
      subscriber(event);
    } catch (err) {
      // A disconnected response should not prevent other tabs from receiving
      // the event. The stream route removes closed subscribers independently.
      console.warn('[realtime] subscriber notification failed:', err.message);
    }
  }

  return event;
}

function subscribe(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function subscriberCount() {
  return subscribers.size;
}

module.exports = { INSTANCE_ID, publishDataChange, subscribe, subscriberCount };
