import { ArrowDownUp, Filter as FilterIcon, X } from 'lucide-react'
import {
  addFilter, editFilter, NO_VALUE, OP_LABEL, opsFor, removeFilter, setSort, TITLE,
} from '../board/database'
import type { Field, Filter, View } from '../board/database'
import type { Record as Row } from '../board/records'
import { t } from '../i18n'
import { Popover } from './Popover'

const pill = 'rounded-md border border-hairline bg-surface px-1.5 py-0.5 text-[11px] outline-none'

function Rule({ db, view, filter, fields }: {
  db: Row
  view: View
  filter: Filter
  fields: Field[]
}) {
  const field = fields.find((f) => f.id === filter.field) ?? null
  const ops = opsFor(field)
  const needsValue = !NO_VALUE.includes(filter.op)

  return (
    <span className="flex items-center gap-1 rounded-lg bg-tint py-0.5 pl-1 pr-0.5">
      <select
        value={filter.field}
        onChange={(e) => {
          const next = fields.find((f) => f.id === e.target.value) ?? null
          editFilter(db, view.id, filter.id, {
            field: e.target.value,
            op: opsFor(next)[0],
            value: '',
          })
        }}
        className={pill}
      >
        <option value={TITLE}>{t('Name')}</option>
        {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>

      <select
        value={filter.op}
        onChange={(e) => editFilter(db, view.id, filter.id, { op: e.target.value as Filter['op'] })}
        className={pill}
      >
        {ops.map((op) => <option key={op} value={op}>{t(OP_LABEL[op])}</option>)}
      </select>

      {needsValue && (field?.type === 'select'
        ? (
          <select
            value={filter.value ?? ''}
            onChange={(e) => editFilter(db, view.id, filter.id, { value: e.target.value })}
            className={pill}
          >
            <option value="">—</option>
            {(field.choices ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )
        : (
          <input
            type={field?.type === 'date' ? 'date' : field?.type === 'number' ? 'number' : 'text'}
            value={filter.value ?? ''}
            onChange={(e) => editFilter(db, view.id, filter.id, { value: e.target.value })}
            placeholder={t('value')}
            className={`${pill} w-[100px]`}
          />
        ))}

      <button
        type="button"
        aria-label={t('Remove filter')}
        onClick={() => removeFilter(db, view.id, filter.id)}
        className="grid h-5 w-5 place-items-center rounded text-muted hover:text-[#943321]"
      >
        <X size={11} />
      </button>
    </span>
  )
}

// Notion's filter bar is the difference between a database and a list you scroll. It sits with
// the view, not with the screen, so a view named "Mine, still open" opens that way for everyone.
export function ViewBar({ db, view, fields, hidden }: {
  db: Row
  view: View
  fields: Field[]
  hidden: number
}) {
  const sort = view.sorts?.[0]
  const named = (id: string) => (id === TITLE ? t('Name') : fields.find((f) => f.id === id)?.name ?? '')

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {(view.filters ?? []).map((filter) => (
        <Rule key={filter.id} db={db} view={view} filter={filter} fields={fields} />
      ))}

      <Popover
        width={180}
        trigger={({ toggle }) => (
          <button
            type="button"
            onClick={toggle}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-muted hover:bg-shade hover:text-ink"
          >
            <FilterIcon size={12} /> {t('Filter')}
          </button>
        )}
      >
        {(close) => (
          <>
            <button
              type="button"
              onClick={() => { addFilter(db, view.id, TITLE, 'title'); close() }}
              className="w-full rounded-md px-2 py-1 text-left text-[12px] hover:bg-shade"
            >{t('Name')}</button>
            {fields.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => { addFilter(db, view.id, f.id, f.type); close() }}
                className="w-full rounded-md px-2 py-1 text-left text-[12px] hover:bg-shade"
              >{f.name}</button>
            ))}
          </>
        )}
      </Popover>

      <Popover
        width={180}
        trigger={({ toggle }) => (
          <button
            type="button"
            onClick={toggle}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold hover:bg-shade
              ${sort ? 'text-pigment' : 'text-muted hover:text-ink'}`}
          >
            <ArrowDownUp size={12} />
            {sort ? `${named(sort.field)} ${sort.dir === 'asc' ? '↑' : '↓'}` : t('Sort')}
          </button>
        )}
      >
        {(close) => (
          <>
            {sort && (
              <button
                type="button"
                onClick={() => { setSort(db, view.id, null); close() }}
                className="w-full rounded-md px-2 py-1 text-left text-[12px] text-muted hover:bg-shade"
              >{t('No sort')}</button>
            )}
            {[{ id: TITLE, name: t('Name') }, ...fields].map((f) => (
              <span key={f.id} className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => { setSort(db, view.id, f.id, 'asc'); close() }}
                  className="min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-[12px] hover:bg-shade"
                >{f.name}</button>
                <button
                  type="button"
                  aria-label={`${f.name} ${t('descending')}`}
                  onClick={() => { setSort(db, view.id, f.id, 'desc'); close() }}
                  className="rounded-md px-1.5 py-1 text-[11px] text-muted hover:bg-shade"
                >↓</button>
              </span>
            ))}
          </>
        )}
      </Popover>

      {!!hidden && (
        <span className="text-[11px] text-[#B6B1A6]">
          {t('{n} hidden by filters', { n: hidden })}
        </span>
      )}
    </div>
  )
}
