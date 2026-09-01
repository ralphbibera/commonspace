import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { CommonspaceApp } from '@/CommonspaceApp'
import { createStoryStore } from '@/storybook-fixtures'

const meta = { title: 'Workspace/Complete App', component: CommonspaceApp, parameters: { layout: 'fullscreen' }, tags: ['autodocs'], args: { store: createStoryStore() as never } } satisfies Meta<typeof CommonspaceApp>
export default meta
type Story = StoryObj<typeof meta>

export const Dashboard: Story = { render: () => <CommonspaceApp store={createStoryStore() as never} /> }
export const NavigationFlow: Story = {
  render: () => <CommonspaceApp store={createStoryStore() as never} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: /Open Inbox/u }))
    await expect(canvas.getByRole('heading', { name: 'Inbox' })).toBeInTheDocument()
  },
}
