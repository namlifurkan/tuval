import { useEffect, useRef, useState } from 'react'
import { coverUrl, removeCover, uploadCover } from '../board/cover'
import { patchRecord } from '../board/records'
import { t } from '../i18n'

// The band across the top of a page. Absent by default: a cover on every page is wallpaper, and
// the ones that have one should stand out because of it.
export function Cover({ id, path }: { id: string; path: string }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [trouble, setTrouble] = useState('')
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!path) { setUrl(''); return }
    let live = true
    void coverUrl(path).then((made) => { if (live) setUrl(made) })
    return () => { live = false }
  }, [path])

  const choose = async (picked: File) => {
    setBusy(true)
    setTrouble('')
    try {
      const made = await uploadCover(id, picked)
      // The old one is dropped only once the new one is safely up, so a failed upload leaves
      // the page with the cover it had rather than with none.
      if (path) void removeCover(path)
      patchRecord(id, { cover: made })
    } catch (e) {
      setTrouble(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  const input = (
    <input
      ref={file}
      type="file"
      accept="image/*"
      hidden
      onChange={(e) => {
        const picked = e.target.files?.[0]
        e.target.value = ''
        if (picked) void choose(picked)
      }}
    />
  )

  if (!path) {
    return (
      <>
        {input}
        <button
          type="button"
          disabled={busy}
          onClick={() => file.current?.click()}
          className="rounded-md px-2 py-1 text-[12px] font-semibold text-muted hover:bg-shade hover:text-ink disabled:opacity-40"
        >
          {busy ? t('Uploading…') : t('Add a cover')}
        </button>
        {trouble && <p className="mt-1 text-[12px] text-[#943321]">{trouble}</p>}
      </>
    )
  }

  return (
    <div className="group relative -mx-6 -mt-7 mb-4 h-[180px] overflow-hidden bg-shade">
      {input}
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      <div className="absolute bottom-2 right-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          disabled={busy}
          onClick={() => file.current?.click()}
          className="rounded-md border border-hairline bg-surface/92 px-2 py-1 text-[11px] font-semibold text-ink backdrop-blur-[2px] hover:border-pigment disabled:opacity-40"
        >
          {busy ? t('Uploading…') : t('Change')}
        </button>
        <button
          type="button"
          onClick={() => { void removeCover(path); patchRecord(id, { cover: '' }) }}
          className="rounded-md border border-hairline bg-surface/92 px-2 py-1 text-[11px] font-semibold text-muted backdrop-blur-[2px] hover:text-[#943321]"
        >
          {t('Remove cover')}
        </button>
      </div>
    </div>
  )
}
