package com.rizvi.diagnosticcenter;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import java.util.concurrent.Executor;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

@CapacitorPlugin(name = "BiometricAuth")
public class BiometricAuthPlugin extends Plugin {
    private static final String PREFS = "rizvi_biometric_auth";
    private static final String KEY_ALIAS = "rizvi_biometric_key";
    private static final String ENABLED = "enabled";
    private static final String TOKEN = "token";
    private static final String IV = "iv";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        BiometricManager manager = BiometricManager.from(getContext());
        int result = manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG);
        JSObject ret = new JSObject();
        ret.put("available", result == BiometricManager.BIOMETRIC_SUCCESS);
        ret.put("code", result);
        ret.put("enabled", prefs().getBoolean(ENABLED, false));
        call.resolve(ret);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        BiometricManager manager = BiometricManager.from(getContext());
        int result = manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG);
        JSObject ret = new JSObject();
        ret.put("available", result == BiometricManager.BIOMETRIC_SUCCESS);
        ret.put("enabled", prefs().getBoolean(ENABLED, false));
        ret.put("code", result);
        call.resolve(ret);
    }

    @PluginMethod
    public void enable(PluginCall call) {
        String token = call.getString("token", "");
        if (token == null || token.trim().isEmpty()) {
            call.reject("A valid login session is required before enabling fingerprint login.");
            return;
        }
        if (!isBiometricAvailable()) {
            call.reject("Fingerprint/biometric authentication is not available on this device. Please set up a fingerprint or strong biometric in Android settings.");
            return;
        }
        authenticate(call, true, token);
    }

    @PluginMethod
    public void setToken(PluginCall call) {
        String token = call.getString("token", "");
        if (!prefs().getBoolean(ENABLED, false)) {
            call.resolve();
            return;
        }
        try {
            encryptAndStore(token);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not securely update fingerprint login session.", e);
        }
    }

    @PluginMethod
    public void disable(PluginCall call) {
        prefs().edit().clear().apply();
        call.resolve();
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        if (!prefs().getBoolean(ENABLED, false)) {
            call.reject("Fingerprint login is not enabled for this device.");
            return;
        }
        if (!isBiometricAvailable()) {
            call.reject("Fingerprint/biometric authentication is not available.");
            return;
        }
        authenticate(call, false, null);
    }

    private boolean isBiometricAvailable() {
        return BiometricManager.from(getContext()).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS;
    }

    private void authenticate(final PluginCall call, final boolean enrollment, final String tokenToStore) {
        Executor executor = ContextCompat.getMainExecutor(getContext());
        BiometricPrompt.AuthenticationCallback callback = new BiometricPrompt.AuthenticationCallback() {
            @Override public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                super.onAuthenticationSucceeded(result);
                try {
                    if (enrollment) {
                        encryptAndStore(tokenToStore);
                        JSObject ret = new JSObject();
                        ret.put("enabled", true);
                        call.resolve(ret);
                    } else {
                        String token = decryptToken();
                        if (token == null || token.isEmpty()) {
                            call.reject("Saved fingerprint login session is unavailable. Please sign in with your password and enable fingerprint login again.");
                            return;
                        }
                        JSObject ret = new JSObject();
                        ret.put("token", token);
                        call.resolve(ret);
                    }
                } catch (Exception e) {
                    call.reject("Could not access the secure fingerprint login session.", e);
                }
            }
            @Override public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                super.onAuthenticationError(errorCode, errString);
                call.reject(errString.toString());
            }
            @Override public void onAuthenticationFailed() {
                super.onAuthenticationFailed();
                // Keep the biometric dialog open; Android will allow another attempt.
            }
        };
        BiometricPrompt prompt = new BiometricPrompt(getActivity(), executor, callback);
        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
            .setTitle(enrollment ? "Enable Fingerprint Login" : "Fingerprint Login")
            .setSubtitle(enrollment ? "Confirm your fingerprint to enable quick login" : "Confirm your identity to sign in")
            .setDescription("Rizvi Diagnostic Center")
            .setNegativeButtonText("Use password")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .build();
        prompt.authenticate(info);
    }

    private void ensureKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) return;
        KeyGenerator generator = KeyGenerator.getInstance("AES", "AndroidKeyStore");
        generator.init(256);
        generator.generateKey();
        KeyStore.Entry entry = keyStore.getEntry(KEY_ALIAS, null);
        // AndroidKeyStore generated key may not use the requested alias with all providers;
        // recreate explicitly if needed.
        if (entry == null) throw new IllegalStateException("Unable to create biometric encryption key");
    }

    private SecretKey getKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        KeyStore.Entry entry = keyStore.getEntry(KEY_ALIAS, null);
        if (!(entry instanceof KeyStore.SecretKeyEntry)) {
            throw new IllegalStateException("Biometric encryption key is unavailable");
        }
        return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
    }

    private void encryptAndStore(String token) throws Exception {
        if (token == null || token.isEmpty()) throw new IllegalArgumentException("Empty token");
        ensureKey();
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, getKey());
        byte[] encrypted = cipher.doFinal(token.getBytes(StandardCharsets.UTF_8));
        prefs().edit()
            .putBoolean(ENABLED, true)
            .putString(TOKEN, Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .putString(IV, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
            .apply();
    }

    private String decryptToken() throws Exception {
        String encoded = prefs().getString(TOKEN, "");
        String encodedIv = prefs().getString(IV, "");
        if (encoded.isEmpty() || encodedIv.isEmpty()) return null;
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        byte[] iv = Base64.decode(encodedIv, Base64.NO_WRAP);
        cipher.init(Cipher.DECRYPT_MODE, getKey(), new GCMParameterSpec(128, iv));
        byte[] clear = cipher.doFinal(Base64.decode(encoded, Base64.NO_WRAP));
        return new String(clear, StandardCharsets.UTF_8);
    }
}
