import { useRef, useState, useSyncExternalStore } from 'react'
import { Download, Upload } from 'lucide-react'
import { downloadBackup, exportWorkspace, importWorkspace, readBackup } from '../board/backup'
import { loadPages, loadRecords } from '../board/records'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'

// Taking it all away, and putting it all back. The second half is the point: a file you cannot
// restore proves nothing about whose the data is.
export function BackupPanel() {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const [busy, setBusy] = useState('')
  const [said, setSaid] = useState('')
  const file = useRef<HTMLInputElement>(null)

  if (!workspace) return null

  const take = () => {
    setBusy('out')
    setSaid('')
    void exportWorkspace()
      .then((backup) => {
        downloadBackup(backup, workspace.name)
        setSaid(t('{n} records written to the file.', { n: backup.records.length }))
      })
      .catch((e: Error) => setSaid(e.message))
      .finally(() => setBusy(''))
  }

  const put = (chosen: File) => {
    setBusy('in')
    setSaid('')
    void chosen.text()
      .then((text) => importWorkspace(readBackup(text)))
      .then(({ records }) => {
        setSaid(t('{n} records put back.', { n: records }))
        return Promise.all([loadPages(), loadRecords('issue'), loadRecords('project')])
      })
      .catch((e: Error) => setSaid(e.message))
      .finally(() => setBusy(''))
  }

  const button = 'flex items-center gap-1.5 rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-3 py-2 text-sm font-semibold text-[#141310] transition-colors hover:border-[#C8452D] hover:text-[#C8452D] disabled:opacity-40'

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!!busy} onClick={take} className={button}>
          <Download size={14} /> {busy === 'out' ? t('Working…') : t('Download everything')}
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => file.current?.click()}
          className={button}
        >
          <Upload size={14} /> {busy === 'in' ? t('Working…') : t('Restore from a file')}
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const chosen = e.target.files?.[0]
            e.target.value = ''
            if (chosen) put(chosen)
          }}
        />
      </div>

      {said && <p className="mt-2 text-[12px] text-[#4A463E]">{said}</p>}

      <p className="mt-3 max-w-[62ch] text-[12px] leading-relaxed text-[#8A867C]">
        {t('Restoring writes over anything with the same id, which is what makes it a restore rather than a second copy. Uploaded files are not in the file — they live in storage and can run to gigabytes.')}
      </p>
    </div>
  )
}
