import { describe, expect, it } from 'vitest'
import { resolveSlashCommand, slashCommandSuggestions } from '../ui/src/slash-commands.ts'

describe('Commonspace slash commands', () => {
  it('suggests commands and aliases case-insensitively for the active conversation', () => {
    expect(slashCommandSuggestions('/', 'dm').map(command => command.name)).toEqual([
      '/help',
      '/new',
      '/retry',
      '/status',
      '/agents',
    ])
    expect(slashCommandSuggestions('/CL', 'dm').map(command => command.name)).toEqual(['/new'])
    expect(slashCommandSuggestions('/', 'channel').map(command => command.name)).not.toContain('/new')
    expect(slashCommandSuggestions('please /help', 'dm')).toEqual([])
  })

  it('resolves canonical commands and Hermes-style aliases without forwarding unknown input', () => {
    expect(resolveSlashCommand('/status', 'dm')).toMatchObject({ command: { id: 'status' }, args: '' })
    expect(resolveSlashCommand('/clear now', 'dm')).toMatchObject({ command: { id: 'new' }, args: 'now' })
    expect(resolveSlashCommand('/reset', 'dm')).toMatchObject({ command: { id: 'new' }, args: '' })
    expect(resolveSlashCommand('/new', 'channel')).toBeNull()
    expect(resolveSlashCommand('/does-not-exist', 'dm')).toBeNull()
  })
})
