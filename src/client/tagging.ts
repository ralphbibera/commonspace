import type { CommonspaceBootstrap } from '../contracts.ts'

export type TagKind = 'agent' | 'project' | 'channel' | 'text'

export interface TagReferencePart {
  text: string
  kind: TagKind
}

export interface TagSuggestion {
  kind: Exclude<TagKind, 'text'>
  id: string
  label: string
  token: string
}

const referencePattern = /(^|[^\p{L}\p{N}_@])(@@|@|#)([\p{L}\p{N}][\p{L}\p{N}_-]*)/gu
const activeTokenPattern = /(^|\s)(@@|@|#)([\p{L}\p{N}][\p{L}\p{N}_-]*)?$/u

export function tagReferenceParts(text: string): TagReferencePart[] {
  const parts: TagReferencePart[] = []
  let cursor = 0
  for (const match of text.matchAll(referencePattern)) {
    const lead = match[1] ?? ''
    const marker = match[2] ?? ''
    const value = match[3] ?? ''
    const start = match.index! + lead.length
    if (start > cursor) parts.push({ text: text.slice(cursor, start), kind: 'text' })
    const kind: Exclude<TagKind, 'text'> = marker === '@@' ? 'project' : marker === '@' ? 'agent' : 'channel'
    parts.push({ text: marker + value, kind })
    cursor = start + marker.length + value.length
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), kind: 'text' })
  return parts.length === 0 ? [{ text, kind: 'text' }] : parts
}

export function tagSuggestions(text: string, bootstrap: CommonspaceBootstrap): TagSuggestion[] {
  const match = text.match(activeTokenPattern)
  if (match === null) return []
  const prefix = match[2]
  const query = (match[3] ?? '').toLocaleLowerCase()
  if (prefix === '@') {
    return bootstrap.agents
      .filter(agent => agent.id.toLocaleLowerCase().startsWith(query) || agent.displayName.toLocaleLowerCase().startsWith(query))
      .slice(0, 6)
      .map(agent => ({ kind: 'agent' as const, id: agent.id, label: agent.displayName, token: `@${agent.id}` }))
  }
  if (prefix === '@@') {
    return bootstrap.state.projects
      .filter(project => project.id.toLocaleLowerCase().startsWith(query) || project.name.toLocaleLowerCase().startsWith(query))
      .slice(0, 6)
      .map(project => ({ kind: 'project' as const, id: project.id, label: project.name, token: `@@${project.id}` }))
  }
  return bootstrap.state.channels
    .filter(channel => channel.id.toLocaleLowerCase().startsWith(query) || channel.name.toLocaleLowerCase().startsWith(query))
    .slice(0, 6)
    .map(channel => ({ kind: 'channel' as const, id: channel.id, label: channel.name, token: `#${channel.name}` }))
}

export function insertTag(text: string, token: string): string {
  return text.replace(activeTokenPattern, (_whole, whitespace: string) => `${whitespace}${token} `)
}
