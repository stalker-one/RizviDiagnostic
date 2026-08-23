package com.rizvi.diagnosticcenter;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * Transparent native bridge entry point used by notification taps.
 * It opens the existing Capacitor web application and navigates to the
 * exact React route for the patient or invoice referenced by the push.
 */
public class NotificationOpenActivity extends MainActivity {
    private static final long RETRY_MS = 400L;
    private static final int MAX_RETRIES = 30;
    private String targetPath;
    private int attempts;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        targetPath = buildTargetPath(getIntent().getStringExtra("type"), getIntent().getStringExtra("entityId"));
        super.onCreate(savedInstanceState);
        scheduleNavigation();
    }

    private String buildTargetPath(String type, String entityId) {
        if (entityId == null || entityId.trim().isEmpty()) return null;
        String id = entityId.trim();
        if ("patient_created".equals(type) || "patient".equals(type)) return "/patients/" + encodePath(id);
        if ("invoice_created".equals(type) || "invoice".equals(type)) return "/invoices/" + encodePath(id) + "/print";
        return null;
    }

    private String encodePath(String value) {
        return value.replace("%", "%25").replace("/", "%2F").replace(" ", "%20");
    }

    private void scheduleNavigation() {
        if (targetPath == null) return;
        getWindow().getDecorView().postDelayed(this::navigateWhenReady, RETRY_MS);
    }

    private void navigateWhenReady() {
        if (targetPath == null || isFinishing() || isDestroyed()) return;
        try {
            if (getBridge() != null) {
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    final String path = targetPath.replace("\\", "\\\\").replace("'", "\\'");
                    webView.evaluateJavascript(
                        "(function(){try{window.location.assign('" + path + "');return true;}catch(e){return false;}})();",
                        null
                    );
                    return;
                }
            }
        } catch (Exception ignored) { }

        if (++attempts < MAX_RETRIES) {
            getWindow().getDecorView().postDelayed(this::navigateWhenReady, RETRY_MS);
        }
    }
}
