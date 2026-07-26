import { describe, expect, it } from 'vitest'
import { resolveFloatingWorkspaceRuntimeEnvironmentId } from './floating-workspace-runtime-owner'

describe('resolveFloatingWorkspaceRuntimeEnvironmentId', () => {
  it('keeps the floating workspace local on the desktop app', () => {
    // Why: the desktop floating workspace is a deliberate local scratch surface —
    // focusing a remote runtime must not move the user's notes pad onto it.
    expect(
      resolveFloatingWorkspaceRuntimeEnvironmentId({
        isWebClient: false,
        activeRuntimeEnvironmentId: 'env-1'
      })
    ).toBeNull()
  })

  it('owns the floating workspace with the connected runtime in the web client', () => {
    // Why: the browser has no local shell, webview or file dialog to own it.
    expect(
      resolveFloatingWorkspaceRuntimeEnvironmentId({
        isWebClient: true,
        activeRuntimeEnvironmentId: 'env-1'
      })
    ).toBe('env-1')
  })

  it('stays local in a web client with no runtime to own it', () => {
    // Why: a null owner fails honestly through the existing local path instead of
    // addressing RPCs at an environment that is not there.
    expect(
      resolveFloatingWorkspaceRuntimeEnvironmentId({
        isWebClient: true,
        activeRuntimeEnvironmentId: null
      })
    ).toBeNull()
    expect(
      resolveFloatingWorkspaceRuntimeEnvironmentId({
        isWebClient: true,
        activeRuntimeEnvironmentId: undefined
      })
    ).toBeNull()
    expect(
      resolveFloatingWorkspaceRuntimeEnvironmentId({
        isWebClient: true,
        activeRuntimeEnvironmentId: '   '
      })
    ).toBeNull()
  })

  it('trims the environment id so a padded setting still addresses the runtime', () => {
    expect(
      resolveFloatingWorkspaceRuntimeEnvironmentId({
        isWebClient: true,
        activeRuntimeEnvironmentId: '  env-1  '
      })
    ).toBe('env-1')
  })
})
