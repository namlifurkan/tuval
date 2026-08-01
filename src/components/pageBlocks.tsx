import { useEffect, useState } from 'react'
import { createReactBlockSpec } from '@blocknote/react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { PIGMENTS } from '../board/brand'
import { renderDiagram } from '../board/diagram'
import { t } from '../i18n'

// Blocks BlockNote does not ship and a document written in Notion expects to find. Each is the
// smallest thing that does the job: a callout is a coloured band, an equation is KaTeX, a table
// of contents is the headings read back.

const TONES: { [key: string]: { band: string; wash: string } } = {
  grey: { band: PIGMENTS.stone, wash: '#EDEAE3' },
  yellow: { band: PIGMENTS.ochre, wash: '#F6EDCE' },
  red: { band: PIGMENTS.terracotta, wash: '#F2DCD5' },
  green: { band: PIGMENTS.olive, wash: '#E4EBD4' },
  blue: { band: PIGMENTS.cerulean, wash: '#DCE6EE' },
}

export const TONE_NAMES = Object.keys(TONES)

// A note beside the text rather than inside it. The emoji is part of the block, because a
// callout with no mark is a paragraph with a background.
export const Callout = createReactBlockSpec(
  {
    type: 'callout',
    propSchema: { tone: { default: 'yellow' }, icon: { default: '💡' } },
    content: 'inline',
  },
  {
    render: ({ block, editor, contentRef }) => {
      const tone = TONES[block.props.tone] ?? TONES.yellow
      return (
        <div
          className="flex w-full gap-2.5 rounded-lg px-3 py-2.5"
          style={{ background: tone.wash, boxShadow: `inset 3px 0 0 ${tone.band}` }}
        >
          <button
            type="button"
            contentEditable={false}
            aria-label={t('Change the tone')}
            onClick={() => {
              const at = TONE_NAMES.indexOf(block.props.tone)
              const next = TONE_NAMES[(at + 1) % TONE_NAMES.length]
              editor.updateBlock(block, { props: { tone: next } })
            }}
            className="h-6 shrink-0 select-none text-[16px] leading-6"
          >{block.props.icon}</button>
          <div ref={contentRef} className="min-w-0 flex-1" />
        </div>
      )
    },
  },
)

