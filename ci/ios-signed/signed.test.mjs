import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { policy, assertSelection, validateSignedEnvironment, childEnvironment, validateProfile, selectIdentity, validateSignedApp, exportOptions, assertSigningOnlyChanges } from './policy.mjs';
import { extractPlist, validateZipEntries, treeHash } from './validate.mjs';
const yaml = createRequire(import.meta.url)('js-yaml');
const sha1 = 'A'.repeat(40);
const identity = { sha1, name: 'Apple Distribution: Offline fixture (' + policy.team + ')' };
const entitlements = {
  'application-identifier': policy.team + '.' + policy.bundleId,
  'com.apple.developer.team-identifier': policy.team,
  'get-task-allow': false, 'beta-reports-active': true,
};
const profile = () => ({ uuid: 'offline-uuid', name: 'offline-profile', teams: [policy.team], prefixes: [policy.team], platforms: ['iOS'], created: '2020-01-01', expires: '2099-01-01', hasDevices: false, allDevices: false, entitlements: { ...entitlements, 'keychain-access-groups': [policy.team + '.*'] }, certificateSha1: [sha1] });
const app = () => ({ info: { CFBundleIdentifier: policy.bundleId, CFBundleShortVersionString: '1.0', CFBundleVersion: '23', UIBackgroundModes: ['audio'] }, signature: { team: policy.team, identifier: policy.bundleId, leafSha1: sha1 }, entitlements: { ...entitlements, 'keychain-access-groups': [policy.team + '.' + policy.bundleId] }, profile: profile(), identity, embeddedHash: 'same', selectedHash: 'same' });

test('signed selection rejects other branches and workflows', () => {
  assert.doesNotThrow(() => assertSelection(policy.branch, policy.workflow));
  assert.throws(() => assertSelection('main', policy.workflow));
  assert.throws(() => assertSelection(policy.branch, 'truevoice-ios-workflow'));
  assert.throws(() => assertSelection(policy.branch, undefined));
});

test('signed public fingerprint remains mandatory; child tools receive no signing inputs', () => {
  const url = 'https://offlinefixture.supabase.co';
  const key = 'offline.' + Buffer.from(JSON.stringify({ role: 'anon', ref: 'offlinefixture' })).toString('base64url') + '.test';
  const env = { PATH: '/offline', VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key, PULSE_SIGNING_PROFILE_PATH: '/offline/profile.mobileprovision' };
  const runtime = { publicPairSha256: createHash('sha256').update(url + '\n' + key).digest('hex') };
  assert.doesNotThrow(() => validateSignedEnvironment(env, runtime));
  for (const name of ['VITE_OVERRIDE', 'APP_STORE_CONNECT_PRIVATE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CODE_SIGN_IDENTITY', 'UNAPPROVED_CERTIFICATE', 'NODE_PRIVATE_KEY']) {
    assert.throws(() => validateSignedEnvironment({ ...env, [name]: 'offline' }, runtime));
  }
  assert.throws(() => validateSignedEnvironment({ ...env, VITE_SUPABASE_ANON_KEY: 'wrong' }, runtime));
  assert.throws(() => validateSignedEnvironment({ ...env, PULSE_SIGNING_PROFILE_PATH: '' }, runtime));
  assert.deepEqual(Object.keys(childEnvironment({ ...env, NODE_OPTIONS: 'injection', APP_STORE_CONNECT_KEY_IDENTIFIER: 'offline' })).sort(), ['PATH', 'VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL']);
});

test('profile policy rejects wrong team, prefix, bundle, dates, device and enterprise distribution', () => {
  assert.doesNotThrow(() => validateProfile(profile()));
  const changes = [p => p.teams = ['OTHER'], p => p.prefixes = ['OTHER'], p => p.expires = '2000-01-01', p => p.created = '2099-01-01', p => p.hasDevices = true, p => p.allDevices = true, p => p.platforms = ['macOS'], p => p.entitlements['get-task-allow'] = true, p => p.entitlements['application-identifier'] += '.other', p => delete p.entitlements['beta-reports-active']];
  for (const change of changes) { const p = profile(); change(p); assert.throws(() => validateProfile(p)); }
});

test('only one valid matching distribution identity is accepted', () => {
  assert.deepEqual(selectIdentity(profile(), [identity]), identity);
  for (const list of [[], [identity, identity], [{ ...identity, sha1: 'B'.repeat(40) }], [{ ...identity, name: 'Apple Development: Offline (' + policy.team + ')' }]]) assert.throws(() => selectIdentity(profile(), list));
});

