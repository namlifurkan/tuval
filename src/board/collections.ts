import { labelsOn } from './issues'
import { createRecord, getRecords, loadRecords, patchRecord } from './records'
import type { Kind, Record as Row, Status } from './records'
import { getUser } from './supabase'

// A collection is a question, not a folder. Nothing is filed into it and nothing falls out of it
// when it changes: it is answered again every time it is looked at.
export interface Rules {
  kinds: Kind[]
  status: Status[]
  assignee: string
  labels: string[]
  title: string
  due: '' | 'overdue' | 'week'
}

export const NO_RULES: Rules = {
  kinds: [], status: [], assignee: '', labels: [], title: '', due: '',
}

// The kinds a collection can ask about. Not every kind: a collection of files or of events is a
// screen nobody has, and offering it would be offering an empty answer.
export const ASKABLE: Kind[] = ['doc', 'database', 'issue', 'project']

export const rulesOf = (row: Row): Rules => ({ ...NO_RULES, ...(row.data?.rules as Rules) })

export const listCollections = () => getRecords('collection')

export const loadCollections = () => loadRecords('collection')

export const addCollection = (title: string) => createRecord(title || 'Untitled', 'collection')

export const setRules = (id: string, rules: Rules) => patchRecord(id, { data: { rules } })

// Local midnight, not UTC: east of Greenwich the evening is already tomorrow, and a page due
// today would have been counted late since dinner.
const midnight = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

// Every candidate the workspace holds. Asked kind by kind rather than in one list, because the
// stores are kept apart and merging them on read would build a new array on every render.
export const candidates = (rules: Rules): Row[] => {
  const kinds = rules.kinds.length ? rules.kinds : ASKABLE
  return kinds.flatMap((kind) => getRecords(kind))
}

export function matches(row: Row, rules: Rules): boolean {
  if (rules.kinds.length && !rules.kinds.includes(row.kind)) return false
  if (rules.status.length && !(row.status && rules.status.includes(row.status))) return false

  if (rules.assignee) {
    const who = rules.assignee === 'me' ? getUser()?.id ?? '' : rules.assignee
    if (row.assignee !== who) return false
  }

  // Any of them rather than all of them: somebody who picks two tags is asking a wider question,
  // not a narrower one, and "tagged both" is a thing nobody has ever meant by it.
  if (rules.labels.length) {
    const worn = labelsOn(row.id)
    if (!rules.labels.some((id) => worn.includes(id))) return false
  }

  if (rules.title && !row.title.toLowerCase().includes(rules.title.trim().toLowerCase())) {
    return false
  }

  if (rules.due) {
    if (!row.due_at) return false
    const due = new Date(row.due_at).getTime()
    if (rules.due === 'overdue' && due >= midnight()) return false
    if (rules.due === 'week' && (due < midnight() || due > midnight() + 7 * 86_400_000)) return false
  }

  return true
}

// Newest first, because a saved question is nearly always "what is going on", and what is going
// on is what somebody touched last.
export const answer = (rules: Rules): Row[] =>
  candidates(rules).filter((row) => matches(row, rules))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))

// A collection with nothing set matches the whole workspace, which is a list nobody saved on
// purpose. Saying so is better than showing it.
export const isEmptyQuestion = (rules: Rules) =>
  !rules.kinds.length && !rules.status.length && !rules.assignee
  && !rules.labels.length && !rules.title.trim() && !rules.due
