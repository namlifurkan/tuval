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
  // A full-bleed pigment band or a paper one. The alternation is the voice: the app is the
  // quiet gallery, this is the poster outside it.
  tone: 'pigment' | 'paper'
  heading: string
  body?: string
  // Numbered lines rather than a card grid. Three at most; four reads as a list nobody finishes.
  points?: { title: string; body: string }[]
  demo?: Demo
}

// A comparison page carries a table and the two things a table needs to be honest: the day it
// was checked, and whose trademark is being named.
export interface Compare {
  against: string
  checked: string
  rows: { feature: string; tuval: string; them: string }[]
}

export interface Page {
  path: string
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

// One copy, and this is it. The words were briefly in this file and also in the JSON the build
// script reads, with nothing keeping them in step: editing the prose here changed what a visitor
// saw and not what a crawler was served. The JSON is now the source and this module is types and
// helpers over it.
export const PAGES: Page[] = content.pages as Page[]

export const LINK_NAMES: { [path: string]: string } = content.names

export const HOME = PAGES[0]

export const findPage = (path: string) =>
  PAGES.find((p) => p.path === (path.replace(/\/+$/, '') || '/'))
