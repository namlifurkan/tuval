#!/usr/bin/env node
// The anon and service keys are not passwords: they are JWTs signed with JWT_SECRET, carrying the
// Postgres role the request runs as. PostgREST, GoTrue and storage-api all verify them with the
// same secret, which is why they have to be minted rather than invented.
//
//   node deploy/keys.mjs "$(openssl rand -hex 32)"

import { createHmac, randomBytes } from 'node:crypto'

const secret = process.argv[2] || randomBytes(32).toString('hex')
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')

const sign = (role) => {
  const now = Math.floor(Date.now() / 1000)
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    role,
    iss: 'supabase',
    iat: now,
    exp: now + 60 * 60 * 24 * 365 * 10,
  })}`
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}

console.log(`JWT_SECRET=${secret}`)
console.log(`ANON_KEY=${sign('anon')}`)
console.log(`SERVICE_KEY=${sign('service_role')}`)
