import { COLOR, FONT } from './brand'
import { ARTIFACT_SHEET } from './artifacts'
import { renderToCanvas } from './export'
import { aabb, contains } from './geometry'
import { sortedFrames } from './items'
import type { Item } from './types'

const STYLE_ID = 'tuval-print-style'
const ROOT_ID = 'tuval-print-root'

const PRINT_CSS = `
@media print {
  @page { size: landscape; margin: 0; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  *, *::before, *::after { animation: none !important; transition: none !important; }
  body > *:not(#${ROOT_ID}) { display: none !important; }
  #${ROOT_ID} { display: block !important; background: ${ARTIFACT_SHEET}; }
  #${ROOT_ID} figure {
    margin: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    break-after: page;
    page-break-after: always;
  }
  #${ROOT_ID} figure:last-child { break-after: auto; page-break-after: auto; }
  #${ROOT_ID} img { max-width: 96vw; max-height: 88vh; object-fit: contain; }
  #${ROOT_ID} figcaption {
    margin-top: 8mm;
    font: 500 10pt ${FONT.stack};
    color: ${COLOR.inkSoft};
  }
}
#${ROOT_ID} { display: none; }
`

export function printFrames(all: Item[]): number {
  const frames = sortedFrames(all)
  if (!frames.length) return 0

  document.getElementById(STYLE_ID)?.remove()
  document.getElementById(ROOT_ID)?.remove()

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = PRINT_CSS
  document.head.append(style)

  const root = document.createElement('div')
  root.id = ROOT_ID

  for (const frame of frames) {
    const inside = all.filter((i) => i.id === frame.id || contains(frame, aabb(i)))
    const canvas = renderToCanvas(inside, 2, 0)
    if (!canvas) continue
    const figure = document.createElement('figure')
    const img = document.createElement('img')
    img.src = canvas.toDataURL('image/png')
    img.alt = frame.title
    const caption = document.createElement('figcaption')
    caption.textContent = frame.title
    figure.append(img, caption)
    root.append(figure)
  }

  document.body.append(root)
  const cleanup = () => {
    root.remove()
    style.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
  return frames.length
}
