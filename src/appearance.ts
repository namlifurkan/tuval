export type Appearance = 'system' | 'light' | 'dark'

export const APPEARANCES: { id: Appearance; name: string }[] = [
  { id: 'system', name: 'System' },
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
]

const KEY = 'tuval:theme'
const BAR = { light: '#F2EFE9', dark: '#1A1917' }

const night = matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function read(): Appearance {
  try {
    const held = localStorage.getItem(KEY)
    if (held === 'light' || held === 'dark' || held === 'system') return held
  } catch { /* ignore */ }
  return 'light'
}

let mode = read()

export const getAppearance = () => mode
export const isDark = () => mode === 'dark' || (mode === 'system' && night.matches)

function apply() {
  const dark = isDark()
  const root = document.documentElement
  if (dark) root.setAttribute('data-theme', 'dark')
  else root.removeAttribute('data-theme')
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? BAR.dark : BAR.light)
}

export function setAppearance(next: Appearance) {
  if (next === mode) return
  mode = next
  try { localStorage.setItem(KEY, next) } catch { /* ignore */ }
  apply()
  listeners.forEach((l) => l())
}

export function subscribeAppearance(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

night.addEventListener('change', () => {
  if (mode !== 'system') return
  apply()
  listeners.forEach((l) => l())
})

apply()
