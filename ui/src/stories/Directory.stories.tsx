import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { CommonspaceDirectory, type CommonspaceDirectoryKind } from '@/CommonspaceDirectory'
import { createStoryStore, storyBootstrap } from '@/storybook-fixtures'

function DirectoryPreview({ kind }: { kind: CommonspaceDirectoryKind }) {
  return (
    <div className="h-screen">
      <CommonspaceDirectory
        kind={kind}
        bootstrap={storyBootstrap}
        store={createStoryStore() as never}
        onAdd={fn()}
        onOpenProject={fn()}
        onOpenConversation={fn()}
        onOpenSettings={fn()}
      />
    </div>
  )
}

const meta = { title: 'Screens/Directory', component: DirectoryPreview, parameters: { layout: 'fullscreen' }, tags: ['autodocs'] } satisfies Meta<typeof DirectoryPreview>
export default meta
type Story = StoryObj<typeof meta>

export const Projects: Story = { args: { kind: 'projects' } }
export const Channels: Story = { args: { kind: 'channels' }, play: async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await userEvent.click(canvas.getByRole('button', { name: 'More actions for general' }))
  await expect(await within(document.body).findByRole('menu')).toBeInTheDocument()
} }
export const Agents: Story = { args: { kind: 'agents' } }