// KaTeX renders into a string and refuses to throw, so a half-typed formula shows what is wrong
// where the formula is rather than taking the page down.
export const Equation = createReactBlockSpec(
  { type: 'equation', propSchema: { tex: { default: '' } }, content: 'none' },
  {
    render: ({ block, editor }) => {
      const [open, setOpen] = useState(!block.props.tex)
      const tex = block.props.tex

      if (open) {
        return (
          <div className="w-full" contentEditable={false}>
            <input
              autoFocus
              defaultValue={tex}
              spellCheck={false}
              placeholder="c = \pm\sqrt{a^2 + b^2}"
              onBlur={(e) => {
                editor.updateBlock(block, { props: { tex: e.target.value } })
                setOpen(false)
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
              className="w-full rounded-md border border-[#E2DED5] bg-[#F2EFE9] px-2 py-1.5 font-mono text-[13px] outline-none focus:border-[#C8452D]"
            />
          </div>
        )
      }

      return (
        <div
          className="w-full cursor-text rounded-md px-1 py-1 text-center hover:bg-[#F2EFE9]"
          contentEditable={false}
          onClick={() => setOpen(true)}
          dangerouslySetInnerHTML={{
            __html: katex.renderToString(tex, { throwOnError: false, displayMode: true }),
          }}
        />
      )
    },
  },
)

// A diagram written as text. The text is what is stored, so it stays readable, diffable and
// pasteable into anything else that speaks mermaid — including the brief this board hands to an
// agent, which is where most of these are written in the first place.
export const Diagram = createReactBlockSpec(
  { type: 'diagram', propSchema: { code: { default: '' } }, content: 'none' },
  {
    render: ({ block, editor }) => {
      const code = block.props.code
      const [open, setOpen] = useState(!code)
      const [drawn, setDrawn] = useState<{ svg: string; fault: string }>({ svg: '', fault: '' })

      useEffect(() => {
        let live = true
        void renderDiagram(code).then((r) => { if (live) setDrawn(r) })
        return () => { live = false }
      }, [code])

      if (open) {
        return (
          <div className="w-full" contentEditable={false}>
            <textarea
              autoFocus
              rows={Math.max(4, code.split('\n').length + 1)}
              defaultValue={code}
              spellCheck={false}
              placeholder={'graph TD\n  A[Idea] --> B[Work]'}
              onBlur={(e) => {
                editor.updateBlock(block, { props: { code: e.target.value } })
                setOpen(false)
              }}
              className="w-full resize-y rounded-md border border-[#E2DED5] bg-[#F2EFE9] px-2 py-1.5 font-mono text-[13px] leading-relaxed outline-none focus:border-[#C8452D]"
            />
            <p className="mt-1 text-[11px] text-[#8A867C]">
              {t('Mermaid. Click away to draw it.')}
            </p>
          </div>
        )
      }

      return (
        <div
          className="w-full cursor-text rounded-md px-1 py-2 hover:bg-[#F2EFE9]"
          contentEditable={false}
          onClick={() => setOpen(true)}
        >
          {drawn.fault ? (
            <p className="rounded-md bg-[#F7E9E4] px-2 py-1.5 font-mono text-[12px] text-[#C8452D]">
              {drawn.fault}
            </p>
          ) : (
            <div className="overflow-x-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: drawn.svg }} />
          )}
        </div>
      )
    },
  },
)

// Read from the document rather than kept beside it, so a heading renamed is a line renamed and
// there is nothing to refresh.
export const Contents = createReactBlockSpec(
  { type: 'toc', propSchema: {}, content: 'none' },
  {
    render: ({ editor }) => {
      // The editor here is typed as knowing only this block, which is not what the document is.
      type Line = { id: string; type: string; props?: { level?: number }; content?: { text?: string }[] }
      const headings = (editor.document as unknown as Line[]).filter((b) => b.type === 'heading')

      return (
        <div className="w-full border-l-2 border-[#E2DED5] py-1 pl-3" contentEditable={false}>
          {!headings.length && (
            <p className="text-[13px] text-[#8A867C]">{t('Headings in this page will be listed here.')}</p>
          )}
          {headings.map((block) => {
            const level = Number(block.props?.level ?? 1)
            const text = (block.content ?? []).map((part) => part.text ?? '').join('')
            return (
              <button
                key={block.id}
                type="button"
                onClick={() =>
                  document.querySelector(`[data-id="${block.id}"]`)
                    ?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
                style={{ paddingLeft: (level - 1) * 14 }}
                className="block w-full truncate py-0.5 text-left text-[13px] text-[#4A463E] hover:text-[#C8452D]"
              >
                {text || t('Untitled')}
              </button>
            )
          })}
        </div>
      )
    },
  },
)

const hostOf = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// A link written out as a card. No fetching: reading somebody's page to make a preview is a
// request from our server on their behalf, and there is no server here to make it.
export const Bookmark = createReactBlockSpec(
  { type: 'bookmark', propSchema: { url: { default: '' }, label: { default: '' } }, content: 'none' },
  {
    render: ({ block, editor }) => {
      const { url, label } = block.props
      if (!url) {
        return (
          <input
            autoFocus
            placeholder={t('Paste a link')}
            contentEditable={false}
            onBlur={(e) => editor.updateBlock(block, { props: { url: e.target.value.trim() } })}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            className="w-full rounded-md border border-[#E2DED5] bg-[#F2EFE9] px-2 py-1.5 text-[13px] outline-none focus:border-[#C8452D]"
          />
        )
      }
      return (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          contentEditable={false}
          className="block w-full rounded-lg border border-[#E2DED5] px-3 py-2 hover:border-[#C8452D]"
        >
          <span className="block truncate text-[13px] font-semibold text-[#141310]">
            {label || hostOf(url) || url}
          </span>
          <span className="block truncate text-[11px] text-[#8A867C]">{url}</span>
        </a>
      )
    },
  },
)

// The same iframe the canvas uses, in a document. Sandboxed: a page in a frame should not be
// able to reach the page around it.
export const Frame = createReactBlockSpec(
  { type: 'embed', propSchema: { url: { default: '' }, height: { default: 360 } }, content: 'none' },
  {
    render: ({ block, editor }) => {
      const { url } = block.props
      if (!url) {
        return (
          <input
            autoFocus
            placeholder={t('Link to embed (YouTube, Vimeo, Loom, Figma or any site)')}
            contentEditable={false}
            onBlur={(e) => editor.updateBlock(block, { props: { url: e.target.value.trim() } })}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            className="w-full rounded-md border border-[#E2DED5] bg-[#F2EFE9] px-2 py-1.5 text-[13px] outline-none focus:border-[#C8452D]"
          />
        )
      }
      return (
        <div className="w-full overflow-hidden rounded-lg border border-[#E2DED5]" contentEditable={false}>
          <iframe
            src={url}
            title={url}
            height={Number(block.props.height) || 360}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            referrerPolicy="no-referrer"
            className="block w-full"
          />
        </div>
      )
    },
  },
)
