// Real HTML for the pages that need to be found ---------------------------------------------------
// The app is one JavaScript bundle, which is right for a workspace and wrong for a marketing
// page: a crawler that runs no JavaScript sees an empty div, and a visitor waits for a megabyte
// before reading a sentence.
//
// So every marketing address gets a file of its own, written from the same module the React
// pages read. The words cannot drift because there is only one copy of them, and the page a
// crawler is served is the page a person is shown.
//
// Not a second Vite pass in SSR mode: today's requirement is crawlable text, headings, links and
// metadata. This meets it in full and brings no build machinery with it.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const DIST = 'dist'
const SITE = 'https://tuval.dev'

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('prerender: no dist/index.html - run the build first')
  process.exit(1)
}

// The words live in JSON so that both readers are readers: the React pages import it and this
// writes it out. Parsing the TypeScript with a regular expression was the first attempt and it
// silently found three pages out of ten, which is exactly the failure a build step must not have.
const { pages: all } = JSON.parse(readFileSync('src/site/pages.json', 'utf8'))

// The price is decided in src/site/price.json and read here and by the React pages, so a crawler
// and a visitor cannot be shown two different numbers.
const price = JSON.parse(readFileSync('src/site/price.json', 'utf8'))
const fill = (text) => String(text)
  .replace('{price}', `${price.currency}${price.amount}`)
  .replace('{per}', price.per)
  .replace('{period}', price.period)
  .replace('{about}', price.about)

const escape = (text) => fill(text)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const shell = readFileSync(join(DIST, 'index.html'), 'utf8')


for (const page of all) {
  const url = `${SITE}${page.path === '/' ? '' : page.path}`

  const head = [
    `<title>${escape(page.title)}</title>`,
    `<meta name="description" content="${escape(page.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Tuval" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${escape(page.title)}" />`,
    `<meta property="og:description" content="${escape(page.description)}" />`,
    `<meta property="og:image" content="${SITE}/brand/tuval-wordmark.png" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escape(page.title)}" />`,
    `<meta name="twitter:description" content="${escape(page.description)}" />`,
  ].join('\n    ')

  // Inside #root, so React replaces it on mount rather than leaving two copies on the page.
  const body = [
    '<main>',
    `<h1>${escape(page.claim)}</h1>`,
    `<p>${escape(page.lede)}</p>`,
    ...(page.compare ? [
      `<table><thead><tr><th>Feature</th><th>Tuval</th><th>${escape(page.compare.against)}</th></tr></thead><tbody>`,
      ...page.compare.rows.map((row) =>
        `<tr><th>${escape(row.feature)}</th><td>${escape(row.tuval)}</td><td>${escape(row.them)}</td></tr>`),
      '</tbody></table>',
      `<p>Checked ${escape(page.compare.checked)}. ${escape(page.compare.against)} is a trademark of its owner; Tuval is not affiliated with, endorsed by or sponsored by them.</p>`,
    ] : []),
    ...page.bands.flatMap((band) => [
      `<h2>${escape(band.heading)}</h2>`,
      band.body ? `<p>${escape(band.body)}</p>` : '',
      ...(band.points ?? []).flatMap((point) => [
        `<h3>${escape(point.title)}</h3>`,
        `<p>${escape(point.body)}</p>`,
      ]),
      ...(band.lines?.length
        ? [`<ul>${band.lines.map((line) => `<li>${escape(line)}</li>`).join('')}</ul>`]
        : []),
    ]).filter(Boolean),
    '<nav>',
    // The module curates which page points at which, and this used to throw that away and dump
    // every sibling on every page with the same anchor text. The served HTML and the rendered
    // page then disagreed about the shape of the site, which is exactly the drift the top of
    // this file says cannot happen. The anchor is the destination's claim, not its label: a link
    // that reads "Canvas" on eleven pages says nothing about why it is there.
    ...(page.next ?? [])
      .map((to) => all.find((other) => other.path === to))
      .filter(Boolean)
      .map((other) => `<a href="${other.path}">${escape(other.claim)}</a>`),
    '</nav>',
    '</main>',
  ].join('')

  const html = shell
    .replace('<title>Tuval</title>', head)
    .replace(
      /<meta name="description"[^>]*\/>\n?\s*/,
      (found) => (head.includes('name="description"') ? '' : found),
    )
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`)

  const where = page.path === '/' ? join(DIST, 'index.html') : join(DIST, page.path.slice(1), 'index.html')
  mkdirSync(dirname(where), { recursive: true })
  writeFileSync(where, html)
}

writeFileSync(join(DIST, 'sitemap.xml'), [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...all.map((p) => `  <url><loc>${SITE}${p.path === '/' ? '/' : p.path}</loc></url>`),
  '</urlset>',
  '',
].join('\n'))

// Everything a person made is out; everything the product says about itself is in. A workspace
// is not a place for a crawler to wander.
writeFileSync(join(DIST, 'robots.txt'), [
  'User-agent: *',
  'Allow: /$',
  ...all.filter((p) => p.path !== '/').map((p) => `Allow: ${p.path}`),
  'Allow: /u/',
  'Allow: /p/',
  'Disallow: /b/',
  'Disallow: /d/',
  'Disallow: /i/',
  'Disallow: /w/',
  'Disallow: /c/',
  'Disallow: /dashboard',
  'Disallow: /settings',
  'Disallow: /inbox',
  '',
  `Sitemap: ${SITE}/sitemap.xml`,
  '',
].join('\n'))

console.log(`prerender: ${all.length} pages, a sitemap and robots.txt`)
