import { Eye } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import { readOnly, setRole, subscribeAccess } from '../board/access'
import { myRole } from '../board/cloud'
import { room } from '../board/doc'
import { boardIsOpen } from '../board/publicProfile'
import { cloudEnabled, getUser, subscribeAuth } from '../board/supabase'
import { t } from '../i18n'

export function ViewOnly() {
  const user = useSyncExternalStore(subscribeAuth, getUser, getUser)
  const ro = useSyncExternalStore(subscribeAccess, readOnly, readOnly)

  // A board opened to the world is read by people with no place on it and often no account at
  // all. Asked second, so somebody who is on the board still gets the role they were given.
  useEffect(() => {
    if (!cloudEnabled) { setRole(null); return }
    let live = true
    const settle = async () => {
      const mine = user ? await myRole(room) : null
      if (mine) return mine
      return (await boardIsOpen(room)) ? ('viewer' as const) : null
    }
    void settle().then((r) => { if (live) setRole(r) })
    return () => { live = false }
  }, [user])

  if (!ro) return null

  return (
    <span
      title={t('The owner shared this board with you as a viewer. Ask them for edit access.')}
      className="flex items-center gap-1 rounded-md bg-shade px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.13em] text-ink-soft"
    >
      <Eye size={11} strokeWidth={2.2} />
      {t('View only')}
    </span>
  )
}
