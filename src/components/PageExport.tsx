import { useState } from 'react'
import { Download } from 'lucide-react'
import { exportHTML, exportMarkdown, exportPDF } from '../board/pageExport'
import { t } from '../i18n'
import { Popover } from './Popover'

type Editor = Parameters<typeof exportMarkdown>[0]

// Three ways out, because a page you cannot take with you is a page held hostage. Markdown for
// another tool, HTML for a browser, PDF for whoever wanted it printed.
export function PageExport({ editor, title }: { editor: Editor; title: string }) {
  const [busy, setBusy] = useState('')

  const run = (kind: string, work: () => Promise<void>, close: () => void) => {
    setBusy(kind)
    void work().catch(() => undefined).then(() => { setBusy(''); close() })
  }

  const item = 'w-full rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-shade disabled:opacity-40'

  return (
    <Popover
      width={180}
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          title={t('Export')}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold text-muted hover:bg-shade hover:text-ink"
        >
          <Download size={13} /> {t('Export')}
        </button>
      )}
    >
      {(close) => (
        <>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => run('md', () => exportMarkdown(editor, title), close)}
            className={item}
          >{busy === 'md' ? t('Exporting…') : t('Markdown')}</button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => run('html', () => exportHTML(editor, title), close)}
            className={item}
          >{busy === 'html' ? t('Exporting…') : t('HTML')}</button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => run('pdf', () => exportPDF(editor, title), close)}
            className={item}
          >{busy === 'pdf' ? t('Exporting…') : t('PDF')}</button>
        </>
      )}
    </Popover>
  )
}
