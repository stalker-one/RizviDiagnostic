package com.rizvi.diagnosticcenter;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Environment;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/**
 * Runs periodically in the background (scheduled from MainActivity via
 * WorkManager) so an update notification can appear even when the app
 * isn't open. WorkManager persists this schedule across app restarts and
 * device reboots once it has been enqueued at least once, but the OS
 * treats the interval as a minimum/best-effort under battery
 * optimization (Doze), not a guaranteed exact timer.
 *
 * Unlike UpdatePlugin.notifyUpdateAvailable(), this cannot show any UI --
 * so on Android 13+ it only posts if notification permission was already
 * granted from a previous foreground check; it never prompts.
 */
public class UpdateCheckWorker extends Worker {
    public UpdateCheckWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    private File downloadAndVerify(Context context, UpdateChecker.Result check) throws Exception {
        File dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) dir = context.getCacheDir();
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Unable to create update cache directory");
        File apk = new File(dir, "rizvi-update-" + check.versionCode + ".apk");
        if (apk.isFile() && apk.length() > 10000 && verifySha256(apk, check.sha256)) return apk;
        HttpURLConnection connection = (HttpURLConnection) new URL(check.url).openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(120000);
        connection.setInstanceFollowRedirects(true);
        connection.setRequestProperty("User-Agent", "RizviDiagnosticCenter-Android-Updater/9");
        connection.connect();
        if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) throw new IllegalStateException("Update download HTTP " + connection.getResponseCode());
        File temp = new File(dir, apk.getName() + ".part");
        try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(temp)) {
            byte[] buffer = new byte[131072]; int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
        } finally { connection.disconnect(); }
        if (!temp.renameTo(apk) || !verifySha256(apk, check.sha256)) { temp.delete(); apk.delete(); throw new SecurityException("Background update integrity check failed"); }
        return apk;
    }

    private boolean verifySha256(File file, String expected) throws Exception {
        if (expected == null || expected.length() != 64) return false;
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new java.io.FileInputStream(file)) { byte[] buffer = new byte[131072]; int count; while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count); }
        StringBuilder actual = new StringBuilder(); for (byte value : digest.digest()) actual.append(String.format(Locale.US, "%02x", value & 0xff));
        return actual.toString().equalsIgnoreCase(expected);
    }

    @NonNull
    @Override
    public Result doWork() {
        try {
            Context context = getApplicationContext();
            if (Build.VERSION.SDK_INT >= 33
                && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                // Can't prompt for permission from a background worker; the
                // foreground app is responsible for requesting it. Nothing
                // useful to do here until that's granted.
                return Result.success();
            }
            PackageInfo installed = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            long installedCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? installed.getLongVersionCode() : installed.versionCode;
            UpdateChecker.Result check = UpdateChecker.checkQuietly(context, installedCode, context.getPackageName());
            if (check.available && check.url != null && !check.url.isEmpty()) {
                File cached = downloadAndVerify(context, check);
                boolean isSuperadmin = context.getPackageName().endsWith(".superadmin");
                String appLabel = isSuperadmin ? "Rizvi Diagnostic Center Superadmin" : "Rizvi Diagnostic Center";
                NotificationHelper.postIfNewVersion(
                    context,
                    check.versionCode,
                    appLabel + " update downloaded",
                    "Version " + check.versionName + " was downloaded in the background. Open the app to install it."
                );
            }
        } catch (Exception ignored) {
            // A background check failing quietly is fine -- the next
            // scheduled run (or the next time the app is opened) will
            // simply try again.
        }
        return Result.success();
    }
}
