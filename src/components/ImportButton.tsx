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
    } catch {
      setFailed(t('That file could not be read. A Notion export, a .zip, a .csv or a .md file.'))
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
        accept=".zip,.csv,.md,.markdown,text/csv,text/markdown,application/zip"
        onChange={(e) => void take(e.target.files)}
        className="hidden"
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => picker.current?.click()}
        className="flex items-center gap-1.5 rounded-lg border border-[#E2DED5] px-3 py-2 text-sm font-semibold text-[#4A463E] transition-colors hover:border-[#C8452D] hover:text-[#C8452D] disabled:opacity-40"
      >
        <Upload size={15} /> {busy ? t('Reading…') : t('Import')}
      </button>

      {!!haul && (
        <span className="text-[12px] text-[#8A867C]">
          {t('{pages} pages, {databases} databases, {rows} rows.',
            { pages: haul.pages, databases: haul.databases, rows: haul.rows })}
          {haul.skipped > 0 && ` ${t('{n} files were left out of this pass.', { n: haul.skipped })}`}
        </span>
      )}
      {!!failed && <span className="text-[12px] text-[#A83621]">{failed}</span>}
    </>
  )
}
