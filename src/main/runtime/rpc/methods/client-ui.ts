import type { PersistedUIState } from '../../../../shared/types'
import { defineMethod, type RpcMethod } from '../core'
import {
  FeatureInteractionIdParam,
  PRBotAuthorOverrideUpdate,
  SettingsUpdate,
  UiUpdate
} from './client-ui-schemas'
import { TerminalQuickCommandsUpdate } from './terminal-quick-command-rpc-schema'

export const CLIENT_UI_METHODS: RpcMethod[] = [
  defineMethod({
    name: 'settings.get',
    params: null,
    // Why phones do not get openInApplications: the seeded rows carry this deployment's editor
    // hostnames, and a phone has no "Open in" menu to spend them on. Same payload-diet rule as
    // terminalQuickCommands below — a mobile-scope credential is handed the smallest useful
    // settings object, not everything a full client reads.
    handler: (_params, { runtime, clientKind }) => {
      const settings = runtime.getClientSettings()
      if (clientKind !== 'mobile') {
        return { settings }
      }
      const { openInApplications: _withheldFromMobile, ...mobileSettings } = settings
      void _withheldFromMobile
      return { settings: mobileSettings }
    }
  }),
  defineMethod({
    name: 'settings.update',
    params: SettingsUpdate,
    handler: (params, { runtime }) => ({ settings: runtime.updateClientSettings(params) })
  }),
  defineMethod({
    name: 'settings.getTerminalQuickCommands',
    params: null,
    // Why: command bodies can total ~240 KB, so keep unrelated settings reads
    // from carrying them over every paired/relay connection.
    handler: (_params, { runtime }) => ({
      terminalQuickCommands: runtime.getClientTerminalQuickCommands()
    })
  }),
  defineMethod({
    name: 'settings.updateTerminalQuickCommands',
    params: TerminalQuickCommandsUpdate,
    handler: (params, { runtime }) => ({
      terminalQuickCommands: runtime.updateClientTerminalQuickCommands(params.mutation)
    })
  }),
  defineMethod({
    name: 'settings.updatePRBotAuthorOverride',
    params: PRBotAuthorOverrideUpdate,
    handler: (params, { runtime }) => ({
      settings: runtime.updateClientPRBotAuthorOverride(params)
    })
  }),
  defineMethod({
    name: 'ui.get',
    params: null,
    handler: (_params, { runtime }) => ({ ui: runtime.getUIState() })
  }),
  defineMethod({
    name: 'ui.set',
    params: UiUpdate,
    handler: (params, { runtime }) => ({
      ui: runtime.updateUIState(params as Partial<PersistedUIState>)
    })
  }),
  defineMethod({
    name: 'ui.recordFeatureInteraction',
    params: FeatureInteractionIdParam,
    handler: (params, { runtime }) => ({
      ui: runtime.recordFeatureInteraction(params)
    })
  })
]
