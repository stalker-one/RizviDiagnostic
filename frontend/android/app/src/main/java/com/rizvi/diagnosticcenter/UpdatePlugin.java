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

    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
            JSObject result = new JSObject();
            result.put("versionCode", versionCode);
            result.put("versionName", info.versionName == null ? "" : info.versionName);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Unable to read installed Android app version: " + e.getMessage(), e);
        }
    }

    /** Native GitHub check avoids WebView CORS/cache/rate-limit problems. */
    @PluginMethod
    public void checkForUpdate(PluginCall call) {
        executor.execute(() -> {
            try {
                PackageInfo installed = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
                long installedCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? installed.getLongVersionCode() : installed.versionCode;
                String packageName = getContext().getPackageName();
                String tag = packageName.endsWith(".superadmin") ? "android-superadmin-latest" : "android-latest";

                HttpURLConnection connection = (HttpURLConnection) new URL(
                        "https://api.github.com/repos/stalker-one/RizviDiagnostic/releases?per_page=20&_= " + System.currentTimeMillis()
                                .replace(" ", "")
                ).openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);
                connection.setUseCaches(false);
                connection.setRequestProperty("Accept", "application/vnd.github+json");
                connection.setRequestProperty("User-Agent", "RizviDiagnosticCenter-Android-Updater");
                connection.connect();
                if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) {
                    throw new IllegalStateException("GitHub returned HTTP " + connection.getResponseCode());
                }

                StringBuilder json = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) json.append(line);
                } finally {
                    connection.disconnect();
                }

                JSONArray releases = new JSONArray(json.toString());
                JSONObject selected = null;
                for (int i = 0; i < releases.length(); i++) {
                    JSONObject release = releases.optJSONObject(i);
                    if (release == null || release.optBoolean("draft", false) || release.optBoolean("prerelease", false)) continue;
                    if (tag.equals(release.optString("tag_name", ""))) {
                        selected = release;
                        break;
                    }
                }

                JSObject result = new JSObject();
                result.put("available", false);
                result.put("installedVersionCode", installedCode);
                result.put("installedVersionName", installed.versionName == null ? "" : installed.versionName);
                result.put("packageName", packageName);
                result.put("tag", tag);

                if (selected == null) {
                    call.resolve(result);
                    return;
                }

                JSONObject apk = null;
                JSONArray assets = selected.optJSONArray("assets");
                if (assets != null) {
                    for (int i = 0; i < assets.length(); i++) {
                        JSONObject asset = assets.optJSONObject(i);
                        if (asset != null && asset.optString("name", "").toLowerCase().endsWith(".apk")) {
                            apk = asset;
                            break;
                        }
                    }
                }
                if (apk == null) {
                    call.resolve(result);
                    return;
                }

                String body = selected.optString("body", "");
                long remoteCode = extractNumber(body, "Version code\\s*:\\s*(\\d+)");
                if (remoteCode <= 0) remoteCode = extractNumber(apk.optString("name", ""), "-(\\d+)-[0-9a-f]{7,40}\\.apk$");
                if (remoteCode <= 0) remoteCode = extractNumber(selected.optString("tag_name", ""), "(?:v|build-)(\\d+)");
                if (remoteCode <= installedCode) {
                    call.resolve(result);
                    return;
                }

                String versionName = extractText(body, "Version name\\s*:\\s*([^\\r\\n]+)");
                result.put("available", true);
                result.put("versionCode", remoteCode);
                result.put("versionName", versionName.isEmpty() ? "1.0." + Math.max(0, remoteCode - 1) : versionName);
                result.put("url", apk.optString("browser_download_url", ""));
                result.put("releaseName", selected.optString("name", tag));
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Android update check failed: " + e.getMessage(), e);
            }
        });
    }

    private long extractNumber(String text, String regex) {
        Matcher matcher = Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(text == null ? "" : text);
        return matcher.find() ? Long.parseLong(matcher.group(1)) : 0L;
    }

    private String extractText(String text, String regex) {
        Matcher matcher = Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(text == null ? "" : text);
        return matcher.find() ? matcher.group(1).trim() : "";
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        String url = call.getString("url", "");
        if (url == null || url.trim().isEmpty()) { call.reject("Update download URL is missing."); return; }
        if (!url.startsWith("https://")) { call.reject("Only secure HTTPS update URLs are allowed."); return; }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            try {
                Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(settingsIntent);
                call.reject("Please allow this app to install updates, then tap Update Now again.");
            } catch (Exception e) { call.reject("Android installation permission is required: " + e.getMessage(), e); }
            return;
        }

        call.setKeepAlive(true);
        executor.execute(() -> {
            File apk = new File(getContext().getCacheDir(), "rizvi-diagnostic-update.apk");
            try {
                if (apk.exists() && !apk.delete()) throw new IllegalStateException("Unable to clear the previous update file.");
                HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(15000); connection.setReadTimeout(120000); connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent", "RizviDiagnosticCenter-Android-Updater");
                connection.setRequestProperty("Accept", "application/vnd.android.package-archive,application/octet-stream");
                connection.connect();
                if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) throw new IllegalStateException("Update server returned HTTP " + connection.getResponseCode());
                try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(apk)) {
                    byte[] buffer = new byte[8192]; int count; while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                } finally { connection.disconnect(); }
                if (!apk.isFile() || apk.length() < 10000) throw new IllegalStateException("Downloaded update APK is incomplete.");
                verifyDownloadedApk(apk);
                getActivity().runOnUiThread(() -> {
                    try {
                        Uri apkUri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                        Intent installIntent = new Intent(Intent.ACTION_VIEW);
                        installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        getActivity().startActivity(installIntent); call.resolve();
                    } catch (Exception e) { call.reject("Unable to start Android update installer: " + e.getMessage(), e); }
                    finally { call.setKeepAlive(false); }
                });
            } catch (Exception e) { getActivity().runOnUiThread(() -> { call.reject("Update verification/download failed: " + e.getMessage(), e); call.setKeepAlive(false); }); }
        });
    }

    private void verifyDownloadedApk(File apk) throws Exception {
        PackageManager pm = getContext().getPackageManager();
        PackageInfo archiveInfo = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                ? pm.getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES))
                : pm.getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.GET_SIGNATURES);
        if (archiveInfo == null) throw new SecurityException("Downloaded file is not a valid Android APK.");
        if (!getContext().getPackageName().equals(archiveInfo.packageName)) throw new SecurityException("Update APK belongs to a different application.");
        if (!MessageDigest.isEqual(getInstalledCertificate(), getDownloadedCertificate(archiveInfo))) throw new SecurityException("Update APK signing certificate does not match this application.");
    }

    private byte[] getInstalledCertificate() throws Exception {
        PackageManager pm = getContext().getPackageManager(); PackageInfo info;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) { info = pm.getPackageInfo(getContext().getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES); if (info.signingInfo == null || info.signingInfo.getApkContentsSigners().length == 0) throw new SecurityException("Installed application has no signing certificate."); return certificateDigest(info.signingInfo.getApkContentsSigners()[0]); }
        info = pm.getPackageInfo(getContext().getPackageName(), PackageManager.GET_SIGNATURES); if (info.signatures == null || info.signatures.length == 0) throw new SecurityException("Installed application has no signing certificate."); return certificateDigest(info.signatures[0]);
    }

    private byte[] getDownloadedCertificate(PackageInfo info) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) { if (info.signingInfo == null || info.signingInfo.getApkContentsSigners().length == 0) throw new SecurityException("Downloaded APK has no signing certificate."); return certificateDigest(info.signingInfo.getApkContentsSigners()[0]); }
        if (info.signatures == null || info.signatures.length == 0) throw new SecurityException("Downloaded APK has no signing certificate."); return certificateDigest(info.signatures[0]);
    }

    private byte[] certificateDigest(Signature signature) throws Exception { return MessageDigest.getInstance("SHA-256").digest(signature.toByteArray()); }

    @Override protected void handleOnDestroy() { executor.shutdownNow(); super.handleOnDestroy(); }
}
