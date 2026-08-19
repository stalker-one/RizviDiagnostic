package com.rizvi.diagnosticcenter;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "AndroidUpdate")
public class UpdatePlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod public void getVersion(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
            JSObject r = new JSObject(); r.put("versionCode", code); r.put("versionName", info.versionName == null ? "" : info.versionName); call.resolve(r);
        } catch (Exception e) { call.reject("Unable to read installed Android app version: " + e.getMessage(), e); }
    }

    @PluginMethod public void checkForUpdate(PluginCall call) {
        executor.execute(() -> {
            try {
                PackageInfo installed = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
                long installedCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? installed.getLongVersionCode() : installed.versionCode;
                String packageName = getContext().getPackageName();
                String tag = packageName.endsWith(".superadmin") ? "android-superadmin-latest" : "android-latest";
                URL apiUrl = new URL("https://api.github.com/repos/stalker-one/RizviDiagnostic/releases/tags/" + tag + "?_=" + System.currentTimeMillis());
                HttpURLConnection c = (HttpURLConnection) apiUrl.openConnection();
                c.setConnectTimeout(15000); c.setReadTimeout(30000); c.setUseCaches(false);
                c.setRequestProperty("Accept", "application/vnd.github+json"); c.setRequestProperty("User-Agent", "RizviDiagnosticCenter-Android-Updater/2"); c.connect();
                int status = c.getResponseCode(); if (status != 200) throw new IllegalStateException("GitHub release check returned HTTP " + status);
                StringBuilder json = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8))) { String line; while ((line = reader.readLine()) != null) json.append(line); } finally { c.disconnect(); }
                JSONObject release = new JSONObject(json.toString()); JSONArray assets = release.optJSONArray("assets"); JSONObject apk = null;
                if (assets != null) for (int i = 0; i < assets.length(); i++) { JSONObject a = assets.optJSONObject(i); if (a != null && a.optString("name", "").toLowerCase().endsWith(".apk")) { apk = a; break; } }
                JSObject result = new JSObject(); result.put("available", false); result.put("installedVersionCode", installedCode); result.put("installedVersionName", installed.versionName == null ? "" : installed.versionName); result.put("packageName", packageName); result.put("tag", tag); result.put("releaseName", release.optString("name", tag)); result.put("releaseNotes", release.optString("body", ""));
                if (apk == null) { call.resolve(result); return; }
                String body = release.optString("body", ""); long remoteCode = extractNumber(body, "Version code\\s*:\\s*(\\d+)");
                if (remoteCode <= 0) remoteCode = extractNumber(apk.optString("name", ""), "(?:-|_)(\\d+)(?:-|_)[0-9a-f]{7,40}\\.apk$");
                if (remoteCode <= 0) remoteCode = extractNumber(apk.optString("name", ""), "(?:-|_)(\\d+)\\.apk$");
                if (remoteCode <= 0) remoteCode = extractNumber(body, "Version\\s*(?:Code|Build)\\s*[:=]\\s*(\\d+)");
                if (remoteCode <= 0) throw new IllegalStateException("Latest Android release has no readable version code.");
                if (remoteCode <= installedCode) { call.resolve(result); return; }
                String versionName = extractText(body, "Version name\\s*:\\s*([^\\r\\n]+)"); result.put("available", true); result.put("versionCode", remoteCode); result.put("versionName", versionName.isEmpty() ? "1.0." + Math.max(0, remoteCode - 1) : versionName); result.put("url", apk.optString("browser_download_url", "")); call.resolve(result);
            } catch (Exception e) { call.reject("Android update check failed: " + e.getMessage(), e); }
        });
    }

    private long extractNumber(String text, String regex) { Matcher m = Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(text == null ? "" : text); return m.find() ? Long.parseLong(m.group(1)) : 0L; }
    private String extractText(String text, String regex) { Matcher m = Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(text == null ? "" : text); return m.find() ? m.group(1).trim() : ""; }

    @PluginMethod public void installApk(PluginCall call) {
        String url = call.getString("url", ""); if (url == null || url.trim().isEmpty()) { call.reject("Update download URL is missing."); return; }
        if (!url.startsWith("https://")) { call.reject("Only secure HTTPS update URLs are allowed."); return; }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) { try { getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()))); call.reject("Please allow this app to install updates, then tap Update Now again."); } catch (Exception e) { call.reject("Android installation permission is required: " + e.getMessage(), e); } return; }
        call.setKeepAlive(true); executor.execute(() -> { File apk = new File(getContext().getCacheDir(), "rizvi-diagnostic-update.apk"); try { if (apk.exists() && !apk.delete()) throw new IllegalStateException("Unable to clear the previous update file."); HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection(); c.setConnectTimeout(15000); c.setReadTimeout(120000); c.setInstanceFollowRedirects(true); c.setRequestProperty("User-Agent", "RizviDiagnosticCenter-Android-Updater/2"); c.connect(); if (c.getResponseCode() < 200 || c.getResponseCode() >= 300) throw new IllegalStateException("Update server returned HTTP " + c.getResponseCode()); try (InputStream input = c.getInputStream(); FileOutputStream output = new FileOutputStream(apk)) { byte[] buffer = new byte[8192]; int n; while ((n = input.read(buffer)) != -1) output.write(buffer, 0, n); } finally { c.disconnect(); } if (!apk.isFile() || apk.length() < 10000) throw new IllegalStateException("Downloaded update APK is incomplete."); verifyDownloadedApk(apk); getActivity().runOnUiThread(() -> { try { Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk); Intent intent = new Intent(Intent.ACTION_VIEW); intent.setDataAndType(uri, "application/vnd.android.package-archive"); intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK); getActivity().startActivity(intent); call.resolve(); } catch (Exception e) { call.reject("Unable to start Android update installer: " + e.getMessage(), e); } finally { call.setKeepAlive(false); } }); } catch (Exception e) { getActivity().runOnUiThread(() -> { call.reject("Update verification/download failed: " + e.getMessage(), e); call.setKeepAlive(false); }); } });
    }

    private void verifyDownloadedApk(File apk) throws Exception { PackageManager pm = getContext().getPackageManager(); PackageInfo info = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? pm.getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES)) : pm.getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.GET_SIGNATURES); if (info == null) throw new SecurityException("Downloaded file is not a valid Android APK."); if (!getContext().getPackageName().equals(info.packageName)) throw new SecurityException("Update APK belongs to a different application."); if (!MessageDigest.isEqual(getInstalledCertificate(), getDownloadedCertificate(info))) throw new SecurityException("Update APK signing certificate does not match this application."); }
    private byte[] getInstalledCertificate() throws Exception { PackageManager pm = getContext().getPackageManager(); PackageInfo info; if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) { info = pm.getPackageInfo(getContext().getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES); if (info.signingInfo == null || info.signingInfo.getApkContentsSigners().length == 0) throw new SecurityException("Installed application has no signing certificate."); return certificateDigest(info.signingInfo.getApkContentsSigners()[0]); } info = pm.getPackageInfo(getContext().getPackageName(), PackageManager.GET_SIGNATURES); if (info.signatures == null || info.signatures.length == 0) throw new SecurityException("Installed application has no signing certificate."); return certificateDigest(info.signatures[0]); }
    private byte[] getDownloadedCertificate(PackageInfo info) throws Exception { if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) { if (info.signingInfo == null || info.signingInfo.getApkContentsSigners().length == 0) throw new SecurityException("Downloaded APK has no signing certificate."); return certificateDigest(info.signingInfo.getApkContentsSigners()[0]); } if (info.signatures == null || info.signatures.length == 0) throw new SecurityException("Downloaded APK has no signing certificate."); return certificateDigest(info.signatures[0]); }
    private byte[] certificateDigest(Signature signature) throws Exception { return MessageDigest.getInstance("SHA-256").digest(signature.toByteArray()); }
    @Override protected void handleOnDestroy() { executor.shutdownNow(); super.handleOnDestroy(); }
}
