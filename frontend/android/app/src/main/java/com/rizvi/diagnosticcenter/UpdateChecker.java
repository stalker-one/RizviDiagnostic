package com.rizvi.diagnosticcenter;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Shared update-manifest fetching/parsing logic used by both UpdatePlugin
 * (the foreground, JS-triggered check) and UpdateCheckWorker (the
 * background, periodic check via WorkManager). Keeping this in one place
 * means both paths always agree on what counts as "a newer version is
 * available" instead of risking two copies drifting apart.
 */
final class UpdateChecker {
    private static final String REPO = "stalker-one/RizviDiagnostic";
    private static final String MANIFEST_URL = "https://raw.githubusercontent.com/stalker-one/RizviDiagnostic/main/update-manifest-android.json";
    private static final String PREFS = "rizvi_android_update";

    private UpdateChecker() {}

    static String releaseTag(String packageName) {
        return packageName.endsWith(".superadmin") ? "android-superadmin-latest" : "android-latest";
    }

    static String apkName(String packageName) {
        return packageName.endsWith(".superadmin") ? "RizviDiagnosticSuperadmin-latest.apk" : "RizviDiagnosticCenter-latest.apk";
    }

    static JSONObject fetchRelease(Context context, String tag) throws Exception {
        String raw = null;
        Exception networkError = null;
        try {
            URL u = new URL(MANIFEST_URL + "?ts=" + System.currentTimeMillis());
            HttpURLConnection c = (HttpURLConnection) u.openConnection();
            c.setConnectTimeout(1200);
            c.setReadTimeout(1800);
            c.setUseCaches(false);
            c.setRequestProperty("Cache-Control", "no-cache");
            c.setRequestProperty("Pragma", "no-cache");
            c.setRequestProperty("User-Agent", "RizviDiagnosticCenter-Android-Updater/8");
            c.connect();
            int s = c.getResponseCode();
            if (s != 200) throw new IllegalStateException("Update manifest HTTP " + s);
            StringBuilder j = new StringBuilder();
            try (BufferedReader br = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = br.readLine()) != null) j.append(line);
            } finally {
                c.disconnect();
            }
            raw = j.toString();
            context.getSharedPreferences(PREFS, 0).edit().putString("manifest", raw).apply();
        } catch (Exception e) {
            networkError = e;
            raw = context.getSharedPreferences(PREFS, 0).getString("manifest", null);
        }
        if (raw == null || raw.trim().isEmpty()) throw (networkError != null ? networkError : new IllegalStateException("Update manifest unavailable"));
        JSONObject root = new JSONObject(raw);
        String key = tag.equals("android-superadmin-latest") ? "superadmin" : "staff";
        JSONObject item = root.optJSONObject(key);
        if (item == null) throw new IllegalStateException("No update information for " + key);
        JSONObject release = new JSONObject();
        String version = item.optString("versionName", "");
        release.put("name", version.isEmpty() ? tag : version);
        release.put(
            "body",
            "## What's New\n" + item.optString("releaseNotes", "- Latest update from the current release.")
                + "\n\n## Build information\nVersion code: " + item.optLong("versionCode", 0)
                + "\nVersion name: " + version
                + "\nAPK SHA-256: " + item.optString("sha256", "")
                + "\nAPK size: " + item.optLong("sizeBytes", 0) + " bytes"
        );
        JSONArray assets = new JSONArray();
        JSONObject asset = new JSONObject();
        asset.put("name", tag.equals("android-superadmin-latest") ? "RizviDiagnosticSuperadmin-latest.apk" : "RizviDiagnosticCenter-latest.apk");
        asset.put("browser_download_url", item.optString("apkUrl", ""));
        asset.put("size", item.optLong("sizeBytes", 0));
        assets.put(asset);
        release.put("assets", assets);
        return release;
    }

    static JSONObject findBestApk(JSONArray assets, String expectedName) {
        if (assets == null) return null;
        JSONObject fallback = null;
        long newest = Long.MIN_VALUE;
        for (int i = 0; i < assets.length(); i++) {
            JSONObject x = assets.optJSONObject(i);
            if (x == null) continue;
            String n = x.optString("name", "");
            if (expectedName.equals(n)) return x;
            if (!n.toLowerCase(Locale.US).endsWith(".apk")) continue;
            long t = 0;
            try {
                String u = x.optString("updated_at", "");
                if (!u.isEmpty()) t = Instant.parse(u).toEpochMilli();
            } catch (Exception ignored) {}
            if (fallback == null || t > newest) {
                fallback = x;
                newest = t;
            }
        }
        return fallback;
    }

    static long extractNumber(String text, String regex) {
        Matcher m = Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(text == null ? "" : text);
        return m.find() ? Long.parseLong(m.group(1)) : 0L;
    }

    static String extractText(String text, String regex) {
        Matcher m = Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(text == null ? "" : text);
        return m.find() ? m.group(1).trim() : "";
    }

    static String extractSha256(String body) {
        return extractText(body, "APK SHA-256\\s*:\\s*([0-9a-f]{64})").toLowerCase(Locale.US);
    }

    static String cleanReleaseNotes(String body) {
        String s = String.valueOf(body == null ? "" : body).replace("\\r", "").replace("\\n", "\n").trim();
        if (s.isEmpty()) return "Latest update from the current release.";
        String[] lines = s.split("\\n");
        boolean inNotes = false;
        StringBuilder out = new StringBuilder();
        for (String raw : lines) {
            String line = raw.trim();
            if (line.isEmpty()) continue;
            if (line.matches("(?i)^#{1,6}\\s*(build information|technical information|release information|verification|assets|installation|download|checksums?)\\s*$")) break;
            if (line.matches("(?i)^#{1,6}\\s*(what'?s new|latest update|changes?|release notes?)\\s*$")) {
                inNotes = true;
                continue;
            }
            if (line.matches("(?i)^(version code|version name|apk sha-256|apk size|commit|package|workflow|artifact|release[- ]signed|automatically rebuilt)\\s*[:=].*$")) continue;
            if (line.matches("^#{1,6}\\s*.*$")) continue;
            if (!inNotes && !line.matches("^[-*•]\\s+.*$")) continue;
            String clean = line.replaceFirst("^[-*•]\\s+", "").replaceFirst("^\\d+[.)]\\s+", "").trim();
            if (clean.isEmpty()) continue;
            if (clean.matches("(?i)^(version code|version name|apk sha-256|apk size|commit|package|workflow|artifact|download|build information).*$")) continue;
            if (out.length() > 0) out.append("\n");
            out.append("- ").append(clean);
        }
        return out.length() > 0 ? out.toString() : "Latest update from the current release.";
    }

    /** Result of comparing the installed version against the latest published release. */
    static final class Result {
        final boolean available;
        final long versionCode;
        final String versionName;
        final String url;
        final String sha256;
        Result(boolean available, long versionCode, String versionName, String url, String sha256) {
            this.available = available;
            this.versionCode = versionCode;
            this.versionName = versionName;
            this.url = url;
            this.sha256 = sha256;
        }
    }

    /**
     * Lightweight check used by the background worker: only determines
     * whether a newer version exists and what to call it, without the full
     * release-notes/URL/sha payload the foreground checkForUpdate() call
     * returns to the UI.
     */
    static Result checkQuietly(Context context, long installedVersionCode, String packageName) {
        try {
            String tag = releaseTag(packageName);
            JSONObject release = fetchRelease(context, tag);
            JSONObject apk = findBestApk(release.optJSONArray("assets"), apkName(packageName));
            if (apk == null) return new Result(false, 0, null, null, null);
            String body = release.optString("body", "");
            body = body.replace("\\r\\n", "\n").replace("\\r", "").replace("\\n", "\n");
            long remote = extractNumber(body, "Version code\\s*:\\s*(\\d+)");
            if (remote <= 0) remote = extractNumber(body, "Version\\s*(?:Code|Build)\\s*[:=]\\s*(\\d+)");
            if (remote <= 0) remote = extractNumber(apk.optString("name", ""), "(?:-|_)(\\d+)(?:-|_)[0-9a-f]{7,40}\\.apk$");
            if (remote <= 0) remote = extractNumber(apk.optString("name", ""), "(?:-|_)(\\d+)\\.apk$");
            if (remote <= 0 || remote <= installedVersionCode) return new Result(false, 0, null, null, null);
            String vn = extractText(body, "Version name\\s*:\\s*([^\\r\\n]+)");
            return new Result(true, remote, vn.isEmpty() ? ("1.0." + remote) : vn, apk.optString("browser_download_url", ""), extractSha256(body));
        } catch (Exception e) {
            return new Result(false, 0, null, null, null);
        }
    }
}