test('archive and IPA metadata reject identity, profile and entitlement tampering', () => {
  assert.equal(validateSignedApp(app()).entitlementsAuthorized, true);
  const changes = [a => a.signature.team = 'OTHER', a => a.signature.identifier += '.other', a => a.signature.leafSha1 = 'B'.repeat(40), a => a.embeddedHash = 'changed', a => a.info.CFBundleIdentifier += '.other', a => a.info.UIBackgroundModes = [], a => a.entitlements['get-task-allow'] = true, a => a.entitlements['unapproved.entitlement'] = true, a => a.entitlements['keychain-access-groups'] = ['OTHER.group'], a => a.entitlements['keychain-access-groups'] = [policy.team.replace('B', 'X') + '.' + policy.bundleId]];
  for (const change of changes) { const a = app(); change(a); assert.throws(() => validateSignedApp(a)); }
  // A literal dot in a permitted identifier must never act as a regex wildcard.
  const a = app(); a.profile.entitlements['keychain-access-groups'] = ['literal.group']; a.entitlements['keychain-access-groups'] = ['literalXgroup'];
  assert.throws(() => validateSignedApp(a));
});

test('export policy is manual App Store Connect export without upload', () => {
  const options = exportOptions(profile(), identity);
  assert.equal(options.method, 'app-store-connect'); assert.equal(options.destination, 'export');
  assert.equal(options.teamID, 'BX8URAAMLD'); assert.equal(options.signingStyle, 'manual');
  assert.equal(options.signingCertificate, sha1);
  assert.deepEqual(options.provisioningProfiles, { 'digital.truevoice.app': 'offline-uuid' });
  assert.equal(options.manageAppVersionAndBuildNumber, false); assert.equal(options.uploadSymbols, false);
});

test('worker project mutations are limited to signing settings', () => {
  const before = { objects: { ABC: { buildSettings: { CODE_SIGN_STYLE: 'Automatic', PRODUCT_BUNDLE_IDENTIFIER: policy.bundleId } } } };
  const after = structuredClone(before); after.objects.ABC.buildSettings.CODE_SIGN_STYLE = 'Manual';
  assert.equal(assertSigningOnlyChanges(before, after), 1);
  after.objects.ABC.buildSettings.PRODUCT_BUNDLE_IDENTIFIER = 'other';
  assert.throws(() => assertSigningOnlyChanges(before, after));
});

test('artifact inspection rejects traversal, credentials, multiple apps and missing entitlement data', () => {
  const good = ['Payload/', 'Payload/App.app/Info.plist']; validateZipEntries(good);
  for (const entry of ['../escape', '/absolute', 'Payload\\escape', 'Payload/App.app/key.p12', 'Payload/Other.app/Info.plist']) assert.throws(() => validateZipEntries([...good, entry]));
  assert.throws(() => extractPlist(Buffer.from('no entitlement plist')));
  assert.equal(extractPlist(Buffer.from('notice\n<plist><dict/></plist>\n')).toString(), '<plist><dict/></plist>');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-signed-test-'));
  try {
    fs.writeFileSync(path.join(temp, 'app'), 'first'); const first = treeHash(temp);
    fs.writeFileSync(path.join(temp, 'app'), 'second'); assert.notEqual(treeHash(temp), first);
    fs.writeFileSync(path.join(temp, 'private.p8'), 'offline'); assert.throws(() => treeHash(temp));
  } finally { fs.rmSync(temp, { recursive: true }); }
});

