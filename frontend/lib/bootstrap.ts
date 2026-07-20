import { Buffer } from 'buffer';
import process from 'process';

if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer ??= Buffer;
  (globalThis as any).process ??= process;
}
