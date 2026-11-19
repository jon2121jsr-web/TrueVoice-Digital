package digital.truevoice.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(TrueVoiceRadioPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
