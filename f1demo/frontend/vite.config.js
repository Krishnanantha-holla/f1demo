import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'F1 Dashboard',
        short_name: 'F1',
        description:
          'Live F1 timing, telemetry, standings, calendar, and news.',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        // OpenF1 / live-data routes must NOT be cached — they update by the second.
        navigateFallbackDenylist: [/^\/api\/live\//, /^\/ws\//, /^\/api\/(positions|intervals|car_data|weather|race_control|team_radio|laps)/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/circuit-map') ||
              url.pathname.startsWith('/api/season') ||
              url.pathname.startsWith('/api/bios'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'f1-static', expiration: { maxAgeSeconds: 86400 } },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/standings') ||
              url.pathname.startsWith('/api/schedule') ||
              url.pathname.startsWith('/api/results'),
            handler: 'NetworkFirst',
            options: { cacheName: 'f1-data', networkTimeoutSeconds: 5 },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
    visualizer({
      filename: 'dist/bundle-stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    chunkSizeWarningLimit: 250,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.js'],
    exclude: ['**/node_modules/**', 'e2e/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      all: false,
      reporter: ['text', 'html'],
      thresholds: { lines: 70, statements: 70, functions: 60, branches: 55 },
      exclude: ['**/node_modules/**', 'src/**/__tests__/**', '**/*.config.js', 'e2e/**'],
    },
  },
});
