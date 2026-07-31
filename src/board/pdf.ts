import { createItems } from './doc'
import { hostImage } from './images'
import { makeFrame, makeImage } from './items'
import { requestRender, useBoardStore } from './store'
import type { Item, Vec } from './types'

// A page is rendered at twice its own size so it stays readable when zoomed in, then handed to
// the same pipeline as any other image: capped at 1600px, re-encoded, and hosted when signed in.
const RENDER_SCALE = 2
const PAGE_W = 520
const GAP = 40
const PER_ROW = 4

// Beyond this a drop is a document, not a board. The count is reported rather than the extra
// pages being dropped quietly.
export const MAX_PAGES = 30

export const isPdf = (file: File) =>
  file.type === 'application/pdf' || /\.pdf$/i.test(file.name)

export interface PdfImport { pages: number; skipped: number }

export async function addPdf(file: File, at: Vec): Promise<PdfImport> {
  // pdf.js is large and most sessions never open a PDF, so it is fetched on the first drop.
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  const total = doc.numPages
  const take = Math.min(total, MAX_PAGES)

  const items: Item[] = []
  const name = file.name.replace(/\.pdf$/i, '')

  for (let n = 1; n <= take; n++) {
    const page = await doc.getPage(n)
    const viewport = page.getViewport({ scale: RENDER_SCALE })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    await page.render({ canvas, canvasContext: ctx, viewport }).promise

    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/webp', 0.82))
    if (!blob) continue
    const src = await hostImage(canvas.toDataURL('image/webp', 0.82), blob)

    const ratio = viewport.height / viewport.width
    const w = PAGE_W
    const h = PAGE_W * ratio
    const col = (n - 1) % PER_ROW
    const row = Math.floor((n - 1) / PER_ROW)
    const item = makeImage(at.x + col * (w + GAP), at.y + row * (h + GAP), w, h, src)
    item.naturalW = viewport.width
    item.naturalH = viewport.height
    items.push(item)
  }

  if (items.length) {
    const cols = Math.min(items.length, PER_ROW)
    const rows = Math.ceil(items.length / PER_ROW)
    const tallest = Math.max(...items.map((i) => i.h))
    const frame = makeFrame(
      at.x - GAP, at.y - GAP - 60,
      cols * (PAGE_W + GAP) + GAP, rows * (tallest + GAP) + GAP + 60,
      name,
    )
    createItems([frame, ...items])
    useBoardStore.getState().setSelection(items.map((i) => i.id))
    requestRender()
  }

  void doc.cleanup()
  return { pages: items.length, skipped: total - take }
}
