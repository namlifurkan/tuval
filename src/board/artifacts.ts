import { COLOR, surfaceColor } from './brand'
import { getMeta } from './doc'

export const artifactSurface = (documentMeta: Record<string, unknown> = getMeta()) =>
  surfaceColor(String(documentMeta.surface ?? 'paper'))

export const ARTIFACT_PAPER = COLOR.paper
export const ARTIFACT_INK = COLOR.ink
export const ARTIFACT_SHEET = '#FFFFFF'
