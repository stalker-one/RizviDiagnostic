package com.rizvi.diagnosticcenter;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.Executor;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "BiometricAuth")
public class BiometricAuthPlugin extends Plugin {
    private static final String PREFS = "rizvi_biometric_auth";
    private static final String KEY_ALIAS = "rizvi_biometric_key_v3";
    private static final String OLD_KEY_ALIAS_V2 = "rizvi_biometric_key_v2";
    private static final String OLD_KEY_ALIAS_V1 = "rizvi_biometric_key";
    private static final String ENABLED = "enabled";
    private static final String TOKEN = "token";
    private static final String IV = "iv";

    private SharedPreferences prefs() { return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    @PluginMethod public void isAvailable(PluginCall call) { getStatus(call); }

    @PluginMethod
    public void getStatus(PluginCall call) {
        int result = biometricResult();
        boolean enabled = prefs().getBoolean(ENABLED, false);
        if (enabled && !hasUsableKey()) { clearBiometricState(); enabled = false; }
        JSObject ret = new JSObject();
        ret.put("available", isSupportedResult(result));
        ret.put("enabled", enabled);
        ret.put("code", result);
        ret.put("message", biometricMessage(result));
        call.resolve(ret);
    }

    @PluginMethod
    public void enable(PluginCall call) {
        String token = call.getString("token", "");
        if (token == null || token.trim().isEmpty()) { call.reject("Please sign in with your password before enabling fingerprint login."); return; }
        int result = biometricResult();
        if (!isSupportedResult(result)) { call.reject(biometricMessage(result)); return; }
        try {
            deleteKey(OLD_KEY_ALIAS_V2);
            deleteKey(OLD_KEY_ALIAS_V1);
            deleteKey(KEY_ALIAS);
            ensureKey();
        } catch (Exception e) { call.reject("Unable to prepare secure fingerprint storage.", e); return; }
        authenticate(call, true, token);
    }

    @PluginMethod
    public void setToken(PluginCall call) { call.reject("Fingerprint session must be re-enabled after a password login."); }

    @PluginMethod
    public void disable(PluginCall call) { clearBiometricState(); call.resolve(); }

    @PluginMethod
    public void authenticate(PluginCall call) {
        if (!prefs().getBoolean(ENABLED, false)) { call.reject("Fingerprint login is not enabled for this device."); return; }
        int result = biometricResult();
        if (!isSupportedResult(result)) { call.reject(biometricMessage(result)); return; }
        if (!hasUsableKey()) { clearBiometricState(); call.reject("Your fingerprint security setup changed. Please sign in with your password and enable fingerprint login again."); return; }
        authenticate(call, false, null);
    }

    private int biometricResult() {
        BiometricManager manager = BiometricManager.from(getContext());
        int strong = manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG);
        if (strong == BiometricManager.BIOMETRIC_SUCCESS || strong == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) return strong;
        // Some phones expose a fingerprint sensor that is only classified as weak by
        // the Android biometric stack. The system prompt is still the correct UI and
        // handles under-display, side/power-button and rear sensors automatically.
        return manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK);
    }

    private boolean isSupportedResult(int result) { return result == BiometricManager.BIOMETRIC_SUCCESS || result == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED; }

    private String biometricMessage(int result) {
        switch (result) {
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE: return "This device has no supported biometric sensor.";
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE: return "The biometric sensor is temporarily unavailable. Please try again.";
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED: return "No supported biometric is enrolled. Add your fingerprint in Android Settings first.";
            case BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED: return "Android requires a security update before biometric login can be used.";
            case BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED: return "This Android device does not support biometric authentication.";
            default: return "Biometric authentication is not available on this device.";
        }
    }

    private void authenticate(final PluginCall call, final boolean enrollment, final String tokenToStore) {
        Executor executor = ContextCompat.getMainExecutor(getContext());
        BiometricPrompt.AuthenticationCallback callback = new BiometricPrompt.AuthenticationCallback() {
            @Override public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                super.onAuthenticationSucceeded(result);
                try {
                    if (enrollment) {
                        encryptAndStore(tokenToStore);
                        JSObject ret = new JSObject(); ret.put("enabled", true); ret.put("verified", true); call.resolve(ret);
                    } else {
                        String token = decryptToken();
                        if (token == null || token.isEmpty()) { clearBiometricState(); call.reject("Saved fingerprint login session is unavailable. Please sign in with your password and enable fingerprint login again."); return; }
                        JSObject ret = new JSObject(); ret.put("token", token); ret.put("verified", true); call.resolve(ret);
                    }
                } catch (Exception e) {
                    clearBiometricState();
                    call.reject("Fingerprint verification succeeded, but the secure login session could not be opened. Please enable fingerprint login again.", e);
                }
            }
            @Override public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                super.onAuthenticationError(errorCode, errString);
                call.reject("Biometric verification failed (" + errorCode + "): " + errString);
            }
            @Override public void onAuthenticationFailed() { super.onAuthenticationFailed(); }
        };
        BiometricPrompt prompt = new BiometricPrompt(getActivity(), executor, callback);
        BiometricPrompt.PromptInfo.Builder builder = new BiometricPrompt.PromptInfo.Builder()
            .setTitle(enrollment ? "Enable Fingerprint Login" : "Fingerprint Login")
            .setSubtitle(enrollment ? "Confirm your fingerprint to enable secure login" : "Confirm your identity to sign in")
            .setDescription("Use the fingerprint sensor on your phone. It may be under the display, on the side/power button, or on the rear of the device.")
            .setNegativeButtonText("Use password")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK);
        prompt.authenticate(builder.build());
    }

    private void ensureKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore"); keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) return;
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG);
        else builder.setUserAuthenticationValidityDurationSeconds(-1);
        generator.init(builder.build()); generator.generateKey();
    }

    private SecretKey getKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore"); keyStore.load(null);
        KeyStore.Entry entry = keyStore.getEntry(KEY_ALIAS, null);
        if (!(entry instanceof KeyStore.SecretKeyEntry)) throw new IllegalStateException("Biometric encryption key is unavailable");
        return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
    }

    private boolean hasUsableKey() {
        try { KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore"); keyStore.load(null); return keyStore.containsAlias(KEY_ALIAS) && keyStore.getEntry(KEY_ALIAS, null) instanceof KeyStore.SecretKeyEntry; }
        catch (Exception e) { return false; }
    }

    private void encryptAndStore(String token) throws Exception {
        if (token == null || token.trim().isEmpty()) throw new IllegalArgumentException("Empty token");
        ensureKey(); Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, getKey());
        byte[] encrypted = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
        prefs().edit().putBoolean(ENABLED, true).putString(TOKEN, Base64.encodeToString(encrypted, Base64.NO_WRAP)).putString(IV, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)).apply();
    }

    private String decryptToken() throws Exception {
        String encoded = prefs().getString(TOKEN, ""); String encodedIv = prefs().getString(IV, "");
        if (encoded.isEmpty() || encodedIv.isEmpty()) return null;
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, getKey(), new GCMParameterSpec(128, Base64.decode(encodedIv, Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(encoded, Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }

    private void clearBiometricState() { prefs().edit().clear().apply(); deleteKey(OLD_KEY_ALIAS_V2); deleteKey(OLD_KEY_ALIAS_V1); deleteKey(KEY_ALIAS); }
    private void deleteKey(String alias) { try { KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore"); keyStore.load(null); if (keyStore.containsAlias(alias)) keyStore.deleteEntry(alias); } catch (Exception ignored) { } }
}
