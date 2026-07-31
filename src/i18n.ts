export type Lang = 'en' | 'tr'

export const LANGS: { id: Lang; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'tr', name: 'Türkçe' },
]

const KEY = 'tuval:lang'

const tr: Record<string, string> = {
  // top bar
  'Board name': 'Board adı',
  'item': 'öğe',
  'items': 'öğe',
  'frame': 'frame',
  'frames': 'frame',
  'Board menu': 'Board menüsü',
  'Frame panel': 'Frame paneli',
  'Version history': 'Sürüm geçmişi',
  'Download PNG': 'PNG indir',
  'Print frames as PDF': 'Frame\'leri PDF yazdır',
  'Surface': 'Zemin',
  'Texture': 'Doku',
  'Language': 'Dil',
  'Clear board': 'Board\'u temizle',
  'Delete everything on this board?': 'Board\'daki her şey silinsin mi?',
  'Search — ⌘F': 'Ara — ⌘F',
  'Copy link': 'Bağlantıyı kopyala',
  'Present': 'Sunum',
  'At least one frame is needed to present.': 'Sunum için en az bir frame gerekiyor.',
  'At least one frame is needed for PDF.': 'PDF için en az bir frame gerekiyor.',

  // surfaces
  'Paper': 'Kağıt',
  'Whitewash': 'Badana',
  'Sand': 'Kum',
  'Linen': 'Keten',
  'Clay': 'Kil',
  'Celadon': 'Seladon',
  'Mist': 'Sis',
  'Grey board': 'Gri karton',
  'Blueprint': 'Mavi baskı',
  'Slate': 'Kara tahta',

  // textures
  'Registration': 'Tescil',
  'Dots': 'Nokta',
  'Grid': 'Kareli',
  'Ruled': 'Çizgili',
  'Plain': 'Düz',

  // tools
  'Undo': 'Geri al',
  'Redo': 'İleri al',
  'Select': 'Seç',
  'Sticky': 'Sticky',
  'Text': 'Metin',
  'Shape': 'Şekil',
  'Connector': 'Bağlantı',
  'Pen': 'Kalem',
  'Table': 'Tablo',
  'Mind map': 'Zihin haritası',
  'Frame': 'Frame',
  'Comment': 'Yorum',
  'Code block': 'Kod bloğu',
  'Templates': 'Şablonlar',
  'Image': 'Görsel',
  'Upload image': 'Görsel yükle',
  'Upload image or PDF': 'Görsel veya PDF yükle',
  'Only the first {n} pages were placed; {skipped} more are in the file.':
    'Yalnızca ilk {n} sayfa yerleştirildi; dosyada {skipped} sayfa daha var.',
  'More': 'Daha fazla',
  'Minimap': 'Minimap',
  'Fit to content': 'İçeriğe sığdır',
  'Zoom': 'Zoom',
  'Zoom out': 'Uzaklaş',
  'Zoom in': 'Yakınlaş',
  'Eraser': 'Silgi',
  'Highlighter': 'Fosforlu',
  'Drawing': 'Çizim',
  'Embed': 'Gömülü',

  // dock settings
  'Dock settings (right click)': 'Dock ayarları (sağ tık)',
  'Position': 'Konum',
  'Bottom': 'Alt',
  'Top': 'Üst',
  'Left': 'Sol',
  'Right': 'Sağ',
  'Size': 'Boyut',
  'Magnifier': 'Büyüteç',
  'Visible tools': 'Görünen araçlar',
  'Reset to default': 'Varsayılana dön',
  'On': 'Açık',
  'Off': 'Kapalı',

  // inspector
  'Fill': 'Dolgu',
  'Line': 'Çizgi',
  'Opacity': 'Opaklık',
  'Sticky size': 'Sticky boyutu',
  'Fit to text': 'Metne sığdır',
  'Layout': 'Düzen',
  'Code': 'Kod',
  'Light theme': 'Açık tema',
  'Dark theme': 'Koyu tema',
  'Line numbers': 'Satır numarası',
  'Bold': 'Kalın',
  'Italic': 'İtalik',
  'Underline': 'Altı çizili',
  'Strikethrough': 'Üstü çizili',
  'Bring forward': 'Öne getir',
  'Send backward': 'Arkaya gönder',
  'Lock': 'Kilitle',
  'Unlock': 'Kilidi aç',
  'Duplicate': 'Çoğalt',
  'Delete': 'Sil',
  'Align': 'Hizala',

  // search
  'Search the board…': 'Board içinde ara…',
  'No results': 'Sonuç yok',
  'navigate': 'gez',
  'go': 'git',
  'go, keep open': 'git, açık kal',

  // collaborators
  'people on this board': 'kişi bu board\'da',
  'On the board': 'Board\'da',
  'people': 'kişi',
  '(you)': '(sen)',
  'following': 'takipte',
  'follow': 'takip et',
  'Stop following': 'Takibi bırak',

  // handoff
  'Hand off to AI': 'AI\'ya devret',
  'Open in {app}': '{app}\'da aç',
  'Copy prompt': 'Prompt\'u kopyala',
  'Download Markdown': 'Markdown indir',
  'Download JSON': 'JSON indir',
  'Whole board': 'Tüm board',
  'Selection ({n})': 'Seçim ({n})',
  'Prompt copied. Paste it into Claude Code, Cursor or Codex.':
    'Prompt panoya kopyalandı. Claude Code, Cursor veya Codex\'e yapıştır.',
  'Board is too large for a URL — the prompt was copied, paste it into the chat.':
    'Board bir URL için fazla büyük — prompt panoya kopyalandı, sohbete yapıştır.',
  'Frames become sections, arrows become a mermaid flow, code blocks become fenced code. Reading order is top to bottom, left to right.':
    'Frame\'ler bölüme, oklar mermaid akışına, kod blokları fenced code\'a dönüşür. Okuma sırası yukarıdan aşağı, soldan sağa.',

  // comments
  'No comments yet. Drop a pin with the comment tool.':
    'Henüz yorum yok. Yorum aracıyla tuvale pin bırak.',
  'No open comments.': 'Açık yorum yok.',
  'Mark resolved': 'Çözüldü işaretle',
  'Reopen': 'Yeniden aç',
  'Hide resolved': 'Çözülmüşleri gizle',
  'Show resolved ({n})': 'Çözülmüşleri göster ({n})',
  'just now': 'az önce',
  'now': 'şimdi',
  '{n} min ago': '{n} dk önce',
  '{n} h ago': '{n} sa önce',

  // history
  'Saved version': 'Kaydedilen sürüm',
  'Version name': 'Sürüm adı',
  'Checkpoint': 'Kontrol noktası',
  'Restore version "{name}"? The current state is saved first.':
    '"{name}" sürümüne dönülsün mü? Şu anki hâl önce kaydedilir.',

  // context menu
  'Paste style': 'Stili yapıştır',
  'Select frame contents': 'Frame içindekileri seç',
  'Reset bends': 'Kırılmaları sıfırla',
  'Export as PNG': 'PNG olarak dışa aktar',
  'Open link': 'Bağlantıyı aç',
  '⌘click': '⌘tık',

  // embed
  'Link to embed (YouTube, Vimeo, Loom, Figma or any site)':
    'Gömülecek bağlantı (YouTube, Vimeo, Loom, Figma veya herhangi bir site)',

  // templates
  'Customer journey': 'Müşteri yolculuğu',
  'Stages against what people do, think and struggle with':
    'Aşamalara karşı: ne yapıyor, ne düşünüyor, nerede zorlanıyor',
  'Aware': 'Fark etme',
  'Consider': 'Değerlendirme',
  'Sign up': 'Kayıt',
  'First use': 'İlk kullanım',
  'Return': 'Geri dönüş',
  'Actions': 'Yaptıkları',
  'Thoughts': 'Düşündükleri',
  'Pain points': 'Zorlandıkları',
  'Architecture': 'Mimari',
  'Services and what travels between them': 'Servisler ve aralarında ne gidip geliyor',
  'Browser': 'Tarayıcı',
  'API': 'API',
  'Background worker': 'Arka plan işçisi',
  'Database': 'Veritabanı',
  'Object storage': 'Nesne deposu',
  'queue': 'kuyruk',
  'writes': 'yazar',
  'Five whys': 'Beş neden',
  'Follow a symptom down to what actually caused it':
    'Belirtiden gerçek sebebe kadar in',
  'What went wrong': 'Ne ters gitti',
  'Root cause': 'Kök neden',
  'why?': 'neden?',
  'Yes path': 'Evet yolu',
  'Untitled board': 'Adsız board',
  'Flowchart': 'Akış şeması',
  'Start → decision → outcome': 'Başlangıç → karar → sonuç',
  '4×3 idea grid': '4×3 fikir ızgarası',
  'Start': 'Başlangıç',
  'End': 'Bitiş',
  'Condition?': 'Koşul?',
  'No path': 'Hayır yolu',
  'Solution': 'Çözüm',
  'Before going back': 'Geri dönmeden önce',
  'User interviews': 'Kullanıcı görüşmeleri',
  'Pricing page': 'Fiyatlandırma sayfası',
  'Users': 'Kullanıcılar',
  'Onboarding flow': 'Onboarding akışı',

  // agent export
  'Outside frames': 'Frame dışı',
  'Flow': 'Akış',
  'Comments': 'Yorumlar',
  '(empty {kind})': '(boş {kind})',
  'On "{name}"': '"{name}" üzerinde',
  'Free': 'Serbest',
  'Infinite canvas export · {items} items · {frames} frames · {edges} connections':
    'Sonsuz tuval dışa aktarımı · {items} öğe · {frames} frame · {edges} bağlantı',
  // dock extras
  'Open frame panel': 'Frame panelini aç',
  'Embed a link': 'Bağlantı göm',
  'Frame size': 'Frame boyutu',
  'Drag tools to reorder them.': 'Araçları sürükleyerek sıralayabilirsin.',

  // inspector extras
  'Thickness': 'Kalınlık',
  'Light': 'Açık',
  'Dark': 'Koyu',
  'Add row': 'Satır ekle',
  'Add column': 'Sütun ekle',
  'Remove row': 'Satır sil',
  'Remove column': 'Sütun sil',
  'Cell': 'Hücre',
  'Labels': 'Etiketler',
  'Main label': 'Ana etiket',
  'Label': 'Etiket',
  'Add label': 'Etiket ekle',
  'Merge right': 'Sağa birleştir',
  'Merge down': 'Aşağı birleştir',
  'Split': 'Ayır',
  'Header row': 'Başlık satırı',
  'Distribute horizontally': 'Yatayda eşit dağıt',
  'Distribute vertically': 'Dikeyde eşit dağıt',
  'Align left': 'Sola',
  'Align right': 'Sağa',
  'Align top': 'Üste',
  'Align bottom': 'Alta',
  'Center horizontally': 'Yatay ortala',
  'Center vertically': 'Dikey ortala',

  // panels
  'Versions': 'Sürümler',
  'Save current state': 'Şu anki hâli kaydet',
  'No versions yet. The board is also saved automatically every 10 minutes.':
    'Henüz sürüm yok. Board her 10 dakikada bir kendiliğinden de kaydedilir.',
  'Restore this version': 'Bu sürüme dön',
  'Start presentation': 'Sunumu başlat',
  'Print as PDF': 'PDF olarak yazdır',
  'No frames yet. Use the frame tool in the dock.':
    'Henüz frame yok. Dock\'taki frame aracını kullan.',
  'Double click to rename': 'Çift tıkla: yeniden adlandır',
  'Move up': 'Yukarı taşı',
  'Move down': 'Aşağı taşı',
  'Double click to use the content': 'Çift tıkla: içeriği kullan',
  'Exit': 'Çıkış',
  'Say something…': 'Bir şey söyle…',
  'Participant': 'Katılımcı',
  'Send': 'Gönder',
  'resolved': 'çözüldü',
  'replies': 'yanıt',
  '(empty)': '(boş)',

  // templates
  'Problem': 'Sorun',
  'Risks': 'Riskler',
  'Metrics': 'Metrikler',

  // agent brief
  'The content below was exported from an infinite canvas board. Frames are sections, bullets are items on the canvas (reading order: top to bottom, left to right), and the mermaid graph under "Flow" represents the arrows between items. First summarise in one paragraph what is being asked for, then break it into concrete steps.':
    'Aşağıdaki içerik bir sonsuz tuval board\'ından dışa aktarıldı. Frame\'ler bölüm, madde işaretleri tuvaldeki öğeler (okuma sırası: yukarıdan aşağı, soldan sağa), "Akış" bölümündeki mermaid grafiği öğeler arasındaki okları temsil eder. Önce ne yapılmak istendiğini bir paragrafta özetle, sonra somut adımlara dök.',
  // brief import
  'Build a board from a brief': 'Brief\'ten board oluştur',
  'Paste Markdown or JSON here. Headings become frames, bullets become stickies, fenced code becomes code blocks, a mermaid flow becomes connectors.':
    'Markdown veya JSON yapıştır. Başlıklar frame, maddeler sticky, fenced code kod bloğu, mermaid akışı bağlantı olur.',
  'Paste an example': 'Örnek yapıştır',
  'Nothing to read yet': 'Okunacak bir şey yok',
  'connections': 'bağlantı',
  'Create': 'Oluştur',
  // sticky status
  'Status': 'Durum',
  'Idea': 'Fikir',
  'Question': 'Soru',
  'Doing': 'Yapılıyor',
  'Blocked': 'Engelli',
  'Decision': 'Karar',
  'Done': 'Bitti',
  'None': 'Yok',
  'Frame name': 'Frame adı',
  'Label size': 'Etiket boyutu',
  'Auto': 'Oto',
  'Main idea': 'Ana fikir',
  'Add child': 'Alt dal',
  'Add sibling': 'Kardeş dal',
  'Tidy layout': 'Yerleşimi düzelt',
  'Assigned to': 'Atanan',
  'Owner': 'Sahip',
  // boards
  'Boards': 'Board\'lar',
  'New board': 'Yeni board',
  'Filter boards': 'Board ara',
  'No boards yet': 'Henüz board yok',
  'Delete board': 'Board\'u sil',
  'Move to trash': 'Çöp kutusuna taşı',
  'Copying the board and its images…': 'Board ve görselleri kopyalanıyor…',
  'Trash': 'Çöp kutusu',
  'Restore': 'Geri getir',
  'Delete for good': 'Kalıcı sil',
  'Emptied automatically after {n} days. Until then a board here can be brought back exactly as it was.':
    '{n} gün sonra kendiliğinden boşalır. O zamana kadar buradaki bir board olduğu gibi geri getirilebilir.',
  'Delete "{name}" for good? This cannot be undone.':
    '"{name}" kalıcı olarak silinsin mi? Bu geri alınamaz.',
  'never opened': 'hiç açılmadı',
  '{n} d ago': '{n} gün önce',
  'Open another board before deleting this one.':
    'Bunu silmek için önce başka bir board aç.',
  'Delete "{name}" from this browser? This cannot be undone.':
    '"{name}" bu tarayıcıdan silinsin mi? Geri alınamaz.',
  'Boards live in this browser. Share the link to let someone else open one.':
    'Board\'lar bu tarayıcıda tutulur. Başkasının açması için linki paylaş.',
  'Write a comment…': 'Yorum yaz…',
  'Close': 'Kapat',
  'Snap to grid': 'Izgaraya diz',
  'Sticky colour': 'Sticky rengi',
  'Emoji': 'Emoji',
  'Hex': 'Hex',
  // account
  'Sign in': 'Giriş yap',
  'Sign out': 'Çıkış yap',
  'Send link': 'Bağlantı gönder',
  'Sending…': 'Gönderiliyor…',
  'Check {email} for a sign-in link.': 'Giriş bağlantısı için {email} adresine bak.',
  'Your boards are saved to the cloud and reachable from any device.':
    'Board\'ların buluta kaydediliyor ve her cihazdan erişilebiliyor.',
  'First time with an address: leave the password empty, confirm the link we email you, then pick a password. Without signing in Tuval keeps working, but boards stay in this browser only.':
    'Bir adresle ilk girişte parolayı boş bırak, e-postana gelen bağlantıyı onayla, sonra bir parola seç. Giriş yapmadan da Tuval çalışır ama board\'lar yalnızca bu tarayıcıda kalır.',
  'That sign-in link no longer works: {reason}. Links are single use and they expire, so ask for a fresh one below.':
    'Bu giriş bağlantısı artık geçerli değil: {reason} Bağlantılar tek kullanımlıktır ve süresi dolar. Aşağıdan yenisini iste.',
  'Open a file': 'Dosya aç',
  'skipped': 'atlandı',
  // home
  'Home': 'Anasayfa',
  'Workspace': 'Çalışma alanı',
  'Issues': 'İşler',
  'Docs': 'Dokümanlar',
  'New page': 'Yeni sayfa',
  'Untitled page': 'Adsız sayfa',
  'Write, or press # for a heading and - for a list':
    'Yaz; başlık için #, liste için - kullan',
  'No pages yet. A page is a record like anything else: it has a title you can search for, and a body two people can write at once.':
    'Henüz sayfa yok. Sayfa da diğerleri gibi bir kayıt: aranabilir bir başlığı ve iki kişinin aynı anda yazabildiği bir gövdesi var.',
  'Issue': 'İş',
  'list': 'liste',
  'board': 'pano',
  'Assignee': 'Atanan',
  'Priority': 'Öncelik',
  'Due': 'Bitiş',
  'none': 'yok',
  'low': 'düşük',
  'medium': 'orta',
  'high': 'yüksek',
  'Untitled': 'Adsız',
  'Work': 'İş',
  'Turn into an issue': 'İşe çevir',
  'Turn {n} into issues': '{n} tanesini işe çevir',
  'It keeps its place on the board and turns up in the issue list, because it is the same thing in two views.':
    'Board\'daki yerinde kalır ve iş listesinde de görünür; iki görünümdeki aynı şey çünkü.',
  'Open in issues': 'İşlerde aç',
  'Settings': 'Ayarlar',
  'Press ⌘K for anything': 'Her şey için ⌘K',
  'Write an issue and press enter': 'Bir iş yaz ve enter\'a bas',
  'Nobody': 'Kimse',
  'Archive': 'Arşivle',
  'Open': 'Aç',
  'Pages': 'Sayfalar',
  'Make a template': 'Şablon yap',
  'Template': 'Şablon yap',
  'From a template': 'Şablondan',
  'A template': 'Şablon',
  'New page from a template': 'Şablondan yeni sayfa',
  'New row from a template': 'Şablondan yeni satır',
  'Export': 'Dışa aktar',
  'Exporting…': 'Aktarılıyor…',
  'Markdown': 'Markdown',
  'History': 'Geçmiş',
  'Save this version': 'Bu sürümü kaydet',
  'block': 'blok',
  'blocks': 'blok',
  'No versions yet. One is kept whenever you come back to a page you have written in.':
    'Henüz sürüm yok. Yazdığın bir sayfaya geri döndüğünde biri saklanır.',
  'Copying…': 'Kopyalanıyor…',
  'In the text': 'Metinde',
  'Related to this': 'Buna bağlı olanlar',
  'Emptied automatically after {n} days. Until then a page here can be brought back exactly as it was.':
    '{n} gün sonra otomatik boşaltılır. O zamana kadar buradaki bir sayfa aynen geri getirilebilir.',
  'Add a cover': 'Kapak ekle',
  'Remove cover': 'Kapağı kaldır',
  'Uploading…': 'Yükleniyor…',
  'relation': 'ilişki',
  'formula': 'formül',
  'rollup': 'toplama',
  'count': 'kaç tane',
  'sum': 'toplam',
  'average': 'ortalama',
  'range': 'aralık',
  'show': 'göster',
  'Through which relation?': 'Hangi ilişki üzerinden?',
  'prop("Name") reads a column. || joins text, ? : chooses. Also empty, text, number, today, days, round, abs, min, max.':
    'prop("Ad") bir sütunu okur. || metni birleştirir, ? : seçer. Ayrıca empty, text, number, today, days, round, abs, min, max.',
  'Pick a database': 'Bir veritabanı seç',
  'Find a row': 'Satır bul',
  'That database has no rows yet.': 'O veritabanında henüz satır yok.',
  'Gallery': 'Galeri',
  'Calendar': 'Takvim',
  'Place by…': 'Şuna göre yerleştir…',
  'Previous month': 'Önceki ay',
  'Next month': 'Sonraki ay',
  'Today': 'Bugün',
  'A calendar places rows by a date column. Add one, then choose it above.':
    'Takvim, satırları bir tarih sütununa göre yerleştirir. Bir tane ekle, sonra yukarıdan seç.',
  'Filter': 'Filtre',
  'Sort': 'Sırala',
  'No sort': 'Sıralama yok',
  'Remove filter': 'Filtreyi kaldır',
  'value': 'değer',
  'descending': 'azalan',
  'contains': 'içeriyor',
  'is': 'eşittir',
  'is not': 'eşit değildir',
  'is not empty': 'dolu',
  'is more than': 'şundan büyük',
  'is less than': 'şundan küçük',
  'is before': 'şundan önce',
  'is after': 'şundan sonra',
  'is checked': 'işaretli',
  'is not checked': 'işaretsiz',
  '{n} hidden by filters': '{n} tanesi filtreyle gizlendi',
  'Untitled database': 'Adsız veritabanı',
  'New database': 'Yeni veritabanı',
  'New row': 'Yeni satır',
  'Add a column': 'Sütun ekle',
  'Delete column': 'Sütunu sil',
  'Find or create': 'Bul veya oluştur',
  'Clear': 'Temizle',
  'No value': 'Değersiz',
  'No grouping': 'Gruplama yok',
  'Group by…': 'Şuna göre grupla…',
  'Remove view': 'Görünümü kaldır',
  'Name': 'Ad',
  'Field': 'Alan',
  'text': 'metin',
  'number': 'sayı',
  'select': 'seçim',
  'date': 'tarih',
  'checkbox': 'kutu',
  'person': 'kişi',
  'url': 'bağlantı',
  'row': 'satır',
  'rows': 'satır',
  'a row is a page: open one to write in it': 'her satır bir sayfa: içine yazmak için aç',
  'A board groups rows by a select column. Add one, then choose it above.':
    'Pano, satırları bir seçim sütununa göre gruplar. Bir tane ekle, sonra yukarıdan seç.',
  'Search': 'Ara',
  'Frequently used': 'Sık kullanılan',
  'Add an icon': 'İkon ekle',
  'Remove icon': 'İkonu kaldır',
  'Linked from': 'Buraya bağlananlar',
  'New page: {title}': 'Yeni sayfa: {title}',
  'Page': 'Sayfa',
  'Go to docs': 'Dokümanlara git',
  'Find a page, an issue, or write one': 'Sayfa veya iş bul, ya da yaz',
  'Recently edited': 'Son düzenlenenler',
  'No pages yet': 'Henüz sayfa yok',
  'Add a page inside': 'İçine sayfa ekle',
  'Inside this page': 'Bu sayfanın içinde',
  'Breadcrumb': 'Yol',
  'Collapse': 'Kapat',
  'Expand': 'Aç',
  'What needs doing, and what done looks like': 'Ne yapılacak ve bitti neye benziyor',
  'all': 'hepsi',
  'todo': 'yapılacak',
  'doing': 'yapılıyor',
  'blocked': 'engelli',
  'done': 'bitti',
  'cancelled': 'iptal',
  'Nothing with that status.': 'Bu durumda bir şey yok.',
  'No issues yet. They live in the workspace, not on a board, so they are here whichever board you were last in.':
    'Henüz iş yok. İşler board\'da değil çalışma alanında yaşar; en son hangi board\'da olduğunun bir önemi yok.',
  'Go to boards': 'Board\'lara git',
  'Go to issues': 'İşlere git',
  'Go to settings': 'Ayarlara git',
  'New issue: {title}': 'Yeni iş: {title}',
  'Search, or write an issue': 'Ara, ya da bir iş yaz',
  'Nothing matches': 'Eşleşen yok',
  'Workspace name': 'Çalışma alanı adı',
  'Everyone here can open the boards in this workspace. A board can still be hidden from the team or opened to a guest from its own Share menu.':
    'Buradaki herkes bu çalışma alanındaki board\'ları açabilir. Bir board yine de kendi Paylaş menüsünden ekipten gizlenebilir veya bir konuğa açılabilir.',
  'Remove from workspace': 'Çalışma alanından çıkar',
  'Invited {email}. They join when they sign in with that address.':
    '{email} davet edildi. O adresle giriş yapınca katılır.',
  'admin': 'yönetici',
  'member': 'üye',
  'guest': 'konuk',
  'Something broke': 'Bir şey bozuldu',
  'This part of the page stopped working.': 'Sayfanın bu kısmı çalışmayı durdurdu.',
  'Your board is not affected. It is kept in this browser and, when you are signed in, on the server as well.':
    'Board\'un etkilenmedi. Bu tarayıcıda, giriş yaptıysan sunucuda da duruyor.',
  'Reload': 'Yeniden yükle',
  'Account': 'Hesap',
  'Account settings': 'Hesap ayarları',
  'Profile': 'Profil',
  'This is the name and face the rest of your team sees on a board.':
    'Board\'da ekibin geri kalanının gördüğü ad ve resim bu.',
  'Your name': 'Adın',
  'Change': 'Değiştir',
  'Save': 'Kaydet',
  'Saved': 'Kaydedildi',
  'This account has no password yet, so an emailed link is the only way in.':
    'Bu hesabın henüz parolası yok, tek giriş yolu e-postayla gelen bağlantı.',
  'Connect a provider here rather than signing in with it: an account is chosen, not guessed.':
    'Sağlayıcıyı girişte değil burada bağla: hesap tahmin edilmez, seçilir.',
  'Signing out': 'Çıkış',
  'Boards stay in the cloud; this browser simply forgets who you are.':
    'Board\'lar bulutta kalır; bu tarayıcı sadece kim olduğunu unutur.',
  'Sign-in methods': 'Giriş yöntemleri',
  'Connect {name}': '{name} bağla',
  'Disconnect': 'Bağlantıyı kes',
  'Email': 'E-posta',
  'This is the only way you can sign in.': 'Giriş yapabildiğin tek yol bu.',
  'Create an account': 'Hesap oluştur',
  'No password to begin with: confirm the address by email, then choose one.':
    'Başlarken parola yok: adresi e-postayla doğrula, sonra bir tane seç.',
  'Your boards follow you to any device.': 'Board\'ların her cihazda peşinden gelir.',
  'Reset your password': 'Parolanı sıfırla',
  'We email a link that lets you set a new one.':
    'Yeni bir tane belirlemeni sağlayan bir bağlantı gönderiyoruz.',
  'Choose a new password': 'Yeni bir parola seç',
  'You are signed in from the link. Pick a password and it is done.':
    'Bağlantıyla giriş yapmış durumdasın. Bir parola seç, bitti.',
  'Check {email} for a link. It works once and expires.':
    '{email} adresine bir bağlantı gönderdik. Tek kullanımlık ve süresi doluyor.',
  'Forgot your password?': 'Parolanı mı unuttun?',
  'I already have an account': 'Zaten hesabım var',
  'Back to sign in': 'Girişe dön',
  'Without an account Tuval still works: boards live in this browser and nothing leaves it.':
    'Hesapsız da Tuval çalışır: board\'lar bu tarayıcıda durur ve hiçbir şey dışarı çıkmaz.',
  'Signing in did not go through: {reason}': 'Giriş tamamlanamadı: {reason}',
  'or': 'veya',
  'Finish setting up your account': 'Hesabını tamamla',
  'The email link confirmed {email}. Choose a password and you can sign in with it from now on.':
    'E-posta bağlantısı {email} adresini doğruladı. Bir parola belirle, bundan sonra onunla gir.',
  'Your session expired and could not be renewed. Sign in again.':
    'Oturumun süresi doldu ve yenilenemedi. Tekrar giriş yap.',
  'Open source infinite canvas': 'Açık kaynak sonsuz tuval',
  'Open a board': 'Board aç',
  'A surface for thinking,': 'Düşünmek için bir yüzey,',
  'that an agent can read.': 'ajanın okuyabildiği.',
  'This is the real editor, not a picture of one. Move something.':
    'Bu editörün resmi değil, kendisi. Bir şeyi tut ve oynat.',
  'Drag a sticky': 'Bir sticky sürükle',
  'Try me': 'Dene',
  'An idea lands here': 'Bir fikir buraya düşer',
  'Drag me anywhere': 'Beni istediğin yere sürükle',
  'Double click to write': 'Yazmak için çift tıkla',
  'Nothing here is saved. Sign in and it is your board.':
    'Burada hiçbir şey kaydedilmiyor. Giriş yap, board senin olsun.',
  'What is different': 'Farkımız',
  'Hand the board to an agent.': 'Board\'u bir ajana devret.',
  'Where it runs': 'Nerede çalışır',
  'On your own server, or on nobody’s.': 'Kendi sunucunda, ya da hiç kimsenin sunucusunda.',
  'How it is built': 'Nasıl kurulu',
  'One canvas, one document, no magic.': 'Tek tuval, tek doküman, sihir yok.',
  'Rendering': 'Render',
  'Document': 'Doküman',
  'Access': 'Erişim',
  'Licence': 'Lisans',
  'Read the source': 'Kaynağı oku',
  'No account needed to try it.': 'Denemek için hesap gerekmiyor.',
  // dashboard
  'In this browser': 'Bu tarayıcıda',
  'Not part of any account: these were made before signing in and stay with this browser whoever is signed in. Open one and it moves to the cloud under {email}.':
    'Hiçbir hesaba ait değil: giriş yapılmadan oluşturulmuşlar ve kim girerse girsin bu tarayıcıda kalırlar. Birini açtığında {email} hesabıyla buluta taşınır.',
  'These live in this browser. Sign in and they follow you to any device.':
    'Bunlar bu tarayıcıda duruyor. Giriş yaparsan her cihazda peşinden gelirler.',
  'Your boards': 'Board\'ların',
  'Good to see you, {name}': 'Hoş geldin, {name}',
  'Shared with you': 'Sana açılanlar',
  'no preview yet': 'önizleme yok',
  'is empty': 'boş',
  'Nothing here yet. A board is an endless sheet: drop a sticky, connect two of them, and hand the result to an agent when it is ready.':
    'Henüz bir şey yok. Board sonsuz bir kağıt: bir sticky bırak, ikisini birbirine bağla, hazır olunca sonucu bir ajana devret.',
  'These boards live in this browser only. Sign in and they follow you to any device.':
    'Bu board\'lar yalnızca bu tarayıcıda. Giriş yaparsan her cihazda peşinden gelirler.',
  // access
  'View only': 'Salt görüntüleme',
  'The owner shared this board with you as a viewer. Ask them for edit access.':
    'Sahibi bu board\'u sana görüntüleyici olarak açtı. Düzenleme için ondan yetki iste.',
  // guide
  '(guide)': '(rehber)',
  'Guidance': 'Yönlendirme',
  'Got it': 'Anladım',
  'Dismiss': 'Kapat',
  'Empty board': 'Boş board',
  'Press N and click the canvas to drop your first sticky.':
    'N tuşuna bas, tuvale tıkla, ilk sticky\'n düşsün.',
  'Two loose ideas': 'İki başıboş fikir',
  'L draws a connector. Drag from one item to another and the line follows them.':
    'L bağlayıcı çizer. Birinden diğerine sürükle, çizgi ikisini de takip eder.',
  'Getting crowded': 'Kalabalıklaşıyor',
  'F draws a frame. Frames become sections when you present or hand off.':
    'F bir frame çizer. Sunumda ve devretmede frame\'ler bölüm olur.',
  'Ready to build': 'Sıra yapmaya geldi',
  'This turns the board into a brief an AI agent can read and act on.':
    'Bu, board\'u bir AI ajanının okuyup uygulayabileceği brief\'e çevirir.',
  'This browser only': 'Yalnızca bu tarayıcıda',
  'Sign in and the board follows you to any device.':
    'Giriş yap, board her cihazda peşinden gelsin.',
  'Better with someone': 'Biriyle daha iyi',
  'Share emails a teammate a sign-in link straight to this board.':
    'Paylaş, ekip arkadaşına bu board\'a açılan bir giriş bağlantısı yollar.',
  'Password': 'Parola',
  'New password': 'Yeni parola',
  'Password (leave empty for a link)': 'Parola (boş bırakırsan bağlantı gelir)',
  'Save password': 'Parolayı kaydet',
  'Saving…': 'Kaydediliyor…',
  'At least 8 characters.': 'En az 8 karakter.',
  'The two passwords do not match.': 'İki parola birbirini tutmuyor.',
  'Again': 'Tekrar',
  'Password saved. Next time you can sign in with it.':
    'Parola kaydedildi. Bundan sonra onunla girebilirsin.',
  'Cloud': 'Bulut',
  'This browser': 'Bu tarayıcı',
  'Delete "{name}" for everyone? This cannot be undone.':
    '"{name}" herkes için silinsin mi? Geri alınamaz.',
  'Signed in: boards are saved to the cloud. Share the link to invite someone.':
    'Girişli: board\'lar buluta kaydediliyor. Davet için linki paylaş.',
  // sharing
  'Share': 'Paylaş',
  'Copied': 'Kopyalandı',
  'Invite': 'Davet et',
  'Send invite': 'Daveti gönder',
  'People': 'Kişiler',
  'Member': 'Üye',
  'Remove': 'Çıkar',
  'editor': 'düzenleyen',
  'viewer': 'görüntüleyen',
  'owner': 'sahip',
  'pending': 'bekliyor',
  'Sign in to invite people. Right now this board only exists in your browser.':
    'Davet için giriş yap. Şu an bu board yalnızca senin tarayıcında.',
  'An invited address gets access the moment it signs in. Send them the link too.':
    'Davet edilen adres giriş yaptığı anda erişim kazanır. Linki de yolla.',
  'Email again': 'Tekrar yolla',
  'Tuval board: {name}': 'Tuval board: {name}',
  'I have given you access to a board on Tuval.':
    'Tuval\'da bir board\'a erişimini açtım.',
  'Open the link and sign in with this address to see it.':
    'Linki aç ve bu adresle giriş yap, board görünecek.',
  'Access is granted the moment that address signs in. Tuval does not send mail: your mail app opens with the invite ready, you press send.':
    'O adres giriş yaptığı anda erişim açılır. Tuval posta göndermez: e-posta uygulaman hazır davetle açılır, göndere sen basarsın.',
  'Invite emailed to {email}.': 'Davet {email} adresine gönderildi.',
  'Access granted, but the email failed: {reason}':
    'Erişim açıldı ama e-posta gitmedi: {reason}',
  'The invite goes out as a sign-in link from your Supabase SMTP. Configure it under Authentication → SMTP Settings, or the built-in sender will throttle after a few messages.':
    'Davet, Supabase SMTP\'nden giriş bağlantısı olarak gider. Authentication → SMTP Settings\'ten ayarla; yoksa dahili gönderici birkaç mesajdan sonra kısar.',
  'Everyone at {domain}': '{domain} uzantılı herkes',
  'Anyone signing in with that domain can open this board, no invite needed.':
    'O uzantıyla giren herkes bu board\'u açabilir, davete gerek yok.',
  'Off: only the people listed below can open this board.':
    'Kapalı: board\'u yalnızca aşağıdaki kişiler açabilir.',
}

const CATALOG: Record<Lang, Record<string, string> | null> = { en: null, tr }

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY) as Lang | null
    if (saved && saved in CATALOG) return saved
  } catch { /* ignore */ }
  return typeof navigator !== 'undefined' && navigator.language.startsWith('tr') ? 'tr' : 'en'
}

let lang: Lang = detect()
const listeners = new Set<() => void>()

export const getLang = () => lang

export function setLang(next: Lang) {
  if (next === lang) return
  lang = next
  try { localStorage.setItem(KEY, next) } catch { /* ignore */ }
  listeners.forEach((l) => l())
}

export function subscribeLang(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function t(source: string, vars?: Record<string, string | number>): string {
  const out = CATALOG[lang]?.[source] ?? source
  if (!vars) return out
  return out.replace(/\{(\w+)\}/g, (whole, key) => String(vars[key] ?? whole))
}
