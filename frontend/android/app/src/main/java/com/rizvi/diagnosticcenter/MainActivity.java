package com.rizvi.diagnosticcenter;

import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.VideoView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private VideoView startupVideo;
    private boolean startupShown;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrintPlugin.class);
        registerPlugin(UpdatePlugin.class);
        registerPlugin(ExportPlugin.class);
        super.onCreate(savedInstanceState);
        showStartupAnimation();
    }

    /**
     * The MP4 is downloaded by the Android GitHub Actions build from the
     * approved Cloudinary URL and packaged as res/raw/startup_animation.mp4.
     * Nothing is fetched at runtime, so startup does not depend on internet.
     */
    private void showStartupAnimation() {
        if (startupShown) return;
        startupShown = true;

        try {
            final Window window = getWindow();
            window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                    WindowManager.LayoutParams.FLAG_FULLSCREEN);
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

            final FrameLayout root = findViewById(android.R.id.content);
            if (root == null) {
                restoreWindowAfterStartup();
                return;
            }

            startupVideo = new VideoView(this);
            startupVideo.setBackgroundColor(Color.BLACK);
            startupVideo.setZOrderOnTop(true);
            startupVideo.setZOrderMediaOverlay(true);
            startupVideo.setKeepScreenOn(true);
            startupVideo.setFocusable(false);
            startupVideo.setFocusableInTouchMode(false);
            startupVideo.setLayoutParams(new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    Gravity.CENTER
            ));

            root.addView(startupVideo);
            startupVideo.bringToFront();

            Uri videoUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.startup_animation);
            startupVideo.setVideoURI(videoUri);
            startupVideo.setOnPreparedListener(player -> {
                player.setLooping(false);
                player.setVolume(1f, 1f);
                startupVideo.start();
            });
            startupVideo.setOnCompletionListener(player -> finishStartupAnimation(root));
            startupVideo.setOnErrorListener((player, what, extra) -> {
                // Never block the application if a future APK accidentally
                // misses the animation resource or the media codec rejects it.
                finishStartupAnimation(root);
                return true;
            });
            startupVideo.requestFocus();
        } catch (Exception ignored) {
            restoreWindowAfterStartup();
        }
    }

    private void finishStartupAnimation(FrameLayout root) {
        if (startupVideo != null) {
            try {
                startupVideo.stopPlayback();
                root.removeView(startupVideo);
            } catch (Exception ignored) {
            }
            startupVideo = null;
        }
        restoreWindowAfterStartup();
    }

    private void restoreWindowAfterStartup() {
        try {
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void onDestroy() {
        if (startupVideo != null) {
            try {
                startupVideo.stopPlayback();
            } catch (Exception ignored) {
            }
            startupVideo = null;
        }
        super.onDestroy();
    }
}
