// The worker needs the same two values the browser build reads, and wrangler bundles it apart
// from Vite. Written here from the environment rather than kept in the repository: the anon key
// is meant to be public, but a key checked into an open-source project is one every fork points
// at by accident.
//
// Locally the values are in .env.local; on the host they are already in the environment.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const fromFile = (name) => {
  if (!existsSync('.env.local')) return ''
  const line = readFileSync('.env.local', 'utf8')
    .split('\n').find((l) => l.trimStart().startsWith(`${name}=`))
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : ''
}

const read = (name) => process.env[name] || fromFile(name)

const url = read('VITE_SUPABASE_URL')
const key = read('VITE_SUPABASE_ANON_KEY')

writeFileSync('worker/env.generated.ts', `export const SUPABASE = ${JSON.stringify({ url, key })}\n`)

console.log(url ? 'worker: link cards will carry real titles' : 'worker: no database, link cards stay generic')
