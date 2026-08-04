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
import { marked } from 'marked'

const DIST = 'dist'
const SITE = 'https://tuval.dev'

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('prerender: no dist/index.html - run the build first')
  process.exit(1)
}

// The shell is dist/index.html, and the home page is written back over it. Run twice and the
// empty #root this looks for is gone, every page silently inherits the home page's body, and
// nothing says so. It is cheaper to refuse than to be subtly wrong.
if (!readFileSync(join(DIST, 'index.html'), 'utf8').includes('<div id="root"></div>')) {
  console.error('prerender: dist is already rendered - run the build again first')
  process.exit(1)
}

// The words live in JSON so that both readers are readers: the React pages import it and this
// writes it out. Parsing the TypeScript with a regular expression was the first attempt and it
// silently found three pages out of ten, which is exactly the failure a build step must not have.
const { pages: all } = JSON.parse(readFileSync('src/site/pages.json', 'utf8'))

const product = JSON.parse(readFileSync('src/site/product.json', 'utf8'))
const fill = (text) => String(text).replace('{repo}', product.repo)

const escape = (text) => fill(text)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

const shell = readFileSync(join(DIST, 'index.html'), 'utf8')

// Written on the two pages that carry an offer; a product marked up on eleven addresses is
// eleven products.
//
// No FAQPage: not one page here holds a question. Inventing three to earn the expansion is the
// same trick as a badge with no stars behind it.
const application = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: product.name,
  url: SITE,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  license: 'https://www.gnu.org/licenses/agpl-3.0.html',
  // The free plan is the only offer that exists to be marked up. Publishing a price for a plan
  // nobody can buy would put a number in a search result that no page here will honour.
  offers: {
    '@type': 'Offer',
    price: 0,
    priceCurrency: 'TRY',
    category: 'Free for up to three people',
  },
})

for (const page of all) {
  const url = `${SITE}${page.path === '/' ? '' : page.path}`
  const structured = ['/', '/pricing'].includes(page.path)
    ? [`<script type="application/ld+json">${application}</script>`]
    : []

  // Two pages that say the same thing in two languages are one page to a search engine, and only
  // if they both point at each other. One-sided alternates are read as two thin pages competing.
  const twin = page.alt ? all.find((other) => other.path === page.alt) : null
  const alternates = twin ? [page, twin].map((one) =>
    `<link rel="alternate" hreflang="${one.lang ?? 'en'}" `
    + `href="${SITE}${one.path === '/' ? '' : one.path}" />`)
    .concat(`<link rel="alternate" hreflang="x-default" href="${SITE}${page.lang ? twin.path : page.path}" />`)
    : []

  const head = [
    `<title>${escape(page.title)}</title>`,
    `<meta name="description" content="${escape(page.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    ...alternates,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Tuval" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${escape(page.title)}" />`,
    `<meta property="og:description" content="${escape(page.description)}" />`,
    `<meta property="og:image" content="${SITE}/brand/tuval-wordmark.png" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escape(page.title)}" />`,
    `<meta name="twitter:description" content="${escape(page.description)}" />`,
    ...structured,
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
      `<p>${escape(page.compare.note
        ?? `Checked ${page.compare.checked}. ${page.compare.against} is a trademark of its owner;`
        + ' Tuval is not affiliated with, endorsed by or sponsored by them.')}</p>`,
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
    '<footer><nav>',
    ...all.slice(1).map((other) => `<a href="${other.path}">${escape(other.claim)}</a>`),
    '</nav></footer>',
  ].join('')

  const html = shell
    .replace('<html lang="en">', `<html lang="${page.lang ?? 'en'}">`)
    .replace('<title>Tuval</title>', head)
    .replace(
      /<meta name="description"[^>]*\/>\n?\s*/,
      (found) => (head.includes('name="description"') ? '' : found),
    )
    // Marked, because this is written for a reader that does not run the bundle and it carries no
    // classes of its own. Left visible it paints as a wall of browser-default headings and links
    // for as long as the bundle takes to boot, and then vanishes — which is the flash people see
    // and read as the page being broken. The stylesheet takes it out of sight and leaves it in
    // the document, where a crawler still reads it.
    .replace('<div id="root"></div>', `<div id="root"><div data-prerendered>${body}</div></div>`)

  const where = page.path === '/' ? join(DIST, 'index.html') : join(DIST, page.path.slice(1), 'index.html')
  mkdirSync(dirname(where), { recursive: true })
  writeFileSync(where, html)
}

