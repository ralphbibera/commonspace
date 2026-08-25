import type { CommonspaceMutation, CommonspaceState } from '../contracts.ts'
import { COMMONSPACE_STATE_VERSION } from '../contracts.ts'

export interface StateDependencies {
  ids(): string
  now(): string
}

const defaults: StateDependencies = {
  ids: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
}

function normalizedName(value: string, label: string): string {
  const name = value.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 80)
  if (name === '') throw new Error(`${label} name is required`)
  return name
}

function normalizedChannel(value: string): string {
  const name = value.normalize('NFKC').trim().replace(/^#+/, '').toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
    .replace(/-$/g, '')
  if (name === '') throw new Error('channel name is required')
  return name
}

function nextRevision(state: CommonspaceState): number {
  return Math.max(0, state.revision) + 1
}

export function createInitialState(): CommonspaceState {
  return {
    version: COMMONSPACE_STATE_VERSION,
    revision: 0,
    projects: [],
    channels: [],
    threads: [],
    messages: {},
  }
}

export function applyMutation(
  state: CommonspaceState,
  mutation: CommonspaceMutation,
  dependencies: StateDependencies = defaults,
): CommonspaceState {
  switch (mutation.action) {
    case 'create-project': {
      const name = normalizedName(mutation.name, 'project')
      const paths = [...new Set(mutation.paths.map(path => path.trim()).filter(Boolean))]
      if (paths.length === 0) throw new Error('project requires at least one filesystem path')
      return {
        ...state,
        revision: nextRevision(state),
        projects: [...state.projects, {
          id: dependencies.ids(),
          name,
          paths,
          createdAt: dependencies.now(),
        }],
      }
    }
    case 'add-project-path': {
      const path = mutation.path.trim()
      if (path === '') throw new Error('project path is required')
      let matched = false
      const projects = state.projects.map(project => {
        if (project.id !== mutation.projectId) return project
        matched = true
        return project.paths.includes(path) ? project : { ...project, paths: [...project.paths, path] }
      })
      if (!matched) throw new Error('unknown project')
      return { ...state, revision: nextRevision(state), projects }
    }
    case 'remove-project': {
      if (!state.projects.some(project => project.id === mutation.projectId)) return state
      return {
        ...state,
        revision: nextRevision(state),
        projects: state.projects.filter(project => project.id !== mutation.projectId),
        channels: state.channels.map(channel => channel.projectId === mutation.projectId
          ? { ...channel, projectId: null }
          : channel),
        threads: state.threads.map(thread => thread.projectId === mutation.projectId
          ? { ...thread, projectId: null }
          : thread),
      }
    }
    case 'create-channel': {
      const name = normalizedChannel(mutation.name)
      if (state.channels.some(channel => channel.name === name)) throw new Error(`channel #${name} already exists`)
      const projectId = mutation.projectId
      if (projectId !== undefined && !state.projects.some(project => project.id === projectId)) {
        throw new Error('unknown project')
      }
      return {
        ...state,
        revision: nextRevision(state),
        channels: [...state.channels, {
          id: dependencies.ids(),
          name,
          projectId: projectId ?? null,
          agentIds: [...new Set(mutation.agentIds.filter(Boolean))],
          createdAt: dependencies.now(),
        }],
      }
    }
    case 'set-channel-agents': {
      let matched = false
      const channels = state.channels.map(channel => {
        if (channel.id !== mutation.channelId) return channel
        matched = true
        return { ...channel, agentIds: [...new Set(mutation.agentIds.filter(Boolean))] }
      })
      if (!matched) throw new Error('unknown channel')
      return { ...state, revision: nextRevision(state), channels }
    }
    case 'remove-channel': {
      if (!state.channels.some(channel => channel.id === mutation.channelId)) return state
      return {
        ...state,
        revision: nextRevision(state),
        channels: state.channels.filter(channel => channel.id !== mutation.channelId),
        threads: state.threads.filter(thread => thread.channelId !== mutation.channelId),
        messages: Object.fromEntries(Object.entries(state.messages).filter(([key]) => key !== `channel:${mutation.channelId}`)),
      }
    }
    default: {
      const neverMutation: never = mutation
      throw new Error(`unknown mutation ${JSON.stringify(neverMutation)}`)
    }
  }
}
