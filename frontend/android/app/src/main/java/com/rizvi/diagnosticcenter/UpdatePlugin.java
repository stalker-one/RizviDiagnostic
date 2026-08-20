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
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "AndroidUpdate")
public class UpdatePlugin extends Plugin {
    private static final String REPO = "stalker-one/RizviDiagnostic";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod public void getVersion(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? info.getLongVersionCode() : info.versionCode;
            JSObject r = new JSObject();
            r.put("versionCode", code);
            r.put("versionName", info.versionName == null ? "" : info.versionName);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Unable to read installed Android app version: " + e.getMessage(), e);
        }
    }

    @PluginMethod public void checkForUpdate(PluginCall call) {
        executor.execute(() -> {
            try {
                PackageInfo installed = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
                long installedCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? installed.getLongVersionCode() : installed.versionCode;
                String packageName = installed.packageName;
                String tag = releaseTag(packageName);
                JSONObject release = fetchRelease(tag);
                JSONArray assets = release.optJSONArray("assets");
                String expectedName = apkName(packageName);
                JSONObject apk = findBestApk(assets, expectedName);

                JSObject result = new JSObject();
                result.put("available", false);
                result.put("installedVersionCode", installedCode);
                result.put("installedVersionName", installed.versionName == null ? "" : installed.versionName);
                result.put("packageName", packageName);
                result.put("tag", tag);
                result.put("releaseName", release.optString("name", tag));
                result.put("releaseNotes", release.optString("body", ""));
                if (apk == null) { call.resolve(result); return; }

                String body = release.optString("body", "");
                long remoteCode = extractNumber(body, "Version code\\s*:\\s*(\\d+)");
                if (remoteCode <= 0) remoteCode = extractNumber(body, "Version\\s*(?:Code|Build)\\s*[:=]\\s*(\\d+)");
                if (remoteCode <= 0) remoteCode = extractNumber(apk.optString("name", ""), "(?:-|_)(\\d+)(?:-|_)[0-9a-f]{7,40}\\.apk$");
                if (remoteCode <= 0) remoteCode = extractNumber(apk.optString("name", ""), "(?:-|_)(\\d+)\\.apk$");
                if (remoteCode <= 0) throw new IllegalStateException("Latest Android release has no readable version code.");
                if (remoteCode <= installedCode) { call.resolve(result); return; }

                String versionName = extractText(body, "Version name\\s*:\\s*([^\\r\\n]+)");
                String sha256 = extractSha256(body);
                result.put("available", true);
                result.put("versionCode", remoteCode);
                result.put("versionName", versionName.isEmpty() ? "1.0." + remoteCode : versionName);
                result.put("url", apk.optString("browser_download_url", ""));
                result.put("sha256", sha256);
                long size = apk.optLong("size", 0);
                result.put("sizeBytes", size);
                result.put("sizeMB", Math.round((size / 1024d / 1024d) * 10d) / 10d);
                result.put("commit", extractText(body, "commit\\s+([0-9a-f]{7,40})"));
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Android update check failed: " + e.getMessage(), e);
            }
        });
    }

    private String releaseTag(String packageName) {
        return packageName.endsWith(".superadmin") ? "android-superadmin-latest" : "android-latest";
    }

    private String apkName(String packageName) {
        return packageName.endsWith(".superadmin") ? "RizviDiagnosticSuperadmin-latest.apk" : "RizviDiagnosticCenter-latest.apk";
    }

    private JSONObject fetchRelease(String tag) throws Exception {
        URL apiUrl = new URL("https://api.github.com/repos/" + REPO + "/releases/tags/" + tag + "?_=" + System.currentTimeMillis());
        HttpURLConnection c = (HttpURLConnection) apiUrl.openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setUseCaches(false);
        c.setRequestProperty("Accept", "application/vnd.github+json");
        c.setRequestProperty("User-Agent", "RizviDiagnosticCenter-Android-Updater/6");
        c.connect();
        int status = c.getResponseCode();
        if (status != 200) throw new IllegalStateException("GitHub release check returned HTTP " + status);
        StringBuilder json = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) json.append(line);
        } finally { c.disconnect(); }
        return new JSONObject(json.toString());
    }

    private JSONObject findBestApk(JSONArray assets, String expectedName) {
        if (assets == null) return null;
        JSONObject fallback = null;
        long newest = Long.MIN_VALUE;
        for (int i = 0; i < assets.length(); i++) {
            JSONObject a = assets.optJSONObject(i);
            if (a == null) continue;
            String n = a.optString("name", "");
            if (expectedName.equals(n)) return a;
            if (!n.toLowerCase(Locale.US).endsWith(".apk")) continue;
            long t = 0;
            String u = a.optString("updated_at", "");
            if (!u.isEmpty()) {
                try { t = Instant.parse(u).toEpochMilli(); } catch (Exception ignored) {}
            }
            if (fallback == null || t > newest) { fallback = a; newest = t; }
        }
        return fallback;
    }

    private long extractNumber(String text, String regex) {
        Matcher m = Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(text == null ? "" : text);
        return m.find() ? Long.parseLong(m.group(1)) : 0L;
    }

    private String extractText(String text, String regex) {
        Matcher m = Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(text == null ? "" : text);
        return m.find() ? m.group(1).trim() : "";
    }

    private String extractSha256(String body) {
        String value = extractText(body, "APK SHA-256\\s*:\\s*([0-9a-f]{64})");
        return value.toLowerCase(Locale.US);
    }

    @PluginMethod public void installApk(PluginCall call) {
        String url = call.getString("url", "");
        if (url == null || url.trim().isEmpty()) { call.reject("Update download URL is missing."); return; }
        if (!url.startsWith("https://")) { call.reject("Only secure HTTPS update URLs are allowed."); return; }
        if (!isAllowedUpdateUrl(url)) { call.reject("Update source is not an approved Rizvi Diagnostic release URL."); return; }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            try {
                getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName())));
                call.reject("Please allow this app to install updates, then tap Update Now again.");
            } catch (Exception e) {
                call.reject("Android installation permission is required: " + e.getMessage(), e);
            }
            return;
        }

        call.setKeepAlive(true);
        executor.execute(() -> {
            File apk = new File(getContext().getCacheDir(), "rizvi-diagnostic-update.apk");
            try {
                String tag = releaseTag(getContext().getPackageName());
                JSONObject release = fetchRelease(tag);
                JSONObject asset = findBestApk(release.optJSONArray("assets"), apkName(getContext().getPackageName()));
                if (asset == null) throw new SecurityException("Approved update APK was not found in the latest release.");
                String approvedUrl = asset.optString("browser_download_url", "");
                if (!url.equals(approvedUrl)) throw new SecurityException("Update URL does not match the approved latest release asset.");
                String expectedSha256 = extractSha256(release.optString("body", ""));
                if (expectedSha256.isEmpty()) throw new SecurityException("Latest release has no APK integrity hash.");

                if (apk.exists() && !apk.delete()) throw new IllegalStateException("Unable to clear the previous update file.");
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(15000);
                c.setReadTimeout(120000);
                c.setInstanceFollowRedirects(true);
                c.setRequestProperty("User-Agent", "RizviDiagnosticCenter-Android-Updater/6");
                c.connect();
                int response = c.getResponseCode();
                if (response < 200 || response >= 300) throw new IllegalStateException("Update server returned HTTP " + response);
                long total = c.getContentLengthLong();
                try (InputStream input = c.getInputStream(); FileOutputStream output = new FileOutputStream(apk)) {
                    byte[] buffer = new byte[16384];
                    long done = 0;
                    int n;
                    int last = -1;
                    while ((n = input.read(buffer)) != -1) {
                        output.write(buffer, 0, n);
                        done += n;
                        int percent = total > 0 ? (int) Math.min(99, (done * 100L) / total) : -1;
                        if (percent != last) {
                            last = percent;
                            JSObject progress = new JSObject();
                            progress.put("percent", percent);
                            progress.put("downloadedBytes", done);
                            progress.put("totalBytes", total);
                            notifyListeners("updateProgress", progress);
                        }
                    }
                } finally { c.disconnect(); }

                if (!apk.isFile() || apk.length() < 10000) throw new IllegalStateException("Downloaded update APK is incomplete.");
                verifySha256(apk, expectedSha256);
                verifyDownloadedApk(apk);

                JSObject complete = new JSObject();
                complete.put("percent", 100);
                complete.put("downloadedBytes", apk.length());
                complete.put("totalBytes", apk.length());
                notifyListeners("updateProgress", complete);

                getActivity().runOnUiThread(() -> {
                    try {
                        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                        Intent intent = new Intent(Intent.ACTION_VIEW);
                        intent.setDataAndType(uri, "application/vnd.android.package-archive");
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                        getActivity().startActivity(intent);
                        call.resolve();
                    } catch (Exception e) {
                        call.reject("Unable to start Android update installer: " + e.getMessage(), e);
                    } finally { call.setKeepAlive(false); }
                });
            } catch (Exception e) {
                getActivity().runOnUiThread(() -> {
                    call.reject("Update verification/download failed: " + e.getMessage(), e);
                    call.setKeepAlive(false);
                });
            }
        });
    }

    private boolean isAllowedUpdateUrl(String url) {
        try {
            Uri uri = Uri.parse(url);
            return "https".equalsIgnoreCase(uri.getScheme())
                    && "github.com".equalsIgnoreCase(uri.getHost())
                    && uri.getPath() != null
                    && uri.getPath().startsWith("/" + REPO + "/releases/download/");
        } catch (Exception e) { return false; }
    }

    private void verifySha256(File apk, String expected) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(apk)) {
            byte[] buffer = new byte[16384];
            int n;
            while ((n = input.read(buffer)) != -1) digest.update(buffer, 0, n);
        }
        String actual = toHex(digest.digest());
        if (!MessageDigest.isEqual(actual.getBytes(StandardCharsets.US_ASCII), expected.toLowerCase(Locale.US).getBytes(StandardCharsets.US_ASCII))) {
            throw new SecurityException("Downloaded APK integrity check failed.");
        }
    }

    private String toHex(byte[] bytes) {
        StringBuilder out = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) out.append(String.format(Locale.US, "%02x", b & 0xff));
        return out.toString();
    }

    private void verifyDownloadedApk(File apk) throws Exception {
        PackageManager pm = getContext().getPackageManager();
        PackageInfo info = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                ? pm.getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES))
                : pm.getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.GET_SIGNING_CERTIFICATES);
        if (info == null) throw new SecurityException("Downloaded file is not a valid Android APK.");
        if (!getContext().getPackageName().equals(info.packageName)) throw new SecurityException("Update APK belongs to a different application.");
        if (!MessageDigest.isEqual(getInstalledCertificate(), getDownloadedCertificate(info))) throw new SecurityException("Update APK signing certificate does not match this application.");
    }

    private byte[] getInstalledCertificate() throws Exception {
        PackageManager pm = getContext().getPackageManager();
        PackageInfo info;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info = pm.getPackageInfo(getContext().getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
            if (info.signingInfo == null || info.signingInfo.getApkContentsSigners().length == 0) throw new SecurityException("Installed application has no signing certificate.");
            return certificateDigest(info.signingInfo.getApkContentsSigners()[0]);
        }
        info = pm.getPackageInfo(getContext().getPackageName(), PackageManager.GET_SIGNATURES);
        if (info.signatures == null || info.signatures.length == 0) throw new SecurityException("Installed application has no signing certificate.");
        return certificateDigest(info.signatures[0]);
    }

    private byte[] getDownloadedCertificate(PackageInfo info) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (info.signingInfo == null || info.signingInfo.getApkContentsSigners().length == 0) throw new SecurityException("Downloaded APK has no signing certificate.");
            return certificateDigest(info.signingInfo.getApkContentsSigners()[0]);
        }
        if (info.signatures == null || info.signatures.length == 0) throw new SecurityException("Downloaded APK has no signing certificate.");
        return certificateDigest(info.signatures[0]);
    }

    private byte[] certificateDigest(Signature signature) throws Exception {
        return MessageDigest.getInstance("SHA-256").digest(signature.toByteArray());
    }

    @Override protected void handleOnDestroy() { executor.shutdownNow(); super.handleOnDestroy(); }
}
