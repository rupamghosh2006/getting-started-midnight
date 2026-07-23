import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'contracts', 'hello-world.compact');
const output = resolve(root, 'contracts', 'managed', 'hello-world');
const version = process.env.COMPACT_VERSION ?? '0.31.1';

// Windows ships its own `compact.exe` for NTFS compression. Calling `compact`
// from an npm script there can appear to succeed while producing no Compact
// contract artifacts at all. Midnight supports Linux and macOS; use WSL on
// Windows, or point COMPACT_BIN at an actual Midnight Compact executable.
if (process.platform === 'win32' && !process.env.COMPACT_BIN) {
  console.error('Midnight Compact cannot be run natively on Windows.');
  console.error('The Windows `compact.exe` command compresses files; it is not the Midnight compiler.');
  console.error('Use WSL/Linux or CI after installing Compact, then rerun `npm run compile`.');
  process.exit(1);
}

const compact = process.env.COMPACT_BIN ?? 'compact';
const result = spawnSync(
  compact,
  ['compile', `+${version}`, source, output],
  { cwd: root, stdio: 'inherit', shell: false },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const expected = [
  'compiler/contract-info.json',
  'contract/index.js',
  'contract/index.d.ts',
  'keys/provePrivateKnowledge.prover',
  'keys/provePrivateKnowledge.verifier',
  'zkir/provePrivateKnowledge.zkir',
];
const missing = expected.filter((relative) => !existsSync(resolve(output, relative)));
if (missing.length) {
  console.error(`Compact completed without required generated files: ${missing.join(', ')}`);
  process.exit(1);
}

