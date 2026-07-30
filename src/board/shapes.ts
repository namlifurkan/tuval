import type { ShapeKind } from './types'

export interface PathSink {
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw?: boolean): void
  rect(x: number, y: number, w: number, h: number): void
  closePath(): void
}

type Ctx = PathSink

function poly(ctx: Ctx, pts: [number, number][]) {
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
}

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

function regular(ctx: Ctx, x: number, y: number, w: number, h: number, n: number, rot = -Math.PI / 2) {
  const cx = x + w / 2, cy = y + h / 2
  const pts: [number, number][] = []
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2
    pts.push([cx + (w / 2) * Math.cos(a), cy + (h / 2) * Math.sin(a)])
  }
  poly(ctx, pts)
}

export function shapePath(kind: ShapeKind, x: number, y: number, w: number, h: number): Path2D {
  const p = new Path2D()
  buildShape(p, kind, x, y, w, h)
  return p
}

export function buildShape(p: PathSink, kind: ShapeKind, x: number, y: number, w: number, h: number): void {
  const x1 = x + w, y1 = y + h, cx = x + w / 2, cy = y + h / 2
  switch (kind) {
    case 'rect':
      p.rect(x, y, w, h); break
    case 'roundRect':
      roundRectPath(p, x, y, w, h, Math.min(w, h) * 0.12); break
    case 'ellipse':
      p.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2); break
    case 'triangle':
      poly(p, [[cx, y], [x1, y1], [x, y1]]); break
    case 'diamond':
      poly(p, [[cx, y], [x1, cy], [cx, y1], [x, cy]]); break
    case 'pentagon':
      regular(p, x, y, w, h, 5); break
    case 'hexagon':
      regular(p, x, y, w, h, 6, 0); break
    case 'octagon':
      regular(p, x, y, w, h, 8, Math.PI / 8); break
    case 'star': {
      const pts: [number, number][] = []
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.42 : 1
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2
        pts.push([cx + (w / 2) * r * Math.cos(a), cy + (h / 2) * r * Math.sin(a)])
      }
      poly(p, pts); break
    }
    case 'arrowRight': {
      const bx = x + w * 0.62, by = h * 0.25
      poly(p, [[x, y + by], [bx, y + by], [bx, y], [x1, cy], [bx, y1], [bx, y1 - by], [x, y1 - by]])
      break
    }
    case 'chevron':
      poly(p, [[x, y], [x + w * 0.75, y], [x1, cy], [x + w * 0.75, y1], [x, y1], [x + w * 0.25, cy]])
      break
    case 'cross': {
      const t = 0.3
      poly(p, [
        [x + w * t, y], [x1 - w * t, y], [x1 - w * t, y + h * t], [x1, y + h * t],
        [x1, y1 - h * t], [x1 - w * t, y1 - h * t], [x1 - w * t, y1], [x + w * t, y1],
        [x + w * t, y1 - h * t], [x, y1 - h * t], [x, y + h * t], [x + w * t, y + h * t],
      ])
      break
    }
    case 'parallelogram':
      poly(p, [[x + w * 0.22, y], [x1, y], [x1 - w * 0.22, y1], [x, y1]]); break
    case 'trapezoid':
      poly(p, [[x + w * 0.22, y], [x1 - w * 0.22, y], [x1, y1], [x, y1]]); break
    case 'cylinder': {
      const ry = Math.min(h * 0.16, 24)
      p.moveTo(x, y + ry)
      p.ellipse(cx, y + ry, w / 2, ry, 0, Math.PI, 0)
      p.lineTo(x1, y1 - ry)
      p.ellipse(cx, y1 - ry, w / 2, ry, 0, 0, Math.PI)
      p.closePath()
      break
    }
    case 'speech': {
      const bh = h * 0.82
      roundRectPath(p, x, y, w, bh, Math.min(w, bh) * 0.14)
      p.moveTo(x + w * 0.22, y + bh - 2)
      p.lineTo(x + w * 0.18, y1)
      p.lineTo(x + w * 0.42, y + bh - 2)
      p.closePath()
      break
    }
    case 'bracket': {
      const r = Math.min(w * 0.4, 30)
      p.moveTo(x1, y)
      p.lineTo(x + r, y)
      p.quadraticCurveTo(x, y, x, y + r)
      p.lineTo(x, y1 - r)
      p.quadraticCurveTo(x, y1, x + r, y1)
      p.lineTo(x1, y1)
      break
    }
    case 'stadium':
      roundRectPath(p, x, y, w, h, h / 2); break
    case 'document': {
      const dip = h * 0.14
      p.moveTo(x, y)
      p.lineTo(x1, y)
      p.lineTo(x1, y1 - dip)
      p.quadraticCurveTo(x + w * 0.75, y1 - dip * 2.4, cx, y1 - dip)
      p.quadraticCurveTo(x + w * 0.25, y1 + dip * 0.6, x, y1 - dip)
      p.closePath()
      break
    }
    case 'manualInput':
      poly(p, [[x, y + h * 0.22], [x1, y], [x1, y1], [x, y1]]); break
    case 'display': {
      p.moveTo(x, cy)
      p.lineTo(x + w * 0.18, y)
      p.lineTo(x1 - w * 0.16, y)
      p.quadraticCurveTo(x1, cy, x1 - w * 0.16, y1)
      p.lineTo(x + w * 0.18, y1)
      p.closePath()
      break
    }
    case 'delay': {
      p.moveTo(x, y)
      p.lineTo(x1 - h / 2, y)
      p.arc(x1 - h / 2, cy, h / 2, -Math.PI / 2, Math.PI / 2)
      p.lineTo(x, y1)
      p.closePath()
      break
    }
    case 'folder': {
      const tab = h * 0.16
      poly(p, [
        [x, y + tab], [x + w * 0.34, y + tab], [x + w * 0.42, y], [x1, y], [x1, y1], [x, y1],
      ])
      break
    }
    case 'note': {
      const fold = Math.min(w, h) * 0.26
      poly(p, [[x, y], [x1 - fold, y], [x1, y + fold], [x1, y1], [x, y1]])
      p.moveTo(x1 - fold, y)
      p.lineTo(x1 - fold, y + fold)
      p.lineTo(x1, y + fold)
      break
    }
    case 'actor': {
      const head = Math.min(w, h) * 0.16
      const top = y + head * 2
      p.moveTo(cx + head, y + head)
      p.arc(cx, y + head, head, 0, Math.PI * 2)
      p.moveTo(cx, top)
      p.lineTo(cx, y + h * 0.62)
      p.moveTo(x + w * 0.2, y + h * 0.38)
      p.lineTo(x1 - w * 0.2, y + h * 0.38)
      p.moveTo(cx, y + h * 0.62)
      p.lineTo(x + w * 0.24, y1)
      p.moveTo(cx, y + h * 0.62)
      p.lineTo(x1 - w * 0.24, y1)
      break
    }
    case 'component': {
      const tw = w * 0.16, th = h * 0.16
      p.rect(x + tw / 2, y, w - tw / 2, h)
      p.rect(x, y + h * 0.22, tw, th)
      p.rect(x, y + h * 0.62, tw, th)
      break
    }
    case 'node3d': {
      const d = Math.min(w, h) * 0.18
      p.rect(x, y + d, w - d, h - d)
      p.moveTo(x, y + d)
      p.lineTo(x + d, y)
      p.lineTo(x1, y)
      p.lineTo(x1, y1 - d)
      p.lineTo(x1 - d, y1)
      p.moveTo(x1 - d, y + d)
      p.lineTo(x1, y)
      break
    }
    case 'browser': {
      const bar = Math.min(h * 0.18, 26)
      roundRectPath(p, x, y, w, h, 8)
      p.moveTo(x, y + bar)
      p.lineTo(x1, y + bar)
      for (let i = 0; i < 3; i++) {
        const dx = x + 10 + i * 12
        p.moveTo(dx + 3, y + bar / 2)
        p.arc(dx, y + bar / 2, 3, 0, Math.PI * 2)
      }
      break
    }
    case 'phone': {
      roundRectPath(p, x, y, w, h, Math.min(w, h) * 0.12)
      const notch = w * 0.3
      p.moveTo(cx - notch / 2, y)
      p.lineTo(cx - notch / 2, y + h * 0.035)
      p.lineTo(cx + notch / 2, y + h * 0.035)
      p.lineTo(cx + notch / 2, y)
      break
    }
    case 'avatar': {
      const head = Math.min(w, h) * 0.22
      p.moveTo(cx + head, y + head * 1.4)
      p.arc(cx, y + head * 1.4, head, 0, Math.PI * 2)
      p.moveTo(cx - w * 0.34, y1)
      p.quadraticCurveTo(cx, y + h * 0.42, cx + w * 0.34, y1)
      break
    }
    case 'field': {
      roundRectPath(p, x, y, w, h, Math.min(h * 0.28, 10))
      p.moveTo(x + w * 0.07, y + h * 0.28)
      p.lineTo(x + w * 0.07, y1 - h * 0.28)
      break
    }
    case 'cloud': {
      const bumps: [number, number, number][] = [
        [0.22, 0.62, 0.22], [0.4, 0.36, 0.26], [0.66, 0.4, 0.24], [0.82, 0.66, 0.2],
      ]
      p.moveTo(x + w * 0.1, y1)
      for (const [bx, by, br] of bumps) {
        p.arc(x + w * bx, y + h * by, Math.min(w, h) * br, Math.PI * 0.85, Math.PI * 1.9)
      }
      p.closePath()
      break
    }
  }
}

