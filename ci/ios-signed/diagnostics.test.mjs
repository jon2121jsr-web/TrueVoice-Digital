import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createDiagnostics } from './diagnostics.mjs';
import { verifyConfiguredProject } from './validate.mjs';
import { policy, assertSigningOnlyChanges } from './policy.mjs';

const marker = 'SENSITIVE_FIXTURE_DO_NOT_LOG';
const id = 'A'.repeat(24), config = 'B'.repeat(24), list = 'C'.repeat(24);
function project() {
  return { objects: {
    [id]: { isa: 'PBXNativeTarget', name: 'App', buildConfigurationList: list },
    [list]: { buildConfigurations: [config] },
    [config]: { name: 'Release', buildSettings: { DEVELOPMENT_TEAM: policy.team, CODE_SIGN_STYLE: 'Manual', PROVISIONING_PROFILE_SPECIFIER: 'offline-profile' } },
  } };
}
const assets = { profile: { uuid: 'offline-uuid', name: 'offline-profile' } };
function fixture(action) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pulse-diag-'));
  const logs = [], diagnostic = createDiagnostics({ directory, step: 'archive-export', log: line => logs.push(line) });
  const read = () => JSON.parse(fs.readFileSync(path.join(directory, 'archive-export-diagnostics.json')));
  const processes = () => JSON.parse(fs.readFileSync(path.join(directory, 'archive-export-steps.json')));
  try {
    action({ directory, logs, diagnostic, read, processes });
    assert.ok(!JSON.stringify([read(), processes(), logs]).includes(marker), 'Sensitive marker leaked');
  } finally { fs.rmSync(directory, { recursive: true }); }
}
function configuredFailure(code, mutate) {
  fixture(({ diagnostic, read, processes }) => {
    const after = project(); mutate(after);
    // Same before/after isolates structural/config assertions from mutation guard.
    const exit = diagnostic.execute(() => verifyConfiguredProject(after, JSON.stringify(after), assets, diagnostic, () => {}));
    assert.equal(exit, 1); assert.equal(read().failure.code, code);
    assert.equal(processes().length, 0, 'Archive must not be launched');
  });
}

test('configured project succeeds with all diagnostic stages and no process launch', () => {
  fixture(({ diagnostic, read }) => {
    let checked = false;
    const before = project(), after = structuredClone(before);
    before.objects[config].buildSettings.CODE_SIGN_STYLE = 'Automatic';
    assert.equal(diagnostic.execute(() => assert.equal(verifyConfiguredProject(before, JSON.stringify(after), assets, diagnostic, () => { checked = true; }), 1)), 0);
    assert.equal(checked, true); assert.equal(read().failure, undefined);
    assert.deepEqual(read().events.filter(e => e.status === 'completed').map(e => e.code), ['POST_CONFIG_JSON', 'PROJECT_MUTATIONS', 'APP_TARGET', 'RELEASE_CONFIG', 'TEAM', 'SIGNING_STYLE', 'PROFILE_SPECIFIER', 'NATIVE_INTEGRITY', 'RUNNER']);
  });
});

test('rejected mutations emit only safe paths and change types before archive', () => {
  fixture(({ diagnostic, read, processes }) => {
    const before = project(), after = structuredClone(before);
    after.objects[config].buildSettings.PRODUCT_BUNDLE_IDENTIFIER = marker;
    after.objects[config].buildSettings[marker] = marker;
    assert.equal(diagnostic.execute(() => verifyConfiguredProject(before, JSON.stringify(after), assets, diagnostic, () => {})), 1);
    assert.equal(read().failure.code, 'PROJECT_MUTATIONS');
    const changes = read().events.find(e => e.status === 'rejected').changes;
    assert.equal(changes.length, 2);
    assert.deepEqual(changes.map(c => Object.keys(c).sort()), [['changeType', 'path'], ['changeType', 'path']]);
    assert.equal(changes[0].path, 'objects.' + config + '.buildSettings.PRODUCT_BUNDLE_IDENTIFIER');
    assert.equal(changes[0].changeType, 'added');
    assert.ok(changes[1].path.endsWith('[redacted-key]'));
    assert.equal(processes().length, 0);
  });
});

test('invalid post-configuration JSON produces redacted report without archive attempt', () => {
  fixture(({ diagnostic, read, processes }) => {
    assert.equal(diagnostic.execute(() => verifyConfiguredProject(project(), '{' + marker, assets, diagnostic, () => {})), 1);
    assert.deepEqual(read().failure, { code: 'POST_CONFIG_JSON', classification: 'INVALID_JSON' });
    assert.equal(processes().length, 0);
  });
});

