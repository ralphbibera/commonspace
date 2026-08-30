export type SlashCommandContext = 'channel' | 'dm'
export type SlashCommandId = 'help' | 'stop' | 'new' | 'retry' | 'status' | 'agents'

export interface SlashCommandDefinition {
  id: SlashCommandId
  name: `/${string}`
  aliases: readonly `/${string}`[]
  description: string
  contexts: readonly SlashCommandContext[]
}

export interface ResolvedSlashCommand {
  command: SlashCommandDefinition
  args: string
}

export const COMMONSPACE_SLASH_COMMANDS: readonly SlashCommandDefinition[] = [
  {
    id: 'help',
    name: '/help',
    aliases: ['/commands'],
    description: 'Show the commands available in this chat',
    contexts: ['channel', 'dm'],
  },
  {
    id: 'stop',
    name: '/stop',
    aliases: ['/cancel'],
    description: 'Stop agent work started by the current message',
    contexts: ['channel', 'dm'],
  },
  {
    id: 'new',
    name: '/new',
    aliases: ['/clear', '/reset'],
    description: 'Start a fresh direct-message session',
    contexts: ['dm'],
  },
  {
    id: 'retry',
    name: '/retry',
    aliases: ['/again'],
    description: 'Send your most recent message again',
    contexts: ['channel', 'dm'],
  },
  {
    id: 'status',
    name: '/status',
    aliases: [],
    description: 'Show this conversation and agent runtime',
    contexts: ['channel', 'dm'],
  },
  {
    id: 'agents',
    name: '/agents',
    aliases: ['/tasks'],
    description: 'List agents available to Commonspace',
    contexts: ['channel', 'dm'],
  },
]

function supportsContext(command: SlashCommandDefinition, context: SlashCommandContext): boolean {
  return command.contexts.includes(context)
}

export function slashCommandSuggestions(input: string, context: SlashCommandContext): SlashCommandDefinition[] {
  if (!input.startsWith('/') || /\s/.test(input)) return []
  const prefix = input.toLocaleLowerCase()
  return COMMONSPACE_SLASH_COMMANDS.filter(command => supportsContext(command, context) &&
    [command.name, ...command.aliases].some(token => token.toLocaleLowerCase().startsWith(prefix)))
}

export function resolveSlashCommand(input: string, context: SlashCommandContext): ResolvedSlashCommand | null {
  const normalized = input.trim()
  if (!normalized.startsWith('/')) return null
  const separator = normalized.search(/\s/)
  const token = (separator === -1 ? normalized : normalized.slice(0, separator)).toLocaleLowerCase()
  const command = COMMONSPACE_SLASH_COMMANDS.find(candidate => supportsContext(candidate, context) &&
    [candidate.name, ...candidate.aliases].some(name => name.toLocaleLowerCase() === token))
  if (command === undefined) return null
  return { command, args: separator === -1 ? '' : normalized.slice(separator).trim() }
}
