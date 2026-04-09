import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'intercepter',
      formats: ['es', 'cjs', 'umd', 'iife'],
      fileName: (format) => `intercepter.${format}.js`
    }
  }
});