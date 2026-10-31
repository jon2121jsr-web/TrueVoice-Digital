// Future approved macOS worker only. No raw signing-tool output is logged.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyReleaseSource } from '../ios-release/validate.mjs';
import { verifyNativeFiles } from '../native-validation/validate.mjs';
import { policy, assertSelection, validateSignedEnvironment, childEnvironment, validateProfile, selectIdentity, validateSignedApp, exportOptions, assertSigningOnlyChanges } from './policy.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, '.native-validation/signed');
const reports = path.join(output, 'reports');
const privateDir = path.join(output, 'private');
const metadataTool = path.join(root, 'ci/ios-signed/plist-metadata.py');
const projectPath = 'ios/App/App.xcodeproj/project.pbxproj';
const statuses = [];
const sha = b => createHash('sha256').update(b).digest('hex');

function capture(name, command, args, { cwd = root, input } = {}) {
  assert.match(name, /^[a-z0-9-]+$/);
  const result = spawnSync(command, args, { cwd, input, env: childEnvironment(process.env), timeout: 1_500_000, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  const exitCode = result.status ?? 1;
  statuses.push({ step: name, exitCode, signal: result.signal, completed: !result.error && exitCode === 0 });
  fs.mkdirSync(reports, { recursive: true });
  fs.writeFileSync(path.join(reports, process.argv[2] + '-steps.json'), JSON.stringify(statuses, null, 2));
  console.log(name + ': ' + (result.error || exitCode !== 0 ? 'FAILED' : 'completed') + ' (exit ' + exitCode + ')');
  if (result.error || exitCode !== 0) throw Object.assign(new Error('Step failed'), { exitCode });
  // Deliberately do not persist stdout/stderr, args, environment or error text.
  return { stdout: result.stdout ?? Buffer.alloc(0), stderr: result.stderr ?? Buffer.alloc(0) };
}

function decodePlist(name, bytes, action = 'decode') {
  return JSON.parse(capture(name, 'python3', [metadataTool, action], { input: bytes }).stdout.toString('utf8'));
}
function decodeProfile(name, file) {
  const raw = capture(name + '-cms', 'security', ['cms', '-D', '-i', file]).stdout;
  return validateProfile(decodePlist(name + '-metadata', raw, 'profile'));
}
function selectAssets() {
  const file = fs.realpathSync(process.env.PULSE_SIGNING_PROFILE_PATH);
  assert.ok(path.isAbsolute(file) && file.endsWith('.mobileprovision'));
  const profile = decodeProfile('selected-profile', file);
  const listing = capture('valid-keychain-identities', 'security', ['find-identity', '-v', '-p', 'codesigning']).stdout.toString('utf8');
  const identities = [...listing.matchAll(/^\s*\d+\)\s+([A-F0-9]{40})\s+"([^"\r\n]+)"/gm)].map(m => ({ sha1: m[1], name: m[2] }));
  const identity = selectIdentity(profile, identities);
  return { file, profile, identity, selectedHash: sha(fs.readFileSync(file)) };
}

export function extractPlist(bytes) {
  if (bytes.subarray(0, 8).toString() === 'bplist00') return bytes;
  const text = bytes.toString('utf8');
  let start = text.indexOf('<?xml');
  if (start < 0) start = text.indexOf('<plist');
  const end = text.indexOf('</plist>', start);
  assert.ok(start >= 0 && end >= start, 'Entitlement plist missing');
  return Buffer.from(text.slice(start, end + '</plist>'.length));
}

function inspectApp(name, app, assets) {
  capture(name + '-codesign-verify', 'codesign', ['--verify', '--deep', '--strict', '--verbose=2', app]);
  const signature = JSON.parse(capture(name + '-signature-metadata', 'swift', ['ci/ios-signed/inspect-signature.swift', app]).stdout.toString('utf8'));
  const info = decodePlist(name + '-bundle-info', fs.readFileSync(path.join(app, 'Info.plist')));
  const embedded = path.join(app, 'embedded.mobileprovision');
  const profile = decodeProfile(name + '-embedded-profile', embedded);
  assert.equal(profile.uuid, assets.profile.uuid);
  const ent = capture(name + '-entitlements', 'codesign', ['-d', '--entitlements', ':-', app]);
  const entitlements = decodePlist(name + '-entitlement-metadata', extractPlist(ent.stdout.length ? ent.stdout : ent.stderr));
  const checks = validateSignedApp({ info, signature, entitlements, profile, identity: assets.identity, embeddedHash: sha(fs.readFileSync(embedded)), selectedHash: assets.selectedHash });
  assert.ok(fs.existsSync(path.join(app, '_CodeSignature/CodeResources')));
  return { ...checks, entitlementNames: Object.keys(entitlements).sort() };
}

function fileHash(file) {
  const h = createHash('sha256'), buffer = Buffer.alloc(65536), fd = fs.openSync(file, 'r');
  try { for (let n; (n = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0;) h.update(buffer.subarray(0, n)); }
  finally { fs.closeSync(fd); }
  return h.digest('hex');
}
export function treeHash(directory) {
  const h = createHash('sha256');
  function walk(relative = '') {
    for (const name of fs.readdirSync(path.join(directory, relative)).sort()) {
      const p = path.posix.join(relative, name), file = path.join(directory, p), stat = fs.lstatSync(file);
      assert.doesNotMatch(p, /\.(p8|p12|pem|key)$/i, 'Credential file must not enter an artifact');
      assert.ok(!name.endsWith('.appex'), 'Unreviewed app extension');
      if (stat.isSymbolicLink()) {
        const target = fs.readlinkSync(file), resolved = path.resolve(path.dirname(file), target);
        assert.ok(!path.isAbsolute(target) && resolved.startsWith(path.resolve(directory) + path.sep), 'Unsafe artifact symlink');
        h.update('link\0' + p + '\0' + target + '\0');
      }
      else if (stat.isDirectory()) { h.update('directory\0' + p + '\0'); walk(p); }
      else { assert.ok(stat.isFile()); h.update('file\0' + p + '\0' + (stat.mode & 0o777) + '\0' + fileHash(file) + '\0'); }
    }
  }
  walk(); return h.digest('hex');
}

export function validateZipEntries(entries) {
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    assert.ok(!entry.startsWith('/') && !entry.includes('\\') && !entry.split('/').includes('..'), 'Unsafe IPA entry');
    assert.doesNotMatch(entry, /\.(p8|p12|pem|key)$/i);
  }
  assert.ok(entries.includes('Payload/App.app/Info.plist'), 'Expected App payload missing');
  assert.equal(new Set(entries.filter(p => /^Payload\/[^/]+\.app\//.test(p)).map(p => p.split('/')[1])).size, 1);
}

function archiveExport() {
  verifyNativeFiles();
  const assets = selectAssets();
  assert.ok(!fs.existsSync(privateDir), 'Use a fresh approved worker');
  fs.mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  const before = JSON.parse(capture('project-before', 'plutil', ['-convert', 'json', '-o', '-', projectPath]).stdout.toString());
  capture('apply-existing-profile', 'xcode-project', ['use-profiles', '--silent', '--project', 'ios/App/App.xcodeproj', '--profile', assets.file, '--archive-method', 'app-store', '--export-options-plist', path.join(privateDir, 'helper-export-options.plist')]);
  const after = JSON.parse(capture('project-after', 'plutil', ['-convert', 'json', '-o', '-', projectPath]).stdout.toString());
  const signingSettingChanges = assertSigningOnlyChanges(before, after);
  const targets = Object.values(after.objects).filter(o => o.isa === 'PBXNativeTarget' && o.name === 'App');
  assert.equal(targets.length, 1);
  const configs = after.objects[targets[0].buildConfigurationList].buildConfigurations.map(id => after.objects[id]);
  const release = configs.filter(c => c.name === 'Release');
  assert.equal(release.length, 1);
  assert.equal(release[0].buildSettings.DEVELOPMENT_TEAM, policy.team);
  assert.equal(release[0].buildSettings.CODE_SIGN_STYLE, 'Manual');
  assert.ok([assets.profile.uuid, assets.profile.name].includes(release[0].buildSettings.PROVISIONING_PROFILE_SPECIFIER));
  verifyNativeFiles();

  const options = exportOptions(assets.profile, assets.identity), optionsPath = path.join(privateDir, 'ExportOptions.plist');
  const encoded = capture('encode-export-options', 'python3', [metadataTool, 'encode'], { input: JSON.stringify(options) }).stdout;
  fs.writeFileSync(optionsPath, encoded, { mode: 0o600 });
  const archive = path.join(output, 'App-signed.xcarchive'), exported = path.join(output, 'export');
  assert.ok(!fs.existsSync(archive) && !fs.existsSync(exported), 'Stale artifacts prohibited');
  const build = capture('signed-release-archive', 'xcodebuild', ['-workspace', 'ios/App/App.xcworkspace', '-scheme', 'App', '-configuration', 'Release', '-sdk', 'iphoneos', '-destination', 'generic/platform=iOS', '-archivePath', archive, '-derivedDataPath', path.join(privateDir, 'DerivedData'), '-resultBundlePath', path.join(privateDir, 'Archive.xcresult'), 'DEVELOPMENT_TEAM=' + policy.team, 'CODE_SIGN_STYLE=Manual', 'CODE_SIGNING_ALLOWED=YES', 'archive']);
  const buildOutput = build.stdout.toString() + build.stderr.toString();
  assert.match(buildOutput, /\*\* ARCHIVE SUCCEEDED \*\*/);
  for (const file of ['TrueVoiceRadioPlugin.swift', 'RadioBridgeViewController.swift', 'RadioPlaybackPolicy.swift']) assert.ok(buildOutput.includes(file));
  const archivedApp = path.join(archive, 'Products/Applications/App.app');
  const archiveChecks = inspectApp('archive', archivedApp, assets);
  capture('app-store-connect-export-only', 'xcodebuild', ['-exportArchive', '-archivePath', archive, '-exportOptionsPlist', optionsPath, '-exportPath', exported]);
  const ipas = fs.readdirSync(exported).filter(p => p.endsWith('.ipa'));
  assert.equal(ipas.length, 1, 'Exactly one exported IPA required');
  const ipa = path.join(exported, ipas[0]);
  const entries = capture('ipa-entry-inventory', '/usr/bin/unzip', ['-Z1', ipa]).stdout.toString('utf8').trim().split(/\r?\n/);
  validateZipEntries(entries);
  const unpacked = path.join(privateDir, 'exported-payload');
  capture('unpack-own-export', 'ditto', ['-x', '-k', ipa, unpacked]);
  const exportedApp = path.join(unpacked, 'Payload/App.app');
  const exportChecks = inspectApp('export', exportedApp, assets);
  const result = {
    status: 'SIGNED_ARCHIVE_AND_EXPORT_VERIFIED', team: policy.team, bundleId: policy.bundleId,
    configuration: 'Release', sdk: 'iphoneos', method: policy.exportMethod, destination: 'export',
    archiveChecks, exportChecks, signingSettingChanges,
    archiveTreeSha256: treeHash(archive), archiveAppTreeSha256: treeHash(archivedApp),
    ipaSha256: fileHash(ipa), exportedAppTreeSha256: treeHash(exportedApp),
    uploaded: false, publishingConfigured: false, directDeviceInstallable: false,
  };
  // Only approved artifact bytes and this controlled metadata are collected.
  fs.writeFileSync(path.join(reports, 'verification.json'), JSON.stringify(result, null, 2));
}

export function main(step) {
  assert.ok(['preflight', 'dependencies', 'swift-tests', 'web-build', 'sync', 'archive-export'].includes(step));
  assert.equal(os.platform(), 'darwin', 'Approved macOS worker required');
  assertSelection(process.env.CM_BRANCH, process.env.CM_WORKFLOW_NAME);
  assert.equal(process.env.CM_TRIGGER_SOURCE, 'api', 'Webhook and scheduled runs prohibited');
  assert.ok(!process.env.CM_TAG && process.env.CM_PULL_REQUEST !== 'true', 'Tags and pull-request runs prohibited');
  validateSignedEnvironment(process.env);
  process.chdir(root);
  if (step === 'preflight') {
    const source = verifyReleaseSource();
    assert.equal(process.version, 'v24.14.0', 'Unexpected Node version');
    assert.equal(process.env.CM_COMMIT, source.commit, 'Provider commit differs from checkout');
    capture('approved-ancestry', 'git', ['merge-base', '--is-ancestor', policy.baseline, 'HEAD']);
    assert.match(capture('xcode-version', 'xcodebuild', ['-version']).stdout.toString(), /Xcode 26\.2\b/);
    capture('swift-version', 'swift', ['--version']);
    assert.equal(capture('pod-version', 'pod', ['--version']).stdout.toString().trim(), '1.16.2');
    selectAssets();
    fs.writeFileSync(path.join(reports, 'source.json'), JSON.stringify({ ...source, signingPolicyBaseline: policy.baseline, workflow: policy.workflow, profileAndIdentityPreflight: true }, null, 2));
  } else if (step === 'dependencies') capture('locked-npm-install', 'npm', ['ci', '--no-audit', '--no-fund']);
  else if (step === 'swift-tests') {
    const tests = capture('swift-tests', 'swift', ['test', '--package-path', 'ios/NativeAudioPolicy', '--verbose']);
    assert.match(tests.stdout.toString() + tests.stderr.toString(), /Executed 7 tests, with 0 failures/);
  } else if (step === 'web-build') {
    capture('web-build', process.execPath, ['ci/ios-release/build-web.mjs']);
    capture('emitted-timing-and-pwa', process.execPath, ['tools/verify-stream-timing-build.mjs']);
  } else if (step === 'sync') {
    capture('capacitor-sync', 'npx', ['--no-install', 'cap', 'sync', 'ios']);
    capture('cocoapods-resolution', 'pod', ['install'], { cwd: path.join(root, 'ios/App') });
    verifyNativeFiles();
    const config = JSON.parse(fs.readFileSync('ios/App/App/capacitor.config.json'));
    assert.equal(config.appId, policy.bundleId); assert.equal(config.server.iosScheme, 'capacitor');
    assert.equal(config.server.hostname, 'localhost'); assert.equal(config.server.url, undefined);
    assert.ok(fs.existsSync('ios/App/App/public/icon-512-waveform-v1.png'));
    fs.writeFileSync(path.join(reports, 'pods.json'), JSON.stringify({ lockSha256: fileHash('ios/App/Podfile.lock') }, null, 2));
  } else archiveExport();
  console.log('Signed validation step complete; no App Store upload or publishing.');
}