// Documentation is the repository's files, rendered. Not a second copy in pages.json: two copies
// of the same prose disagree within a month, and the copy a self-hoster reads is the one in the
// checkout. These carry no bundle, so nothing hydrates over them and /docs never boots the app.
const DOCS = [
  ['self-hosting', 'Self-hosting', 'Run Tuval on your own Postgres and your own disks.'],
  ['api', 'HTTP API', 'One door for a script, a bot, n8n or a spreadsheet.'],
  ['mcp', 'MCP server', 'Mount the workspace in Claude Code or Cursor.'],
  ['agents', 'Agents', 'What an agent can do with a workspace, and what it cannot.'],
  ['REPRODUCING', 'Reproducing the review numbers', 'Check the claim against your own workspace.'],
  ['keyboard', 'Keyboard', 'Every shortcut, in the three places that have them.'],
].filter(([name]) => existsSync(join('docs', `${name}.md`)))

const STYLE = 'html{color-scheme:light}'
  + 'body{margin:0;background:#F2EFE9;color:#141310;'
  + 'font:16px/1.65 ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}'
  + 'main{max-width:46rem;margin:0 auto;padding:3rem 1.5rem 6rem}'
  + 'a{color:#B43E28}h1,h2,h3{line-height:1.15;margin:2.5rem 0 .75rem}h1{margin-top:0}'
  + 'code{background:#E7E2D6;padding:.1em .35em;border-radius:.25em;font-size:.9em}'
  + 'pre{background:#141310;color:#F2EFE9;padding:1rem;border-radius:.5rem;overflow-x:auto}'
  + 'pre code{background:none;color:inherit;padding:0}'
  + 'table{border-collapse:collapse;width:100%;display:block;overflow-x:auto}'
  + 'th,td{border:1px solid #E2DED5;padding:.5rem .75rem;text-align:left;vertical-align:top}'
  + 'nav{border-bottom:1px solid #E2DED5;padding-bottom:1rem;margin-bottom:2rem;font-size:14px}'
  + 'footer{border-top:1px solid #E2DED5;margin-top:4rem;padding-top:1rem;font-size:14px}'

const docShell = (path, title, description, inner) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escape(title)} | Tuval documentation</title>
<meta name="description" content="${escape(description)}" />
<link rel="canonical" href="${SITE}${path}" />
<link rel="icon" href="/favicon.svg" />
<style>${STYLE}</style></head>
<body><main>
<nav><a href="/">Tuval</a> · <a href="/docs">Documentation</a></nav>
${inner}
<footer><a href="/docs">All documentation</a> · <a href="/">Home</a> · <a href="/pricing">Pricing</a></footer>
</main></body></html>
`

const docPath = (name) => join(DIST, 'docs', name, 'index.html')

for (const [name, title, description] of DOCS) {
  const markdown = readFileSync(join('docs', `${name}.md`), 'utf8')
  // Links between the documents are written as neighbouring files so they work in a checkout and
  // on GitHub; on the site the same link is a directory.
  const inner = marked.parse(markdown).replace(/href="([a-z-]+)\.md(#[^"]*)?"/g, 'href="/docs/$1$2"')
  mkdirSync(dirname(docPath(name)), { recursive: true })
  writeFileSync(docPath(name), docShell(`/docs/${name}`, title, description, inner))
}

writeFileSync(join(DIST, 'docs', 'index.html'), docShell(
  '/docs',
  'Documentation',
  'How to run Tuval yourself, reach it from a script or an agent, and drive it from the keyboard.',
  '<h1>Documentation</h1><p>Written in the repository and rendered here, so the copy you read is the'
  + ' copy in the checkout.</p><dl>'
  + DOCS.map(([name, title, description]) =>
    `<dt><h2><a href="/docs/${name}">${escape(title)}</a></h2></dt><dd>${escape(description)}</dd>`).join('')
  + '</dl>',
))

const docUrls = ['/docs', ...DOCS.map(([name]) => `/docs/${name}`)]

writeFileSync(join(DIST, 'sitemap.xml'), [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...all.map((p) => `  <url><loc>${SITE}${p.path === '/' ? '/' : p.path}</loc></url>`),
  ...docUrls.map((path) => `  <url><loc>${SITE}${path}</loc></url>`),
  '</urlset>',
  '',
].join('\n'))

// Everything a person made is out; everything the product says about itself is in. A workspace
// is not a place for a crawler to wander.
writeFileSync(join(DIST, 'robots.txt'), [
  'User-agent: *',
  'Allow: /$',
  ...all.filter((p) => p.path !== '/').map((p) => `Allow: ${p.path}`),
  'Allow: /docs',
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

console.log(`prerender: ${all.length} pages, ${docUrls.length} documentation pages, a sitemap and robots.txt`)
