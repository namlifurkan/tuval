import { describe, expect, it } from 'vitest'
import { storagePath } from './storage'
import { passwordProblem } from './supabase'

describe('naming an object in the bucket', () => {
  it('reads a bare path as written', () => {
    expect(storagePath('demo-board/abc.webp')).toBe('demo-board/abc.webp')
    expect(storagePath('/demo-board/abc.webp')).toBe('demo-board/abc.webp')
  })

  it('recovers the path from a public url written before the bucket was closed', () => {
    expect(storagePath('https://x.supabase.co/storage/v1/object/public/board-images/demo/a.webp'))
      .toBe('demo/a.webp')
  })

  it('recovers it from an expired signed url too', () => {
    expect(storagePath('https://x.supabase.co/storage/v1/object/sign/board-images/demo/a.webp?token=zz'))
      .toBe('demo/a.webp')
  })

  it('unescapes a path that needed it', () => {
    expect(storagePath('https://x.supabase.co/storage/v1/object/public/board-images/my%20board/a.webp'))
      .toBe('my board/a.webp')
  })

  it('leaves alone anything that is not ours', () => {
    expect(storagePath('data:image/webp;base64,AAAA')).toBe(null)
    expect(storagePath('https://images.example.com/photo.jpg')).toBe(null)
    expect(storagePath('')).toBe(null)
  })
})

describe('choosing a password', () => {
  it('refuses one that is too short', () => {
    expect(passwordProblem('short', 'short')).toBe('At least 8 characters.')
  })

  it('refuses two that differ', () => {
    expect(passwordProblem('longenough', 'longenougH')).toBe('The two passwords do not match.')
  })

  it('accepts a long pair that matches', () => {
    expect(passwordProblem('longenough', 'longenough')).toBe(null)
  })
})
