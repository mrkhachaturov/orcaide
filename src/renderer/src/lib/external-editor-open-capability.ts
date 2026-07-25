import type { GlobalSettings } from '../../../shared/types'
import { isOpenInUrlTemplateUsable } from '../../../shared/open-in-url-template'
import { isVsCodeRemoteSshCommand } from '../../../shared/vscode-remote-ssh-launcher'

export type ExternalEditorOpenCapability =
  | { allowed: true; remote: boolean }
  | { allowed: false; reason: 'remote-runtime' | 'local-only-editor' | 'invalid-url' }

export function getExternalEditorOpenCapability(
  settings: Pick<GlobalSettings, 'activeRuntimeEnvironmentId'> | null | undefined,
  context: { connectionId?: string | null; command?: string; url?: string }
): ExternalEditorOpenCapability {
  // Why URL entries skip every check below: the guards exist because `command` spawns a process
  // on THIS machine against a path that belongs to another one. A URL has neither problem — it is
  // navigation, and the host that owns the path is the one serving it. Blocking these is what
  // leaves a remote runtime with no way to open a worktree in an editor at all.
  //
  // Why it wins even over an SSH connection with a command set: an entry that carries both is
  // declaring "reach me through the browser", and the URL's host is the one that owns the path in
  // every deployment that seeds one. The Settings pane shows the URL field on any such row, so
  // the precedence is visible and clearable rather than silent.
  if (context.url?.trim()) {
    // Why validity is a capability and not a click-time error: an unusable template can only come
    // from a hand-edited store or a seed, and rendering it enabled just to fail on click is the
    // worst of both. Disabled-with-a-reason is honest at the moment the user reads the menu.
    return isOpenInUrlTemplateUsable(context.url)
      ? { allowed: true, remote: false }
      : { allowed: false, reason: 'invalid-url' }
  }
  if (settings?.activeRuntimeEnvironmentId?.trim()) {
    return { allowed: false, reason: 'remote-runtime' }
  }
  if (!context.connectionId?.trim()) {
    return { allowed: true, remote: false }
  }
  return isVsCodeRemoteSshCommand(context.command)
    ? { allowed: true, remote: true }
    : { allowed: false, reason: 'local-only-editor' }
}
