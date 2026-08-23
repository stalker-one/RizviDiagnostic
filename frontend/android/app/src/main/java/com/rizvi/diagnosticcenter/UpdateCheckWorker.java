package com.rizvi.diagnosticcenter;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
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
            if (check.available) {
                boolean isSuperadmin = context.getPackageName().endsWith(".superadmin");
                String appLabel = isSuperadmin ? "Rizvi Diagnostic Center Superadmin" : "Rizvi Diagnostic Center";
                NotificationHelper.postIfNewVersion(
                    context,
                    check.versionCode,
                    appLabel + " update available",
                    "Version " + check.versionName + " is ready to install."
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
