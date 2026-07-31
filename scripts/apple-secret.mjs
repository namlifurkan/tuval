#!/usr/bin/env node
// Builds the client secret Supabase asks for under the Apple provider.
//
//   node scripts/apple-secret.mjs <team-id> <key-id> <services-id> AuthKey_XXXX.p8
//
// Apple does not hand out a secret; it is a JWT you sign yourself with the .p8 key, and it
// expires. Apple caps it at six months, so this has to be run again before then. Nothing here
// leaves the machine: the key is read, signed with and forgotten.

import { createSign } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const [team, keyId, services, keyPath] = process.argv.slice(2)

if (!team || !keyId || !services || !keyPath) {
  console.error('usage: node scripts/apple-secret.mjs <team-id> <key-id> <services-id> <AuthKey.p8>')
  process.exit(1)
}

const b64 = (input) => Buffer.from(input)
  .toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const now = Math.floor(Date.now() / 1000)
const SIX_MONTHS = 60 * 60 * 24 * 180

const header = { alg: 'ES256', kid: keyId }
const claims = {
  iss: team,
  iat: now,
  exp: now + SIX_MONTHS,
  aud: 'https://appleid.apple.com',
  sub: services,
}

const body = `${b64(JSON.stringify(header))}.${b64(JSON.stringify(claims))}`
const key = await readFile(keyPath, 'utf8')

// ES256 wants the raw r||s pair, not the DER sequence Node signs with by default.
const signature = createSign('SHA256')
  .update(body)
  .sign({ key, dsaEncoding: 'ieee-p1363' })

process.stdout.write(`${body}.${b64(signature)}\n`)
process.stderr.write(`\nExpires ${new Date((now + SIX_MONTHS) * 1000).toISOString().slice(0, 10)}. Run this again before then.\n`)
