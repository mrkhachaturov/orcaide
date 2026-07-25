import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu'
import {
  getWorktreeOpenInEntries,
  getOpenInEntryAvailability,
  getLocalFileManagerLabel,
  openOpenInAppsSettings,
  openWorktreeOpenInEntry,
  openWorktreePath,
  WorktreeOpenInSubMenu
} from './WorktreeOpenInMenu'

type ReactElementLike = {
  type: unknown
  props: Record<string, unknown>
}

const {
  mockState,
  openInExternalEditorMock,
  openInFileManagerMock,
  openUrlMock,
  openSettingsPageMock,
  openSettingsTargetMock,
  toastErrorMock
} = vi.hoisted(() => ({
  mockState: {
    settings: {
      activeRuntimeEnvironmentId: null as string | null,
      openInApplications: [] as { id: string; label: string; command: string; url?: string }[]
    }
  },
  openInExternalEditorMock: vi.fn(),
  openInFileManagerMock: vi.fn(),
  openUrlMock: vi.fn(),
  openSettingsPageMock: vi.fn(),
  openSettingsTargetMock: vi.fn(),
  toastErrorMock: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock
  }
}))

vi.mock('@/store', () => {
  const useAppStore = Object.assign(
    (selector: (state: { settings: typeof mockState.settings }) => unknown) =>
      selector({ settings: mockState.settings }),
    {
      getState: () => ({
        settings: mockState.settings,
        openSettingsPage: openSettingsPageMock,
        openSettingsTarget: openSettingsTargetMock
      })
    }
  )
  return { useAppStore }
})

function visit(node: unknown, cb: (node: ReactElementLike) => void): void {
  if (node == null || typeof node === 'string' || typeof node === 'number') {
    return
  }
  if (Array.isArray(node)) {
    node.forEach((entry) => visit(entry, cb))
    return
  }
  const element = node as ReactElementLike
  cb(element)
  if (element.props?.children) {
    visit(element.props.children, cb)
  }
}

function findByType(node: unknown, type: unknown): ReactElementLike {
  let found: ReactElementLike | null = null
  visit(node, (entry) => {
    if (entry.type === type) {
      found = entry
    }
  })
  if (!found) {
    throw new Error('element not found')
  }
  return found
}

