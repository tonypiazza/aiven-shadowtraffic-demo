import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Assets are served under /_demo/ so OpenSearch Dashboards can own the origin root.
  base: '/_demo/',
  build: { outDir: '../backend/public/_demo', emptyOutDir: true },
  server: {
    proxy: { '/control': 'http://localhost:8080' },
  },
});
