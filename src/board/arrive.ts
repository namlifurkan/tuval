// Content arrives when it is scrolled to. The rule that hides it lives in global CSS, so the
// thing that reveals it has to be global too: it used to sit inside the marketing renderer, and
// any other page that used the attribute simply stayed invisible.
//
// Everything already on screen is marked at once rather than waiting for a scroll, and a browser
// with no observer is marked immediately, because a reveal that never fires is a blank page.
export function arrive(): () => void {
  if (typeof document === 'undefined') return () => undefined
  const marks = () => [...document.querySelectorAll<HTMLElement>('[data-reveal],[data-arrive]')]

  if (typeof IntersectionObserver !== 'function') {
    marks().forEach((el) => el.classList.add('seen'))
    return () => undefined
  }

  const watch = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.add('seen')
      watch.unobserve(entry.target)
    }
  }, { rootMargin: '0px 0px -12% 0px' })

  const observe = () => marks().forEach((el) => {
    if (!el.classList.contains('seen')) watch.observe(el)
  })

  observe()
  // A page that mounts its sections after the first paint would otherwise keep them hidden.
  const grown = new MutationObserver(observe)
  grown.observe(document.body, { childList: true, subtree: true })

  // Last resort: if something is still unmarked after a moment, show it. Being seen matters
  // more than arriving nicely.
  const giveUp = window.setTimeout(() => marks().forEach((el) => el.classList.add('seen')), 4000)

  return () => { watch.disconnect(); grown.disconnect(); clearTimeout(giveUp) }
}
