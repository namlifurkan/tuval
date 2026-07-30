import { getMeta } from './doc'
import { TEXTURES } from './paper'
import type { TextureId } from './paper'

export const readTexture = (): TextureId => {
  const id = getMeta().texture as TextureId
  return TEXTURES.some((t) => t.id === id) ? id : 'paper'
}
