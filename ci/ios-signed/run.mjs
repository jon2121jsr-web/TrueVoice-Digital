// Explicit CLI: never silently skip dispatch, and never print raw tool errors.
import { runDiagnosticStep } from './validate.mjs';
// Codemagic publishes after the build. Keep integration credentials out of the runner.
for (const name of Object.keys(process.env)) {
  if (name.startsWith('APP_STORE_CONNECT_')) delete process.env[name];
}
process.exitCode = runDiagnosticStep(process.argv[2]);
