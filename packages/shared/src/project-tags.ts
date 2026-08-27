function referenceTagName(value: string, kind: 'agent' | 'project'): string {
  const tag = value.normalize('NFKC').trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/-$/g, '')
  if (tag === '') throw new Error(`${kind} name must contain a letter or number`)
  return tag
}

export function agentTagName(value: string): string {
  return referenceTagName(value, 'agent')
}

export function projectTagName(value: string): string {
  return referenceTagName(value, 'project')
}
