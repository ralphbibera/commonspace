import type { SessionId, WorkspaceId } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'

export type CommonspaceConversationKind = 'channel' | 'direct-message'

export interface CommonspaceWorkspace {
  workspaceId: string
  title: string
  path: string
  recent: boolean
}

export interface CommonspaceProjectContext {
  label: string
  workspaceId?: string
}

export interface ActivateConversationInput {
  kind: CommonspaceConversationKind
  label: string
  sessionId?: string
  project?: CommonspaceProjectContext
}

export interface ActivateConversationResult {
  sessionId: string
  workspaceId: string
}

export interface CommonspaceRuntime {
  listWorkspaces(): readonly CommonspaceWorkspace[]
  activate(input: ActivateConversationInput): Promise<ActivateConversationResult>
}

interface SessionCreator {
  create(opts: { workspaceId: WorkspaceId }): Promise<SessionId>
}

export class CommonspaceRuntimeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CommonspaceRuntimeError'
  }
}

function fallbackTitle(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '')
  return trimmed.split(/[\\/]/).pop() ?? path
}

function rpcFailure(operation: string, result: { error: { code: string; message: string } }): never {
  throw new CommonspaceRuntimeError(`${operation} failed: ${result.error.code}: ${result.error.message}`)
}

function conversationTitle(input: ActivateConversationInput, projectLabel: string): string {
  return input.kind === 'channel'
    ? `#${input.label} · ${projectLabel}`
    : `DM · ${input.label} · ${projectLabel}`
}

function bootstrapMessage(input: ActivateConversationInput, projectLabel: string): string {
  return input.kind === 'channel'
    ? `[Commonspace] #${input.label} created for ${projectLabel}. This is the channel's Messages conversation.`
    : `[Commonspace] Direct conversation with ${input.label} opened for ${projectLabel}. Respond as the ${input.label} specialist.`
}

/** Bridge Commonspace navigation to native DSH workspace/session services. */
export function createHarnessRuntime(ctx: ClientContext): CommonspaceRuntime {
  const listWorkspaces = (): readonly CommonspaceWorkspace[] => {
    const snapshot = ctx.workspaces.list.getSnapshot()
    return snapshot.items.map(item => ({
      workspaceId: String(item.workspaceId),
      title: item.title ?? fallbackTitle(item.path),
      path: item.path,
      recent: item.workspaceId === snapshot.recentWorkspaceId,
    }))
  }

  const sessionCreator = ctx.sessions as unknown as SessionCreator

  return {
    listWorkspaces,
    async activate(input) {
      if (input.sessionId !== undefined) {
        const id = input.sessionId as SessionId
        if (ctx.sessions.list.getSnapshot().byId[id] !== undefined) {
          ctx.sessions.open(id)
          const bound = ctx.sessions.binding(id)
          const workspaceId = input.project?.workspaceId
            ?? listWorkspaces().find(workspace => workspace.recent)?.workspaceId
            ?? listWorkspaces()[0]?.workspaceId
          if (bound !== undefined && workspaceId !== undefined) return { sessionId: input.sessionId, workspaceId }
        }
      }

      const workspaces = listWorkspaces()
      const workspaceId = input.project?.workspaceId
        ?? workspaces.find(workspace => workspace.recent)?.workspaceId
        ?? workspaces[0]?.workspaceId
      if (workspaceId === undefined) {
        throw new CommonspaceRuntimeError('Add a Harness workspace, then create or select a Commonspace project before opening chat.')
      }
      if (typeof sessionCreator.create !== 'function') {
        throw new CommonspaceRuntimeError('This DeepSeek Harness build does not expose native session creation to Commonspace.')
      }

      const sessionId = await sessionCreator.create({ workspaceId: workspaceId as WorkspaceId })
      const binding = ctx.sessions.binding(sessionId)
      if (binding === undefined) {
        throw new CommonspaceRuntimeError(`Harness created session ${String(sessionId)} without a client binding.`)
      }

      const workspace = workspaces.find(candidate => candidate.workspaceId === workspaceId)
      const projectLabel = input.project?.label ?? workspace?.title ?? 'Workspace'
      const rename = await binding.session.rename(conversationTitle(input, projectLabel))
      if (!rename.ok) rpcFailure('session rename', rename)

      ctx.sessions.open(sessionId)
      const prompt = await binding.session.prompt(
        [{ type: 'text', text: bootstrapMessage(input, projectLabel) }],
        'queue',
      )
      if (!prompt.ok) rpcFailure('channel activation', prompt)
      return { sessionId: String(sessionId), workspaceId }
    },
  }
}
