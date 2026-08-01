import { describe, expect, it } from 'vitest'
import { authMessage } from './supabase'

describe('authentication errors', () => {
  it('turns invalid credentials into an instruction the UI can translate', () => {
    expect(authMessage(new Error('Invalid login credentials'))).toBe('Email or password is incorrect.')
  })

  it('recognises Supabase error codes without depending on their prose', () => {
    const error = Object.assign(new Error('Too many requests'), { code: 'over_email_send_rate_limit' })
    expect(authMessage(error)).toBe('Too many emails were requested. Wait a minute and try again.')
  })

  it('keeps an unknown message visible', () => {
    expect(authMessage(new Error('Unexpected provider response'))).toBe('Unexpected provider response')
  })
})
