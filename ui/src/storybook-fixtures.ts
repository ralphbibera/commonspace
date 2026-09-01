import { COMMONSPACE_STATE_VERSION, type CommonspaceBootstrap, type ConversationRef } from '@commonspace/shared'

const now = '2026-09-01T04:00:00.000Z'

export const storyBootstrap = {
  agents: [
    { id: 'agentops', displayName: 'AgentOps', adapter: 'hermes', model: 'gpt-5.6-sol', status: 'running', avatarEmoji: '🤖', accentColor: '#4a154b' },
    { id: 'backend', displayName: 'Backend', adapter: 'hermes', model: 'gpt-5.6-sol', status: 'stopped' },
    { id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: 'gpt-5.6-sol', status: 'stopped' },
    { id: 'infrastructure', displayName: 'Infrastructure', adapter: 'hermes', model: 'gpt-5.6-sol', status: 'stopped' },
  ],
  discoveredAgents: [],
  routing: { provider: 'openai-compatible', model: 'gpt-5.6-sol', harnessAgentId: null, baseUrl: 'https://api.openai.com/v1', apiKeyConfigured: true },
  liveActivities: [{
    id: 'activity-agentops',
    sourceMessageId: 'root-running',
    agentId: 'agentops',
    agentName: 'AgentOps',
    adapter: 'hermes',
    conversation: { kind: 'channel', id: 'general' },
    threadId: 'thread-running',
    startedAt: '2026-09-01T03:48:00.000Z',
    entries: [{ type: 'tool', id: 'tool-1', title: 'Verifying live workspace', status: 'in_progress', createdAt: '2026-09-01T03:48:00.000Z', updatedAt: now }],
  }],
  state: {
    version: COMMONSPACE_STATE_VERSION,
    revision: 12,
    inboxReadAt: null,
    inboxReadMessageIds: [],
    inboxSavedItemIds: ['reply-complete'],
    followedSessionIds: ['root-running:agentops'],
    mutedSessionIds: [],
    defaults: { model: null, reasoning: 'max', maxAgentsPerTurn: 4, memoryThreads: 12 },
    notifications: { enabled: true, replies: true, mentions: true, permissions: true, failures: true, sound: false },
    agents: [
      { id: 'agentops', displayName: 'AgentOps', adapter: 'hermes', model: 'gpt-5.6-sol', createdAt: now, avatarEmoji: '🤖', accentColor: '#4a154b' },
      { id: 'backend', displayName: 'Backend', adapter: 'hermes', model: 'gpt-5.6-sol', createdAt: now },
      { id: 'frontend', displayName: 'Frontend', adapter: 'hermes', model: 'gpt-5.6-sol', createdAt: now },
      { id: 'infrastructure', displayName: 'Infrastructure', adapter: 'hermes', model: 'gpt-5.6-sol', createdAt: now },
    ],
    dmSessions: {},
    agentSessions: {},
    projects: [
      { id: 'commonspace', name: 'Commonspace', paths: ['/workspace/commonspace'], createdAt: now },
      { id: 'platform', name: 'platform', paths: ['/workspace/platform'], createdAt: now },
    ],
    channels: [
      { id: 'general', name: 'general', agentIds: ['agentops'], instructions: '', memory: { summary: '', decisions: [], openQuestions: [], threadIds: ['thread-running', 'thread-attention'], updatedAt: now }, settings: { model: null, reasoning: null }, createdAt: now },
      { id: 'help-fix', name: 'help-fix', agentIds: ['agentops'], instructions: '', memory: { summary: '', decisions: [], openQuestions: [], threadIds: ['thread-complete'], updatedAt: now }, settings: { model: null, reasoning: null }, createdAt: now },
      { id: 'setup', name: 'setup', agentIds: [], instructions: '', memory: { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: null }, settings: { model: null, reasoning: null }, createdAt: now },
      { id: 'engineering', name: 'engineering', agentIds: ['backend', 'frontend', 'infrastructure'], instructions: '', memory: { summary: '', decisions: [], openQuestions: [], threadIds: [], updatedAt: now }, settings: { model: null, reasoning: null }, createdAt: now },
    ],
    threads: [
      { id: 'thread-running', channelId: 'general', projectId: 'commonspace', rootMessageId: 'root-running', agentIds: ['agentops'], createdAt: now, updatedAt: now },
      { id: 'thread-attention', channelId: 'general', projectId: 'platform', rootMessageId: 'root-attention', agentIds: ['backend'], createdAt: now, updatedAt: now },
      { id: 'thread-complete', channelId: 'help-fix', projectId: 'commonspace', rootMessageId: 'root-complete', agentIds: ['frontend'], createdAt: now, updatedAt: now },
    ],
    pins: [],
    messages: {
      'channel:general': [
        { id: 'root-running', conversation: { kind: 'channel', id: 'general' }, authorType: 'user', authorId: 'user', authorName: 'Ralph', text: 'Make agent status reflect active work', projectIds: ['commonspace'], createdAt: '2026-09-01T03:47:00.000Z' },
        { id: 'root-attention', conversation: { kind: 'channel', id: 'general' }, authorType: 'user', authorId: 'user', authorName: 'Ralph', text: 'Check release notes against package versions', projectIds: ['platform'], createdAt: '2026-09-01T03:35:00.000Z' },
        { id: 'reply-attention', conversation: { kind: 'channel', id: 'general' }, authorType: 'agent', authorId: 'backend', authorName: 'Backend', text: 'I need your input: confirm the package source of truth.', sourceMessageId: 'root-attention', threadId: 'thread-attention', parentMessageId: 'root-attention', replyStatus: 'needs_input', createdAt: '2026-09-01T03:42:00.000Z' },
      ],
      'channel:help-fix': [
        { id: 'root-complete', conversation: { kind: 'channel', id: 'help-fix' }, authorType: 'user', authorId: 'user', authorName: 'Ralph', text: 'Review workspace state restoration', projectIds: ['commonspace'], createdAt: '2026-09-01T02:00:00.000Z' },
        { id: 'reply-complete', conversation: { kind: 'channel', id: 'help-fix' }, authorType: 'agent', authorId: 'frontend', authorName: 'Frontend', text: 'Returned migration safety notes', sourceMessageId: 'root-complete', threadId: 'thread-complete', parentMessageId: 'root-complete', replyStatus: 'complete', createdAt: '2026-09-01T02:10:00.000Z' },
      ],
      'dm:agentops': [{ id: 'dm-agentops', conversation: { kind: 'dm', id: 'agentops' }, authorType: 'agent', authorId: 'agentops', authorName: 'AgentOps', text: 'Private Hermes session continues exactly', replyStatus: 'complete', createdAt: '2026-09-01T01:00:00.000Z' }],
    },
  },
} as unknown as CommonspaceBootstrap

