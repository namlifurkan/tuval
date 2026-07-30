# Tuval

Açık kaynak sonsuz tuval. Canvas 2D renderer + Yjs CRDT.

Miro, FigJam ve benzeri araçlara açık kaynak bir alternatif. Kod, tasarım ve marka
tamamen kendimize ait; hiçbir ticari üründen görsel kimlik veya varlık kopyalanmamıştır.
Ürün vizyonu ve çalışma kuralları için [CLAUDE.md](CLAUDE.md).

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
| `Tab` / `⇧Tab` | Seçili item'ın sağına/soluna yeni item (hızlı ekleme) |
| `⌘F` | Board içinde ara |
| `⌘⌥C` / `⌘⌥V` | Stili kopyala / yapıştır |
| `Alt`+sürükle | Kopyalayarak taşı |
| `⇧`+resize | Oranı koru · `Alt`+resize: merkezden |
| `⌘`+taşı | Snap'i kapat |

## Durum

**Faz 1 — canvas motoru:** sonsuz canvas, sticky/shape/text/pen/frame/image/connector,
çoklu seçim, resize+rotate, hizalama guide'ları, gruplama, frame'e otomatik ekleme,
z-sırası, undo/redo, minimap, sağ tık menüsü, context toolbar, awareness (canlı imleç),
IndexedDB kalıcılık, resim sürükle-bırak/yapıştır.

**Faz 2 — canvas fidelity:** yorum pin'leri + thread (yanıt, çözüldü, sil), seçimin
4 yanındaki hızlı-ekle okları ve `Tab` kısayolu, 5 şablon (Kanban, Retrospektif,
Brainwriting, Akış şeması, Zihin haritası), sunum modu (frame'ler slayt), silgi,
frame boyut preset'leri, metin taşınca shape/sticky'nin otomatik büyümesi.

**Faz 3 — etkileşim doğruluğu:** connector uç noktalarını sürükleyerek yeniden bağlama,
kilitli item'lar seçilebilir (rozetli, taşınamaz), hizala/dağıt/ızgaraya diz, stil
kopyala-yapıştır, opaklık + hex renk seçici, board içi arama (`⌘F`), connector etiketi
düzenleme, marquee frame'i ancak tamamen kapsayınca seçer.

**Faz 4-5 — cila:** resize/rotate sırasında canlı boyut-açı rozeti, görsellerde oran
kilidi, eşit-aralık snap'i ve aralık işaretleri, sürüklenen item'ın altındaki frame'in
vurgulanması, canlı önizlemeli frame paneli, canvas'ta frame başlığı yeniden adlandırma,
metin yazarken otomatik genişleme, PNG dışa aktarma, connector kırılma noktası,
zoom menüsü, board menüsü, canlı katılımcı avatarları, uzak zoom'da metin LOD'u.

Sırada: Supabase (auth + board listesi + storage + snapshot), çoklu kullanıcı testi.
