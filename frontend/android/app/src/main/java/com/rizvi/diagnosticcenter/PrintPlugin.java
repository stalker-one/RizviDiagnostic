package com.rizvi.diagnosticcenter;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(name = "Print")
public class PrintPlugin extends Plugin {
    @PluginMethod
    public void print(PluginCall call) {
        if (getBridge() == null || getBridge().getWebView() == null) {
            call.reject("Print service is not available.");
            return;
        }

        try {
            PrintManager printManager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
            if (printManager == null) {
                call.reject("Android print service is not available.");
                return;
            }

            PrintDocumentAdapter adapter = getBridge().getWebView().createPrintDocumentAdapter("Rizvi Diagnostic Invoice");
            PrintAttributes attributes = new PrintAttributes.Builder()
                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                    .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                    .build();

            printManager.print("Rizvi Diagnostic Invoice", adapter, attributes);
            call.resolve();
        } catch (Exception e) {
            call.reject("Unable to start printing: " + e.getMessage(), e);
        }
    }
}
