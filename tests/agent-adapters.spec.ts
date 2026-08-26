import { describe, expect, it } from 'vitest'
import {
  buildClaudeCodeInvocation,
  buildCodexInvocation,
  parseClaudeCodeOutput,
  parseCodexOutput,
} from '../packages/adapters/src/cli.ts'

const SESSION_ID = '123e4567-e89b-42d3-a456-426614174000'

describe('Commonspace external agent adapters', () => {
  it('builds a new Codex invocation with the prompt on stdin', () => {
    const invocation = buildCodexInvocation({
      cwd: '/repo/app',
      additionalCwds: ['/repo/api'],
      prompt: 'Inspect checkout.',
      outputFile: '/tmp/codex-answer.txt',
      model: 'gpt-5.4',
      reasoning: 'high',
      unsafe: false,
    })

    expect(invocation).toEqual({
      command: 'codex',
      args: [
        'exec', '--json', '--skip-git-repo-check', '--sandbox', 'workspace-write',
        '--add-dir', '/repo/api', '-m', 'gpt-5.4', '-c', 'model_reasoning_effort="high"',
        '-o', '/tmp/codex-answer.txt', '-',
      ],
      cwd: '/repo/app',
      input: 'Inspect checkout.',
    })
    expect(invocation.args).not.toContain('Inspect checkout.')
  })

  it('resumes an exact Codex session without selecting the latest session', () => {
    const invocation = buildCodexInvocation({
      cwd: '/repo/app',
      additionalCwds: ['/repo/api'],
      prompt: 'Continue.',
      outputFile: '/tmp/codex-answer.txt',
      sessionId: SESSION_ID,
      reasoning: 'max',
      unsafe: true,
    })

    expect(invocation.args).toEqual([
      'exec', 'resume', '--json', '--skip-git-repo-check', '--all',
      '--dangerously-bypass-approvals-and-sandbox', '-c', 'model_reasoning_effort="max"',
      '-o', '/tmp/codex-answer.txt', SESSION_ID, '-',
    ])
    expect(invocation.args).not.toContain('--last')
  })

  it('extracts the Codex session identity and final response', () => {
    expect(parseCodexOutput([
      JSON.stringify({ type: 'thread.started', thread_id: SESSION_ID }),
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'Fallback response.' } }),
    ].join('\n'), 'Final response.')).toEqual({
      sessionId: SESSION_ID,
      text: 'Final response.',
    })
  })

  it('maps provider-incompatible Codex reasoning values to the lowest supported effort', () => {
    for (const reasoning of ['none', 'minimal'] as const) {
      const invocation = buildCodexInvocation({
        cwd: '/repo/app',
        additionalCwds: [],
        prompt: 'Inspect checkout.',
        outputFile: '/tmp/codex-answer.txt',
        reasoning,
        unsafe: false,
      })
      expect(invocation.args).toContain('model_reasoning_effort="low"')
      expect(invocation.args).not.toContain(`model_reasoning_effort="${reasoning}"`)
    }
  })

  it('builds new and resumed Claude Code invocations with bounded non-interactive execution', () => {
    const initial = buildClaudeCodeInvocation({
      cwd: '/repo/app',
      additionalCwds: ['/repo/api'],
      prompt: 'Inspect checkout.',
      newSessionId: SESSION_ID,
      sessionName: 'Commonspace Thread: thread-1',
      model: 'claude-opus-4-1',
      reasoning: 'xhigh',
      maxTurns: 24,
      unsafe: false,
    })
    expect(initial).toEqual({
      command: 'claude',
      args: [
        '-p', '--output-format', 'json', '--session-id', SESSION_ID,
        '--name', 'Commonspace Thread: thread-1', '--permission-mode', 'acceptEdits',
        '--max-turns', '24', '--add-dir', '/repo/api', '--model', 'claude-opus-4-1',
        '--effort', 'high',
      ],
      cwd: '/repo/app',
      input: 'Inspect checkout.',
    })

    const resumed = buildClaudeCodeInvocation({
      cwd: '/repo/app',
      additionalCwds: [],
      prompt: 'Continue.',
      newSessionId: '00000000-0000-4000-8000-000000000000',
      sessionId: SESSION_ID,
      sessionName: 'Bot Chat',
      reasoning: 'minimal',
      maxTurns: 12,
      unsafe: true,
    })
    expect(resumed.args).toEqual([
      '-p', '--output-format', 'json', '--resume', SESSION_ID,
      '--dangerously-skip-permissions', '--max-turns', '12', '--effort', 'low',
    ])
  })

  it('parses Claude Code JSON output and rejects unsafe persisted session identifiers', () => {
    expect(parseClaudeCodeOutput(JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: 'Found the issue.',
      session_id: SESSION_ID,
    }))).toEqual({ text: 'Found the issue.', sessionId: SESSION_ID })

    expect(() => buildCodexInvocation({
      cwd: '/repo/app',
      additionalCwds: [],
      prompt: 'Continue.',
      outputFile: '/tmp/output',
      sessionId: '--last',
      unsafe: false,
    })).toThrow('invalid agent session id')
  })
})
