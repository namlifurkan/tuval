import { useEffect, useState } from 'react'
import { Copy, Trash2 } from 'lucide-react'
import {
  addHook, apiBase, forgetKey, listHooks, listKeys, makeKey, removeHook, revokeKey, setHook,
} from '../board/api'
import type { Hook, Key } from '../board/api'
import { t } from '../i18n'

const field = 'rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2.5 py-1.5 text-sm outline-none focus:border-[#C8452D]'

function Copyable({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={() => { void navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600) }}
      className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-[#4A463E] hover:bg-[#EAE6DD] hover:text-[#C8452D]"
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
  const [url, setUrl] = useState('')
  const [fresh, setFresh] = useState('')
  const [failed, setFailed] = useState('')

  const reload = () => {
    void listKeys().then(setKeys)
    void listHooks().then(setHooks)
  }

  useEffect(reload, [])

  const create = async () => {
    const token = await makeKey(name || t('Untitled'))
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
        <p className="mb-2 max-w-[62ch] text-[12px] leading-relaxed text-[#8A867C]">
          {t('A key lets something outside read and write this workspace. Send it as a bearer token to {url}', { url: apiBase() })}
        </p>

        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void create() }}
            placeholder={t('What is it for?')}
            className={`flex-1 ${field}`}
          />
          <button
            type="button"
            onClick={() => void create()}
            className="rounded-lg bg-[#C8452D] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#A83621]"
          >{t('New key')}</button>
        </div>

        {!!fresh && (
          <div className="mt-2 rounded-lg border border-[#C8452D] bg-[#F7E9E4] p-2.5">
            <p className="text-[12px] font-semibold text-[#C8452D]">
              {t('Copy it now — it is not shown again.')}
            </p>
            <Copyable text={fresh} label={fresh} />
          </div>
        )}

        <div className="mt-2 divide-y divide-[#EAE6DD] rounded-xl border border-[#E2DED5] bg-[#FCFBF8]">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center gap-2 px-3 py-2">
              <span className={`min-w-0 flex-1 truncate text-[13px]
                ${key.revoked_at ? 'text-[#B6B1A6] line-through' : 'text-[#141310]'}`}
              >
                {key.name || t('Untitled')}
                <span className="ml-2 font-mono text-[11px] text-[#B6B1A6]">{key.hint}</span>
              </span>
              <span className="shrink-0 text-[11px] text-[#B6B1A6]">
                {key.last_used_at ? t('used') : t('never used')}
              </span>
              {!key.revoked_at && (
                <button
                  type="button"
                  onClick={() => void revokeKey(key.id).then(reload)}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[#8A867C] hover:text-[#DC2626]"
                >{t('Revoke')}</button>
              )}
              <button
                type="button"
                aria-label={t('Delete')}
                onClick={() => void forgetKey(key.id).then(reload)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#8A867C] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {!keys.length && (
            <p className="px-3 py-2.5 text-[12px] text-[#8A867C]">{t('No keys yet.')}</p>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 max-w-[62ch] text-[12px] leading-relaxed text-[#8A867C]">
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
            className="rounded-lg border border-[#E2DED5] px-3 py-1.5 text-sm font-semibold text-[#4A463E] hover:border-[#C8452D] hover:text-[#C8452D]"
          >{t('Add')}</button>
        </div>
        {!!failed && <p className="mt-1 text-[12px] text-[#DC2626]">{failed}</p>}

        <div className="mt-2 divide-y divide-[#EAE6DD] rounded-xl border border-[#E2DED5] bg-[#FCFBF8]">
          {hooks.map((hook) => (
            <div key={hook.id} className="px-3 py-2">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full
                  ${hook.last_status && hook.last_status < 300 ? 'bg-[#5E9A8A]'
                    : hook.last_status ? 'bg-[#C8664A]' : 'bg-[#D6D1C6]'}`}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-[#141310]">{hook.url}</span>
                <span className="shrink-0 text-[11px] text-[#B6B1A6]">
                  {hook.last_status ?? (hook.last_fired_at ? t('sent') : t('never sent'))}
                </span>
                <button
                  type="button"
                  onClick={() => void setHook(hook.id, { active: !hook.active }).then(reload)}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[#8A867C] hover:text-[#141310]"
                >{hook.active ? t('On') : t('Off')}</button>
                <button
                  type="button"
                  aria-label={t('Delete')}
                  onClick={() => void removeHook(hook.id).then(reload)}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#8A867C] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <Copyable text={hook.secret} label={t('signing secret')} />
            </div>
          ))}
          {!hooks.length && (
            <p className="px-3 py-2.5 text-[12px] text-[#8A867C]">{t('No webhooks yet.')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
