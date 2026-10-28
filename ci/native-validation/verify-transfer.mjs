// Read-only verification of a snapshot, or its future staged Git tree.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { verifySource } from './validate.mjs';

const directory = path.resolve(process.argv[2] ?? '.');
const manifestFile = path.join(directory, 'ci/native-validation/source-manifest.json');
const staged = process.argv.includes('--git-index');
function git(args) {
  const r = spawnSync('git', args, { cwd: directory, windowsHide: true, maxBuffer: 20 * 1024 * 1024 });
  assert.equal(r.status, 0, 'Read-only Git index verification failed');
  return r.stdout;
}
const tracked = staged ? git(['ls-files', '-z']).toString().split('\0').filter(Boolean) : undefined;
const result = verifySource(directory, manifestFile, tracked);
if (staged) {
  const manifest = JSON.parse(fs.readFileSync(manifestFile));
  const entries = [...manifest.entries, { path: 'ci/native-validation/source-manifest.json', sha256: createHash('sha256').update(fs.readFileSync(manifestFile)).digest('hex') }];
  for (const entry of entries) {
    const blob = git(['show', ':' + entry.path]);
    assert.equal(createHash('sha256').update(blob).digest('hex'), entry.sha256, `Staged bytes differ from review snapshot: ${entry.path}`);
  }
}
console.log(JSON.stringify({ ...result, stagedBytesVerified: staged }));
