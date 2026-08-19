package com.rizvi.diagnosticcenter;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Print")
public class PrintPlugin extends Plugin {
    private WebView printWebView;

    @PluginMethod
    public void print(PluginCall call) {
        final String html = call.getString("html", "");
        final String jobName = call.getString("name", "Rizvi Diagnostic Invoice");
        final String requestedType = call.getString("type", "");

        if (getActivity() == null) {
            call.reject("Print service is not available.");
            return;
        }
        if (html == null || html.trim().isEmpty()) {
            call.reject("No printable HTML was provided.");
            return;
        }

        final boolean thermal = isThermal(requestedType, jobName, html);
        final String preparedHtml = preparePrintHtml(html, thermal);

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
                printWebView.setVerticalScrollBarEnabled(false);
                printWebView.setHorizontalScrollBarEnabled(false);
                printWebView.setWebViewClient(new WebViewClient() {
                    private boolean started = false;

                    @Override
                    public void onPageFinished(WebView view, String url) {
                        if (started) return;
                        started = true;
                        try {
                            PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(jobName);
                            PrintAttributes.Builder builder = new PrintAttributes.Builder()
                                    .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                                    .setColorMode(PrintAttributes.COLOR_MODE_COLOR);

                            if (thermal) {
                                // 80mm thermal receipt. Android PrintAttributes uses mils.
                                // 80mm = 3.1496in = approximately 3150 mils.
                                // A generous height lets the WebView paginate the receipt
                                // vertically without forcing it onto an A4 sheet.
                                builder.setMediaSize(new PrintAttributes.MediaSize(
                                        "THERMAL_80MM",
                                        "80mm Thermal Receipt",
                                        3150,
                                        10000
                                ));
                            } else {
                                builder.setMediaSize(PrintAttributes.MediaSize.ISO_A4);
                            }

                            printManager.print(jobName, adapter, builder.build());
                            call.resolve();
                        } catch (Exception e) {
                            call.reject("Unable to start Android printing: " + safeMessage(e));
                        }
                    }
                });

                printWebView.loadDataWithBaseURL(
                        "https://stalker-one-rizvidiagnostic.vercel.app/",
                        preparedHtml,
                        "text/html",
                        "UTF-8",
                        null
                );
            } catch (Exception e) {
                call.reject("Unable to initialize Android printing: " + safeMessage(e));
            }
        });
    }

    private boolean isThermal(String type, String jobName, String html) {
        String value = ((type == null ? "" : type) + " " +
                (jobName == null ? "" : jobName) + " " +
                (html == null ? "" : html)).toLowerCase();
        return value.contains("thermal") || value.contains("receipt") || value.contains("80mm") || value.contains("58mm");
    }

    private String preparePrintHtml(String html, boolean thermal) {
        String css = thermal
                ? "<style id=\"android-thermal-print\">" +
                  "@page{size:80mm auto;margin:0!important;}" +
                  "html,body{width:80mm!important;min-width:80mm!important;max-width:80mm!important;margin:0!important;padding:0!important;}" +
                  "body{font-family:Arial,Helvetica,sans-serif!important;font-size:11px!important;line-height:1.25!important;color:#000!important;background:#fff!important;overflow:visible!important;}" +
                  "*{box-sizing:border-box!important;}" +
                  "table{width:100%!important;max-width:100%!important;border-collapse:collapse!important;}" +
                  "img{max-width:100%!important;height:auto!important;}" +
                  "th,td{padding:2px 1px!important;word-break:break-word!important;}" +
                  ".thermal,.thermal-print,.receipt,.receipt-print{width:100%!important;max-width:100%!important;margin:0!important;padding:0!important;}" +
                  "@media print{body{margin:0!important;padding:0!important;} .no-print{display:none!important;}}" +
                  "</style>"
                : "<style id=\"android-simple-print\">" +
                  "@page{size:A4;margin:8mm;}" +
                  "html,body{max-width:100%!important;margin:0!important;}" +
                  "body{font-family:Arial,Helvetica,sans-serif!important;color:#000!important;background:#fff!important;}" +
                  "img{max-width:100%!important;height:auto!important;}" +
                  "table{max-width:100%!important;border-collapse:collapse;}" +
                  "@media print{body{margin:0!important;}}" +
                  "</style>";

        int headEnd = html.toLowerCase().indexOf("</head>");
        if (headEnd >= 0) {
            return html.substring(0, headEnd) + css + html.substring(headEnd);
        }
        return "<!doctype html><html><head><meta charset=\"UTF-8\">" + css + "</head><body>" + html + "</body></html>";
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
