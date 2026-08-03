import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import { getAppearance, isDark, setAppearance, subscribeAppearance } from '../appearance'
import { t } from '../i18n'

export function AppearanceToggle({ className = '' }: { className?: string }) {
  const dark = useSyncExternalStore(subscribeAppearance, isDark, isDark)
  const held = useSyncExternalStore(subscribeAppearance, getAppearance, getAppearance)
  const said = `${t('Appearance')}: ${t(held === 'system' ? 'System' : dark ? 'Dark' : 'Light')}`

  return (
    <button
      type="button"
      onClick={() => setAppearance(dark ? 'light' : 'dark')}
      aria-label={said}
      title={said}
      className={`rounded-lg p-2 text-ink transition-colors hover:bg-ink/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${className}`}
    >
      {dark ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
    </button>
  )
}
