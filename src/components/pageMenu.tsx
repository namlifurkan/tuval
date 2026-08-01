import { t } from '../i18n'

// The blocks written here have to be offered here too: a schema that can hold a callout and a
// menu that cannot make one is a feature nobody finds.
//
// The editor is taken loosely on purpose: a menu item only has to insert a block, and naming the
// exact schema here would tie this file to every block the schema happens to hold today.
interface Editor {
  insertBlocks: (blocks: object[], at: object, place: 'after') => void
  getTextCursorPosition: () => { block: object }
}

const group = 'Blocks'

export function ourSlashItems(editor: Editor) {
  const insert = (block: object) => () =>
    editor.insertBlocks([block], editor.getTextCursorPosition().block, 'after')

  return [
    {
      title: t('Callout'),
      subtext: t('A note beside the text'),
      aliases: ['callout', 'note', 'not', 'uyari'],
      group,
      onItemClick: insert({ type: 'callout' }),
    },
    {
      title: t('Equation'),
      subtext: t('Written in LaTeX'),
      aliases: ['equation', 'math', 'latex', 'formul', 'denklem'],
      group,
      onItemClick: insert({ type: 'equation' }),
    },
    {
      title: t('Table of contents'),
      subtext: t('The headings of this page'),
      aliases: ['toc', 'contents', 'icindekiler'],
      group,
      onItemClick: insert({ type: 'toc' }),
    },
    {
      title: t('Bookmark'),
      subtext: t('A link written out as a card'),
      aliases: ['bookmark', 'link', 'yer imi'],
      group,
      onItemClick: insert({ type: 'bookmark' }),
    },
    {
      title: t('Embed'),
      subtext: t('A page inside this one'),
      aliases: ['embed', 'iframe', 'goml'],
      group,
      onItemClick: insert({ type: 'embed' }),
    },
    // A toggle heading is a heading with a lid, not a block of its own, so this is the same
    // heading the menu already offers with one property set.
    ...[1, 2, 3].map((level) => ({
      title: t('Toggle heading {n}', { n: level }),
      subtext: t('A heading that folds away what is under it'),
      aliases: [`toggle${level}`, `h${level} toggle`, 'katlanabilir'],
      group,
      onItemClick: insert({ type: 'heading', props: { level, isToggleable: true } }),
    })),
  ]
}
