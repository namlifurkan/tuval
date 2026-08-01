import { describe, expect, it } from 'vitest'
import { readable, readMinutes, weekOf } from './time'

describe('readMinutes', () => {
  it('takes the shapes people actually type', () => {
    expect(readMinutes('45')).toBe(45)
    expect(readMinutes('90m')).toBe(90)
    expect(readMinutes('2h')).toBe(120)
    expect(readMinutes('1h30')).toBe(90)
    expect(readMinutes('1h30m')).toBe(90)
    expect(readMinutes('1.5h')).toBe(90)
    expect(readMinutes('1,5h')).toBe(90)
  })

  it('takes the Turkish ones too, because the interface is in it', () => {
    expect(readMinutes('2sa')).toBe(120)
    expect(readMinutes('45dk')).toBe(45)
  })

  it('is nothing rather than a guess', () => {
    expect(readMinutes('')).toBe(0)
    expect(readMinutes('bir saat falan')).toBe(0)
    expect(readMinutes('h')).toBe(0)
  })
})

describe('readable', () => {
  it('says what a person would say', () => {
    expect(readable(0)).toBe('0')
    expect(readable(45)).toBe('45m')
    expect(readable(60)).toBe('1h')
    expect(readable(90)).toBe('1h 30m')
    expect(readable(600)).toBe('10h')
  })
})

describe('weekOf', () => {
  it('opens on Monday whichever day is asked about', () => {
    // 1 August 2026 is a Saturday.
    expect(weekOf('2026-08-01')[0]).toBe('2026-07-27')
    expect(weekOf('2026-07-27')[0]).toBe('2026-07-27')
    expect(weekOf('2026-08-02')[0]).toBe('2026-07-27')
    // Sunday belongs to the week that started, not the one about to.
    expect(weekOf('2026-08-02').at(-1)).toBe('2026-08-02')
  })

  it('is always seven days', () => {
    for (const day of ['2026-01-01', '2026-12-31', '2024-02-29']) {
      expect(weekOf(day)).toHaveLength(7)
    }
  })
})
