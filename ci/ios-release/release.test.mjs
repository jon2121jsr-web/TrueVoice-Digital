import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { assertReleaseBranch, validateRuntime, verifyReleaseSource } from './validate.mjs';
const yaml = createRequire(import.meta.url)('js-yaml');
test('release accepts only its branch and verifies the preparation inventory', () => {
  assert.doesNotThrow(() => assertReleaseBranch('release/ios-testflight-1b04'));
  for (const value of [undefined, 'main', 'ci/ios-native-validation-1b03f']) assert.throws(() => assertReleaseBranch(value));
  assert.equal(verifyReleaseSource({ localPreparation: true }).baseline, '1c3ebb18eee5151c47d844ea97100651624c98e6');
});
test('missing, placeholder, unexpected or private runtime inputs fail closed', () => {
  assert.throws(() => validateRuntime({}), /Supply/);
  assert.throws(() => validateRuntime({ VITE_SUPABASE_URL: 'https://native-validation.invalid', VITE_SUPABASE_ANON_KEY: 'fixture' }), /differs/);
  const url = 'https://offlinefixture.supabase.co';
  const key = 'offline.' + Buffer.from(JSON.stringify({ role: 'anon', ref: 'offlinefixture' })).toString('base64url') + '.test';
  const env = { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: key };
  const profile = { publicPairSha256: createHash('sha256').update(url + '\n' + key).digest('hex') };
  assert.doesNotThrow(() => validateRuntime(env, profile));
  assert.throws(() => validateRuntime({ ...env, VITE_UNREVIEWED: 'offline' }, profile), /Unexpected public build override/);
  assert.throws(() => validateRuntime({ ...env, STRIPE_SECRET_KEY: 'offline' }, profile), /Remove private or signing input/);
});
test('new workflow is manual and unsigned; original validation workflow remains isolated', () => {
  const root = yaml.load(fs.readFileSync('codemagic.yaml', 'utf8'));
  assert.deepEqual(Object.keys(root.workflows), ['ios-native-validation', 'ios-release-archive-validation']);
  const original = yaml.load(fs.readFileSync('ci/native-validation/codemagic.yaml', 'utf8'));
  assert.deepEqual(root.workflows['ios-native-validation'], original.workflows['ios-native-validation']);
  const w = root.workflows['ios-release-archive-validation'];
  assert.equal(w.when.condition, 'env.CM_BRANCH == "release/ios-testflight-1b04"');
  const inspect = value => {
    for (const [key, child] of Object.entries(value ?? {})) {
      if (key === 'groups') {
        assert.strictEqual(value, w.environment, 'Group imports are allowed only on the release environment');
        assert.deepEqual(child, ['pulse_ios_public_runtime']);
      } else {
        assert.doesNotMatch(key, /^(triggering|events|publishing|integrations|ios_signing|certificates|provisioning_profiles)$/);
      }
      if (child && typeof child === 'object') inspect(child);
    }
  };
  inspect(root);
  assert.equal(w.environment.xcode, '26.2');
  assert.equal(w.environment.node, '24.14.0');
  assert.equal(w.environment.cocoapods, '1.16.2');
  assert.deepEqual(w.environment.groups, ['pulse_ios_public_runtime']);
  assert.equal(w.environment.vars, undefined);
  assert.deepEqual(w.scripts.map(s => s.script.split(' ').at(-1)), ['preflight', 'dependencies', 'swift-tests', 'web-build', 'sync', 'archive']);
  assert.ok(w.artifacts.every(p => /\/(logs|reports)\/\*\.(log|json)$/.test(p)));
  const runner = fs.readFileSync('ci/ios-release/validate.mjs', 'utf8');
  for (const flag of ['CODE_SIGNING_ALLOWED=NO', 'CODE_SIGNING_REQUIRED=NO', 'CODE_SIGN_IDENTITY=', 'DEVELOPMENT_TEAM=']) assert.ok(runner.includes(flag));
  assert.doesNotMatch(runner, /['"](?:-exportArchive|build-ipa|altool|pilot|deliver)['"]|submit_to_testflight/);
});
