import type { OpenInApplication } from './types'

export const OPEN_IN_APPLICATIONS_MAX = 8
export const DEFAULT_OPEN_IN_APPLICATIONS: OpenInApplication[] = [
  { id: 'vscode', label: 'VS Code', command: 'code' }
]

type NormalizeOpenInApplicationsOptions = {
  createId?: () => string
  seedDefaults?: boolean
}

function normalizeToken(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function makeFallbackId(index: number): string {
  return `open-in-${index + 1}`
}

/**
 * Mint an id for a new entry.
 *
 * Lives here because ids are the normalizer's dedupe key: the renderer store and the Settings
 * pane both create rows, and two private copies of this would be two ways for an id to be shaped.
 */
export function createOpenInApplicationId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `open-in-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  )
}

/**
 * True when a row has nothing to open with — the single definition of "unfinished".
 *
 * Why it is exported rather than restated in the Settings pane: the pane uses it to decide when to
 * hold back a write, and the normalizer below uses it to decide what to drop. If those two rules
 * ever disagree, the pane persists rows the normalizer then silently discards, and the user's edit
 * vanishes with no error. One rule, two callers.
 *
 * A URL alone is enough: a browser-editor row has no command to run — the path goes to whoever
 * serves its URL.
 */
export function isOpenInApplicationIncomplete(application: {
  label: string
  command: string
  url?: string
}): boolean {
  return (
    application.label.trim() === '' ||
    (application.command.trim() === '' && !application.url?.trim())
  )
}

export function normalizeOpenInApplications(
  value: unknown,
  options: NormalizeOpenInApplicationsOptions = {}
): OpenInApplication[] {
  if (!Array.isArray(value)) {
    return options.seedDefaults ? [...DEFAULT_OPEN_IN_APPLICATIONS] : []
  }

  const normalized: OpenInApplication[] = []
  const seenIds = new Set<string>()

  for (const [index, row] of value.entries()) {
    if (normalized.length >= OPEN_IN_APPLICATIONS_MAX) {
      break
    }
    if (!row || typeof row !== 'object') {
      continue
    }

    const label = normalizeToken((row as { label?: unknown }).label)
    const command = normalizeToken((row as { command?: unknown }).command)
    const url = normalizeToken((row as { url?: unknown }).url)
    if (isOpenInApplicationIncomplete({ label, command, url })) {
      continue
    }

    let id = normalizeToken((row as { id?: unknown }).id)
    if (!id) {
      id = normalizeToken(options.createId?.())
      if (!id) {
        id = makeFallbackId(index)
      }
    }

    if (seenIds.has(id)) {
      continue
    }
    seenIds.add(id)
    // Why url is spread conditionally: the field is optional, and writing `url: undefined` into
    // a command entry would round-trip through the JSON store as a key that was never asked for.
    normalized.push(url ? { id, label, command, url } : { id, label, command })
  }

  return normalized
}
