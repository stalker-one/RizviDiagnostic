package com.rizvi.diagnosticcenter;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;
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
import java.util.UUID;
import java.util.concurrent.Executor;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name="BiometricAuth")
public class BiometricAuthPlugin extends Plugin {
 private static final String PREFS="rizvi_biometric_auth", KEY_ALIAS="rizvi_biometric_key_v6", ENABLED="enabled", TOKEN="token", IV="iv", CREDENTIAL_ID="credential_id";
 private BiometricPrompt activePrompt;
 private SharedPreferences prefs(){return getContext().getSharedPreferences(PREFS,Context.MODE_PRIVATE);}
 private String deviceId(){return Settings.Secure.getString(getContext().getContentResolver(),Settings.Secure.ANDROID_ID);}
 @PluginMethod public void isAvailable(PluginCall c){getStatus(c);}
 @PluginMethod public void getStatus(PluginCall c){try{int r=biometricResult();boolean e=prefs().getBoolean(ENABLED,false);if(e&&(!hasUsableKey()||prefs().getString(CREDENTIAL_ID,"").isEmpty())){clearBiometricState();e=false;}JSObject o=new JSObject();o.put("available",r==BiometricManager.BIOMETRIC_SUCCESS);o.put("enabled",e);o.put("code",r);o.put("message",biometricMessage(r));o.put("authenticators","fingerprint/biometric");o.put("deviceId",deviceId());c.resolve(o);}catch(Exception e){c.reject("Unable to check biometric availability. Please try again.",e);}}
 @PluginMethod public void enable(PluginCall c){final String token=c.getString("token","");if(token==null||token.trim().isEmpty()){c.reject("Please sign in with your password before enabling fingerprint login.");return;}int r=biometricResult();if(r==BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED){c.reject("No fingerprint or supported biometric is enrolled. Add your fingerprint in Android Settings, then try again.");return;}if(r!=BiometricManager.BIOMETRIC_SUCCESS){c.reject(biometricMessage(r));return;}try{deleteKey(KEY_ALIAS);ensureKey();prefs().edit().putString(CREDENTIAL_ID,UUID.randomUUID().toString()).apply();}catch(Exception e){c.reject("Unable to prepare secure fingerprint login. Please try again.",e);return;}showBiometricPrompt(c,true,token);}
 @PluginMethod public void setToken(PluginCall c){String token=c.getString("token","");if(!prefs().getBoolean(ENABLED,false)||token==null||token.trim().isEmpty()){c.resolve();return;}try{encryptAndStore(token);c.resolve();}catch(Exception e){c.reject("The fingerprint session could not be updated.",e);}}
 @PluginMethod public void getCredential(PluginCall c){if(!prefs().getBoolean(ENABLED,false)){c.reject("Fingerprint login is not enabled on this device.");return;}String id=prefs().getString(CREDENTIAL_ID,"");if(id.isEmpty()){clearBiometricState();c.reject("Fingerprint registration is unavailable. Please use email and password.");return;}JSObject o=new JSObject();o.put("credentialId",id);o.put("deviceId",deviceId());c.resolve(o);}
 @PluginMethod public void disable(PluginCall c){clearBiometricState();c.resolve();}
 @PluginMethod public void authenticate(PluginCall c){if(!prefs().getBoolean(ENABLED,false)){c.reject("Fingerprint login is not enabled on this device.");return;}int r=biometricResult();if(r!=BiometricManager.BIOMETRIC_SUCCESS){c.reject(biometricMessage(r));return;}if(!hasUsableKey()||prefs().getString(CREDENTIAL_ID,"").isEmpty()){clearBiometricState();c.reject("Your saved fingerprint registration is unavailable. Please continue with your email and password.");return;}showBiometricPrompt(c,false,null);}
 private int biometricResult(){return BiometricManager.from(getContext()).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK);}
 private String biometricMessage(int r){switch(r){case BiometricManager.BIOMETRIC_SUCCESS:return"Biometric authentication is ready.";case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:return"This device has no supported biometric sensor.";case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:return"The biometric sensor is temporarily unavailable. Please try again.";case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:return"No fingerprint or supported biometric is enrolled. Add a fingerprint in Android Settings first.";case BiometricManager.BIOMETRIC_ERROR_SECURITY_UPDATE_REQUIRED:return"Android requires a security update before biometric login can be used.";case BiometricManager.BIOMETRIC_ERROR_UNSUPPORTED:return"This Android device does not support biometric authentication.";default:return"Biometric authentication is not available on this device.";}}
 private void showBiometricPrompt(final PluginCall c,final boolean enrollment,final String token){try{Activity a=getActivity();if(!(a instanceof FragmentActivity)){c.reject("The current Android screen cannot open the biometric prompt. Please restart the app and try again.");return;}if(a.isFinishing()||(android.os.Build.VERSION.SDK_INT>=17&&a.isDestroyed())){c.reject("The Android screen is closing. Please reopen the app and try again.");return;}final FragmentActivity fa=(FragmentActivity)a;final Executor ex=ContextCompat.getMainExecutor(getContext());final BiometricPrompt.AuthenticationCallback cb=new BiometricPrompt.AuthenticationCallback(){@Override public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result){super.onAuthenticationSucceeded(result);try{if(enrollment){encryptAndStore(token);JSObject o=new JSObject();o.put("enabled",true);o.put("verified",true);o.put("credentialId",prefs().getString(CREDENTIAL_ID,""));o.put("deviceId",deviceId());c.resolve(o);}else{JSObject o=new JSObject();o.put("verified",true);o.put("credentialId",prefs().getString(CREDENTIAL_ID,""));o.put("deviceId",deviceId());c.resolve(o);}}catch(Exception e){clearBiometricState();c.reject("Fingerprint verification succeeded, but secure biometric data could not be accessed. Please enable fingerprint login again.",e);}finally{activePrompt=null;}}@Override public void onAuthenticationError(int code,@NonNull CharSequence msg){super.onAuthenticationError(code,msg);activePrompt=null;c.reject("Biometric verification cancelled or failed ("+code+"): "+msg);}@Override public void onAuthenticationFailed(){super.onAuthenticationFailed();}};final BiometricPrompt.PromptInfo info=new BiometricPrompt.PromptInfo.Builder().setTitle(enrollment?"Enable Fingerprint Login":"Fingerprint Login").setSubtitle(enrollment?"Confirm your fingerprint to enable secure login":"Confirm your identity to sign in").setDescription("Follow the Android biometric prompt. Your fingerprint sensor may be under the display, on the side/power button, or on the rear of the phone.").setNegativeButtonText("Use password").setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK).build();activePrompt=new BiometricPrompt(fa,ex,cb);fa.runOnUiThread(()->{try{if(fa.isFinishing()||(android.os.Build.VERSION.SDK_INT>=17&&fa.isDestroyed())){activePrompt=null;c.reject("The Android screen is no longer active. Please try again.");return;}activePrompt.authenticate(info);}catch(Exception e){activePrompt=null;c.reject("Android could not open the biometric prompt. Please restart the app and try again.",e);}});}catch(Exception e){activePrompt=null;c.reject("Android could not start biometric authentication. Please restart the app and try again.",e);}}
 private void ensureKey()throws Exception{KeyStore k=KeyStore.getInstance("AndroidKeyStore");k.load(null);if(k.containsAlias(KEY_ALIAS))return;KeyGenerator g=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");g.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());g.generateKey();}
 private SecretKey getKey()throws Exception{KeyStore k=KeyStore.getInstance("AndroidKeyStore");k.load(null);KeyStore.Entry e=k.getEntry(KEY_ALIAS,null);if(!(e instanceof KeyStore.SecretKeyEntry))throw new IllegalStateException("Biometric encryption key is unavailable");return((KeyStore.SecretKeyEntry)e).getSecretKey();}
 private boolean hasUsableKey(){try{KeyStore k=KeyStore.getInstance("AndroidKeyStore");k.load(null);return k.containsAlias(KEY_ALIAS)&&k.getEntry(KEY_ALIAS,null) instanceof KeyStore.SecretKeyEntry;}catch(Exception e){return false;}}
 private void encryptAndStore(String token)throws Exception{if(token==null||token.trim().isEmpty())throw new IllegalArgumentException("Empty token");ensureKey();Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,getKey());byte[] enc=c.doFinal(token.getBytes(StandardCharsets.UTF_8));prefs().edit().putBoolean(ENABLED,true).putString(TOKEN,Base64.encodeToString(enc,Base64.NO_WRAP)).putString(IV,Base64.encodeToString(c.getIV(),Base64.NO_WRAP)).apply();}
 private void clearBiometricState(){prefs().edit().clear().apply();deleteKey(KEY_ALIAS);}
 private void deleteKey(String alias){try{KeyStore k=KeyStore.getInstance("AndroidKeyStore");k.load(null);if(k.containsAlias(alias))k.deleteEntry(alias);}catch(Exception ignored){}}
}
