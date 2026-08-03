import { useEffect, useState } from 'react'
import { Globe, Lock, Users } from 'lucide-react'
import {
  pageMembers, publicUrl, publish, removePageMember, setPageMember, unpublish,
} from '../board/pageAccess'
import type { PageMember, PageRole } from '../board/pageAccess'
import type { Record as Row } from '../board/records'
import { displayName, getUser } from '../board/supabase'
import { listTeam } from '../board/workspace'
import type { Teammate } from '../board/workspace'
import { t } from '../i18n'
import { Popover } from './Popover'

const ROLES: PageRole[] = ['editor', 'viewer', 'blocked']

// Two different things behind one button, because to the person clicking it they are the same
// question: who can see this. One narrows it to a list of names, the other opens it to everyone.
export function PageShare({ record }: { record: Row }) {
  const [team, setTeam] = useState<Teammate[]>([])
  const [named, setNamed] = useState<PageMember[]>([])
  const [copied, setCopied] = useState(false)
  const mine = getUser()?.id ?? ''
  const open = !!record.published_at

  useEffect(() => {
    void listTeam().then(setTeam)
    void pageMembers(record.id).then(setNamed)
  }, [record.id])

  const change = async (mate: Teammate, role: PageRole | '') => {
    if (role) await setPageMember(record.id, mate.userId, mate.email, role)
    else await removePageMember(record.id, mate.userId)
    setNamed(await pageMembers(record.id))
  }

  const copy = () => {
    void navigator.clipboard.writeText(publicUrl(record))
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const restricted = named.length > 0
  const Icon = open ? Globe : restricted ? Lock : Users

  return (
    <Popover
      width={280}
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold hover:bg-shade
            ${open || restricted ? 'text-pigment' : 'text-muted hover:text-ink'}`}
        >
          <Icon size={13} /> {t('Share')}
        </button>
      )}
    >
      {() => (
        <>
          <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            {t('On the web')}
          </p>
          <button
            type="button"
            onClick={() => void (open ? unpublish(record) : publish(record))}
            className="w-full rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-shade"
          >
            {open ? t('Stop publishing') : t('Publish to the web')}
          </button>
          {open && (
            <button
              type="button"
              onClick={copy}
              className="w-full truncate rounded-md px-2 py-1 text-left text-[11px] text-muted hover:bg-shade hover:text-pigment"
            >
              {copied ? t('Copied') : publicUrl(record)}
            </button>
          )}

          <p className="mt-2 px-1 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
            {t('In the workspace')}
          </p>
          <p className="mb-1 px-1 text-[11px] leading-snug text-muted">
            {restricted
              ? t('Only the people named here, and whatever is inside this page.')
              : t('Everybody in the workspace. Name somebody to narrow it to a list.')}
          </p>

          {team.filter((mate) => mate.userId !== mine).map((mate) => {
            const held = named.find((m) => m.userId === mate.userId)
            return (
              <div key={mate.userId} className="flex items-center gap-1 rounded-md px-1 hover:bg-shade">
                <span className="min-w-0 flex-1 truncate py-1 text-[12px] text-ink">
                  {displayName(mate.email) || mate.email}
                </span>
                <select
                  value={held?.role ?? ''}
                  onChange={(e) => void change(mate, e.target.value as PageRole | '')}
                  className="shrink-0 rounded border border-hairline bg-surface px-1 py-0.5 text-[11px] outline-none"
                >
                  <option value="">{t('Not named')}</option>
                  {ROLES.map((role) => <option key={role} value={role}>{t(role)}</option>)}
                </select>
              </div>
            )
          })}

          {team.length < 2 && (
            <p className="px-1 py-1 text-[11px] text-muted">
              {t('Nobody else is in this workspace yet.')}
            </p>
          )}
        </>
      )}
    </Popover>
  )
}
