// Explicit CLI: never silently skip dispatch, and never print raw tool errors.
import { main } from './validate.mjs';
try { main(process.argv[2]); }
catch (error) {
  console.error('Signed archive/export validation failed; consult the redacted step-status report.');
  process.exitCode = Number.isInteger(error.exitCode) && error.exitCode > 0 && error.exitCode < 256 ? error.exitCode : 1;
}
