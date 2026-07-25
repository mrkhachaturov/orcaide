import { describe, expect, it } from 'vitest'
import {
  createPresetOpenInApplication,
  shouldCommitOpenInApplicationsDraft
} from './OpenInMenuSetting'
import { isOpenInApplicationIncomplete } from '../../../../shared/open-in-applications'
import {
  getOpenInAppPresets,
  getOpenInUrlFaviconDomain,
  isOpenInAppPresetAdded,
  OpenInApplicationIcon
} from '@/lib/open-in-app-catalog'
import type { OpenInAppPreset } from '@/lib/open-in-app-catalog'

function requirePreset(id: string): OpenInAppPreset {
  const preset = getOpenInAppPresets().find((entry) => entry.id === id)
  if (!preset) {
    throw new Error(`Preset not found: ${id}`)
  }
  return preset
}

describe('OpenInMenuSetting presets', () => {
  it('creates stable preset rows for known apps', () => {
    const cursor = requirePreset('cursor')

    expect(createPresetOpenInApplication(cursor)).toEqual({
      id: 'cursor',
      label: 'Cursor',
      command: 'cursor'
    })
  })

  it('recognizes legacy preset rows by command', () => {
    const cursor = requirePreset('cursor')

    expect(isOpenInAppPresetAdded([{ command: ' cursor ' }], cursor)).toBe(true)
  })

  it('keeps the Zed icon visible on dark menus', () => {
    const icon = OpenInApplicationIcon({ application: { command: 'zed' } })

    expect(icon.props.className).toContain('dark:invert')
  })
})

describe('OpenInMenuSetting preset ids', () => {
  // Why: a seeded browser-editor row can already own `vscode`, and normalizeOpenInApplications
  // dedupes by id keeping the FIRST row — so reusing the preset id would silently discard the
  // row the user just asked for.
  it('mints a fresh id when the preset id is already taken', () => {
    const vscode = requirePreset('vscode')
    const created = createPresetOpenInApplication(vscode, new Set(['vscode']))

    expect(created.id).not.toBe('vscode')
    expect(created).toMatchObject({ label: vscode.label, command: vscode.command })
  })

  // Why: the favicon map deliberately does not restate preset domains, so a URL row named after a
  // preset has to inherit that preset's mark rather than fall through to the generic icon.
  it('gives a URL row named after a preset that preset’s mark', () => {
    expect(getOpenInUrlFaviconDomain({ id: 'vscode', url: 'https://e.com/' })).toBe(
      requirePreset('vscode').faviconDomain
    )
    expect(getOpenInUrlFaviconDomain({ id: 'code-server', url: 'https://e.com/' })).toBe(
      'code.visualstudio.com'
    )
    expect(getOpenInUrlFaviconDomain({ id: 'unknown-editor', url: 'https://e.com/' })).toBeNull()
  })

  it('keeps the stable preset id when nothing else claims it', () => {
    const vscode = requirePreset('vscode')

    expect(createPresetOpenInApplication(vscode, new Set(['cursor'])).id).toBe('vscode')
  })
})

describe('OpenInMenuSetting application drafts', () => {
  it('does not commit rows until both label and command are present', () => {
    expect(
      shouldCommitOpenInApplicationsDraft([{ id: 'draft', label: 'Cursor', command: '' }])
    ).toBe(false)
    expect(
      shouldCommitOpenInApplicationsDraft([{ id: 'draft', label: '', command: 'cursor' }])
    ).toBe(false)
    expect(
      shouldCommitOpenInApplicationsDraft([{ id: 'draft', label: '   ', command: 'cursor' }])
    ).toBe(false)
    expect(
      shouldCommitOpenInApplicationsDraft([{ id: 'draft', label: 'Cursor', command: '   ' }])
    ).toBe(false)
  })

  it('allows commit when every draft row has a label and command', () => {
    expect(shouldCommitOpenInApplicationsDraft([])).toBe(true)
    expect(
      shouldCommitOpenInApplicationsDraft([{ id: 'cursor', label: 'Cursor', command: 'cursor' }])
    ).toBe(true)
    expect(
      shouldCommitOpenInApplicationsDraft([
        { id: 'cursor', label: 'Cursor', command: 'cursor' },
        { id: 'zed', label: 'Zed', command: 'zed' }
      ])
    ).toBe(true)
  })
})

// Why this block is the regression guard: this predicate gates EVERY write from the pane. When it
// required a command, a single seeded URL row — which by construction has none — made add, delete
// and edit of every OTHER row silently do nothing, for as long as that row existed.
describe('OpenInMenuSetting URL rows', () => {
  const seeded = {
    id: 'code-server',
    label: 'code-server',
    command: '',
    url: 'https://cs.example.com/?folder={path}'
  }

  it('treats a URL row as complete without a command', () => {
    expect(isOpenInApplicationIncomplete(seeded)).toBe(false)
    expect(shouldCommitOpenInApplicationsDraft([seeded])).toBe(true)
  })

  it('does not let a seeded URL row veto edits to the rest of the pane', () => {
    expect(
      shouldCommitOpenInApplicationsDraft([
        seeded,
        { id: 'cursor', label: 'Cursor', command: 'cursor' }
      ])
    ).toBe(true)
  })

  it('still requires a label on a URL row', () => {
    expect(isOpenInApplicationIncomplete({ ...seeded, label: '  ' })).toBe(true)
    expect(shouldCommitOpenInApplicationsDraft([{ ...seeded, label: '  ' }])).toBe(false)
  })

  it('treats a whitespace-only url as nothing to open with', () => {
    expect(isOpenInApplicationIncomplete({ label: 'X', command: '', url: '   ' })).toBe(true)
  })

  // Why an invalid URL still commits: an unusable template is exactly what a bad seed produces,
  // and refusing to persist on it would re-create the inert-pane bug. It is surfaced as an inline
  // error in the editor and a disabled "Invalid URL" item in the Open in menu instead.
  it('commits a row whose URL is invalid rather than freezing the pane', () => {
    expect(
      shouldCommitOpenInApplicationsDraft([{ ...seeded, url: 'javascript:alert(1)' }])
    ).toBe(true)
  })
})
