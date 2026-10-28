// Pure intent/recovery policy, also compiled directly into the app target.
public struct RadioPlaybackPolicy {
    public private(set) var owner = "radio"
    public private(set) var wantsPlayback = false
    public private(set) var interrupted = false
    public private(set) var videoActive = false
    public private(set) var activated = false
    public private(set) var retries = 0
    public private(set) var intentVersion = 0
    public var mayPlay: Bool { wantsPlayback && !interrupted && !videoActive }
    public init() {}

    @discardableResult public mutating func play(owner: String, expectedIntentVersion: Int? = nil) -> Bool {
        guard expectedIntentVersion == nil || expectedIntentVersion == intentVersion else { return false }
        guard !videoActive, !interrupted, owner == "radio" || owner == "verse" else { return false }
        self.owner = owner
        wantsPlayback = true
        activated = true
        retries = 0
        return true
    }
    public mutating func pause(owner: String? = nil) {
        // A stale React route cleanup must not pause a newer owner.
        guard owner == nil || owner == self.owner else { return }
        intentVersion += 1
        wantsPlayback = false
        retries = 0
    }
    public mutating func video(_ active: Bool) {
        videoActive = active
        if active { pause() }
    }
    public mutating func interruptionBegan() { interrupted = true }
    @discardableResult public mutating func interruptionEnded(shouldResume: Bool) -> Bool {
        interrupted = false
        if !shouldResume { pause() }
        return mayPlay
    }
    // Bounded across an outage. Reset only after sustained audible progress or
    // a new explicit Play, never merely because a replacement item is ready.
    public mutating func recovered() { retries = 0 }
    public mutating func nextRetryDelay() -> Double? {
        guard mayPlay else { return nil }
        guard retries < 3 else { pause(); return nil }
        let delay = [2.0, 5.0, 10.0][retries]
        retries += 1
        return delay
    }
}
