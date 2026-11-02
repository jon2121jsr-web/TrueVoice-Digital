import fs from 'node:fs';
import assert from 'node:assert/strict';
import { validateRuntime } from '../ios-release/validate.mjs';

export const policy = Object.freeze(JSON.parse(fs.readFileSync(new URL('./policy.json', import.meta.url))));
export function assertSelection(branch, workflow) {
  assert.equal(branch, policy.branch, 'Wrong signed-validation branch');
  assert.equal(workflow, policy.workflow, 'Wrong signed-validation workflow');
}

export function validateSignedEnvironment(env, runtimeProfile) {
  const publicNames = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  const pathNames = ['PULSE_SIGNING_PROFILE_PATH', 'CM_CERTIFICATE_PATH', 'CM_PROVISIONING_PROFILE_PATH'];
  for (const [name, value] of Object.entries(env)) {
    if (!value) continue;
    assert.ok(!name.startsWith('VITE_') || publicNames.includes(name), 'Unexpected public override');
    assert.doesNotMatch(name, /^(SUPABASE_SERVICE.*|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|FIREBASE_SERVICE_ACCOUNT_JSON|YOUTUBE_API_KEY|AZURACAST_API_KEY|VERCEL_TOKEN|APP_STORE_CONNECT_.*|XCODE_XCCONFIG_FILE|XCODE_PROJECT_.*|CODE_SIGN_.*|DEVELOPMENT_TEAM|PROVISIONING_PROFILE.*)$/);
    if (/(?:SIGNING|CERTIFICATE|PROVISIONING|PRIVATE_KEY|KEYCHAIN_PASSWORD|P12_PASSWORD)/.test(name)) {
      assert.ok(pathNames.includes(name), 'Unexpected signing input');
    }
  }
  assert.ok(env.PULSE_SIGNING_PROFILE_PATH, 'Approved profile path is required');
  // Full signed environment is checked above; reuse the unchanged public-pair
  // fingerprint/role/expiry validation on its explicit two-value input contract.
  validateRuntime(Object.fromEntries(publicNames.map(name => [name, env[name]])), runtimeProfile);
}

export function childEnvironment(env) {
  const allowed = ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'LC_ALL', 'DEVELOPER_DIR', 'SDKROOT', 'CI', 'CM_BUILD_DIR'];
  const result = Object.fromEntries(allowed.filter(name => env[name] !== undefined).map(name => [name, env[name]]));
  for (const name of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']) result[name] = env[name];
  return result;
}

export function validateProfile(p, now = Date.now()) {
  assert.ok(p.uuid && p.name, 'Profile identity missing');
  assert.deepEqual(p.teams, [policy.team], 'Profile team mismatch');
  assert.deepEqual(p.prefixes, [policy.team], 'Unexpected application prefix');
  assert.ok(p.platforms.includes('iOS'), 'Profile platform mismatch');
  assert.ok(Date.parse(p.expires) > now, 'Profile expired');
  assert.ok(Date.parse(p.created) <= now, 'Profile creation date invalid');
  assert.equal(p.hasDevices, false, 'Device-list profiles are not App Store profiles');
  assert.equal(p.allDevices, false, 'Enterprise profile prohibited');
  assert.equal(p.entitlements['application-identifier'], policy.team + '.' + policy.bundleId);
  assert.equal(p.entitlements['com.apple.developer.team-identifier'], policy.team);
  assert.equal(p.entitlements['get-task-allow'], false);
  assert.equal(p.entitlements['beta-reports-active'], true, 'App Store beta entitlement required');
  assert.ok(p.certificateSha1.length > 0);
  for (const value of p.certificateSha1) assert.match(value, /^[A-F0-9]{40}$/);
  return p;
}

export function selectIdentity(profile, identities) {
  const matches = identities.filter(i => profile.certificateSha1.includes(i.sha1)
    && /^(Apple Distribution|iPhone Distribution): /.test(i.name)
    && i.name.endsWith('(' + policy.team + ')'));
  assert.equal(matches.length, 1, 'Exactly one valid matching distribution identity is required');
  return matches[0];
}

