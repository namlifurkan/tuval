import { Eye } from 'lucide-react'
import { useEffect, useSyncExternalStore } from 'react'
import { readOnly, setRole, subscribeAccess } from '../board/access'
import { myRole } from '../board/cloud'
import { room } from '../board/doc'
import { cloudEnabled, getUser, subscribeAuth } from '../board/supabase'
import { t } from '../i18n'

export function ViewOnly() {
  const user = useSyncExternalStore(subscribeAuth, getUser, getUser)
  const ro = useSyncExternalStore(subscribeAccess, readOnly, readOnly)

  useEffect(() => {
    if (!cloudEnabled || !user) { setRole(null); return }
    let live = true
    void myRole(room).then((r) => { if (live) setRole(r) })
    return () => { live = false }
  }, [user])

  if (!ro) return null

  return (
    <span
      title={t('The owner shared this board with you as a viewer. Ask them for edit access.')}
      className="flex items-center gap-1 rounded-md bg-[#EBE7DE] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.13em] text-[#4A463E]"
    >
      <Eye size={11} strokeWidth={2.2} />
      {t('View only')}
    </span>
  )
}
