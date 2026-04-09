import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'reqHook',
      formats: ['es', 'cjs', 'umd', 'iife'],
      fileName: (format) => `req-hook.${format}.js`
    }
  }
});