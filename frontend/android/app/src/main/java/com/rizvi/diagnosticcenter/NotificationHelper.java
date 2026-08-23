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
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.concurrent.atomic.AtomicInteger;

final class NotificationHelper {
    private static final String PREFS = "rizvi_android_update";
    private static final String LAST_NOTIFIED_KEY = "last_notified_version_code";
    private static final String HISTORY_KEY = "notification_history";
    private static final String ACTIVITY_ENABLED_KEY = "notifications_activity_enabled";
    private static final String UPDATE_ENABLED_KEY = "notifications_update_enabled";
    private static final String SOUND_ENABLED_KEY = "notifications_sound_enabled";
    private static final String VIBRATION_ENABLED_KEY = "notifications_vibration_enabled";
    private static final String UPDATE_CHANNEL_ID = "rizvi_update_channel";
    private static final String ACTIVITY_CHANNEL_ID = "rizvi_activity_channel";
    private static final int UPDATE_NOTIFICATION_ID = 2001;
    private static final AtomicInteger activityIdSeq = new AtomicInteger(3001);
    private static final int MAX_HISTORY = 100;

    private NotificationHelper() {}

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
        } catch (Exception ignored) { }
    }

    static boolean postIfNewVersion(Context context, long versionCode, String title, String message) {
        if (!isEnabled(context, UPDATE_ENABLED_KEY, true)) return false;
        SharedPreferences prefs = context.getSharedPreferences(PREFS, 0);
        long lastNotified = prefs.getLong(LAST_NOTIFIED_KEY, 0);
        if (versionCode > 0 && versionCode <= lastNotified) return false;
        boolean posted = post(context, UPDATE_CHANNEL_ID, "App updates", "Notifies when a new app update is available to install.", UPDATE_NOTIFICATION_ID, title, message, "update_available", "", "");
        if (posted && versionCode > 0) prefs.edit().putLong(LAST_NOTIFIED_KEY, versionCode).apply();
        return posted;
    }

    static boolean postActivity(Context context, String title, String message) {
        return postActivity(context, title, message, "", "");
    }

    static boolean postActivity(Context context, String title, String message, String type, String entityId) {
        if (!isEnabled(context, ACTIVITY_ENABLED_KEY, true)) return false;
        return post(context, ACTIVITY_CHANNEL_ID, "Activity", "Notifies when a patient or invoice is created.", activityIdSeq.incrementAndGet(), title, message, type, entityId, entityId);
    }

    private static boolean post(Context context, String channelId, String channelName, String channelDescription, int notificationId, String title, String message, String type, String entityId, String targetId) {
        try {
            ensureChannelsCreated(context);
            saveHistory(context, title, message, type, targetId);
            NotificationManagerCompat manager = NotificationManagerCompat.from(context);
            if (!manager.areNotificationsEnabled()) return false;
            Intent intent = new Intent(context, NotificationCenterActivity.class);
            intent.putExtra("type", type == null ? "" : type);
            intent.putExtra("entityId", targetId == null ? "" : targetId);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent pendingIntent = PendingIntent.getActivity(context, notificationId, intent, piFlags);
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.drawable.ic_stat_update)
                .setContentTitle(title)
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);
            if (isEnabled(context, SOUND_ENABLED_KEY, true)) builder.setDefaults(NotificationCompat.DEFAULT_SOUND);
            if (isEnabled(context, VIBRATION_ENABLED_KEY, true)) builder.setVibrate(new long[]{0, 180, 80, 180});
            manager.notify(notificationId, builder.build());
            return true;
        } catch (SecurityException ignored) {
            return false;
        } catch (Exception ignored) {
            return false;
        }
    }

    private static void saveHistory(Context context, String title, String message, String type, String targetId) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, 0);
            JSONArray old = new JSONArray(prefs.getString(HISTORY_KEY, "[]"));
            JSONArray next = new JSONArray();
            JSONObject item = new JSONObject();
            item.put("id", System.currentTimeMillis());
            item.put("title", title == null ? "Rizvi Diagnostic Center" : title);
            item.put("message", message == null ? "" : message);
            item.put("type", type == null ? "" : type);
            item.put("targetId", targetId == null ? "" : targetId);
            item.put("timestamp", System.currentTimeMillis());
            item.put("read", false);
            next.put(item);
            for (int i = 0; i < old.length() && i < MAX_HISTORY - 1; i++) next.put(old.getJSONObject(i));
            prefs.edit().putString(HISTORY_KEY, next.toString()).apply();
        } catch (Exception ignored) { }
    }

    static JSONArray getHistory(Context context) {
        try { return new JSONArray(context.getSharedPreferences(PREFS, 0).getString(HISTORY_KEY, "[]")); }
        catch (Exception ignored) { return new JSONArray(); }
    }

    static int getUnreadCount(Context context) {
        JSONArray history = getHistory(context);
        int count = 0;
        for (int i = 0; i < history.length(); i++) if (!history.optJSONObject(i).optBoolean("read", false)) count++;
        return count;
    }

    static void markAllRead(Context context) {
        try {
            JSONArray history = getHistory(context);
            for (int i = 0; i < history.length(); i++) history.optJSONObject(i).put("read", true);
            context.getSharedPreferences(PREFS, 0).edit().putString(HISTORY_KEY, history.toString()).apply();
        } catch (Exception ignored) { }
    }

    static void clearHistory(Context context) {
        context.getSharedPreferences(PREFS, 0).edit().putString(HISTORY_KEY, "[]").apply();
    }

    static boolean isActivityEnabled(Context context) { return isEnabled(context, ACTIVITY_ENABLED_KEY, true); }
    static boolean isUpdateEnabled(Context context) { return isEnabled(context, UPDATE_ENABLED_KEY, true); }
    static boolean isSoundEnabled(Context context) { return isEnabled(context, SOUND_ENABLED_KEY, true); }
    static boolean isVibrationEnabled(Context context) { return isEnabled(context, VIBRATION_ENABLED_KEY, true); }
    static void setPreference(Context context, String key, boolean value) { context.getSharedPreferences(PREFS, 0).edit().putBoolean(key, value).apply(); }

    private static boolean isEnabled(Context context, String key, boolean fallback) {
        return context.getSharedPreferences(PREFS, 0).getBoolean(key, fallback);
    }
}
