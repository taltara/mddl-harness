import { describe, expect, it } from 'vitest'
import { isLocalRead } from './index.ts'

function request(over: {
  method?: string
  headers?: Record<string, string>
  peer?: string
}) {
  return {
    method: over.method ?? 'GET',
    headers: (over.headers ?? { host: '127.0.0.1:3080' }) as Record<
      string,
      string
    >,
    socket: { remoteAddress: over.peer ?? '127.0.0.1' },
  }
}

describe('isLocalRead', () => {
  it('accepts a loopback same-origin GET', () => {
    expect(isLocalRead(request({}))).toBe(true)
  })

  it('accepts an IPv6 loopback peer and bracketed host', () => {
    expect(
      isLocalRead(request({ peer: '::1', headers: { host: '[::1]:3080' } })),
    ).toBe(true)
  })

  it('refuses a non-loopback peer even with a loopback Host header', () => {
    expect(isLocalRead(request({ peer: '192.168.1.20' }))).toBe(false)
  })

  it('refuses a loopback peer sending a foreign Host header', () => {
    expect(
      isLocalRead(request({ headers: { host: 'evil.example.com' } })),
    ).toBe(false)
  })

  it('refuses a cross-site fetch from loopback', () => {
    expect(
      isLocalRead(
        request({
          headers: { host: '127.0.0.1:3080', 'sec-fetch-site': 'cross-site' },
        }),
      ),
    ).toBe(false)
  })

  it('refuses any method other than GET', () => {
    expect(isLocalRead(request({ method: 'POST' }))).toBe(false)
  })
})
