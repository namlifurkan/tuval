import { useEffect, useState } from 'react'
import { History, Trash2 } from 'lucide-react'
import {
  deleteVersion, getVersions, maybeAutoSave, saveVersion, subscribeVersions, versionDoc,
} from '../board/pageHistory'
import type { Version } from '../board/pageHistory'
import { t } from '../i18n'
import { Popover } from './Popover'

function when(at: number) {
  const mins = Math.floor((Date.now() - at) / 60000)
  if (mins < 1) return t('just now')
  if (mins < 60) return t('{n} min ago', { n: mins })
  if (mins < 1440) return t('{n} h ago', { n: Math.floor(mins / 60) })
  return t('{n} d ago', { n: Math.floor(mins / 1440) })
}

// A page keeps its own past, the way a board does. The editor is passed in rather than reached
// for, because a version is the document as the editor understands it and restoring one is the
// editor putting those blocks back.
export function PageHistory({ editor }: { editor: { document: unknown[]; replaceBlocks: (from: unknown[], to: unknown[]) => void } }) {
  const [versions, setVersions] = useState<Version[]>(getVersions)

  useEffect(() => {
    const off = subscribeVersions(() => setVersions(getVersions()))
    // A sitting is saved when you arrive at a page you have already written in, which is the
    // moment before you change it again.
    const timer = window.setTimeout(() => maybeAutoSave(editor.document), 4000)
    return () => { off(); clearTimeout(timer) }
  }, [editor])

  const restore = (id: string) => {
    const held = versionDoc(id)
    if (!held) return
    // The state being left is saved first, so restoring is never the thing that loses work.
    saveVersion(t('Before going back'), editor.document)
    editor.replaceBlocks(editor.document, held)
  }

  return (
    <Popover
      width={260}
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          title={t('Version history')}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#141310]"
        >
          <History size={13} /> {t('History')}
        </button>
      )}
    >
      {(close) => (
        <>
          <button
            type="button"
            onClick={() => { saveVersion(t('Checkpoint'), editor.document); close() }}
            className="mb-1 w-full rounded-md bg-[#C8452D] px-2 py-1.5 text-[12px] font-semibold text-white hover:bg-[#A83621]"
          >{t('Save this version')}</button>

          {versions.map((v) => (
            <div key={v.id} className="group flex items-center gap-1 rounded-md px-1 hover:bg-[#EAE6DD]">
              <button
                type="button"
                onClick={() => { restore(v.id); close() }}
                className="min-w-0 flex-1 py-1 text-left"
              >
                <span className="block truncate text-[12px] text-[#141310]">
                  {v.label || t('Saved version')}
                </span>
                <span className="block truncate text-[11px] text-[#8A867C]">
                  {when(v.at)} · {v.by} · {v.blocks} {t(v.blocks === 1 ? 'block' : 'blocks')}
                </span>
              </button>
              <button
                type="button"
                aria-label={t('Delete')}
                onClick={() => deleteVersion(v.id)}
                className="grid h-5 w-5 shrink-0 place-items-center rounded text-[#8A867C] opacity-0 hover:text-[#A83621] group-hover:opacity-100"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}

          {!versions.length && (
            <p className="px-2 py-1.5 text-[12px] leading-snug text-[#8A867C]">
              {t('No versions yet. One is kept whenever you come back to a page you have written in.')}
            </p>
          )}
        </>
      )}
    </Popover>
  )
}
