// One manual delivery of the existing Build 23 IPA. No build/sign/export tools.
import assert from 'node:assert/strict';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const EXPECTED = Object.freeze({
  sha256: '8b23453a058269b33fbebd3b0a9edfe9b587d5f3e12c211c5311f3fbd1196269',
  bundle: 'digital.truevoice.app', version: '1.0', build: '23',
  originalBuild: '6ae80050efa74786046ff485',
  sourceCommit: '9ff573ce27b136a755eca332e3a1b90e0e18d4a0',
});
const ASC = 'https://api.appstoreconnect.apple.com';
const MAX_IPA_BYTES = 256 * 1024 * 1024;

// Diagnostic only: never resolve references or change the credential value.
export function classifyPrivateKey(value) {
  if (!value) return 'MISSING_OR_EMPTY';
  if (value.includes('-----BEGIN PRIVATE KEY-----')) return 'PEM_TEXT';
  if (value.startsWith('@file:')) return 'FILE_REFERENCE';
  if (value.startsWith('@env:')) return 'ENV_REFERENCE';
  const encoded = value.replace(/\s/g, '');
  if (encoded.length % 4 === 0 &&
      /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded) &&
      Buffer.from(encoded, 'base64').toString('utf8').includes('-----BEGIN PRIVATE KEY-----')) {
    return 'BASE64_ENCODED_PEM';
  }
  return 'OTHER_UNRECOGNIZED';
}

export function resolvePrivateKey(value) {
  try {
    assert.equal(typeof value, 'string');
    let pem = value;
    if (value.startsWith('@file:')) {
      let filename = value.slice(6);
      assert.ok(filename && !/[\x00-\x1f\x7f]/.test(filename));
      // Match Codemagic's path expansion without invoking a shell.
      filename = filename.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
        (_, braced, plain) => {
          const expanded = process.env[braced || plain];
          assert.ok(expanded);
          return expanded;
        });
      if (filename.startsWith('~/')) filename = path.join(os.homedir(), filename.slice(2));
      assert.ok(!filename.startsWith('~') && !/[\x00-\x1f\x7f$]/.test(filename));
      // Open once, reject symlinks/special files, and bound the read on that descriptor.
      const descriptor = fs.openSync(filename,
        fs.constants.O_RDONLY | fs.constants.O_NONBLOCK | (fs.constants.O_NOFOLLOW || 0));
      try {
        const stat = fs.fstatSync(descriptor);
        assert.ok(stat.isFile() && stat.size > 0 && stat.size <= 16384);
        const bytes = Buffer.alloc(16385);
        let size = 0;
        while (size < bytes.length) {
          const count = fs.readSync(descriptor, bytes, size, bytes.length - size, null);
          if (!count) break;
          size += count;
        }
        assert.ok(size > 0 && size <= 16384);
        pem = bytes.subarray(0, size).toString('utf8');
      } finally { fs.closeSync(descriptor); }
    }
    assert.ok(pem.includes('-----BEGIN PRIVATE KEY-----'));
    const key = createPrivateKey(pem);
    assert.equal(key.asymmetricKeyType, 'ec');
    assert.equal(key.asymmetricKeyDetails.namedCurve, 'prime256v1');
    return pem;
  } catch {
    // Never allow filesystem or crypto exception details to expose credentials.
    throw new Error('Invalid Apple private key');
  }
}

export function verifyIdentity(info) {
  assert.equal(info.CFBundleIdentifier, EXPECTED.bundle);
  assert.equal(info.CFBundleShortVersionString, EXPECTED.version);
  assert.equal(info.CFBundleVersion, EXPECTED.build);
}

export async function fileHash(filename) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

export function secureUrl(value) {
  const url = new URL(value);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.username, '');
  assert.equal(url.password, '');
  assert.equal(url.hash, '');
  return url;
}

export async function download(url, filename, request = fetch) {
  // Bearer/presigned URL only. Never send a Codemagic or GitHub API token.
  const response = await request(secureUrl(url), {
    redirect: 'manual', signal: AbortSignal.timeout(120000),
  });
  assert.equal(response.status, 200); // Redirect/expiry/login response fails closed.
  assert.ok(response.body);
  const output = fs.openSync(filename, 'wx', 0o600);
  let size = 0;
  try {
    for await (const chunk of response.body) {
      size += chunk.length;
      assert.ok(size <= MAX_IPA_BYTES);
      let offset = 0;
      while (offset < chunk.length) {
        const written = fs.writeSync(output, chunk, offset, chunk.length - offset);
        assert.ok(written > 0);
        offset += written;
      }
    }
    assert.ok(size > 0);
  } finally { fs.closeSync(output); }
}

function jwt(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const body = encoded({ alg: 'ES256', kid: credentials.id, typ: 'JWT' }) + '.' +
    encoded({ iss: credentials.issuer, iat: now - 5, exp: now + 600, aud: 'appstoreconnect-v1' });
  const key = createPrivateKey(credentials.key);
  assert.equal(key.asymmetricKeyType, 'ec');
  assert.equal(key.asymmetricKeyDetails.namedCurve, 'prime256v1');
  return body + '.' + sign('sha256', Buffer.from(body), {
    key, dsaEncoding: 'ieee-p1363',
  }).toString('base64url');
}

async function appleGet(resource, credentials) {
  const url = new URL(resource, ASC);
  assert.equal(url.origin, ASC);
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer ' + jwt(credentials) },
    redirect: 'manual', signal: AbortSignal.timeout(60000),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(Array.isArray(result.data));
  return result;
}

