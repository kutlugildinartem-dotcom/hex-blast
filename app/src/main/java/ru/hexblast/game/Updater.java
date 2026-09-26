package ru.hexblast.game;

import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Обновление с GitHub Releases. Свежий APK качается потоком прямо в сессию
 * PackageInstaller: подпись та же, поэтому Android ставит его поверх, а рекорд,
 * мёд и скины в localStorage остаются. Статус уходит в игру через window.hbUpdate.
 */
final class Updater {
    static final String OWNER = "kutlugildinartem-dotcom";
    static final String REPO = "hex-blast";
    static final String ACTION_INSTALL_RESULT = "ru.hexblast.game.INSTALL_RESULT";

    private final MainActivity activity;
    private volatile String apkUrl;
    private volatile long apkSize;
    private volatile boolean busy;

    Updater(MainActivity activity) { this.activity = activity; }

    void check(boolean manual) {
        new Thread(() -> {
            try {
                HttpURLConnection c = open("https://api.github.com/repos/" + OWNER + "/" + REPO + "/releases/latest");
                c.setRequestProperty("Accept", "application/vnd.github+json");
                int code = c.getResponseCode();
                if (code == 404) { if (manual) activity.js("hbUpdate.upToDate()"); return; }
                if (code != 200) throw new IllegalStateException("GitHub ответил " + code);
                JSONObject o = new JSONObject(readAll(c.getInputStream()));
                String version = o.getString("tag_name").replaceFirst("^[vV]", "");
                String notes = o.optString("body", "");
                JSONArray assets = o.optJSONArray("assets");
                String url = null;
                long size = 0;
                if (assets != null) for (int i = 0; i < assets.length(); i++) {
                    JSONObject a = assets.getJSONObject(i);
                    if (a.getString("name").endsWith(".apk")) {
                        url = a.getString("browser_download_url");
                        size = a.optLong("size");
                        break;
                    }
                }
                if (url == null || !isNewer(version, activity.versionName())) {
                    if (manual) activity.js("hbUpdate.upToDate()");
                    return;
                }
                apkUrl = url;
                apkSize = size;
                activity.js("hbUpdate.available(" + JSONObject.quote(version) + "," + JSONObject.quote(notes) + "," + size + "," + manual + ")");
            } catch (Exception e) {
                if (manual) activity.js("hbUpdate.failed(" + JSONObject.quote("Не получилось связаться с GitHub. Проверь интернет.") + ")");
            }
        }).start();
    }

    void download() {
        if (busy || apkUrl == null) return;
        if (!activity.getPackageManager().canRequestPackageInstalls()) {
            activity.runOnUiThread(() -> activity.startActivity(new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + activity.getPackageName()))));
            activity.js("hbUpdate.needPermission()");
            return;
        }
        busy = true;
        new Thread(() -> {
            PackageInstaller.Session session = null;
            try {
                PackageInstaller installer = activity.getPackageManager().getPackageInstaller();
                PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                params.setAppPackageName(activity.getPackageName());
                if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
                int id = installer.createSession(params);
                session = installer.openSession(id);

                HttpURLConnection c = open(apkUrl);
                if (c.getResponseCode() != 200) throw new IllegalStateException("Скачивание не удалось (" + c.getResponseCode() + ")");
                long total = c.getContentLengthLong() > 0 ? c.getContentLengthLong() : apkSize;
                try (InputStream in = c.getInputStream(); OutputStream out = session.openWrite("hexblast", 0, total > 0 ? total : -1)) {
                    byte[] buf = new byte[64 * 1024];
                    long written = 0;
                    int lastPct = -1, n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        written += n;
                        if (total > 0) {
                            int pct = (int) (written * 100 / total);
                            if (pct != lastPct) { lastPct = pct; activity.js("hbUpdate.progress(" + pct + ")"); }
                        }
                    }
                    session.fsync(out);
                }
                Intent intent = new Intent(ACTION_INSTALL_RESULT).setPackage(activity.getPackageName());
                PendingIntent pi = PendingIntent.getBroadcast(activity, id, intent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE);
                session.commit(pi.getIntentSender());
                session.close();
                activity.js("hbUpdate.installing()");
            } catch (Exception e) {
                if (session != null) session.abandon();
                activity.js("hbUpdate.failed(" + JSONObject.quote("Не получилось скачать обновление. Попробуй ещё раз.") + ")");
            } finally {
                busy = false;
            }
        }).start();
    }

    private static HttpURLConnection open(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(10000);
        c.setReadTimeout(20000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("User-Agent", "HexBlast-Updater");
        return c;
    }

    private static String readAll(InputStream in) throws Exception {
        try (InputStream i = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = i.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString("UTF-8");
        }
    }

    /** «1.10» новее «1.9»: сравниваем числа по частям, а не строки. */
    static boolean isNewer(String remote, String local) {
        String[] r = remote.split("\\."), l = local.split("\\.");
        for (int i = 0; i < Math.max(r.length, l.length); i++) {
            int a = i < r.length ? parse(r[i]) : 0, b = i < l.length ? parse(l[i]) : 0;
            if (a != b) return a > b;
        }
        return false;
    }

    private static int parse(String s) {
        try { return Integer.parseInt(s.replaceAll("[^0-9]", "")); } catch (Exception e) { return 0; }
    }
}
