import { useSyncExternalStore } from 'react'
import { BlockNoteSchema } from '@blocknote/core'
import { withCollaboration } from '@blocknote/core/yjs'
import {
  createReactInlineContentSpec, SuggestionMenuController, useCreateBlockNote,
} from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import type { Theme } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import { go, readRoute } from '../board/boards'
import { COLOR, PIGMENTS } from '../board/brand'
import { me } from '../board/me'
import { MENTION } from '../board/mention'
import { pageAwareness, pageFragment } from '../board/page'
import { ancestors, createRecord, getRecords, subscribeRecords } from '../board/records'
import { displayName, getUser } from '../board/supabase'
import { t } from '../i18n'

const docs = () => getRecords('doc')

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

// A page named inside another page. The whole point of a wiki is that the naming is the link,
// so it carries the id and shows the title, and a renamed page is still pointed at.
const Mention = createReactInlineContentSpec(
  { type: MENTION, propSchema: { pageId: { default: '' }, label: { default: '' } }, content: 'none' },
  {
    render: ({ inlineContent }) => (
      <a
        href={`/d/${inlineContent.props.pageId}`}
        onClick={(e) => { e.preventDefault(); go(`/d/${inlineContent.props.pageId}`) }}
        className="rounded px-0.5 font-medium text-[#C8452D] underline decoration-[#E6BDB2] underline-offset-2 hover:decoration-[#C8452D]"
      >
        {inlineContent.props.label || 'Untitled page'}
      </a>
    ),
  },
)

const schema = BlockNoteSchema.create().extend({ inlineContentSpecs: { [MENTION]: Mention } })

export function PageEditor() {
  const pages = useSyncExternalStore(subscribeRecords, docs, docs)

  const editor = useCreateBlockNote(withCollaboration({
    schema,
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

  const here = readRoute()
  const mine = here.kind === 'page' ? here.id : ''

  return (
    <BlockNoteView editor={editor} theme={theme}>
      <SuggestionMenuController
        triggerCharacter="@"
        getItems={async (query) => {
          const q = query.toLowerCase()
          // Linking a page to itself says nothing and would show the page in its own backlinks.
          const found = pages
            .filter((p) => p.id !== mine && (p.title || t('Untitled page')).toLowerCase().includes(q))
            .slice(0, 10)
            .map((p) => ({
              title: p.title || t('Untitled page'),
              subtext: ancestors(pages, p.id).map((up) => up.title || t('Untitled page')).join(' / '),
              onItemClick: () => {
                editor.insertInlineContent([
                  { type: MENTION, props: { pageId: p.id, label: p.title || t('Untitled page') } },
                  ' ',
                ])
              },
            }))

          return found.length ? found : [{
            title: t('New page: {title}', { title: query || t('Untitled page') }),
            onItemClick: () => {
              void createRecord(query, 'doc', mine || null).then((id) => {
                if (!id) return
                editor.insertInlineContent([
                  { type: MENTION, props: { pageId: id, label: query || t('Untitled page') } },
                  ' ',
                ])
              })
            },
          }]
        }}
      />
    </BlockNoteView>
  )
}
