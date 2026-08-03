// Getting a page out of here. Markdown and HTML come from the editor itself; PDF pulls a
// renderer heavier than the editor, so it is fetched only when somebody asks for one.
import { FONT } from './brand'

type Editor = {
  blocksToMarkdownLossy: (blocks?: unknown[]) => Promise<string>
  blocksToHTMLLossy: (blocks?: unknown[]) => Promise<string>
  document: unknown[]
  schema: unknown
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  // Revoked on a later turn rather than at once: the browser has not necessarily started
  // reading the blob by the time the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const safe = (title: string) => (title.trim() || 'page').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80)

export async function exportMarkdown(editor: Editor, title: string) {
  const body = await editor.blocksToMarkdownLossy()
  download(`${safe(title)}.md`, new Blob([`# ${title}\n\n${body}`], { type: 'text/markdown' }))
}

// A whole document rather than a fragment: a file you can open is worth more than one you have
// to paste into something else first. Styled with our own tokens so it still looks like a page.
export async function exportHTML(editor: Editor, title: string) {
  const body = await editor.blocksToHTMLLossy()
  const page = `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body { max-width: 46rem; margin: 3rem auto; padding: 0 1.5rem; background: #F2EFE9; color: #141310;
         font: 16px/1.7 ${FONT.stack} }
  h1, h2, h3 { line-height: 1.2; letter-spacing: -0.015em }
  blockquote { border-left: 2px solid #B43E28; margin: 0; padding-left: 1rem; color: #4A463E }
  code { background: #EBE7DE; padding: .1em .3em; border-radius: 3px }
  img { max-width: 100% }
  table { border-collapse: collapse } td, th { border: 1px solid #E2DED5; padding: .4rem .6rem }
</style></head><body><h1>${title}</h1>${body}</body></html>`
  download(`${safe(title)}.html`, new Blob([page], { type: 'text/html' }))
}

export async function exportPDF(editor: Editor, title: string) {
  const [{ PDFExporter, pdfDefaultSchemaMappings }, { pdf }] = await Promise.all([
    import('@blocknote/xl-pdf-exporter'),
    import('@react-pdf/renderer'),
  ])
  const exporter = new PDFExporter(editor.schema as never, pdfDefaultSchemaMappings as never)
  const made = await exporter.toReactPDFDocument(editor.document as never)
  download(`${safe(title)}.pdf`, await pdf(made).toBlob())
}