export function shapeToSvgPath(kind: ShapeKind, x: number, y: number, w: number, h: number): string {
  const d: string[] = []
  const arcTo = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number) => {
    const p0 = [cx + rx * Math.cos(a0), cy + ry * Math.sin(a0)]
    const p1 = [cx + rx * Math.cos(a1), cy + ry * Math.sin(a1)]
    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0
    const sweep = a1 > a0 ? 1 : 0
    if (Math.abs(a1 - a0) >= Math.PI * 2 - 1e-6) {
      d.push(`M${cx - rx} ${cy}A${rx} ${ry} 0 1 1 ${cx + rx} ${cy}A${rx} ${ry} 0 1 1 ${cx - rx} ${cy}Z`)
      return
    }
    if (!d.length) d.push(`M${p0[0]} ${p0[1]}`)
    else d.push(`L${p0[0]} ${p0[1]}`)
    d.push(`A${rx} ${ry} 0 ${large} ${sweep} ${p1[0]} ${p1[1]}`)
  }
  const sink: PathSink = {
    moveTo: (a, b) => d.push(`M${a} ${b}`),
    lineTo: (a, b) => d.push(`L${a} ${b}`),
    quadraticCurveTo: (a, b, c, e) => d.push(`Q${a} ${b} ${c} ${e}`),
    arc: (a, b, r, s, e) => arcTo(a, b, r, r, s, e),
    ellipse: (a, b, rx, ry, _r, s, e) => arcTo(a, b, rx, ry, s, e),
    rect: (a, b, ww, hh) => d.push(`M${a} ${b}h${ww}v${hh}h${-ww}Z`),
    closePath: () => d.push('Z'),
  }
  buildShape(sink, kind, x, y, w, h)
  return d.join(' ')
}