test('workflow signing scope is exclusive and both unsigned definitions/runners are unchanged', () => {
  const current = yaml.load(fs.readFileSync('codemagic.yaml', 'utf8'));
  const baseline = yaml.load(execFileSync('git', ['show', policy.baseline + ':codemagic.yaml'], { encoding: 'utf8' }));
  assert.deepEqual(Object.keys(current), ['workflows']);
  for (const name of Object.keys(baseline.workflows)) assert.deepEqual(current.workflows[name], baseline.workflows[name]);
  for (const file of ['ci/ios-release/validate.mjs', 'ci/ios-release/build-web.mjs', 'ci/native-validation/validate.mjs', 'ci/native-validation/codemagic.yaml']) assert.equal(fs.readFileSync(file, 'utf8'), execFileSync('git', ['show', policy.baseline + ':' + file], { encoding: 'utf8' }));
  const w = current.workflows[policy.workflow];
  assert.equal(w.name, policy.workflow); assert.equal(w.when.condition, 'env.CM_BRANCH == "' + policy.branch + '"');
  assert.deepEqual(w.environment, { xcode: '26.2', node: '24.14.0', cocoapods: '1.16.2', groups: ['pulse_ios_public_runtime'], ios_signing: { provisioning_profiles: [{ profile: policy.profileReference, environment_variable: policy.profilePathVariable }], certificates: [policy.certificateReference] } });
  const inspect = obj => { for (const [key, value] of Object.entries(obj ?? {})) { assert.doesNotMatch(key, /^(triggering|events|publishing|integrations)$/); if (value && typeof value === 'object') inspect(value); } };
  inspect(current);
  assert.deepEqual(w.scripts.map(s => s.script), ['preflight', 'dependencies', 'swift-tests', 'web-build', 'sync', 'archive-export'].map(s => 'node ci/ios-signed/run.mjs ' + s));
  assert.deepEqual(w.artifacts, ['.native-validation/signed/export/*.ipa', '.native-validation/signed/reports/*.json']);
  const runner = fs.readFileSync('ci/ios-signed/validate.mjs', 'utf8');
  assert.doesNotMatch(runner, /-allowProvisioningUpdates|fetch-signing-files|create-certificate|submit_to_testflight|['"](?:altool|pilot|deliver|build-ipa)['"]/);
  assert.ok(runner.includes("process.env.CM_TRIGGER_SOURCE, 'api'"));
});

test('signed artifact version policy accepts only marketing 1.0 and build 23', () => {
  assert.doesNotThrow(() => validateSignedApp(app()));
  for (const build of ['1', '22', '24']) {
    const a = app(); a.info.CFBundleVersion = build;
    assert.throws(() => validateSignedApp(a), /Unreviewed build-number change/);
  }
  const missingBuild = app(); delete missingBuild.info.CFBundleVersion;
  assert.throws(() => validateSignedApp(missingBuild), /Unreviewed build-number change/);
  for (const version of ['0.9', '1.0.0', '1.1', '2.0', '', undefined]) {
    const a = app(); a.info.CFBundleShortVersionString = version;
    assert.throws(() => validateSignedApp(a), /Unreviewed version change/);
  }
  const missingVersion = app(); delete missingVersion.info.CFBundleShortVersionString;
  assert.throws(() => validateSignedApp(missingVersion), /Unreviewed version change/);
});

test('App Debug and Release settings resolve plist versions accepted by signed policy', () => {
  const project = fs.readFileSync('ios/App/App.xcodeproj/project.pbxproj', 'utf8');
  const plist = fs.readFileSync('ios/App/App/Info.plist', 'utf8');
  for (const [key, variable] of [['CFBundleShortVersionString', 'MARKETING_VERSION'], ['CFBundleVersion', 'CURRENT_PROJECT_VERSION'], ['CFBundleIdentifier', 'PRODUCT_BUNDLE_IDENTIFIER']]) {
    const afterKey = plist.split('<key>' + key + '</key>');
    assert.equal(afterKey.length, 2);
    assert.equal(afterKey[1].trimStart().split('</string>')[0], '<string>$(' + variable + ')');
  }
  for (const [id, name] of [['504EC3171FED79650016851F', 'Debug'], ['504EC3181FED79650016851F', 'Release']]) {
    const start = project.indexOf(id + ' /* ' + name + ' */ = {');
    assert.ok(start >= 0, 'Missing App ' + name + ' configuration');
    const block = project.slice(start, project.indexOf('name = ' + name + ';', start));
    const setting = key => {
      const parts = block.split(key + ' = ');
      assert.equal(parts.length, 2, 'Expected one ' + key + ' in App ' + name);
      return parts[1].split(';')[0];
    };
    assert.equal(setting('CURRENT_PROJECT_VERSION'), '23');
    assert.equal(setting('MARKETING_VERSION'), '1.0');
    assert.equal(setting('PRODUCT_BUNDLE_IDENTIFIER'), policy.bundleId);
    const a = app();
    a.info.CFBundleVersion = setting('CURRENT_PROJECT_VERSION');
    a.info.CFBundleShortVersionString = setting('MARKETING_VERSION');
    a.info.CFBundleIdentifier = setting('PRODUCT_BUNDLE_IDENTIFIER');
    assert.doesNotThrow(() => validateSignedApp(a));
  }
});
