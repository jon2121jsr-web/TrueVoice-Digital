package digital.truevoice.app;

import android.content.ComponentName;
import androidx.core.content.ContextCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/** Adapter from the existing TrueVoice JavaScript transport to Media3. */
@CapacitorPlugin(name = "TrueVoiceRadio")
public final class TrueVoiceRadioPlugin extends Plugin {
    private ListenableFuture<MediaController> pending;
    private MediaController controller;
    private final List<Consumer<MediaController>> queued = new ArrayList<>();
    private long revision = 0;
    private int intentVersion = 0;
    private String owner = "radio";
    private boolean videoActive = false;
    private String lastError = null;
    private String title = "TrueVoice Digital";
    private String artist = "Live Radio";
    private String artwork = null;

    private final Player.Listener listener = new Player.Listener() {
        @Override public void onEvents(Player player, Player.Events events) {
            publish();
        }
        @Override public void onPlayerError(PlaybackException error) {
            lastError = "Stream unavailable. Tap Play to retry.";
            publish();
        }
    };

    private void withController(PluginCall call, Consumer<MediaController> job) {
        if (controller != null) {
            job.accept(controller);
            return;
        }
        queued.add(job);
        if (pending != null) return;
        try {
            SessionToken token = new SessionToken(getContext(),
                new ComponentName(getContext(), TrueVoicePlaybackService.class));
            pending = new MediaController.Builder(getContext(), token).buildAsync();
            pending.addListener(() -> {
                try {
                    controller = pending.get();
                    controller.addListener(listener);
                    List<Consumer<MediaController>> ready = new ArrayList<>(queued);
                    queued.clear();
                    for (Consumer<MediaController> next : ready) next.accept(controller);
                    publish();
                } catch (Exception e) {
                    queued.clear();
                    lastError = "Android radio could not start. Tap Play to retry.";
                    call.reject(lastError, e);
                } finally {
                    pending = null;
                }
            }, ContextCompat.getMainExecutor(getContext()));
        } catch (Exception e) {
            queued.clear();
            pending = null;
            call.reject("Unable to connect to Android radio", e);
        }
    }

    private JSObject state() {
        JSObject state = new JSObject();
        boolean wants = controller != null && controller.getPlayWhenReady();
        boolean playing = controller != null && controller.isPlaying();
        state.put("revision", ++revision);
        state.put("intentVersion", intentVersion);
        state.put("owner", owner);
        state.put("wantsPlayback", wants);
        state.put("playing", playing);
        state.put("buffering", wants && !playing);
        state.put("interrupted", false);
        state.put("videoActive", videoActive);
        state.put("source", TrueVoicePlaybackService.STREAM_URL);
        JSObject metadata = new JSObject();
        metadata.put("title", title);
        metadata.put("artist", artist);
        if (artwork != null) metadata.put("art", artwork);
        state.put("metadata", metadata);
        if (lastError != null) state.put("error", lastError);
        return state;
    }

    private void publish() {
        notifyListeners("stateChanged", state());
    }

    @PluginMethod public void getState(PluginCall call) {
        withController(call, c -> call.resolve(state()));
    }

    @PluginMethod public void play(PluginCall call) {
        // The JS adapter requires an actual user gesture for explicit Play.
        withController(call, c -> {
            if (videoActive) {
                call.reject("Close the video before listening live");
                return;
            }
            Integer expected = call.getInt("intentVersion");
            if (expected != null && expected != intentVersion) {
                call.reject("Stale play intent; user or remote control changed playback");
                return;
            }
            owner = call.getString("owner", "radio");
            // Never resume a stale MP3 byte stream after an intentional Pause.
            if (!c.getPlayWhenReady()) {
                c.setMediaItem(TrueVoicePlaybackService.radioItem(title, artist, artwork));
                c.prepare();
            }
            intentVersion++;
            lastError = null;
            c.play();
            call.resolve(state());
            publish();
        });
    }

    @PluginMethod public void pause(PluginCall call) {
        withController(call, c -> {
            String requester = call.getString("owner");
            if (requester != null && !requester.equals(owner)) {
                call.resolve(state());
                return;
            }
            c.pause();
            c.stop(); // Release stream resource while preserving a session for system Play.
            intentVersion++;
            call.resolve(state());
            publish();
        });
    }

    @PluginMethod public void setVideoActive(PluginCall call) {
        videoActive = call.getBoolean("active", false);
        withController(call, c -> {
            if (videoActive) {
                c.pause();
                c.stop();
                intentVersion++;
            }
            // Closing video deliberately does not auto-resume the radio.
            call.resolve(state());
            publish();
        });
    }

    @PluginMethod public void setMetadata(PluginCall call) {
        String nextTitle = call.getString("title", "TrueVoice Digital");
        String nextArtist = call.getString("artist", "Live Radio");
        String nextArt = call.getString("art", "");
        if (nextArt.isEmpty() || !nextArt.startsWith("https://")) nextArt = null;
        final String resolvedArt = nextArt;
        withController(call, c -> {
            if (!nextTitle.equals(title) || !nextArtist.equals(artist)
                || (resolvedArt == null ? artwork != null : !resolvedArt.equals(artwork))) {
                title = nextTitle;
                artist = nextArtist;
                artwork = resolvedArt;
                if (c.getMediaItemCount() > 0) {
                    // Same Live365 URL: Media3 can retain the decoder and connection.
                    MediaItem item = TrueVoicePlaybackService.radioItem(title, artist, artwork);
                    c.replaceMediaItem(c.getCurrentMediaItemIndex(), item);
                }
                publish();
            }
            call.resolve(state());
        });
    }

    @Override protected void handleOnDestroy() {
        if (controller != null) {
            controller.removeListener(listener);
            controller.release();
            controller = null;
        }
        if (pending != null) {
            MediaController.releaseFuture(pending);
            pending = null;
        }
        queued.clear();
        super.handleOnDestroy();
    }
}