export const SHAPE_GROUPS: { name: string; kinds: ShapeKind[] }[] = [
  {
    name: 'Temel',
    kinds: ['rect', 'roundRect', 'ellipse', 'triangle', 'diamond', 'star',
      'pentagon', 'hexagon', 'octagon', 'arrowRight', 'chevron', 'cross',
      'speech', 'cloud', 'bracket', 'stadium'],
  },
  {
    name: 'Flowchart',
    kinds: ['rect', 'diamond', 'stadium', 'parallelogram', 'document', 'manualInput',
      'hexagon', 'cylinder', 'display', 'delay', 'trapezoid'],
  },
  {
    name: 'UML',
    kinds: ['actor', 'ellipse', 'component', 'node3d', 'folder', 'cylinder', 'note', 'rect'],
  },
  {
    name: 'Wireframe',
    kinds: ['browser', 'phone', 'field', 'avatar', 'stadium', 'rect'],
  },
]

export const SHAPE_LIST: ShapeKind[] = [...new Set(SHAPE_GROUPS.flatMap((g) => g.kinds))]

export const STROKE_ONLY = new Set<ShapeKind>(['actor', 'bracket'])

export function textInsetFor(kind: ShapeKind, w: number, h: number) {
  switch (kind) {
    case 'actor': return { x: 0, y: h * 1.02, w, h: h * 0.3 }
    case 'browser': return { x: w * 0.06, y: h * 0.24, w: w * 0.88, h: h * 0.7 }
    case 'phone': return { x: w * 0.1, y: h * 0.12, w: w * 0.8, h: h * 0.76 }
    case 'field': return { x: w * 0.12, y: h * 0.12, w: w * 0.76, h: h * 0.76 }
    case 'node3d': return { x: w * 0.06, y: h * 0.28, w: w * 0.76, h: h * 0.62 }
    case 'folder': return { x: w * 0.08, y: h * 0.24, w: w * 0.84, h: h * 0.68 }
    case 'stadium': return { x: w * 0.12, y: h * 0.1, w: w * 0.76, h: h * 0.8 }
    case 'delay': return { x: w * 0.06, y: h * 0.12, w: w * 0.76, h: h * 0.76 }
    case 'component': return { x: w * 0.16, y: h * 0.1, w: w * 0.76, h: h * 0.8 }
    case 'triangle': return { x: w * 0.2, y: h * 0.42, w: w * 0.6, h: h * 0.52 }
    case 'diamond': return { x: w * 0.2, y: h * 0.25, w: w * 0.6, h: h * 0.5 }
    case 'star': return { x: w * 0.26, y: h * 0.3, w: w * 0.48, h: h * 0.42 }
    case 'arrowRight': return { x: w * 0.06, y: h * 0.3, w: w * 0.56, h: h * 0.4 }
    case 'speech': return { x: w * 0.08, y: h * 0.08, w: w * 0.84, h: h * 0.66 }
    case 'cloud': return { x: w * 0.2, y: h * 0.34, w: w * 0.6, h: h * 0.44 }
    default: return { x: w * 0.06, y: h * 0.06, w: w * 0.88, h: h * 0.88 }
  }
}
