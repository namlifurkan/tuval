export const LANGS = [
  'txt', 'ts', 'js', 'tsx', 'py', 'go', 'rs', 'java', 'php', 'sql', 'sh', 'json', 'css', 'html',
] as const

const KEYWORDS: Record<string, string> = {
  ts: 'abstract as async await break case catch class const continue declare default delete do else enum export extends finally for from function get if implements import in instanceof interface keyof let new of private protected public readonly return satisfies set static super switch this throw try type typeof var void while yield',
  py: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield',
  go: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var',
  rs: 'as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return self static struct super trait type unsafe use where while',
  java: 'abstract boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long native new package private protected public return short static super switch synchronized this throw throws transient try void volatile while',
  php: 'abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enum extends final finally fn for foreach function global if implements include instanceof interface isset list match namespace new or print private protected public readonly require return static switch throw trait try unset use var while yield',
  sql: 'alter and as asc between by case create delete desc distinct drop else end exists from group having in inner insert into is join left limit not null on or order outer right select set table then union update values where',
  sh: 'case do done elif else esac fi for function if in local return then until while export echo cd set unset source',
  css: 'important media supports keyframes import font-face root',
  html: 'html head body div span script style link meta title',
}
KEYWORDS.js = KEYWORDS.ts
KEYWORDS.tsx = KEYWORDS.ts

const LINE_COMMENT: Record<string, string> = {
  py: '#', sh: '#', sql: '--',
}

export type TokenKind = 'plain' | 'comment' | 'string' | 'number' | 'keyword' | 'call'

export interface Token { text: string; kind: TokenKind }

const WORD = /[A-Za-z_$][\w$]*/y
const NUMBER = /(?:0[xXbBoO][0-9a-fA-F_]+|\d[\d_]*(?:\.[\d_]+)?(?:[eE][+-]?\d+)?)/y

export function tokenize(line: string, lang: string): Token[] {
  const words = new Set((KEYWORDS[lang] ?? '').split(' ').filter(Boolean))
  const comment = LINE_COMMENT[lang] ?? '//'
  const out: Token[] = []
  const push = (text: string, kind: TokenKind) => {
    if (!text) return
    const last = out[out.length - 1]
    if (last && last.kind === kind) last.text += text
    else out.push({ text, kind })
  }

  let i = 0
  while (i < line.length) {
    if (line.startsWith(comment, i)) {
      push(line.slice(i), 'comment')
      break
    }
    const ch = line[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1
      while (j < line.length && line[j] !== ch) j += line[j] === '\\' ? 2 : 1
      push(line.slice(i, Math.min(j + 1, line.length)), 'string')
      i = j + 1
      continue
    }
    NUMBER.lastIndex = i
    const num = NUMBER.exec(line)
    if (num && num.index === i) {
      push(num[0], 'number')
      i += num[0].length
      continue
    }
    WORD.lastIndex = i
    const word = WORD.exec(line)
    if (word && word.index === i) {
      const next = line[i + word[0].length]
      push(word[0], words.has(word[0]) ? 'keyword' : next === '(' ? 'call' : 'plain')
      i += word[0].length
      continue
    }
    push(ch, 'plain')
    i += 1
  }
  return out
}

export const CODE_THEME = {
  light: {
    bg: '#FBF9F4',
    edge: 'rgba(20,19,16,0.14)',
    gutter: '#B4AFA3',
    plain: '#2A2721',
    comment: '#948E80',
    string: '#5E7A50',
    number: '#A9591F',
    keyword: '#9B3A63',
    call: '#3E5C93',
  },
  dark: {
    bg: '#23242A',
    edge: 'rgba(252,251,248,0.16)',
    gutter: '#61636C',
    plain: '#DEDCD4',
    comment: '#7C7E88',
    string: '#A8C08C',
    number: '#E0A362',
    keyword: '#E08AAE',
    call: '#8FB4E8',
  },
} as const
