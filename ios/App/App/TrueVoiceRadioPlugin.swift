import AVFoundation
import Foundation
import Capacitor
import MediaPlayer
import UIKit

@objc(TrueVoiceRadioPlugin)
public class TrueVoiceRadioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TrueVoiceRadioPlugin"
    public let jsName = "TrueVoiceRadio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVideoActive", returnType: CAPPluginReturnPromise)
    ]
    private lazy var radio = NativeRadioEngine { [weak self] state in
        self?.notifyListeners("stateChanged", data: state)
    }
    @objc public func getState(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(self.radio.snapshot()) }
    }
    @objc public func play(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.radio.play(owner: call.getString("owner") ?? "radio", reconnect: call.getBool("reconnect") ?? false,
                                  expectedIntentVersion: call.getInt("intentVersion") ?? -1) else {
                call.reject("Radio is unavailable while interrupted or video owns playback")
                return
            }
            call.resolve(self.radio.snapshot())
        }
    }
    @objc public func pause(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.radio.pause(owner: call.getString("owner"))
            call.resolve(self.radio.snapshot())
        }
    }
    @objc public func setVideoActive(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.radio.setVideoActive(call.getBool("active") ?? false)
            call.resolve(self.radio.snapshot())
        }
    }
}

// All AVPlayer, policy and metadata state is confined to the main queue. There
// is one radio engine per registered plugin, no WebView audio or fallback URL.
private final class NativeRadioEngine {
    private static let stream = URL(string: "https://streaming.live365.com/a61535")!
    private static let metadataURL = URL(string: "https://www.truevoice.digital/api/nowplaying")!
    private var policy = RadioPlaybackPolicy()
    private var player = AVPlayer()
    private var revision = 0
    private var epoch = 0
    private var error: String?
    private var metadataError: String?
    private var track: JSObject = [:]
    private var pendingTrack: (song: JSObject, due: TimeInterval)?
    private var trackStarted: TimeInterval = 0
    private var listenerCount: Int?
    private var recovery: DispatchWorkItem?
    private var lastProgress = Date()
    private var lastTime = 0.0
    private var healthySince: Date?
    private var playerObservation: NSKeyValueObservation?
    private var itemObservation: NSKeyValueObservation?
    private var timeObserver: Any?
    private var notifications: [NSObjectProtocol] = []
    private var commands: [(MPRemoteCommand, Any)] = []
    private var metadataTimer: Timer?
    private var metadataTask: URLSessionDataTask?
    private var metadataEpoch = 0
    private let session: URLSession
    private let changed: (JSObject) -> Void
    private var stationArt: MPMediaItemArtwork?

