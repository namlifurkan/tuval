import { supabase } from './supabase'
import { getWorkspace } from './workspace'

// The code is AGPL and stays that way: anybody may run this themselves, for nothing, with
// everything on. What is priced here is somebody else running it — the disks, the bandwidth and
// the answering — so what is limited is what actually costs money to serve.
//
// The numbers live here and are enforced in the database. A limit checked only in the browser of
// an open-source product is a limit somebody deletes in an afternoon.

export type Plan = 'free' | 'team' | 'unlimited'

// Not a tier anybody buys: it is what a workspace this install is not billing answers, whether
// that is because somebody runs Tuval themselves or because the operator carries their domain.
export const UNCAPPED = 2147483647

// No price is published while there is nothing here to take money with. When there is, it comes
// back with the date it took effect beside it.

export interface Usage {
  plan: Plan
  until: string | null
  seats: number
  seat_limit: number
  bytes: number
  byte_limit: number
  api: boolean
  records: number
}

let usage: Usage | null = null
const listeners = new Set<() => void>()

export const getUsage = () => usage
export const subscribePlan = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export async function loadUsage() {
  const ws = getWorkspace()
  if (!supabase || !ws) return
  const { data } = await supabase.rpc('workspace_usage', { ws: ws.id })
  usage = (data as Usage) ?? null
  listeners.forEach((fn) => fn())
}

export const readableBytes = (bytes: number) => {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// What a plan is for, said plainly. Everything not on this list is on every plan, including the
// self-hosted one, because holding a feature back to make a plan look thin is not what this is.
export const WHAT_YOU_GET: { [K in Exclude<Plan, 'unlimited'>]: string[] } = {
  free: [
    'Up to {seats} people',
    '{bytes} of files',
    'Every board, page, database and issue',
    'Publishing and forms',
  ],
  team: [
    'Up to {seats} people',
    '{bytes} of files for each of them',
    'The API and webhooks, so n8n and the rest can reach it',
    'Everything on the free plan',
  ],
}

// A number that says how close to a wall somebody is, which is the only thing a bar is for.
export const uncapped = (limit: number) => limit >= UNCAPPED

// A number that says how close to a wall somebody is, which is the only thing a bar is for. With
// no wall there is nothing to be close to, so it reads empty rather than reading zero of nothing.
export const share = (used: number, limit: number) =>
  limit > 0 && !uncapped(limit) ? Math.min(100, Math.round((used / limit) * 100)) : 0

export const nearlyFull = (used: number, limit: number) => share(used, limit) >= 80
