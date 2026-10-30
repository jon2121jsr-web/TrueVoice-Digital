import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const branch = 'ci/ios-native-validation-1b03b';
const output = path.join(root, '.native-validation/ci');
const sourceManifest = path.join(root, 'ci/native-validation/source-manifest.json');
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
export function sanitize(text) {
  return text
    .replace(/-----BEGIN [\w ]*PRIVATE KEY-----[\s\S]*?-----END [\w ]*PRIVATE KEY-----/g, '[PRIVATE KEY REDACTED]')
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/g, '$1[REDACTED]@')
    .replace(/\b(?:sk_(?:live|test)_[A-Za-z0-9]+|AIza[A-Za-z0-9_-]{30,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g, '[TOKEN REDACTED]')
    .replace(/(authorization\s*[:=]\s*)(?:bearer\s+)?[^\r\n]+/gi, '$1[REDACTED]');
}
export function run(name, command, args, { cwd = root, evidence = output, env = process.env } = {}) {
  fs.mkdirSync(path.join(evidence, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(evidence, 'reports'), { recursive: true });
  console.log(sanitize(JSON.stringify({ command, args, cwd })));
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', timeout: 1_500_000, maxBuffer: 50 * 1024 * 1024 });
  const log = sanitize((result.stdout ?? '') + (result.stderr ?? '') + (result.error ? '\n' + result.error.message : ''));
  fs.writeFileSync(path.join(evidence, 'logs', name + '.log'), log);
  process.stdout.write(log);
  const exitCode = result.status ?? (result.signal === 'SIGTERM' ? 124 : 1);
  fs.writeFileSync(path.join(evidence, 'reports', name + '-command.json'), JSON.stringify({ command, args, cwd, exitCode, signal: result.signal, executed: !result.error, error: result.error?.code }, null, 2));
  if (result.error || exitCode !== 0) throw Object.assign(new Error(name + ' failed; inspect ' + name + '.log'), { exitCode: exitCode || 1 });
  return result.stdout;
}
export function verifySource(directory = root, manifestFile = sourceManifest, trackedPaths) {
  const manifest = JSON.parse(fs.readFileSync(manifestFile));
  const expected = new Set(manifest.entries.map(e => e.path));
  assert.equal(expected.size, manifest.entries.length, 'Duplicate manifest entries');
  for (const e of manifest.entries) {
    assert.ok(!path.isAbsolute(e.path) && !e.path.split(/[\\/]/).includes('..'), 'Unsafe manifest path');
    assert.doesNotMatch(e.path, /(^|\/)\.env(?:\.|$)|\.(?:p8|p12|mobileprovision|pem|key)$/i, 'Credential file in CI source');
    const file = path.join(directory, e.path);
    assert.ok(fs.existsSync(file), `Missing source: ${e.path}`);
    assert.equal(hash(fs.readFileSync(file)), e.sha256, `Source mismatch: ${e.path}`);
  }
  if (trackedPaths) {
    const actual = trackedPaths.filter(p => p !== 'ci/native-validation/source-manifest.json');
    assert.deepEqual([...actual].sort(), [...expected].sort(), 'Git tree differs from reviewed transfer manifest');
  }
  for (const file of [
    'ios/App/App/TrueVoiceRadioPlugin.swift', 'ios/App/App/RadioBridgeViewController.swift',
    'ios/NativeAudioPolicy/Sources/NativeAudioPolicy/RadioPlaybackPolicy.swift',
    'ios/NativeAudioPolicy/Tests/NativeAudioPolicyTests/RadioPlaybackPolicyTests.swift',
    'capacitor.config.ts', 'package.json', 'package-lock.json',
    'public/icon-512-waveform-v1.png', 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
  ]) assert.ok(expected.has(file), `Required file not transferred: ${file}`);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'vercel.json'))).git.deploymentEnabled, false, 'CI branch must disable Vercel Git deployments');
  const policy = fs.readFileSync(path.join(directory, 'ios/NativeAudioPolicy/Tests/NativeAudioPolicyTests/RadioPlaybackPolicyTests.swift'), 'utf8');
  assert.equal((policy.match(/func test/g) ?? []).length, 7, 'Expected seven reviewed Swift tests');
  return { entries: expected.size, manifestSha256: hash(fs.readFileSync(manifestFile)) };
}
function guardEnvironment() {
  assert.equal(os.platform(), 'darwin', 'macOS is required; no compilation was performed');
  assert.equal(process.env.CM_BRANCH, branch, 'Only the dedicated validation branch is allowed');
  for (const name of [
    'SUPABASE_SERVICE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'FIREBASE_SERVICE_ACCOUNT_JSON',
    'YOUTUBE_API_KEY', 'VITE_YOUTUBE_API_KEY', 'VERCEL_TOKEN', 'APP_STORE_CONNECT_PRIVATE_KEY',
    'CM_CERTIFICATE_PATH', 'CM_PROVISIONING_PROFILE_PATH',
  ]) assert.ok(!process.env[name], `Remove unrelated credential from validation environment: ${name}`);
}
export function verifyNativeFiles() {
  const manifest = JSON.parse(fs.readFileSync(sourceManifest));
  for (const e of manifest.entries.filter(e => e.path.endsWith('.swift'))) {
    assert.equal(hash(fs.readFileSync(path.join(root, e.path))), e.sha256, 'Sync changed reviewed Swift source');
  }
  const storyboard = fs.readFileSync(path.join(root, 'ios/App/App/Base.lproj/Main.storyboard'), 'utf8');
  assert.ok(storyboard.includes('customClass="RadioBridgeViewController"'));
  const plugin = fs.readFileSync(path.join(root, 'ios/App/App/RadioBridgeViewController.swift'), 'utf8');
  assert.ok(plugin.includes('registerPluginInstance(TrueVoiceRadioPlugin())'));
  const project = fs.readFileSync(path.join(root, 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
  for (const name of ['TrueVoiceRadioPlugin.swift', 'RadioBridgeViewController.swift', 'RadioPlaybackPolicy.swift']) {
    assert.ok(project.split('/* Begin PBXSourcesBuildPhase section */')[1]?.split('/* End PBXSourcesBuildPhase section */')[0].includes(name + ' in Sources'), 'Missing Xcode source membership');
  }
}
export function main(step) {
  assert.ok(['preflight', 'dependencies', 'swift-tests', 'web-build', 'sync', 'compile'].includes(step), 'Unknown validation step');
  guardEnvironment();
  process.chdir(root);
  fs.mkdirSync(path.join(output, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(output, 'reports'), { recursive: true });
  if (step === 'preflight') {
    const tracked = run('git-files', 'git', ['ls-files', '-z']).split('\0').filter(Boolean);
    const source = verifySource(root, sourceManifest, tracked);
    verifyNativeFiles();
    const xcode = run('xcode-version', 'xcodebuild', ['-version']);
    assert.match(xcode, /Xcode 26\.2\b/, 'Unexpected Xcode image');
    const sdk = run('sdk-version', 'xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-version']).trim();
    assert.ok(Number.parseInt(sdk, 10) >= 26, 'Current iOS simulator SDK required');
    run('swift-version', 'swift', ['--version']);
    run('pod-version', 'pod', ['--version']);
    fs.writeFileSync(path.join(output, 'reports', 'source.json'), JSON.stringify({ ...source, branch, commit: run('git-head', 'git', ['rev-parse', 'HEAD']).trim(), node: process.version, sdk }, null, 2));
  } else if (step === 'dependencies') {
    run('npm-ci', 'npm', ['ci', '--no-audit', '--no-fund']);
  } else if (step === 'swift-tests') {
    const log = run('swift-tests', 'swift', ['test', '--package-path', 'ios/NativeAudioPolicy', '--verbose']);
    // XCTest writes its summary to stderr on some Swift versions.
    const saved = fs.readFileSync(path.join(output, 'logs/swift-tests.log'), 'utf8');
    assert.match(log + saved, /Executed 7 tests, with 0 failures/, 'Seven XCTest cases must actually execute');
    fs.writeFileSync(path.join(output, 'reports', 'swift-tests.json'), JSON.stringify({ executed: 7, failures: 0 }));
  } else if (step === 'web-build') {
    run('web-build', 'npm', ['run', 'build'], { env: { ...process.env,
      VERCEL: '1', VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production',
      VITE_STREAM_DELAY_SEC: '15', VITE_AZURACAST_METADATA_DELAY_SEC: '2', VITE_LIVE365_METADATA_DELAY_SEC: '55',
    } });
    run('web-timing', process.execPath, ['tools/verify-stream-timing-build.mjs']);
    const html = fs.readFileSync('dist/index.html', 'utf8');
    const asset = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
    assert.ok(asset, 'Missing main bundle');
    const bundle = fs.readFileSync('dist' + asset, 'utf8');
    assert.ok(bundle.includes('https://streaming.live365.com/a61535'), 'Missing approved Live365 endpoint');
    assert.doesNotMatch(bundle, /https:\/\/stream\.truevoice\.digital\/(?:listen|hls)\//, 'Direct-origin listener URL emitted');
  } else if (step === 'sync') {
    // cap sync ios already invokes CocoaPods; never use pod update.
    run('capacitor-sync', 'npx', ['--no-install', 'cap', 'sync', 'ios']);
    run('pod-install', 'pod', ['install'], { cwd: path.join(root, 'ios/App') });
    assert.ok(fs.existsSync('ios/App/Podfile.lock'), 'CocoaPods resolution did not produce Podfile.lock');
    assert.ok(fs.existsSync('ios/App/App.xcworkspace/contents.xcworkspacedata'), 'Missing generated workspace');
    verifyNativeFiles();
    const config = JSON.parse(fs.readFileSync('ios/App/App/capacitor.config.json'));
    assert.equal(config.appId, 'digital.truevoice.app');
    assert.equal(config.server.iosScheme, 'capacitor');
    assert.equal(config.server.hostname, 'localhost');
    assert.equal(config.server.url, undefined);
    assert.ok(fs.existsSync('ios/App/App/public/icon-512-waveform-v1.png'));
    const lock = fs.readFileSync('ios/App/Podfile.lock');
    const versions = [...lock.toString().matchAll(/^\s+- (Capacitor[^ (]*|Capacitor) \(([^)]+)\)/gm)].map(m => ({ pod: m[1], version: m[2] }));
    fs.writeFileSync(path.join(output, 'reports', 'pods.json'), JSON.stringify({ podfileLockSha256: hash(lock), versions, resolved: true }));
  } else if (step === 'compile') {
    verifyNativeFiles();
    for (const name of ['DerivedData', 'SimulatorBuild.xcresult']) {
      assert.ok(!fs.existsSync(path.join(output, name)), 'Use a fresh checkout: build evidence already exists');
    }
    const devices = JSON.parse(run('simulators', 'xcrun', ['simctl', 'list', 'devices', 'available', '--json']));
    const simulator = Object.entries(devices.devices).filter(([runtime]) => runtime.includes('.iOS-'))
      .flatMap(([, list]) => list).find(device => device.isAvailable && device.name.startsWith('iPhone'));
    assert.ok(simulator?.udid, 'No available iPhone simulator');
    run('xcode-destinations', 'xcodebuild', ['-workspace', 'ios/App/App.xcworkspace', '-scheme', 'App', '-showdestinations']);
    run('xcode-build', 'xcodebuild', [
      '-workspace', 'ios/App/App.xcworkspace', '-scheme', 'App', '-configuration', 'Debug',
      '-sdk', 'iphonesimulator', '-destination', 'platform=iOS Simulator,id=' + simulator.udid,
      '-derivedDataPath', path.join(output, 'DerivedData'), '-resultBundlePath', path.join(output, 'SimulatorBuild.xcresult'),
      'CODE_SIGNING_ALLOWED=NO', 'CODE_SIGNING_REQUIRED=NO', 'CODE_SIGN_IDENTITY=', 'DEVELOPMENT_TEAM=', 'build',
    ]);
    const compilerEvidence = fs.readFileSync(path.join(output, 'logs/xcode-build.log'), 'utf8');
    assert.match(compilerEvidence, /\*\* BUILD SUCCEEDED \*\*/, 'Missing Xcode success evidence');
    for (const name of ['TrueVoiceRadioPlugin.swift', 'RadioBridgeViewController.swift', 'RadioPlaybackPolicy.swift']) {
      assert.ok(compilerEvidence.includes(name), 'Missing compiler source evidence: ' + name);
    }
    const app = path.join(output, 'DerivedData/Build/Products/Debug-iphonesimulator/App.app');
    assert.ok(fs.existsSync(app), 'Missing simulator application');
    assert.ok(!fs.existsSync(path.join(app, '_CodeSignature')), 'Unexpected app signature');
    const id = run('app-identifier', 'plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', path.join(app, 'Info.plist')]).trim();
    assert.equal(id, 'digital.truevoice.app');
    const modes = JSON.parse(run('background-modes', 'plutil', ['-extract', 'UIBackgroundModes', 'json', '-o', '-', path.join(app, 'Info.plist')]));
    assert.ok(modes.includes('audio'));
    fs.writeFileSync(path.join(output, 'reports', 'compilation.json'), JSON.stringify({ status: 'PASS', simulator, compilerInvoked: true, sdk: 'iphonesimulator', configuration: 'Debug', signed: false, bundleId: id, backgroundModes: modes, runtimeTested: false, fixtureConfiguration: true, distributed: false }, null, 2));
  } else throw Error('Unknown validation step');
  console.log(`${step}: PASS (no distribution)`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv[2]); }
  catch (error) { console.error(sanitize(error.message)); process.exitCode = error.exitCode ?? 1; }
}
