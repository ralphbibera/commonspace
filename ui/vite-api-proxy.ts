import type { ProxyOptions } from 'vite'

const apiTarget = process.env.COMMONSPACE_API_TARGET ?? 'http://127.0.0.1:3100'

export function apiProxy(): ProxyOptions {
  return {
    target: apiTarget,
    configure(proxy) {
      proxy.on('proxyReq', (proxyReq, req) => {
        const browserHost = req.headers.host
        if (browserHost !== undefined) proxyReq.setHeader('x-forwarded-host', browserHost)
      })
    },
  }
}
