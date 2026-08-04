import { Eye } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { isForeign, readOnly, setRole, subscribeAccess } from '../board/access'
import { openBoard } from '../board/boards'
import { myRole } from '../board/cloud'
import { getMeta, room } from '../board/doc'
import { duplicateBoard } from '../board/duplicate'
import { boardIsOpen } from '../board/publicProfile'
import { cloudEnabled, getUser, subscribeAuth } from '../board/supabase'
import { t } from '../i18n'

export function ViewOnly() {
  const user = useSyncExternalStore(subscribeAuth, getUser, getUser)
  const ro = useSyncExternalStore(subscribeAccess, readOnly, readOnly)
  const foreign = useSyncExternalStore(subscribeAccess, isForeign, isForeign)
  const [copying, setCopying] = useState(false)

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

  // The copy is made from what this browser holds, which is the whole board: it opened from here
  // and the cloud never had a word to say about it.
  const copyHere = () => {
    if (copying) return
    setCopying(true)
    void duplicateBoard(room, String(getMeta().name ?? ''))
      .then((made) => openBoard(made))
      .catch((e: Error) => { alert(e.message); setCopying(false) })
  }

  if (foreign) {
    return (
      <span className="flex items-center gap-2 rounded-md bg-shade px-2 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-ink-soft">
        <Eye size={11} strokeWidth={2.2} />
        {t('Another account owns this board')}
        <button
          type="button"
          disabled={copying}
          onClick={copyHere}
          className="rounded px-1 text-pigment hover:bg-pigment-wash disabled:opacity-40"
        >
          {copying ? t('Copying…') : t('Copy it to mine')}
        </button>
      </span>
    )
  }

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
