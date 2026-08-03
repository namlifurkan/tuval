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
        setSaid(t('{n} records and {b} boards written to the file.', {
          n: backup.records.length, b: backup.boards.length,
        }))
      })
      .catch((e: Error) => setSaid(e.message))
      .finally(() => setBusy(''))
  }

  const put = (chosen: File) => {
    setBusy('in')
    setSaid('')
    void chosen.text()
      .then((text) => importWorkspace(readBackup(text)))
      .then(({ records, boards, strangers, refused }) => {
        // Everything that did not survive the trip, on the screen, in the same breath as the
        // good news. A restore that quietly drops a third of itself is worse than one that fails.
        setSaid([
          t('{n} records and {b} boards put back.', { n: records, b: boards }),
          strangers
            ? t('{n} fields naming people with no account here were left empty.', { n: strangers })
            : '',
          refused
            ? t('{n} rows would not go back and were skipped. The file still has them.', { n: refused })
            : '',
        ].filter(Boolean).join(' '))
        return Promise.all([loadPages(), loadRecords('issue'), loadRecords('project')])
      })
      .catch((e: Error) => setSaid(e.message))
      .finally(() => setBusy(''))
  }

  const button = 'flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-pigment hover:text-pigment disabled:opacity-40'

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

      {said && <p className="mt-2 text-[12px] text-ink-soft">{said}</p>}

      <p className="mt-3 max-w-[62ch] text-[12px] leading-relaxed text-muted">
        {t('Restoring writes over anything with the same id, which is what makes it a restore rather than a second copy. Uploaded files are not in the file — they live in storage and can run to gigabytes.')}
      </p>
    </div>
  )
}
