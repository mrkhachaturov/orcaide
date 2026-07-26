export function isWebClientLocation(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return (
    Boolean((window as unknown as { __ORCA_WEB_CLIENT__?: boolean }).__ORCA_WEB_CLIENT__) ||
    // Why optional: worktree ownership now consults this, and ownership resolves in
    // plain-node contexts (and node-env tests) where `window` exists without a
    // `location`. Absent location means "not the web client", same as before.
    window.location?.pathname?.endsWith('/web-index.html') === true
  )
}
