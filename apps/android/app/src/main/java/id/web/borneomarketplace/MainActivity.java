package id.web.borneomarketplace;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JsResult;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import java.io.OutputStream;
import java.util.ArrayList;

/** HTTPS-only shell. No native JavaScript bridge or shared filesystem access. */
public final class MainActivity extends ComponentActivity {
    private static final String SITE = "https://borneomarketplace.web.id";
    private static final int UPLOAD = 10, SAVE_DOCUMENT = 11;
    private static final int MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
    private WebView web;
    private ProgressBar progress;
    private LinearLayout errorPanel;
    private ValueCallback<Uri[]> uploadCallback;
    private byte[] pendingDocument;
    private String retryUrl = SITE + "/app";

    private static boolean trusted(Uri uri) {
        return "https".equalsIgnoreCase(uri.getScheme())
            && "borneomarketplace.web.id".equalsIgnoreCase(uri.getHost())
            && (uri.getPort() == -1 || uri.getPort() == 443)
            && uri.getUserInfo() == null;
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(244,250,254));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        root.addView(progress, new LinearLayout.LayoutParams(-1, 4));
        errorPanel = new LinearLayout(this);
        errorPanel.setOrientation(LinearLayout.VERTICAL);
        errorPanel.setPadding(32, 48, 32, 32);
        TextView notice = new TextView(this);
        notice.setText("Borneo Marketplace\n\nWebsite belum dapat dimuat. Periksa koneksi internet, lalu coba lagi.");
        notice.setTextColor(Color.rgb(16,43,67)); notice.setTextSize(18);
        errorPanel.addView(notice);
        Button retry = new Button(this); retry.setText("Coba Lagi");
        retry.setOnClickListener(view -> { errorPanel.setVisibility(View.GONE); web.setVisibility(View.VISIBLE); web.loadUrl(retryUrl); });
        errorPanel.addView(retry); errorPanel.setVisibility(View.GONE);
        root.addView(errorPanel);
        web = new WebView(this);
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root); root.requestApplyInsets();
        WebSettings settings = web.getSettings();
        // Honor width=device-width and initial-scale, rather than a desktop-style
        // layout/text autosizing on a narrow WebView. Keep pinch zoom accessible.
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NORMAL);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setUserAgentString(settings.getUserAgentString() + " BorneoAndroid/1.0.2");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!request.isForMainFrame()) return !trusted(uri);
                if ("data".equals(uri.getScheme()) && trusted(Uri.parse(view.getUrl()))) {
                    download(uri.toString(), settings.getUserAgentString(), null, null, -1); return true;
                }
                if (trusted(uri)) return false;
                openExternal(uri); return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) {
                if (!trusted(Uri.parse(url))) { view.stopLoading(); showError(); return; }
                retryUrl = url; errorPanel.setVisibility(View.GONE); web.setVisibility(View.VISIBLE);
            }
            @Override public void onPageFinished(WebView view, String url) { CookieManager.getInstance().flush(); }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showError();
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, android.webkit.WebResourceResponse error) {
                if (request.isForMainFrame() && error.getStatusCode() >= 500) showError();
            }
            // SSL failures retain Android's default cancel behavior; never bypass certificates.
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) {
                progress.setProgress(value); progress.setVisibility(value == 100 ? View.GONE : View.VISIBLE);
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!trusted(Uri.parse(view.getUrl()))) return false;
                if (uploadCallback != null) uploadCallback.onReceiveValue(null);
                uploadCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("image/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(intent, UPLOAD); }
                catch (ActivityNotFoundException error) { callback.onReceiveValue(null); uploadCallback = null; toast("Pemilih gambar tidak tersedia."); }
                return true;
            }
            @Override public boolean onCreateWindow(WebView view, boolean dialog, boolean userGesture, android.os.Message result) {
                if (!userGesture) return false;
                WebView popup = new WebView(MainActivity.this);
                popup.getSettings().setAllowFileAccess(false);
                popup.getSettings().setAllowContentAccess(false);
                popup.setWebViewClient(new WebViewClient() {
                    @Override public boolean shouldOverrideUrlLoading(WebView window, WebResourceRequest request) {
                        Uri uri = request.getUrl();
                        if (trusted(uri)) web.loadUrl(uri.toString()); else openExternal(uri);
                        window.destroy(); return true;
                    }
                });
                ((WebView.WebViewTransport)result.obj).setWebView(popup); result.sendToTarget(); return true;
            }
            @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                if (!trusted(Uri.parse(url))) { result.cancel(); return true; }
                new AlertDialog.Builder(MainActivity.this).setTitle("Borneo Marketplace").setMessage(message)
                    .setPositiveButton("Lanjut", (dialog, which) -> result.confirm())
                    .setNegativeButton("Batal", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel()).show(); return true;
            }
        });
        web.setDownloadListener(this::download);
        if (state == null || web.restoreState(state) == null) web.loadUrl(SITE + "/app");
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { navigateBack(); }
        });
    }

    private void openExternal(Uri uri) {
        String scheme = uri.getScheme();
        if (!("https".equalsIgnoreCase(scheme) || "mailto".equalsIgnoreCase(scheme)
            || "tel".equalsIgnoreCase(scheme))) { toast("Tautan ini tidak didukung."); return; }
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException error) { toast("Tidak ada aplikasi untuk membuka tautan ini."); }
    }
    private void showError() { progress.setVisibility(View.GONE); web.setVisibility(View.GONE); errorPanel.setVisibility(View.VISIBLE); }
    private void toast(String message) { Toast.makeText(this, message, Toast.LENGTH_LONG).show(); }
    private void navigateBack() { if (web.canGoBack()) web.goBack(); else finish(); }

    private void download(String url, String userAgent, String disposition, String mime, long size) {
        if (!trusted(Uri.parse(web.getUrl()))) return;
        // Web exports use data URLs in this shell; no JavaScript-to-native interface is exposed.
        if (url.startsWith("data:")) {
            if (pendingDocument != null) { toast("Selesaikan penyimpanan sebelumnya terlebih dahulu."); return; }
            try {
                int separator = url.indexOf(',');
                String header = url.substring(0, separator);
                String type = header.substring(5).split(";")[0].trim();
                if (!header.endsWith(";base64") || !(type.equals("application/pdf") || type.equals("text/csv")
                    || type.equals("application/vnd.ms-excel")
                    || type.equals("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                    || url.length() > MAX_DOCUMENT_BYTES * 4L / 3 + 256) throw new IllegalArgumentException();
                pendingDocument = Base64.decode(url.substring(separator + 1), Base64.DEFAULT);
                String name = "Laporan-Borneo" + (type.equals("application/pdf") ? ".pdf" : type.equals("text/csv") ? ".csv" : type.equals("application/vnd.ms-excel") ? ".xls" : ".xlsx");
                Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType(type).putExtra(Intent.EXTRA_TITLE, name);
                startActivityForResult(save, SAVE_DOCUMENT);
            } catch (Exception error) { pendingDocument = null; toast("Dokumen tidak dapat disimpan."); }
            return;
        }
        if (!trusted(Uri.parse(url))) { openExternal(Uri.parse(url)); return; }
        try {
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.addRequestHeader("User-Agent", userAgent);
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null) request.addRequestHeader("Cookie", cookies);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            String filename = URLUtil.guessFileName(url, disposition, mime);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);
            request.setTitle(filename); request.setMimeType(mime);
            ((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(request);
            toast("Unduhan dimulai.");
        } catch (Exception error) { toast("Unduhan gagal dimulai."); }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == UPLOAD && uploadCallback != null) {
            ArrayList<Uri> selected = new ArrayList<>();
            if (result == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    for (int i = 0; i < data.getClipData().getItemCount(); i++) selected.add(data.getClipData().getItemAt(i).getUri());
                } else if (data.getData() != null) selected.add(data.getData());
            }
            selected.removeIf(uri -> !"content".equals(uri.getScheme()));
            uploadCallback.onReceiveValue(selected.isEmpty() ? null : selected.toArray(new Uri[0])); uploadCallback = null;
        } else if (request == SAVE_DOCUMENT) {
            if (result == RESULT_OK && data != null && data.getData() != null && pendingDocument != null) {
                byte[] document = pendingDocument;
                Uri destination = data.getData();
                new Thread(() -> {
                    try (OutputStream output = getContentResolver().openOutputStream(destination)) {
                        if (output == null) throw new java.io.IOException();
                        output.write(document); runOnUiThread(() -> toast("Dokumen tersimpan."));
                    } catch (Exception error) { runOnUiThread(() -> toast("Dokumen gagal disimpan.")); }
                }).start();
            }
            pendingDocument = null;
        }
    }
    // Resize the same WebView on rotation: do not reload the page or lose in-progress forms.
    @Override public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        if (web != null) web.getRootView().requestApplyInsets();
    }
    @Override protected void onSaveInstanceState(Bundle state) { web.saveState(state); super.onSaveInstanceState(state); }
    @Override protected void onPause() { CookieManager.getInstance().flush(); web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() {
        if (uploadCallback != null) uploadCallback.onReceiveValue(null);
        pendingDocument = null; web.destroy(); super.onDestroy();
    }
}
