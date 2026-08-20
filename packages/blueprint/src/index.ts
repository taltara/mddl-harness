/**
 * Host half. Projects the live Cordis loader tree onto a JSON route the
 * Blueprint tab reads, so the tab shows the config this harness actually
 * booted rather than one rebuilt from a file, and writes an overlay back into
 * the profile's `cordis.patch.yml`.
 *
 * Writing is confined to one marker-delimited block. Every other byte of that
 * file — hand-written rows, comments, `!!js` expressions — is preserved, and
 * the content written is always compiler output, never text supplied by the
 * browser.
 */

import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
// Type-only: these packages declare the ctx.loader and ctx.webServer merges.
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-host-webserver'
import {
  compileGraphToPatch,
  compileGraphToPreset,
  compilePresetManifest,
  emitPatchYaml,
  isPresetId,
} from '@mddl/compiler'
import type { GraphDocument } from '@mddl/graph-schema'
import {
  composePatchFile,
  diffLines,
  type PreflightFinding,
  preflightOps,
  presetProblem,
  revisionOf,
} from 'dsh-overlay-check'
import { type EntryLike, projectEntries } from './live.ts'
import { reviewRowCapabilities } from './reviewRows.ts'
import {
  APPLY_ROUTE,
  BACKUPS_ROUTE,
  LIVE_ROUTE,
  PRESET_ROUTE,
  PREVIEW_ROUTE,
  RESTORE_ROUTE,
} from './routes.ts'
import {
  CSRF_TOKEN,
  csrfMatches,
  patchPathFromEntries,
  previewToken,
  tokenMatches,
} from './writeBack.ts'

export const name = 'dsh-blueprint'

/**
 * Required services: the loader tree to read, and the server to answer on.
 *
 * Kept to a plain array on purpose. The object form was read as two service
 * names, "required" and "optional", so the entry never activated and the whole
 * harness refused to boot. Nothing this plugin offers is worth making the
 * harness depend on a service it might not have.
 */
export const inject = ['loader', 'webServer']

export {
  APPLY_ROUTE,
  BACKUPS_ROUTE,
  LIVE_ROUTE,
  PRESET_ROUTE,
  PREVIEW_ROUTE,
  RESTORE_ROUTE,
} from './routes.ts'

/** Body cap. A patch overlay is kilobytes; anything larger is not one. */
const MAX_BODY = 512 * 1024

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

/** Same checks as a read, plus the method and the session secret. */
export function isLocalWrite(req: {
  method?: string | undefined
  headers: Record<string, string | string[] | undefined>
  socket?: { remoteAddress?: string | undefined } | undefined
}): boolean {
  if (req.method !== 'POST') {
    return false
  }
  // Rebuild the fields explicitly rather than spreading: on a real
  // IncomingMessage `headers` is a prototype getter, so {...req} silently
  // drops it and every check downstream reads undefined.
  const asRead = {
    method: 'GET',
    headers: req.headers,
    socket: req.socket,
  }
  if (!isLocalRead(asRead)) {
    return false
  }
  return csrfMatches(req.headers['x-blueprint-csrf'])
}

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    const buf = chunk as Buffer
    size += buf.length
    if (size > MAX_BODY) {
      throw new Error('blueprint: request body too large')
    }
    chunks.push(buf)
  }
  return Buffer.concat(chunks).toString('utf8')
}

function graphFrom(raw: string): GraphDocument {
  const parsed: unknown = JSON.parse(raw)
  const graph = (parsed as { graph?: unknown }).graph
  if (
    typeof graph !== 'object' ||
    graph === null ||
    (graph as GraphDocument).version !== 1 ||
    !Array.isArray((graph as GraphDocument).nodes) ||
    !Array.isArray((graph as GraphDocument).edges)
  ) {
    throw new Error('blueprint: expected a version 1 graph')
  }
  return graph as GraphDocument
}

