import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // The active runtime is Express + SQLite, not the legacy hosted Worker.
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist/client' },
  server: { proxy: { '/api': 'http://127.0.0.1:3101', '/uploads': 'http://127.0.0.1:3101' } },
});
