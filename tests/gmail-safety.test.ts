/**
 * Demo safety. The brief forbids contacting real companies; these are the
 * assertions that make that structural rather than a promise.
 */
import { describe, it, expect } from 'vitest'
import { assertComposeOnly, assertAllowedRecipient, ConnectorError } from '../lib/gmail'

describe('scope', () => {
  it('accepts compose-only', () => {
    expect(() =>
      assertComposeOnly('https://www.googleapis.com/auth/gmail.compose'),
    ).not.toThrow()
  })

  it('refuses a token that can send', () => {
    expect(() => assertComposeOnly('https://www.googleapis.com/auth/gmail.send')).toThrow(
      ConnectorError,
    )
  })

  it('refuses full mailbox access', () => {
    expect(() => assertComposeOnly('https://mail.google.com/')).toThrow(ConnectorError)
  })
})

describe('recipients', () => {
  it('allows a test address', () => {
    expect(() => assertAllowedRecipient('s.aydin@yildiztekstil.test')).not.toThrow()
  })

  it.each([
    'someone@realcompany.com',
    'buyer@yildiztekstil.com.tr',
    'test@example.org',
    'a@b.testing.com',
  ])('refuses %s', (email) => {
    expect(() => assertAllowedRecipient(email)).toThrow(ConnectorError)
  })

  it('gives the user a readable reason, not a stack trace', () => {
    try {
      assertAllowedRecipient('buyer@realcompany.com')
    } catch (e) {
      expect((e as ConnectorError).userFacing).toContain('not a test address')
    }
  })
})
