import { useEffect, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import type { FloatingTerminalTriggerLocation, GlobalSettings } from '../../../../shared/types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { RemoteFileBrowser } from '../sidebar/RemoteFileBrowser'
import { SearchableSetting } from './SearchableSetting'
import { SettingsRow, SettingsSwitchRow } from './SettingsFormControls'
import { getFloatingWorkspaceSearchEntries } from './floating-workspace-search'
import { matchesSettingsSearch } from './settings-search'
import { useAppStore } from '../../store'
import { isWebClientLocation } from '@/lib/web-client-location'
import { translate } from '@/i18n/i18n'

type FloatingWorkspacePaneProps = {
  settings: GlobalSettings
  updateSettings: (updates: Partial<GlobalSettings>) => void
}

export function getFloatingWorkspaceDirectoryInputValue({
  configuredFloatingWorkspacePath,
  resolvedFloatingWorkspacePath
}: {
  configuredFloatingWorkspacePath: string
  resolvedFloatingWorkspacePath: string
}): string {
  const configuredPath = configuredFloatingWorkspacePath.trim()
  if (!configuredPath || configuredPath === '~') {
    return '~'
  }
  // Why: prefer the main/server-resolved path (expands `~`, canonicalizes), but
  // fall back to the configured path so a freshly picked directory is shown
  // immediately — before the async resolve returns, or if it can't resolve.
  return resolvedFloatingWorkspacePath || configuredPath
}

// Why: the web tile has no native OS file dialog, and its floating terminals run
// on the Orca server (the workspace host) — so a start directory must be chosen
// ON that host. When an environment is connected, route the picker through the
// same host-fs browser the "Add a project" flow uses (`files.browseServerDir`
// RPC) instead of the stubbed native dialog. Desktop keeps its native picker.
export function shouldUseServerDirectoryBrowser({
  isWebClient,
  activeRuntimeEnvironmentId
}: {
  isWebClient: boolean
  activeRuntimeEnvironmentId: string | null | undefined
}): boolean {
  return isWebClient && Boolean(activeRuntimeEnvironmentId?.trim())
}

export function FloatingWorkspacePane({
  settings,
  updateSettings
}: FloatingWorkspacePaneProps): React.JSX.Element | null {
  const searchQuery = useAppStore((state) => state.settingsSearchQuery)
  const [resolvedFloatingWorkspacePath, setResolvedFloatingWorkspacePath] = useState('')
  const [browsing, setBrowsing] = useState(false)

  const activeRuntimeEnvironmentId = settings.activeRuntimeEnvironmentId?.trim() || null
  const useServerDirectoryBrowser = shouldUseServerDirectoryBrowser({
    isWebClient: isWebClientLocation(),
    activeRuntimeEnvironmentId
  })

  useEffect(() => {
    let cancelled = false
    void window.api.app
      .getFloatingTerminalCwd({
        path: settings.floatingTerminalCwd
      })
      .then((path) => {
        if (!cancelled) {
          setResolvedFloatingWorkspacePath(path)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedFloatingWorkspacePath('')
        }
      })
    return () => {
      cancelled = true
    }
  }, [settings.floatingTerminalCwd])

  const applyPickedDirectory = (path: string): void => {
    useAppStore.getState().recordFeatureInteraction('floating-workspace')
    updateSettings({ floatingTerminalCwd: path })
  }

  const grantAndApplyPickedDirectory = async (path: string): Promise<void> => {
    // Why: mirror the desktop native picker — a user-approved selection is a
    // trust grant, so authorize the directory on the server BEFORE storing it.
    // resolveCwd then returns the real path for both the input display and the
    // floating terminal. Best-effort: the setting still persists if the grant
    // fails, and resolveCwd falls back to a safe default.
    try {
      await window.api.app.grantFloatingWorkspaceDirectory(path)
    } catch {
      // ignore — persistence below is still correct; resolution degrades safely
    }
    applyPickedDirectory(path)
  }

  const pickFloatingWorkspaceDirectory = async (): Promise<void> => {
    // Why: on the web tile the native picker is a no-op stub, so open the host-fs
    // browser instead and let the directory be chosen on the connected server.
    if (useServerDirectoryBrowser) {
      setBrowsing(true)
      return
    }
    const path = await window.api.app.pickFloatingWorkspaceDirectory()
    if (!path) {
      return
    }
    applyPickedDirectory(path)
  }

  const directoryInputValue = getFloatingWorkspaceDirectoryInputValue({
    configuredFloatingWorkspacePath: settings.floatingTerminalCwd,
    resolvedFloatingWorkspacePath
  })

  if (!matchesSettingsSearch(searchQuery, getFloatingWorkspaceSearchEntries())) {
    return null
  }

  return (
    <section className="space-y-4">
      <SearchableSetting
        title={translate(
          'auto.components.settings.FloatingWorkspacePane.1f67f39384',
          'Floating Workspace'
        )}
        description={translate(
          'auto.components.settings.FloatingWorkspacePane.37df688d6f',
          'Enable the floating workspace and choose where new tabs start.'
        )}
        keywords={[
          'floating workspace',
          'floating terminal',
          'terminal',
          'browser',
          'markdown',
          'note',
          'global',
          'quick panel',
          'launch directory'
        ]}
        className="divide-y divide-border/40"
      >
        <SettingsSwitchRow
          label={translate(
            'auto.components.settings.FloatingWorkspacePane.5136813663',
            'Enable Floating Workspace'
          )}
          description={translate(
            'auto.components.settings.FloatingWorkspacePane.41eb95f7f0',
            'Shows the floating workspace button and panel.'
          )}
          checked={settings.floatingTerminalEnabled}
          onChange={() => {
            if (!settings.floatingTerminalEnabled) {
              useAppStore.getState().recordFeatureInteraction('floating-workspace')
            } else {
              useAppStore.getState().recordFeatureInteraction('floating-workspace-hidden')
            }
            updateSettings({
              floatingTerminalEnabled: !settings.floatingTerminalEnabled
            })
          }}
        />

        <SettingsRow
          alignTop
          label={translate(
            'auto.components.settings.FloatingWorkspacePane.12aa09f10c',
            'Terminal Directory'
          )}
          description={translate(
            'auto.components.settings.FloatingWorkspacePane.81afb79785',
            "New floating terminal tabs start here. Markdown notes are saved in Orca's app-owned floating workspace."
          )}
          control={
            <div className="flex w-72 max-w-full gap-2">
              <Input
                value={directoryInputValue}
                readOnly
                placeholder="~"
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={translate(
                  'auto.components.settings.FloatingWorkspacePane.505001823e',
                  'Choose floating workspace directory'
                )}
                onClick={() => void pickFloatingWorkspaceDirectory()}
              >
                <FolderOpen className="size-4" />
              </Button>
            </div>
          }
        />

        <SettingsRow
          label={translate(
            'auto.components.settings.FloatingWorkspacePane.5e5a8da236',
            'Toggle Button Location'
          )}
          description={translate(
            'auto.components.settings.FloatingWorkspacePane.3c900e26e5',
            'The keyboard shortcut works regardless of where the toggle is shown.'
          )}
          control={
            <ToggleGroup
              type="single"
              value={settings.floatingTerminalTriggerLocation ?? 'floating-button'}
              onValueChange={(value) => {
                if (!value) {
                  return
                }
                updateSettings({
                  floatingTerminalTriggerLocation: value as FloatingTerminalTriggerLocation
                })
                useAppStore.getState().recordFeatureInteraction('floating-workspace')
              }}
            >
              <ToggleGroupItem value="floating-button">
                {translate(
                  'auto.components.settings.FloatingWorkspacePane.9fb225f2d7',
                  'Floating Button'
                )}
              </ToggleGroupItem>
              <ToggleGroupItem value="status-bar">
                {translate(
                  'auto.components.settings.FloatingWorkspacePane.aeaf76fda9',
                  'Status Bar'
                )}
              </ToggleGroupItem>
            </ToggleGroup>
          }
        />
      </SearchableSetting>

      {useServerDirectoryBrowser && activeRuntimeEnvironmentId ? (
        <Dialog open={browsing} onOpenChange={setBrowsing}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {translate(
                  'auto.components.sidebar.AddRepoServerStartStep.ac66a3ed2d',
                  'Browse host filesystem'
                )}
              </DialogTitle>
              <DialogDescription>
                {translate(
                  'auto.components.sidebar.AddRepoServerStartStep.0f8aba944c',
                  'Navigate to a directory and click Select to choose it.'
                )}
              </DialogDescription>
            </DialogHeader>
            <RemoteFileBrowser
              runtimeEnvironmentId={activeRuntimeEnvironmentId}
              initialPath={settings.floatingTerminalCwd?.trim() || '~'}
              onSelect={(path) => {
                void grantAndApplyPickedDirectory(path)
                setBrowsing(false)
              }}
              onCancel={() => setBrowsing(false)}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </section>
  )
}
