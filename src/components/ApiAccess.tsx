import { useEffect, useState } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import {
  addHook, apiBase, expired, forgetKey, listHooks, listKeys, makeKey, removeHook, revokeKey,
  setHook, writesToday,
} from '../board/api'
import type { Hook, Key, Scope } from '../board/api'
import { t } from '../i18n'

const field = 'rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-pigment'

// A key that never runs out is the one still working in somebody's old script two years from now,
// so the offer starts short and having no end at all is the last choice rather than the first.
const LIVES = [30, 90, 365, 0]

function Copyable({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={() => { void navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600) }}
      className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-ink-soft hover:bg-shade hover:text-pigment"
    >
      <Copy size={11} className="shrink-0" />
      <span className="min-w-0 truncate">{done ? t('Copied') : label}</span>
    </button>
  )
}

// Keys and hooks, on one screen, because they are two halves of the same question: what may
// reach this workspace from outside, and what does it hear about.
export function ApiAccess() {
  const [keys, setKeys] = useState<Key[]>([])
  const [hooks, setHooks] = useState<Hook[]>([])
  const [name, setName] = useState('')
  const [scope, setScope] = useState<Scope>('read')
  const [days, setDays] = useState(90)
  const [url, setUrl] = useState('')
  const [fresh, setFresh] = useState('')
  const [failed, setFailed] = useState('')

  const reload = () => {
    void listKeys().then(setKeys)
    void listHooks().then(setHooks)
  }

  useEffect(reload, [])

  const create = async () => {
    const token = await makeKey(name || t('Untitled'), scope, days)
    setName('')
    // Shown once and never again: what is stored is a hash, so there is nothing to show later.
    if (token) setFresh(token)
    reload()
  }

  const attach = async () => {
    const problem = await addHook(url)
    setFailed(problem ? t('That has to be an https address.') : '')
    if (!problem) setUrl('')
    reload()
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 max-w-[62ch] text-[12px] leading-relaxed text-muted">
          {t('A key lets something outside read and write this workspace. Send it as a bearer token to {url}', { url: apiBase() })}
        </p>
        <p className="mb-2 max-w-[62ch] text-[12px] leading-relaxed text-muted">
          {t('It opens the pages you can open and no others, so a page with people named on it stays shut.')}
        </p>
        <p className="mb-2 max-w-[62ch] text-[12px] leading-relaxed text-muted">
          {t('Every change it makes is signed with its name, kept as a version you can go back to, and counted against what it may write in a day.')}
        </p>

        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void create() }}
            placeholder={t('What is it for?')}
            className={`min-w-[10rem] flex-1 ${field}`}
          />
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
            aria-label={t('What it may do')}
            className={field}
          >
            <option value="read">{t('Read only')}</option>
            <option value="write">{t('Read and write')}</option>
          </select>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            aria-label={t('How long it lasts')}
            className={field}
          >
            {LIVES.map((life) => (
              <option key={life} value={life}>
                {life ? t('{n} days', { n: life }) : t('Never expires')}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void create()}
            className="rounded-lg bg-pigment px-3 py-1.5 text-sm font-semibold text-on-pigment hover:bg-pigment-deep"
          >{t('New key')}</button>
        </div>

        {!!fresh && (
          <div className="mt-2 rounded-lg border border-pigment bg-pigment-wash p-2.5">
            <p className="text-[12px] font-semibold text-pigment">
              {t('Copy it now — it is not shown again.')}
            </p>
            <Copyable text={fresh} label={fresh} />
          </div>
        )}

        <div className="mt-2 divide-y divide-shade rounded-xl border border-hairline bg-surface">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center gap-2 px-3 py-2">
              <span className={`min-w-0 flex-1 truncate text-[13px]
                ${key.revoked_at || expired(key) ? 'text-faint line-through' : 'text-ink'}`}
              >
                {key.name || t('Untitled')}
                <span className="ml-2 font-mono text-[11px] text-faint">{key.hint}</span>
              </span>
              <span className="shrink-0 rounded-md bg-shade px-1.5 py-0.5 text-[11px] text-ink-soft">
                {key.scope === 'write' ? t('read and write') : t('read only')}
              </span>
              {key.scope === 'write' && (
                <span className={`shrink-0 text-[11px] ${writesToday(key) >= key.daily_writes ? 'text-pigment-deep' : 'text-faint'}`}>
                  {t('{used} of {cap} writes today', { used: writesToday(key), cap: key.daily_writes })}
                </span>
              )}
              <span className="shrink-0 text-[11px] text-faint">
                {expired(key) ? t('expired')
                  : key.expires_at ? t('until {date}', { date: new Date(key.expires_at).toLocaleDateString() })
                  : key.last_used_at ? t('used') : t('never used')}
              </span>
              {!key.revoked_at && (
                <button
                  type="button"
                  onClick={() => void revokeKey(key.id).then(reload)}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-muted hover:text-pigment-deep"
                >{t('Revoke')}</button>
              )}
              <button
                type="button"
                aria-label={t('Delete')}
                onClick={() => void forgetKey(key.id).then(reload)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-pigment-wash hover:text-pigment-deep"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {!keys.length && (
            <p className="px-3 py-2.5 text-[12px] text-muted">{t('No keys yet.')}</p>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 max-w-[62ch] text-[12px] leading-relaxed text-muted">
          {t('A webhook is told when a record changes, so an integration does not have to keep asking. Every call carries an X-Tuval-Signature of the body.')}
        </p>

        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void attach() }}
            placeholder="https://n8n.example.com/webhook/tuval"
            className={`flex-1 ${field}`}
          />
          <button
            type="button"
            onClick={() => void attach()}
            className="rounded-lg border border-hairline px-3 py-1.5 text-sm font-semibold text-ink-soft hover:border-pigment hover:text-pigment"
          >{t('Add')}</button>
        </div>
        {!!failed && <p className="mt-1 text-[12px] text-pigment-deep">{failed}</p>}

        <div className="mt-2 divide-y divide-shade rounded-xl border border-hairline bg-surface">
          {hooks.map((hook) => (
            <div key={hook.id} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full
                  ${hook.last_status && hook.last_status < 300 ? 'bg-ok'
                    : hook.last_status ? 'bg-pigment' : 'bg-rule'}`}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{hook.url}</span>
                <span className="shrink-0 text-[11px] text-faint">
                  {hook.last_status ?? (hook.last_fired_at ? t('sent') : t('never sent'))}
                </span>
                <button
                  type="button"
                  onClick={() => void setHook(hook.id, { active: !hook.active }).then(reload)}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-muted hover:text-ink"
                >{hook.active ? t('On') : t('Off')}</button>
                <button
                  type="button"
                  aria-label={t('Delete')}
                  onClick={() => void removeHook(hook.id).then(reload)}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-pigment-wash hover:text-pigment-deep"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <Copyable text={hook.secret} label={t('signing secret')} />
            </div>
          ))}
          {!hooks.length && (
            <p className="px-3 py-2.5 text-[12px] text-muted">{t('No webhooks yet.')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
