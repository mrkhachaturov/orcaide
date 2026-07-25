import { describe, expect, it } from 'vitest'
import { RUNTIME_SEEDED_SETTING_KEYS, pickRuntimeSeededSettings } from './runtime-seeded-settings'
import {
  normalizeLeftSidebarAppearanceMode,
  normalizeLeftSidebarTintColor,
  normalizeLeftSidebarTintOpacity
} from './left-sidebar-appearance'

// Why: this list is handed to every client that opens the tile. A credential landing on it
// would be an exfiltration path, and a per-device key would fight the user's own choice on
// whichever screen they happen to be using. Both are test-enforced rather than review-enforced.
const CREDENTIAL_BEARING_KEYS = [
  'codexManagedAccounts',
  'claudeManagedAccounts',
  'activeCodexManagedAccountId',
  'activeClaudeManagedAccountId',
  'opencodeSessionCookie',
  'opencodeWorkspaceId',
  'browserKagiSessionLink',
  'httpProxyUrl'
]

const PER_DEVICE_KEYS = [
  'uiZoomLevel',
  'editorFontZoomLevel',
  'terminalFontSize',
  'editorFontFamily',
  'windowBounds',
  'minimizeToTrayOnClose',
  'showMenuBarIcon',
  'terminalWindowsShell'
]

describe('runtime-seeded settings', () => {
  it('never seeds a credential-bearing setting', () => {
    for (const key of CREDENTIAL_BEARING_KEYS) {
      expect(RUNTIME_SEEDED_SETTING_KEYS).not.toContain(key)
    }
  })

  it('never seeds a per-device ergonomics setting', () => {
    for (const key of PER_DEVICE_KEYS) {
      expect(RUNTIME_SEEDED_SETTING_KEYS).not.toContain(key)
    }
  })

  it('seeds the appearance and experimental keys a provisioned workspace declares', () => {
    expect(RUNTIME_SEEDED_SETTING_KEYS).toContain('theme')
    expect(RUNTIME_SEEDED_SETTING_KEYS).toContain('experimentalPet')
    expect(RUNTIME_SEEDED_SETTING_KEYS).toContain('experimentalEphemeralVms')
    expect(RUNTIME_SEEDED_SETTING_KEYS).toContain('experimentalMobile')
  })

  it('copies only listed keys', () => {
    const picked = pickRuntimeSeededSettings({
      theme: 'light',
      experimentalPet: true,
      terminalFontSize: 22,
      opencodeSessionCookie: 'secret'
    })
    expect(picked).toEqual({ theme: 'light', experimentalPet: true })
  })

  it('drops values that fail their schema instead of poisoning the blob', () => {
    const picked = pickRuntimeSeededSettings({
      theme: 'chartreuse',
      experimentalPet: 'yes',
      agentHibernationIdleMs: 60_000
    })
    expect(picked).toEqual({ agentHibernationIdleMs: 60_000 })
  })

  // Why compare against the normalizers instead of hard-coding '#18181b' and 0.35: those two
  // functions are the app's definition of a legal tint, and a literal here would just be a third
  // copy of the rule — the same restating that let 'not-a-color' and 999 reach every fresh
  // browser's settings blob, values the settings UI itself cannot produce.
  it('seeds sidebar tint values the app could actually have produced', () => {
    const picked = pickRuntimeSeededSettings({
      leftSidebarAppearanceMode: 'chartreuse',
      leftSidebarTintColor: 'not-a-color',
      leftSidebarTintOpacity: 999
    })

    expect(picked).toEqual({
      leftSidebarAppearanceMode: normalizeLeftSidebarAppearanceMode('chartreuse'),
      leftSidebarTintColor: normalizeLeftSidebarTintColor('not-a-color'),
      leftSidebarTintOpacity: normalizeLeftSidebarTintOpacity(999)
    })
  })

  it('passes legal tint values through untouched', () => {
    expect(
      pickRuntimeSeededSettings({
        leftSidebarAppearanceMode: 'tinted',
        leftSidebarTintColor: '#0af',
        leftSidebarTintOpacity: 0.2
      })
    ).toEqual({
      leftSidebarAppearanceMode: 'tinted',
      leftSidebarTintColor: '#0af',
      leftSidebarTintOpacity: 0.2
    })
  })

  it('skips absent keys so an older runtime leaves stock defaults alone', () => {
    expect(pickRuntimeSeededSettings({ theme: undefined })).toEqual({})
  })

  it('tolerates a missing or non-object payload', () => {
    expect(pickRuntimeSeededSettings(undefined)).toEqual({})
    expect(pickRuntimeSeededSettings(null)).toEqual({})
    expect(pickRuntimeSeededSettings('nope')).toEqual({})
  })
})
