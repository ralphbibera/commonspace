export const COMMONSPACE_STORAGE_KEY = 'commonspace.navigation.v2'
const LEGACY_STORAGE_KEY = 'commonspace.navigation.v1'

export const sectionIds = ['projects', 'channels', 'direct-messages'] as const
export type SectionId = typeof sectionIds[number]

export interface NavigationItem {
  id: string
  label: string
  sessionId?: string
  workspaceId?: string
}

export interface NavigationSelection {
  section: SectionId
  itemId: string
}

export interface NavigationState {
  version: 2
  items: Record<SectionId, NavigationItem[]>
  selected: NavigationSelection | null
  activeProjectId: string | null
}

export interface NavigationItemMetadata {
  sessionId?: string
  workspaceId?: string
}

const DEFAULT_SPECIALISTS = ['Frontend', 'Backend', 'Researcher', 'Designer', 'Reviewer'] as const

function itemId(section: SectionId, label: string): string {
  return `${section}:${encodeURIComponent(label.toLocaleLowerCase())}`
}

function makeItem(section: SectionId, label: string, metadata: NavigationItemMetadata = {}): NavigationItem {
  return { id: itemId(section, label), label, ...metadata }
}

function defaultState(): NavigationState {
  return {
    version: 2,
    items: {
      projects: [],
      channels: [makeItem('channels', 'general')],
      'direct-messages': DEFAULT_SPECIALISTS.map(label => makeItem('direct-messages', label)),
    },
    selected: null,
    activeProjectId: null,
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

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

function sanitizeItems(
  section: SectionId,
  input: unknown,
  fallback: readonly NavigationItem[],
): NavigationItem[] {
  if (!Array.isArray(input)) return fallback.map(item => ({ ...item }))
  const result: NavigationItem[] = []
  for (const candidate of input) {
    const record = typeof candidate === 'object' && candidate !== null
      ? candidate as Record<string, unknown>
      : undefined
    const rawLabel = typeof candidate === 'string' ? candidate : record?.label
    if (typeof rawLabel !== 'string') continue
    const label = normalizeItem(section, rawLabel)
    if (label === '' || result.some(existing => sameItem(existing.label, label))) continue
    const sessionId = optionalString(record?.sessionId)
    const workspaceId = optionalString(record?.workspaceId)
    result.push(makeItem(section, label, {
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(workspaceId === undefined ? {} : { workspaceId }),
    }))
  }
  return result
}

function findItem(state: NavigationState, section: SectionId, value: string): NavigationItem | undefined {
  return state.items[section].find(item => item.id === value || sameItem(item.label, value))
}

function parseState(parsed: unknown, fallback: NavigationState): NavigationState {
  if (typeof parsed !== 'object' || parsed === null) return fallback
  const record = parsed as Record<string, unknown>
  if (typeof record.items !== 'object' || record.items === null) return fallback
  const rawItems = record.items as Record<string, unknown>
  const items: NavigationState['items'] = {
    projects: sanitizeItems('projects', rawItems.projects, fallback.items.projects),
    channels: sanitizeItems('channels', rawItems.channels, fallback.items.channels),
    'direct-messages': sanitizeItems(
      'direct-messages',
      rawItems['direct-messages'],
      fallback.items['direct-messages'],
    ),
  }

  // Version-one records stored selected labels. Version two stores stable ids.
  let selected: NavigationSelection | null = null
  if (typeof record.selected === 'object' && record.selected !== null) {
    const candidate = record.selected as Record<string, unknown>
    if (typeof candidate.section === 'string' && sectionIds.includes(candidate.section as SectionId)) {
      const section = candidate.section as SectionId
      const rawValue = optionalString(candidate.itemId) ?? optionalString(candidate.value)
      const existing = rawValue === undefined ? undefined : findItem({ ...fallback, items }, section, rawValue)
      if (existing !== undefined) selected = { section, itemId: existing.id }
    }
  }

  const requestedProject = optionalString(record.activeProjectId)
  const selectedProject = selected?.section === 'projects' ? selected.itemId : undefined
  const activeProjectId = items.projects.some(project => project.id === (requestedProject ?? selectedProject))
    ? requestedProject ?? selectedProject ?? null
    : null

  // Existing v1 users receive the reusable specialist roster once during migration.
  if (record.version === 1) {
    for (const label of DEFAULT_SPECIALISTS) {
      if (!items['direct-messages'].some(item => sameItem(item.label, label))) {
        items['direct-messages'].push(makeItem('direct-messages', label))
      }
    }
  }

  return { version: 2, items, selected, activeProjectId }
}

/** Load versioned Commonspace state, migrating v1 and falling back safely on corrupt data. */
export function readNavigationState(storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): NavigationState {
  const fallback = defaultState()
  if (storage === undefined) return fallback
  try {
    const encoded = storage.getItem(COMMONSPACE_STORAGE_KEY) ?? storage.getItem(LEGACY_STORAGE_KEY)
    if (encoded === null) return fallback
    return parseState(JSON.parse(encoded) as unknown, fallback)
  } catch {
    return fallback
  }
}

/** Persist Commonspace state without allowing storage failures to break the DSH client. */
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
export function addNavigationItem(
  state: NavigationState,
  section: SectionId,
  input: string,
  metadata: NavigationItemMetadata = {},
): NavigationState {
  const label = normalizeItem(section, input)
  if (label === '') return state
  const existing = state.items[section].find(item => sameItem(item.label, label))
  const item = existing ?? makeItem(section, label, metadata)
  return {
    ...state,
    items: existing === undefined
      ? { ...state.items, [section]: [...state.items[section], item] }
      : state.items,
    selected: { section, itemId: item.id },
    activeProjectId: section === 'projects' ? item.id : state.activeProjectId,
  }
}

/** Select one existing item, making a project the current context source. */
export function selectNavigationItem(state: NavigationState, section: SectionId, value: string): NavigationState {
  const existing = findItem(state, section, value)
  if (existing === undefined) return state
  return {
    ...state,
    selected: { section, itemId: existing.id },
    activeProjectId: section === 'projects' ? existing.id : state.activeProjectId,
  }
}

/** Attach a real Harness workspace/session identity to one navigation item. */
export function bindNavigationItem(
  state: NavigationState,
  section: SectionId,
  value: string,
  metadata: NavigationItemMetadata,
): NavigationState {
  const existing = findItem(state, section, value)
  if (existing === undefined) return state
  return {
    ...state,
    items: {
      ...state.items,
      [section]: state.items[section].map(item => item.id === existing.id ? { ...item, ...metadata } : item),
    },
  }
}

/** Resolve the currently active project context. */
export function activeProject(state: NavigationState): NavigationItem | undefined {
  return state.activeProjectId === null
    ? undefined
    : state.items.projects.find(item => item.id === state.activeProjectId)
}

/** Remove one item and clear selection/context when that row was active. */
export function removeNavigationItem(state: NavigationState, section: SectionId, value: string): NavigationState {
  const existing = findItem(state, section, value)
  if (existing === undefined) return state
  const items = state.items[section].filter(item => item.id !== existing.id)
  const selected = state.selected?.section === section && state.selected.itemId === existing.id
    ? null
    : state.selected
  const activeProjectId = section === 'projects' && state.activeProjectId === existing.id
    ? null
    : state.activeProjectId
  return { ...state, items: { ...state.items, [section]: items }, selected, activeProjectId }
}