    init(changed: @escaping (JSObject) -> Void) {
        self.changed = changed
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 10
        config.httpCookieStorage = nil
        session = URLSession(configuration: config)
        if let path = Bundle.main.path(forResource: "icon-512-waveform-v1", ofType: "png", inDirectory: "public"),
           let image = UIImage(contentsOfFile: path) {
            stationArt = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
        }
        observePlayer()
        let center = NotificationCenter.default
        notifications.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            self?.interruption(note)
        })
        notifications.append(center.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] note in
            guard let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
                  AVAudioSession.RouteChangeReason(rawValue: raw) == .oldDeviceUnavailable else { return }
            self?.pause() // Do not unexpectedly switch from headphones to speaker.
        })
        notifications.append(center.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: .main) { [weak self] _ in
            self?.resetMediaServices()
        })
        notifications.append(center.addObserver(forName: AVPlayerItem.failedToPlayToEndTimeNotification, object: nil, queue: .main) { [weak self] note in
            guard let self = self, let item = note.object as? AVPlayerItem, item === self.player.currentItem else { return }
            self.scheduleRecovery()
        })
        notifications.append(center.addObserver(forName: AVPlayerItem.didPlayToEndTimeNotification, object: nil, queue: .main) { [weak self] note in
            guard let self = self, let item = note.object as? AVPlayerItem, item === self.player.currentItem else { return }
            self.scheduleRecovery()
        })
        installRemoteCommands()
        publish() // Disabled remote commands until the first explicit Play.
    }

    func snapshot() -> JSObject {
        var value: JSObject = [
            "revision": revision, "intentVersion": policy.intentVersion, "owner": policy.owner, "wantsPlayback": policy.wantsPlayback,
            "playing": policy.mayPlay && player.timeControlStatus == .playing,
            "buffering": policy.mayPlay && (recovery != nil || player.timeControlStatus != .playing),
            "interrupted": policy.interrupted, "videoActive": policy.videoActive,
            "metadata": track, "source": Self.stream.absoluteString
        ]
        if let error = error { value["error"] = error }
        if let metadataError = metadataError { value["metadataError"] = metadataError }
        if let listenerCount = listenerCount { value["listeners"] = listenerCount }
        return value
    }

    @discardableResult func play(owner: String, reconnect: Bool = false, expectedIntentVersion: Int? = nil) -> Bool {
        guard expectedIntentVersion == nil || expectedIntentVersion == policy.intentVersion else { return false }
        if policy.mayPlay && policy.owner == owner && !reconnect { publish(); return true }
        guard policy.play(owner: owner, expectedIntentVersion: expectedIntentVersion) else { return false }
        cancelRecovery()
        error = nil
        startItem()
        startMetadata()
        publish()
        return true
    }

    func pause(owner: String? = nil) {
        guard owner == nil || owner == policy.owner else { return }
        policy.pause(owner: owner)
        stopTransport()
        publish()
    }

    func setVideoActive(_ active: Bool) {
        policy.video(active)
        if active { stopTransport() }
        // Closing a video does not restore radio intent.
        publish()
    }

    private func activateSession() throws {
        let audio = AVAudioSession.sharedInstance()
        try audio.setCategory(.playback, mode: .default)
        try audio.setActive(true)
    }

    private func startItem() {
        guard policy.mayPlay else { return }
        do { try activateSession() }
        catch { fail("Audio session unavailable. Tap Play to retry."); return }
        player.pause()
        itemObservation = nil
        let item = AVPlayerItem(url: Self.stream)
        // Use the provider's unmodified URL/redirects/ads; no seeks or ad skips.
        player.replaceCurrentItem(with: item)
        lastTime = 0
        lastProgress = Date()
        healthySince = nil
        itemObservation = item.observe(\.status, options: [.new]) { [weak self, weak item] _, _ in
            DispatchQueue.main.async {
                guard let self = self, let item = item, item === self.player.currentItem else { return }
                if item.status == .failed { self.scheduleRecovery() }
            }
        }
        player.play()
    }

    private func observePlayer() {
        player.automaticallyWaitsToMinimizeStalling = true
        playerObservation = player.observe(\.timeControlStatus, options: [.new]) { [weak self] _, _ in
            DispatchQueue.main.async { self?.publish() }
        }
        timeObserver = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 1, preferredTimescale: 600), queue: .main) { [weak self] _ in
            self?.tick()
        }
        // Wall-clock watchdog also fires when a stalled AVPlayer media clock
        // stops advancing. No JavaScript timer is needed for native recovery.
        let watchdog = Timer(timeInterval: 2, repeats: true) { [weak self] _ in self?.tick() }
        RunLoop.main.add(watchdog, forMode: .common)
        watchdogTimer = watchdog
    }
    private var watchdogTimer: Timer?

    private func tick() {
        if let pending = pendingTrack, pending.due <= Date().timeIntervalSince1970 {
            track = pending.song; pendingTrack = nil; publish()
        }
        guard policy.mayPlay, recovery == nil else { return }
        let current = player.currentTime().seconds
        if current.isFinite && current > lastTime + 0.05 && player.timeControlStatus == .playing {
            lastTime = current; lastProgress = Date()
            if healthySince == nil { healthySince = Date() }
            if let since = healthySince, Date().timeIntervalSince(since) >= 30 { policy.recovered() }
        } else {
            if player.timeControlStatus != .playing || Date().timeIntervalSince(lastProgress) >= 2 { healthySince = nil }
            if Date().timeIntervalSince(lastProgress) >= 20 { scheduleRecovery() }
        }
    }

    private func scheduleRecovery() {
        guard policy.mayPlay, recovery == nil else { return }
        guard let delay = policy.nextRetryDelay() else {
            fail("Stream unavailable. Tap Play to retry."); return
        }
        player.pause()
        epoch += 1
        let token = epoch
        let job = DispatchWorkItem { [weak self] in
            guard let self = self, token == self.epoch, self.policy.mayPlay else { return }
            self.recovery = nil
            self.startItem()
            self.publish()
        }
        recovery = job
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: job)
        publish()
    }
    private func cancelRecovery() {
        epoch += 1
        recovery?.cancel(); recovery = nil
    }
    private func stopTransport() {
        cancelRecovery()
        player.pause()
        itemObservation = nil
        player.replaceCurrentItem(with: nil) // Explicit Pause/video handoff closes the listener resource.
        metadataTimer?.invalidate(); metadataTimer = nil
        metadataEpoch += 1
        metadataTask?.cancel(); metadataTask = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
    private func fail(_ message: String) {
        policy.pause(); error = message; stopTransport(); publish()
    }
    private func interruption(_ note: Notification) {
        guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        if type == .began {
            policy.interruptionBegan(); cancelRecovery(); player.pause(); publish()
        } else {
            let rawOptions = note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            if policy.interruptionEnded(shouldResume: AVAudioSession.InterruptionOptions(rawValue: rawOptions).contains(.shouldResume)) {
                do { try activateSession(); lastProgress = Date(); player.play() }
                catch { fail("Audio session unavailable. Tap Play to retry.") }
            } else { stopTransport() }
            publish()
        }
    }
    private func resetMediaServices() {
        cancelRecovery()
        player.pause()
        playerObservation = nil; itemObservation = nil
        if let timeObserver = timeObserver { player.removeTimeObserver(timeObserver) }
        timeObserver = nil
        watchdogTimer?.invalidate()
        player = AVPlayer()
        observePlayer()
        if policy.mayPlay { startItem() }
        publish()
    }

    private func startMetadata() {
        guard metadataTimer == nil else { return }
        pollMetadata()
        let timer = Timer(timeInterval: 5, repeats: true) { [weak self] _ in self?.pollMetadata() }
        RunLoop.main.add(timer, forMode: .common)
        metadataTimer = timer
    }
    private func pollMetadata() {
        guard policy.wantsPlayback, metadataTask == nil else { return }
        var request = URLRequest(url: Self.metadataURL)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let token = metadataEpoch
        let task = session.dataTask(with: request) { [weak self] data, response, _ in
            DispatchQueue.main.async {
                guard let self = self, token == self.metadataEpoch else { return }
                self.metadataTask = nil
                guard self.policy.wantsPlayback else { return }
                guard (response as? HTTPURLResponse)?.statusCode == 200,
                      let data = data, data.count <= 1_048_576,
                      let root = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
                      let np = root["now_playing"] as? [String: Any],
                      let song = np["song"] as? [String: Any], let title = song["title"] as? String else {
                    self.metadataError = "Now Playing metadata unavailable."; self.publish(); return
                }
                self.metadataError = nil
                let started = (np["played_at"] as? NSNumber)?.doubleValue ?? 0
                if started >= self.trackStarted {
                    var next: JSObject = ["title": String(title.prefix(256)), "artist": String((song["artist"] as? String ?? "TrueVoice Digital").prefix(256)), "album": "TrueVoice Digital"]
                    if let art = song["art"] as? String, art.count <= 2048, URL(string: art)?.scheme == "https" { next["art"] = art }
                    self.trackStarted = started
                    let due = started + 55 // Preserve the accepted Live365 metadata offset.
                    if due <= Date().timeIntervalSince1970 { self.track = next; self.pendingTrack = nil }
                    else { self.pendingTrack = (next, due) }
                }
                self.listenerCount = ((root["listeners"] as? [String: Any])?["current"] as? NSNumber)?.intValue
                self.publish()
            }
        }
        metadataTask = task
        task.resume()
    }

    private func installRemoteCommands() {
        let center = MPRemoteCommandCenter.shared()
        commands.append((center.playCommand, center.playCommand.addTarget { [weak self] _ in
            DispatchQueue.main.async {
                guard let self = self, self.policy.activated else { return }
                self.play(owner: self.policy.owner)
            }
            return .success
        }))
        commands.append((center.pauseCommand, center.pauseCommand.addTarget { [weak self] _ in
            DispatchQueue.main.async { self?.pause() }; return .success
        }))
        commands.append((center.togglePlayPauseCommand, center.togglePlayPauseCommand.addTarget { [weak self] _ in
            DispatchQueue.main.async {
                guard let self = self, self.policy.activated else { return }
                if self.policy.wantsPlayback { self.pause() } else { self.play(owner: self.policy.owner) }
            }
            return .success
        }))
        for command in [center.nextTrackCommand, center.previousTrackCommand, center.skipForwardCommand, center.skipBackwardCommand, center.seekForwardCommand, center.seekBackwardCommand, center.changePlaybackPositionCommand] {
            command.isEnabled = false
        }
    }
    private func publish() {
        revision += 1
        let center = MPRemoteCommandCenter.shared()
        let enabled = policy.activated && !policy.videoActive
        center.playCommand.isEnabled = enabled
        center.pauseCommand.isEnabled = enabled
        center.togglePlayPauseCommand.isEnabled = enabled
        if policy.activated && !policy.videoActive {
            var info: [String: Any] = [
                MPMediaItemPropertyTitle: track["title"] as? String ?? "TrueVoice Digital",
                MPMediaItemPropertyArtist: track["artist"] as? String ?? "Live Radio",
                MPMediaItemPropertyAlbumTitle: "TrueVoice Digital",
                MPNowPlayingInfoPropertyIsLiveStream: true,
                MPNowPlayingInfoPropertyPlaybackRate: policy.mayPlay && player.timeControlStatus == .playing ? 1.0 : 0.0
            ]
            // No duration, seek position or fabricated elapsed timeline for live radio.
            if let stationArt = stationArt { info[MPMediaItemPropertyArtwork] = stationArt }
            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        } else if policy.videoActive {
            MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
        }
        changed(snapshot())
    }
    deinit {
        recovery?.cancel(); player.pause()
        metadataTimer?.invalidate(); watchdogTimer?.invalidate()
        metadataTask?.cancel(); session.invalidateAndCancel()
        if let timeObserver = timeObserver { player.removeTimeObserver(timeObserver) }
        notifications.forEach { NotificationCenter.default.removeObserver($0) }
        commands.forEach { $0.0.removeTarget($0.1) }
    }
}
