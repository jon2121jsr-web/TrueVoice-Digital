package digital.truevoice.app;

import android.content.ComponentName;
import android.content.Context;
import androidx.annotation.NonNull;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

/**
 * Single Android audio owner. Media3 maintains the foreground media notification,
 * Bluetooth/lock-screen actions and background playback without WebView timers.
 * No second decoder plays the Live365 URL.
 */
public final class TrueVoicePlaybackService extends MediaSessionService {
    public static final String STREAM_URL = "https://streaming.live365.com/a61535";
    private ExoPlayer player;
    private MediaSession session;

    public static MediaItem radioItem(String title, String artist, String artwork) {
        MediaMetadata.Builder metadata = new MediaMetadata.Builder()
            .setTitle(title == null || title.isEmpty() ? "TrueVoice Digital" : title)
            .setArtist(artist == null || artist.isEmpty() ? "Live Radio" : artist)
            .setAlbumTitle("TrueVoice Digital")
            .setIsPlayable(true);
        if (artwork != null && artwork.startsWith("https://") && artwork.length() <= 2048) {
            metadata.setArtworkUri(android.net.Uri.parse(artwork));
        }
        return new MediaItem.Builder()
            .setMediaId("truevoice-live365")
            .setUri(STREAM_URL)
            .setMediaMetadata(metadata.build())
            .build();
    }

    @Override public void onCreate() {
        super.onCreate();
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .setUsage(C.USAGE_MEDIA)
            .build();
        player = new ExoPlayer.Builder(this)
            .setAudioAttributes(attributes, true)
            .setHandleAudioBecomingNoisy(true)
            .build();
        player.setMediaItem(radioItem("TrueVoice Digital", "Live Radio", null));
        session = new MediaSession.Builder(this, player)
            .setId("truevoice-live")
            .build();
    }

    @Override public MediaSession onGetSession(@NonNull MediaSession.ControllerInfo controllerInfo) {
        return session;
    }

    @Override public void onDestroy() {
        if (session != null) {
            session.release();
            session = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }
}
