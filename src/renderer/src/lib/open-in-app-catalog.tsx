import type React from 'react'
import { AppWindow } from 'lucide-react'
import type { OpenInApplication } from '../../../shared/types'
import { cn } from './utils'
import { translate } from '@/i18n/i18n'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'

export type OpenInAppPreset = {
  id: string
  label: string
  command: string
  faviconDomain: string
  iconClassName?: string
}

export const getOpenInAppPresets = createLocalizedCatalog(() => [
  {
    id: 'vscode',
    label: translate('auto.lib.open.in.app.catalog.173553f73a', 'VS Code'),
    command: 'code',
    faviconDomain: 'code.visualstudio.com'
  },
  {
    id: 'cursor',
    label: translate('auto.lib.open.in.app.catalog.d62b12e98a', 'Cursor'),
    command: 'cursor',
    faviconDomain: 'cursor.com'
  },
  {
    id: 'zed',
    label: translate('auto.lib.open.in.app.catalog.f8b8ca2711', 'Zed'),
    command: 'zed',
    faviconDomain: 'zed.dev',
    // Why: Zed's favicon is a black transparent mark, which disappears on dark menus.
    iconClassName: 'dark:invert'
  }
])

/**
 * Favicon domains for browser editors that have no preset — keyed by the entry's stable `id`.
 *
 * Why keyed on id and not on the URL's own host: that host carries a deployment-chosen slug
 * (`code-server--<workspace>--<owner>.<domain>`) and is usually a private domain a favicon
 * service cannot reach. The id is the one stable thing the entry's author controls.
 *
 * Why only these two: any id that IS a preset id resolves through getOpenInAppPresets() below, so
 * `vscode` and `cursor` are not restated here — duplicating a preset's domain would be a second
 * place to update when the catalog changes. These two have no preset because the "Add app"
 * dropdown is built from the same catalog and every option there must contribute a runnable
 * command, which a URL entry has none of.
 *
 * Both borrow VS Code's mark because they ARE VS Code in a browser, and neither has a usable icon
 * of its own — `code-server.dev` redirects to GitHub, so a favicon lookup there returns the
 * octocat. The editor's mark says more to the user than the host's.
 */
const URL_OPEN_IN_APP_FAVICON_DOMAINS: Readonly<Record<string, string>> = {
  'code-server': 'code.visualstudio.com',
  'vscode-web': 'code.visualstudio.com'
}

export function getOpenInAppPreset(
  application: Pick<OpenInApplication, 'command'>
): OpenInAppPreset | null {
  const command = application.command.trim().toLowerCase()
  if (!command) {
    return null
  }
  return getOpenInAppPresets().find((preset) => preset.command === command) ?? null
}

/** Favicon domain for a URL entry, or null when its id has no known mark. */
export function getOpenInUrlFaviconDomain(
  application: Partial<Pick<OpenInApplication, 'id' | 'url'>>
): string | null {
  const id = application.id?.trim().toLowerCase()
  if (!application.url?.trim() || !id) {
    return null
  }
  // Presets first, so an entry named after a known app inherits that app's mark from the one
  // place the catalog defines it.
  const preset = getOpenInAppPresets().find((entry) => entry.id === id)
  return preset?.faviconDomain ?? URL_OPEN_IN_APP_FAVICON_DOMAINS[id] ?? null
}

export function isOpenInAppPresetAdded(
  applications: readonly Pick<OpenInApplication, 'command'>[],
  preset: OpenInAppPreset
): boolean {
  return applications.some(
    (application) => application.command.trim().toLowerCase() === preset.command
  )
}

export function OpenInApplicationIcon({
  application,
  size = 14
}: {
  application: Pick<OpenInApplication, 'command'> & Partial<Pick<OpenInApplication, 'id' | 'url'>>
  size?: number
}): React.JSX.Element {
  const preset = getOpenInAppPreset(application)
  const faviconDomain = preset?.faviconDomain ?? getOpenInUrlFaviconDomain(application)
  if (faviconDomain) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain=${faviconDomain}&sz=64`}
        width={size}
        height={size}
        alt=""
        aria-hidden
        className={cn('shrink-0', preset?.iconClassName)}
        style={{ borderRadius: 2 }}
      />
    )
  }
  return <AppWindow width={size} height={size} />
}
