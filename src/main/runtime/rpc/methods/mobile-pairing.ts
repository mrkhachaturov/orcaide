import { z } from 'zod'
import { defineMethod, type RpcAnyMethod } from '../core'

// Why: the web client behind a trusted proxy has no Electron IPC, so Settings →
// Mobile needs an RPC path to the same mint/list/revoke operations the desktop
// reaches via mobile: IPC. Authorization is the presence of
// ctx.trustedMobilePairing: the transport injects it only for runtime-scope
// connections, and none of these methods are in MOBILE_RPC_METHOD_ALLOWLIST —
// a paired phone must never mint a new device credential (privilege escalation)
// or revoke its siblings.
export const MOBILE_PAIRING_METHODS: readonly RpcAnyMethod[] = [
  defineMethod({
    name: 'mobile.createPairingOffer',
    // Why: strict — the advertised address and connection mode are server policy
    // (--pairing-address, local-only); a caller-supplied address must be an
    // error, not silently stripped, so a redirect attempt is visible.
    params: z.object({ rotate: z.boolean().optional() }).strict(),
    handler: async (params, ctx) => {
      if (!ctx.trustedMobilePairing) {
        throw new Error('trusted_mobile_pairing_unavailable')
      }
      return await ctx.trustedMobilePairing.createOffer({ rotate: params.rotate })
    }
  }),
  defineMethod({
    name: 'mobile.listDevices',
    params: null,
    handler: (_params, ctx) => {
      if (!ctx.trustedMobilePairing) {
        throw new Error('trusted_mobile_pairing_unavailable')
      }
      return ctx.trustedMobilePairing.listDevices()
    }
  }),
  defineMethod({
    name: 'mobile.revokeDevice',
    params: z.object({ deviceId: z.string().min(1) }),
    handler: async (params, ctx) => {
      if (!ctx.trustedMobilePairing) {
        throw new Error('trusted_mobile_pairing_unavailable')
      }
      return await ctx.trustedMobilePairing.revokeDevice(params.deviceId)
    }
  })
]
