import { useSyncExternalStore } from 'react'
import { Moon, Palette, Sun } from 'lucide-react'
import type { Theme } from '../appearance'
import { getAppearance, setAppearance, subscribeAppearance, theme } from '../appearance'
import { PRODUCT } from '../board/brand'
import { t } from '../i18n'

// The three the eye can tell apart, in the order a person walks through them: our paper, plain
// white, night. System stays in Settings — it is a policy, not a fourth look, and a button that
// cycles through it lands twice on the same screen.
const ROUND: Theme[] = ['tuval', 'light', 'dark']

const MARK = { tuval: Palette, light: Sun, dark: Moon }
const NAME = { tuval: PRODUCT.name, light: 'Light', dark: 'Dark' }

export function AppearanceToggle({ className = '' }: { className?: string }) {
  const shown = useSyncExternalStore(subscribeAppearance, theme, theme)
  const held = useSyncExternalStore(subscribeAppearance, getAppearance, getAppearance)
  const Mark = MARK[shown]
  const said = `${t('Appearance')}: ${held === 'system' ? t('System') : t(NAME[shown])}`

  return (
    <button
      type="button"
      onClick={() => setAppearance(ROUND[(ROUND.indexOf(shown) + 1) % ROUND.length])}
      aria-label={said}
      title={said}
      className={`rounded-lg p-2 text-ink transition-colors hover:bg-ink/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${className}`}
    >
      <Mark size={16} strokeWidth={1.75} />
    </button>
  )
}
