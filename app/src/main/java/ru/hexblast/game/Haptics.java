package ru.hexblast.game;

import android.content.Context;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

import java.util.ArrayList;
import java.util.List;

/**
 * Вибро-эффекты игры. Каждый эффект — последовательность отрезков «длительность,
 * сила». Уровень из настроек: 1 — мягко, 2 — сочно, 3 — «космос» (на полную,
 * длиннее и с раскатистым хвостом после крупных событий).
 */
final class Haptics {
    private final Vibrator vibrator;
    private final boolean amplitude;

    Haptics(Context context) {
        Vibrator v;
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            v = vm != null ? vm.getDefaultVibrator() : null;
        } else {
            v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
        }
        vibrator = v != null && v.hasVibrator() ? v : null;
        amplitude = vibrator != null && vibrator.hasAmplitudeControl();
    }

    private static final class Pattern {
        final List<long[]> seg = new ArrayList<>();
        Pattern on(long ms, int amp) { seg.add(new long[]{ms, amp}); return this; }
        Pattern off(long ms) { seg.add(new long[]{ms, 0}); return this; }
    }

    void play(String type, int a, int b, int level) {
        if (vibrator == null || level <= 0) return;
        boolean cosmos = level >= 3;
        Pattern p = new Pattern();
        switch (type) {
            case "tick": p.on(Math.max(6, a > 0 ? a : 8), 70); break;
            case "pick": p.on(14, 110); break;
            case "place": p.on(22, 235).off(16).on(12, 90); break;
            case "invalid": p.on(14, 100).off(45).on(14, 100); break;
            case "clear": {
                // a — сколько сот сгорело, b — линии в младшем байте и комбо в старших.
                int cells = Math.max(1, Math.min(a, 20)), lines = Math.max(1, b & 0xff), combo = Math.max(1, b >> 8);
                for (int i = 0; i < cells; i++) p.on(13, 90 + 165 * i / cells).off(15);
                p.on(55 + lines * 25L, 255);
                for (int i = 1; i < Math.min(combo, 5); i++) p.off(35).on(35 + i * 8L, 255);
                if (cosmos) for (int i = 0; i < 8; i++) p.off(10).on(24, 230 - i * 25);
                break;
            }
            case "bomb":
                p.on(110, 255).off(20);
                for (int i = 0; i < 12; i++) p.on(26, 255 - i * 17).off(12);
                if (cosmos) p.on(200, 150).off(30).on(160, 90);
                break;
            case "thunder": {
                // Разряд: резкий удар, потом долгий неровный раскат грома.
                java.util.Random r = new java.util.Random();
                p.on(45, 255).off(25).on(25, 210).off(40);
                int amp = 255;
                for (int i = 0; i < 18; i++) { p.on(30 + r.nextInt(40), Math.max(30, amp - r.nextInt(70))).off(10 + r.nextInt(30)); amp -= 11; }
                if (cosmos) p.on(300, 130).off(40).on(260, 80);
                break;
            }
            case "thunderbomb": {
                // Молния + бомба: тяжёлый двойной удар и длинный неровный раскат.
                java.util.Random r = new java.util.Random();
                p.on(140, 255).off(20).on(60, 255).off(25);
                int amp = 255;
                for (int i = 0; i < 22; i++) { p.on(28 + r.nextInt(45), Math.max(40, amp - r.nextInt(60))).off(8 + r.nextInt(25)); amp -= 9; }
                if (cosmos) p.on(350, 160).off(40).on(300, 90);
                break;
            }
            case "record":
                for (int i = 0; i < 3; i++) p.on(40, 255).off(55);
                p.on(190, 255);
                if (cosmos) for (int i = 0; i < 6; i++) p.off(20).on(40, 220 - i * 30);
                break;
            case "over": p.on(130, 200).off(90).on(130, 140).off(90).on(280, 90); break;
            case "coin": p.on(10, 130); break;
            case "buy": p.on(30, 255).off(45).on(30, 255).off(45).on(140, 255); break;
            case "streak": p.on(40, 200).off(60).on(40, 230).off(60).on(110, 255); break;
            case "undo": p.on(35, 110).off(30).on(35, 160).off(30).on(45, 220); break;
            case "combo":
                for (int i = 0; i < Math.min(Math.max(a, 2), 6); i++) p.on(28, 170 + i * 15).off(26);
                break;
            default: p.on(10, 80);
        }
        vibrate(p, level);
    }

    private void vibrate(Pattern p, int level) {
        double ampK = level == 1 ? .42 : level == 2 ? .8 : 1.0;
        double lenK = level == 1 ? .7 : level == 2 ? 1.0 : 1.35;
        int n = p.seg.size();
        long[] timings = new long[n + 1];
        int[] amps = new int[n + 1];
        for (int i = 0; i < n; i++) {
            long[] s = p.seg.get(i);
            boolean on = s[1] > 0;
            timings[i + 1] = Math.max(1, Math.round(s[0] * (on ? lenK : 1.0)));
            amps[i + 1] = on ? (int) Math.max(1, Math.min(255, Math.round(s[1] * ampK))) : 0;
        }
        try {
            VibrationEffect effect = amplitude
                    ? VibrationEffect.createWaveform(timings, amps, -1)
                    : VibrationEffect.createWaveform(onOff(timings, amps), -1);
            if (Build.VERSION.SDK_INT >= 33) {
                vibrator.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_MEDIA));
            } else {
                vibrator.vibrate(effect, new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_GAME)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
            }
        } catch (Exception ignored) {
        }
    }

    /** Без управления силой: паттерн «пауза, вибрация, пауза…», соседние отрезки склеиваются. */
    private static long[] onOff(long[] timings, int[] amps) {
        List<Long> out = new ArrayList<>();
        boolean wantOn = false;
        long acc = 0;
        for (int i = 0; i < timings.length; i++) {
            boolean on = amps[i] > 0;
            if (on != wantOn) { out.add(acc); acc = 0; wantOn = on; }
            acc += timings[i];
        }
        out.add(acc);
        long[] r = new long[out.size()];
        for (int i = 0; i < r.length; i++) r[i] = out.get(i);
        return r;
    }
}
