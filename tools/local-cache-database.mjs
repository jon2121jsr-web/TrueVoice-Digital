// Dedicated disposable loopback database only. Never load .env or hosted URLs.
import { spawn } from 'node:child_process';
export function localDatabaseOptions(value, acknowledgement) {
  const url = new URL(value);
  if (acknowledgement !== 'YES' || !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['127.0.0.1', '[::1]'].includes(url.hostname) || url.search || url.hash ||
      !/^\/pulse_cache_test[a-z0-9_]*$/.test(url.pathname)) {
    throw new Error('Requires acknowledged disposable pulse_cache_test database on numeric loopback');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  return { PGHOST: host, PGHOSTADDR: host, PGSERVICE: '', PGSERVICEFILE: '', PGPORT: url.port || '5432',
    PGDATABASE: url.pathname.slice(1), PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password), PGCONNECT_TIMEOUT: '3',
    PGOPTIONS: '-c statement_timeout=10000 -c lock_timeout=3000' };
}
export function localPsql(options, sql) {
  return new Promise((resolve, reject) => {
    const childEnv = { ...process.env, ...options };
    // libpq on Windows treats empty service variables as real file selections.
    // Remove inherited service overrides instead of assigning empty strings.
    delete childEnv.PGSERVICE;
    delete childEnv.PGSERVICEFILE;
    const child = spawn(process.env.PULSE_CACHE_TEST_PSQL || 'psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], {
      env: childEnv, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    // Consume but never expose diagnostics that might contain connection details.
    child.stderr.resume();
    child.on('error', () => reject(new Error('Local psql unavailable; no hosted fallback permitted')));
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(`Local SQL verification failed (exit ${code}); inspect locally`)));
    child.stdin.on('error', () => {});
    child.stdin.end(sql);
  });
}
