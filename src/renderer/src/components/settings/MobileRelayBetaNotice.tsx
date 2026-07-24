import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import { isWebClientLocation } from '@/lib/web-client-location'

// Why: Relay ships in the public builds but is still beta; keep a quiet
// qualifier wherever the Relay path is offered.
export function MobileRelayBetaNotice({
  className
}: {
  className?: string
}): React.JSX.Element | null {
  // Why: the web client never offers the Relay path, so the qualifier would
  // reference an option that isn't on screen.
  if (isWebClientLocation()) {
    return null
  }
  return (
    <p className={cn('text-[11px] text-muted-foreground', className)}>
      {translate('auto.components.settings.MobileRelayBetaNotice.notice', 'Orca Relay is in beta.')}
    </p>
  )
}
