import axios from 'axios';
import { Capacitor, registerPlugin } from '@capacitor/core';
import api from '../api/axios';

const BiometricAuth = registerPlugin('BiometricAuth');
const WINDOWS_CREDENTIAL_KEY = 'rdc_windows_biometric_credential';
const isAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
const isWindowsElectron = () => typeof window !== 'undefined' && !!window.electronBiometric;
const publicApi = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || '/api', timeout: 15000 });

async function windowsPlatformAuthenticatorAvailable() { if (!isWindowsElectron() || !window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) return false; try { return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch { return false; } }
async function getWindowsStatus() { if (!isWindowsElectron()) return { available: false, enabled: false }; try { const native = await window.electronBiometric.getStatus(); const platformAvailable = await windowsPlatformAuthenticatorAvailable(); const credential = localStorage.getItem(WINDOWS_CREDENTIAL_KEY); return { available: !!native?.available && platformAvailable, enabled: !!native?.enabled && !!credential, platform: 'windows' }; } catch { return { available: false, enabled: false, platform: 'windows' }; } }

export async function getBiometricStatus() {
  if (isWindowsElectron()) return getWindowsStatus();
  if (!isAndroid()) return { available: false, enabled: false };
  try { return await BiometricAuth.getStatus(); } catch { return { available: false, enabled: false }; }
}

async function androidStatus() { return getBiometricStatus(); }

async function enableAndroidBiometricLogin(token, portal = 'staff') {
  if (!token) throw new Error('Please sign in with your email and password first.');
  const status = await androidStatus();
  if (!status?.available) throw new Error(status?.message || 'Fingerprint authentication is not available on this Android device.');
  const prepared = await BiometricAuth.prepareEnrollment();
  if (!prepared?.credentialId || !prepared?.deviceId || !prepared?.publicKey) throw new Error('Secure Android fingerprint registration could not be prepared. Please try again.');
  const challenge = await api.post('/auth/biometric/enroll/challenge', { deviceId: prepared.deviceId, credentialId: prepared.credentialId, publicKey: prepared.publicKey, portal });
  const signed = await BiometricAuth.signChallenge({ challenge: challenge.data.challenge, enrollment: true });
  if (!signed?.verified || !signed?.signature) throw new Error('Fingerprint verification was not completed. Fingerprint login was not enabled.');
  try {
    await api.post('/auth/biometric/enroll/complete', { challengeId: challenge.data.challengeId, deviceId: prepared.deviceId, credentialId: prepared.credentialId, signature: signed.signature });
    await BiometricAuth.commitEnrollment();
    return { verified: true, enabled: true, deviceId: prepared.deviceId, credentialId: prepared.credentialId, platform: 'android' };
  } catch (error) {
    await BiometricAuth.discardEnrollment().catch(() => {});
    throw error;
  }
}

async function loginWithAndroidBiometric(portal = 'staff') {
  const status = await androidStatus();
  if (!status?.available || !status?.enabled) throw new Error('Fingerprint login is not enabled on this device. Continue with your email and password.');
  const stored = await BiometricAuth.getCredential();
  if (!stored?.credentialId || !stored?.deviceId) throw new Error('Fingerprint login is not configured on this device. Continue with your email and password.');
  // These calls deliberately use a plain axios instance. The shared api interceptor treats
  // every 401 as an expired authenticated web session, which is wrong before biometric login.
  const challenge = await publicApi.post('/auth/biometric/login/challenge', { deviceId: stored.deviceId, credentialId: stored.credentialId, portal });
  const signed = await BiometricAuth.signChallenge({ challenge: challenge.data.challenge, enrollment: false });
  if (!signed?.verified || !signed?.signature) throw new Error('Fingerprint verification was not completed. Continue with your email and password.');
  const response = await publicApi.post('/auth/biometric/login/complete', { challengeId: challenge.data.challengeId, deviceId: stored.deviceId, credentialId: stored.credentialId, signature: signed.signature });
  if (!response?.data?.token) throw new Error('Fingerprint login could not create a secure session. Continue with your email and password.');
  return { verified: true, token: response.data.token, user: response.data.user, platform: 'android' };
}

async function enableWindowsBiometricLogin(token) { if (!token) throw new Error('Please sign in with your email and password first.'); if (!(await windowsPlatformAuthenticatorAvailable())) throw new Error('Windows Hello fingerprint or another supported Windows biometric authenticator is not available on this PC.'); const challenge = crypto.getRandomValues(new Uint8Array(32)); const userId = crypto.getRandomValues(new Uint8Array(32)); const credential = await navigator.credentials.create({ publicKey: { challenge, rp: { id: 'localhost', name: 'Rizvi Diagnostic Center' }, user: { id: userId, name: 'rizvi-diagnostic-user', displayName: 'Rizvi Diagnostic Center' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', requireResidentKey: true, userVerification: 'required' }, timeout: 60000, attestation: 'none' } }); if (!credential?.rawId) throw new Error('Windows Hello verification was not completed. Windows Hello was not enabled.'); localStorage.setItem(WINDOWS_CREDENTIAL_KEY, toBase64Url(credential.rawId)); await window.electronBiometric.enable(token); return { verified: true, enabled: true, platform: 'windows' }; }
const toBase64Url = (value) => { const bytes = new Uint8Array(value); let binary = ''; bytes.forEach((byte) => { binary += String.fromCharCode(byte); }); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); };
const fromBase64Url = (value) => { const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/'); const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4); const binary = atob(padded); return Uint8Array.from(binary, (char) => char.charCodeAt(0)); };
async function loginWithWindowsBiometric() { const credentialId = localStorage.getItem(WINDOWS_CREDENTIAL_KEY); if (!credentialId) throw new Error('Windows Hello is not configured. Continue with email and password.'); if (!(await windowsPlatformAuthenticatorAvailable())) throw new Error('Windows Hello is not available. Continue with email and password.'); const challenge = crypto.getRandomValues(new Uint8Array(32)); const credential = await navigator.credentials.get({ publicKey: { challenge, rpId: 'localhost', allowCredentials: [{ type: 'public-key', id: fromBase64Url(credentialId), transports: ['internal'] }], userVerification: 'required', timeout: 60000 } }); if (!credential) throw new Error('Windows Hello verification was not completed. Continue with email and password.'); const result = await window.electronBiometric.authenticate(); if (!result?.verified || !result?.token) throw new Error('Secure Windows biometric verification failed. Continue with email and password.'); return { verified: true, token: result.token, platform: 'windows' }; }

export async function enableBiometricLogin(token, portal = 'staff') { if (isWindowsElectron()) return enableWindowsBiometricLogin(token); if (!isAndroid()) throw new Error('Biometric login is available only in the Android or Windows application.'); return enableAndroidBiometricLogin(token, portal); }
export async function disableBiometricLogin() { if (isWindowsElectron()) { localStorage.removeItem(WINDOWS_CREDENTIAL_KEY); try { await window.electronBiometric.disable(); } catch (_) {} return; } if (!isAndroid()) return; const status = await getBiometricStatus().catch(() => null); if (status?.deviceId) { try { await api.delete(`/auth/biometric/${encodeURIComponent(status.deviceId)}`); } catch (_) {} } try { await BiometricAuth.disable(); } catch (_) {} }
export async function syncBiometricToken() { /* JWTs are intentionally never stored as the Android biometric secret. */ }
export async function loginWithBiometric(portal = 'staff') { if (isWindowsElectron()) return loginWithWindowsBiometric(); if (!isAndroid()) throw new Error('Biometric login is available only in the Android or Windows application.'); return loginWithAndroidBiometric(portal); }