describe('WorktreeOpenInMenu', () => {
  beforeEach(() => {
    mockState.settings = { activeRuntimeEnvironmentId: null, openInApplications: [] }
    toastErrorMock.mockReset()
    openInFileManagerMock.mockReset()
    openInExternalEditorMock.mockReset()
    openUrlMock.mockReset()
    openSettingsPageMock.mockReset()
    openSettingsTargetMock.mockReset()
    openInFileManagerMock.mockResolvedValue({ ok: true })
    openInExternalEditorMock.mockResolvedValue({ ok: true })
    openUrlMock.mockResolvedValue(undefined)
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        api: {
          shell: {
            openInFileManager: openInFileManagerMock,
            openInExternalEditor: openInExternalEditorMock,
            openUrl: openUrlMock
          }
        }
      }
    })
  })

  it('maps file manager labels by platform', () => {
    expect(getLocalFileManagerLabel('Mozilla/5.0 Mac OS X')).toBe('Finder')
    expect(getLocalFileManagerLabel('Mozilla/5.0 Windows NT 10.0')).toBe('File Explorer')
    expect(getLocalFileManagerLabel('Mozilla/5.0 X11 Linux x86_64')).toBe('File Manager')
  })

  it('disables the Open in submenu while deleting', () => {
    const tree = WorktreeOpenInSubMenu({
      worktreePath: '/tmp/workspace',
      connectionId: null,
      disabled: true
    })

    expect(findByType(tree, DropdownMenuSubTrigger).props.disabled).toBe(true)
  })

  it('stops menu item click propagation', () => {
    const tree = WorktreeOpenInSubMenu({
      worktreePath: '/tmp/workspace',
      connectionId: null
    })
    const menuContent = findByType(tree, DropdownMenuSubContent)

    const stopPropagation = vi.fn()
    const handler = menuContent.props.onClick as ((event: React.SyntheticEvent) => void) | null
    handler?.({ stopPropagation } as unknown as React.SyntheticEvent)
    expect(stopPropagation).toHaveBeenCalled()
  })

  it('uses the blocked-path toast without calling main IPC', async () => {
    mockState.settings = { activeRuntimeEnvironmentId: 'runtime-1', openInApplications: [] }

    await openWorktreePath({
      target: 'file-manager',
      worktreePath: '/tmp/workspace',
      connectionId: null
    })

    expect(toastErrorMock).toHaveBeenCalledWith(
      'Opening remote paths in the local OS is not available.'
    )
    expect(openInFileManagerMock).not.toHaveBeenCalled()
    expect(openInExternalEditorMock).not.toHaveBeenCalled()
  })

  it('shows an actionable toast when the host launcher fails', async () => {
    openInExternalEditorMock.mockResolvedValueOnce({ ok: false, reason: 'launch-failed' })

    await openWorktreePath({
      target: 'external-editor',
      worktreePath: '/tmp/workspace',
      connectionId: null
    })

    expect(openInExternalEditorMock).toHaveBeenCalledWith({
      path: '/tmp/workspace',
      command: undefined,
      connectionId: null
    })
    expect(toastErrorMock).toHaveBeenCalledWith('Could not open workspace folder.', {
      description: 'Check the editor command or file manager configuration on this machine.'
    })
  })

  it('builds menu entries from configured launchers with file manager last', () => {
    expect(
      getWorktreeOpenInEntries(
        [
          { id: 'vscode', label: 'VS Code', command: 'code' },
          { id: 'cursor', label: 'Cursor', command: 'cursor' },
          { id: 'zed', label: 'Zed', command: 'zed' }
        ],
        'File Manager'
      ).map((entry) => entry.label)
    ).toEqual(['VS Code', 'Cursor', 'Zed', 'File Manager'])
  })

  it('opens settings at the Open In Apps section', () => {
    openOpenInAppsSettings()

    expect(openSettingsTargetMock).toHaveBeenCalledWith({
      pane: 'general',
      repoId: null,
      sectionId: 'general-open-in-apps'
    })
    expect(openSettingsPageMock).toHaveBeenCalled()
  })

  it('forwards the configured command when opening a configured launcher', async () => {
    await openWorktreePath({
      target: 'external-editor',
      worktreePath: '/tmp/workspace',
      connectionId: null,
      command: 'cursor'
    })
    expect(openInExternalEditorMock).toHaveBeenCalledWith({
      path: '/tmp/workspace',
      command: 'cursor',
      connectionId: null
    })
  })

  it('blocks configured launchers in remote context before calling main IPC', async () => {
    mockState.settings = { activeRuntimeEnvironmentId: 'runtime-1', openInApplications: [] }

    await openWorktreePath({
      target: 'external-editor',
      worktreePath: '/tmp/workspace',
      connectionId: null,
      command: 'cursor'
    })

    expect(openInExternalEditorMock).not.toHaveBeenCalled()
    expect(toastErrorMock).toHaveBeenCalledWith(
      'Opening this path in a local app is not available.',
      { description: 'Switch to a local or SSH workspace, then try again.' }
    )
  })

  it('enables only VS Code-compatible launchers for SSH paths', () => {
    const entries = getWorktreeOpenInEntries(
      [
        { id: 'renamed', label: 'My Remote Editor', command: 'code-insiders' },
        { id: 'fake', label: 'VS Code', command: 'cursor' },
        { id: 'compound', label: 'VS Code Reuse', command: 'code --reuse-window' }
      ],
      'Finder'
    )

    expect(getOpenInEntryAvailability(entries[0], mockState.settings, 'ssh-1')).toEqual({
      disabled: false,
      metadata: 'Remote SSH'
    })
    expect(getOpenInEntryAvailability(entries[1], mockState.settings, 'ssh-1')).toEqual({
      disabled: true,
      metadata: 'Local only'
    })
    expect(getOpenInEntryAvailability(entries[2], mockState.settings, 'ssh-1')).toEqual({
      disabled: true,
      metadata: 'Local only'
    })
    expect(getOpenInEntryAvailability(entries[3], mockState.settings, 'ssh-1')).toEqual({
      disabled: true,
      metadata: 'Local only'
    })
  })

  it('forwards SSH context for a supported VS Code launcher', async () => {
    await openWorktreePath({
      target: 'external-editor',
      worktreePath: '/home/ada/project',
      connectionId: 'ssh-1',
      command: 'code'
    })

    expect(openInExternalEditorMock).toHaveBeenCalledWith({
      path: '/home/ada/project',
      command: 'code',
      connectionId: 'ssh-1'
    })
  })

  it('blocks SSH local-only launchers before IPC with actionable copy', async () => {
    await openWorktreePath({
      target: 'external-editor',
      worktreePath: '/home/ada/project',
      connectionId: 'ssh-1',
      command: 'cursor'
    })

    expect(openInExternalEditorMock).not.toHaveBeenCalled()
    expect(toastErrorMock).toHaveBeenCalledWith('This app cannot open SSH workspaces.', {
      description: 'Choose VS Code or use the app locally.'
    })
  })

  it('shows the SSH alias recovery details returned by main', async () => {
    openInExternalEditorMock.mockResolvedValueOnce({
      ok: false,
      reason: 'ssh-alias-required',
      host: 'builder.example.com',
      port: 2222
    })

    await openWorktreePath({
      target: 'external-editor',
      worktreePath: '/srv/project',
      connectionId: 'ssh-1',
      command: 'code'
    })

    expect(toastErrorMock).toHaveBeenCalledWith(
      'VS Code needs an SSH config alias for this host.',
      {
        description:
          'Add a Host alias for builder.example.com:2222 to your local SSH config, reconnect the workspace, then try again.'
      }
    )
  })
})

