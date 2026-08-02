import { Upload, X } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { animateCamera, fitRect } from '../board/camera'
import { createItems, getMeta, setMeta } from '../board/doc'
import { briefToItems, parseBrief } from '../board/importer'
import { miroToItems } from '../board/miro'
import { boxOf } from '../board/render'
import { requestRender, useBoardStore } from '../board/store'
import { t } from '../i18n'

const SAMPLE = `# Checkout redesign

## Discovery
- Users abandon at the address step
- Payment errors are not explained
- Guest checkout is buried

## Build
\`\`\`ts
export function validateAddress(input: Address) {
  return rules.every((rule) => rule(input))
}
\`\`\`

## Flow
\`\`\`mermaid
flowchart TD
  n1["Users abandon at the address step"]
  n2["Payment errors are not explained"]
  n1 -- fix first --> n2
\`\`\`
`

export function BriefImport() {
  const open = useBoardStore((s) => s.briefOpen)
  const update = useBoardStore((s) => s.update)
  const setCamera = useBoardStore((s) => s.setCamera)
  const setSelection = useBoardStore((s) => s.setSelection)
  const camera = useBoardStore((s) => s.camera)
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => { if (open) ref.current?.focus() }, [open])

  // A Miro export is JSON, a brief is Markdown. The first non-space character decides.
  const miro = useMemo(() => {
    if (!text.trimStart().startsWith('{') && !text.trimStart().startsWith('[')) return null
    try {
      const out = miroToItems(JSON.parse(text))
      return out.items.length ? out : null
    } catch { return null }
  }, [text])

  if (!open) return null

  const preview = !miro && text.trim() ? parseBrief(text) : null
  const nodeCount = miro
    ? miro.items.filter((i) => i.type !== 'connector' && i.type !== 'frame').length
    : preview?.sections.reduce((n, s) => n + s.nodes.length, 0) ?? 0

  const create = () => {
    const el = document.querySelector('canvas')
    if (!el || !text.trim()) return
    const origin = {
      x: camera.x + el.clientWidth / 2 / camera.z - 400,
      y: camera.y + el.clientHeight / 2 / camera.z - 300,
    }
    const { items, title } = miro
      ? { items: miro.items, title: '' }
      : briefToItems(text, origin)
    if (!items.length) return
    createItems(items)
    if (title && !getMeta().name) setMeta('name', title)
    const target = fitRect(boxOf(items), el.clientWidth, el.clientHeight)
    animateCamera(useBoardStore.getState().camera, target, (c) => {
      setCamera(c)
      requestRender()
    })
    setSelection([])
    update({ briefOpen: false })
    setText('')
    requestRender()
  }

  return (
    <div className="absolute left-1/2 top-20 z-50 flex w-[min(92vw,720px)] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-black/5 bg-[#FCFBF8] shadow-[3px_3px_0_rgba(20,19,16,0.09)]">
      <div className="flex items-center justify-between border-b border-[#EAE6DD] px-3 py-2.5">
        <span className="text-sm font-semibold text-[#141310]">{t('Build a board from a brief')}</span>
        <button
          type="button"
          onClick={() => update({ briefOpen: false })}
          className="grid h-7 w-7 place-items-center rounded-md hover:bg-[#EFEBE2]"
        >
          <X size={15} />
        </button>
      </div>

      <textarea
        ref={ref}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') update({ briefOpen: false })
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) create()
        }}
        spellCheck={false}
        placeholder={t('Paste Markdown or JSON here. Headings become frames, bullets become stickies, fenced code becomes code blocks, a mermaid flow becomes connectors.')}
        className="h-[300px] w-full resize-none bg-transparent p-3 font-mono text-xs leading-relaxed outline-none placeholder:text-[#8A867C]"
      />

      <div className="flex items-center gap-2 border-t border-[#EAE6DD] px-3 py-2">
        <button
          type="button"
          onClick={() => setText(SAMPLE)}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-[#8A867C] hover:bg-[#EFEBE2]"
        >
          {t('Paste an example')}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#8A867C] hover:bg-[#EFEBE2]"
        >
          <Upload size={12} /> {t('Open a file')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.md,.markdown,.txt,application/json,text/markdown"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void file.text().then(setText)
          }}
        />
        <span className="ml-auto text-xs text-[#8A867C]">
          {miro
            ? [
              `${miro.items.filter((i) => i.type === 'frame').length} ${t('frames')}`,
              `${nodeCount} ${t('items')}`,
              `${miro.items.filter((i) => i.type === 'connector').length} ${t('connections')}`,
              ...Object.entries(miro.skipped).map(([k, n]) => `${n} ${k} ${t('skipped')}`),
            ].join(' · ')
            : preview
              ? `${preview.sections.length} ${t('frames')} · ${nodeCount} ${t('items')} · ${preview.edges.length} ${t('connections')}`
              : t('Nothing to read yet')}
        </span>
        <button
          type="button"
          disabled={!nodeCount}
          onClick={create}
          className="rounded-lg bg-[#C8452D] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#A83621] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('Create')} ⌘↵
        </button>
      </div>
    </div>
  )
}
