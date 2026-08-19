package com.rizvi.diagnosticcenter;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.PluginMethod;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AndroidUpdate")
public class UpdatePlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                    ? info.getLongVersionCode()
                    : info.versionCode;
            com.getcapacitor.JSObject result = new com.getcapacitor.JSObject();
            result.put("versionCode", versionCode);
            result.put("versionName", info.versionName == null ? "" : info.versionName);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Unable to read installed Android app version: " + e.getMessage(), e);
        }
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
                if (apk.exists() && !apk.delete()) {
                    throw new IllegalStateException("Unable to clear the previous update file.");
                }

                HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(120000);
                connection.setInstanceFollowRedirects(true);
                connection.setRequestProperty("User-Agent", "RizviDiagnosticCenter-Android-Updater");
                connection.setRequestProperty("Accept", "application/vnd.android.package-archive,application/octet-stream");
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

                verifyDownloadedApk(apk);

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
                    call.reject("Update verification/download failed: " + e.getMessage(), e);
                    call.setKeepAlive(false);
                });
            }
        });
    }

    private void verifyDownloadedApk(File apk) throws Exception {
        PackageManager pm = getContext().getPackageManager();
        PackageInfo archiveInfo;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            archiveInfo = pm.getPackageArchiveInfo(apk.getAbsolutePath(),
                    PackageManager.PackageInfoFlags.of(PackageManager.GET_SIGNING_CERTIFICATES));
        } else {
            archiveInfo = pm.getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.GET_SIGNATURES);
        }

        if (archiveInfo == null) {
            throw new SecurityException("Downloaded file is not a valid Android APK.");
        }
        if (!getContext().getPackageName().equals(archiveInfo.packageName)) {
            throw new SecurityException("Update APK belongs to a different application.");
        }

        byte[] installedCert = getInstalledCertificate();
        byte[] downloadedCert = getDownloadedCertificate(archiveInfo);
        if (!MessageDigest.isEqual(installedCert, downloadedCert)) {
            throw new SecurityException("Update APK signing certificate does not match this application.");
        }
    }

    private byte[] getInstalledCertificate() throws Exception {
        PackageManager pm = getContext().getPackageManager();
        PackageInfo info;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info = pm.getPackageInfo(getContext().getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
            if (info.signingInfo == null || info.signingInfo.getApkContentsSigners().length == 0) {
                throw new SecurityException("Installed application has no signing certificate.");
            }
            return certificateDigest(info.signingInfo.getApkContentsSigners()[0]);
        }
        info = pm.getPackageInfo(getContext().getPackageName(), PackageManager.GET_SIGNATURES);
        if (info.signatures == null || info.signatures.length == 0) {
            throw new SecurityException("Installed application has no signing certificate.");
        }
        return certificateDigest(info.signatures[0]);
    }

    private byte[] getDownloadedCertificate(PackageInfo info) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            if (info.signingInfo == null || info.signingInfo.getApkContentsSigners().length == 0) {
                throw new SecurityException("Downloaded APK has no signing certificate.");
            }
            return certificateDigest(info.signingInfo.getApkContentsSigners()[0]);
        }
        if (info.signatures == null || info.signatures.length == 0) {
            throw new SecurityException("Downloaded APK has no signing certificate.");
        }
        return certificateDigest(info.signatures[0]);
    }

    private byte[] certificateDigest(Signature signature) throws Exception {
        return MessageDigest.getInstance("SHA-256").digest(signature.toByteArray());
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }
}
