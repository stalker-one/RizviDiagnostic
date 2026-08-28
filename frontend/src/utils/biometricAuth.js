import { Capacitor, registerPlugin } from '@capacitor/core';

const BiometricAuth = registerPlugin('BiometricAuth');
const WINDOWS_CREDENTIAL_KEY = 'rdc_windows_biometric_credential';

const isAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
const isWindowsElectron = () => typeof window !== 'undefined' && !!window.electronBiometric;

const toBase64Url = (value) => {
  const bytes = new Uint8Array(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const fromBase64Url = (value) => {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

async function windowsPlatformAuthenticatorAvailable() {
  if (!isWindowsElectron() || !window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) return false;
  try { return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; }
}

async function getWindowsStatus() {
  if (!isWindowsElectron()) return { available: false, enabled: false };
  try {
    const native = await window.electronBiometric.getStatus();
    const platformAvailable = await windowsPlatformAuthenticatorAvailable();
    const credential = localStorage.getItem(WINDOWS_CREDENTIAL_KEY);
    return { available: !!native?.available && platformAvailable, enabled: !!native?.enabled && !!credential, platform: 'windows' };
  } catch { return { available: false, enabled: false, platform: 'windows' }; }
}

export async function getBiometricStatus() {
  if (isWindowsElectron()) return getWindowsStatus();
  if (!isAndroid()) return { available: false, enabled: false };
  try { return await BiometricAuth.getStatus(); } catch { return { available: false, enabled: false }; }
}

async function enableWindowsBiometricLogin(token) {
  if (!token) throw new Error('Please sign in with your email and password first.');
  if (!(await windowsPlatformAuthenticatorAvailable())) throw new Error('Windows Hello fingerprint or another supported Windows biometric authenticator is not available on this PC.');

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(32));
  const credential = await navigator.credentials.create({ publicKey: {
    challenge,
    rp: { id: 'localhost', name: 'Rizvi Diagnostic Center' },
    user: { id: userId, name: 'rizvi-diagnostic-user', displayName: 'Rizvi Diagnostic Center' },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', requireResidentKey: true, userVerification: 'required' },
    timeout: 60000,
    attestation: 'none',
  } });

  if (!credential?.rawId) throw new Error('Windows Hello verification was not completed. Fingerprint login was not enabled.');
  localStorage.setItem(WINDOWS_CREDENTIAL_KEY, toBase64Url(credential.rawId));
  await window.electronBiometric.enable(token);
  return { verified: true, enabled: true, platform: 'windows' };
}

async function loginWithWindowsBiometric() {
  const credentialId = localStorage.getItem(WINDOWS_CREDENTIAL_KEY);
  if (!credentialId) throw new Error('Fingerprint login is not configured. Continue with email and password.');
  if (!(await windowsPlatformAuthenticatorAvailable())) throw new Error('Windows Hello is not available. Continue with email and password.');

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const credential = await navigator.credentials.get({ publicKey: {
    challenge,
    rpId: 'localhost',
    allowCredentials: [{ type: 'public-key', id: fromBase64Url(credentialId), transports: ['internal'] }],
    userVerification: 'required',
    timeout: 60000,
  } });

  if (!credential) throw new Error('Windows Hello verification was not completed. Continue with email and password.');
  const result = await window.electronBiometric.authenticate();
  if (!result?.verified || !result?.token) throw new Error('Secure Windows biometric verification failed. Continue with email and password.');
  return { verified: true, token: result.token, platform: 'windows' };
}

export async function enableBiometricLogin(token) {
  if (isWindowsElectron()) return enableWindowsBiometricLogin(token);
  if (!isAndroid()) throw new Error('Fingerprint login is available only in the Android or Windows application.');
  return BiometricAuth.enable({ token });
}

export async function disableBiometricLogin() {
  if (isWindowsElectron()) {
    localStorage.removeItem(WINDOWS_CREDENTIAL_KEY);
    try { await window.electronBiometric.disable(); } catch (_) {}
    return;
  }
  if (!isAndroid()) return;
  await BiometricAuth.disable();
}

export async function syncBiometricToken(token) {
  if (!token) return;
  if (isWindowsElectron()) {
    try { if (localStorage.getItem(WINDOWS_CREDENTIAL_KEY)) await window.electronBiometric.enable(token); } catch (_) {}
    return;
  }
  if (isAndroid()) {
    try { await BiometricAuth.setToken({ token }); } catch { /* password login remains usable */ }
  }
}

export async function loginWithBiometric() {
  if (isWindowsElectron()) return loginWithWindowsBiometric();
  if (!isAndroid()) throw new Error('Fingerprint login is available only in the Android or Windows application.');
  return BiometricAuth.authenticate();
}
