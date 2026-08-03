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

const themeColor = () => document.querySelector('meta[name="theme-color"]')?.getAttribute('content')

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.head.innerHTML = '<meta name="theme-color" content="#F2EFE9">'
})

test('with nothing stored it opens light, whatever the system says', async () => {
  system(true)
  const { getAppearance } = await load()
  expect(getAppearance()).toBe('light')
  expect(document.documentElement.getAttribute('data-theme')).toBe(null)
  expect(themeColor()).toBe('#F2EFE9')

  system(false)
  await load()
  expect(document.documentElement.getAttribute('data-theme')).toBe(null)
  expect(themeColor()).toBe('#F2EFE9')
})

test('system is still a choice, it is just not the default', async () => {
  system(true)
  localStorage.setItem('tuval:theme', 'system')
  const { getAppearance } = await load()
  expect(getAppearance()).toBe('system')
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

test('a stored choice outranks the system', async () => {
  localStorage.setItem('tuval:theme', 'light')
  system(true)
  await load()
  expect(document.documentElement.getAttribute('data-theme')).toBe(null)
  expect(themeColor()).toBe('#F2EFE9')
})

test('choosing dark persists and paints, and tells whoever is listening', async () => {
  system(false)
  const { setAppearance, subscribeAppearance, isDark } = await load()
  let told = 0
  subscribeAppearance(() => { told += 1 })

  setAppearance('dark')
  expect(localStorage.getItem('tuval:theme')).toBe('dark')
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
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
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

  setAppearance('light')
  flip(true)
  expect(document.documentElement.getAttribute('data-theme')).toBe(null)
})

test('a browser that refuses storage still resolves a theme', async () => {
  system(true)
  const held = Storage.prototype.getItem
  Storage.prototype.getItem = () => { throw new Error('denied') }
  try {
    const { getAppearance } = await load()
    expect(getAppearance()).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe(null)
  } finally {
    Storage.prototype.getItem = held
  }
})
