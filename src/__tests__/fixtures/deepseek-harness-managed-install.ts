import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installManagedDeepSeekHarness } from '../../infra/deepseek-harness/index.js';

const [configDir, pythonPath, workerId] = process.argv.slice(2);
const controlDir = process.env.DSH_TEST_CONTROL_DIR;
if (configDir === undefined || pythonPath === undefined || workerId === undefined || controlDir === undefined) {
  throw new Error('Expected configDir, pythonPath, workerId, and DSH_TEST_CONTROL_DIR');
}

mkdirSync(controlDir, { recursive: true });
writeFileSync(join(controlDir, `ready-${workerId}`), 'ready', 'utf8');

try {
  const installation = await installManagedDeepSeekHarness({ configDir, pythonPath });
  process.stdout.write(`${JSON.stringify(installation)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
