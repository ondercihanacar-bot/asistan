package com.asistan.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {

    private static final String PREFS_NAME = "asistan_prefs";
    private static final String KEY_SERVER_URL = "server_url";
    private static final String DEFAULT_USB_URL = "http://localhost:8000";
    private static final String DEFAULT_WIFI_URL = "http://10.22.250.66:8000";

    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressBar;
    private LinearLayout layoutError;
    private TextView txtCurrentServer;
    private Button btnRetry;
    private Button btnSettings;

    private SharedPreferences prefs;
    private String currentServerUrl;
    private boolean isPageLoadedSuccessfully = false;
    private long backPressedTime = 0;

    private ValueCallback<Uri[]> fileUploadCallback;
    private ActivityResultLauncher<Intent> fileChooserLauncher;
    private ActivityResultLauncher<String[]> permissionsLauncher;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Dark edge-to-edge system bars
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(ContextCompat.getColor(this, R.color.background));
        window.setNavigationBarColor(ContextCompat.getColor(this, R.color.background));

        setContentView(R.layout.activity_main);

        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        // Default to Wi-Fi URL, can switch to USB or Custom URL anytime
        currentServerUrl = prefs.getString(KEY_SERVER_URL, DEFAULT_WIFI_URL);

        initViews();
        setupLaunchers();
        setupWebView();
        setupBackNavigation();
        requestNecessaryPermissions();

        loadServerUrl(currentServerUrl);
    }

    private void initViews() {
        webView = findViewById(R.id.webView);
        swipeRefresh = findViewById(R.id.swipeRefresh);
        progressBar = findViewById(R.id.progressBar);
        layoutError = findViewById(R.id.layoutError);
        txtCurrentServer = findViewById(R.id.txtCurrentServer);
        btnRetry = findViewById(R.id.btnRetry);
        btnSettings = findViewById(R.id.btnSettings);

        swipeRefresh.setColorSchemeResources(R.color.primary, R.color.secondary);
        swipeRefresh.setProgressBackgroundColorSchemeResource(R.color.surface);

        swipeRefresh.setOnRefreshListener(() -> {
            if (webView != null) {
                webView.reload();
            } else {
                swipeRefresh.setRefreshing(false);
            }
        });

        btnRetry.setOnClickListener(v -> {
            layoutError.setVisibility(View.GONE);
            swipeRefresh.setVisibility(View.VISIBLE);
            loadServerUrl(currentServerUrl);
        });

        btnSettings.setOnClickListener(v -> showServerConfigDialog());
    }

    private void setupLaunchers() {
        // File Chooser Launcher (for Invoice / Receipt upload OCR)
        fileChooserLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (fileUploadCallback == null) return;
                    Uri[] results = null;
                    if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                        if (result.getData().getData() != null) {
                            results = new Uri[]{result.getData().getData()};
                        } else if (result.getData().getClipData() != null) {
                            int count = result.getData().getClipData().getItemCount();
                            results = new Uri[count];
                            for (int i = 0; i < count; i++) {
                                results[i] = result.getData().getClipData().getItemAt(i).getUri();
                            }
                        }
                    }
                    fileUploadCallback.onReceiveValue(results);
                    fileUploadCallback = null;
                }
        );

        // Permissions Launcher
        permissionsLauncher = registerForActivityResult(
                new ActivityResultContracts.RequestMultiplePermissions(),
                result -> {
                    // Permissions evaluated silently
                }
        );
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(true);
        ws.setAllowContentAccess(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setUseWideViewPort(true);
        ws.setLoadWithOverviewMode(true);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        ws.setUserAgentString(ws.getUserAgentString() + " AsistanAndroidApp/1.0");

        // Keep swipe-to-refresh disabled when scrolled down inside web page
        webView.getViewTreeObserver().addOnScrollChangedListener(() -> {
            swipeRefresh.setEnabled(webView.getScrollY() == 0);
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                progressBar.setVisibility(View.VISIBLE);
                progressBar.setProgress(10);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
                if (!isPageLoadedSuccessfully) {
                    isPageLoadedSuccessfully = true;
                    layoutError.setVisibility(View.GONE);
                    swipeRefresh.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    isPageLoadedSuccessfully = false;
                    progressBar.setVisibility(View.GONE);
                    swipeRefresh.setRefreshing(false);
                    showConnectionError();
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                if (newProgress >= 100) {
                    progressBar.setVisibility(View.GONE);
                }
            }

            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                }
                fileUploadCallback = filePathCallback;

                Intent intent = fileChooserParams.createIntent();
                try {
                    fileChooserLauncher.launch(intent);
                } catch (Exception e) {
                    fileUploadCallback = null;
                    Toast.makeText(MainActivity.this, "Dosya seçici açılamadı", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });
    }

    private void setupBackNavigation() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    if (System.currentTimeMillis() - backPressedTime < 2000) {
                        finish();
                    } else {
                        backPressedTime = System.currentTimeMillis();
                        Toast.makeText(MainActivity.this, "Çıkmak için tekrar basın", Toast.LENGTH_SHORT).show();
                    }
                }
            }
        });
    }

    private void loadServerUrl(String url) {
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "http://" + url;
        }
        currentServerUrl = url;
        prefs.edit().putString(KEY_SERVER_URL, currentServerUrl).apply();
        isPageLoadedSuccessfully = false;
        webView.loadUrl(currentServerUrl);
    }

    private void showConnectionError() {
        swipeRefresh.setVisibility(View.GONE);
        layoutError.setVisibility(View.VISIBLE);
        txtCurrentServer.setText(currentServerUrl);
    }

    private void showServerConfigDialog() {
        Dialog dialog = new Dialog(this);
        dialog.setContentView(R.layout.dialog_server_config);
        if (dialog.getWindow() != null) {
            dialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        }

        EditText editUrl = dialog.findViewById(R.id.editServerUrl);
        Button btnUsb = dialog.findViewById(R.id.btnQuickUsb);
        Button btnWifi = dialog.findViewById(R.id.btnQuickWifi);

        editUrl.setText(currentServerUrl);

        btnUsb.setOnClickListener(v -> {
            dialog.dismiss();
            loadServerUrl(DEFAULT_USB_URL);
        });

        btnWifi.setOnClickListener(v -> {
            dialog.dismiss();
            loadServerUrl(DEFAULT_WIFI_URL);
        });

        editUrl.setOnEditorActionListener((v, actionId, event) -> {
            String newUrl = editUrl.getText().toString().trim();
            if (!newUrl.isEmpty()) {
                dialog.dismiss();
                loadServerUrl(newUrl);
            }
            return true;
        });

        dialog.show();
    }

    private void requestNecessaryPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionsLauncher.launch(new String[]{
                    Manifest.permission.CAMERA,
                    Manifest.permission.READ_MEDIA_IMAGES,
                    Manifest.permission.POST_NOTIFICATIONS
            });
        } else {
            permissionsLauncher.launch(new String[]{
                    Manifest.permission.CAMERA,
                    Manifest.permission.READ_EXTERNAL_STORAGE
            });
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) webView.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
