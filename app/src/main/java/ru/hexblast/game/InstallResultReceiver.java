package ru.hexblast.game;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;

import org.json.JSONObject;

/** Принимает статус установки обновления от PackageInstaller. */
public class InstallResultReceiver extends BroadcastReceiver {
    @SuppressWarnings("deprecation")
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Updater.ACTION_INSTALL_RESULT.equals(intent.getAction())) return;
        MainActivity a = MainActivity.current.get();
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -1);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            // Android просит подтверждение — показываем его системный диалог установки.
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try { context.startActivity(confirm); } catch (Exception ignored) { }
            }
        } else if (status == PackageInstaller.STATUS_FAILURE_ABORTED) {
            if (a != null) a.js("hbUpdate.cancelled()");
        } else if (status != PackageInstaller.STATUS_SUCCESS) {
            String msg = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
            if (a != null) a.js("hbUpdate.failed(" + JSONObject.quote("Установка не завершилась" + (msg != null ? ": " + msg : "")) + ")");
        }
    }
}
