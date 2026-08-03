import { PRODUCT } from './board/brand'

export type Appearance = 'system' | 'tuval' | 'light' | 'dark'
export type Theme = Exclude<Appearance, 'system'>

export const APPEARANCES: { id: Appearance; name: string }[] = [
  { id: 'system', name: 'System' },
  { id: 'tuval', name: PRODUCT.name },
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
]

const KEY = 'tuval:theme'
const BAR: { [K in Theme]: string } = { tuval: '#F2EFE9', light: '#FFFFFF', dark: '#1A1917' }

const night = matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function read(): Appearance {
  try {
    const held = localStorage.getItem(KEY)
    if (held && APPEARANCES.some((a) => a.id === held)) return held as Appearance
  } catch { /* ignore */ }
  return 'tuval'
}

let mode = read()

export const getAppearance = () => mode
export const theme = (): Theme => (mode === 'system' ? (night.matches ? 'dark' : 'tuval') : mode)
export const isDark = () => theme() === 'dark'

function apply() {
  const shown = theme()
  document.documentElement.setAttribute('data-theme', shown)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[shown])
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
