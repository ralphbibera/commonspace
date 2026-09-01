import type { Meta, StoryObj } from '@storybook/react-vite'
import { CommonspaceConversation } from '@/CommonspaceConversation'
import { createStoryStore } from '@/storybook-fixtures'

function ChannelConversation({ threadOpen = false }: { threadOpen?: boolean }) {
  const store = createStoryStore()
  store.selectConversation({ kind: 'channel', id: 'general' })
  if (threadOpen) store.selectThread('thread-attention')
  return <div className="h-screen"><CommonspaceConversation store={store as never} /></div>
}

const meta = { title: 'Screens/Conversation', component: ChannelConversation, parameters: { layout: 'fullscreen' }, tags: ['autodocs'] } satisfies Meta<typeof ChannelConversation>
export default meta
type Story = StoryObj<typeof meta>
export const Channel: Story = { args: { threadOpen: false } }
export const ThreadOpen: Story = { args: { threadOpen: true } }
