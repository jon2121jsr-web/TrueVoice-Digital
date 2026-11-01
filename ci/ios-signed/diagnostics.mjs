// Only controlled codes and structural metadata cross this reporting boundary.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

export const stages = Object.freeze(['RUNNER', 'POST_CONFIG_JSON', 'PROJECT_MUTATIONS', 'APP_TARGET', 'RELEASE_CONFIG', 'TEAM', 'SIGNING_STYLE', 'PROFILE_SPECIFIER', 'NATIVE_INTEGRITY', 'EXPORT_OPTIONS', 'EXPORT_OPTIONS_WRITE', 'FRESH_ARTIFACTS', 'ARCHIVE_LAUNCH']);
const steps = ['preflight', 'dependencies', 'swift-tests', 'web-build', 'sync', 'archive-export'];
const safeKeys = new Set(['objects', 'attributes', 'TargetAttributes', 'buildSettings', 'isa', 'name', 'buildConfigurationList', 'buildConfigurations', 'CODE_SIGN_STYLE', 'DEVELOPMENT_TEAM', 'CODE_SIGN_IDENTITY', 'PROVISIONING_PROFILE', 'PROVISIONING_PROFILE_SPECIFIER', 'ProvisioningStyle', 'DevelopmentTeam', 'PRODUCT_BUNDLE_IDENTIFIER', 'objectVersion', 'archiveVersion', 'classes', 'rootObject', 'files', 'children', 'targets', 'packageReferences']);
export function redactMutation(change) {
  return {
    path: change.path.map(part => /^[A-Fa-f0-9]{24}$/.test(part) || safeKeys.has(part) || /^(CODE_SIGN_STYLE|DEVELOPMENT_TEAM|CODE_SIGN_IDENTITY|PROVISIONING_PROFILE|PROVISIONING_PROFILE_SPECIFIER)\[sdk=iphoneos\*\]$/.test(part) ? part : '[redacted-key]').join('.'),
    changeType: ['added', 'removed', 'modified'].includes(change.changeType) ? change.changeType : 'modified',
  };
}
function classification(error) {
  return error?.code === 'ERR_ASSERTION' ? 'ASSERTION' : error instanceof SyntaxError ? 'INVALID_JSON' : 'JS_EXCEPTION';
}
export function createDiagnostics({ directory, step, log = line => console.error(line) }) {
  const selected = steps.includes(step) ? step : 'invalid-step';
  const events = [], processes = [];
  let active = 'RUNNER', failure;
  function persist() {
    try {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(path.join(directory, selected + '-diagnostics.json'), JSON.stringify({ schema: 1, step: selected, events, failure }, null, 2));
      fs.writeFileSync(path.join(directory, selected + '-steps.json'), JSON.stringify(processes, null, 2));
    } catch {
      log('PULSE_DIAG_REPORT_IO_FAILED');
      throw new Error('Diagnostic report unavailable');
    }
  }
  function recordFailure(code, kind) {
    failure ??= { code, classification: kind };
    persist(); log('PULSE_DIAG_' + failure.code + '_' + failure.classification);
  }
  return {
    stage(code, action) {
      assert.ok(stages.includes(code));
      const previous = active; active = code;
      events.push({ code, status: 'attempted' }); persist();
      try { const value = action(); events.push({ code, status: 'completed' }); persist(); return value; }
      catch (error) { events.push({ code, status: 'failed' }); recordFailure(code, classification(error)); throw error; }
      finally { active = previous; }
    },
    mutations(changes) {
      events.push({ code: 'PROJECT_MUTATIONS', status: 'rejected', changes: changes.map(redactMutation) }); persist();
    },
    process(name, execute) {
      // Names originate in reviewed runner code, never command arguments or env.
      assert.match(name, /^[a-z0-9-]+$/);
      const record = { step: name, status: 'attempted', exitCode: null, signal: null, completed: false };
      processes.push(record); persist();
      let result;
      try { result = execute(); }
      catch { record.status = 'failed'; record.classification = 'LAUNCH_EXCEPTION'; persist(); recordFailure(active, 'LAUNCH_EXCEPTION'); throw new Error('Process launch failed'); }
      const signals = ['SIGTERM', 'SIGKILL', 'SIGABRT', 'SIGINT', 'SIGSEGV'];
      record.exitCode = Number.isInteger(result.status) ? result.status : null;
      record.signal = signals.includes(result.signal) ? result.signal : result.signal ? 'OTHER' : null;
      record.completed = !result.error && result.status === 0 && !result.signal;
      record.status = record.completed ? 'completed' : 'failed';
      record.classification = record.completed ? 'OK' : result.error ? ({ ENOENT: 'EXECUTABLE_NOT_FOUND', EACCES: 'EXECUTABLE_DENIED', ETIMEDOUT: 'TIMEOUT', ENOBUFS: 'OUTPUT_LIMIT' }[result.error.code] ?? 'PROCESS_ERROR') : result.signal ? 'SIGNALLED' : 'NONZERO_EXIT';
      persist();
      if (!record.completed) { recordFailure(active, record.classification); throw Object.assign(new Error('Process failed'), { exitCode: result.status ?? 1 }); }
      return result;
    },
    execute(action) {
      try { this.stage('RUNNER', action); return 0; }
      catch (error) {
        // A report-write failure still emits only a fixed code. Never raw errors.
        try { if (!failure) recordFailure(active, classification(error)); } catch { /* fixed IO code already emitted */ }
        return Number.isInteger(error?.exitCode) && error.exitCode > 0 && error.exitCode < 256 ? error.exitCode : 1;
      }
    },
  };
}