export async function assertNotUploaded(credentials, get = appleGet) {
  const apps = await get('/v1/apps?' + new URLSearchParams({
    'filter[bundleId]': EXPECTED.bundle, limit: '200',
  }), credentials);
  assert.ok(!apps.links?.next);
  assert.equal(apps.data.length, 1);
  const app = apps.data[0];
  assert.equal(app.attributes.bundleId, EXPECTED.bundle);
  assert.match(app.id, /^\d+$/);
  const builds = await get('/v1/builds?' + new URLSearchParams({
    'filter[app]': app.id, 'filter[version]': EXPECTED.build, limit: '200',
  }), credentials);
  // All states and versions are considered: even a failed/expired 23 stops us.
  assert.equal(builds.data.length, 0);
  assert.ok(!builds.links?.next);
}

function inspectIpa(filename) {
  // Read only the main app's plist. Never extract or execute IPA contents.
  const program = `import json,plistlib,re,sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    matches=[i for i in z.infolist() if re.fullmatch(r'Payload/[^/]+\\.app/Info\\.plist',i.filename)]
    assert len(matches)==1 and matches[0].file_size < 2*1024*1024
    p=plistlib.loads(z.read(matches[0]))
    print(json.dumps({k:p.get(k) for k in ('CFBundleIdentifier','CFBundleShortVersionString','CFBundleVersion')}))
`;
  const result = spawnSync('python3', ['-I', '-c', program, filename], {
    encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024,
    env: { PATH: process.env.PATH },
  });
  assert.equal(result.status, 0);
  verifyIdentity(JSON.parse(result.stdout));
}

export async function main() {
  let stage = 'preflight: initialization';
  let directory;
  try {
    stage = 'preflight: macOS platform';
    assert.equal(process.platform, 'darwin');
    stage = 'preflight: release branch';
    assert.equal(process.env.CM_BRANCH, 'release/ios-testflight-1b04');
    stage = 'preflight: manual API trigger';
    assert.equal(process.env.CM_TRIGGER_SOURCE, 'api'); // UI manual starts use api.
    const credentials = {
      id: process.env.APP_STORE_CONNECT_KEY_IDENTIFIER,
      issuer: process.env.APP_STORE_CONNECT_ISSUER_ID,
      key: process.env.APP_STORE_CONNECT_PRIVATE_KEY,
    };
    stage = 'preflight: Apple key identifier';
    assert.match(credentials.id ?? '', /^[A-Za-z0-9]+$/);
    stage = 'preflight: Apple issuer identifier';
    assert.match(credentials.issuer ?? '', /^[0-9a-f-]{36}$/i);
    stage = 'preflight: Apple private-key format';
    console.log(classifyPrivateKey(credentials.key));
    credentials.key = resolvePrivateKey(credentials.key);
    assert.ok(credentials.key?.includes('-----BEGIN PRIVATE KEY-----'));
    stage = 'preflight: IPA download URL';
    const url = secureUrl(process.env.PULSE_BUILD23_IPA_URL);
    stage = 'preflight: forbidden personal API tokens';
    assert.ok(!process.env.CM_API_TOKEN && !process.env.CODEMAGIC_API_TOKEN);
    stage = 'preflight: private temporary directory';
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'truevoice-upload23-'));
    fs.chmodSync(directory, 0o700);
    const ipa = path.join(directory, 'App.ipa');
    stage = 'existing Apple build check';
    await assertNotUploaded(credentials);
    stage = 'private IPA download';
    await download(url.href, ipa);
    stage = 'IPA SHA-256 and identity verification';
    assert.equal(await fileHash(ipa), EXPECTED.sha256);
    inspectIpa(ipa);
    fs.chmodSync(ipa, 0o400);
    console.log('PASS: approved IPA SHA-256, bundle ID, version 1.0 and build 23.');
    // Key search is isolated to this temporary working directory, not user HOME.
    const keyDirectory = path.join(directory, 'private_keys');
    fs.mkdirSync(keyDirectory, { mode: 0o700 });
    fs.writeFileSync(path.join(keyDirectory, `AuthKey_${credentials.id}.p8`),
      credentials.key, { mode: 0o600, flag: 'wx' });
    const childEnvironment = { PATH: process.env.PATH };
    for (const name of ['HOME', 'TMPDIR', 'DEVELOPER_DIR', 'LANG']) {
      if (process.env[name]) childEnvironment[name] = process.env[name];
    }
    stage = 'Apple uploader availability';
    const available = spawnSync('xcrun', ['altool', '--version'], {
      cwd: directory, env: childEnvironment, stdio: 'pipe', timeout: 30000,
    });
    assert.equal(available.status, 0);
    stage = 'final duplicate and hash check';
    await assertNotUploaded(credentials);
    assert.equal(await fileHash(ipa), EXPECTED.sha256);
    stage = 'Apple upload';
    // Exactly one upload invocation. No CLI publishing wrapper, review, groups,
    // retries, signing, export, or arbitrary inherited publishing parameters.
    const result = spawnSync('xcrun', [
      'altool', '--upload-app', '--file', ipa, '--type', 'ios',
      '--apiKey', credentials.id, '--apiIssuer', credentials.issuer,
    ], { cwd: directory, env: childEnvironment, stdio: 'pipe',
      timeout: 20 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 });
    assert.equal(result.status, 0);
    console.log('PASS: Apple uploader returned success. Verify processing in App Store Connect.');
    console.log('STOP: no review submission or tester-group assignment was requested.');
  } catch {
    // Never print raw errors, response bodies, URLs, keys, or uploader output.
    console.error(`STOP: ${stage} failed.`);
    process.exitCode = 1;
  } finally {
    if (directory) {
      try { fs.rmSync(directory, { recursive: true, force: true }); }
      catch { console.error('Temporary cleanup failed; inspect the disposable runner.'); process.exitCode = 1; }
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
