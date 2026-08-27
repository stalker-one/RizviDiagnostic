import { Capacitor, registerPlugin } from '@capacitor/core';

const BiometricAuth = registerPlugin('BiometricAuth');

const isAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export async function getBiometricStatus() {
  if (!isAndroid()) return { available: false, enabled: false };
  try { return await BiometricAuth.getStatus(); } catch { return { available: false, enabled: false }; }
}

export async function enableBiometricLogin(token) {
  if (!isAndroid()) throw new Error('Fingerprint login is available only in the Android application.');
  return BiometricAuth.enable({ token });
}

export async function disableBiometricLogin() {
  if (!isAndroid()) return;
  await BiometricAuth.disable();
}

export async function syncBiometricToken(token) {
  if (!isAndroid() || !token) return;
  try { await BiometricAuth.setToken({ token }); } catch { /* password login remains usable */ }
}

export async function loginWithBiometric() {
  if (!isAndroid()) throw new Error('Fingerprint login is available only in the Android application.');
  return BiometricAuth.authenticate();
}
