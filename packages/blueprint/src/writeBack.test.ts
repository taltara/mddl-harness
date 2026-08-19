import { describe, expect, it } from 'vitest'
import { isLocalWrite } from './index.ts'
import {
  CSRF_TOKEN,
  csrfMatches,
  patchPathFromEntries,
  previewToken,
  tokenMatches,
} from './writeBack.ts'

describe('patchPathFromEntries', () => {
  it('derives the patch file from the include entry the loader read', () => {
    const path = patchPathFromEntries([
      { options: { name: 'cordis:timer' } },
      {
        options: {
          name: 'cordis:include',
          config: { path: 'file:///home/u/.dsh/profiles/web/cordis.yml' },
        },
      },
    ])
    expect(path).toBe('/home/u/.dsh/profiles/web/cordis.patch.yml')
  })

  it('accepts a plain path as well as a file URL', () => {
    const path = patchPathFromEntries([
      { options: { name: 'cordis:include', config: { path: '/tmp/p/x.yml' } } },
    ])
    expect(path).toBe('/tmp/p/cordis.patch.yml')
  })

  it('follows a profile that lives outside the default home', () => {
    const path = patchPathFromEntries([
      {
        options: {
          name: 'cordis:include',
          config: { path: 'file:///opt/custom/cordis.yml' },
        },
      },
    ])
    expect(path).toBe('/opt/custom/cordis.patch.yml')
  })

  it('returns undefined rather than guessing when there is no include', () => {
    expect(patchPathFromEntries([{ options: { name: 'cordis:timer' } }])).toBe(
      undefined,
    )
    expect(patchPathFromEntries([])).toBe(undefined)
  })

  it('ignores an include entry with no usable path', () => {
    expect(
      patchPathFromEntries([
        { options: { name: 'cordis:include', config: { path: '' } } },
      ]),
    ).toBe(undefined)
  })
})

describe('previewToken', () => {
  it('accepts the exact draft it was issued for', () => {
    const token = previewToken('rev1', 'content')
    expect(tokenMatches(token, 'rev1', 'content')).toBe(true)
  })

  it('refuses a token when the file moved under it', () => {
    const token = previewToken('rev1', 'content')
    expect(tokenMatches(token, 'rev2', 'content')).toBe(false)
  })

  it('refuses a token when the proposed content changed', () => {
    // The whole point: you cannot apply bytes the user never reviewed.
    const token = previewToken('rev1', 'content')
    expect(tokenMatches(token, 'rev1', 'content plus a sneaky row')).toBe(false)
  })

  it('refuses a forged token', () => {
    expect(tokenMatches('0'.repeat(64), 'rev1', 'content')).toBe(false)
  })

  it('refuses a token of the wrong length without throwing', () => {
    expect(tokenMatches('short', 'rev1', 'content')).toBe(false)
  })
})

describe('csrfMatches', () => {
  it('accepts the session token', () => {
    expect(csrfMatches(CSRF_TOKEN)).toBe(true)
  })

  it('refuses anything else', () => {
    expect(csrfMatches('nope')).toBe(false)
    expect(csrfMatches(undefined)).toBe(false)
    expect(csrfMatches(['a', 'b'])).toBe(false)
  })
})

function writeRequest(over: {
  method?: string
  headers?: Record<string, string>
  peer?: string
}) {
  return {
    method: over.method ?? 'POST',
    headers: (over.headers ?? {
      host: '127.0.0.1:3080',
      'x-blueprint-csrf': CSRF_TOKEN,
    }) as Record<string, string>,
    socket: { remoteAddress: over.peer ?? '127.0.0.1' },
  }
}

describe('isLocalWrite', () => {
  it('accepts a loopback POST carrying the session token', () => {
    expect(isLocalWrite(writeRequest({}))).toBe(true)
  })

  it('reads headers that live on the prototype, as IncomingMessage does', () => {
    // Regression: the check used to spread the request, which drops a
    // prototype getter and made every real POST throw before any of the
    // rules below could run. Plain-object fixtures cannot catch that.
    const proto = {
      get headers() {
        return { host: '127.0.0.1:3080', 'x-blueprint-csrf': CSRF_TOKEN }
      },
    }
    const req = Object.create(proto) as ReturnType<typeof writeRequest>
    Object.assign(req, {
      method: 'POST',
      socket: { remoteAddress: '127.0.0.1' },
    })
    expect(Object.hasOwn(req, 'headers')).toBe(false)
    expect(isLocalWrite(req)).toBe(true)
  })

  it('refuses a GET', () => {
    expect(isLocalWrite(writeRequest({ method: 'GET' }))).toBe(false)
  })

  it('refuses a POST without the session token', () => {
    expect(
      isLocalWrite(writeRequest({ headers: { host: '127.0.0.1:3080' } })),
    ).toBe(false)
  })

  it('refuses a non-loopback peer even with a valid token', () => {
    expect(isLocalWrite(writeRequest({ peer: '10.0.0.5' }))).toBe(false)
  })

  it('refuses a cross-site POST', () => {
    expect(
      isLocalWrite(
        writeRequest({
          headers: {
            host: '127.0.0.1:3080',
            'x-blueprint-csrf': CSRF_TOKEN,
            'sec-fetch-site': 'cross-site',
          },
        }),
      ),
    ).toBe(false)
  })

  it('refuses a foreign Host header', () => {
    expect(
      isLocalWrite(
        writeRequest({
          headers: {
            host: 'evil.example.com',
            'x-blueprint-csrf': CSRF_TOKEN,
          },
        }),
      ),
    ).toBe(false)
  })
})
