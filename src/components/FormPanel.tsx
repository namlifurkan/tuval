import { useEffect, useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { TITLE } from '../board/database'
import type { Field } from '../board/database'
import { askable, formFor, formUrl, makeForm, removeForm, setForm } from '../board/forms'
import type { Form } from '../board/forms'
import type { Record as Row } from '../board/records'
import { t } from '../i18n'
import { Popover } from './Popover'

const field = 'mb-1 w-full rounded-md border border-[#E2DED5] bg-[#F2EFE9] px-2 py-1 text-[13px] outline-none focus:border-[#C8452D]'

// The form for a database, set up beside it. There is one per database, because "the form for
// this" is how anybody talks about it, and a list of three would need naming and choosing.
export function FormPanel({ db, fields }: { db: Row; fields: Field[] }) {
  const [form, setHeld] = useState<Form | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { void formFor(db.id).then(setHeld) }, [db.id])

  const change = (changes: Partial<Form>) => {
    if (!form) return
    setHeld({ ...form, ...changes })
    void setForm(form.id, changes)
  }

  const ask = (id: string) => {
    if (!form) return
    change({ asks: form.asks.includes(id) ? form.asks.filter((a) => a !== id) : [...form.asks, id] })
  }

  const can = askable(fields)

  return (
    <Popover
      width={280}
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold hover:bg-[#EAE6DD]
            ${form?.active ? 'text-[#C8452D]' : 'text-[#8A867C] hover:text-[#141310]'}`}
        >
          <ClipboardList size={13} /> {t('Form')}
        </button>
      )}
    >
      {() => (!form ? (
        <>
          <p className="mb-1.5 px-1 text-[11px] leading-snug text-[#8A867C]">
            {t('A form asks for some of these columns and turns an answer into a row here.')}
          </p>
          <button
            type="button"
            onClick={() => void makeForm(db.id, db.title || t('Untitled database')).then(setHeld)}
            className="w-full rounded-md bg-[#C8452D] px-2 py-1.5 text-[12px] font-semibold text-white hover:bg-[#A83621]"
          >{t('Make a form')}</button>
        </>
      ) : (
        <>
          <input
            value={form.title}
            onChange={(e) => change({ title: e.target.value })}
            placeholder={t('Title')}
            className={field}
          />
          <textarea
            value={form.intro}
            onChange={(e) => change({ intro: e.target.value })}
            placeholder={t('A line above the questions')}
            rows={2}
            className={`${field} resize-none`}
          />
          <textarea
            value={form.thanks}
            onChange={(e) => change({ thanks: e.target.value })}
            placeholder={t('What to say afterwards')}
            rows={2}
            className={`${field} resize-none`}
          />

          <p className="mb-1 mt-2 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A867C]">
            {t('Asks for')}
          </p>
          {[{ id: TITLE, name: t('Name'), type: 'text' } as Field, ...can].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => ask(f.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] hover:bg-[#EAE6DD]"
            >
              <span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border text-[9px]
                ${form.asks.includes(f.id) ? 'border-[#C8452D] bg-[#C8452D] text-white' : 'border-[#D8D5CD]'}`}
              >{form.asks.includes(f.id) ? '✓' : ''}</span>
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-[10px] text-[#B6B1A6]">{t(f.type)}</span>
            </button>
          ))}

          <div className="mt-2 border-t border-[#EAE6DD] pt-2">
            <button
              type="button"
              onClick={() => change({ active: !form.active })}
              className="w-full rounded-md px-2 py-1 text-left text-[12px] hover:bg-[#EAE6DD]"
            >{form.active ? t('Close the form') : t('Open the form')}</button>
            {form.active && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(formUrl(form))
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1600)
                }}
                className="w-full truncate rounded-md px-2 py-1 text-left text-[11px] text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#C8452D]"
              >{copied ? t('Copied') : formUrl(form)}</button>
            )}
            <button
              type="button"
              onClick={() => void removeForm(form.id).then(() => setHeld(null))}
              className="w-full rounded-md px-2 py-1 text-left text-[12px] text-[#8A867C] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
            >{t('Delete the form')}</button>
          </div>
        </>
      ))}
    </Popover>
  )
}
