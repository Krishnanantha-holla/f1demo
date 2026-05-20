import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
    coverage: {
      provider: 'v8',
      all: false,
      reporter: ['text', 'html'],
      thresholds: { lines: 70, statements: 70, functions: 60, branches: 55 },
      exclude: ['**/node_modules/**', 'src/**/__tests__/**', '**/*.config.js'],
    },
  },
})
