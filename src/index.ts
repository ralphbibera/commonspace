/** Commonspace host plugin: local durable state and pluggable agent execution. */
import type { Context } from '@deepseek-ai/cordis'
import { createCommonspaceHost, type CommonspaceHostConfig } from './host/service.ts'

export const name = 'commonspace'
export const inject = ['webServer']
export type Config = CommonspaceHostConfig

export async function apply(ctx: Context, config: Config = {}): Promise<() => void> {
  const service = await createCommonspaceHost(ctx, config)
  return service.registerRoutes()
}
