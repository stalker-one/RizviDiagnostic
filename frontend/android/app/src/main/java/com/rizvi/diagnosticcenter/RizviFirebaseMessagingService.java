package com.rizvi.diagnosticcenter;

import androidx.annotation.NonNull;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public class RizviFirebaseMessagingService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> data = message.getData();
        String title = data.getOrDefault("title", "Rizvi Diagnostic Center");
        String body = data.getOrDefault("body", "");
        if (body.isEmpty() && message.getNotification() != null) {
            String nTitle = message.getNotification().getTitle();
            String nBody = message.getNotification().getBody();
            if (nTitle != null) title = nTitle;
            if (nBody != null) body = nBody;
        }
        String type = data.getOrDefault("type", "");
        String entityId = data.getOrDefault("patientId", data.getOrDefault("invoiceId", data.getOrDefault("id", "")));
        if ("update_available".equals(type)) {
            long versionCode = 0;
            try { versionCode = Long.parseLong(data.getOrDefault("versionCode", "0")); } catch (NumberFormatException ignored) {}
            NotificationHelper.postIfNewVersion(getApplicationContext(), versionCode, title, body);
        } else {
            NotificationHelper.postActivity(getApplicationContext(), title, body, type, entityId);
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        getApplicationContext()
            .getSharedPreferences("rizvi_android_update", MODE_PRIVATE)
            .edit()
            .putString("pending_fcm_token", token)
            .apply();
    }
}
