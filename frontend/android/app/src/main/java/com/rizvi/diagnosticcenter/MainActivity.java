package com.rizvi.diagnosticcenter;

import android.graphics.Color;
import android.graphics.Matrix;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.Surface;
import android.view.TextureView;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private TextureView startupVideo;
    private MediaPlayer startupPlayer;
    private FrameLayout startupRoot;
    private boolean startupShown;
    private boolean startupFinished;
    private int videoWidth;
    private int videoHeight;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PrintPlugin.class);
        registerPlugin(UpdatePlugin.class);
        registerPlugin(ExportPlugin.class);
        super.onCreate(savedInstanceState);
        showStartupAnimation();
    }

    private void showStartupAnimation() {
        if (startupShown) return;
        startupShown = true;
        try {
            Window window = getWindow();
            window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN);
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            applyImmersiveFullscreen();

            startupRoot = findViewById(android.R.id.content);
            if (startupRoot == null) {
                finishStartupAnimation();
                return;
            }

            startupVideo = new TextureView(this);
            startupVideo.setOpaque(true);
            startupVideo.setBackgroundColor(Color.BLACK);
            startupVideo.setFocusable(false);
            startupVideo.setFocusableInTouchMode(false);
            startupVideo.setSurfaceTextureListener(new TextureView.SurfaceTextureListener() {
                @Override
                public void onSurfaceTextureAvailable(android.graphics.SurfaceTexture surface, int width, int height) {
                    startStartupPlayer(surface);
                }
                @Override
                public void onSurfaceTextureSizeChanged(android.graphics.SurfaceTexture surface, int width, int height) {
                    applyVideoTransform(width, height);
                }
                @Override
                public boolean onSurfaceTextureDestroyed(android.graphics.SurfaceTexture surface) {
                    if (startupPlayer != null) startupPlayer.setSurface(null);
                    return true;
                }
                @Override
                public void onSurfaceTextureUpdated(android.graphics.SurfaceTexture surface) { }
            });

            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    Gravity.CENTER
            );
            startupRoot.addView(startupVideo, params);
            startupVideo.bringToFront();
            if (startupVideo.isAvailable()) startStartupPlayer(startupVideo.getSurfaceTexture());
        } catch (Exception ignored) {
            finishStartupAnimation();
        }
    }

    private void startStartupPlayer(android.graphics.SurfaceTexture surfaceTexture) {
        if (startupFinished || startupPlayer != null || surfaceTexture == null) return;
        try {
            Uri videoUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.startup_animation);
            startupPlayer = new MediaPlayer();
            startupPlayer.setDataSource(this, videoUri);
            startupPlayer.setSurface(new Surface(surfaceTexture));
            startupPlayer.setScreenOnWhilePlaying(true);
            startupPlayer.setOnPreparedListener(player -> {
                videoWidth = player.getVideoWidth();
                videoHeight = player.getVideoHeight();
                if (startupVideo != null) applyVideoTransform(startupVideo.getWidth(), startupVideo.getHeight());
                player.setLooping(false);
                player.setVolume(1f, 1f);
                player.start();
            });
            startupPlayer.setOnCompletionListener(player -> finishStartupAnimation());
            startupPlayer.setOnErrorListener((player, what, extra) -> {
                finishStartupAnimation();
                return true;
            });
            startupPlayer.prepareAsync();
        } catch (Exception ignored) {
            finishStartupAnimation();
        }
    }

    /** Center-crop the startup video so it fills the complete mobile display. */
    private void applyVideoTransform(int viewWidth, int viewHeight) {
        if (startupVideo == null || videoWidth <= 0 || videoHeight <= 0 || viewWidth <= 0 || viewHeight <= 0) return;
        float scale = Math.max((float) viewWidth / videoWidth, (float) viewHeight / videoHeight);
        float scaledWidth = videoWidth * scale;
        float scaledHeight = videoHeight * scale;
        float dx = (viewWidth - scaledWidth) / 2f;
        float dy = (viewHeight - scaledHeight) / 2f;
        Matrix matrix = new Matrix();
        matrix.setScale(scale, scale);
        matrix.postTranslate(dx, dy);
        startupVideo.setTransform(matrix);
        startupVideo.invalidate();
    }

    private void applyImmersiveFullscreen() {
        try {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            );
        } catch (Exception ignored) { }
    }

    private void finishStartupAnimation() {
        if (startupFinished) return;
        startupFinished = true;
        try {
            if (startupPlayer != null) {
                startupPlayer.setOnCompletionListener(null);
                startupPlayer.setOnErrorListener(null);
                if (startupPlayer.isPlaying()) startupPlayer.stop();
                startupPlayer.reset();
                startupPlayer.release();
            }
        } catch (Exception ignored) { }
        startupPlayer = null;
        try {
            if (startupRoot != null && startupVideo != null) startupRoot.removeView(startupVideo);
        } catch (Exception ignored) { }
        startupVideo = null;
        startupRoot = null;
        restoreWindowAfterStartup();
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
        try {
            if (startupPlayer != null) startupPlayer.release();
        } catch (Exception ignored) { }
        startupPlayer = null;
        startupVideo = null;
        startupRoot = null;
        super.onDestroy();
    }
}
