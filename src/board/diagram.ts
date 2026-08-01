import { COLOR, PIGMENTS } from './brand'

// Mermaid is large and most pages have no diagram on them, so it arrives the first time one is
// drawn and never in the first load.
let engine: Promise<typeof import('mermaid').default> | null = null

const start = () => {
  engine ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      fontFamily: '"Instrument Sans", system-ui, sans-serif',
      theme: 'base',
      themeVariables: {
        background: COLOR.paper,
        primaryColor: COLOR.surface,
        primaryTextColor: COLOR.ink,
        primaryBorderColor: COLOR.ink,
        lineColor: COLOR.ink,
        secondaryColor: PIGMENTS.naples,
        tertiaryColor: PIGMENTS.celadon,
      },
    })
    return mermaid
  })
  return engine
}

let seq = 0

// A diagram that will not parse is a message where the diagram would be, not a page that stops
// rendering: the text is still in the document and still editable.
export async function renderDiagram(code: string): Promise<{ svg: string; fault: string }> {
  const text = code.trim()
  if (!text) return { svg: '', fault: '' }
  try {
    const mermaid = await start()
    seq += 1
    const { svg } = await mermaid.render(`tuval-diagram-${seq}`, text)
    return { svg, fault: '' }
  } catch (e) {
    // Mermaid leaves its scratch element behind when parsing fails.
    document.querySelector(`#dtuval-diagram-${seq}`)?.remove()
    return { svg: '', fault: e instanceof Error ? e.message : String(e) }
  }
}
