package com.asistan.app.car;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.Bundle;
import android.support.v4.media.MediaBrowserCompat;
import android.support.v4.media.MediaDescriptionCompat;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.MediaBrowserServiceCompat;

import com.asistan.app.R;

import java.util.ArrayList;
import java.util.List;

public class AssistantMediaService extends MediaBrowserServiceCompat {

    private static final String ROOT_ID = "asistan_car_media_root";
    private static final String NOTIFICATION_CHANNEL_ID = "asistan_car_channel";
    private static final int NOTIFICATION_ID = 4001;

    public static final String MEDIA_ID_BRIEFING = "media_briefing";
    public static final String MEDIA_ID_FINANCE = "media_finance";
    public static final String MEDIA_ID_TASKS = "media_tasks";
    public static final String MEDIA_ID_VEHICLE = "media_vehicle";

    private MediaSessionCompat mediaSession;
    private CarAudioPlayer audioPlayer;
    private Bitmap appIconBitmap;

    @Override
    public void onCreate() {
        super.onCreate();

        audioPlayer = new CarAudioPlayer(this);
        appIconBitmap = BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher);

        mediaSession = new MediaSessionCompat(this, "Akıllı Asistan");
        mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);

        setPlaybackState(PlaybackStateCompat.STATE_NONE, 0);

        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                playMediaItem(MEDIA_ID_BRIEFING);
            }

            @Override
            public void onPlayFromMediaId(String mediaId, Bundle extras) {
                playMediaItem(mediaId);
            }

            @Override
            public void onPause() {
                audioPlayer.stop();
                setPlaybackState(PlaybackStateCompat.STATE_PAUSED, 0);
                stopForeground(false);
            }

            @Override
            public void onStop() {
                audioPlayer.stop();
                setPlaybackState(PlaybackStateCompat.STATE_STOPPED, 0);
                stopForeground(true);
            }

            @Override
            public void onSkipToNext() {
                playMediaItem(MEDIA_ID_FINANCE);
            }

            @Override
            public void onSkipToPrevious() {
                playMediaItem(MEDIA_ID_BRIEFING);
            }
        });

        setSessionToken(mediaSession.getSessionToken());
        createNotificationChannel();
    }

    private void playMediaItem(String mediaId) {
        String trackTitle;
        if (MEDIA_ID_FINANCE.equals(mediaId)) {
            trackTitle = "Finans & Kasa Durumu";
            updateMetadata(trackTitle, "Bekleyen ödemeler ve bakiye raporu");
            setPlaybackState(PlaybackStateCompat.STATE_BUFFERING, 0);
            startForegroundServiceNotification(trackTitle);

            CarDataHelper.getFinanceSummary(this, text -> audioPlayer.playText(text, createPlaybackListener(trackTitle)));
        } else if (MEDIA_ID_TASKS.equals(mediaId)) {
            trackTitle = "Günün Görevleri & Randevular";
            updateMetadata(trackTitle, "Bugünkü hatırlatıcılar ve randevular");
            setPlaybackState(PlaybackStateCompat.STATE_BUFFERING, 0);
            startForegroundServiceNotification(trackTitle);

            CarDataHelper.getTasksSummary(this, text -> audioPlayer.playText(text, createPlaybackListener(trackTitle)));
        } else if (MEDIA_ID_VEHICLE.equals(mediaId)) {
            trackTitle = "KIA EV6 Araç & Tasarruf Raporu";
            updateMetadata(trackTitle, "Elektrikli araç telemetrisi ve tasarruf");
            setPlaybackState(PlaybackStateCompat.STATE_BUFFERING, 0);
            startForegroundServiceNotification(trackTitle);

            CarDataHelper.getVehicleSummary(this, text -> audioPlayer.playText(text, createPlaybackListener(trackTitle)));
        } else {
            trackTitle = "Günün Sesli Brifingi";
            updateMetadata(trackTitle, "Optimus Prime - Günlük Durum Raporu");
            setPlaybackState(PlaybackStateCompat.STATE_BUFFERING, 0);
            startForegroundServiceNotification(trackTitle);

            CarDataHelper.getDailyBriefing(this, text -> audioPlayer.playText(text, createPlaybackListener(trackTitle)));
        }
    }

    private CarAudioPlayer.PlaybackListener createPlaybackListener(String title) {
        return new CarAudioPlayer.PlaybackListener() {
            @Override
            public void onStarted() {
                setPlaybackState(PlaybackStateCompat.STATE_PLAYING, 0);
                startForegroundServiceNotification(title);
            }

            @Override
            public void onFinished() {
                setPlaybackState(PlaybackStateCompat.STATE_PAUSED, 0);
                stopForeground(false);
            }

            @Override
            public void onError(String message) {
                setPlaybackState(PlaybackStateCompat.STATE_ERROR, 0);
                stopForeground(true);
            }
        };
    }

    private void updateMetadata(String title, String subtitle) {
        MediaMetadataCompat.Builder builder = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, "Akıllı Asistan")
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Optimus Prime Sesli Asistan")
                .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, subtitle);

        if (appIconBitmap != null) {
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, appIconBitmap);
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, appIconBitmap);
        }

        mediaSession.setMetadata(builder.build());
    }

    private void setPlaybackState(int state, long position) {
        PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
                .setActions(PlaybackStateCompat.ACTION_PLAY |
                        PlaybackStateCompat.ACTION_PAUSE |
                        PlaybackStateCompat.ACTION_STOP |
                        PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID |
                        PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                        PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS)
                .setState(state, position, 1.0f);
        mediaSession.setPlaybackState(stateBuilder.build());
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    NOTIFICATION_CHANNEL_ID,
                    "Akıllı Asistan Araç Seslendirmesi",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Android Auto araç sesli brifing ve bildirimleri");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private void startForegroundServiceNotification(String title) {
        Notification notification = new NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText("Araç hoparlörlerinden seslendiriliyor...")
                .setLargeIcon(appIconBitmap)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    @Nullable
    @Override
    public BrowserRoot onGetRoot(@NonNull String clientPackageName, int clientUid, @Nullable Bundle rootHints) {
        return new BrowserRoot(ROOT_ID, null);
    }

    @Override
    public void onLoadChildren(@NonNull String parentId, @NonNull Result<List<MediaBrowserCompat.MediaItem>> result) {
        List<MediaBrowserCompat.MediaItem> items = new ArrayList<>();

        items.add(createMediaItem(
                MEDIA_ID_BRIEFING,
                "🎙️ Günün Sesli Brifingi",
                "Optimus Prime: Hava durumu, ödemeler ve KIA EV6 durumu"
        ));

        items.add(createMediaItem(
                MEDIA_ID_FINANCE,
                "💰 Kasa & Finans Raporu",
                "Toplam bakiye ve bu ay vadesi gelen faturalar"
        ));

        items.add(createMediaItem(
                MEDIA_ID_TASKS,
                "📋 Günün Görevleri & Randevular",
                "Tamamlanması gereken aktif görevler"
        ));

        items.add(createMediaItem(
                MEDIA_ID_VEHICLE,
                "🚗 KIA EV6 Araç & Tasarruf",
                "Elektrikli araç şarjı ve toplam akaryakıt tasarrufu"
        ));

        result.sendResult(items);
    }

    private MediaBrowserCompat.MediaItem createMediaItem(String id, String title, String subtitle) {
        MediaDescriptionCompat description = new MediaDescriptionCompat.Builder()
                .setMediaId(id)
                .setTitle(title)
                .setSubtitle(subtitle)
                .setIconBitmap(appIconBitmap)
                .build();

        return new MediaBrowserCompat.MediaItem(
                description,
                MediaBrowserCompat.MediaItem.FLAG_PLAYABLE
        );
    }

    @Override
    public void onDestroy() {
        if (audioPlayer != null) {
            audioPlayer.release();
        }
        if (mediaSession != null) {
            mediaSession.release();
        }
        super.onDestroy();
    }
}
