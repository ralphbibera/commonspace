import type { CommonspaceReasoning } from '../contracts.ts'

const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface AgentCommandInvocation {
  command: string
  args: string[]
  cwd: string
  input: string
}

interface BaseInvocationInput {
  cwd: string
  additionalCwds: string[]
  prompt: string
  sessionId?: string
  model?: string
  reasoning?: CommonspaceReasoning
  unsafe: boolean
}

export interface CodexInvocationInput extends BaseInvocationInput {
  codexPath?: string
  outputFile: string
}

export interface ClaudeCodeInvocationInput extends BaseInvocationInput {
  claudePath?: string
  newSessionId: string
  sessionName: string
  maxTurns: number
}

export interface AgentAdapterOutput {
  text: string
  sessionId: string
}

export function isAgentSessionId(value: unknown): value is string {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value)
}

function requireSessionId(value: string): string {
  if (!isAgentSessionId(value)) throw new Error('invalid agent session id')
  return value
}

function modelArgs(model: string | undefined): string[] {
  const value = model?.trim()
  return value === undefined || value === '' ? [] : ['-m', value]
}

function codexReasoningArgs(reasoning: CommonspaceReasoning | undefined): string[] {
  if (reasoning === undefined) return []
  const effort = reasoning === 'none' || reasoning === 'minimal' ? 'low' : reasoning
  return ['-c', `model_reasoning_effort="${effort}"`]
}

function claudeReasoning(reasoning: CommonspaceReasoning | undefined): 'low' | 'medium' | 'high' | 'max' | undefined {
  if (reasoning === undefined) return undefined
  if (reasoning === 'medium') return 'medium'
  if (reasoning === 'high' || reasoning === 'xhigh') return 'high'
  if (reasoning === 'max') return 'max'
  return 'low'
}

export function buildCodexInvocation(input: CodexInvocationInput): AgentCommandInvocation {
  const base = [
    '--json',
    '--skip-git-repo-check',
  ]
  const args = input.sessionId === undefined
    ? [
        'exec',
        ...base,
        ...(input.unsafe ? ['--dangerously-bypass-approvals-and-sandbox'] : ['--sandbox', 'workspace-write']),
        ...input.additionalCwds.flatMap(path => ['--add-dir', path]),
        ...modelArgs(input.model),
        ...codexReasoningArgs(input.reasoning),
        '-o', input.outputFile,
        '-',
      ]
    : [
        'exec', 'resume',
        ...base,
        '--all',
        ...(input.unsafe ? ['--dangerously-bypass-approvals-and-sandbox'] : []),
        ...modelArgs(input.model),
        ...codexReasoningArgs(input.reasoning),
        '-o', input.outputFile,
        requireSessionId(input.sessionId),
        '-',
      ]

  return {
    command: input.codexPath ?? 'codex',
    args,
    cwd: input.cwd,
    input: input.prompt,
  }
}

export function parseCodexOutput(stdout: string, lastMessage: string, resumedSessionId?: string): AgentAdapterOutput {
  let sessionId = isAgentSessionId(resumedSessionId) ? resumedSessionId : undefined
  let fallback = ''
  let reportedError = ''
  for (const line of stdout.split(/\r?\n/)) {
    if (line.trim() === '') continue
    try {
      const event = JSON.parse(line) as {
        type?: string
        thread_id?: string
        message?: string
        item?: { type?: string; text?: string }
      }
      if (event.type === 'thread.started' && isAgentSessionId(event.thread_id)) {
        sessionId = event.thread_id
      }
      if (event.type === 'item.completed' && event.item?.type === 'agent_message' && typeof event.item.text === 'string') {
        fallback = event.item.text.trim()
      }
      if (event.type === 'error' && typeof event.message === 'string') reportedError = event.message.trim()
    } catch {
      // Codex JSONL can include non-event diagnostics; stderr remains the primary diagnostic channel.
    }
  }
  if (sessionId === undefined) throw new Error('Codex did not return a valid session id')
  const text = lastMessage.trim() || fallback
  if (text === '') throw new Error(reportedError || 'Codex returned no response')
  return { sessionId, text }
}

export function buildClaudeCodeInvocation(input: ClaudeCodeInvocationInput): AgentCommandInvocation {
  const resumedSession = input.sessionId === undefined ? undefined : requireSessionId(input.sessionId)
  const sessionArgs = resumedSession === undefined
    ? ['--session-id', requireSessionId(input.newSessionId), '--name', input.sessionName.slice(0, 200)]
    : ['--resume', resumedSession]
  const effort = claudeReasoning(input.reasoning)
  const model = input.model?.trim()
  const args = [
    '-p',
    '--output-format', 'json',
    ...sessionArgs,
    ...(input.unsafe ? ['--dangerously-skip-permissions'] : ['--permission-mode', 'acceptEdits']),
    '--max-turns', String(Math.max(1, Math.min(100, Math.round(input.maxTurns)))),
    ...input.additionalCwds.flatMap(path => ['--add-dir', path]),
    ...(model === undefined || model === '' ? [] : ['--model', model]),
    ...(effort === undefined ? [] : ['--effort', effort]),
  ]
  return {
    command: input.claudePath ?? 'claude',
    args,
    cwd: input.cwd,
    input: input.prompt,
  }
}

export function parseClaudeCodeOutput(stdout: string): AgentAdapterOutput {
  const line = stdout.split(/\r?\n/).map(value => value.trim()).filter(Boolean).at(-1)
  if (line === undefined) throw new Error('Claude Code returned no response')
  let result: { is_error?: boolean; result?: unknown; session_id?: unknown }
  try {
    result = JSON.parse(line) as typeof result
  } catch {
    throw new Error('Claude Code returned invalid JSON')
  }
  const text = typeof result.result === 'string' ? result.result.trim() : ''
  if (result.is_error === true) throw new Error(text || 'Claude Code reported an error')
  if (typeof result.session_id !== 'string') throw new Error('Claude Code did not return a valid session id')
  const sessionId = requireSessionId(result.session_id)
  if (text === '') throw new Error('Claude Code returned no response')
  return { text, sessionId }
}
