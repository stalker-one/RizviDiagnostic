package com.rizvi.diagnosticcenter;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AndroidUpdate")
public class UpdatePlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void getVersion(PluginCall call) {
        com.getcapacitor.JSObject result = new com.getcapacitor.JSObject();
        result.put("versionCode", BuildConfig.VERSION_CODE);
        result.put("versionName", BuildConfig.VERSION_NAME);
        call.resolve(result);
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        String url = call.getString("url", "");
        if (url == null || url.trim().isEmpty()) {
            call.reject("Update download URL is missing.");
            return;
        }
        if (!url.startsWith("https://")) {
            call.reject("Only secure HTTPS update URLs are allowed.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            try {
                Intent settingsIntent = new Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getContext().getPackageName())
                );
                getActivity().startActivity(settingsIntent);
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
                if (apk.exists()) apk.delete();

                HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(120000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent", "RizviDiagnosticCenter-Android-Updater");
                connection.connect();

                if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) {
                    throw new IllegalStateException("Update server returned HTTP " + connection.getResponseCode());
                }

                try (InputStream input = connection.getInputStream();
                     FileOutputStream output = new FileOutputStream(apk)) {
                    byte[] buffer = new byte[8192];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        output.write(buffer, 0, count);
                    }
                } finally {
                    connection.disconnect();
                }

                if (!apk.isFile() || apk.length() < 10000) {
                    throw new IllegalStateException("Downloaded update APK is incomplete.");
                }

                getActivity().runOnUiThread(() -> {
                    try {
                        Uri apkUri = FileProvider.getUriForFile(
                                getContext(),
                                getContext().getPackageName() + ".fileprovider",
                                apk
                        );
                        Intent installIntent = new Intent(Intent.ACTION_VIEW);
                        installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getActivity().startActivity(installIntent);
                        call.resolve();
                    } catch (Exception e) {
                        call.reject("Unable to start Android update installer: " + e.getMessage(), e);
                    } finally {
                        call.setKeepAlive(false);
                    }
                });
            } catch (Exception e) {
                getActivity().runOnUiThread(() -> {
                    call.reject("Update download failed: " + e.getMessage(), e);
                    call.setKeepAlive(false);
                });
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }
}
