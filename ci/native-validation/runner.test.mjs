import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { run } from './validate.mjs';
test('real child output is captured and nonzero status is preserved', () => {
 const evidence = fs.mkdtempSync(path.join(os.tmpdir(), 'truevoice-runner-'));
 try {
  assert.throws(() => run('failure', process.execPath, ['-e', 'console.error("compiler failed"); process.exit(37)'], { evidence }), error => error.exitCode === 37);
  assert.match(fs.readFileSync(path.join(evidence,'logs/failure.log'),'utf8'), /compiler failed/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(evidence,'reports/failure-command.json'))).exitCode, 37);
  assert.throws(() => run('missing', path.join(evidence,'missing-executable'), [], { evidence }), error => error.exitCode !== 0);
 } finally { fs.rmSync(evidence, {recursive:true,force:true}); }
});
test('CLI refuses unknown steps and compile on non-macOS', () => {
 const cli = new URL('./run.mjs', import.meta.url);
 const bad = spawnSync(process.execPath, [fileURLToPath(cli), 'unknown'], {encoding:'utf8'});
 assert.notEqual(bad.status,0); assert.match(bad.stderr,/Unknown validation step/);
 if(process.platform !== 'darwin') {
  const result = spawnSync(process.execPath, [fileURLToPath(cli), 'compile'], {encoding:'utf8'});
  assert.notEqual(result.status,0); assert.match(result.stderr,/macOS is required/);
  assert.doesNotMatch(result.stdout,/PASS/);
 }
});
