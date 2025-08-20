import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
  port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    },
    proxy: {
      '/infer': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  },
  build: { outDir: 'dist' },
  define: { __APP_VERSION__: JSON.stringify('1.1.0') }
});
