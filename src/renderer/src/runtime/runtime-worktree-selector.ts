import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../shared/constants'
import { isEphemeralSetupTerminalWorktreeId } from '../../../shared/ephemeral-setup-terminal-worktree-id'

const RUNTIME_WORKTREE_ID_SELECTOR_PREFIX = 'id:'

/** Address a raw worktree id as a runtime `id:` selector; passes through empty or already-prefixed values. */
export function toRuntimeWorktreeSelector(worktreeId: string): string {
  const trimmed = worktreeId.trim()
  if (!trimmed || trimmed.startsWith(RUNTIME_WORKTREE_ID_SELECTOR_PREFIX)) {
    return trimmed
  }
  return `${RUNTIME_WORKTREE_ID_SELECTOR_PREFIX}${trimmed}`
}

/**
 * Runtime selector for a terminal's worktree id. Ephemeral setup terminals have no
 * worktree on the runtime, so resolve them to the floating-terminal scope (home dir)
 * every runtime understands; other ids map to their own `id:` selector.
 */
export function toRuntimeTerminalWorktreeSelector(worktreeId: string): string {
  if (isEphemeralSetupTerminalWorktreeId(worktreeId.trim())) {
    return toRuntimeWorktreeSelector(FLOATING_TERMINAL_WORKTREE_ID)
  }
  return toRuntimeWorktreeSelector(worktreeId)
}

/**
 * Runtime selector for a browser tab's worktree id, or `undefined` for an unscoped page.
 *
 * The floating sentinel is terminal-only on the runtime: `resolveTerminalWorkspaceLaunchScope`
 * answers it with the home dir, but `resolveWorktreeSelector` — which every other workspace
 * API goes through, `browser.tabCreate` included — has no repo/worktree record to return and
 * throws. `browser.tabCreate` already treats `worktree` as optional and backs an unscoped page
 * with the offscreen WebContents, which is exactly what a floating browser wants.
 */
export function toRuntimeBrowserWorktreeSelector(worktreeId: string): string | undefined {
  return worktreeId.trim() === FLOATING_TERMINAL_WORKTREE_ID
    ? undefined
    : toRuntimeWorktreeSelector(worktreeId)
}
