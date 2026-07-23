import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http'
import { extname, isAbsolute, posix, relative, resolve } from 'node:path'

const STATIC_WEB_ALLOWED_PATHS = new Set(['/web-index.html'])
const STATIC_WEB_ALLOWED_PREFIXES = ['/assets/']
const STATIC_WEB_CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2']
])

export type StaticWebClientHandlerOptions = {
  // Why: when present, GET /trusted-session returns the current pairing offer (loopback-gated) so a reverse-proxy-fronted browser opens the E2EE channel without a URL-fragment token. Returns null when no offer can be minted.
  trustedSessionProvider?: () => string | null
}

export function createStaticWebClientHandler(
  staticRoot: string,
  options: StaticWebClientHandlerOptions = {}
): RequestListener {
  const resolvedRoot = resolve(staticRoot)
  return (request, response) => {
    void handleStaticRequest(resolvedRoot, request, response, options)
  }
}

// Why: mirrors code-server's `bind-addr: 127.0.0.1` + `--auth none` trust model — a loopback peer is proof the request arrived through the front proxy (Coder), which already enforced auth. The listener also binds loopback-only in trusted-proxy mode; this is defense in depth.
function isLoopbackRemote(remoteAddress: string | undefined): boolean {
  return (
    remoteAddress === '127.0.0.1' ||
    remoteAddress === '::1' ||
    remoteAddress === '::ffff:127.0.0.1'
  )
}

function handleTrustedSessionRequest(
  request: IncomingMessage,
  response: ServerResponse,
  provider: () => string | null
): void {
  if (!isLoopbackRemote(request.socket.remoteAddress)) {
    writeHttpStatus(response, 404)
    return
  }
  const pairingUrl = provider()
  if (!pairingUrl) {
    writeHttpStatus(response, 503)
    return
  }
  response.statusCode = 200
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  // Why: the payload carries a device credential; never let a proxy or browser cache it.
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify({ pairingUrl }))
}

async function handleStaticRequest(
  staticRoot: string,
  request: IncomingMessage,
  response: ServerResponse,
  options: StaticWebClientHandlerOptions
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD')
    writeHttpStatus(response, 405)
    return
  }

  const pathname = parseStaticPathname(request.url)
  if (!pathname) {
    writeHttpStatus(response, 400)
    return
  }
  // Why: match by suffix like the static allowlist below — under a reverse-proxy path prefix the pathname arrives as `/<prefix>/trusted-session`.
  if (
    options.trustedSessionProvider &&
    (pathname === '/trusted-session' || pathname.endsWith('/trusted-session'))
  ) {
    handleTrustedSessionRequest(request, response, options.trustedSessionProvider)
    return
  }
  if (!isAllowedStaticWebPath(pathname)) {
    writeHttpStatus(response, 404)
    return
  }

  const absolutePath = resolve(staticRoot, pathname.slice(1))
  const relativePath = relative(staticRoot, absolutePath)
  if (relativePath === '' || relativePath.startsWith('..') || isAbsolute(relativePath)) {
    writeHttpStatus(response, 404)
    return
  }

  let fileStat
  try {
    fileStat = await stat(absolutePath)
  } catch {
    writeHttpStatus(response, 404)
    return
  }
  if (!fileStat.isFile()) {
    writeHttpStatus(response, 404)
    return
  }

  response.statusCode = 200
  response.setHeader(
    'Content-Type',
    STATIC_WEB_CONTENT_TYPES.get(extname(absolutePath)) ?? 'application/octet-stream'
  )
  response.setHeader('Content-Length', fileStat.size)
  response.setHeader(
    'Cache-Control',
    pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'
  )
  if (request.method === 'HEAD') {
    response.end()
    return
  }

  const stream = createReadStream(absolutePath)
  stream.on('error', () => {
    if (!response.headersSent) {
      writeHttpStatus(response, 500)
      return
    }
    response.destroy()
  })
  stream.pipe(response)
}

function parseStaticPathname(rawUrl: string | undefined): string | null {
  if (!rawUrl) {
    return '/web-index.html'
  }
  let pathname: string
  try {
    pathname = decodeURIComponent(new URL(rawUrl, 'http://127.0.0.1').pathname)
  } catch {
    return null
  }
  if (pathname === '/' || pathname === '/index.html') {
    return '/web-index.html'
  }
  if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').includes('..')) {
    return null
  }
  if (posix.normalize(pathname) !== pathname) {
    return null
  }
  return mapProxyPrefixedStaticPathname(pathname)
}

function mapProxyPrefixedStaticPathname(pathname: string): string {
  if (pathname === '/web-index.html' || pathname.endsWith('/web-index.html')) {
    return '/web-index.html'
  }
  const assetMarker = '/assets/'
  const assetIndex = pathname.indexOf(assetMarker)
  if (assetIndex !== -1) {
    // Why: reverse proxies may forward the external path prefix through to
    // Orca. Only the bundled /assets subtree is served after the prefix.
    return pathname.slice(assetIndex)
  }
  return pathname
}

function isAllowedStaticWebPath(pathname: string): boolean {
  return (
    STATIC_WEB_ALLOWED_PATHS.has(pathname) ||
    STATIC_WEB_ALLOWED_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  )
}

function writeHttpStatus(response: ServerResponse, statusCode: number): void {
  response.statusCode = statusCode
  response.end()
}
