package com.rizvi.diagnosticcenter;

import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Base64;

@CapacitorPlugin(name = "Export")
public class ExportPlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name", "export.csv");
        String mime = call.getString("mime", "text/csv");
        String base64 = call.getString("data", "");

        if (base64 == null || base64.trim().isEmpty()) {
            call.reject("No export data was provided.");
            return;
        }
        if (name == null || name.trim().isEmpty()) name = "export.csv";
        name = name.replaceAll("[^A-Za-z0-9._ -]", "_");
        if (!name.contains(".")) name += ".csv";
        if (mime == null || mime.trim().isEmpty()) mime = "application/octet-stream";

        try {
            // XLSX.write(... type:'base64') and CSV TextEncoder both produce plain base64.
            // Remove accidental data-URL prefixes/whitespace before decoding.
            int comma = base64.indexOf(',');
            if (base64.startsWith("data:") && comma >= 0) base64 = base64.substring(comma + 1);
            base64 = base64.replaceAll("\\s", "");
            byte[] bytes = Base64.getDecoder().decode(base64);

            Uri uri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, name);
                values.put(MediaStore.Downloads.MIME_TYPE, mime);
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Rizvi Diagnostic");
                values.put(MediaStore.Downloads.IS_PENDING, 1);

                uri = getContext().getContentResolver().insert(
                        MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IllegalStateException("Android could not create the Downloads file.");

                try (OutputStream out = getContext().getContentResolver().openOutputStream(uri)) {
                    if (out == null) throw new IllegalStateException("Unable to open the Downloads file.");
                    out.write(bytes);
                    out.flush();
                } catch (Exception e) {
                    getContext().getContentResolver().delete(uri, null, null);
                    throw e;
                }

                ContentValues done = new ContentValues();
                done.put(MediaStore.Downloads.IS_PENDING, 0);
                getContext().getContentResolver().update(uri, done, null, null);
            } else {
                File downloads = new File(
                        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                        "Rizvi Diagnostic");
                if (!downloads.exists() && !downloads.mkdirs()) {
                    throw new IllegalStateException("Unable to create Downloads/Rizvi Diagnostic folder.");
                }
                File file = new File(downloads, name);
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(bytes);
                    out.flush();
                }
                uri = FileProvider.getUriForFile(
                        getContext(), getContext().getPackageName() + ".fileprovider", file);
            }

            // Always open the Android share/open sheet after saving so the user gets
            // visible confirmation and can choose Excel/Sheets/Files/etc.
            Intent share = new Intent(Intent.ACTION_SEND);
            share.setType(mime);
            share.putExtra(Intent.EXTRA_STREAM, uri);
            share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);

            try {
                getActivity().startActivity(Intent.createChooser(share, "Open exported file"));
            } catch (Exception chooserError) {
                // The file is already safely saved. Do not turn a successful save
                // into a failed export merely because no viewer is installed.
            }

            JSObject result = new JSObject();
            result.put("name", name);
            result.put("uri", uri.toString());
            result.put("saved", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Android export failed: " + safeMessage(e));
        }
    }

    private String safeMessage(Exception e) {
        return e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
    }
}
