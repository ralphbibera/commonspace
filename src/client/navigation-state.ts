export const COMMONSPACE_STORAGE_KEY = 'commonspace.navigation.v1'

export const sectionIds = ['projects', 'channels', 'direct-messages'] as const
export type SectionId = typeof sectionIds[number]

export interface NavigationSelection {
  section: SectionId
  value: string
}

export interface NavigationState {
  version: 1
  items: Record<SectionId, string[]>
  selected: NavigationSelection | null
}

function defaultState(): NavigationState {
  return {
    version: 1,
    items: {
      projects: [],
      channels: ['general'],
      'direct-messages': [],
    },
    selected: null,
  }
}

function sameItem(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: 'accent' }) === 0
}

/** Normalize user input for one Commonspace navigation domain. */
export function normalizeItem(section: SectionId, input: string): string {
  const compact = input.normalize('NFKC').trim().replace(/\s+/g, ' ')
  if (section !== 'channels') return compact.slice(0, 64)

  return compact
    .replace(/^#+/, '')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
    .replace(/-$/g, '')
}

function sanitizeItems(section: SectionId, input: unknown, fallback: readonly string[]): string[] {
  if (!Array.isArray(input)) return [...fallback]
  const result: string[] = []
  for (const candidate of input) {
    if (typeof candidate !== 'string') continue
    const value = normalizeItem(section, candidate)
    if (value === '' || result.some(existing => sameItem(existing, value))) continue
    result.push(value)
  }
  return result
}

/** Load versioned Commonspace navigation state, falling back safely on corrupt or unknown data. */
export function readNavigationState(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): NavigationState {
  const fallback = defaultState()
  if (storage === undefined) return fallback
  try {
    const encoded = storage.getItem(COMMONSPACE_STORAGE_KEY)
    if (encoded === null) return fallback
    const parsed = JSON.parse(encoded) as unknown
    if (typeof parsed !== 'object' || parsed === null) return fallback
    const record = parsed as Record<string, unknown>
    if (record.version !== 1 || typeof record.items !== 'object' || record.items === null) return fallback
    const rawItems = record.items as Record<string, unknown>
    const items: NavigationState['items'] = {
      projects: sanitizeItems('projects', rawItems.projects, fallback.items.projects),
      channels: sanitizeItems('channels', rawItems.channels, fallback.items.channels),
      'direct-messages': sanitizeItems('direct-messages', rawItems['direct-messages'], fallback.items['direct-messages']),
    }

    let selected: NavigationSelection | null = null
    if (typeof record.selected === 'object' && record.selected !== null) {
      const candidate = record.selected as Record<string, unknown>
      if (
        typeof candidate.section === 'string'
        && sectionIds.includes(candidate.section as SectionId)
        && typeof candidate.value === 'string'
      ) {
        const section = candidate.section as SectionId
        const value = normalizeItem(section, candidate.value)
        const existing = items[section].find(item => sameItem(item, value))
        if (existing !== undefined) selected = { section, value: existing }
      }
    }

    return { version: 1, items, selected }
  } catch {
    return fallback
  }
}

/** Persist navigation state without allowing storage failures to break the DSH client. */
export function writeNavigationState(
  state: NavigationState,
  storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage,
): void {
  if (storage === undefined) return
  try {
    storage.setItem(COMMONSPACE_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage can be disabled or full; navigation remains usable in memory.
  }
}

/** Add one normalized item, selecting the existing row when the name is a duplicate. */
export function addNavigationItem(state: NavigationState, section: SectionId, input: string): NavigationState {
  const value = normalizeItem(section, input)
  if (value === '') return state
  const existing = state.items[section].find(item => sameItem(item, value))
  const selectedValue = existing ?? value
  return {
    ...state,
    items: existing === undefined
      ? { ...state.items, [section]: [...state.items[section], value] }
      : state.items,
    selected: { section, value: selectedValue },
  }
}

/** Select one existing item. */
export function selectNavigationItem(state: NavigationState, section: SectionId, value: string): NavigationState {
  const existing = state.items[section].find(item => sameItem(item, value))
  if (existing === undefined) return state
  return { ...state, selected: { section, value: existing } }
}

/** Remove one item and clear selection when that row was active. */
export function removeNavigationItem(state: NavigationState, section: SectionId, value: string): NavigationState {
  const items = state.items[section].filter(item => !sameItem(item, value))
  if (items.length === state.items[section].length) return state
  const selected = state.selected?.section === section && sameItem(state.selected.value, value)
    ? null
    : state.selected
  return { ...state, items: { ...state.items, [section]: items }, selected }
}
