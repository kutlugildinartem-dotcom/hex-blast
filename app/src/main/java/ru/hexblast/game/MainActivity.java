package ru.hexblast.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.DisplayCutout;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.lang.ref.WeakReference;

/**
 * Вся игра живёт в assets/index.html. Активити показывает её на весь экран
 * (без статус-бара и навигации, в том числе под вырезом камеры) и даёт игре
 * мост HexAndroid: вибрацию, отступы выреза и обновления с GitHub.
 */
public class MainActivity extends Activity {
    static WeakReference<MainActivity> current = new WeakReference<>(null);

    private WebView web;
    private Haptics haptics;
    private Updater updater;
    private float insetTop, insetBottom;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        current = new WeakReference<>(this);
        haptics = new Haptics(this);
        updater = new Updater(this);

        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= 30
                    ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                    : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            w.setAttributes(lp);
        }
        w.setStatusBarColor(Color.TRANSPARENT);
        w.setNavigationBarColor(Color.TRANSPARENT);

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#100E24"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setHapticFeedbackEnabled(false);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // рекорд, мёд, скины и партия лежат в localStorage
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);                     // системный размер шрифта не должен ломать вёрстку

        web.addJavascriptInterface(new Bridge(), "HexAndroid");
        web.setWebViewClient(new WebViewClient());
        web.setOnApplyWindowInsetsListener((v, insets) -> {
            readCutout(insets);
            return insets;
        });
        setContentView(web);
        hideSystemUi();
        web.loadUrl("file:///android_asset/index.html");
    }

    private void readCutout(WindowInsets insets) {
        float d = getResources().getDisplayMetrics().density;
        float top = 0, bottom = 0;
        if (Build.VERSION.SDK_INT >= 28) {
            DisplayCutout c = insets.getDisplayCutout();
            if (c != null) { top = c.getSafeInsetTop() / d; bottom = c.getSafeInsetBottom() / d; }
        }
        if (top != insetTop || bottom != insetBottom) {
            insetTop = top;
            insetBottom = bottom;
            js("window.hbInsets && hbInsets(" + insetTop + "," + insetBottom + ")");
        }
    }

    @SuppressWarnings("deprecation")
    private void hideSystemUi() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            w.getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    /** Кнопку «Назад» сначала обрабатывает игра: закрывает экран или ставит паузу. */
    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.hbBack ? hbBack() : false", result -> {
            if (!"true".equals(result)) finish();
        });
    }

    @Override
    protected void onPause() {
        web.evaluateJavascript("window.hbSave && window.hbSave()", null);
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        hideSystemUi();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }

    void js(String code) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); });
    }

    String versionName() {
        try {
            PackageInfo p = getPackageManager().getPackageInfo(getPackageName(), 0);
            return p.versionName;
        } catch (Exception e) {
            return "?";
        }
    }

    private class Bridge {
        @JavascriptInterface public void haptic(String type, int a, int b, int level) { haptics.play(type, a, b, level); }
        @JavascriptInterface public void vibrate(int ms) { haptics.play("tick", ms, 0, 2); }
        @JavascriptInterface public float insetTop() { return insetTop; }
        @JavascriptInterface public float insetBottom() { return insetBottom; }
        @JavascriptInterface public String appVersion() { return versionName(); }
        @JavascriptInterface public void checkUpdate(boolean manual) { updater.check(manual); }
        @JavascriptInterface public void startUpdate() { updater.download(); }
    }
}
