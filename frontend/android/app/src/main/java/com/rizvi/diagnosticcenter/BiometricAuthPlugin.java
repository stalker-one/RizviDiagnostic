package com.rizvi.diagnosticcenter;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;
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
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
import java.util.UUID;
import java.util.concurrent.Executor;
import android.util.Base64;

@CapacitorPlugin(name = "BiometricAuth")
public class BiometricAuthPlugin extends Plugin {
    private static final String PREFS = "rizvi_biometric_auth";
    private static final String ACTIVE_ALIAS_KEY = "active_key_alias";
    private static final String ACTIVE_CREDENTIAL_KEY = "active_credential_id";
    private static final String PENDING_ALIAS_KEY = "pending_key_alias";
    private static final String PENDING_CREDENTIAL_KEY = "pending_credential_id";
    private BiometricPrompt activePrompt;

    private SharedPreferences prefs() { return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    private String deviceId() { return Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID); }
    private String activeAlias() { return prefs().getString(ACTIVE_ALIAS_KEY, ""); }
    private String pendingAlias() { return prefs().getString(PENDING_ALIAS_KEY, ""); }

    @PluginMethod public void isAvailable(PluginCall call) { getStatus(call); }

    @PluginMethod public void getStatus(PluginCall call) {
        try {
            int result = biometricResult();
            String alias = activeAlias();
            String credential = prefs().getString(ACTIVE_CREDENTIAL_KEY, "");
            boolean enabled = !alias.isEmpty() && !credential.isEmpty() && hasKey(alias);
            if (!enabled && (!alias.isEmpty() || !credential.isEmpty())) clearActiveOnly();
            JSObject ret = new JSObject();
            ret.put("available", result == BiometricManager.BIOMETRIC_SUCCESS);
            ret.put("enabled", enabled);
            ret.put("code", result);
            ret.put("message", biometricMessage(result));
            ret.put("authenticators", "fingerprint/biometric");
            ret.put("deviceId", deviceId());
            call.resolve(ret);
        } catch (Exception e) { call.reject("Unable to check biometric availability. Please try again.", e); }
    }

    @PluginMethod public void prepareEnrollment(PluginCall call) {
        try {
            int result = biometricResult();
            if (result == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) { call.reject("No fingerprint or supported biometric is enrolled. Add your fingerprint in Android Settings, then try again."); return; }
            if (result != BiometricManager.BIOMETRIC_SUCCESS) { call.reject(biometricMessage(result)); return; }
            discardEnrollmentInternal();
            String alias = "rizvi_biometric_pending_" + UUID.randomUUID();
            String credentialId = UUID.randomUUID().toString();
            KeyPair pair = generateKey(alias);
            prefs().edit().putString(PENDING_ALIAS_KEY, alias).putString(PENDING_CREDENTIAL_KEY, credentialId).apply();
            JSObject ret = new JSObject();
            ret.put("credentialId", credentialId);
            ret.put("deviceId", deviceId());
            ret.put("publicKey", Base64.encodeToString(pair.getPublic().getEncoded(), Base64.NO_WRAP));
            call.resolve(ret);
        } catch (Exception e) { call.reject("Unable to prepare secure fingerprint registration. Please try again.", e); }
    }

    @PluginMethod public void signChallenge(PluginCall call) {
        final String challenge = call.getString("challenge", "");
        final boolean enrollment = call.getBoolean("enrollment", false);
        if (challenge == null || challenge.trim().isEmpty()) { call.reject("Biometric challenge is empty."); return; }
        final String alias = enrollment ? pendingAlias() : activeAlias();
        final String credential = enrollment ? prefs().getString(PENDING_CREDENTIAL_KEY, "") : prefs().getString(ACTIVE_CREDENTIAL_KEY, "");
        if (alias.isEmpty() || credential.isEmpty() || !hasKey(alias)) { call.reject("Fingerprint registration is unavailable. Please continue with your email and password."); return; }
        int result = biometricResult();
        if (result != BiometricManager.BIOMETRIC_SUCCESS) { call.reject(biometricMessage(result)); return; }
        showSigningPrompt(call, alias, credential, challenge);
    }

    @PluginMethod public void commitEnrollment(PluginCall call) {
        String nextAlias = pendingAlias();
        String nextCredential = prefs().getString(PENDING_CREDENTIAL_KEY, "");
        if (nextAlias.isEmpty() || nextCredential.isEmpty() || !hasKey(nextAlias)) { call.reject("Fingerprint enrollment is not ready to be activated."); return; }
        String oldAlias = activeAlias();
        if (!oldAlias.isEmpty() && !oldAlias.equals(nextAlias)) deleteKey(oldAlias);
        prefs().edit().putString(ACTIVE_ALIAS_KEY, nextAlias).putString(ACTIVE_CREDENTIAL_KEY, nextCredential).remove(PENDING_ALIAS_KEY).remove(PENDING_CREDENTIAL_KEY).apply();
        JSObject ret = new JSObject(); ret.put("enabled", true); ret.put("verified", true); ret.put("credentialId", nextCredential); ret.put("deviceId", deviceId()); call.resolve(ret);
    }

    @PluginMethod public void discardEnrollment(PluginCall call) { discardEnrollmentInternal(); call.resolve(); }

    @PluginMethod public void getCredential(PluginCall call) {
        String alias = activeAlias(); String credential = prefs().getString(ACTIVE_CREDENTIAL_KEY, "");
        if (alias.isEmpty() || credential.isEmpty() || !hasKey(alias)) { clearActiveOnly(); call.reject("Fingerprint login is not configured on this device. Continue with your email and password."); return; }
        JSObject ret = new JSObject(); ret.put("credentialId", credential); ret.put("deviceId", deviceId()); call.resolve(ret);
    }

