import XCTest
@testable import NativeAudioPolicy

final class RadioPlaybackPolicyTests: XCTestCase {
    func testColdStartDoesNotAutoplay() {
        XCTAssertFalse(RadioPlaybackPolicy().mayPlay)
    }
    func testPauseDuringInterruptionCannotResume() {
        var p = RadioPlaybackPolicy()
        XCTAssertTrue(p.play(owner: "radio"))
        p.interruptionBegan()
        p.pause()
        XCTAssertFalse(p.interruptionEnded(shouldResume: true))
    }
    func testInterruptionRequiresSystemPermissionAndExistingIntent() {
        var p = RadioPlaybackPolicy()
        p.play(owner: "radio"); p.interruptionBegan()
        XCTAssertTrue(p.interruptionEnded(shouldResume: true))
        p.interruptionBegan()
        XCTAssertFalse(p.interruptionEnded(shouldResume: false))
    }
    func testVideoHandoffAndCloseNeverResumeRadio() {
        var p = RadioPlaybackPolicy()
        p.play(owner: "verse"); p.video(true)
        XCTAssertFalse(p.play(owner: "radio"))
        p.video(false)
        XCTAssertFalse(p.mayPlay)
    }
    func testStaleOwnerPauseDoesNotCancelNewOwner() {
        var p = RadioPlaybackPolicy()
        p.play(owner: "radio"); p.play(owner: "verse"); p.pause(owner: "radio")
        XCTAssertTrue(p.mayPlay)
        p.pause(owner: "verse")
        XCTAssertFalse(p.mayPlay)
    }
    func testOutageBudgetAndExplicitPause() {
        var p = RadioPlaybackPolicy()
        p.play(owner: "radio")
        XCTAssertEqual(p.nextRetryDelay(), 2)
        XCTAssertEqual(p.nextRetryDelay(), 5)
        XCTAssertEqual(p.nextRetryDelay(), 10)
        XCTAssertNil(p.nextRetryDelay())
        XCTAssertFalse(p.mayPlay)
        p.play(owner: "radio"); p.pause()
        XCTAssertNil(p.nextRetryDelay())
    }
    func testDelayedBridgePlayCannotOverrideNewerRemotePause() {
        var p = RadioPlaybackPolicy()
        let oldVersion = p.intentVersion
        p.play(owner: "radio"); p.pause()
        XCTAssertFalse(p.play(owner: "radio", expectedIntentVersion: oldVersion))
        XCTAssertFalse(p.mayPlay)
        XCTAssertTrue(p.play(owner: "radio", expectedIntentVersion: p.intentVersion))
    }
}
