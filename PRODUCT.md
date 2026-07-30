# Tuval — PRODUCT

**register: product**

Uygulama yüzeyi (tuval, araç çubukları, paneller) product register'dır: tasarım ürüne hizmet
eder, kendisi ürün değildir. Landing sayfası, dokümantasyon sitesi ve kampanya yüzeyleri
brand register'dır ve ayrı ele alınır.

## Ürünün amacı

**Birincil hedef: Miro'yu işlevsel olarak %95 oranında klonlamak ve şirket içinde kullanmak.**
Ölçüt şudur: Miro'da yapılan bir işi burada da, aynı akışla, aynı kısayollarla, aynı hissiyatla
yapabilmek. Eksik kalan her davranış bir borçtur ve listelenir. Özellik paritesi her zaman
görsel süslemenin önündedir.

İkincil hedef: aynı kod tabanını açık kaynak olarak yayınlamak. Görsel kimliğin (renk, logo,
tipografi, palet) bize ait olmasının **tek sebebi budur** — işlev kopyalanır, marka kopyalanmaz.
Bu, özellik paritesi hedefini gevşetmez.

Uzun vade: tek bir çalışma alanının üç görünümünden biri olmak — pano (Kanban), doküman
(Notion tarzı), tuval (bu depo). Aynı kayıt üç görünümde de açılır; tuvaldeki bir fikir tek
hareketle göreve veya dokümana dönüşür. Motivasyon: Miro, Jira ve Notion aboneliklerine ödenen
paradan kurtulmak.

## Kullanıcılar

- **Küçük yazılım ekipleri** — sprint planlama, retro, mimari çizim, akış şeması. Günde saatlerce
  değil, haftada birkaç yoğun oturum kullanır. Ekran: 13–27 inç, ofis veya ev ışığı, gündüz.
- **Freelancer ve danışmanlar** — müşteri sunumu, atölye, fikir haritası. Ekranı paylaşırken
  arayüzün geri çekilmesi gerekir.
- **Self-host eden teknik kullanıcı** — projeyi kendi sunucusuna kurar. Kurulumun ve veri
  sahipliğinin anlaşılır olmasını bekler.

Ortak nokta: hiçbiri "tasarım aracı" kullanmıyor, hepsi **düşünmek için yüzey** arıyor.

## Marka sesi

**Çağdaş sanat müzesi.** Sakin kabuk, tek pigment vurgusu, editoryal tipografi, cömert boşluk.
Arayüz kendini göstermez; içerik boyalı yüzeydir, kroma mürekkeple çizilmiş bir çerçevedir.

Ton: sade, kesin, gösterişsiz. Emir kipi yerine düz ifade. Ünlem yok, "harika!" yok, emoji yok.
Türkçe arayüz dili; teknik terimler (frame, sticky, connector) İngilizce kalır.

## Anti-referanslar

Bunlara benzemek başarısızlıktır:

- **Miro / FigJam** — elektrik mavisi kroma, sarı marka blokları, oyuncul yuvarlaklık. Yasal
  sebeple de kaçınılıyor: görsel kimlik kopyalanmaz.
- **Genel SaaS şablonu** — mor gradyanlar, cam kartlar, dev sayı + küçük etiket kahraman bloğu,
  aynı boyutta ikon-başlık-metin kart ızgaraları.
- **Geliştirici-koyu refleksi** — "araç, o zaman koyu tema" varsayımı. Bu ürün gündüz ve ekran
  paylaşımında kullanılıyor; kağıt yüzey doğru cevap.
- **Neon / cyberpunk tuval** — Figma-benzeri koyu editör estetiği.

## Stratejik ilkeler

1. **Kroma sessiz, içerik yüksek sesli.** Renk kullanıcının koyduğu şeydedir. Arayüz kağıt,
   mürekkep ve tek pigmentten ibarettir.
2. **Etkileşim doğruluğu görsel şıklığın önünde.** Yanlış resize matematiği veya kaçan bir
   `pointerup`, hiçbir animasyonun telafi edemeyeceği bir kusurdur.
3. **Klavye birinci sınıf.** Her sık işlemin kısayolu var; fare gerekliliği bir hatadır.
4. **Local-first.** IndexedDB'de çalışır, sunucu opsiyoneldir. Ağ yoksa ürün yaşar.
5. **Klonlama değil bağlama.** n8n, Meet, Drive, Figma gibi ağır alanlar entegre edilir,
   yeniden yazılmaz. Değer parçalar arasındaki bağda.
6. **Tek satırlık marka.** Ürün adı ve renk tokenları `src/board/brand.ts`'te; fork eden biri
   kendi markasına tek dosyada geçebilmeli.

## Kırmızı çizgiler

- Ticari bir üründen renk paleti, logo, ikon seti, pazarlama metni veya kod kopyalanmaz.
- README ve site metninde "X klonu" denmez; "açık kaynak sonsuz tuval" denir.
- Kod içine açıklayıcı yorum yazılmaz; sadece `// TODO:`.
