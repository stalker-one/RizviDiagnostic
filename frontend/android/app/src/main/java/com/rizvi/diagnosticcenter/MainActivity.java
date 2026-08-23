package com.rizvi.diagnosticcenter;

import android.content.res.AssetFileDescriptor;
import android.graphics.Color;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Bundle;
import android.view.Gravity;
import android.view.Surface;
import android.view.SurfaceHolder;
import android.view.SurfaceView;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.graphics.PixelFormat;
import android.widget.FrameLayout;
import com.getcapacitor.BridgeActivity;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;
import java.io.IOException;
import java.util.concurrent.TimeUnit;

public class MainActivity extends BridgeActivity {
    private SurfaceView startupVideo;
    private Surface startupSurface;
    private MediaPlayer startupPlayer;
    private FrameLayout startupRoot;
    private boolean startupShown;
    private boolean startupFinished;
    private boolean surfaceReady;
    private int videoWidth;
    private int videoHeight;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrintPlugin.class);
        registerPlugin(UpdatePlugin.class);
        registerPlugin(ExportPlugin.class);
        super.onCreate(savedInstanceState);
        scheduleBackgroundUpdateCheck();
        getWindow().getDecorView().post(this::showStartupAnimation);
    }

    // Runs UpdateCheckWorker roughly every 6 hours so an update notification
    // can appear even while the app isn't open. WorkManager persists this
    // schedule (across app restarts and device reboots) once it has been
    // enqueued -- KEEP means re-launching the app won't reset or duplicate
    // an already-scheduled check. The interval is a minimum/best-effort
    // under Android's battery optimization (Doze), not an exact timer.
    private void scheduleBackgroundUpdateCheck() {
        try {
            PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                    com.rizvi.diagnosticcenter.UpdateCheckWorker.class, 6, TimeUnit.HOURS
                )
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .build();
            WorkManager.getInstance(getApplicationContext())
                .enqueueUniquePeriodicWork("rizvi_update_check", ExistingPeriodicWorkPolicy.KEEP, request);
        } catch (Exception ignored) {
            // Scheduling failing here shouldn't block the app from starting;
            // the foreground, in-app check still runs normally either way.
        }
    }

    // WorkManager's periodic background update check (scheduleBackgroundUpdateCheck)
    // can be silently prevented from running by Android's Doze/battery
    // optimization, especially on OEM skins (Xiaomi/Oppo/Vivo etc.) that
    // are more aggressive about killing background work than stock
    // Android. Requesting exemption from battery optimization is the
    // official, standard Android mechanism to make background checks run
    // reliably; it shows a system dialog the user can accept or decline.
    // Asked at most once ever (not on every app open) to avoid nagging.
    private void requestBatteryOptimizationExemptionOnce() {
        try {
            SharedPreferences prefs = getApplicationContext().getSharedPreferences("rizvi_android_update", MODE_PRIVATE);
            if (prefs.getBoolean("battery_opt_asked", false)) return;
            prefs.edit().putBoolean("battery_opt_asked", true).apply();
            PowerManager pm = (PowerManager) getApplicationContext().getSystemService(Context.POWER_SERVICE);
            String pkg = getApplicationContext().getPackageName();
            if (pm != null && !pm.isIgnoringBatteryOptimizations(pkg)) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + pkg));
                startActivity(intent);
            }
        } catch (Exception ignored) {
            // Some OEM builds (or devices without this system intent
            // available) will fail here -- background checks still run,
            // just less reliably under that device's battery restrictions.
        }
    }

    private void showStartupAnimation() {
        if (startupShown || isFinishing() || isDestroyed()) return;
        startupShown = true;
        try {
            Window window = getWindow();
            window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            applyImmersiveFullscreen();

            View decor = window.getDecorView();
            if (!(decor instanceof ViewGroup)) {
                finishStartupAnimation();
                return;
            }

            startupRoot = new FrameLayout(this);
            startupRoot.setBackgroundColor(Color.BLACK);
            startupRoot.setClickable(true);
            startupRoot.setFocusable(true);

            startupVideo = new SurfaceView(this);
            startupVideo.setBackgroundColor(Color.BLACK);
            startupVideo.setZOrderOnTop(true);
            startupVideo.getHolder().setFormat(PixelFormat.OPAQUE);
            startupVideo.getHolder().addCallback(new SurfaceHolder.Callback() {
                @Override
                public void surfaceCreated(SurfaceHolder holder) {
                    surfaceReady = true;
                    startupSurface = holder.getSurface();
                    startStartupPlayerIfReady();
                }

                @Override
                public void surfaceChanged(SurfaceHolder holder, int format, int width, int height) {
                    surfaceReady = true;
                    startupSurface = holder.getSurface();
                    applyVideoScale(width, height);
                }

                @Override
                public void surfaceDestroyed(SurfaceHolder holder) {
                    surfaceReady = false;
                    startupSurface = null;
                    releasePlayerOnly();
                }
            });

            FrameLayout.LayoutParams videoParams = new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    Gravity.CENTER);
            startupRoot.addView(startupVideo, videoParams);

            ViewGroup decorGroup = (ViewGroup) decor;
            decorGroup.addView(startupRoot, new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT));
            startupRoot.bringToFront();
            startupRoot.requestFocus();
            startupVideo.bringToFront();
        } catch (Exception ignored) {
            finishStartupAnimation();
        }
    }

    private void startStartupPlayerIfReady() {
        if (startupFinished || !surfaceReady || startupSurface == null || startupPlayer != null) return;
        try {
            startupPlayer = new MediaPlayer();
            startupPlayer.setAudioStreamType(AudioManager.STREAM_MUSIC);
            startupPlayer.setScreenOnWhilePlaying(true);
            startupPlayer.setSurface(startupSurface);

            AssetFileDescriptor afd = getResources().openRawResourceFd(R.raw.startup_animation);
            if (afd == null) {
                finishStartupAnimation();
                return;
            }
            try {
                startupPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            } finally {
                afd.close();
            }

            startupPlayer.setOnPreparedListener(player -> {
                if (startupFinished) return;
                videoWidth = player.getVideoWidth();
                videoHeight = player.getVideoHeight();
                applyVideoScale(startupVideo.getWidth(), startupVideo.getHeight());
                player.setLooping(false);
                player.setVolume(1f, 1f);
                // The selected file is already the 2x startup animation; do not speed it up again.
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                    try {
                        android.media.PlaybackParams params = player.getPlaybackParams();
                        params.setSpeed(1.0f);
                        params.setPitch(1.0f);
                        player.setPlaybackParams(params);
                    } catch (Exception ignored) { }
                }
                player.start();
            });
            startupPlayer.setOnCompletionListener(player -> finishStartupAnimation());
            startupPlayer.setOnErrorListener((player, what, extra) -> {
                finishStartupAnimation();
                return true;
            });
            startupPlayer.prepareAsync();
        } catch (IOException | RuntimeException ignored) {
            finishStartupAnimation();
        }
    }

    private void applyVideoScale(int viewWidth, int viewHeight) {
        if (startupVideo == null || videoWidth <= 0 || videoHeight <= 0 || viewWidth <= 0 || viewHeight <= 0) return;
        startupVideo.setScaleX(1f);
        startupVideo.setScaleY(1f);
        startupVideo.setPivotX(viewWidth / 2f);
        startupVideo.setPivotY(viewHeight / 2f);
        startupVideo.requestLayout();
    }

    private void applyImmersiveFullscreen() {
        try {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_FULLSCREEN |
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        } catch (Exception ignored) { }
    }

    private void releasePlayerOnly() {
        try {
            if (startupPlayer != null) {
                startupPlayer.setOnPreparedListener(null);
                startupPlayer.setOnCompletionListener(null);
                startupPlayer.setOnErrorListener(null);
                if (startupPlayer.isPlaying()) startupPlayer.stop();
                startupPlayer.reset();
                startupPlayer.release();
            }
        } catch (Exception ignored) { }
        startupPlayer = null;
    }

    private void finishStartupAnimation() {
        if (startupFinished) return;
        startupFinished = true;
        releasePlayerOnly();
        try {
            if (startupRoot != null) {
                ViewGroup parent = (ViewGroup) startupRoot.getParent();
                if (parent != null) parent.removeView(startupRoot);
            }
        } catch (Exception ignored) { }
        startupVideo = null;
        startupRoot = null;
        startupSurface = null;
        surfaceReady = false;
        restoreWindowAfterStartup();
        requestBatteryOptimizationExemptionOnce();
    }

    private void restoreWindowAfterStartup() {
        try {
            Window window = getWindow();
            window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        } catch (Exception ignored) { }
    }

    @Override
    public void onDestroy() {
        releasePlayerOnly();
        startupSurface = null;
        startupVideo = null;
        startupRoot = null;
        super.onDestroy();
    }
}
