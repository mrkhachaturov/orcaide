import { describe, expect, it } from 'vitest'
import { getExternalEditorOpenCapability } from './external-editor-open-capability'

describe('getExternalEditorOpenCapability', () => {
  it('allows every configured launcher for local paths', () => {
    expect(
      getExternalEditorOpenCapability(
        { activeRuntimeEnvironmentId: null },
        { connectionId: null, command: 'cursor --new-window' }
      )
    ).toEqual({ allowed: true, remote: false })
  })

  it('allows supported VS Code commands for SSH paths', () => {
    expect(
      getExternalEditorOpenCapability(
        { activeRuntimeEnvironmentId: null },
        { connectionId: 'ssh-1', command: 'code-insiders' }
      )
    ).toEqual({ allowed: true, remote: true })
  })

  it('rejects non-VS Code and compound commands for SSH paths', () => {
    expect(
      getExternalEditorOpenCapability(
        { activeRuntimeEnvironmentId: null },
        { connectionId: 'ssh-1', command: 'cursor' }
      )
    ).toEqual({ allowed: false, reason: 'local-only-editor' })
    expect(
      getExternalEditorOpenCapability(
        { activeRuntimeEnvironmentId: null },
        { connectionId: 'ssh-1', command: 'code --reuse-window' }
      )
    ).toEqual({ allowed: false, reason: 'local-only-editor' })
  })

  it('rejects every local-app launch while a remote runtime is active', () => {
    expect(
      getExternalEditorOpenCapability(
        { activeRuntimeEnvironmentId: 'runtime-1' },
        { connectionId: 'ssh-1', command: 'code' }
      )
    ).toEqual({ allowed: false, reason: 'remote-runtime' })
  })

  // Why this whole block: a browser-editor entry is the only "Open in" target a remote runtime
  // can offer, and the point of the URL path is that it survives the guards above.
  it('allows a URL entry even while a remote runtime is active', () => {
    expect(
      getExternalEditorOpenCapability(
        { activeRuntimeEnvironmentId: 'web-runtime-1' },
        { connectionId: null, command: '', url: 'https://cs.example.com/?folder={path}' }
      )
    ).toEqual({ allowed: true, remote: false })
  })

  it('allows a URL entry over an SSH connection a command could not serve', () => {
    expect(
      getExternalEditorOpenCapability(
        { activeRuntimeEnvironmentId: null },
        { connectionId: 'ssh-1', command: 'cursor', url: 'https://cs.example.com/?folder={path}' }
      )
    ).toEqual({ allowed: true, remote: false })
  })

  // Why validity is checked here rather than at click time: an unusable template rendered as an
  // enabled menu item is a click that can only fail. It must read as disabled.
  it('rejects a URL entry whose template could never navigate', () => {
    for (const url of ['javascript:alert(1)//{path}', 'file:///etc/passwd', 'not a url']) {
      expect(
        getExternalEditorOpenCapability(
          { activeRuntimeEnvironmentId: 'web-runtime-1' },
          { connectionId: null, command: '', url }
        )
      ).toEqual({ allowed: false, reason: 'invalid-url' })
    }
  })

  it('ignores a whitespace-only url and falls through to the command rules', () => {
    expect(
      getExternalEditorOpenCapability(
        { activeRuntimeEnvironmentId: null },
        { connectionId: null, command: 'cursor', url: '   ' }
      )
    ).toEqual({ allowed: true, remote: false })
  })
})
