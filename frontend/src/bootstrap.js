// Midnight SDK dependencies use the familiar Node Buffer API internally.
// Install it on the browser global before loading the wallet client.
import { Buffer } from 'buffer';
import process from 'process';

globalThis.Buffer ??= Buffer;
globalThis.process ??= process;

await import('./main.js');
