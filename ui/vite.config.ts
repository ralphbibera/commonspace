import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { apiProxy } from './vite-api-proxy.ts'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@commonspace/shared': fileURLToPath(new URL('../packages/shared/src/index.ts', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': apiProxy(),
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    proxy: {
      '/api': apiProxy(),
    },
  },
})
