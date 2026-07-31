import { BlockNoteView } from '@blocknote/mantine'
import { useCreateBlockNote } from '@blocknote/react'
import { withCollaboration } from '@blocknote/core/yjs'
import { pageAwareness, pageFragment } from '../board/page'
import { paper, schema } from './pageSchema'

// The same document the editor binds to, with nothing to type into it. Bound rather than
// converted so that what a reader sees is exactly what a writer wrote, blocks and all.
export function PageReader() {
  const editor = useCreateBlockNote(withCollaboration({
    schema,
    animations: false,
    collaboration: {
      fragment: pageFragment(),
      provider: { awareness: pageAwareness() },
      user: { name: 'Reader', color: '#8A867C' },
    },
  }))

  // The editor keeps a gutter on the left for the handle that appears beside a block you hover.
  // Nothing appears there when nothing can be dragged, so the text would sit indented from its
  // own title for no reason anybody could see.
  return (
    <div className="[&_.bn-editor]:px-0!">
      <BlockNoteView
        editor={editor}
        theme={paper}
        editable={false}
        sideMenu={false}
        formattingToolbar={false}
        slashMenu={false}
      />
    </div>
  )
}
