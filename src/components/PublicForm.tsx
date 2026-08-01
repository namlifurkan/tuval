import { useEffect, useState } from 'react'
import { readRoute } from '../board/boards'
import { PRODUCT } from '../board/brand'
import { TITLE } from '../board/database'
import type { Field } from '../board/database'
import { readForm, sendForm } from '../board/forms'
import type { Form } from '../board/forms'
import { t } from '../i18n'

const box = 'w-full rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-3 py-2 text-sm outline-none focus:border-[#C8452D]'

const inputType = (field: Field) =>
  field.type === 'number' ? 'number'
    : field.type === 'date' ? 'date'
      : field.type === 'email' ? 'email'
        : field.type === 'phone' ? 'tel'
          : field.type === 'url' ? 'url' : 'text'

// Filled in by somebody with no account and probably no interest in the product. So: the
// questions, a button, and nothing else on the page to think about.
export function PublicForm() {
  const route = readRoute()
  const slug = route.kind === 'form' ? route.slug : ''
  const [held, setHeld] = useState<{ form: Form; fields: Field[] } | null>(null)
  const [ready, setReady] = useState(false)
  const [answers, setAnswers] = useState<{ [key: string]: string }>({})
  const [trap, setTrap] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    void readForm(slug).then((found) => {
      if (!live) return
      setHeld(found)
      setReady(true)
    })
    return () => { live = false }
  }, [slug])

  if (!ready) return null

  if (!held) {
    return (
      <main className="mx-auto max-w-[34rem] px-6 py-24">
        <h1 className="text-[22px] font-bold text-[#141310]">{t('Nothing here')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#4A463E]">
          {t('This form is closed, or it never existed.')}
        </p>
      </main>
    )
  }

  const { form, fields } = held
  const asked = form.asks
    .map((id) => (id === TITLE
      ? ({ id: TITLE, name: t('Name'), type: 'text' } as Field)
      : fields.find((f) => f.id === id)))
    .filter((f): f is Field => !!f)

  const send = async () => {
    setSending(true)
    setFailed(false)
    const went = await sendForm(slug, answers, trap)
    setSending(false)
    if (went) setDone(true)
    else setFailed(true)
  }

  if (done) {
    return (
      <main className="mx-auto max-w-[34rem] px-6 py-24">
        <h1 className="text-[22px] font-bold text-[#141310]">{t('Thank you')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#4A463E]">
          {form.thanks || t('That has been recorded.')}
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[34rem] px-6 pb-24 pt-16">
      <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-[#141310]">
        {form.title || t('Untitled')}
      </h1>
      {!!form.intro && (
        <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-[#4A463E]">{form.intro}</p>
      )}

      <form
        className="mt-7 space-y-4"
        onSubmit={(e) => { e.preventDefault(); void send() }}
      >
        {asked.map((field) => (
          <label key={field.id} className="block">
            <span className="mb-1 block text-[12px] font-semibold text-[#4A463E]">{field.name}</span>

            {field.type === 'select' ? (
              <select
                value={answers[field.id] ?? ''}
                onChange={(e) => setAnswers((was) => ({ ...was, [field.id]: e.target.value }))}
                className={box}
              >
                <option value="">—</option>
                {(field.choices ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : field.type === 'checkbox' ? (
              <input
                type="checkbox"
                checked={answers[field.id] === 'true'}
                onChange={(e) => setAnswers((was) => ({ ...was, [field.id]: String(e.target.checked) }))}
                className="h-4 w-4 accent-[#C8452D]"
              />
            ) : (
              <input
                type={inputType(field)}
                value={answers[field.id] ?? ''}
                onChange={(e) => setAnswers((was) => ({ ...was, [field.id]: e.target.value }))}
                className={box}
              />
            )}
          </label>
        ))}

        {/* Nobody can see this, so anything that fills it in is not a person. */}
        <input
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          value={trap}
          onChange={(e) => setTrap(e.target.value)}
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />

        <button
          type="submit"
          disabled={sending}
          className="rounded-lg bg-[#C8452D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A83621] disabled:opacity-40"
        >{sending ? t('Sending…') : t('Send')}</button>

        {failed && (
          <p className="text-[12px] text-[#DC2626]">{t('That did not go through. Try again.')}</p>
        )}
      </form>

      <p className="mt-16 border-t border-[#E2DED5] pt-4 text-[11px] text-[#B6B1A6]">
        {t('Published with {product}', { product: PRODUCT.name })}
      </p>
    </main>
  )
}
