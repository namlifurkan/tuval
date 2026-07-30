import * as Y from 'yjs'
import { ydoc } from './doc'
import { me } from './me'
import type { Id } from './types'

export interface TimerState {
  endsAt: number | null
  remaining: number
  duration: number
}

export interface VoteState {
  active: boolean
  perPerson: number
  endsAt: number | null
}

const ytimer = ydoc.getMap<unknown>('timer')
const yvotes = ydoc.getMap<Record<string, number>>('votes')
const yvoteState = ydoc.getMap<unknown>('voteState')

const listeners = new Set<() => void>()

let timerCache: TimerState = { endsAt: null, remaining: 0, duration: 300 }
let voteCache: VoteState = { active: false, perPerson: 3, endsAt: null }
let voteMap: Map<Id, number> = new Map()

function rebuild() {
  timerCache = {
    endsAt: (ytimer.get('endsAt') as number | undefined) ?? null,
    remaining: (ytimer.get('remaining') as number | undefined) ?? 0,
    duration: (ytimer.get('duration') as number | undefined) ?? 300,
  }
  voteCache = {
    active: (yvoteState.get('active') as boolean | undefined) ?? false,
    perPerson: (yvoteState.get('perPerson') as number | undefined) ?? 3,
    endsAt: (yvoteState.get('endsAt') as number | undefined) ?? null,
  }
  const next = new Map<Id, number>()
  yvotes.forEach((entry, id) => {
    next.set(id, Object.values(entry).reduce((a, b) => a + b, 0))
  })
  voteMap = next
  listeners.forEach((l) => l())
}

ytimer.observe(rebuild)
yvotes.observeDeep(rebuild)
yvoteState.observe(rebuild)
rebuild()

export function subscribeSession(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export const getTimer = (): TimerState => timerCache

export function startTimer(seconds: number) {
  ydoc.transact(() => {
    ytimer.set('duration', seconds)
    ytimer.set('endsAt', Date.now() + seconds * 1000)
    ytimer.set('remaining', seconds)
  })
}

export function pauseTimer() {
  const { endsAt } = getTimer()
  if (!endsAt) return
  ydoc.transact(() => {
    ytimer.set('remaining', Math.max(0, Math.round((endsAt - Date.now()) / 1000)))
    ytimer.set('endsAt', null)
  })
}

export function resumeTimer() {
  const { remaining } = getTimer()
  if (remaining <= 0) return
  ytimer.set('endsAt', Date.now() + remaining * 1000)
}

export function clearTimer() {
  ydoc.transact(() => {
    ytimer.set('endsAt', null)
    ytimer.set('remaining', 0)
  })
}

export function timerSecondsLeft(): number {
  const { endsAt, remaining } = getTimer()
  if (!endsAt) return remaining
  return Math.max(0, Math.round((endsAt - Date.now()) / 1000))
}

export const getVoteState = (): VoteState => voteCache

export function startVoting(perPerson: number, seconds: number | null) {
  ydoc.transact(() => {
    yvotes.clear()
    yvoteState.set('active', true)
    yvoteState.set('perPerson', perPerson)
    yvoteState.set('endsAt', seconds ? Date.now() + seconds * 1000 : null)
  })
}

export function stopVoting() {
  yvoteState.set('active', false)
}

export function resetVotes() {
  yvotes.clear()
}

export const votesFor = (id: Id): number => voteMap.get(id) ?? 0

export function myVotesUsed(): number {
  let used = 0
  yvotes.forEach((entry) => { used += entry[me.id] ?? 0 })
  return used
}

export function castVote(id: Id, delta: number) {
  const { active, perPerson } = getVoteState()
  if (!active) return
  const entry = { ...(yvotes.get(id) ?? {}) }
  const mine = entry[me.id] ?? 0
  const next = mine + delta
  if (next < 0) return
  if (delta > 0 && myVotesUsed() >= perPerson) return
  if (next === 0) delete entry[me.id]
  else entry[me.id] = next
  if (Object.keys(entry).length) yvotes.set(id, entry)
  else yvotes.delete(id)
}

let resultsCache: [Id, number][] = []
let resultsFrom: Map<Id, number> | null = null

export function voteResults(): [Id, number][] {
  if (resultsFrom !== voteMap) {
    resultsCache = [...voteMap.entries()].sort((a, b) => b[1] - a[1])
    resultsFrom = voteMap
  }
  return resultsCache
}

export const voteSnapshot = (): Map<Id, number> => voteMap

if (import.meta.hot) {
  import.meta.hot.accept(() => import.meta.hot!.invalidate())
}

void Y
