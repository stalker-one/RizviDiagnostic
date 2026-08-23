import { Capacitor, registerPlugin } from '@capacitor/core';

// Same native plugin App.jsx uses for update notifications -- registering
// it again here just gets the same JS proxy object, it doesn't re-register
// anything on the native side.
const AndroidUpdate = registerPlugin('AndroidUpdate');

/**
 * Posts a system notification (status bar / notification tray) on Android,
 * e.g. "Patient created" or "Invoice created". No-ops silently on web or
 * other platforms, and never throws -- a notification failing to post
 * should never block the action that triggered it (saving a patient or
 * invoice).
 */
export function notifyAndroidActivity(title, message) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
  if (typeof AndroidUpdate.notifyActivity !== 'function') return;
  AndroidUpdate.notifyActivity({ title, message }).catch(() => {});
}
