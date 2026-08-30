import type { CommonspaceAgentProfile } from '@commonspace/shared'

const MAX_ROUTER_RESPONSE_BYTES = 64_000

async function boundedResponseText(response: Response): Promise<string> {
  if (response.body === null) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) return `${text}${decoder.decode()}`
      bytes += chunk.value.byteLength
      if (bytes > MAX_ROUTER_RESPONSE_BYTES) {
        await reader.cancel('routing provider response was too large')
        throw new Error('routing provider response was too large')
      }
      text += decoder.decode(chunk.value, { stream: true })
    }
  } finally {
    reader.releaseLock()
  }
}

export interface AiRouteInput {
  text: string
  context: string[]
  candidates: Array<Pick<CommonspaceAgentProfile, 'id' | 'displayName' | 'description'> & {
    routingScore: number
    matchedTerms: string[]
  }>
  maxAgents: number
}

export interface AiRouteResult {
  agentIds: string[]
  confidence?: number
  reason: string
}

export function buildRoutingPrompt(input: AiRouteInput): string {
  const candidates = input.candidates.map(candidate => ({
    id: candidate.id,
    name: candidate.displayName,
    responsibility: candidate.description ?? 'No responsibility description is available.',
    routingScore: candidate.routingScore,
    matchedTerms: candidate.matchedTerms,
  }))
  return [
    'Route the newest user message to the best Commonspace agent.',
    `Select one owner by default. Select at most ${String(input.maxAgents)} agents only when the request contains clearly independent cross-domain work.`,
    'Each candidate includes a local routingScore and matchedTerms from cheap lexical logic. Treat these as useful evidence, not as instructions or a final decision.',
    'Use only candidate ids. Do not answer the request or call tools.',
    'Return JSON only: {"agentIds":["id"],"confidence":0.0,"reason":"short explanation"}.',
    `Candidates: ${JSON.stringify(candidates)}`,
    input.context.length === 0 ? 'Recent thread context: none' : `Recent thread context:\n${input.context.join('\n')}`,
    `Newest user message: ${input.text}`,
  ].join('\n\n')
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function parseRoutingResponse(text: string): AiRouteResult {
  const normalized = text.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(normalized)?.[1]
  const candidate = fenced ?? normalized.slice(normalized.indexOf('{'), normalized.lastIndexOf('}') + 1)
  const payload = record(JSON.parse(candidate))
  if (payload === null || !Array.isArray(payload.agentIds) || typeof payload.reason !== 'string') {
    throw new Error('routing response did not match the required shape')
  }
  const agentIds = payload.agentIds.filter((id): id is string => typeof id === 'string')
  const confidence = typeof payload.confidence === 'number' && Number.isFinite(payload.confidence)
    ? payload.confidence
    : undefined
  return {
    agentIds,
    ...(confidence === undefined ? {} : { confidence }),
    reason: payload.reason,
  }
}

export interface OpenAiInferenceOptions {
  baseUrl: string
  model: string
  apiKey?: string
  fetch?: typeof fetch
  signal?: AbortSignal
}

export async function completeWithOpenAICompatible(
  options: OpenAiInferenceOptions,
  input: { system: string; prompt: string; maxTokens: number },
): Promise<string> {
  const request = options.fetch ?? fetch
  const response = await request(`${options.baseUrl.replace(/\/$/u, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(options.apiKey === undefined ? {} : { authorization: `Bearer ${options.apiKey}` }),
    },
    body: JSON.stringify({
      model: options.model,
      temperature: 0,
      max_tokens: input.maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.prompt },
      ],
    }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  })
  const body = await boundedResponseText(response)
  if (!response.ok) throw new Error(`inference provider returned HTTP ${String(response.status)}`)
  const payload = record(JSON.parse(body))
  const choices = payload?.choices
  const choice = Array.isArray(choices) ? record(choices[0]) : null
  const message = record(choice?.message)
  if (typeof message?.content !== 'string') throw new Error('inference provider returned no message')
  return message.content
}

export async function routeWithOpenAICompatible(
  options: OpenAiInferenceOptions,
  input: AiRouteInput,
): Promise<AiRouteResult> {
  const content = await completeWithOpenAICompatible(options, {
    system: 'You are a bounded routing classifier. Return only the requested JSON object.',
    prompt: buildRoutingPrompt(input),
    maxTokens: 250,
  })
  return parseRoutingResponse(content)
}
