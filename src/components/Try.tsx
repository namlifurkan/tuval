import { lazy, Suspense } from 'react'
import { routePath } from '../board/boards'

// Three finished designs, mounted side by side so they can be looked at rather than argued
// about. Each is one self-contained file that owns its whole page: its own language, its own
// structure, its own words. Nothing here ships; whichever wins becomes the site.
const TRIES: { [letter: string]: () => Promise<{ default: React.ComponentType }> } = {
  a: () => import('./try/A'),
  b: () => import('./try/B'),
  c: () => import('./try/C'),
}

export function Try() {
  const letter = routePath().split('/')[2]?.toLowerCase() ?? ''
  const load = TRIES[letter]

  if (!load) {
    return (
      <main className="mx-auto max-w-[40rem] px-6 py-24">
        <h1 className="text-[24px] font-bold">Three ways this could go</h1>
        <ul className="mt-6 space-y-2">
          {Object.keys(TRIES).map((one) => (
            <li key={one}>
              <a href={`/try/${one}`} className="text-[#C8452D] underline underline-offset-4">
                /try/{one}
              </a>
            </li>
          ))}
        </ul>
      </main>
    )
  }

  const Shown = lazy(load)
  return <Suspense fallback={null}><Shown /></Suspense>
}
