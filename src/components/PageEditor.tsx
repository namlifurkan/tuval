import { withCollaboration } from '@blocknote/core/yjs'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import type { Theme } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import { COLOR, PIGMENTS } from '../board/brand'
import { me } from '../board/me'
import { pageAwareness, pageFragment } from '../board/page'
import { displayName, getUser } from '../board/supabase'

// BlockNote ships its own look and its own font. Neither is ours, so the whole surface is
// restated in the tokens the rest of the product uses: paper, ink, one hairline, one pigment.
// The highlight row is the gouache palette from the canvas, so a colour picked in a document
// and a colour picked on a board are the same colour.
const theme: Theme = {
  colors: {
    editor: { text: COLOR.ink, background: 'transparent' },
    menu: { text: COLOR.ink, background: COLOR.surface },
    tooltip: { text: COLOR.surface, background: COLOR.ink },
    hovered: { text: COLOR.ink, background: COLOR.wash },
    selected: { text: COLOR.pigment, background: COLOR.pigmentWash },
    disabled: { text: PIGMENTS.stone, background: COLOR.paper },
    shadow: 'rgba(20, 19, 16, 0.09)',
    border: COLOR.hairline,
    sideMenu: PIGMENTS.stone,
    highlights: {
      gray: { text: PIGMENTS.graphite, background: '#E7E4DC' },
      brown: { text: PIGMENTS.sienna, background: '#EFE0CC' },
      red: { text: PIGMENTS.terracotta, background: '#F2DCD5' },
      orange: { text: PIGMENTS.sienna, background: '#F6E4CE' },
      yellow: { text: PIGMENTS.ochre, background: '#F6EDCE' },
      green: { text: PIGMENTS.olive, background: '#E4EBD4' },
      blue: { text: PIGMENTS.cerulean, background: '#DCE6EE' },
      purple: { text: PIGMENTS.lavender, background: '#E3DFEF' },
      pink: { text: PIGMENTS.mauve, background: '#EFDCE4' },
    },
  },
  borderRadius: 8,
  fontFamily: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif',
}

export function PageEditor() {
  const editor = useCreateBlockNote(withCollaboration({
    // The type-change animation marks a block with what it used to be, and the size of a
    // heading is written in a rule that refuses to match a block still carrying that mark.
    // Restoring a document is a change from nothing to everything, so every heading on a
    // reloaded page came back at body size. Nobody asked for the animation.
    animations: false,
    collaboration: {
      fragment: pageFragment(),
      provider: { awareness: pageAwareness() },
      user: { name: displayName(getUser()?.email) || 'Anonymous', color: me.color },
    },
  }))

  return <BlockNoteView editor={editor} theme={theme} />
}
