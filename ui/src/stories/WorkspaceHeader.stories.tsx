import type { Meta, StoryObj } from '@storybook/react-vite'
import { InboxIcon, SettingsIcon } from 'lucide-react'
import { CommonspaceLogo } from '@/design-system/CommonspaceLogo'
import { WorkspaceHeader } from '@/design-system/WorkspaceHeader'

const meta = { title: 'Foundation/Workspace Header', component: WorkspaceHeader, parameters: { layout: 'fullscreen' }, tags: ['autodocs'] } satisfies Meta<typeof WorkspaceHeader>
export default meta
type Story = StoryObj<typeof meta>

export const Dashboard: Story = { args: { title: 'Dashboard', mark: <CommonspaceLogo decorative className="size-5" /> } }
export const Inbox: Story = { args: { title: 'Inbox', subtitle: 'Agent replies, requests, and native session outcomes', mark: <InboxIcon className="size-[17px]" /> } }
export const Project: Story = { args: { title: 'Commonspace', subtitle: '2 conversations · 1 folder · working directory', mark: <CommonspaceLogo decorative className="size-5" />, actions: <button type="button" className="grid size-11 place-items-center rounded-full border-0 bg-transparent text-muted-foreground hover:bg-muted"><SettingsIcon className="size-[18px]" aria-hidden="true" /><span className="sr-only">Open project settings</span></button> } }
