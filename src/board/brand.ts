export const PRODUCT = {
  name: 'Tuval',
  tagline: 'Sonsuz tuval',
  mark: 'T',
}

export const COLOR = {
  ink: '#141310',
  inkSoft: '#4A463E',
  muted: '#8A867C',
  paper: '#F2EFE9',
  surface: '#FCFBF8',
  hairline: '#E2DED5',
  wash: '#EBE7DE',
  pigment: '#C8452D',
  pigmentHover: '#A83621',
  pigmentWash: '#F7E9E4',
}

export const SURFACES = [
  { id: 'paper', name: 'Kağıt', color: '#F2EFE9' },
  { id: 'chalk', name: 'Badana', color: '#FAF8F4' },
  { id: 'sand', name: 'Kum', color: '#EDE5D4' },
  { id: 'linen', name: 'Keten', color: '#E7E2D6' },
  { id: 'clay', name: 'Kil', color: '#F0E5E0' },
  { id: 'celadon', name: 'Seladon', color: '#E2E9E1' },
  { id: 'mist', name: 'Sis', color: '#E3E7EA' },
  { id: 'board', name: 'Gri karton', color: '#D8D5CD' },
  { id: 'blueprint', name: 'Mavi baskı', color: '#20344A' },
  { id: 'slate', name: 'Kara tahta', color: '#25262A' },
] as const

export type SurfaceId = (typeof SURFACES)[number]['id']

export const surfaceColor = (id: string) =>
  SURFACES.find((s) => s.id === id)?.color ?? SURFACES[0].color

export function isDarkSurface(color: string) {
  const n = parseInt(color.slice(1), 16)
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) < 128
}

export const PIGMENTS = {
  naples: '#F0E3B0',
  ochre: '#E8C55A',
  sienna: '#DE9A4E',
  terracotta: '#C8664A',
  rose: '#E7B7B4',
  mauve: '#B9718A',
  celadon: '#CBD79A',
  olive: '#8FA96B',
  verdigris: '#5E9A8A',
  cerulean: '#7FA5BE',
  prussian: '#3E5C93',
  lavender: '#8A7FB0',
  paper: '#EFEDE6',
  stone: '#C6C2B6',
  graphite: '#8A867C',
  ink: '#1F1D1A',
}
