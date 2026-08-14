import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  server: {
    port: 5174,
    host: true
  },
  build: {
    outDir: 'dist'
  }
});
