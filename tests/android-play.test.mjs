import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIVE365_STREAM_URL, preferredStreamUrl } from '../src/lib/streamUrl.js';

const read = p => readFileSync(p, 'utf8');

test('Android Play candidate retains the verified Live365 listening source', () => {
  assert.equal(LIVE365_STREAM_URL, 'https://streaming.live365.com/a61535');
  assert.equal(preferredStreamUrl(), LIVE365_STREAM_URL);
  assert.match(read('src/lib/nativeRadio.js'), /Capacitor\.getPlatform\(\) === 'android'/);
});

test('Google Play 2026 API level and Android package identity are configured', () => {
  assert.match(read('android/variables.gradle'), /compileSdkVersion\s*=\s*36/);
  assert.match(read('android/variables.gradle'), /targetSdkVersion\s*=\s*36/);
  assert.match(read('android/app/build.gradle'), /applicationId\s+"digital\.truevoice\.app"/);
  assert.match(read('android/app/build.gradle'), /versionCode\s+1/);
  assert.match(read('android/build.gradle'), /com\.android\.tools\.build:gradle:8\.13\.2/);
  assert.match(read('android/gradle/wrapper/gradle-wrapper.properties'), /gradle-8\.13-all\.zip/);
});

test('Android launcher uses the approved TrueVoice wave, not the starter icon', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const icon = read('android/app/src/main/res/drawable/truevoice_app_icon.xml');
  assert.match(manifest, /android:icon="@drawable\/truevoice_app_icon"/);
  assert.match(manifest, /android:roundIcon="@drawable\/truevoice_app_icon"/);
  assert.match(icon, /#050816/);
  assert.match(icon, /#00BDEB/);
  assert.match(icon, /#008CFF/);
  assert.doesNotMatch(icon, /ic_launcher_foreground|ic_launcher_background/);
});

test('Android CI is build-only and does not publish without review', () => {
  const yaml = read('codemagic.yaml');
  assert.match(yaml, /android-play-debug-v1:/);
  assert.match(yaml, /env\.CM_BRANCH == "release\/android-play-1"/);
  assert.match(yaml, /:app:assembleDebug/);
  const section = yaml.split('  android-play-debug-v1:')[1].split('\n  ios-native-validation:')[0];
  assert.doesNotMatch(section, /publishing:|google_play:|upload-key|keystore_password/);
});

test('Android avoids Firebase push registration until a Firebase project is provisioned', () => {
  const push = read('src/lib/pushNotifications.js');
  const native = push.indexOf('if (!Capacitor.isNativePlatform()) return;');
  const android = push.indexOf("if (Capacitor.getPlatform() === 'android') return;");
  const registration = push.indexOf('await PushNotifications.register()');
  assert.ok(native >= 0 && android > native && registration > android, 'Android must exit before native FCM registration');
  const gradle = read('android/app/build.gradle');
  assert.match(gradle, /google-services\.json not found, google-services plugin not applied/);
});

test('Android Media3 owns one radio decoder and declares background media controls', () => {
  const gradle = read('android/app/build.gradle');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const activity = read('android/app/src/main/java/digital/truevoice/app/MainActivity.java');
  const service = read('android/app/src/main/java/digital/truevoice/app/TrueVoicePlaybackService.java');
  const plugin = read('android/app/src/main/java/digital/truevoice/app/TrueVoiceRadioPlugin.java');
  const adapter = read('src/lib/nativeRadio.js');
  const panel = read('src/components/NowPlayingPanel.jsx');
  assert.match(gradle, /media3-exoplayer:1\.11\.1/);
  assert.match(gradle, /media3-session:1\.11\.1/);
  assert.match(manifest, /android\.permission\.FOREGROUND_SERVICE_MEDIA_PLAYBACK/);
  assert.match(manifest, /android:foregroundServiceType="mediaPlayback"/);
  assert.match(manifest, /androidx\.media3\.session\.MediaSessionService/);
  assert.match(activity, /registerPlugin\(TrueVoiceRadioPlugin\.class\)/);
  assert.match(service, /extends MediaSessionService/);
  assert.match(service, /https:\/\/streaming\.live365\.com\/a61535/);
  assert.match(service, /new ExoPlayer\.Builder/);
  assert.match(service, /new MediaSession\.Builder/);
  assert.match(plugin, /@CapacitorPlugin\(name = "TrueVoiceRadio"\)/);
  for (const command of ['play', 'pause', 'getState', 'setVideoActive', 'setMetadata']) {
    assert.ok(plugin.includes('@PluginMethod public void ' + command), 'Missing Android bridge method ' + command);
  }
  assert.match(adapter, /Capacitor\.getPlatform\(\) === 'android'/);
  assert.match(panel, /IS_ANDROID_NATIVE_RADIO \? streamUrl : null/);
  assert.match(panel, /nativeRadio\.setMetadata/);
  assert.match(read('src/App.jsx'), /!IS_NATIVE_RADIO && <audio/);
});

test('Media3 Live365 requests advertise a compatible User-Agent through the actual HTTP source', () => {
  const service = read('android/app/src/main/java/digital/truevoice/app/TrueVoicePlaybackService.java');
  assert.match(service, /new DefaultHttpDataSource\.Factory\(\)/);
  assert.match(service, /\.setUserAgent\("Mozilla\/5\.0"\)/);
  assert.match(service, /new DefaultDataSource\.Factory\(this, httpSource\)/);
  assert.match(service, /\.setMediaSourceFactory\(new DefaultMediaSourceFactory\(dataSource\)\)/);
  assert.match(service, /https:\/\/streaming\.live365\.com\/a61535/);
});

test('Android song art is not overwritten by native session fallback metadata', () => {
  const panel = read('src/components/NowPlayingPanel.jsx');
  assert.match(panel, /if \(!IS_ANDROID_NATIVE_RADIO && state\.metadata\?\.title\) setDisplaySong/);
  assert.match(panel, /nativeRadio\.setMetadata/);
  const plugin = read('android/app/src/main/java/digital/truevoice/app/TrueVoiceRadioPlugin.java');
  assert.match(plugin, /Log\.e\(TAG, "Media3 controller connection failed", e\)/);
});
