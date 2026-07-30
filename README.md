# Miro Clone

Sonsuz canvas whiteboard. Canvas 2D renderer + Yjs CRDT.

## Çalıştırma

```bash
npm run dev            # uygulama → http://localhost:5173
npm run collab         # (opsiyonel) y-websocket sunucusu :1234
```

Çoklu kullanıcı için `.env.local` içine `VITE_COLLAB_URL=ws://localhost:1234` yaz.
Board odası URL hash'inden gelir: `http://localhost:5173/#takim-board`.

## Mimari

| Dosya | Sorumluluk |
|---|---|
| `src/board/types.ts` | Item şeması, renk paletleri |
| `src/board/doc.ts` | Yjs döküman, CRUD, undo/redo, IndexedDB + WS provider |
| `src/board/camera.ts` | Viewport dönüşümleri, zoom, fit |
| `src/board/geometry.ts` | Hit-test, resize/rotate matematiği, snap, connector routing |
| `src/board/shapes.ts` | 18 shape path generator (canvas + SVG) |
| `src/board/text.ts` | Text wrap, sticky auto-fit |
| `src/board/render.ts` | Canvas render pipeline, seçim overlay, remote cursor |
| `src/board/interaction.ts` | Pointer state machine (pan/marquee/move/resize/rotate/draw/connect) |
| `src/board/store.ts` | Zustand UI state + render dirty flag |

Render tek `<canvas>` üzerinde, dirty-flag'li rAF döngüsüyle. Text düzenleme sadece
düzenleme anında DOM overlay (`TextEditor.tsx`).

## Kısayollar

| Tuş | İşlem |
|---|---|
| `V` `H` `N` `T` `S` `L` `P` `F` `C` | Select, Hand, Sticky, Text, Shape, Connector, Pen, Frame, Comment |
| `Space` + sürükle / orta tık | Pan |
| `⌘`+wheel / trackpad pinch | İmlece zoom |
| `⌘Z` / `⌘⇧Z` | Undo / Redo |
| `⌘D` `⌘C` `⌘X` `⌘V` `⌘A` | Duplicate, kopyala, kes, yapıştır, tümünü seç |
| `⌘G` / `⌘⇧G` | Grupla / Grubu çöz |
| `⌘]` `⌘[` (`⇧` ile en öne/arkaya) | Z-sırası |
| `⇧1` `⇧2` `⇧3` | Fit, seçime zoom, %100 |
| Ok tuşları (`⇧` = 10px) | Nudge |
| `Alt`+sürükle | Kopyalayarak taşı |
| `⇧`+resize | Oranı koru · `Alt`+resize: merkezden |
| `⌘`+taşı | Snap'i kapat |

## Durum

Yapıldı: sonsuz canvas, sticky/shape/text/pen/frame/image/connector, çoklu seçim,
resize+rotate, hizalama guide'ları, gruplama, frame'e otomatik ekleme, z-sırası,
undo/redo, minimap, sağ tık menüsü, context toolbar, awareness (canlı imleç),
IndexedDB kalıcılık, resim sürükle-bırak/yapıştır.

Sırada: Supabase (auth + board listesi + storage + snapshot), comment tool,
template kütüphanesi, presentation mode.
