import type { Node } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

export interface Hit { from: number; to: number }

// The browser's own find reads the screen, and a long page keeps most of itself out of the DOM,
// so a word further down is a word the browser says is not there. This reads the document.
//
// One text block at a time, for two reasons: a phrase never matches across a paragraph break,
// and the position of a character is worked out from the run it sits in rather than counted from
// the start of the block. A mention takes up a position and contributes no text, so counting
// would drift by one for every chip above the match.
export function findIn(doc: Node, needle: string, matchCase = false): Hit[] {
  const wanted = matchCase ? needle : needle.toLowerCase()
  if (!wanted) return []

  const hits: Hit[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true

    let text = ''
    const at: number[] = []
    node.forEach((child, offset) => {
      if (!child.isText) return
      const raw = child.text ?? ''
      for (let i = 0; i < raw.length; i += 1) at.push(pos + 1 + offset + i)
      text += raw
    })

    const hay = matchCase ? text : text.toLowerCase()
    for (let from = hay.indexOf(wanted); from >= 0; from = hay.indexOf(wanted, from + 1)) {
      const last = at[from + wanted.length - 1]
      // Characters that are not next to each other in the document have something between them,
      // and a phrase interrupted by a chip is not the phrase somebody asked for.
      if (last - at[from] !== wanted.length - 1) continue
      hits.push({ from: at[from], to: last + 1 })
    }
    return false
  })
  return hits
}

export function showHit(view: EditorView, hit: Hit) {
  const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, hit.from, hit.to))
  view.dispatch(tr.scrollIntoView())
}

// Back to front, so a replacement that changes a length does not move the matches that have not
// been made yet. One transaction, so undo puts the page back in a single step.
export function replaceHits(view: EditorView, hits: Hit[], text: string) {
  if (!hits.length) return
  const tr = view.state.tr
  for (const hit of [...hits].reverse()) tr.insertText(text, hit.from, hit.to)
  view.dispatch(tr)
}