    @PluginMethod public void disable(PluginCall call) { clearBiometricState(); call.resolve(); }

    private void showSigningPrompt(final PluginCall call, final String alias, final String credential, final String challenge) {
        try {
            Activity activity = getActivity();
            if (!(activity instanceof FragmentActivity)) { call.reject("The current Android screen cannot open the biometric prompt. Please restart the app and try again."); return; }
            if (activity.isFinishing() || (android.os.Build.VERSION.SDK_INT >= 17 && activity.isDestroyed())) { call.reject("The Android screen is closing. Please reopen the app and try again."); return; }
            final FragmentActivity fa = (FragmentActivity) activity;
            final Executor executor = ContextCompat.getMainExecutor(getContext());
            final Signature signature = Signature.getInstance("SHA256withECDSA");
            signature.initSign(getPrivateKey(alias));
            final BiometricPrompt.AuthenticationCallback callback = new BiometricPrompt.AuthenticationCallback() {
                @Override public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                    super.onAuthenticationSucceeded(result);
                    try {
                        signature.update(challenge.getBytes(StandardCharsets.UTF_8));
                        String encodedSignature = Base64.encodeToString(signature.sign(), Base64.NO_WRAP);
                        JSObject ret = new JSObject(); ret.put("verified", true); ret.put("signature", encodedSignature); ret.put("credentialId", credential); ret.put("deviceId", deviceId()); call.resolve(ret);
                    } catch (Exception e) { call.reject("Fingerprint verification succeeded, but the secure signature could not be created. Please try again.", e); }
                    finally { activePrompt = null; }
                }
                @Override public void onAuthenticationError(int code, @NonNull CharSequence message) { super.onAuthenticationError(code, message); activePrompt = null; call.reject("Biometric verification cancelled or failed (" + code + "): " + message); }
                @Override public void onAuthenticationFailed() { super.onAuthenticationFailed(); }
            };
            final BiometricPrompt.PromptInfo prompt = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(alias.equals(pendingAlias()) ? "Enable Fingerprint Login" : "Fingerprint Login")
                .setSubtitle(alias.equals(pendingAlias()) ? "Confirm your fingerprint to enable secure login" : "Confirm your identity to sign in")
                .setDescription("Follow the Android biometric prompt. Your fingerprint sensor may be under the display, on the side/power button, or on the rear of the phone.")
                .setNegativeButtonText("Use password")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                .build();
            activePrompt = new BiometricPrompt(fa, executor, callback);
            fa.runOnUiThread(() -> {
                try {
                    if (fa.isFinishing() || (android.os.Build.VERSION.SDK_INT >= 17 && fa.isDestroyed())) { activePrompt = null; call.reject("The Android screen is no longer active. Please try again."); return; }
                    activePrompt.authenticate(prompt);
                } catch (Exception e) { activePrompt = null; call.reject("Android could not open the biometric prompt. Please restart the app and try again.", e); }
            });
        } catch (Exception e) { activePrompt = null; call.reject("Android could not start biometric authentication. Please restart the app and try again.", e); }
    }

    private int biometricResult() { return BiometricManager.from(getContext()).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK); }
    private String biometricMessage(int result) {
        switch (result) {
            case BiometricManager.BIOMETRIC_SUCCESS: return "Biometric authentication is ready.";
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE: return "This device has no supported biometric sensor.";
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE: return "The biometric sensor is temporarily unavailable. Please try again.";
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED: return "No fingerprint or supported biometric is enrolled. Add a fingerprint in Android Settings first.";
            case BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED: return "Android requires a security update before biometric login can be used.";
            case BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED: return "This Android device does not support biometric authentication.";
            default: return "Biometric authentication is not available on this device.";
        }
    }
    private KeyPair generateKey(String alias) throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC", "AndroidKeyStore");
        generator.initialize(new android.security.keystore.KeyGenParameterSpec.Builder(alias, android.security.keystore.KeyProperties.PURPOSE_SIGN)
            .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
            .setDigests(android.security.keystore.KeyProperties.DIGEST_SHA256)
            .setInvalidatedByBiometricEnrollment(true)
            .build());
        return generator.generateKeyPair();
    }
    private PrivateKey getPrivateKey(String alias) throws Exception { KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null); KeyStore.Entry entry = store.getEntry(alias, null); if (!(entry instanceof KeyStore.PrivateKeyEntry)) throw new IllegalStateException("Biometric signing key is unavailable"); return ((KeyStore.PrivateKeyEntry) entry).getPrivateKey(); }
    private boolean hasKey(String alias) { try { KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null); return store.containsAlias(alias) && store.getEntry(alias, null) instanceof KeyStore.PrivateKeyEntry; } catch (Exception e) { return false; } }
    private void discardEnrollmentInternal() { String alias = pendingAlias(); if (!alias.isEmpty()) deleteKey(alias); prefs().edit().remove(PENDING_ALIAS_KEY).remove(PENDING_CREDENTIAL_KEY).apply(); }
    private void clearActiveOnly() { String alias = activeAlias(); if (!alias.isEmpty()) deleteKey(alias); prefs().edit().remove(ACTIVE_ALIAS_KEY).remove(ACTIVE_CREDENTIAL_KEY).apply(); }
    private void clearBiometricState() { String active = activeAlias(); String pending = pendingAlias(); if (!active.isEmpty()) deleteKey(active); if (!pending.isEmpty() && !pending.equals(active)) deleteKey(pending); prefs().edit().clear().apply(); }
    private void deleteKey(String alias) { try { KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null); if (store.containsAlias(alias)) store.deleteEntry(alias); } catch (Exception ignored) {} }
}
