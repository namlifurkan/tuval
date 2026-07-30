# Tuval — sonsuz tuval / workspace çekirdeği

## 0. Her akışın başında: `/find-skills`

**Zorunlu ilk adım.** Bu depoda herhangi bir işe başlamadan önce `/find-skills` çalıştır ve
yapacağın işe göre skill ara:

```bash
npx skills find "<konu>"                     # ara
npx skills add <owner/repo@skill> -g -y      # kur
```

Neden: kurulan skill'ler alan-spesifik, somut bilgi getiriyor. Örnek —
`liveblocks/skills@yjs-best-practices`, Y.Map'in her anahtar yazımının geçmişini sakladığını
ortaya çıkardı; bu yüzden sürükleme sırasında her `pointermove`'da Yjs'e yazmak dokümanı
şişiriyordu. Skill olmadan bu fark edilmemişti.

Ne zaman yeniden ara: yeni kütüphane, yeni servis, yeni problem sınıfı işin içine girdiğinde
(ör. Supabase fazına geçerken, blok editörüne başlarken, realtime'ı sertleştirirken).
Hangi skill'i neden kurduğunu ve neyi değiştirdiğini kullanıcıya söyle.

Halihazırda kurulu ve bu depoda işe yarayanlar: `yjs-best-practices`, `supabase-storage`,
`design-principles`, `frontend-design`, `tailwind-4-docs`.

---

## 1. Ürün perspektifi

**Birincil hedef: Miro'nun işlevsel olarak %95'ini klonlamak ve şirket içinde kullanmak.**
Ölçüt: Miro'da yapılan iş burada aynı akış, aynı kısayollar ve aynı hissiyatla yapılabilmeli.
Eksik davranışlar borçtur, §4'te listelenir. **Özellik paritesi görsel süslemenin önündedir.**

İkincil hedef: aynı kod tabanını AFFiNE gibi açık kaynak yayınlamak. Görsel kimliğin bize ait
olmasının tek sebebi budur (bkz. §2) — işlev kopyalanır, marka kopyalanmaz. Bu, parite hedefini
gevşetmez: bir davranış "Miro'da böyle" diye doğrudur, "Miro'ya benzemesin" diye değiştirilmez.

Motivasyon: beyaz yakalıların Miro + Jira + Notion'a ödediği ücretlerden kurtulmak.

Sıra: **Kanban (bitti) → sonsuz tuval (bu depo) → doküman/veritabanı (Notion tarzı)**.

Kritik nokta: bunlar üç ayrı ürün değil, **tek bir çalışma alanının farklı görünümleri**:

- Kanban → kayıtların pano görünümü
- Doküman → aynı kayıtların sayfa/tablo/veritabanı görünümü
- Tuval → aynı kayıtların sonsuz tuval üzerindeki görünümü
- Sonra: takvim, timeline, form, CRM görünümleri

Tuval'deki bir kart doğrudan bir Kanban görevine bağlanabilmeli; doküman içindeki proje
veritabanı aynı panoda açılabilmeli. Asıl değer klon olmak değil, **tuvaldeki bir fikrin tek
hareketle göreve, dokümana veya CRM kaydına dönüşmesi**.

### Ortak veri modeli

```
Workspace → kişi → şirket → proje → görev → doküman → etkinlik → dosya
```

Her nesne tablo, Kanban, doküman, takvim veya tuval görünümünde açılabilmeli. "Her meslek için
ayrı özellik" yerine ajans / yazılım ekibi / avukat / danışman / freelancer için **şablonlar**.

### Notion fazından önce oturması gereken çekirdek

Workspace, kullanıcı ve ekip · rol ve yetkiler · gerçek zamanlı ortak çalışma · yorum, mention,
bildirim · dosya ekleri · arama · versiyon geçmişi · aktivite kaydı · içeri/dışarı aktarma ·
tek API ve ortak veri modeli.

### Sonraki mantıklı adımlar (Notion fazından sonra)

1. Form oluşturucu (yanıtlar doğrudan mevcut veritabanına düşer) — düşük maliyet, yüksek fayda
2. Takvim ve timeline görünümü — yeni servis değil, mevcut kayıtlara yeni görünüm
3. Basit CRM — ayrı ürün değil; kişi, şirket, görüşme, satış aşaması şablonları
4. Calendly'nin basit sürümü — takvim bağlantısı + müsaitlik + rezervasyon sayfası
5. Loom benzeri ekran kaydı — video depolama/işleme gideri çıkarır, en sona

### Sıfırdan KLONLANMAYACAKLAR (entegre et, yazma)

| Servis | Neden | Bunun yerine |
|---|---|---|
| n8n | Yüzlerce entegrasyonun sürekli bakımı | Community sürümünü self-host et, pakete göm |
| Meet / Zoom | WebRTC, SFU, kayıt, bant genişliği | Jitsi self-host veya sadece toplantı linki üret |
| GitHub / GitLab | Git protokolü, CI, artifact altyapısı | Forgejo |
| Google Drive | Senkronizasyon ve veri güvenliği başlı başına ürün | Nextcloud veya S3 tabanlı basit dosya modülü |
| Figma | Grafik motoru + gerçek zamanlı editör çok büyük iş | Penpot self-host |
| Slack / Teams | Bildirim, mobil, arama tarafı büyür | Entegrasyon veya açık kaynak çözüm |
| E-posta | Teslimat itibarı, spam, güvenlik yükü | Gmail/Outlook entegrasyonu |

### Referans projeler

- **AFFiNE** — "açık kaynak Notion + Miro"; doküman ve sonsuz tuval aynı blok sisteminde,
  local-first, self-host. Doğrudan ürün referansımız; BlockSuite editör altyapısı incelenmeli.
- **Huly** — görev, doküman, chat, takvim, drive, CRM, HR tek uygulamada. Vizyonun daha geniş
  ölçekte denenmiş hâli. Uyarı: ücretli servisi 2026 Temmuz'da kapandı — self-host pazarının
  tek başına gelir üretmesi zor.
- **Nextcloud Hub / openDesk** — Google Workspace / Microsoft 365'in açık kaynak karşılığı;
  ortak veri modeli olan tek uygulama değil, birbirine bağlı modüller.
- **Odoo / ERPNext** — şirket operasyonları tarafı.

Açık alan: bilgi üretimi (Notion + tuval) + iş yürütme (Jira/Linear/Trello) + iletişim +
şirket işlemleri dörtlüsünü **tek sade arayüz ve ortak veri modeliyle** birleştiren olgun ürün
hâlâ yok. Bizim hedefimiz ilk ikisi.

---

## 2. Marka ve hukuk (ZORUNLU)

Bu proje açık kaynak olarak yayınlanacak. **Miro'nun (veya başka bir ticari ürünün) görsel
kimliği kopyalanmaz.**

- Kopyalanmaz: marka rengi, logo, ikon seti, birebir renk paleti, pazarlama metni, ürün adı.
- Kopyalanabilir: etkileşim kalıpları (sonsuz tuval, imlece zoom, seçim tutamakları, bağlayıcı
  anchor'ları). Bunlar sektör standardı davranışlar.
- Kod veya varlık kopyalanmaz; her şey sıfırdan yazılır.
- README ve site metninde "Miro klonu" ifadesi kullanılmaz; "açık kaynak sonsuz tuval" denir.
  Karşılaştırma gerekiyorsa "X'e alternatif" nötr dili tercih edilir.

### Görsel yön: müze / modern resim

Marka sesi çağdaş sanat müzesi kimliği: sakin kabuk, tek pigment vurgusu, editoryal tipografi.
Tokenlar `src/board/brand.ts` içinde tek yerde:

- Kağıt tuval `#F2EFE9`, mürekkep `#141310`, saç teli çizgi `#E2DED5`
- Tek vurgu pigmenti vermilion `#C8452D` — birincil buton, aktif araç, yorum pinleri, guide'lar
- Seçim kroması **mürekkep** (renkli değil); her zeminde okunsun diye beyaz dış kontur + mürekkep
  iç kontur (çift çizgi)
- Palet guaj/pigment tonları: naples sarısı, oker, siena, terrakota, gül, mor, seladon, zeytin,
  verdigris, serulean, prusya mavisi, lavanta
- Tipografi: arayüz `Space Grotesk`, tuval metni `Instrument Sans`
- Yasak: Inter/Roboto/Arial birincil font, mor gradyanlar, kalıp gölgeler, yön seçmemiş tasarım

Ürün adı ve markası `src/board/brand.ts` içindeki `PRODUCT` sabitinden gelir; ad değişimi tek
satırdır.

---

## 3. Bu deponun mimarisi

Vite + React 19 + TypeScript + Tailwind v4. Render tek `<canvas>` üzerinde, dirty-flag'li rAF
döngüsü. Doküman Yjs CRDT; kalıcılık IndexedDB, çoklu kullanıcı y-websocket (sonra Supabase).

| Dosya | Sorumluluk |
|---|---|
| `src/board/types.ts` | Item şeması, paletler, marka tokenları |
| `src/board/brand.ts` | Ürün adı ve renk tokenları |
| `src/board/doc.ts` | Yjs dokümanı, CRUD, undo/redo, persistence, provider |
| `src/board/camera.ts` | Viewport dönüşümleri, zoom, fit |
| `src/board/geometry.ts` | Hit-test, resize/rotate matematiği, snap, bağlayıcı rotası |
| `src/board/interaction.ts` | Pointer state machine |
| `src/board/render.ts` | Render pipeline, seçim overlay, uzak imleçler |
| `src/board/store.ts` | Zustand UI state + ephemeral `session` |

### Konvansiyonlar

- **Kod yorumu yazma.** Sadece `// TODO:` serbest. Kod kendini anlatmalı.
- Mevcut kalıpları birebir takip et (isimlendirme, dosya düzeni, import sırası).
- Tembel-kıdemli merdiveni: gerekmiyorsa yazma → stdlib → platform özelliği → kurulu bağımlılık
  → tek satır → ancak sonra minimum kod. Yeni bağımlılık, birkaç satırın çözdüğü şey için asla.
- Asla tembellik yok: girdi doğrulama, veri kaybını önleyen hata yönetimi, güvenlik,
  erişilebilirlik, açıkça istenen şeyler.
- Sürükleme gibi yüksek frekanslı işlemler Yjs'e her karede yazmaz; `session.preview` katmanında
  birikir, ~80ms'de bir ve bırakışta flush edilir.
- `src/board/doc.ts` ve `store.ts` singleton state tutar; ikisinde de `import.meta.hot.accept →
  invalidate` var, HMR'de tam reload olsun diye. Bu satırları silme, yoksa ikinci bir Y.Doc oluşur.
- **Tip kontrolü `npx tsc -b --noEmit` ile yapılır.** `npx tsc --noEmit` bu projede hiçbir şeyi
  kontrol etmez: kök `tsconfig.json` `"files": []` olan bir solution dosyası, gerçek ayarlar
  `tsconfig.app.json` içinde. Bare komut sessizce başarılı döner ve hataları gizler.
- Değişiklik sonrası: `npx tsc -b --noEmit` ve `npx vite build`. Test suite'i her adımda değil,
  iş bitince bir kez.

### Doğrulama

Tarayıcıda gerçekten dene. Otomasyon aracının iki bilinen sınırı var, bunları bug sanma:
`right_click` gerçek `contextmenu` event'i atmıyor; hızlı `type` bazen React render'ından önce
gidiyor (kontrolü ayrı bir çağrıda yap).

---

## 4. Miro parite borcu

Hedef %95. Aşağıdaki liste "Miro'da var, bizde yok" davranışlarıdır; bir madde kapandığında
buradan silinir. Sıra öncelik sırasıdır.

### Tuval içi (parite için şart)

- [ ] Sticky ızgarasına yapışma (sürüklerken kümenin kafesine oturma; "ızgaraya diz" hazır)
- [ ] Yorumlarda mention (@kişi) ve bildirim
- [ ] Tabloda sütun/satır genişliğini sürükleyerek değiştirme ve hücre birleştirme
- [ ] Mind map aracı (otomatik yerleşim, dal ekleme)
- [ ] Connector üzerinde birden çok etiket
- [ ] Embed: video, iframe, harici doküman
- [ ] Emoji ve reaksiyon
- [ ] Dokunmatik: tablet ve trackpad jestlerinin tam desteği
- [ ] Frame panelinde sürükleyerek sıralama, sunumda geçişler
- [ ] PDF dışa aktarma ve çoklu frame dışa aktarma
- [ ] İçeri aktarma: görsel, PDF, mevcut Miro board'u

### Çoklu kullanıcı

- [ ] Gerçek zamanlı ortak çalışma doğrulaması (sunucu var, test edilmedi)
- [ ] Follow mode / spotlight
- [ ] İmleç sohbeti
- [ ] Oylama, zamanlayıcı, tahmin (estimation) araçları
- [ ] Versiyon geçmişi

### Çevresi

- [ ] Giriş, workspace, board listesi/dashboard (Supabase fazı)
- [ ] Paylaşım linkleri, yetkiler, salt-görüntüleme modu
- [ ] Daha geniş şablon kütüphanesi

### Bilinçli olarak yapılmayacaklar

Miro'da var ama bizim kapsamımız dışında: AI asistanı, Jira/Azure gibi üçüncü parti kart
entegrasyonları (kendi Kanban'ımıza bağlanacak), video konferans, ödeme/faturalama.

---

## 5. Yol haritası

1. Yukarıdaki tuval içi borçları kapat (parite önce gelir)
2. Supabase fazı — auth, board listesi, Storage'a görsel, Postgres'e snapshot
3. Çoklu kullanıcı testi ve sertleştirme
4. Workspace çekirdeği (bkz. §1) — sonra doküman/blok editörü fazı
