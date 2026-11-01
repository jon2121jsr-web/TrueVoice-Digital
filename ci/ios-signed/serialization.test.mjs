import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSigningOnlyChanges } from './policy.mjs';

const id = '504EC2FC1FED79650016851F';
function omitted() {
  const before = { rootObject: id, objects: { [id]: { isa: 'PBXProject', packageReferences: [] } } };
  const after = structuredClone(before); delete after.objects[id].packageReferences;
  return { before, after };
}
function reject(change) {
  const pair = omitted(); change(pair);
  assert.throws(() => assertSigningOnlyChanges(pair.before, pair.after), /Unexpected project mutation/);
}

test('only expected root PBXProject empty packageReferences omission is accepted', () => {
  const { before, after } = omitted();
  assert.equal(assertSigningOnlyChanges(before, after), 1);
  assert.equal(assertSigningOnlyChanges(before, structuredClone(before)), 0);
  assert.equal(assertSigningOnlyChanges(after, structuredClone(after)), 0);
});

test('nonempty remote and local package dependencies cannot be removed', () => {
  for (const isa of ['XCRemoteSwiftPackageReference', 'XCLocalSwiftPackageReference']) {
    reject(({ before, after }) => {
      before.objects[id].packageReferences = ['DEPENDENCY'];
      before.objects.DEPENDENCY = { isa, ...(isa === 'XCRemoteSwiftPackageReference' ? { repositoryURL: 'https://offline.invalid/package.git', requirement: { kind: 'exactVersion', version: '1.0.0' } } : { relativePath: '../OfflinePackage' }) };
      after.objects.DEPENDENCY = structuredClone(before.objects.DEPENDENCY);
    });
  }
});

test('malformed original values are not treated as empty arrays', () => {
  for (const value of [null, '', '[]', {}, 0, false, ['DEPENDENCY']]) reject(({ before }) => { before.objects[id].packageReferences = value; });
});

test('replacements, nulling and additions remain rejected', () => {
  for (const value of [null, '', {}, ['DEPENDENCY'], undefined]) reject(({ after }) => { after.objects[id].packageReferences = value; });
  reject(({ before, after }) => { delete before.objects[id].packageReferences; after.objects[id].packageReferences = []; });
  reject(({ before, after }) => { before.objects[id].packageReferences = ['DEPENDENCY']; after.objects[id].packageReferences = []; });
});

test('same property removal on another project object is rejected', () => {
  reject(({ before, after }) => {
    before.objects.OTHER = before.objects[id]; delete before.objects[id];
    after.objects.OTHER = after.objects[id]; delete after.objects[id];
    before.rootObject = 'OTHER'; after.rootObject = 'OTHER';
  });
});

test('both roots must identify the expected project object', () => {
  for (const roots of [[undefined, undefined], ['OTHER', 'OTHER'], [id, 'OTHER'], ['OTHER', id]]) {
    reject(({ before, after }) => { before.rootObject = roots[0]; after.rootObject = roots[1]; });
  }
});

test('object type must remain PBXProject on both sides', () => {
  for (const types of [['PBXNativeTarget', 'PBXNativeTarget'], ['PBXProject', 'PBXNativeTarget'], ['PBXNativeTarget', 'PBXProject'], [undefined, undefined]]) {
    reject(({ before, after }) => { before.objects[id].isa = types[0]; after.objects[id].isa = types[1]; });
  }
});

test('other property names and nested lookalike paths remain rejected', () => {
  for (const key of ['packageProductDependencies', 'PackageReferences']) {
    reject(({ before, after }) => { before.objects[id][key] = []; delete before.objects[id].packageReferences; delete after.objects[id][key]; });
  }
  reject(({ before, after }) => {
    before.objects[id].buildSettings = { packageReferences: [] };
    after.objects[id].buildSettings = {};
  });
});

test('allowed omission never masks any accompanying unauthorized mutation', () => {
  for (const key of ['PRODUCT_BUNDLE_IDENTIFIER', 'CODE_SIGN_ENTITLEMENTS', 'CODE_SIGNING_ALLOWED', 'SWIFT_VERSION']) {
    reject(({ before, after }) => {
      before.objects.CONFIG = { buildSettings: { [key]: 'original' } };
      after.objects.CONFIG = { buildSettings: { [key]: 'replacement' } };
    });
  }
  reject(({ before, after }) => { before.objects[id].targets = ['APP']; after.objects[id].targets = []; });
  const { before, after } = omitted(), rejected = [];
  before.objects.CONFIG = { buildSettings: { PRODUCT_BUNDLE_IDENTIFIER: 'original' } };
  after.objects.CONFIG = { buildSettings: { PRODUCT_BUNDLE_IDENTIFIER: 'replacement' } };
  assert.throws(() => assertSigningOnlyChanges(before, after, changes => rejected.push(...changes)));
  assert.deepEqual(rejected.map(c => c.path), [['objects', 'CONFIG', 'buildSettings', 'PRODUCT_BUNDLE_IDENTIFIER']]);
});

test('existing allowed signing mutations still work alongside the exact omission', () => {
  const { before, after } = omitted();
  before.objects.CONFIG = { buildSettings: { CODE_SIGN_STYLE: 'Automatic' } };
  after.objects.CONFIG = { buildSettings: { CODE_SIGN_STYLE: 'Manual' } };
  assert.equal(assertSigningOnlyChanges(before, after), 2);
});
