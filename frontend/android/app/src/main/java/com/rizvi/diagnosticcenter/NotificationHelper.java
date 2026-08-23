package com.rizvi.diagnosticcenter;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Posts the "update available" system notification. Both the foreground,
 * JS-triggered path (UpdatePlugin, which can prompt for the Android 13+
 * notification permission) and the background periodic path
 * (UpdateCheckWorker, which cannot show any UI and must skip silently if
 * permission isn't already granted) end up here, so there's exactly one
 * place that decides whether a given version has already been announced.
 */
final class NotificationHelper {
    private static final String PREFS = "rizvi_android_update";
    private static final String LAST_NOTIFIED_KEY = "last_notified_version_code";
    private static final String CHANNEL_ID = "rizvi_update_channel";
    private static final int NOTIFICATION_ID = 2001;

    private NotificationHelper() {}

    /**
     * Posts the notification for {@code versionCode} unless that version
     * (or a newer one) was already announced. Returns true if a
     * notification was actually posted.
     */
    static boolean postIfNewVersion(Context context, long versionCode, String title, String message) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, 0);
        long lastNotified = prefs.getLong(LAST_NOTIFIED_KEY, 0);
        if (versionCode > 0 && versionCode <= lastNotified) return false;
        boolean posted = post(context, title, message);
        if (posted && versionCode > 0) prefs.edit().putLong(LAST_NOTIFIED_KEY, versionCode).apply();
        return posted;
    }

    private static boolean post(Context context, String title, String message) {
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "App updates", NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription("Notifies when a new app update is available to install.");
                nm.createNotificationChannel(channel);
            }
            Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (launchIntent == null) launchIntent = new Intent();
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, launchIntent, piFlags);
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_update)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
            return true;
        } catch (SecurityException se) {
            // Notification permission not granted (Android 13+) -- caller
            // decides whether to request it; here we just skip silently.
            return false;
        } catch (Exception e) {
            return false;
        }
    }
}
