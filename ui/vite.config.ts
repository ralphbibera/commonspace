import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const apiTarget = 'http://127.0.0.1:3100'

function apiProxy(browserHost: string) {
  return {
    target: apiTarget,
    headers: {
      'x-forwarded-host': browserHost,
    },
  }
}

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
      '/api': apiProxy('127.0.0.1:5173'),
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    proxy: {
      '/api': apiProxy('127.0.0.1:4173'),
    },
  },
})
