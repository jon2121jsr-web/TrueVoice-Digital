import Capacitor

@objc(RadioBridgeViewController)
class RadioBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(TrueVoiceRadioPlugin())
    }
}
