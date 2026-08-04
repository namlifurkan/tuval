import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { importNotion } from '../board/notion'
import type { Haul } from '../board/notion'
import { t } from '../i18n'

// Notion hands you a zip; a spreadsheet hands you one CSV. Both arrive here, and so does a
// folder of Markdown that never went near Notion.
export function ImportButton({ parent = null }: { parent?: string | null }) {
  const picker = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [haul, setHaul] = useState<Haul | null>(null)
  const [failed, setFailed] = useState('')

  const take = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setFailed('')
    setHaul(null)
    try {
      setHaul(await importNotion([...files], parent))
    } catch (e) {
      // A refusal we wrote says why it refused, and that sentence is the useful one. Anything
      // else is a parser giving up, and the person only needs to know which files are accepted.
      const said = e instanceof Error ? e.message : ''
      setFailed(said && !/^\w+Error/.test(said)
        ? said
        : t('That file could not be read. A Notion export, a .zip, a .csv, an .xlsx or a .md file.'))
    }
    setBusy(false)
    if (picker.current) picker.current.value = ''
  }

  return (
    <>
      <input
        ref={picker}
        type="file"
        multiple
        accept=".zip,.csv,.xlsx,.md,.markdown,text/csv,text/markdown,application/zip,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => void take(e.target.files)}
        className="hidden"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => picker.current?.click()}
        className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:border-pigment hover:text-pigment disabled:opacity-40"
      >
        <Upload size={15} /> {busy ? t('Reading…') : t('Import')}
      </button>

      {!!haul && (
        <span className={`text-[12px] ${haul.lost > 0 ? 'text-pigment-deep' : 'text-muted'}`}>
          {t('{pages} pages, {databases} databases, {rows} rows.',
            { pages: haul.pages, databases: haul.databases, rows: haul.rows })}
          {haul.skipped > 0 && ` ${t('{n} files were left out of this pass.', { n: haul.skipped })}`}
          {haul.lost > 0 && ` ${t('{n} of them could not be written and are not here.', { n: haul.lost })}`}
        </span>
      )}
      {!!failed && <span className="text-[12px] text-pigment-deep">{failed}</span>}
    </>
  )
}
