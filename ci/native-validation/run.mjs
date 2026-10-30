// Deliberate CLI entry: every invocation executes a step or exits nonzero.
import { main, sanitize } from './validate.mjs';
try { main(process.argv[2]); }
catch (error) { console.error(sanitize(error.message)); process.exitCode = error.exitCode ?? 1; }
