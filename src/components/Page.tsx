import { useEffect, useState, useSyncExternalStore } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin'
import { LexicalCollaboration } from '@lexical/react/LexicalCollaborationContext'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { ELEMENT_TRANSFORMERS, TEXT_FORMAT_TRANSFORMERS } from '@lexical/markdown'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListItemNode, ListNode } from '@lexical/list'
import { localProvider, openPage } from '../board/page'
import { getRecords, loadRecords, patchRecord } from '../board/records'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { readRoute } from '../board/boards'
import { displayName, getUser } from '../board/supabase'
import { me } from '../board/me'
import { t } from '../i18n'
import { Shell } from './Shell'

// Paper, ink, and the same type the rest of the product uses. A document that looks like a
// document rather than a form field.
const theme = {
  paragraph: 'mb-3 leading-[1.7] text-[15px] text-[#141310]',
  quote: 'my-4 border-l-2 border-[#C8452D] pl-4 italic text-[#4A463E]',
  heading: {
    h1: 'mb-3 mt-7 text-[26px] font-bold leading-tight tracking-[-0.015em] text-[#141310]',
    h2: 'mb-2 mt-6 text-[20px] font-bold leading-tight text-[#141310]',
    h3: 'mb-2 mt-5 text-[16px] font-bold text-[#141310]',
  },
  list: {
    ul: 'mb-3 ml-5 list-disc space-y-1',
    ol: 'mb-3 ml-5 list-decimal space-y-1',
    listitem: 'leading-[1.7] text-[15px] text-[#141310]',
  },
  text: {
    bold: 'font-bold',
    italic: 'italic',
    code: 'rounded bg-[#EBE7DE] px-1 py-0.5 font-mono text-[13px]',
  },
}

export function Page() {
  const route = readRoute()
  const id = route.kind === 'page' ? route.id : ''
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const [title, setTitle] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!id) return
    openPage(id)
    setReady(true)
  }, [id])

  useEffect(() => {
    if (!workspace || !id) return
    void loadRecords('doc').then(() => {
      setTitle(getRecords().find((r) => r.id === id)?.title ?? '')
    })
  }, [workspace, id])

  if (!id) return null

  return (
    <Shell title={title || t('Untitled page')}>
      <input
        value={title}
        onChange={(e) => { setTitle(e.target.value); void patchRecord(id, { title: e.target.value }) }}
        placeholder={t('Untitled page')}
        className="w-full bg-transparent text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#141310] outline-none placeholder:text-[#C6C2B6]"
      />

      <div className="relative mt-6">
        {ready && (
          <LexicalComposer
            initialConfig={{
              namespace: 'tuval',
              theme,
              nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode],
              onError: (e: Error) => { throw e },
              // The document is the Yjs one; Lexical must not also load an initial state.
              editorState: null,
            }}
          >
            <LexicalCollaboration>
            <RichTextPlugin
              contentEditable={<ContentEditable className="min-h-[50vh] outline-none" />}
              placeholder={
                <p className="pointer-events-none absolute left-0 top-0 text-[15px] text-[#C6C2B6]">
                  {t('Write, or press # for a heading and - for a list')}
                </p>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <CollaborationPlugin
              id={id}
              providerFactory={localProvider}
              shouldBootstrap
              username={displayName(getUser()?.email)}
              cursorColor={me.color}
            />
            <ListPlugin />
            <MarkdownShortcutPlugin transformers={[...ELEMENT_TRANSFORMERS, ...TEXT_FORMAT_TRANSFORMERS]} />
            </LexicalCollaboration>
          </LexicalComposer>
        )}
      </div>
    </Shell>
  )
}
