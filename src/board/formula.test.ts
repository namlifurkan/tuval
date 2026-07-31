import { describe, expect, it } from 'vitest'
import { ERROR, evaluate, today } from './formula'

const props = { Name: 'Ayse', Price: 100, Qty: 3, Done: true, Due: '2026-08-14', Blank: '' }

describe('evaluate', () => {
  it('reads a column through prop, spaces and all', () => {
    expect(evaluate('prop("Price") * prop("Qty")', { ...props, 'Unit price': 7 })).toBe(300)
    expect(evaluate('prop("Unit price") + 1', { ...props, 'Unit price': 7 })).toBe(8)
  })

  it('joins text and chooses', () => {
    expect(evaluate('prop("Name") || " — " || prop("Due")', props)).toBe('Ayse — 2026-08-14')
    expect(evaluate('prop("Price") > 50 ? "big" : "small"', props)).toBe('big')
  })

  it('has the handful of functions the header promises', () => {
    expect(evaluate('round(prop("Price") / 3)', props)).toBe(33)
    expect(evaluate('abs(0 - prop("Qty"))', props)).toBe(3)
    expect(evaluate('min(prop("Price"), prop("Qty"))', props)).toBe(3)
    expect(evaluate('max(prop("Price"), prop("Qty"))', props)).toBe(100)
    expect(evaluate('empty(prop("Blank"))', props)).toBe(true)
    expect(evaluate('empty(prop("Name"))', props)).toBe(false)
    expect(evaluate('text(prop("Qty")) || "x"', props)).toBe('3x')
    expect(evaluate('number("12,5") + 0.5', props)).toBe(13)
    expect(evaluate('days("2026-08-01", "2026-08-14")', props)).toBe(13)
    expect(evaluate('today()', props)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('says so rather than throwing', () => {
    expect(evaluate('prop("Price") *', props)).toBe(ERROR)
    expect(evaluate('nosuchfunction(1)', props)).toBe(ERROR)
    expect(evaluate('1 / 0', props)).toBe(ERROR)
  })

  it('is empty when there is nothing to work out', () => {
    expect(evaluate('   ', props)).toBe('')
    expect(evaluate('prop("Missing")', props)).toBe('')
  })

  it('never reaches the machine it runs on', () => {
    for (const attack of ['constructor', 'globalThis', 'process.exit(1)', '(1).constructor']) {
      expect(evaluate(attack, props)).toBe(ERROR)
    }
  })
})

describe('today', () => {
  it('is the day where the person is, not the day in UTC', () => {
    const at = new Date()
    const local = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
    expect(today()).toBe(local)
    expect(evaluate('today()', {})).toBe(local)
  })
})
