// Explicit CLI: never silently skip dispatch, and never print raw tool errors.
import { runDiagnosticStep } from './validate.mjs';
process.exitCode = runDiagnosticStep(process.argv[2]);
