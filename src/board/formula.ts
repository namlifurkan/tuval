import { Parser } from 'expr-eval-fork'

// Somebody typing into a column header is typing into a language, and a language wants a parser
// rather than a regular expression. This one evaluates its own grammar and never reaches JS, so
// a formula cannot become a script.
const parser = new Parser()

// The day where the person is, not the day in UTC. East of Greenwich an evening is already
// tomorrow in UTC, so toISOString would count from the wrong day from mid-afternoon onwards.
export const today = () => {
  const at = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

// The parser will not call a function handed to it as a variable, which is the guard that keeps
// an expression from reaching anything it was not given. Ours are registered on the parser
// instead, and the row being worked out is set beside them: evaluation is synchronous, so the
// call below and the call to prop are the same turn.
let current: { [name: string]: unknown } = {}

// A column name may have a space in it, which no expression language will take as an identifier,
// so values are read through a call the way Notion reads them.
Object.assign(parser.functions, {
  prop: (name: unknown) => current[String(name)] ?? '',
  empty: (v: unknown) => v === undefined || v === null || v === '',
  today: () => today(),
  text: (v: unknown) => (v === undefined || v === null ? '' : String(v)),
  number: (v: unknown) => (typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.')) || 0),
  // Two YYYY-MM-DD days apart, which is the only date arithmetic a table asks for.
  days: (a: unknown, b: unknown) =>
    Math.round((Date.parse(String(b)) - Date.parse(String(a))) / 86400000) || 0,
})

// Parsing is the expensive half and a formula changes far less often than the rows under it.
const cache = new Map<string, ReturnType<Parser['parse']> | null>()

export const ERROR = '#error'

export function evaluate(source: string, props: { [name: string]: unknown }): unknown {
  const written = source.trim()
  if (!written) return ''

  let expr = cache.get(written)
  if (expr === undefined) {
    try {
      expr = parser.parse(written)
    } catch {
      expr = null
    }
    cache.set(written, expr)
  }
  if (!expr) return ERROR

  const outer = current
  current = props
  try {
    const found = expr.evaluate(props as never)
    return typeof found === 'number' && !Number.isFinite(found) ? ERROR : found
  } catch {
    return ERROR
  } finally {
    current = outer
  }
}
