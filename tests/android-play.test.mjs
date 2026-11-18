import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIVE365_STREAM_URL, preferredStreamUrl } from '../src/lib/streamUrl.js';

const read = p => readFileSync(p, 'utf8');

test('Android Play candidate retains the verified Live365 listening source', () => {
  assert.equal(LIVE365_STREAM_URL, 'https://streaming.live365.com/a61535');
  assert.equal(preferredStreamUrl(), LIVE365_STREAM_URL);
  assert.match(read('src/lib/nativeRadio.js'), /Capacitor\.getPlatform\(\) === 'ios'/);
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
