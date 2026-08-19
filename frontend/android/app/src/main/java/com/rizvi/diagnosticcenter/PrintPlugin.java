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
        final String html = call.getString("html", "");
        final String jobName = call.getString("name", "Rizvi Diagnostic Invoice");

        if (getActivity() == null) {
            call.reject("Print service is not available.");
            return;
        }
        if (html == null || html.trim().isEmpty()) {
            call.reject("No printable HTML was provided.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                if (printManager == null) {
                    call.reject("Android print service is not available. Enable a print service and try again.");
                    return;
                }

                destroyPrintWebView();
                printWebView = new WebView(getActivity());
                printWebView.getSettings().setJavaScriptEnabled(false);
                printWebView.getSettings().setDefaultTextEncodingName("UTF-8");
                printWebView.setWebViewClient(new WebViewClient() {
                    private boolean started = false;

                    @Override
                    public void onPageFinished(WebView view, String url) {
                        if (started) return;
                        started = true;
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
                            call.reject("Unable to start Android printing: " + safeMessage(e));
                        }
                    }
                });

                // Use a data URL base so the HTML always finishes loading in Android WebView.
                printWebView.loadDataWithBaseURL(
                        "https://rizvi-diagnostic.local/",
                        html,
                        "text/html",
                        "UTF-8",
                        null
                );
            } catch (Exception e) {
                call.reject("Unable to initialize Android printing: " + safeMessage(e));
            }
        });
    }

    private String safeMessage(Exception e) {
        return e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
    }

    private void destroyPrintWebView() {
        if (printWebView != null) {
            try {
                printWebView.stopLoading();
                printWebView.destroy();
            } catch (Exception ignored) {
            }
            printWebView = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        destroyPrintWebView();
        super.handleOnDestroy();
    }
}
