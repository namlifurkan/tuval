// Keyboard first, which is the whole reason people like Linear. Two rules keep it from getting
// in the way: nothing fires while somebody is typing, and nothing fires with a modifier held —
// those belong to the browser and to the palette.
export function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export const plain = (e: KeyboardEvent) =>
  !e.metaKey && !e.ctrlKey && !e.altKey && !typing(e.target)

// A two-key sequence: g then i. The first key arms it and the second spends it, and anything
// else disarms it, so a stray g does nothing rather than swallowing the next keystroke.
const AFTER = 900

export function armed(lead: string, run: (second: string) => boolean) {
  let at = 0
  return (e: KeyboardEvent) => {
    if (!plain(e)) return
    if (Date.now() - at < AFTER) {
      at = 0
      if (run(e.key.toLowerCase())) e.preventDefault()
      return
    }
    at = e.key.toLowerCase() === lead ? Date.now() : 0
  }
}
