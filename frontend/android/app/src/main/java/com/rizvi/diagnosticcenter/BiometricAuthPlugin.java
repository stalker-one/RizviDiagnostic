package com.rizvi.diagnosticcenter;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

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
    private static final String KEY_ALIAS = "rizvi_biometric_key_v5";
    private static final String OLD_KEY_ALIAS_V4 = "rizvi_biometric_key_v4";
    private static final String OLD_KEY_ALIAS_V3 = "rizvi_biometric_key_v3";
    private static final String OLD_KEY_ALIAS_V2 = "rizvi_biometric_key_v2";
    private static final String OLD_KEY_ALIAS_V1 = "rizvi_biometric_key";
    private static final String ENABLED = "enabled";
    private static final String TOKEN = "token";
    private static final String IV = "iv";

    private BiometricPrompt activePrompt;

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        getStatus(call);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        try {
            int result = biometricResult();
            boolean enabled = prefs().getBoolean(ENABLED, false);
            if (enabled && !hasUsableKey()) {
                clearBiometricState();
                enabled = false;
            }

            JSObject ret = new JSObject();
            ret.put("available", result == BiometricManager.BIOMETRIC_SUCCESS);
            ret.put("enabled", enabled);
            ret.put("code", result);
            ret.put("message", biometricMessage(result));
            ret.put("authenticators", "fingerprint/biometric");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Unable to check biometric availability. Please try again.", e);
        }
    }

    @PluginMethod
    public void enable(PluginCall call) {
        final String token = call.getString("token", "");
        if (token == null || token.trim().isEmpty()) {
            call.reject("Please sign in with your password before enabling fingerprint login.");
            return;
        }

        int result = biometricResult();
        if (result == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) {
            call.reject("No fingerprint or supported biometric is enrolled. Add your fingerprint in Android Settings, then try again.");
            return;
        }
        if (result != BiometricManager.BIOMETRIC_SUCCESS) {
            call.reject(biometricMessage(result));
            return;
        }

        try {
            // Keep the encryption key independent from the biometric class.
            // The Android system biometric prompt is the authentication gate.
            // This avoids CryptoObject/BIOMETRIC_STRONG incompatibilities on
            // devices that report their fingerprint implementation differently.
            deleteKey(OLD_KEY_ALIAS_V4);
            deleteKey(OLD_KEY_ALIAS_V3);
            deleteKey(OLD_KEY_ALIAS_V2);
            deleteKey(OLD_KEY_ALIAS_V1);
            deleteKey(KEY_ALIAS);
            ensureKey();
        } catch (Exception e) {
            call.reject("Unable to prepare secure fingerprint login. Please try again.", e);
            return;
        }

        showBiometricPrompt(call, true, token);
    }

    @PluginMethod
    public void setToken(PluginCall call) {
        String token = call.getString("token", "");
        if (!prefs().getBoolean(ENABLED, false)) {
            call.resolve();
            return;
        }
        if (token == null || token.trim().isEmpty()) {
            clearBiometricState();
            call.reject("The login session is empty. Please sign in again and enable fingerprint login.");
            return;
        }
        try {
            encryptAndStore(token);
            JSObject ret = new JSObject();
            ret.put("updated", true);
            call.resolve(ret);
        } catch (Exception e) {
            clearBiometricState();
            call.reject("The fingerprint login session could not be updated. Please enable fingerprint login again.", e);
        }
    }

    @PluginMethod
    public void disable(PluginCall call) {
        clearBiometricState();
        call.resolve();
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        if (!prefs().getBoolean(ENABLED, false)) {
            call.reject("Fingerprint login is not enabled on this device.");
            return;
        }

        int result = biometricResult();
        if (result != BiometricManager.BIOMETRIC_SUCCESS) {
            call.reject(biometricMessage(result));
            return;
        }

        if (!hasUsableKey() || prefs().getString(TOKEN, "").isEmpty() || prefs().getString(IV, "").isEmpty()) {
            clearBiometricState();
            call.reject("Your saved fingerprint login is unavailable. Please sign in with your password and enable fingerprint login again.");
            return;
        }

        showBiometricPrompt(call, false, null);
    }

    private int biometricResult() {
        // BIOMETRIC_WEAK is intentionally used for compatibility. Android's
        // system prompt decides which enrolled biometric sensor to use.
        return BiometricManager.from(getContext()).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK);
    }

    private String biometricMessage(int result) {
        switch (result) {
            case BiometricManager.BIOMETRIC_SUCCESS:
                return "Biometric authentication is ready.";
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                return "This device has no supported biometric sensor.";
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:
                return "The biometric sensor is temporarily unavailable. Please try again.";
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                return "No fingerprint or supported biometric is enrolled. Add a fingerprint in Android Settings first.";
            case BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED:
                return "Android requires a security update before biometric login can be used.";
            case BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED:
                return "This Android device does not support biometric authentication.";
            default:
                return "Biometric authentication is not available on this device.";
        }
    }

    private void showBiometricPrompt(final PluginCall call, final boolean enrollment, final String tokenToStore) {
        try {
            Activity activity = getActivity();
            if (!(activity instanceof FragmentActivity)) {
                call.reject("The current Android screen cannot open the biometric prompt. Please restart the app and try again.");
                return;
            }
            if (activity.isFinishing() || (android.os.Build.VERSION.SDK_INT >= 17 && activity.isDestroyed())) {
                call.reject("The Android screen is closing. Please reopen the app and try again.");
                return;
            }

            final FragmentActivity fragmentActivity = (FragmentActivity) activity;
            final Executor executor = ContextCompat.getMainExecutor(getContext());

            final BiometricPrompt.AuthenticationCallback callback = new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                    super.onAuthenticationSucceeded(result);
                    try {
                        if (enrollment) {
                            encryptAndStore(tokenToStore);
                            JSObject ret = new JSObject();
                            ret.put("enabled", true);
                            ret.put("verified", true);
                            ret.put("sensor", "android-system-biometric");
                            call.resolve(ret);
                        } else {
                            String token = decryptToken();
                            if (token == null || token.isEmpty()) {
                                clearBiometricState();
                                call.reject("Saved fingerprint login is unavailable. Please sign in with your password and enable fingerprint login again.");
                                return;
                            }
                            JSObject ret = new JSObject();
                            ret.put("token", token);
                            ret.put("verified", true);
                            ret.put("sensor", "android-system-biometric");
                            call.resolve(ret);
                        }
                    } catch (Exception e) {
                        clearBiometricState();
                        call.reject("Fingerprint verification succeeded, but the secure login session could not be accessed. Please enable fingerprint login again.", e);
                    } finally {
                        activePrompt = null;
                    }
                }

                @Override
                public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                    super.onAuthenticationError(errorCode, errString);
                    activePrompt = null;
                    call.reject("Biometric verification cancelled or failed (" + errorCode + "): " + errString);
                }

                @Override
                public void onAuthenticationFailed() {
                    super.onAuthenticationFailed();
                    // Keep the request alive so Android can accept another attempt.
                }
            };

            final BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(enrollment ? "Enable Fingerprint Login" : "Fingerprint Login")
                .setSubtitle(enrollment ? "Confirm your fingerprint to enable secure login" : "Confirm your identity to sign in")
                .setDescription("Follow the Android biometric prompt. Your fingerprint sensor may be under the display, on the side/power button, or on the rear of the phone.")
                .setNegativeButtonText("Use password")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                .build();

            activePrompt = new BiometricPrompt(fragmentActivity, executor, callback);
            fragmentActivity.runOnUiThread(() -> {
                try {
                    if (fragmentActivity.isFinishing() || (android.os.Build.VERSION.SDK_INT >= 17 && fragmentActivity.isDestroyed())) {
                        activePrompt = null;
                        call.reject("The Android screen is no longer active. Please try again.");
                        return;
                    }
                    activePrompt.authenticate(promptInfo);
                } catch (Exception e) {
                    activePrompt = null;
                    call.reject("Android could not open the biometric prompt. Please restart the app and try again.", e);
                }
            });
        } catch (Exception e) {
            activePrompt = null;
            call.reject("Android could not start biometric authentication. Please restart the app and try again.", e);
        }
    }

    private void ensureKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) return;

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build());
        generator.generateKey();
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

    private boolean hasUsableKey() {
        try {
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
            return keyStore.containsAlias(KEY_ALIAS)
                && keyStore.getEntry(KEY_ALIAS, null) instanceof KeyStore.SecretKeyEntry;
        } catch (Exception e) {
            return false;
        }
    }

    private void encryptAndStore(String token) throws Exception {
        if (token == null || token.trim().isEmpty()) throw new IllegalArgumentException("Empty token");
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
        cipher.init(Cipher.DECRYPT_MODE, getKey(), new GCMParameterSpec(128, Base64.decode(encodedIv, Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(encoded, Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }

    private void clearBiometricState() {
        prefs().edit().clear().apply();
        deleteKey(OLD_KEY_ALIAS_V4);
        deleteKey(OLD_KEY_ALIAS_V3);
        deleteKey(OLD_KEY_ALIAS_V2);
        deleteKey(OLD_KEY_ALIAS_V1);
        deleteKey(KEY_ALIAS);
    }

    private void deleteKey(String alias) {
        try {
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
            if (keyStore.containsAlias(alias)) keyStore.deleteEntry(alias);
        } catch (Exception ignored) { }
    }
}
