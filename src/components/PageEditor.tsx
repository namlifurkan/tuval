import { useEffect, useState, useSyncExternalStore } from 'react'
import { BlockNoteSchema } from '@blocknote/core'
import {
  getMultiColumnSlashMenuItems, locales as columnLocales, multiColumnDropCursor, withMultiColumn,
} from '@blocknote/xl-multi-column'
import { CommentsExtension } from '@blocknote/core/comments'
import { withCollaboration } from '@blocknote/core/yjs'
import {
  createReactInlineContentSpec, FloatingComposerController, FloatingThreadController,
  getDefaultReactSlashMenuItems, SuggestionMenuController, useCreateBlockNote,
} from '@blocknote/react'
import { filterSuggestionItems } from '@blocknote/core'
import { en } from '@blocknote/core/locales'
import { BlockNoteView } from '@blocknote/mantine'
import type { Theme } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import { go, readRoute } from '../board/boards'
import { COLOR, PIGMENTS } from '../board/brand'
import { me } from '../board/me'
import { MENTION } from '../board/mention'
import { pageAwareness, pageFragment } from '../board/page'
import { PageThreadStore } from '../board/threads'
import { listTeam } from '../board/workspace'
import type { Teammate } from '../board/workspace'
import { ancestors, createRecord, getRecords, subscribeRecords } from '../board/records'
import { displayName, getUser } from '../board/supabase'
import { t } from '../i18n'
import { PageExport } from './PageExport'
import { PageHistory } from './PageHistory'

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

// The same paper whichever way the machine is set. BlockNote follows the system otherwise, and
// on a laptop in dark mode half the editor went black inside a product that is paper and ink:
// the comment box arrived as white text on a black field.
const paper = { light: theme, dark: theme }

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
const schema = withMultiColumn(
  BlockNoteSchema.create().extend({ inlineContentSpecs: { [MENTION]: Mention } }),
)

// Everyone the workspace knows, asked for once and answered from memory after that. BlockNote
// asks for the people it does not have rather than for all of them.
const faces = new Map<string, { username: string; avatarUrl: string }>()

async function resolveUsers(ids: string[]) {
  const missing = ids.filter((id) => !faces.has(id))
  if (missing.length) {
    for (const mate of await listTeam()) {
      faces.set(mate.userId, {
        username: mate.email.split('@')[0] || t('Member'),
        avatarUrl: '',
      })
    }
  }
  return ids.map((id) => ({ id, ...(faces.get(id) ?? { username: t('Member'), avatarUrl: '' }) }))
}

export function PageEditor({ title }: { title: string }) {
  const pages = useSyncExternalStore(subscribeRecords, docs, docs)
  const myId = getUser()?.id ?? ''
  const [team, setTeam] = useState<Teammate[]>([])

  useEffect(() => { void listTeam().then(setTeam) }, [])

  const editor = useCreateBlockNote(withCollaboration({
    schema,
    // Comments live in the page's own document, so they arrive with it and cannot drift from
    // the text they are attached to.
    extensions: myId
      ? [CommentsExtension({ threadStore: new PageThreadStore(myId), resolveUsers })]
      : [],
    // The type-change animation marks a block with what it used to be, and the size of a
    // heading is written in a rule that refuses to match a block still carrying that mark.
    // Restoring a document is a change from nothing to everything, so every heading on a
    // reloaded page came back at body size. Nobody asked for the animation.
    animations: false,
    dropCursor: multiColumnDropCursor,
    // The column items read their own labels out of the editor's dictionary, so the package's
    // words have to be handed over with it or the menu simply has no columns in it.
    dictionary: { ...en, multi_column: columnLocales.en },
    collaboration: {
      fragment: pageFragment(),
      provider: { awareness: pageAwareness() },
      user: { name: displayName(getUser()?.email) || 'Anonymous', color: me.color },
    },
  }))

  const here = readRoute()
  const mine = here.kind === 'page' ? here.id : ''

  return (
    <>
    <div className="mb-1 ml-[54px] flex justify-end gap-1">
      <PageExport editor={editor as unknown as Parameters<typeof PageExport>[0]['editor']} title={title} />
      <PageHistory editor={editor as unknown as Parameters<typeof PageHistory>[0]['editor']} />
    </div>
    <BlockNoteView editor={editor} theme={paper}>
      {!!myId && <FloatingComposerController />}
      {!!myId && <FloatingThreadController />}
      {/* The default menu plus the column items, because a schema that can hold columns and a
          menu that cannot offer them is a feature nobody finds. */}
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) => filterSuggestionItems(
          [...getDefaultReactSlashMenuItems(editor), ...getMultiColumnSlashMenuItems(editor)],
          query,
        )}
      />

      <SuggestionMenuController
        triggerCharacter="@"
        getItems={async (query) => {
          const q = query.toLowerCase()
          // People first: a name typed after @ is far more often a person than a page.
          const named = team
            .filter((mate) => mate.userId !== myId && mate.email.toLowerCase().includes(q))
            .slice(0, 5)
            .map((mate) => {
              const label = displayName(mate.email) || t('Member')
              return {
                title: `@${label}`,
                subtext: mate.email,
                onItemClick: () => {
                  editor.insertInlineContent([
                    { type: MENTION, props: { pageId: '', userId: mate.userId, label } },
                    ' ',
                  ])
                },
              }
            })

          // Linking a page to itself says nothing and would show the page in its own backlinks.
          const found = pages
            .filter((p) => p.id !== mine && (p.title || t('Untitled page')).toLowerCase().includes(q))
            .slice(0, 10)
            .map((p) => ({
              title: p.title || t('Untitled page'),
              subtext: ancestors(pages, p.id).map((up) => up.title || t('Untitled page')).join(' / '),
              onItemClick: () => {
                editor.insertInlineContent([
                  { type: MENTION, props: { pageId: p.id, userId: '', label: p.title || t('Untitled page') } },
                  ' ',
                ])
              },
            }))

          if (named.length || found.length) return [...named, ...found]
          return [{
            title: t('New page: {title}', { title: query || t('Untitled page') }),
            onItemClick: () => {
              void createRecord(query, 'doc', mine || null).then((id) => {
                if (!id) return
                editor.insertInlineContent([
                  { type: MENTION, props: { pageId: id, userId: '', label: query || t('Untitled page') } },
                  ' ',
                ])
              })
            },
          }]
        }}
      />
    </BlockNoteView>
    </>
  )
}
