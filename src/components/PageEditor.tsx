import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  getMultiColumnSlashMenuItems, locales as columnLocales, multiColumnDropCursor,
} from '@blocknote/xl-multi-column'
import { CommentsExtension } from '@blocknote/core/comments'
import { withCollaboration } from '@blocknote/core/yjs'
import {
  FloatingComposerController, FloatingThreadController, getDefaultReactSlashMenuItems,
  SuggestionMenuController, useCreateBlockNote,
} from '@blocknote/react'
import { filterSuggestionItems } from '@blocknote/core'
import { en } from '@blocknote/core/locales'
import { BlockNoteView } from '@blocknote/mantine'
import { readRoute } from '../board/boards'
import { me } from '../board/me'
import { MENTION } from '../board/mention'
import { lendMarkdown, pageAwareness, pageFragment } from '../board/page'
import { PageThreadStore } from '../board/threads'
import { listTeam } from '../board/workspace'
import type { Teammate } from '../board/workspace'
import { ancestors, createRecord, getRecords, subscribeRecords } from '../board/records'
import { displayName, getUser } from '../board/supabase'
import { t } from '../i18n'
import { ourSlashItems } from './pageMenu'
import { paper, schema } from './pageSchema'
import { PageExport } from './PageExport'
import { PageFind } from './PageFind'
import { PageHistory } from './PageHistory'

const docs = () => getRecords('doc')

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

export function PageEditor({ title, locked }: { title: string; locked?: boolean }) {
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

  // The save writes markdown beside the flattened text so an agent asking for this page gets
  // something with headings and lists in it. Only this editor can produce it, and only while it
  // is mounted — which is also the only time the document can change.
  useEffect(() => {
    lendMarkdown(() => editor.blocksToMarkdownLossy())
    return () => lendMarkdown(null)
  }, [editor])

  const here = readRoute()
  const mine = here.kind === 'page' ? here.id : ''

  return (
    <>
    <div className="mb-1 ml-[54px] flex justify-end gap-1">
      <PageFind
        editor={editor as unknown as Parameters<typeof PageFind>[0]['editor']}
        locked={locked}
      />
      <PageExport editor={editor as unknown as Parameters<typeof PageExport>[0]['editor']} title={title} />
      <PageHistory editor={editor as unknown as Parameters<typeof PageHistory>[0]['editor']} />
    </div>
    <BlockNoteView editor={editor} theme={paper} editable={!locked}>
      {!!myId && <FloatingComposerController />}
      {!!myId && <FloatingThreadController />}
      {/* The default menu plus the column items, because a schema that can hold columns and a
          menu that cannot offer them is a feature nobody finds. */}
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) => filterSuggestionItems(
          [
            ...getDefaultReactSlashMenuItems(editor),
            ...getMultiColumnSlashMenuItems(editor),
            ...ourSlashItems(editor as unknown as Parameters<typeof ourSlashItems>[0]),
          ],
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

          // What is written on a page and what somebody has to do about it are the same sentence
          // typed once. An action line becomes a piece of work here rather than being retyped in
          // the tracker, and the page keeps a link to the work instead of a copy of it.
          const make = (kind: 'doc' | 'issue') => () => {
            const label = query || (kind === 'issue' ? t('Untitled') : t('Untitled page'))
            void createRecord(query, kind, kind === 'doc' ? mine || null : null).then((id) => {
              if (!id) return
              editor.insertInlineContent([
                { type: MENTION, props: { pageId: id, userId: '', label } },
                ' ',
              ])
            })
          }

          const fresh = [
            {
              title: t('New issue: {title}', { title: query || t('Untitled') }),
              subtext: t('Files it and links it here'),
              onItemClick: make('issue'),
            },
            {
              title: t('New page: {title}', { title: query || t('Untitled page') }),
              onItemClick: make('doc'),
            },
          ]

          if (named.length || found.length) return [...named, ...found, ...fresh]
          return fresh
        }}
      />
    </BlockNoteView>
    </>
  )
}
