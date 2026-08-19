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
        final String requestedType = call.getString("type", "simple-a4");
        if (getActivity() == null) { call.reject("Print service is not available."); return; }
        if (html == null || html.trim().isEmpty()) { call.reject("No printable HTML was provided."); return; }

        final String type = requestedType == null ? "simple-a4" : requestedType.toLowerCase();
        final boolean thermal = type.contains("thermal") || type.contains("58mm") || type.contains("80mm");
        final boolean narrow58 = type.contains("58mm");
        final String preparedHtml = preparePrintHtml(html, thermal, narrow58);

        getActivity().runOnUiThread(() -> {
            try {
                PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                if (printManager == null) { call.reject("Android print service is not available. Enable a print service and try again."); return; }
                destroyPrintWebView();
                printWebView = new WebView(getActivity());
                printWebView.getSettings().setJavaScriptEnabled(false);
                printWebView.getSettings().setDefaultTextEncodingName("UTF-8");
                printWebView.setVerticalScrollBarEnabled(false);
                printWebView.setHorizontalScrollBarEnabled(false);
                printWebView.setWebViewClient(new WebViewClient() {
                    private boolean started;
                    @Override public void onPageFinished(WebView view, String url) {
                        if (started) return;
                        started = true;
                        try {
                            PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(jobName);
                            PrintAttributes.Builder builder = new PrintAttributes.Builder()
                                    .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                                    .setColorMode(PrintAttributes.COLOR_MODE_COLOR);
                            if (thermal) {
                                int widthMils = narrow58 ? 2283 : 3150;
                                builder.setMediaSize(new PrintAttributes.MediaSize(
                                        narrow58 ? "THERMAL_58MM" : "THERMAL_80MM",
                                        narrow58 ? "58mm Thermal Receipt" : "80mm Thermal Receipt",
                                        widthMils,
                                        20000
                                ));
                            } else {
                                builder.setMediaSize(PrintAttributes.MediaSize.ISO_A4);
                            }
                            printManager.print(jobName, adapter, builder.build());
                            call.resolve();
                        } catch (Exception e) { call.reject("Unable to start Android printing: " + safeMessage(e)); }
                    }
                });
                printWebView.loadDataWithBaseURL("https://stalker-one-rizvidiagnostic.vercel.app/", preparedHtml, "text/html", "UTF-8", null);
            } catch (Exception e) { call.reject("Unable to initialize Android printing: " + safeMessage(e)); }
        });
    }

    private String preparePrintHtml(String html, boolean thermal, boolean narrow58) {
        String css;
        if (thermal) {
            String width = narrow58 ? "58mm" : "80mm";
            css = "<style id=\"android-thermal-print\">" +
                    "@page{size:" + width + " auto;margin:0!important;}" +
                    "html,body{width:" + width + "!important;min-width:" + width + "!important;max-width:" + width + "!important;margin:0!important;padding:0!important;}" +
                    "body{font-family:Arial,Helvetica,sans-serif!important;font-size:11px!important;line-height:1.22!important;color:#000!important;background:#fff!important;overflow:visible!important;}" +
                    "*{box-sizing:border-box!important;}" +
                    "#printable-area{width:" + width + "!important;max-width:" + width + "!important;min-width:0!important;margin:0!important;padding:0!important;overflow:visible!important;border:0!important;box-shadow:none!important;}" +
                    "#printable-area>div{width:" + width + "!important;max-width:" + width + "!important;min-width:0!important;margin:0!important;box-shadow:none!important;border:0!important;overflow:visible!important;}" +
                    "table{width:100%!important;max-width:100%!important;min-width:0!important;border-collapse:collapse!important;table-layout:fixed!important;}" +
                    "th,td{padding:2px 1px!important;vertical-align:top!important;overflow-wrap:anywhere!important;word-break:break-word!important;}" +
                    "img{display:block!important;max-width:100%!important;height:auto!important;margin-left:auto!important;margin-right:auto!important;}" +
                    "h1,h2,h3,h4,p{margin-top:0!important;margin-bottom:4px!important;}" +
                    ".no-print{display:none!important;}" +
                    "</style>";
        } else {
            // Simple print must retain the same invoice geometry as the web
            // invoice. Only remove screen-only decoration and set the A4 page;
            // do not impose a competing width, font size, table layout, or
            // padding that changes the invoice's own print CSS.
            css = "<style id=\"android-simple-print\">" +
                    "@page{size:A4;margin:10mm!important;}" +
                    "html,body{margin:0!important;padding:0!important;background:#fff!important;overflow:visible!important;}" +
                    "body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}" +
                    "#printable-area{overflow:visible!important;border:0!important;box-shadow:none!important;}" +
                    "#printable-area>div{overflow:visible!important;border:0!important;box-shadow:none!important;}" +
                    "img{max-width:100%!important;height:auto!important;}" +
                    "h1,h2,h3,h4{page-break-after:avoid!important;}" +
                    "tr{page-break-inside:avoid!important;}" +
                    ".no-print{display:none!important;}" +
                    "</style>";
        }
        String lower = html.toLowerCase();
        int headEnd = lower.indexOf("</head>");
        if (headEnd >= 0) return html.substring(0, headEnd) + css + html.substring(headEnd);
        return "<!doctype html><html><head><meta charset=\"UTF-8\">" + css + "</head><body>" + html + "</body></html>";
    }

    private String safeMessage(Exception e) { return e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage(); }
    private void destroyPrintWebView() {
        if (printWebView != null) {
            try { printWebView.stopLoading(); printWebView.destroy(); } catch (Exception ignored) {}
            printWebView = null;
        }
    }
    @Override protected void handleOnDestroy() { destroyPrintWebView(); super.handleOnDestroy(); }
}