/**
 * The rows Blueprint owns, compiled here rather than accepted from the page.
 * The browser sends a graph; the bytes written are always compiler output.
 */
function rowsFor(graph: GraphDocument): string {
  const ops = compileGraphToPatch(graph)
  if (ops.length === 0) {
    return ''
  }
  // Only the rows: the summary header belongs to an exported file, not to a
  // block living inside someone else's config.
  return emitPatchYaml(ops, {
    applyCommand: '',
    webUrl: '',
    facts: [],
    attached: false,
  })
    .split('\n')
    .filter((line) => !line.startsWith('#'))
    .join('\n')
    .trim()
}

async function readPatchFile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8')
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      return ''
    }
    throw cause
  }
}

function backupDir(path: string): string {
  return join(dirname(path), '.dsh-blueprint', 'backups')
}

/** Snapshots, newest first, with the size and time a person can recognise. */
export async function listBackups(
  path: string,
): Promise<{ id: string; savedAt: string; bytes: number }[]> {
  const dir = backupDir(path)
  let names: string[] = []
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const rows = await Promise.all(
    names
      .filter((name) => name.endsWith('.yml'))
      .map(async (name) => {
        const info = await stat(join(dir, name))
        return {
          id: name.replace(/\.yml$/, ''),
          savedAt: info.mtime.toISOString(),
          bytes: info.size,
        }
      }),
  )
  return rows.sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

/** Keep the last 20 backups, newest last by name. */
async function backup(path: string, source: string): Promise<string> {
  const dir = join(dirname(path), '.dsh-blueprint', 'backups')
  await mkdir(dir, { recursive: true })
  const file = join(dir, `${revisionOf(source)}.yml`)
  await copyFile(path, file).catch(() => undefined)
  const kept = (await readdir(dir)).sort()
  for (const stale of kept.slice(0, Math.max(0, kept.length - 20))) {
    await unlink(join(dir, stale)).catch(() => undefined)
  }
  return file
}

/**
 * Write through a temp file in the same directory and rename, so a reader
 * sees either the old file or the new one and never a half-written config.
 * The file is re-read immediately before the rename: if it moved since the
 * preview, the write is abandoned rather than clobbering the other edit.
 */
async function atomicWrite(
  path: string,
  expected: string,
  next: string,
): Promise<void> {
  const current = await readPatchFile(path)
  if (revisionOf(current) !== revisionOf(expected)) {
    throw new Error('blueprint: the patch file changed since the preview')
  }
  const temp = `${path}.blueprint-${process.pid}.tmp`
  await writeFile(temp, next, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  await rename(temp, path)
}

/**
 * Mount the live-tree route and the write-back pair.
 * @param ctx - host root context.
 */
export function apply(ctx: Context): void {
  /** Where user presets live, per dsh-agent-presets. */
  const USER_PRESET_DIR = '.agent-presets'

  const dshHome = (): string => {
    // The profile sits at $DSH_HOME/profiles/<name>, so two levels up is home.
    const path = patchPathFromEntries([
      ...ctx.loader.entries(),
    ] as unknown as Parameters<typeof patchPathFromEntries>[0])
    if (path === undefined) {
      throw new Error('blueprint: could not locate the harness home')
    }
    return dirname(dirname(dirname(path)))
  }

  // Serialize writes: two tabs applying at once must not interleave.
  let queue: Promise<unknown> = Promise.resolve()
  const exclusive = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task)
    queue = run.catch(() => undefined)
    return run
  }

  const preflight = async (
    graph: GraphDocument,
    path: string,
  ): Promise<PreflightFinding[]> => {
    const liveIds = new Set(
      [...ctx.loader.entries()].map(
        (entry) => (entry as unknown as EntryLike).options?.id ?? '',
      ),
    )
    const ops = compileGraphToPatch(graph)
    const profileDir = dirname(path)
    // Resolvability first: a row that stops the harness booting matters more
    // than what its package says it may do.
    return [
      ...(await preflightOps(profileDir, ops, liveIds)),
      ...reviewRowCapabilities(profileDir, ops),
    ]
  }

  const patchPath = (): string => {
    const path = patchPathFromEntries([
      ...ctx.loader.entries(),
    ] as unknown as Parameters<typeof patchPathFromEntries>[0])
    if (path === undefined) {
      throw new Error('blueprint: could not locate the profile patch file')
    }
    return path
  }

  const live = (req: IncomingMessage, res: ServerResponse): void => {
    if (!isLocalRead(req)) {
      sendJson(res, 403, { error: 'blueprint: local same-origin reads only' })
      return
    }
    try {
      const entries = projectEntries([
        ...ctx.loader.entries(),
      ] as unknown as EntryLike[])
      let patch: { path: string } | undefined
      try {
        patch = { path: patchPath() }
      } catch {
        patch = undefined
      }
      sendJson(res, 200, { entries, csrf: CSRF_TOKEN, patch })
    } catch (cause) {
      sendJson(res, 500, {
        error: cause instanceof Error ? cause.message : String(cause),
      })
    }
  }

  const preview = async (
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> => {
    if (!isLocalWrite(req)) {
      sendJson(res, 403, { error: 'blueprint: local same-origin writes only' })
      return
    }
    try {
      const graph = graphFrom(await readBody(req))
      const path = patchPath()
      const source = await readPatchFile(path)
      const candidate = composePatchFile(source, rowsFor(graph))
      const revision = revisionOf(source)
      sendJson(res, 200, {
        path,
        revision,
        token: previewToken(revision, candidate),
        diff: diffLines(source, candidate),
        unchanged: candidate === source,
        findings: await preflight(graph, path),
      })
    } catch (cause) {
      sendJson(res, 400, {
        error: cause instanceof Error ? cause.message : String(cause),
      })
    }
  }

  const applyPatch = async (
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> => {
    if (!isLocalWrite(req)) {
      sendJson(res, 403, { error: 'blueprint: local same-origin writes only' })
      return
    }
    try {
      const raw = await readBody(req)
      const graph = graphFrom(raw)
      const body = JSON.parse(raw) as { revision?: string; token?: string }
      const path = patchPath()
      await exclusive(async () => {
        const source = await readPatchFile(path)
        const revision = revisionOf(source)
        if (body.revision !== revision) {
          throw Object.assign(
            new Error('blueprint: the patch file changed since the preview'),
            { status: 409 },
          )
        }
        const blocking = (await preflight(graph, path)).filter(
          (finding) => finding.level === 'blocking',
        )
        if (blocking.length > 0) {
          throw Object.assign(
            new Error(blocking.map((finding) => finding.text).join(' ')),
            { status: 422 },
          )
        }
        const candidate = composePatchFile(source, rowsFor(graph))
        if (
          typeof body.token !== 'string' ||
          !tokenMatches(body.token, revision, candidate)
        ) {
          throw Object.assign(
            new Error('blueprint: preview is stale, review the change again'),
            { status: 409 },
          )
        }
        const saved = source === '' ? undefined : await backup(path, source)
        await atomicWrite(path, source, candidate)
        sendJson(res, 200, {
          path,
          backup: saved,
          revision: revisionOf(candidate),
        })
      })
    } catch (cause) {
      const status = (cause as { status?: number }).status ?? 400
      sendJson(res, status, {
        error: cause instanceof Error ? cause.message : String(cause),
      })
    }
  }

  const backups = async (
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> => {
    if (!isLocalRead(req)) {
      sendJson(res, 403, { error: 'blueprint: local same-origin reads only' })
      return
    }
    try {
      sendJson(res, 200, { backups: await listBackups(patchPath()) })
    } catch (cause) {
      sendJson(res, 500, {
        error: cause instanceof Error ? cause.message : String(cause),
      })
    }
  }

  /**
   * Restore a snapshot. The current file is backed up first, so a restore is
   * itself undoable — rolling back should never be the irreversible step.
   */
  const restore = async (
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> => {
    if (!isLocalWrite(req)) {
      sendJson(res, 403, { error: 'blueprint: local same-origin writes only' })
      return
    }
    try {
      const body = JSON.parse(await readBody(req)) as { id?: string }
      const id = body.id
      // Reject anything that is not a bare snapshot id, so a crafted id
      // cannot walk out of the backup directory.
      if (typeof id !== 'string' || !/^[a-f0-9]{8,64}$/.test(id)) {
        throw new Error('blueprint: not a snapshot id')
      }
      const path = patchPath()
      const file = join(backupDir(path), `${id}.yml`)
      await exclusive(async () => {
        const snapshot = await readFile(file, 'utf8')
        const current = await readPatchFile(path)
        if (current !== '') {
          await backup(path, current)
        }
        await atomicWrite(path, current, snapshot)
        sendJson(res, 200, { path, revision: revisionOf(snapshot) })
      })
    } catch (cause) {
      sendJson(res, 400, {
        error: cause instanceof Error ? cause.message : String(cause),
      })
    }
  }

  /**
   * Write an agent preset, then ask the harness whether it accepted it.
   *
   * Preset discovery is unmemoized, so a preset written here is live without a
   * restart — which also means a broken one is live immediately. The harness
   * reports a broken preset with a reason rather than skipping it, so the
   * write is checked and rolled back rather than left for the user to find in
   * a session picker.
   */
  const writePreset = async (
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> => {
    if (!isLocalWrite(req)) {
      sendJson(res, 403, { error: 'blueprint: local same-origin writes only' })
      return
    }
    try {
      const raw = await readBody(req)
      const graph = graphFrom(raw)
      const body = JSON.parse(raw) as { id?: string; description?: string }
      const id = body.id ?? ''
      if (!isPresetId(id)) {
        throw new Error(
          'blueprint: a preset id must match [a-z0-9][a-z0-9-]* or discovery skips it',
        )
      }
      const dir = join(dshHome(), USER_PRESET_DIR, id)
      await exclusive(async () => {
        const composition = join(dir, 'agent.cordis.yml')
        const previous = await readPatchFile(composition)
        await mkdir(dir, { recursive: true })
        await writeFile(composition, compileGraphToPreset(graph), 'utf8')
        await writeFile(
          join(dir, 'preset.yml'),
          compilePresetManifest(
            id,
            body.description ?? 'Compiled by mddl blueprint',
          ),
          'utf8',
        )
        const health = presetProblem(compileGraphToPreset(graph))
        if (health !== undefined) {
          // Put back what was there rather than leaving a broken preset in
          // the picker.
          if (previous === '') {
            await rm(dir, { recursive: true, force: true })
          } else {
            await writeFile(composition, previous, 'utf8')
          }
          throw Object.assign(
            new Error(
              `blueprint: the harness rejected that preset — ${health}`,
            ),
            { status: 422 },
          )
        }
        sendJson(res, 200, { id, path: composition })
      })
    } catch (cause) {
      const status = (cause as { status?: number }).status ?? 400
      sendJson(res, status, {
        error: cause instanceof Error ? cause.message : String(cause),
      })
    }
  }

  ctx.effect(() =>
    ctx.webServer.register({ kind: 'exact', path: LIVE_ROUTE, handler: live }),
  )
  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: PRESET_ROUTE,
      handler: writePreset,
    }),
  )
  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: BACKUPS_ROUTE,
      handler: backups,
    }),
  )
  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: RESTORE_ROUTE,
      handler: restore,
    }),
  )
  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: PREVIEW_ROUTE,
      handler: preview,
    }),
  )
  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: APPLY_ROUTE,
      handler: applyPatch,
    }),
  )
}
