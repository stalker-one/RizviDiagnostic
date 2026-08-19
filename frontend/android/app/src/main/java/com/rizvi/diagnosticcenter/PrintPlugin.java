package com.rizvi.diagnosticcenter;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(name = "Print")
public class PrintPlugin extends Plugin {
    private WebView printWebView;

    @PluginMethod
    public void print(PluginCall call) {
        if (getActivity() == null) {
            call.reject("Print service is not available.");
            return;
        }

        String html = call.getString("html", "");
        String jobName = call.getString("name", "Rizvi Diagnostic Invoice");
        if (html == null || html.trim().isEmpty()) {
            call.reject("No printable HTML was provided.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                if (printManager == null) {
                    call.reject("Android print service is not available. Please enable a print service on this device.");
                    return;
                }

                if (printWebView != null) {
                    try {
                        printWebView.stopLoading();
                        printWebView.destroy();
                    } catch (Exception ignored) {
                    }
                }

                printWebView = new WebView(getActivity());
                printWebView.getSettings().setJavaScriptEnabled(false);
                printWebView.getSettings().setDefaultTextEncodingName("UTF-8");
                printWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        try {
                            PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(jobName);
                            PrintAttributes attributes = new PrintAttributes.Builder()
                                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                    .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                                    .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                                    .build();

                            printManager.print(jobName, adapter, attributes);
                            call.resolve();
                        } catch (Exception e) {
                            call.reject("Unable to start Android printing: " + e.getMessage(), e);
                        }
                    }
                });

                printWebView.loadDataWithBaseURL(
                        "https://localhost/",
                        html,
                        "text/html",
                        "UTF-8",
                        null
                );
            } catch (Exception e) {
                call.reject("Unable to initialize Android printing: " + e.getMessage(), e);
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (printWebView != null) {
            try {
                printWebView.stopLoading();
                printWebView.destroy();
            } catch (Exception ignored) {
            }
            printWebView = null;
        }
        super.handleOnDestroy();
    }
}
