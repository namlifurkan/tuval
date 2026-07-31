import { useEffect, useState, useSyncExternalStore } from 'react'
import { AtSign, CircleDot } from 'lucide-react'
import { go } from '../board/boards'
import {
  clearInbox, getInbox, loadInbox, markAllRead, markRead, subscribeInbox,
} from '../board/notifications'
import type { Notice } from '../board/notifications'
import { getPages, getRecords, loadPages, loadRecords, subscribeRecords } from '../board/records'
import { displayName } from '../board/supabase'
import { listTeam } from '../board/workspace'
import type { Teammate } from '../board/workspace'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'
import { Shell } from './Shell'

const inbox = getInbox

function when(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return t('just now')
  if (mins < 60) return t('{n} min ago', { n: mins })
  if (mins < 1440) return t('{n} h ago', { n: Math.floor(mins / 60) })
  return t('{n} d ago', { n: Math.floor(mins / 1440) })
}

const ICON = { assigned: CircleDot, mentioned: AtSign }

export function Inbox() {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const notices = useSyncExternalStore(subscribeInbox, inbox, inbox)
  useSyncExternalStore(subscribeRecords, getPages, getPages)
  const [team, setTeam] = useState<Teammate[]>([])

  useEffect(() => {
    if (!workspace) return
    void loadInbox()
    void loadPages()
    void loadRecords('issue')
    void listTeam().then(setTeam)
  }, [workspace])

  // Whatever the notification is about, it is a record, and every kind of record has a page.
  const named = (id: string | null) => {
    if (!id) return t('Something that is no longer there')
    const held = [...getPages(), ...getRecords('issue')].find((r) => r.id === id)
    return held?.title || t('Untitled page')
  }

  const wentTo = (id: string | null) => {
    if (!id) return
    const kind = getRecords('issue').some((r) => r.id === id) ? 'i' : 'd'
    go(`/${kind}/${id}`)
  }

  const said = (notice: Notice) => {
    const who = displayName(team.find((m) => m.userId === notice.actor)?.email) || t('Somebody')
    return notice.kind === 'assigned'
      ? t('{who} gave you', { who })
      : t('{who} named you in', { who })
  }

  const unread = notices.filter((n) => !n.read_at).length

  return (
    <Shell
      title={t('Inbox')}
      action={!!notices.length && (
        <span className="flex items-center gap-1">
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="rounded-md px-2 py-1 text-[12px] font-semibold text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#141310]"
            >{t('Mark all read')}</button>
          )}
          <button
            type="button"
            onClick={() => void clearInbox()}
            className="rounded-md px-2 py-1 text-[12px] font-semibold text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#141310]"
          >{t('Clear')}</button>
        </span>
      )}
    >
      {!notices.length && (
        <p className="max-w-[62ch] text-sm leading-relaxed text-[#4A463E]">
          {t('Nothing waiting. Being given an issue or named in a page turns up here.')}
        </p>
      )}

      <div className="divide-y divide-[#EAE6DD]">
        {notices.map((notice) => {
          const Icon = ICON[notice.kind]
          return (
            <button
              key={notice.id}
              type="button"
              onClick={() => { void markRead([notice.id]); wentTo(notice.record_id) }}
              className="group flex w-full items-center gap-3 py-3 text-left"
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${notice.read_at ? '' : 'bg-[#C8452D]'}`}
              />
              <Icon size={15} className="shrink-0 text-[#8A867C]" />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm group-hover:text-[#C8452D]
                  ${notice.read_at ? 'text-[#4A463E]' : 'font-semibold text-[#141310]'}`}
                >
                  {said(notice)} {named(notice.record_id)}
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-[#B6B1A6]">{when(notice.created_at)}</span>
            </button>
          )
        })}
      </div>
    </Shell>
  )
}
