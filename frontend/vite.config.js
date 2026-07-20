import { defineConfig } from 'vite';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  root: new URL('.', import.meta.url).pathname,
  define: {
    global: 'globalThis',
  },
  plugins: [wasm(), topLevelAwait()],
  build: { target: 'esnext', outDir: 'dist', emptyOutDir: true },
  server: { fs: { allow: ['..'] } },
});