export function createStoryStore(bootstrap: CommonspaceBootstrap = storyBootstrap) {
  const listeners = new Set<() => void>()
  let snapshot = {
    bootstrap,
    loading: false,
    sending: false,
    error: null as string | null,
    activeConversation: null as ConversationRef | null,
    activeProjectId: null as string | null,
    activeThreadId: null as string | null,
  }
  const emit = () => { listeners.forEach(listener => { listener() }) }

  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    getSnapshot: () => snapshot,
    refresh: async () => undefined,
    connectEvents: () => undefined,
    disconnectEvents: () => undefined,
    discoverAgents: async () => undefined,
    mutate: async () => undefined,
    selectConversation(conversation: ConversationRef) { snapshot = { ...snapshot, activeConversation: conversation, activeThreadId: null }; emit() },
    selectProject(projectId: string) { snapshot = { ...snapshot, activeProjectId: projectId }; emit() },
    selectThread(threadId: string | null) { snapshot = { ...snapshot, activeThreadId: threadId }; emit() },
    selectDirectory: async () => null,
    messages: () => snapshot.activeConversation === null ? [] : bootstrap.state.messages[`${snapshot.activeConversation.kind}:${snapshot.activeConversation.id}`] ?? [],
    send: async () => undefined,
    stopAgentRuns: async () => undefined,
    updateRoutingConfiguration: async () => undefined,
    diagnostics: async () => ({ service: { status: 'ready', stateVersion: bootstrap.state.version, storage: 'ready', projectlessWorkspace: 'ready' }, inference: { provider: 'openai-compatible', location: 'remote', configured: true, sends: [] }, harnesses: [] }),
    exportWorkspace: async () => ({}),
    importWorkspace: async () => undefined,
    previewRetention: async () => ({ revision: bootstrap.state.revision, conversation: { kind: 'channel', id: 'general' }, messages: 0, threads: 0, attachments: 0, pins: 0, permissions: 0 }),
    applyRetention: async () => undefined,
    addPin: async () => undefined,
    removePin: async () => undefined,
    compactChannelContext: async () => undefined,
  }
}
