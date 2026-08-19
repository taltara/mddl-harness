/**
 * Host half. Projects the live Cordis loader tree onto a read-only JSON route
 * the Blueprint tab reads, so the tab shows the config this harness actually
 * booted rather than one rebuilt from a file.
 *
 * Read-only by construction: this plugin registers no mutating route and never
 * writes config.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: these packages declare the ctx.loader and ctx.webServer merges.
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { projectEntries, type EntryLike } from './live.ts'

export const name = 'dsh-blueprint'

/** Required services: the loader tree to read, and the server to answer on. */
export const inject = ['loader', 'webServer']

export const LIVE_ROUTE = '/dsh-blueprint/api/live'

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'])

/** Strip the port and any IPv6 brackets from a Host header. */
function hostname(value: string | undefined): string {
  if (value === undefined) {
    return ''
  }
  const trimmed = value.trim()
  if (trimmed.startsWith('[')) {
    return trimmed.slice(1, trimmed.indexOf(']'))
  }
  const colon = trimmed.lastIndexOf(':')
  return colon === -1 ? trimmed : trimmed.slice(0, colon)
}

/**
 * Refuse anything that is not a same-origin loopback read. The harness can be
 * bound to a LAN address, so the socket peer is checked independently of the
 * Host header, and a cross-site fetch is rejected even from loopback.
 */
export function isLocalRead(req: {
  method?: string | undefined
  headers: Record<string, string | string[] | undefined>
  socket?: { remoteAddress?: string | undefined } | undefined
}): boolean {
  if (req.method !== 'GET') {
    return false
  }
  const peer = req.socket?.remoteAddress
  if (peer === undefined || !LOOPBACK.has(peer)) {
    return false
  }
  const host = req.headers.host
  if (typeof host !== 'string' || !LOOPBACK.has(hostname(host))) {
    return false
  }
  const site = req.headers['sec-fetch-site']
  if (typeof site === 'string' && site !== 'same-origin' && site !== 'none') {
    return false
  }
  return true
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(payload)
}

/**
 * Mount the live-tree route.
 * @param ctx - host root context.
 */
export function apply(ctx: Context): void {
  const handler = (req: IncomingMessage, res: ServerResponse): void => {
    if (!isLocalRead(req)) {
      sendJson(res, 403, { error: 'blueprint: local same-origin reads only' })
      return
    }
    try {
      const entries = projectEntries(
        [...ctx.loader.entries()] as unknown as EntryLike[],
      )
      sendJson(res, 200, { entries })
    } catch (cause) {
      sendJson(res, 500, {
        error: cause instanceof Error ? cause.message : String(cause),
      })
    }
  }

  ctx.effect(() =>
    ctx.webServer.register({ kind: 'exact', path: LIVE_ROUTE, handler }),
  )
}
