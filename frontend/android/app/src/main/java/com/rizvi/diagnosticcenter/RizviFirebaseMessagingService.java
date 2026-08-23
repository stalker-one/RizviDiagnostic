package com.rizvi.diagnosticcenter;

import androidx.annotation.NonNull;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/**
 * Receives Firebase Cloud Messaging pushes sent by the backend whenever a
 * patient or invoice is created anywhere (website, Windows app, or either
 * Android app) -- not just from actions taken inside this app. Android
 * starts this service automatically to deliver a message even when the app
 * is fully closed/killed, which is what makes this "real time, no delay"
 * in a way a background poll (like the update check) cannot be.
 *
 * The backend sends "data" messages (not FCM's built-in "notification"
 * payload) specifically so this method always runs and we render the
 * notification ourselves through NotificationHelper -- consistent styling
 * and channel with every other notification this app posts, and it works
 * the same whether the app is foregrounded, backgrounded, or killed.
 */
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
        NotificationHelper.postActivity(getApplicationContext(), title, body);
    }

    @Override
    public void onNewToken(@NonNull String token) {
        // The authoritative registration path is JS (App.jsx), which has
        // the logged-in user's auth token and the correct backend URL
        // already available via the existing axios instance. Store the
        // freshest token locally so the app can pick it up and (re)register
        // it with the backend the next time it's opened, even if that
        // doesn't happen to be right away.
        getApplicationContext()
            .getSharedPreferences("rizvi_android_update", MODE_PRIVATE)
            .edit()
            .putString("pending_fcm_token", token)
            .apply();
    }
}
