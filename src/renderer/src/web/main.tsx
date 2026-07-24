import '../assets/main.css'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { lazyWithRetry as lazy } from '@/lib/lazy-with-retry'
import ReactDOM from 'react-dom/client'
import { useTranslation } from 'react-i18next'
import WebConnect from './WebConnect'
import { RecoverableRenderErrorBoundary } from '../components/error-boundaries/RecoverableRenderErrorBoundary'
import {
  clearPairingInputFromAddressBar,
  decideWebPairingStartup,
  fetchTrustedSessionPairingInput,
  parseWebPairingInput,
  readPairingInputFromLocation,
  sameOriginWebSocketEndpoint
} from './web-pairing'
import {
  createStoredWebRuntimeEnvironment,
  readStoredWebRuntimeEnvironment,
  saveStoredWebRuntimeEnvironment
} from './web-runtime-environment'
import { installWebPreloadApi } from './web-preload-api'
import { I18nProvider } from '../i18n/I18nProvider'
import { translate } from '../i18n/i18n'

const App = lazy(() => import('../App'))

function WebRoot(): React.JSX.Element {
  const initialPairingInput = useMemo(() => readPairingInputFromLocation(window.location), [])
  // Why: current runtime links carry scope metadata. Runtime-scope offers keep
  // the instant save path; mobile/legacy-unknown offers must be shown/probed.
  const startupDecision = useMemo(() => {
    const decision = decideWebPairingStartup({
      initialPairingInput,
      hasStoredEnvironment: readStoredWebRuntimeEnvironment() !== null
    })
    if (
      decision.kind === 'auto-save-runtime-offer' ||
      (decision.kind === 'show-connect' && decision.initialPairingInput !== null)
    ) {
      clearPairingInputFromAddressBar()
    }
    return decision
  }, [initialPairingInput])
  const [hasEnvironment, setHasEnvironment] = useState(() => {
    if (startupDecision.kind === 'auto-save-runtime-offer') {
      saveStoredWebRuntimeEnvironment(
        createStoredWebRuntimeEnvironment({
          name: 'Orca Server',
          offer: startupDecision.offer,
          previousEnvironment: readStoredWebRuntimeEnvironment()
        })
      )
      return true
    }
    return startupDecision.kind === 'use-stored-environment'
  })
  // Why: trusted-proxy mode — no fragment offer and no stored environment means we
  // may be behind a reverse proxy (Coder) that serves the offer over /trusted-session.
  // Probe it before falling back to the manual connect form, so a proxied browser
  // pairs itself with no URL token.
  const [trustedProbe, setTrustedProbe] = useState<'pending' | 'done'>(() =>
    !hasEnvironment &&
    startupDecision.kind === 'show-connect' &&
    startupDecision.initialPairingInput === null
      ? 'pending'
      : 'done'
  )
  useEffect(() => {
    if (trustedProbe !== 'pending') {
      return
    }
    let active = true
    void fetchTrustedSessionPairingInput().then((input) => {
      if (!active) {
        return
      }
      const offer = input ? parseWebPairingInput(input) : null
      if (offer && offer.scope === 'runtime') {
        saveStoredWebRuntimeEnvironment(
          createStoredWebRuntimeEnvironment({
            name: 'Orca Server',
            // Why: keep the server's E2EE credential but dial same-origin — the browser
            // loaded from the correct Coder subdomain, so window.location is the reachable
            // address for any workspace name, with no --pairing-address to misconfigure.
            offer: { ...offer, endpoint: sameOriginWebSocketEndpoint(window.location) },
            previousEnvironment: readStoredWebRuntimeEnvironment()
          })
        )
        setHasEnvironment(true)
      }
      setTrustedProbe('done')
    })
    return () => {
      active = false
    }
  }, [trustedProbe])

  if (!hasEnvironment && trustedProbe === 'pending') {
    return <div className="min-h-dvh bg-background" />
  }

  if (!hasEnvironment) {
    return (
      <WebConnect
        initialPairingInput={
          startupDecision.kind === 'show-connect' ? startupDecision.initialPairingInput : null
        }
        onConnected={() => setHasEnvironment(true)}
      />
    )
  }

  installWebPreloadApi()
  return (
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <App />
    </Suspense>
  )
}

function WebRootBoundary(): React.JSX.Element {
  useTranslation()
  return (
    <RecoverableRenderErrorBoundary
      boundaryId="web.root"
      surface="web-root"
      title={translate('app.recoverableError.webTitle', 'Orca web hit a renderer error.')}
      description={translate(
        'app.recoverableError.webDescription',
        'Retry the web client or reconnect to the paired runtime.'
      )}
    >
      <WebRoot />
    </RecoverableRenderErrorBoundary>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <I18nProvider>
    <WebRootBoundary />
  </I18nProvider>
)
