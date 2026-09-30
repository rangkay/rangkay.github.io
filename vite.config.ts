import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// rangkay.github.io is a user site, so the app is served from the domain root.
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: { manualChunks: { echarts: ['echarts'] } },
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    testTimeout: 30000,
  },
});
