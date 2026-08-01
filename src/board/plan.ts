import { supabase } from './supabase'
import { getWorkspace } from './workspace'

// The code is AGPL and stays that way: anybody may run this themselves, for nothing, with
// everything on. What is priced here is somebody else running it — the disks, the bandwidth and
// the answering — so what is limited is what actually costs money to serve.
//
// The numbers live here and are enforced in the database. A limit checked only in the browser of
// an open-source product is a limit somebody deletes in an afternoon.

export type Plan = 'free' | 'team'

// One place to change the price. It is a starting point, not a market study.
//
// Billed in lira, which is the only currency a Turkish entity can actually take money in. On an
// English page that number means nothing to a reader in London, so an approximation travels with
// it: shown as "about", never as a second price, and updated when the rate moves enough to be a
// lie. What is charged is always the lira figure.
export const PRICE = {
  amount: 249,
  currency: '₺',
  per: 'member',
  period: 'month',
  about: '$7',
  // Turkish consumer law requires the price a buyer is shown to be the price they pay, tax
  // included. Saying so is not decoration: a figure with the tax left off is the shape of a
  // complaint.
  taxIncluded: true,
}

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
export const WHAT_YOU_GET: { [K in Plan]: string[] } = {
  free: [
    'Up to {seats} people',
    '{bytes} of files',
    'Every board, page, database and issue',
    'Publishing, forms and booking links',
  ],
  team: [
    'As many people as you like',
    '{bytes} of files for each of them',
    'The API and webhooks, so n8n and the rest can reach it',
    'Everything on the free plan',
  ],
}

// A number that says how close to a wall somebody is, which is the only thing a bar is for.
export const share = (used: number, limit: number) =>
  limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0

export const nearlyFull = (used: number, limit: number) => share(used, limit) >= 80
