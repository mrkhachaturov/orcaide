import { describe, expect, it } from 'vitest'
import {
  getFloatingWorkspaceDirectoryInputValue,
  shouldUseServerDirectoryBrowser
} from './FloatingWorkspacePane'

describe('getFloatingWorkspaceDirectoryInputValue', () => {
  it('shows home shorthand for the default terminal directory', () => {
    expect(
      getFloatingWorkspaceDirectoryInputValue({
        configuredFloatingWorkspacePath: '~',
        resolvedFloatingWorkspacePath: '/Users/example'
      })
    ).toBe('~')
  })

  it('shows home shorthand for legacy blank terminal directory settings', () => {
    expect(
      getFloatingWorkspaceDirectoryInputValue({
        configuredFloatingWorkspacePath: '',
        resolvedFloatingWorkspacePath: '/Users/example'
      })
    ).toBe('~')
  })

  it('shows the main-resolved trusted custom directory', () => {
    expect(
      getFloatingWorkspaceDirectoryInputValue({
        configuredFloatingWorkspacePath: '/Users/example/notes',
        resolvedFloatingWorkspacePath: '/Users/example/notes'
      })
    ).toBe('/Users/example/notes')
  })

  it('falls back to the configured path before the async resolve returns', () => {
    // Why: a freshly picked directory must show immediately in the web tile,
    // where the server-side resolve is async (and briefly empty on first paint).
    expect(
      getFloatingWorkspaceDirectoryInputValue({
        configuredFloatingWorkspacePath: '/home/coder/.codex',
        resolvedFloatingWorkspacePath: ''
      })
    ).toBe('/home/coder/.codex')
  })
})

describe('shouldUseServerDirectoryBrowser', () => {
  it('browses the server host in the web tile when an environment is connected', () => {
    // Why: the web tile has no native OS dialog — pick the directory on the
    // connected Orca server via the host-fs browser instead.
    expect(
      shouldUseServerDirectoryBrowser({ isWebClient: true, activeRuntimeEnvironmentId: 'env-1' })
    ).toBe(true)
  })

  it('keeps the native picker on the desktop app', () => {
    expect(
      shouldUseServerDirectoryBrowser({ isWebClient: false, activeRuntimeEnvironmentId: 'env-1' })
    ).toBe(false)
  })

  it('falls back to the native picker in the web tile with no environment to browse', () => {
    // Why: RemoteFileBrowser needs a runtime environment id; without one there is
    // no host to list, so the button must not open an empty browser.
    expect(
      shouldUseServerDirectoryBrowser({ isWebClient: true, activeRuntimeEnvironmentId: null })
    ).toBe(false)
    expect(
      shouldUseServerDirectoryBrowser({ isWebClient: true, activeRuntimeEnvironmentId: '   ' })
    ).toBe(false)
  })
})
