import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'contracts', 'managed', 'hello-world');
const destination = resolve(root, 'frontend', 'public', 'contract', 'hello-world');

for (const dir of ['keys', 'zkir']) {
  const from = resolve(source, dir);
  if (!existsSync(from)) throw new Error(`Missing ${from}. Run npm run compile first.`);
  const to = resolve(destination, dir);
  rmSync(to, { force: true, recursive: true });
  mkdirSync(destination, { recursive: true });
  cpSync(from, to, { recursive: true });
}

console.log(`Synced ZK assets to ${destination}`);
