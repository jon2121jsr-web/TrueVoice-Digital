import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { sanitize, verifySource } from '../ci/native-validation/validate.mjs';
const require = createRequire(import.meta.url);
const yaml = require('js-yaml');

test('candidate YAML has only manual, branch-restricted unsigned validation, with no publishing credentials', () => {
  const document = yaml.load(fs.readFileSync('ci/native-validation/codemagic.yaml', 'utf8'));
  assert.deepEqual(Object.keys(document.workflows), ['ios-native-validation']);
  const w = document.workflows['ios-native-validation'];
  assert.equal(w.when.condition, 'env.CM_BRANCH == "ci/ios-native-validation-1b03b"');
  for (const key of ['triggering', 'publishing', 'integrations']) assert.equal(w[key], undefined);
  assert.equal(w.environment.groups, undefined);
  assert.equal(w.environment.ios_signing, undefined);
  assert.equal(w.environment.xcode, '26.2');
  assert.equal(w.environment.node, '24.14.0');
  assert.equal(w.environment.vars.VITE_SUPABASE_URL, 'https://native-validation.invalid');
  assert.deepEqual(w.scripts.map(s => s.script.split(' ').at(-1)), ['preflight', 'dependencies', 'swift-tests', 'web-build', 'sync', 'compile']);
  assert.ok(w.artifacts.every(p => /\/(logs|reports)\/\*\.(log|json)$/.test(p)));
});

test('runner compiles only unsigned simulator Debug builds and does not launch or distribute an app', () => {
  const source = fs.readFileSync('ci/native-validation/validate.mjs', 'utf8');
  for (const option of ["'-sdk', 'iphonesimulator'", "'-configuration', 'Debug'", 'CODE_SIGNING_ALLOWED=NO', 'CODE_SIGNING_REQUIRED=NO', 'CODE_SIGN_IDENTITY=', 'DEVELOPMENT_TEAM=']) assert.ok(source.includes(option));
  assert.doesNotMatch(source, /['"](?:archive|-exportArchive|build-ipa|altool|pilot|deliver)['"]|simctl.*launch/);
  assert.ok(source.includes('Executed 7 tests, with 0 failures'));
});

test('log sanitizer removes authentication material without printing it', () => {
  const fixture = ['Authorization: Bearer offline-private-fixture', 'https://user:password@example.invalid/repo', '-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----'].join('\n');
  const clean = sanitize(fixture);
  for (const value of ['offline-private-fixture', 'user:password', '\nfixture\n']) assert.ok(!clean.includes(value));
});

test('transfer verification rejects omitted files and mismatched bytes', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'native-ci-manifest-'));
  try {
    const file = path.join(temp, 'manifest.json');
    fs.writeFileSync(file, JSON.stringify({ entries: [{ path: 'missing.swift', sha256: '0'.repeat(64) }] }));
    assert.throws(() => verifySource(temp, file), /Missing source/);
    fs.writeFileSync(path.join(temp, 'missing.swift'), 'changed');
    assert.throws(() => verifySource(temp, file), /Source mismatch/);
  } finally {
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
