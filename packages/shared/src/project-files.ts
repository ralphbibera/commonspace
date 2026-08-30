export type ProjectFilePreview = 'text' | 'image' | 'video' | 'binary' | 'blocked'

export interface ProjectFileEntry {
  name: string
  path: string
  kind: 'directory' | 'file'
  size?: number
  preview?: ProjectFilePreview
  contentType?: string
}

export interface ProjectDirectoryResponse {
  projectId: string
  rootIndex: number
  path: string
  entries: ProjectFileEntry[]
  truncated: boolean
}

export type ProjectGitFileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted'

export interface ProjectGitFileChange {
  path: string
  oldPath?: string
  status: ProjectGitFileStatus
  indexStatus: string
  worktreeStatus: string
  additions: number | null
  deletions: number | null
  preview: ProjectFilePreview
}

export type ProjectGitStatusResponse =
  | {
      available: true
      branch: string | null
      head: string | null
      clean: boolean
      files: ProjectGitFileChange[]
      truncated: boolean
    }
  | {
      available: false
      reason: string
      files: []
    }

export interface ProjectGitDiffResponse {
  path: string
  patch: string
  binary: boolean
  truncated: boolean
}
