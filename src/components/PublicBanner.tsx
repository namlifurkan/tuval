import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { boardToGraph, graphToPrompt } from '../board/agent'
import { PRODUCT } from '../board/brand'
import { getItems, room } from '../board/doc'
import { boardIsOpen, readProfile } from '../board/publicProfile'
import type { Profile } from '../board/publicProfile'
import { supabase } from '../board/supabase'
import { t } from '../i18n'
import { Wordmark } from './Logo'

// What a visitor gets that a screenshot could never give them: the brief itself. The board is
// already the prompt — frames are sections, arrows are a flow, code blocks are fenced code — so
// the thing the author handed their agent is one button away.
export function PublicBanner() {
  const [open, setOpen] = useState(false)
  const [author, setAuthor] = useState<Profile | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let live = true
    void boardIsOpen(room).then(async (isOpen) => {
      if (!live || !isOpen || !supabase) return
      setOpen(true)
      const { data } = await supabase.from('boards').select('owner').eq('id', room).maybeSingle()
      const owner = (data as { owner: string } | null)?.owner
      if (!owner) return
      const { data: rows } = await supabase.from('profiles').select('handle').eq('user_id', owner).maybeSingle()
      const handle = (rows as { handle: string } | null)?.handle
      if (handle && live) setAuthor(await readProfile(handle))
    })
    return () => { live = false }
  }, [])

  if (!open) return null

  const copy = () => {
    void navigator.clipboard.writeText(graphToPrompt(boardToGraph(getItems(), room)))
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex justify-center pb-1">
      <div className="flex items-center gap-2 rounded-t-xl border border-b-0 border-hairline bg-surface/95 px-3 py-1.5 shadow-[0_-2px_12px_rgba(20,19,16,0.06)] backdrop-blur-[2px]">
        {author && (
          <>
            <a
              href={`/u/${author.handle}`}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-ink hover:text-pigment"
            >
              {author.avatar && (
                <img src={author.avatar} alt="" className="h-5 w-5 rounded-md object-cover" />
              )}
              {author.name || `@${author.handle}`}
            </a>
            <span className="h-3 w-px bg-hairline" />
          </>
        )}

        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-pigment hover:bg-pigment-wash"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? t('Copied') : t('Copy the brief')}
        </button>

        <span className="h-3 w-px bg-hairline" />
        <a href="/" title={PRODUCT.name} className="opacity-50 transition-opacity hover:opacity-100">
          <Wordmark height={11} />
        </a>
      </div>
    </div>
  )
}
