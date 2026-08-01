// The card a link turns into ---------------------------------------------------------------------
// A page of somebody's own is worth having only if the link to it is worth posting, and a link
// posted anywhere is a card: a title, a line, a picture. The crawler that builds that card does
// not run JavaScript, so a single-page app is a blank card however good the page behind it is.
//
// So three addresses are answered here rather than by the static file alone — a profile, a
// published page, an opened board — with the same index.html and the tags filled in. Everything
// else is served untouched, and if this cannot reach the database it serves the file unchanged
// rather than failing: a missing card is a worse card, not a broken site.

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

const SITE = 'Tuval'
const PICTURE = '/brand/tuval-wordmark.png'

// Written by scripts/worker-env.mjs before the bundle is made, from the same variables the
// browser build reads. Absent in a checkout that has never been built.
let db: { url: string; key: string } | null = null
try {
  // @ts-expect-error generated beside this file at build time
  const held = await import('./env.generated')
  db = held.SUPABASE?.url ? held.SUPABASE : null
} catch { db = null }

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function ask(path: string, query: string): Promise<Record<string, unknown> | null> {
  if (!db) return null
  const answer = await fetch(`${db.url}/rest/v1/${path}?${query}`, {
    headers: { apikey: db.key, authorization: `Bearer ${db.key}`, accept: 'application/json' },
  })
  if (!answer.ok) return null
  const rows = (await answer.json()) as Record<string, unknown>[]
  return rows[0] ?? null
}

interface Card { title: string; note: string; picture: string }

async function cardFor(url: URL): Promise<Card | null> {
  const [, kind, rest] = url.pathname.split('/')
  const name = decodeURIComponent(rest ?? '')
  if (!name) return null

  if (kind === 'u') {
    const who = await ask('profiles', `handle=eq.${encodeURIComponent(name)}&select=handle,name,bio,avatar`)
    if (!who) return null
    return {
      title: `${(who.name as string) || `@${who.handle as string}`} · ${SITE}`,
      note: (who.bio as string) || `What @${who.handle as string} has opened to the world.`,
      picture: (who.avatar as string) || PICTURE,
    }
  }

  if (kind === 'p') {
    const page = await ask('records', `public_slug=eq.${encodeURIComponent(name)}&published_at=not.is.null&select=title,icon`)
    if (!page) return null
    return {
      title: `${(page.title as string) || 'Untitled page'} · ${SITE}`,
      note: 'A page published with Tuval.',
      picture: PICTURE,
    }
  }

  if (kind === 'b') {
    const board = await ask('boards', `id=eq.${encodeURIComponent(name)}&public_at=not.is.null&deleted_at=is.null&select=name`)
    if (!board) return null
    // The preview the board list already draws, if there is one: a card showing the actual work
    // is the difference between a link somebody clicks and a link somebody scrolls past.
    const shot = await ask('board_snapshots', `board_id=eq.${encodeURIComponent(name)}&select=thumb&order=updated_at.desc&limit=1`)
    return {
      title: `${(board.name as string) || 'Untitled board'} · ${SITE}`,
      note: 'An infinite canvas, open to read. The brief behind it can be copied off the page.',
      picture: (shot?.thumb as string)?.startsWith('data:') ? `/og/b/${encodeURIComponent(name)}` : PICTURE,
    }
  }

  return null
}

// The thumbnail is kept as a data URL, which is fine for a list on a page and useless as an
// og:image — a crawler wants an address it can fetch. This is that address.
const PICTURES = ['image/webp', 'image/png', 'image/jpeg'] as const

async function preview(name: string): Promise<Response | null> {
  const board = await ask('boards', `id=eq.${encodeURIComponent(name)}&public_at=not.is.null&deleted_at=is.null&select=id`)
  if (!board) return null
  const shot = await ask('board_snapshots', `board_id=eq.${encodeURIComponent(name)}&select=thumb&order=updated_at.desc&limit=1`)
  const held = shot?.thumb as string | undefined
  const at = held?.indexOf(',') ?? -1
  if (!held || at < 0) return null

  // The type comes off a list we wrote, never off the column. `thumb` is free text written by
  // whoever can edit the board, so echoing its own mime back served attacker HTML from our own
  // origin, with the session in localStorage next to it.
  const type = PICTURES.find((allowed) => held.startsWith(`data:${allowed};base64,`))
  if (!type) return null

  let bytes: Uint8Array
  try {
    const raw = atob(held.slice(at + 1))
    bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  } catch {
    return null
  }

  return new Response(bytes, {
    headers: {
      'content-type': type,
      'content-security-policy': "default-src 'none'; sandbox",
      'x-content-type-options': 'nosniff',
      'cache-control': 'public, max-age=300',
    },
  })
}

const tags = (card: Card, url: string) => [
  `<meta property="og:type" content="website" />`,
  `<meta property="og:site_name" content="${SITE}" />`,
  `<meta property="og:url" content="${escape(url)}" />`,
  `<meta property="og:title" content="${escape(card.title)}" />`,
  `<meta property="og:description" content="${escape(card.note)}" />`,
  `<meta property="og:image" content="${escape(new URL(card.picture, url).href)}" />`,
  `<meta name="twitter:card" content="summary_large_image" />`,
  `<meta name="twitter:title" content="${escape(card.title)}" />`,
  `<meta name="twitter:description" content="${escape(card.note)}" />`,
  `<meta name="twitter:image" content="${escape(new URL(card.picture, url).href)}" />`,
].join('')

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const [, kind, second, third] = url.pathname.split('/')

    if (kind === 'og' && second === 'b' && third) {
      const shot = await preview(decodeURIComponent(third)).catch(() => null)
      if (shot) return shot
      return Response.redirect(new URL(PICTURE, url).href, 302)
    }

    if (!['u', 'p', 'b'].includes(kind) || request.method !== 'GET') {
      return env.ASSETS.fetch(request)
    }

    const shell = await env.ASSETS.fetch(new Request(new URL('/', url), request))
    const card = await cardFor(url).catch(() => null)
    if (!card) return env.ASSETS.fetch(request)

    const html = (await shell.text())
      .replace('<title>Tuval</title>', `<title>${escape(card.title)}</title>${tags(card, url.href)}`)

    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, s-maxage=300',
      },
    })
  },
}
