// What the marketing site says ---------------------------------------------------------------
// One module, read twice: by the React pages a visitor lands on, and by the build script that
// writes a real HTML file for each of these addresses. A crawler that runs no JavaScript still
// gets the headings, the prose and the links, and the two can never drift because there is only
// one copy of the words.
//
// English throughout. The audience for an open-source workspace reads English, and the app's own
// interface is translated separately.

export type Demo = 'canvas' | 'database' | 'issues' | 'none'

export interface Band {
  // Which slot on the page this band is. The home layout has eight of them and they are not
  // interchangeable, so it asks for them by name rather than guessing from their shape.
  id?: string
  // A full-bleed pigment band or a paper one. The alternation is the voice: the app is the
  // quiet gallery, this is the poster outside it.
  tone: 'pigment' | 'paper'
  heading: string
  body?: string
  // Numbered lines rather than a card grid. Three at most; four reads as a list nobody finishes.
  points?: { title: string; body: string }[]
  // A plain list, for the places where a sentence per item would be padding.
  lines?: string[]
  demo?: Demo
}

// A comparison page carries a table and the two things a table needs to be honest: the day it
// was checked, and whose trademark is being named.
export interface Compare {
  against: string
  checked: string
  // The trademark and staleness line. Written out when the page is not in English, because a
  // legal sentence in the wrong language is the one sentence a reader stops on.
  note?: string
  rows: { feature: string; tuval: string; them: string }[]
}

export interface Page {
  path: string
  // Absent means English. A page that exists in two languages names its counterpart in `alt`, and
  // the pair is what lets hreflang say they are the same page rather than two thin ones.
  lang?: string
  alt?: string
  compare?: Compare
  // What the tab and the search result say. Kept under 60 characters so it is not cut off.
  title: string
  description: string
  // The one sentence, set enormous, that the page opens with.
  claim: string
  lede: string
  bands: Band[]
  // Where this page sends a reader next. Internal linking is most of what a small site can do
  // about being found at all.
  next: string[]
}

import content from './pages.json'
import product from './product.json'

// One copy, and this is it. The words were briefly in this file and also in the JSON the build
// script reads, with nothing keeping them in step: editing the prose here changed what a visitor
// saw and not what a crawler was served. The JSON is now the source and this module is types and
// helpers over it.
export const PAGES: Page[] = content.pages as Page[]

export const LINK_NAMES: { [path: string]: string } = content.names

export const HOME = PAGES[0]

export const findPage = (path: string) =>
  PAGES.find((p) => p.path === (path.replace(/\/+$/, '') || '/'))

export const bandOf = (page: Page, id: string) => page.bands.find((b) => b.id === id)

// One token left, and it is not a price: the repository address, which is decided in
// product.json because a link that changes should change in one place.
export const filled = (text: string) => text.replace('{repo}', product.repo)
