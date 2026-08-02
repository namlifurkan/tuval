import { BlockNoteSchema } from '@blocknote/core'
import { withMultiColumn } from '@blocknote/xl-multi-column'
import { createReactInlineContentSpec } from '@blocknote/react'
import type { Theme } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import { go } from '../board/boards'
import { COLOR, FONT, PIGMENTS } from '../board/brand'
import { MENTION } from '../board/mention'
import { Bookmark, Callout, Contents, Diagram, Equation, Frame } from './pageBlocks'

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
  fontFamily: FONT.stack,
}

// The same paper whichever way the machine is set. BlockNote follows the system otherwise, and
// on a laptop in dark mode half the editor went black inside a product that is paper and ink:
// the comment box arrived as white text on a black field.
export const paper = { light: theme, dark: theme }

// A page named inside another page. The whole point of a wiki is that the naming is the link,
// so it carries the id and shows the title, and a renamed page is still pointed at.
//
// The same mark names a page or a person; which id it carries is the difference. A person is
// not a link to anywhere, so it is drawn as a chip rather than underlined like a destination.
const Mention = createReactInlineContentSpec(
  {
    type: MENTION,
    propSchema: { pageId: { default: '' }, userId: { default: '' }, label: { default: '' } },
    content: 'none',
  },
  {
    render: ({ inlineContent }) => (
      inlineContent.props.userId ? (
        <span className="rounded bg-[#F7E9E4] px-1 font-medium text-[#C8452D]">
          @{inlineContent.props.label || 'Member'}
        </span>
      ) : (
        <a
          href={`/d/${inlineContent.props.pageId}`}
          onClick={(e) => { e.preventDefault(); go(`/d/${inlineContent.props.pageId}`) }}
          className="rounded px-0.5 font-medium text-[#C8452D] underline decoration-[#E6BDB2] underline-offset-2 hover:decoration-[#C8452D]"
        >
          {inlineContent.props.label || 'Untitled page'}
        </a>
      )
    ),
  },
)

// Side-by-side blocks come from BlockNote's own multi-column package rather than from us.
// It is GPL-3.0, which an AGPL-3.0 project may include.
export const schema = withMultiColumn(
  BlockNoteSchema.create().extend({
    inlineContentSpecs: { [MENTION]: Mention },
    // The blocks Notion has and BlockNote does not ship. Written here rather than found, because
    // each is a few lines and a dependency for each would be five dependencies.
    blockSpecs: {
      callout: Callout(),
      equation: Equation(),
      diagram: Diagram(),
      toc: Contents(),
      bookmark: Bookmark(),
      embed: Frame(),
    },
  }),
)