// Why a whole block: the browser tile IS the remote-runtime case, so a URL entry is the only
// "Open in" target it can ever offer. Every assertion here is something the tile depends on.
describe('WorktreeOpenInMenu URL entries', () => {
  const CODE_SERVER = {
    id: 'code-server',
    label: 'code-server',
    command: '',
    url: 'https://cs.example.com/?folder={path}'
  }

  beforeEach(() => {
    mockState.settings = {
      activeRuntimeEnvironmentId: 'web-runtime-1',
      openInApplications: [CODE_SERVER]
    }
    toastErrorMock.mockReset()
    openInExternalEditorMock.mockReset()
    openInExternalEditorMock.mockResolvedValue({ ok: true })
    openUrlMock.mockReset()
    openUrlMock.mockResolvedValue(undefined)
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        api: {
          shell: {
            openInFileManager: openInFileManagerMock,
            openInExternalEditor: openInExternalEditorMock,
            openUrl: openUrlMock
          }
        }
      }
    })
  })

  it('carries the url onto the menu entry', () => {
    const [entry] = getWorktreeOpenInEntries([CODE_SERVER], 'File Manager')

    expect(entry).toMatchObject({ id: 'code-server', url: CODE_SERVER.url })
  })

  it('enables a URL entry even though the runtime is remote', () => {
    const [entry] = getWorktreeOpenInEntries([CODE_SERVER], 'File Manager')

    expect(getOpenInEntryAvailability(entry, mockState.settings, null)).toEqual({ disabled: false })
  })

  // Why: the availability check and the click used to disagree — the item read as enabled and the
  // click then re-derived capability WITHOUT the url and refused. This is that regression.
  it('opens the resolved URL instead of reaching for a local editor', async () => {
    const [entry] = getWorktreeOpenInEntries([CODE_SERVER], 'File Manager')

    await openWorktreeOpenInEntry(entry, { worktreePath: '/home/coder/proj', connectionId: null })

    expect(openUrlMock).toHaveBeenCalledWith('https://cs.example.com/?folder=%2Fhome%2Fcoder%2Fproj')
    expect(openInExternalEditorMock).not.toHaveBeenCalled()
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it('still routes a command entry to the local editor through the same helper', async () => {
    mockState.settings = { activeRuntimeEnvironmentId: null, openInApplications: [] }
    const [entry] = getWorktreeOpenInEntries(
      [{ id: 'cursor', label: 'Cursor', command: 'cursor' }],
      'File Manager'
    )

    await openWorktreeOpenInEntry(entry, { worktreePath: '/tmp/proj', connectionId: null })

    expect(openInExternalEditorMock).toHaveBeenCalledWith({
      path: '/tmp/proj',
      command: 'cursor',
      connectionId: null
    })
    expect(openUrlMock).not.toHaveBeenCalled()
  })

  it('disables an entry whose URL could never navigate, and says why', () => {
    const [entry] = getWorktreeOpenInEntries(
      [{ ...CODE_SERVER, url: 'javascript:alert(1)' }],
      'File Manager'
    )

    expect(getOpenInEntryAvailability(entry, mockState.settings, null)).toEqual({
      disabled: true,
      metadata: 'Invalid URL'
    })
  })
})
