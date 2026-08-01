# Keyboard

Tuval is meant to be driven without the mouse leaving the canvas. This is every shortcut, in the
three places that have them.

## Anywhere

| Key | Action |
|---|---|
| `⌘K` | Command palette — go somewhere, make something, change a status |
| `g` then `i` | Issues |
| `g` then `p` | Projects |
| `g` then `d` | Docs |
| `g` then `b` | Dashboard |
| `g` then `n` | Inbox |
| `g` then `s` | Settings |
| `g` then `j` | Today's journal page — made if it does not exist yet |

`g` arms the next key, the way every keyboard-first tracker does it. A key that means nothing
after `g` disarms it and does nothing.

## The issue list

| Key | Action |
|---|---|
| `j` / `k` (or `↓` / `↑`) | Move down / up |
| `↵` | Open the highlighted issue |
| `c` | Compose — focus the new-issue box |
| `x` | Select the highlighted issue; again to unselect |
| `1`–`7` | Status: backlog, todo, doing, review, blocked, done, cancelled |
| `⌫` / `Delete` | Archive |
| `Esc` | Close the detail panel, then clear the selection |

Status and archive apply to everything selected with `x`, or to the highlighted row if nothing is
selected — so `x x x 6` closes three issues.

## The canvas

| Key | Action |
|---|---|
| `V` `H` `N` `T` `S` `L` `P` `F` `C` | Select, Hand, Sticky, Text, Shape, Connector, Pen, Frame, Comment |
| `Space` + drag / middle click | Pan |
| `⌘` + wheel / trackpad pinch | Zoom to cursor |
| `⌘Z` / `⌘⇧Z` | Undo / Redo |
| `⌘D` `⌘C` `⌘X` `⌘V` `⌘A` | Duplicate, copy, cut, paste, select all |
| `⌘G` / `⌘⇧G` | Group / Ungroup |
| `⌘]` `⌘[` (with `⇧` for front/back) | Z-order |
| `⇧1` `⇧2` `⇧3` | Fit, zoom to selection, 100% |
| Arrow keys (`⇧` = 10px) | Nudge |
| `Tab` / `⇧Tab` | New item to the right / left of the selection |
| `⌘F` | Search the board (`↑↓` navigate, `↵` go) |
| `⌘⌥C` / `⌘⌥V` | Copy / paste style |
| `Alt` + drag | Duplicate while moving |
| `⇧` + resize | Keep ratio · `Alt` + resize: from centre |
| `⌘` + move | Disable snapping |

## Pages

`⌘F` finds and replaces inside the open page, block by block. `/` opens the block menu — `/diagram`
for Mermaid, `/code`, `/table`. `@` links another page or mentions a person.
