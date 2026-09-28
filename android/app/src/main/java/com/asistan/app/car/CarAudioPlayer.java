package com.asistan.app.car;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;

import java.io.File;
import java.util.Locale;

public class CarAudioPlayer {

    private static final String TAG = "CarAudioPlayer";

    public interface PlaybackListener {
        void onStarted();
        void onFinished();
        void onError(String message);
    }

    private final Context context;
    private final AudioManager audioManager;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private MediaPlayer mediaPlayer;
    private TextToSpeech tts;
    private boolean isTtsInitialized = false;
    private PlaybackListener activeListener;
    private AudioFocusRequest focusRequest;
    private boolean isCurrentlyPlaying = false;

    public CarAudioPlayer(Context context) {
        this.context = context.getApplicationContext();
        this.audioManager = (AudioManager) this.context.getSystemService(Context.AUDIO_SERVICE);
        initTts();
    }

    private void initTts() {
        tts = new TextToSpeech(context, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int res = tts.setLanguage(new Locale("tr", "TR"));
                if (res == TextToSpeech.LANG_MISSING_DATA || res == TextToSpeech.LANG_NOT_SUPPORTED) {
                    tts.setLanguage(Locale.getDefault());
                }
                tts.setPitch(0.85f); // Deep authoritative voice
                tts.setSpeechRate(0.92f); // Clear, dignified pacing
                isTtsInitialized = true;
                Log.d(TAG, "Native TTS initialized successfully");
            } else {
                Log.w(TAG, "Native TTS init failed with code " + status);
            }
        });

        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String utteranceId) {
                isCurrentlyPlaying = true;
                notifyStarted();
            }

            @Override
            public void onDone(String utteranceId) {
                isCurrentlyPlaying = false;
                abandonAudioFocus();
                notifyFinished();
            }

            @Override
            public void onError(String utteranceId) {
                isCurrentlyPlaying = false;
                abandonAudioFocus();
                notifyError("TTS playback error");
            }
        });
    }

    public synchronized void playText(String text, PlaybackListener listener) {
        stop();
        this.activeListener = listener;

        if (text == null || text.trim().isEmpty()) {
            notifyFinished();
            return;
        }

        requestAudioFocus();

        // 1. Try remote neural voice first for Mazlum Kiper / Optimus acoustics
        CarDataHelper.fetchTtsAudioFile(context, text, new CarDataHelper.AudioFileCallback() {
            @Override
            public void onSuccess(File audioFile) {
                mainHandler.post(() -> playAudioFile(audioFile));
            }

            @Override
            public void onError(String message) {
                Log.i(TAG, "Remote TTS unavailable, falling back to in-car local TTS: " + message);
                mainHandler.post(() -> playWithLocalTts(text));
            }
        });
    }

    private void playAudioFile(File file) {
        try {
            stop();
            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build());
            mediaPlayer.setDataSource(file.getAbsolutePath());
            mediaPlayer.setOnPreparedListener(mp -> {
                isCurrentlyPlaying = true;
                notifyStarted();
                mp.start();
            });
            mediaPlayer.setOnCompletionListener(mp -> {
                isCurrentlyPlaying = false;
                stop();
                notifyFinished();
            });
            mediaPlayer.setOnErrorListener((mp, what, extra) -> {
                Log.w(TAG, "MediaPlayer error: " + what + ", extra: " + extra);
                isCurrentlyPlaying = false;
                stop();
                notifyError("MediaPlayer error " + what);
                return true;
            });
            mediaPlayer.prepareAsync();
        } catch (Exception e) {
            Log.e(TAG, "Error playing audio file: " + e.getMessage());
            isCurrentlyPlaying = false;
            stop();
            notifyError(e.getMessage());
        }
    }

    private void playWithLocalTts(String text) {
        if (!isTtsInitialized || tts == null) {
            abandonAudioFocus();
            notifyError("TTS not ready");
            return;
        }

        try {
            String utteranceId = "car_briefing_" + System.currentTimeMillis();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId);
            } else {
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in local TTS: " + e.getMessage());
            abandonAudioFocus();
            notifyError(e.getMessage());
        }
    }

    public synchronized void stop() {
        isCurrentlyPlaying = false;
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
            } catch (Exception ignored) {}
            mediaPlayer = null;
        }

        if (tts != null) {
            try {
                tts.stop();
            } catch (Exception ignored) {}
        }

        abandonAudioFocus();
    }

    public boolean isPlaying() {
        if (mediaPlayer != null) {
            try {
                return mediaPlayer.isPlaying();
            } catch (Exception ignored) {}
        }
        return isCurrentlyPlaying;
    }

    private void requestAudioFocus() {
        if (audioManager == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build();
                focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                        .setAudioAttributes(playbackAttributes)
                        .setAcceptsDelayedFocusGain(true)
                        .setOnAudioFocusChangeListener(focusChange -> {
                            if (focusChange == AudioManager.AUDIOFOCUS_LOSS) {
                                stop();
                            }
                        })
                        .build();
                audioManager.requestAudioFocus(focusRequest);
            } else {
                audioManager.requestAudioFocus(focusChange -> {
                    if (focusChange == AudioManager.AUDIOFOCUS_LOSS) {
                        stop();
                    }
                }, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
            }
        } catch (Exception e) {
            Log.w(TAG, "Audio focus request warning: " + e.getMessage());
        }
    }

    private void abandonAudioFocus() {
        if (audioManager == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
                audioManager.abandonAudioFocusRequest(focusRequest);
            } else {
                audioManager.abandonAudioFocus(null);
            }
        } catch (Exception ignored) {}
    }

    private void notifyStarted() {
        mainHandler.post(() -> {
            if (activeListener != null) activeListener.onStarted();
        });
    }

    private void notifyFinished() {
        mainHandler.post(() -> {
            if (activeListener != null) activeListener.onFinished();
        });
    }

    private void notifyError(String err) {
        mainHandler.post(() -> {
            if (activeListener != null) activeListener.onError(err);
        });
    }

    public void release() {
        stop();
        if (tts != null) {
            try {
                tts.shutdown();
            } catch (Exception ignored) {}
            tts = null;
        }
    }
}