function authorized(actual, permitted) {
  if (Array.isArray(actual)) return Array.isArray(permitted) && actual.every(a => permitted.some(p => authorized(a, p)));
  if (Array.isArray(permitted)) return permitted.some(p => authorized(actual, p));
  if (actual && typeof actual === 'object') return permitted && typeof permitted === 'object'
    && Object.entries(actual).every(([k, v]) => Object.hasOwn(permitted, k) && authorized(v, permitted[k]));
  if (typeof actual === 'string' && typeof permitted === 'string') {
    const escaped = permitted.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp('^' + escaped + '$').test(actual);
  }
  return actual === permitted;
}

export function validateSignedApp({ info, signature, entitlements, profile, identity, embeddedHash, selectedHash }) {
  assert.equal(info.CFBundleIdentifier, policy.bundleId);
  assert.ok(info.UIBackgroundModes?.includes('audio'));
  assert.equal(info.CFBundleShortVersionString, '1.0', 'Unreviewed version change');
  assert.equal(String(info.CFBundleVersion), '23', 'Unreviewed build-number change');
  assert.equal(signature.team, policy.team);
  assert.equal(signature.identifier, policy.bundleId);
  assert.equal(signature.leafSha1, identity.sha1, 'Signature certificate mismatch');
  assert.equal(embeddedHash, selectedHash, 'Embedded profile differs from selected asset');
  assert.equal(entitlements['application-identifier'], policy.team + '.' + policy.bundleId);
  assert.equal(entitlements['com.apple.developer.team-identifier'], policy.team);
  assert.equal(entitlements['get-task-allow'], false);
  assert.equal(entitlements['beta-reports-active'], true);
  assert.ok(authorized(entitlements, profile.entitlements), 'Unauthorized entitlement');
  return { teamMatches: true, bundleMatches: true, identityMatches: true, embeddedProfileMatches: true, entitlementsAuthorized: true };
}

export function exportOptions(profile, identity) {
  return {
    method: policy.exportMethod, destination: 'export', teamID: policy.team,
    signingStyle: 'manual', signingCertificate: identity.sha1,
    provisioningProfiles: { [policy.bundleId]: profile.uuid },
    manageAppVersionAndBuildNumber: false, uploadSymbols: false,
  };
}

export function assertSigningOnlyChanges(before, after, onRejected = () => {}) {
  const paths = [];
  const visit = (a, b, prefix = []) => {
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) visit(a[key], b[key], [...prefix, key]);
    } else paths.push({ path: prefix, changeType: a === undefined ? 'added' : b === undefined ? 'removed' : 'modified' });
  };
  visit(before, after);
  const rejected = [];
  for (const change of paths) {
    const parts = change.path;
    const setting = parts.at(-1).replace(/\[sdk=iphoneos\*\]$/, '');
    const buildSetting = parts.length === 4 && parts[0] === 'objects' && parts[2] === 'buildSettings'
      && ['CODE_SIGN_STYLE', 'DEVELOPMENT_TEAM', 'CODE_SIGN_IDENTITY', 'PROVISIONING_PROFILE', 'PROVISIONING_PROFILE_SPECIFIER'].includes(setting);
    const targetAttribute = parts.length === 6 && parts[0] === 'objects' && parts[2] === 'attributes'
      && parts[3] === 'TargetAttributes' && ['ProvisioningStyle', 'DevelopmentTeam'].includes(setting);
    const projectId = '504EC2FC1FED79650016851F';
    const original = before.objects?.[projectId], replacement = after.objects?.[projectId];
    const emptyPackageReferenceOmission = parts.length === 3 && parts[0] === 'objects'
      && parts[1] === projectId && parts[2] === 'packageReferences' && change.changeType === 'removed'
      && before.rootObject === projectId && after.rootObject === projectId
      && original?.isa === 'PBXProject' && replacement?.isa === 'PBXProject'
      && Object.hasOwn(original, 'packageReferences') && Array.isArray(original.packageReferences)
      && original.packageReferences.length === 0 && !Object.hasOwn(replacement, 'packageReferences');
    if (!(buildSetting || targetAttribute || emptyPackageReferenceOmission)) rejected.push(change);
  }
  if (rejected.length) onRejected(rejected);
  assert.ok(rejected.length === 0, 'Unexpected project mutation');
  return paths.length;
}
