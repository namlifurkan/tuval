import { beforeEach, expect, test, vi } from 'vitest'

// A real MediaQueryList keeps the same object and updates `matches` on it, so the stub has to
// as well: a fresh object per call would never reach the listener the module is holding.
let watched = { matches: false, listeners: new Set<() => void>() }

function system(dark: boolean) {
  watched = { matches: dark, listeners: new Set<() => void>() }
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return watched.matches },
    addEventListener: (_: string, fn: () => void) => { watched.listeners.add(fn) },
  }))
}

function flip(dark: boolean) {
  watched.matches = dark
  watched.listeners.forEach((fn) => fn())
}

async function load() {
  vi.resetModules()
  return import('./appearance')
}

const painted = () => document.documentElement.getAttribute('data-theme')
const themeColor = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content')

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.head.innerHTML = '<meta name="theme-color" content="#F2EFE9">'
})

test('with nothing stored it opens on our own paper, whatever the system says', async () => {
  system(true)
  const { getAppearance } = await load()
  expect(getAppearance()).toBe('tuval')
  expect(painted()).toBe('tuval')
  expect(themeColor()).toBe('#F2EFE9')

  system(false)
  await load()
  expect(painted()).toBe('tuval')
})

test('system is still a choice, it is just not the default', async () => {
  system(true)
  localStorage.setItem('tuval:theme', 'system')
  const { getAppearance } = await load()
  expect(getAppearance()).toBe('system')
  expect(painted()).toBe('dark')

  system(false)
  await load()
  expect(painted()).toBe('tuval')
})

test('plain white is its own theme, not the absence of one', async () => {
  localStorage.setItem('tuval:theme', 'light')
  system(true)
  const { isDark } = await load()
  expect(painted()).toBe('light')
  expect(themeColor()).toBe('#FFFFFF')
  expect(isDark()).toBe(false)
})

test('choosing dark persists and paints, and tells whoever is listening', async () => {
  system(false)
  const { setAppearance, subscribeAppearance, isDark } = await load()
  let told = 0
  subscribeAppearance(() => { told += 1 })

  setAppearance('dark')
  expect(localStorage.getItem('tuval:theme')).toBe('dark')
  expect(painted()).toBe('dark')
  expect(themeColor()).toBe('#1A1917')
  expect(isDark()).toBe(true)
  expect(told).toBe(1)

  setAppearance('dark')
  expect(told).toBe(1)
})

test('the system flipping moves a system reader and leaves a decided one alone', async () => {
  system(false)
  localStorage.setItem('tuval:theme', 'system')
  const { setAppearance } = await load()

  flip(true)
  expect(painted()).toBe('dark')

  setAppearance('light')
  flip(true)
  expect(painted()).toBe('light')
})

test('a stored value nobody ships any more falls back rather than painting nothing', async () => {
  system(true)
  localStorage.setItem('tuval:theme', 'sepia')
  const { getAppearance } = await load()
  expect(getAppearance()).toBe('tuval')
  expect(painted()).toBe('tuval')
})

test('a browser that refuses storage still resolves a theme', async () => {
  system(true)
  const held = Storage.prototype.getItem
  Storage.prototype.getItem = () => { throw new Error('denied') }
  try {
    const { getAppearance } = await load()
    expect(getAppearance()).toBe('tuval')
    expect(painted()).toBe('tuval')
  } finally {
    Storage.prototype.getItem = held
  }
})
