// Local preparation only. Never commits/pushes/triggers CI or copies credential files.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = path.resolve(root, '../ci-preparation/source');
const audit = path.dirname(out);
const hash = data => createHash('sha256').update(data).digest('hex');
const git = args => {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 20 * 1024 * 1024 });
  assert.equal(r.status, 0, 'Read-only Git inventory failed');
  return r.stdout;
};
function signals(name, data) {
  const found = [];
  if (/(^|\/)(\.env(?:\..*)?|auth\.json)$|\.(?:p8|p12|mobileprovision|pem|key)$/i.test(name)) found.push('credential-or-environment-file');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(data); } catch { return found; }
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]{64,}-----END/.test(text)) found.push('private-key');
  if (/\bAIza[A-Za-z0-9_-]{35}\b/.test(text)) found.push('google-api-key');
  if (/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/.test(text)) found.push('aws-access-key');
  if (/\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/.test(text)) found.push('stripe-secret-key');
  for (const token of text.matchAll(/\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+\b/g)) {
    try { if (JSON.parse(Buffer.from(token[1], 'base64url')).role === 'service_role') found.push('service-role-jwt'); } catch { /* not a JWT */ }
  }
  return [...new Set(found)];
}
function normalized(data) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(data);
    if (!text.includes('\0')) return Buffer.from(text.replace(/\r\n/g, '\n'));
  } catch { /* Preserve binary bytes. */ }
  return data;
}

process.chdir(root);
assert.equal(git(['branch', '--show-current']).trim(), 'fix/native-ios-1b02a', 'Wrong preparation worktree');
const stageB = JSON.parse(fs.readFileSync('../stage-b-audit/stage-b-manifest.json'));
for (const entry of stageB.entries) assert.equal(hash(fs.readFileSync(entry.path)), entry.sha256, `Stage B drift: ${entry.path}`);
assert.ok(!fs.existsSync(out), 'Snapshot already exists; do not overwrite a reviewed snapshot');
const files = [...new Set(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean))].sort();
const ignored = git(['ls-files', '--others', '--ignored', '--exclude-standard', '-z']).split('\0').filter(Boolean);
const excluded = [], findings = [], candidates = new Map();
for (const name of [...files, ...ignored]) {
  const data = fs.readFileSync(name), flags = signals(name, data);
  if (flags.length) findings.push({ path: name, signals: flags, ignored: ignored.includes(name) });
  if (ignored.includes(name)) continue;
  assert.ok(!path.isAbsolute(name) && !name.split(/[\\/]/).includes('..'), 'Invalid Git path');
  if (flags.includes('credential-or-environment-file')) { excluded.push({ path: name, reason: 'Do not transfer environment/credential files' }); continue; }
  assert.equal(flags.length, 0, `Review potential sensitive content before transfer: ${name}`);
  candidates.set(name, normalized(data));
}
// Dedicated branch overlays. The original native worktree files stay intact.
candidates.set('codemagic.yaml', normalized(fs.readFileSync('ci/native-validation/codemagic.yaml')));
const vercel = JSON.parse(fs.readFileSync('vercel.json'));
vercel.git = { ...vercel.git, deploymentEnabled: false };
candidates.set('vercel.json', Buffer.from(JSON.stringify(vercel, null, 2) + '\n'));
candidates.set('.gitattributes', Buffer.from('* text=auto eol=lf\n'));
candidates.set('.gitignore', Buffer.from(candidates.get('.gitignore').toString() + '\n# Dedicated native CI branch only\n.env\n.env.*\n.native-validation/\nios/NativeAudioPolicy/.build/\nios/NativeAudioPolicy/.swiftpm/\n'));
const entries = [...candidates].map(([name, data]) => ({ path: name, sha256: hash(data) })).sort((a, b) => a.path.localeCompare(b.path));
assert.ok(!entries.some(e => /(^|\/)\.env(?:\.|$)/.test(e.path)), 'Environment file slipped into candidate');
fs.mkdirSync(out, { recursive: true });
for (const [name, data] of candidates) {
  const dest = path.join(out, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, data);
}
const manifestPath = 'ci/native-validation/source-manifest.json';
const manifest = { branch: 'ci/ios-native-validation-1b03f', baselineHead: git(['rev-parse', 'HEAD']).trim(), stageBEntriesVerified: stageB.entries.length, excluded, overlays: ['codemagic.yaml', 'vercel.json', '.gitattributes', '.gitignore'], lineEndings: 'UTF-8 text normalized to LF for Git; binary bytes preserved', entries };
fs.writeFileSync(path.join(out, manifestPath), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(audit, 'transfer-paths.nul'), [...entries.map(e => e.path), manifestPath].join('\0') + '\0');
fs.writeFileSync(path.join(audit, 'git-status.txt'), git(['status', '--short', '--untracked-files=all']));
const diff = git(['diff', '--no-ext-diff', '--no-color']);
assert.equal(signals('review.patch', Buffer.from(diff)).length, 0, 'Sensitive data in source diff');
fs.writeFileSync(path.join(audit, 'source-diff.patch'), diff);
fs.writeFileSync(path.join(audit, 'audit.json'), JSON.stringify({ stageBEntriesVerified: stageB.entries.length, trackedAndUntrackedFilesReviewed: files.length, ignoredFilesReviewed: ignored.length, ignoredNotTransferred: ignored, findings, excluded, transferred: entries.length + 1, normalizedTextFiles: files.filter(p => candidates.has(p) && !manifest.overlays.includes(p) && hash(fs.readFileSync(p)) !== hash(candidates.get(p))), sourceManifestSha256: hash(fs.readFileSync(path.join(out, manifestPath))), nativeWorktreeUnmodified: ['codemagic.yaml', 'vercel.json', '.gitignore'].every(p => hash(fs.readFileSync(p)) === stageB.entries.find(e => e.path === p)?.sha256) }, null, 2));
console.log(JSON.stringify({ source: out, stageBVerified: stageB.entries.length, transferred: entries.length + 1, excluded: excluded.map(e => e.path), ignoredNotTransferred: ignored.length, includedSensitiveFindings: 0 }));