test('missing App target is diagnosed', () => configuredFailure('APP_TARGET', p => { p.objects[id].name = marker; }));
test('missing Release configuration is diagnosed', () => configuredFailure('RELEASE_CONFIG', p => { p.objects[config].name = marker; }));
test('malformed Release configuration lookup is diagnosed', () => configuredFailure('RELEASE_CONFIG', p => { p.objects[id].buildConfigurationList = marker; }));
test('incorrect team is diagnosed without printing assertion values', () => configuredFailure('TEAM', p => { p.objects[config].buildSettings.DEVELOPMENT_TEAM = marker; }));
test('incorrect signing style is diagnosed', () => configuredFailure('SIGNING_STYLE', p => { p.objects[config].buildSettings.CODE_SIGN_STYLE = marker; }));
test('incorrect profile specifier is diagnosed', () => configuredFailure('PROFILE_SPECIFIER', p => { p.objects[config].buildSettings.PROVISIONING_PROFILE_SPECIFIER = marker; }));

test('unexpected JavaScript exception and native integrity failures retain stage codes', () => {
  fixture(({ diagnostic, read }) => {
    assert.equal(diagnostic.execute(() => verifyConfiguredProject(project(), JSON.stringify(project()), assets, diagnostic, () => { throw new Error(marker); })), 1);
    assert.deepEqual(read().failure, { code: 'NATIVE_INTEGRITY', classification: 'JS_EXCEPTION' });
  });
  fixture(({ diagnostic, read }) => {
    assert.equal(diagnostic.execute(() => { throw new Error(marker); }), 1);
    assert.deepEqual(read().failure, { code: 'RUNNER', classification: 'JS_EXCEPTION' });
  });
});

test('subprocess attempt is persisted before launch; missing executable fails closed', () => {
  fixture(({ directory, diagnostic, read, processes }) => {
    const exit = diagnostic.execute(() => diagnostic.stage('ARCHIVE_LAUNCH', () => diagnostic.process('offline-launch', () => {
      assert.equal(processes()[0].status, 'attempted');
      assert.equal(processes()[0].exitCode, null);
      return spawnSync(path.join(directory, 'missing-executable'), [], { encoding: 'utf8' });
    })));
    assert.equal(exit, 1);
    assert.deepEqual(read().failure, { code: 'ARCHIVE_LAUNCH', classification: 'EXECUTABLE_NOT_FOUND' });
    assert.equal(processes()[0].completed, false);
  });
});

test('process completion, nonzero status and thrown launch exception are redacted', () => {
  fixture(({ diagnostic, processes }) => {
    assert.equal(diagnostic.execute(() => diagnostic.process('offline-success', () => ({ status: 0, signal: null, stdout: marker }))), 0);
    assert.equal(processes()[0].completed, true);
  });
  fixture(({ diagnostic, processes }) => {
    assert.equal(diagnostic.execute(() => diagnostic.process('offline-nonzero', () => ({ status: 37, signal: null, stderr: marker }))), 37);
    assert.equal(processes()[0].classification, 'NONZERO_EXIT');
  });
  fixture(({ diagnostic, read }) => {
    assert.equal(diagnostic.execute(() => diagnostic.process('offline-throw', () => { throw new Error(marker); })), 1);
    assert.equal(read().failure.classification, 'LAUNCH_EXCEPTION');
  });
});

test('project mutation accept/reject behavior matches the approved complete allowlist', () => {
  const source = execFileSync('git', ['show', '99865d08185c119c47d7273fdcd610da6c9a07c8:ci/ios-signed/policy.mjs'], { encoding: 'utf8' });
  const original = new Function('assert', source.slice(source.indexOf('export function assertSigningOnlyChanges')).replace('export function', 'function') + '; return assertSigningOnlyChanges;')(assert);
  for (const setting of ['CODE_SIGN_STYLE', 'DEVELOPMENT_TEAM', 'CODE_SIGN_IDENTITY', 'PROVISIONING_PROFILE', 'PROVISIONING_PROFILE_SPECIFIER', 'PRODUCT_BUNDLE_IDENTIFIER', 'CODE_SIGN_ENTITLEMENTS', 'CODE_SIGNING_ALLOWED']) {
    for (const suffix of ['', '[sdk=iphoneos*]', '[sdk=iphonesimulator*]']) {
      const before = project(), after = structuredClone(before);
      after.objects[config].buildSettings[setting + suffix] = marker;
      const accepts = fn => { try { fn(before, after); return true; } catch { return false; } };
      assert.equal(accepts(assertSigningOnlyChanges), accepts(original));
    }
  }
  for (const key of ['ProvisioningStyle', 'DevelopmentTeam', 'DevelopmentTeamName', 'CreatedOnToolsVersion']) {
    const before = { objects: { [id]: { attributes: { TargetAttributes: { [config]: {} } } } } }, after = structuredClone(before);
    after.objects[id].attributes.TargetAttributes[config][key] = marker;
    const accepts = fn => { try { fn(before, after); return true; } catch { return false; } };
    assert.equal(accepts(assertSigningOnlyChanges), accepts(original));
  }
});
