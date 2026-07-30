# Tuval — DESIGN

Kaynak: `src/board/brand.ts` (tokenlar), `src/board/types.ts` (palet), `src/index.css` (tema).
Bu dosya koddan belgelenmiştir; token değişince burası da güncellenir.

## Renk stratejisi

**Restrained.** Tinted nötrler + tek pigment, yüzeyin %10'undan azında. Sebep: tuvaldeki içerik
zaten renklidir; kroma renk kullanırsa iki renk sistemi çarpışır. Pigment yalnızca birincil
eylem, aktif araç durumu, yorum pinleri ve hizalama guide'larında görünür.

Hiçbir nötr saf değildir; hepsi 84–92° civarında sıcak bir tona kırılmıştır (chroma 0.006–0.017).
Saf `#000` ve `#fff` kullanılmaz.

### Kroma (arayüz)

| Rol | Hex | OKLCH | Kullanım |
|---|---|---|---|
| paper | `#F2EFE9` | `oklch(0.953 0.009 84.6)` | Tuval zemini |
| surface | `#FCFBF8` | `oklch(0.988 0.005 85)` | Panel, popover, sticky düzenleme yüzeyi |
| wash | `#EBE7DE` | `oklch(0.929 0.013 86.8)` | Hover zemini, pasif dolgu |
| hairline | `#E2DED5` | `oklch(0.901 0.013 86.8)` | 1px ayırıcı ve kenarlık |
| ink | `#141310` | `oklch(0.187 0.006 91.7)` | Birincil metin, seçim kroması, logo |
| inkSoft | `#4A463E` | `oklch(0.395 0.014 84.6)` | İkincil metin |
| muted | `#8A867C` | `oklch(0.621 0.015 88.7)` | Üçüncül metin, ikon pasif |
| pigment | `#C8452D` | `oklch(0.570 0.171 32.6)` | Birincil buton, aktif araç, pin, guide |
| pigmentHover | `#A83621` | `oklch(0.498 0.153 32.6)` | Birincil buton hover |
| pigmentWash | `#F7E9E4` | `oklch(0.944 0.017 40.8)` | Aktif araç zemini |

### Palet (kullanıcı içeriği)

Guaj/pigment tonları. Doygunluk kasıtlı olarak düşük: birbirine yakın on iki renk yan yana
durduğunda neon tonlar okunmaz hale gelir, kırık tonlar durur.

`naples #F0E3B0` · `ochre #E8C55A` · `sienna #DE9A4E` · `terracotta #C8664A` · `rose #E7B7B4` ·
`mauve #B9718A` · `celadon #CBD79A` · `olive #8FA96B` · `verdigris #5E9A8A` ·
`cerulean #7FA5BE` · `prussian #3E5C93` · `lavender #8A7FB0` · `paper #EFEDE6` ·
`stone #C6C2B6` · `graphite #8A867C` · `ink #1F1D1A`

En koyu dört ton üzerinde metin otomatik olarak açık renge geçmez; kullanıcı `textColor`'ı
kendisi seçer. Palet sırası ton çemberini takip eder, rastgele değildir.

## Tema

**Açık.** Gerekçe cümlesi: *ürün ekibi öğleden sonra ofiste, 27 inç ekranda, toplantı odasında
projeksiyona yansıtarak veya ekran paylaşarak kullanıyor.* Bu sahne koyu temayı dışlar:
projeksiyonda koyu zemin yıkanır, kağıt yüzey durur. Koyu tema "araç olduğu için" eklenmez;
gerekirse gece çalışan tek kullanıcı senaryosu ayrıca gerekçelendirilir.

## Tipografi

- **Arayüz:** Space Grotesk 400/600/700. Grotesk karakteri müze katalog sesini taşır.
- **Tuval metni:** Instrument Sans 400/700 — küçük puntoda ve rotasyon altında daha okunur.
- Ölçek: 10 / 11 / 12 / 13 / 14 / 20 px arayüzde; tuvalde `FONT_SIZES` 8→288 px.
- Satır yüksekliği tuvalde `1.28` (`LINE_HEIGHT`), arayüzde Tailwind varsayılanı.
- Hiyerarşi ağırlık + boyutla kurulur, renkle değil. Panel başlıkları 12px/600, gövde 14px/400.
- Gövde metni 65–75ch ile sınırlanır (yorum thread'i, doküman fazı).

## Yükseklik ve kenar

Gölge tek bir aileden gelir, sıcak siyaha kırıktır:

- Panel/toolbar: `0 4px 16px rgba(20,19,16,0.12)` + `1px` `rgba(0,0,0,0.05)` kenar
- Popover/menü: `0 8px 28px rgba(20,19,16,0.16–0.18)`
- Sticky (tuvalde): `blur 6, offsetY 3, rgba(20,19,16,0.18)` — kağıdın masadan kalkması
- Yarıçap: arayüzde 8px (`rounded-lg`), kapsayıcıda 12px (`rounded-xl`), araç çubuğunda 16px

## Hareket

- Sadece `opacity`, `transform` ve `background-color` animasyonlanır; layout özellikleri asla.
- Easing ease-out-quart ailesi. Bounce/elastic yok.
- Tuvalde animasyon yoktur: sürükleme ve zoom doğrudan takip eder, araya lerp girmez. Gecikme
  bu üründe hatadır.

## Bileşen kuralları

- **Kart yasağı geçerli.** Panel içi listeler kartsızdır: satır + hairline. İç içe kart yok.
- **IconButton** 36×36, 8px yarıçap, aktifken `pigmentWash` zemin + `pigment` ikon.
- **Popover** her zaman bir tetikleyiciye çapalı, `pointerdown` dışarı ve `Escape` ile kapanır.
- **Modal yok.** Onay gereken tek yer board temizleme; o da native `confirm`.
- Seçim kroması: beyaz hale (`width+2`) + mürekkep kontur. Her dolgu üzerinde okunur.
- Tutamaklar 9px kare, `surface` dolgu + mürekkep 1.5px kenar; kenar tutamakları 7px.

## AI slop kontrolü

Bu tasarım şu refleksleri kasten reddeder:

- Kategori refleksi: "beyaz tahta aracı → elektrik mavisi + oyuncul yuvarlaklık"
- İkinci derece refleks: "Miro olmasın → o zaman koyu Figma estetiği"
- Yasaklar: yan şerit kenarlık, gradyan metin, dekoratif cam, kahraman-metrik bloğu, aynı
  boyutta ikon-başlık-metin kart ızgarası, ilk çare modal
