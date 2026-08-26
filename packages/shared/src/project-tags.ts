export function projectTagName(value: string): string {
  const tag = value.normalize('NFKC').trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/-$/g, '')
  if (tag === '') throw new Error('project name must contain a letter or number')
  return tag
}
