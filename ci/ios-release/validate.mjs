// Local preparation and future manual unsigned archive validation only.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { run, sanitize, verifyNativeFiles } from '../native-validation/validate.mjs';

export const releaseBranch = 'release/ios-testflight-1b04';
export const baseline = '1c3ebb18eee5151c47d844ea97100651624c98e6';
const root = fileURLToPath(new URL('../../', import.meta.url));
const evidence = path.join(root, '.native-validation/release');
const releaseManifest = path.join(root, 'ci/ios-release/source-manifest.json');

export function verifyReleaseNativeFiles() {
  verifyNativeFiles(releaseManifest);
}

const hash = b => createHash('sha256').update(b).digest('hex');
const git = args => execFileSync('git', ['--no-optional-locks', ...args], { cwd: root, encoding: 'utf8' }).trim();
const execute = (name, command, args, options = {}) => run(name, command, args, { cwd: root, evidence, ...options });

export function assertReleaseBranch(value) {
  assert.equal(value, releaseBranch, 'Only the isolated release branch is allowed');
}
export function validateRuntime(env, profile = JSON.parse(fs.readFileSync(new URL('./runtime-profile.json', import.meta.url)))) {
  const url = env.VITE_SUPABASE_URL ?? '';
  const key = env.VITE_SUPABASE_ANON_KEY ?? '';
  assert.ok(url && key, 'Supply the approved public runtime pair through process inputs');
  assert.equal(hash(url + '\n' + key), profile.publicPairSha256, 'Public runtime pair differs from approved local configuration');
  let endpoint, claims;
  try { endpoint = new URL(url); claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url')); }
  catch { throw Error('Invalid public runtime configuration'); }
  assert.equal(endpoint.protocol, 'https:');
  assert.equal(claims.role, 'anon', 'Only the approved anon client key is allowed');
  assert.equal(endpoint.hostname, claims.ref + '.supabase.co', 'Public project references differ');
  assert.ok(!claims.exp || claims.exp > Date.now() / 1000, 'Public client key is expired');
  const permittedVite = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']);
  for (const [name, value] of Object.entries(env)) {
    assert.ok(!value || !name.startsWith('VITE_') || permittedVite.has(name), 'Unexpected public build override: ' + name);
    assert.ok(!value || !/^(?:SUPABASE_SERVICE.*|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|FIREBASE_SERVICE_ACCOUNT_JSON|YOUTUBE_API_KEY|AZURACAST_API_KEY|VERCEL_TOKEN|APP_STORE_CONNECT_.*|CM_CERTIFICATE_PATH|CM_PROVISIONING_PROFILE_PATH)$/.test(name), 'Remove private or signing input: ' + name);
  }
  return { publicPairSha256: profile.publicPairSha256, valuesPrinted: false };
}

export function verifyReleaseSource({ localPreparation = false } = {}) {
  const checkedOutBranch = git(['branch', '--show-current']);
  if (localPreparation || checkedOutBranch) assertReleaseBranch(checkedOutBranch);
  else assertReleaseBranch(process.env.CM_BRANCH); // CI may check out the selected commit detached.
  git(['merge-base', '--is-ancestor', baseline, 'HEAD']);
  const manifestPath = 'ci/ios-release/source-manifest.json';
  const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath)));
  assert.equal(manifest.baseline, baseline);
  assert.equal(manifest.branch, releaseBranch);
  const listed = new Set();
  for (const entry of manifest.entries) {
    assert.ok(!path.isAbsolute(entry.path) && !entry.path.split(/[\\/]/).includes('..'), 'Unsafe source path');
    assert.ok(!listed.has(entry.path), 'Duplicate source path');
    listed.add(entry.path);
    assert.doesNotMatch(entry.path, /(^|\/)\.env(?:\.|$)|\.(p8|p12|pem|key|mobileprovision)$/i);
    assert.equal(hash(fs.readFileSync(path.join(root, entry.path))), entry.sha256, 'Release source mismatch: ' + entry.path);
  }
  const inventory = execFileSync('git', ['--no-optional-locks', 'ls-files', '--cached', ...(localPreparation ? ['--others', '--exclude-standard'] : []), '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  assert.deepEqual(inventory.filter(p => p !== manifestPath).sort(), [...listed].sort(), 'Release source inventory differs');
  if (!localPreparation) assert.equal(git(['status', '--porcelain=v1', '--untracked-files=all']), '', 'Future worker requires a committed clean checkout');
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'))).git.deploymentEnabled, false);
  verifyReleaseNativeFiles();
  assert.ok(!fs.readdirSync(root).some(p => /^\.env(?:\.|$)/.test(p)), 'Release worktree must not load environment files');
  return { baseline, commit: git(['rev-parse', 'HEAD']), manifestSha256: hash(fs.readFileSync(path.join(root, manifestPath))), entries: listed.size };
}

function main(step) {
  assert.ok(['preflight', 'dependencies', 'swift-tests', 'web-build', 'sync', 'archive'].includes(step), 'Unknown release step');
  assert.equal(os.platform(), 'darwin', 'macOS worker required; no archive performed');
  assertReleaseBranch(process.env.CM_BRANCH);
  validateRuntime(process.env);
  process.chdir(root);
  fs.mkdirSync(path.join(evidence, 'reports'), { recursive: true });
  if (step === 'preflight') {
    const source = verifyReleaseSource();
    assert.match(execute('xcode-version', 'xcodebuild', ['-version']), /Xcode 26\.2\b/);
    execute('swift-version', 'swift', ['--version']);
    execute('pod-version', 'pod', ['--version']);
    fs.writeFileSync(path.join(evidence, 'reports/source.json'), JSON.stringify(source, null, 2));
  } else if (step === 'dependencies') {
    execute('npm-ci', 'npm', ['ci', '--no-audit', '--no-fund']);
  } else if (step === 'swift-tests') {
    execute('swift-tests', 'swift', ['test', '--package-path', 'ios/NativeAudioPolicy', '--verbose']);
    assert.match(fs.readFileSync(path.join(evidence, 'logs/swift-tests.log'), 'utf8'), /Executed 7 tests, with 0 failures/);
  } else if (step === 'web-build') {
    // Let Vite exit before parsing emitted code, avoiding two large heaps at once.
    execute('web-build', process.execPath, ['ci/ios-release/build-web.mjs']);
    execute('web-timing', process.execPath, ['tools/verify-stream-timing-build.mjs']);
  } else if (step === 'sync') {
    execute('capacitor-sync', 'npx', ['--no-install', 'cap', 'sync', 'ios']);
    execute('pod-install', 'pod', ['install'], { cwd: path.join(root, 'ios/App') });
    verifyReleaseNativeFiles();
    const config = JSON.parse(fs.readFileSync('ios/App/App/capacitor.config.json'));
    assert.equal(config.appId, 'digital.truevoice.app');
    assert.equal(config.server.iosScheme, 'capacitor');
    assert.equal(config.server.hostname, 'localhost');
    assert.equal(config.server.url, undefined);
    assert.ok(fs.existsSync('ios/App/App.xcworkspace/contents.xcworkspacedata'));
    assert.ok(fs.existsSync('ios/App/App/public/icon-512-waveform-v1.png'));
    const lock = fs.readFileSync('ios/App/Podfile.lock');
    fs.writeFileSync(path.join(evidence, 'reports/pods.json'), JSON.stringify({ lockSha256: hash(lock) }, null, 2));
  } else {
    verifyReleaseNativeFiles();
    const archive = path.join(evidence, 'App-unsigned.xcarchive');
    assert.ok(!fs.existsSync(archive), 'Use a fresh worker; archive already exists');
    execute('release-archive', 'xcodebuild', ['-workspace', 'ios/App/App.xcworkspace', '-scheme', 'App', '-configuration', 'Release', '-destination', 'generic/platform=iOS', '-archivePath', archive, 'CODE_SIGNING_ALLOWED=NO', 'CODE_SIGNING_REQUIRED=NO', 'CODE_SIGN_IDENTITY=', 'DEVELOPMENT_TEAM=', 'archive']);
    const log = fs.readFileSync(path.join(evidence, 'logs/release-archive.log'), 'utf8');
    assert.match(log, /\*\* ARCHIVE SUCCEEDED \*\*/);
    for (const name of ['TrueVoiceRadioPlugin.swift', 'RadioBridgeViewController.swift', 'RadioPlaybackPolicy.swift']) assert.ok(log.includes(name), 'Missing compiler source evidence: ' + name);
    const app = path.join(archive, 'Products/Applications/App.app');
    assert.ok(fs.existsSync(app), 'Missing archived app');
    assert.ok(!fs.existsSync(path.join(app, '_CodeSignature')), 'Unexpected app signature');
    assert.equal(execute('bundle-id', 'plutil', ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', path.join(app, 'Info.plist')]).trim(), 'digital.truevoice.app');
    const modes = JSON.parse(execute('background-audio', 'plutil', ['-extract', 'UIBackgroundModes', 'json', '-o', '-', path.join(app, 'Info.plist')]));
    assert.ok(modes.includes('audio'));
    fs.writeFileSync(path.join(evidence, 'reports/archive.json'), JSON.stringify({ status: 'UNSIGNED_ARCHIVE_VALIDATED', configuration: 'Release', platform: 'iOS', signed: false, distributable: false, exportedIPA: false, uploaded: false }, null, 2));
  }
  console.log(step + ': completed; no signing/export/upload');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv[2]); }
  catch (error) { console.error(sanitize(error.message)); process.exitCode = error.exitCode ?? 1; }
}
