import { useState } from 'react'
import { boardToGraph, download, graphToPrompt } from '../board/agent'
import { getItems } from '../board/doc'
import { useBoardStore } from '../board/store'
import { Spark } from './icons'
import { IconButton, Popover, usePopover } from './ui'

const CHAT = [
  { id: 'claude', name: 'Claude', href: (q: string) => `https://claude.ai/new?q=${q}` },
  { id: 'chatgpt', name: 'ChatGPT', href: (q: string) => `https://chatgpt.com/?q=${q}` },
]

const slug = (s: string) => s.trim().toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') || 'board'

export function HandoffMenu() {
  const pop = usePopover()
  const selection = useBoardStore((s) => s.selection)
  const [note, setNote] = useState<string | null>(null)

  const build = () => {
    const all = getItems()
    const picked = selection.length ? all.filter((i) => selection.includes(i.id)) : all
    const name = useBoardStore.getState().boardName || 'Adsız board'
    return {
      name,
      graph: boardToGraph(picked, name, selection.length ? 'selection' : 'board'),
    }
  }

  const flash = (text: string) => {
    setNote(text)
    setTimeout(() => setNote(null), 2200)
  }

  const copyPrompt = async () => {
    const { graph } = build()
    await navigator.clipboard.writeText(graphToPrompt(graph))
    flash('Prompt panoya kopyalandı. Claude Code, Cursor veya Codex\'e yapıştır.')
  }

  const openChat = (make: (q: string) => string) => {
    const { graph } = build()
    const prompt = graphToPrompt(graph)
    const url = make(encodeURIComponent(prompt))
    if (url.length > 7500) {
      navigator.clipboard.writeText(prompt)
      flash('Board bir URL için fazla büyük — prompt panoya kopyalandı, sohbete yapıştır.')
      window.open(CHAT[0].href(''), '_blank', 'noopener')
      return
    }
    window.open(url, '_blank', 'noopener')
  }

  const scope = selection.length ? `Seçim (${selection.length})` : 'Tüm board'

  return (
    <div className="relative">
      <IconButton
        title="AI'ya devret"
        active={pop.open}
        onClick={pop.toggle}
        className={pop.open ? '' : 'text-[#C8452D] hover:bg-[#F7E9E4] hover:ring-[#C8452D]/25'}
      >
        <Spark size={18} />
      </IconButton>
      <Popover open={pop.open} onClose={pop.close} anchor="bottomRight" className="w-[270px]">
        <div className="flex items-center justify-between px-2.5 pb-1.5 pt-1">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[#C8452D]"><Spark size={13} /> AI'ya devret</span>
          <span className="text-xs text-[#8A867C]">{scope}</span>
        </div>

        {CHAT.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => { openChat(c.href); pop.close() }}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
          >
            <span>{c.name}'da aç</span>
            <span className="text-xs text-[#8A867C]">↗</span>
          </button>
        ))}

        <div className="my-1 h-px bg-[#EAE6DD]" />

        <button
          type="button"
          onClick={() => { copyPrompt(); pop.close() }}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
        >
          Prompt'u kopyala
        </button>
        <button
          type="button"
          onClick={() => {
            const { name, graph } = build()
            download(`${slug(name)}.md`, graphToPrompt(graph), 'text/markdown')
            pop.close()
          }}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
        >
          Markdown indir
        </button>
        <button
          type="button"
          onClick={() => {
            const { name, graph } = build()
            download(`${slug(name)}.json`, JSON.stringify(graph, null, 2), 'application/json')
            pop.close()
          }}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
        >
          JSON indir
        </button>

        <p className="px-2.5 pb-1 pt-2 text-[11px] leading-snug text-[#8A867C]">
          Frame'ler bölüme, oklar mermaid akışına, kod blokları fenced code'a dönüşür.
          Okuma sırası yukarıdan aşağı, soldan sağa.
        </p>
      </Popover>

      {note && (
        <div className="fixed bottom-24 left-1/2 z-[80] max-w-[420px] -translate-x-1/2 rounded-lg border border-black/5 bg-[#C8452D] px-3 py-2 text-sm text-[#FCFBF8] shadow-[3px_3px_0_rgba(20,19,16,0.09)]">
          {note}
        </div>
      )}
    </div>
  )
}
