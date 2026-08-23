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
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Posts system notifications for this app: update-available (with a
 * version-based idempotency guard, since that check can run repeatedly for
 * the same version from both the foreground plugin and the background
 * worker) and one-off activity events (patient created, invoice created).
 * Both the foreground, JS-triggered paths and the background periodic
 * update check end up here, so there's exactly one place deciding what
 * actually gets posted.
 */
final class NotificationHelper {
    private static final String PREFS = "rizvi_android_update";
    private static final String LAST_NOTIFIED_KEY = "last_notified_version_code";
    private static final String UPDATE_CHANNEL_ID = "rizvi_update_channel";
    private static final String ACTIVITY_CHANNEL_ID = "rizvi_activity_channel";
    private static final int UPDATE_NOTIFICATION_ID = 2001;
    // Patient/invoice notifications each get their own notification ID (not
    // a single fixed one like the update notification) so several of them
    // can sit in the tray at once instead of replacing each other.
    private static final AtomicInteger activityIdSeq = new AtomicInteger(3001);

    private NotificationHelper() {}

    /**
     * Creates both notification channels up front if they don't already
     * exist. Needed because the backend now sends a hybrid
     * notification+data FCM payload (not data-only): when the app is
     * backgrounded or killed, Android auto-displays that notification
     * payload directly using the channel ID the backend specifies, WITHOUT
     * calling onMessageReceived at all -- so our own code never gets a
     * chance to lazily create the channel on first post in that case. On a
     * fresh install, that could otherwise silently fail to show anything
     * the very first time a push arrives before the app has ever posted a
     * notification itself.
     */
    static void ensureChannelsCreated(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm.getNotificationChannel(UPDATE_CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(UPDATE_CHANNEL_ID, "App updates", NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription("Notifies when a new app update is available to install.");
                nm.createNotificationChannel(channel);
            }
            if (nm.getNotificationChannel(ACTIVITY_CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(ACTIVITY_CHANNEL_ID, "Activity", NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription("Notifies when a patient or invoice is created.");
                nm.createNotificationChannel(channel);
            }
        } catch (Exception ignored) {
        }
    }

    /**
     * Posts the update-available notification for {@code versionCode}
     * unless that version (or a newer one) was already announced. Returns
     * true if a notification was actually posted.
     */
    static boolean postIfNewVersion(Context context, long versionCode, String title, String message) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, 0);
        long lastNotified = prefs.getLong(LAST_NOTIFIED_KEY, 0);
        if (versionCode > 0 && versionCode <= lastNotified) return false;
        boolean posted = post(context, UPDATE_CHANNEL_ID, "App updates", "Notifies when a new app update is available to install.", UPDATE_NOTIFICATION_ID, title, message);
        if (posted && versionCode > 0) prefs.edit().putLong(LAST_NOTIFIED_KEY, versionCode).apply();
        return posted;
    }

    /**
     * Posts a one-off activity notification (e.g. "Patient created",
     * "Invoice created") on its own channel, separate from update
     * notifications so users can mute/manage them independently. No
     * idempotency guard -- each call is its own distinct event.
     */
    static boolean postActivity(Context context, String title, String message) {
        return post(context, ACTIVITY_CHANNEL_ID, "Activity", "Notifies when a patient or invoice is created.", activityIdSeq.incrementAndGet(), title, message);
    }

    private static boolean post(Context context, String channelId, String channelName, String channelDescription, int notificationId, String title, String message) {
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(channelId) == null) {
                NotificationChannel channel = new NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription(channelDescription);
                nm.createNotificationChannel(channel);
            }
            Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (launchIntent == null) launchIntent = new Intent();
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent pendingIntent = PendingIntent.getActivity(context, notificationId, launchIntent, piFlags);
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.drawable.ic_stat_update)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);
            NotificationManagerCompat.from(context).notify(notificationId, builder.build());
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
