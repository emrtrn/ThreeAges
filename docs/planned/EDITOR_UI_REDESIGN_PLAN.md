# Editör UI Yeniden Tasarım Planı (UI.png)

**Kaynak görsel:** `docs/planned/UI.png`
**Durum:** Planlandı — uygulamaya başlanmadı.
**Tarih:** 2026-07-14

Görsel, Forge editörü için Unreal-tarzı, koyu temalı, profesyonel bir UI
taslağı. Önemli tespit: taslaktaki yapının **büyük bölümü bugün işlevsel
olarak zaten var** (topbar, Add Actor flyout, Scene Outliner, Details
sekmeleri, Content Drawer, durum satırı). Bu iş sıfırdan UI inşası değil,
**görsel/UX yeniden tasarımı + birkaç yeni küçük özellik** işidir. Panel
dilimleme işi (`EDITOR_UI_SLICING_PLAN`) tamamlandığı için paneller zaten
`src/editor/panels/*` altında ayrı modüller — restyle bu modüller üzerinde
yürür.

## Kesinleşen Kararlar (2026-07-14)

Taslak eksiksiz bir özellik listesi değil; bugün var olup taslakta
görünmeyen öğeler için kullanıcıyla netleşen kararlar:

- **Content Drawer kilit / Tall-Short / Dev Content:** Kalır, ancak üst
  çubuktan kaldırılıp taslaktaki **dişli (ayarlar) menüsüne** taşınır.
  `Refresh` de bu menüye girer. Taslaktaki huni (filtre) ikonu mevcut asset
  tipi filtresine bağlanır.
- **Delete butonu:** Toolbar'da kalır (Save/Undo/Redo yanında, taslakta
  görünmese de).
- **Level adı:** Marka yanında kalır — "Forge · `level-adı`" ikincil metin;
  kaydedilmemiş değişiklikte yıldız (*) gösterilebilir (Faz 7 kirli-durum
  takibiyle beslenir).
- **World/Local toggle:** Araç grubunda **5. ikon olarak kalır** (taslaktaki
  4'lü grup 5'li olur). Viewport bilgi şeridindeki "World Space" salt okunur
  gösterge olarak state ile senkron kalır.
- **Snap aç/kapa:** Checkbox kalkar; **snap ikonuna tıklamak aç/kapa** olur
  (aktifken vurgulu), yanındaki dropdown değeri seçer.
- **Content Drawer'ı yeniden açma:** Status bar'daki "Content Drawer"
  butonu kalır (drawer kapalıyken tek görünür giriş noktası).
- **Content Drawer alt durum satırı:** Kaldırılır; yerine grid üstünde
  "N items" sayacı, mesajlar ana status bar'a akar.

## Kesinleşen Kararlar (2026-07-14, ek)

- **World Settings sekmeden çıkar → hamburger menüye taşınır:** World Settings
  seçime değil level'e bağlı bir ayar yüzeyi; Details sekme şeridinde durması
  kavramsal olarak yanlış (Unreal'de de ayrı pencere). Inspector tab strip'ten
  (`data-inspector-tab="world"`) kaldırılır; kalan sekmeler Details / Mesh Paint
  / Foliage. Yerine hamburger menüde "World Settings" satırı, mevcut
  `renderWorldSettingsPanel` gövdesini yeniden kullanan **hamburger altına
  tutturulmuş bir popover panel** açar (küçük dropdown menü değil — panel çok
  alanlı). Ayrı bir çark ikonu tercih edilmedi: Content Drawer'ın kendi çark
  (ayarlar) menüsüyle çakışırdı.
- **Hamburger menü kapsamı (karar → uygulandı):** Save Layout, Open Level
  (Content Drawer'ı açar), World Settings (popover). **Docs atlandı** (genel bir
  hosted docs URL'si yok; uydurma link eklenmedi). **New Level / Save As bu
  plandan hariç** (yeni level-dosyası oluşturma/kopyalama akışı + saveValidator
  dokunuşu gerektiren ayrı iş; ertelendi).

## İlkeler

1. **İşlevsel regresyon yok.** Mevcut davranış (kısayollar, sürükle-bırak,
   context menüler, undo/redo) aynen korunur; değişen şey görünüm ve küçük
   eklemelerdir.
2. **Framework eklenmez.** Mevcut vanilla DOM + şablon string + CSS yaklaşımı
   sürer. `editorUi.css` editör chunk'ında kalır (oyun build'ine sızmaz;
   `verify:dist --strict` yeşil kalmalı).
3. **`data-testid`'ler sabit kalır** (`editor-save`, `add-actor-button`,
   `add-shape-cube`, `editor-play`, `editor-status`, `forge-editor` …).
   DOM yapısı değişirse `smoke:browser` senaryoları aynı turda güncellenir.
4. **Küçük, build-geçen adımlar.** Her faz kendi başına ship edilebilir;
   her fazın sonunda `npx tsc --noEmit` + `npm run test:engine`, DOM'a dokunan
   fazlarda ek olarak `npm run smoke:browser`.
5. **Şablon genel kalır.** Tema token'ları generic (proje-özel renk/marka
   varsayımı yok).

## Taslak ↔ Mevcut Durum Haritası

| Bölge (taslak) | Bugün var mı? | Eksik / fark |
| --- | --- | --- |
| Topbar: Save, Undo/Redo, Add Actor, araçlar, snap, Perspective/Lit/Show, Play | Evet, tamamı işlevsel | Görsel dil: birincil mavi Add Actor ve Play butonu, Play'de açılır ok (split button), hamburger menü, gruplu/segmentli araç kümesi |
| Add Actor flyout: arama + Recently Used + kategori>alt menü | Kategoriler + alt menüler var | Arama alanı yok, Recently Used yok, satırlarda ikon yok |
| Scene Outliner: ikonlu satırlar, göz/kilit, alt sayaç | Arama, hiyerarşi, göz/kilit (emoji) var | Tip ikonları + SVG göz/kilit, başlıkta filtre, altta "N actors (M selected)" sayacı |
| Viewport üst bilgi şeridi (Perspective / Lit / World Space / Grid / seçim) | Yok (bilgi topbar'da dağınık) | Yeni salt-okunur overlay şerit, state ile senkron |
| Viewport sağ-alt kontrolleri (pan/orbit/frame/fullscreen) + sol-alt eksen gizmosu | Yok | Yeni overlay butonlar + three.js ViewHelper benzeri mini eksen göstergesi |
| Details başlığı: ikon + ad + "Static Mesh" rozeti + alt satır | Kısmi (`detail-heading`) | Tip rozeti (chip) + "Instance / asset-adı" alt satırı |
| Details bölümleri: katlanabilir + kebab menü | `detail-section` düz blok, katlanmıyor | Katlanabilir başlık, durum kalıcılığı, bölüm kebab menüsü |
| Transform satırları: renkli X/Y/Z etiketleri, scale zincir (uniform kilit) | Sayısal alanlar var (`transformRows`) | X kırmızı / Y yeşil / Z mavi etiket kutuları, uniform-scale kilidi |
| Pivot: sayısal + Reset/Center/Use Base | Pivot düzenleme var (sayısal + preset) | Buton üçlüsünün görsel düzeni |
| Materials: küre önizleme + dropdown + araç ikonları | Materials bölümü var; `ThumbnailRenderer` mevcut | Satıra küre thumbnail entegrasyonu |
| Placement: Snap to Floor / Snap to Wall / Lock Movement | Snap to Floor var (`instanceDetails`); kilit outliner'da | "Placement" bölümü olarak toplama; Snap to Wall **yeni özellik** |
| AI Navigation / Collision bölümleri | Var (`navigationDetails`, `collisionDetails`) | Sadece restyle |
| Sekmeler: Details / World Settings / Foliage | Var (+ Mesh Paint) | **World Settings sekmeden çıkar → hamburger popover'a taşınır** (karar); kalan Details / Mesh Paint / Foliage restyle — **Mesh Paint sekmesi kalır** |
| Content Drawer: +Add, Import, Save All, geri/ileri, breadcrumb, filtre, ayarlar, görünüm | Ağaç, arama, thumbnail'lı kartlar, context menü, Import var | Üst araç çubuğu düzeni, geri/ileri gezinme geçmişi, Favorites, "N items" sayacı, kart tip etiketi |
| Durum çubuğu: Ready · No Errors · N Unsaved Changes | "Ready" + ton var (`editor-status`) | Hata sayacı ve kirli-durum (unsaved) rozeti **yeni** |

## Fazlar ve Checklist

### Faz 0 — Tasarım Token'ları ve İkon Altyapısı (temel)

- [x] Desktop çalışma zemini: koyu gri shell üzerinde küçük fillet'li, ince açık
      çerçeveli toolbar/panel kartları; viewport da Outliner ve Details arasında
      bağımsız bir çalışma paneli olarak çerçevelenir. Content Drawer açıkken
      viewport alt panele kadar kısalır.
- [x] Alt sınır düzeltmesi: kapalı Content Drawer/status bar yalnız sol-orta
      çalışma alanında kalır; Details paneli ekran altına kadar iner. Viewport
      bu bara kadar biter ve alt köşe fillet'i görünür kalır.
- [x] Viewport maskesi: çerçeve dışındaki canvas alanı koyu çalışma zeminiyle
      maskelenir; Details arkasında, sağ boşlukta veya alt sınırda viewport
      çizimi görünmez.

Görsel dilin tek kaynağı. DOM yapısına dokunmaz; sonraki tüm fazlar bunu tüketir.

- [x] `editorUi.css` başına CSS custom property token seti (`:root`): yüzey
      renkleri (`--forge-bg-0..3`, `surface-raise`), kenarlık (soft/mid/strong),
      metin (birincil/ikincil/dim), **vurgu mavisi** (`--forge-accent*`),
      başarı/uyarı/hata, **X/Y/Z eksen renkleri**, border-radius + spacing
      ölçekleri. (Not: token tanımları büyük-harf hex / boşluksuz rgba yazıldı
      ki mekanik migration onları kendiyle değiştirmesin.)
- [x] Mevcut hard-coded renkleri token'lara geçir — ~15 sık renk mekanik olarak
      geçirildi (346 `var(--forge-*)` kullanımı; değerler korunduğu için görsel
      nötr).
- [x] İnline-SVG ikon seti genişletildi → yeni `src/editor/editorIcons.ts`:
      `ACTOR_TYPE_ICONS` (mesh/ışık/atmosfer/bulut/post-process/ses/widget/
      volume/terrain/karakter/gameplay/grup/generic), `UI_ICONS` (göz/göz-kapalı,
      kilit/açık, filtre, dişli, klasör, arama, hamburger, add/import, kebab,
      refresh, chevron/ok'lar, yıldız, link), `VIEWPORT_ICONS` (pan/orbit/frame/
      fullscreen). Sonraki fazlar tüketecek (emoji göz/kilit değişimi Faz 3).
- [x] Ortak kontrol sınıfları: `.forge-btn-primary` (mavi), `.forge-btn-ghost`,
      `.forge-segmented`, `.forge-chip`, `.forge-kebab` (token tabanlı).
- [x] Doğrulama: `npx tsc --noEmit` ✅ + `test:engine` 908 ✅ + `build:verify`
      ✅. DOM'a dokunulmadı; CSS smoke'tan bağımsız olarak aklandı (Faz 0 öncesi
      baseline de aynı ortamsal timeout'larla takılıyor).

### Faz 1 — Topbar

- [x] Sol küme: Forge logosu + "Forge · `level-adı`" ikincil metni (level adı
      `.editor-level-name`, `data-project-name` korunur) + hamburger menü
      butonu (`data-main-menu-button`). Hamburger, paylaşılan context-menu
      altyapısıyla açılır: Save Layout, Open Level (Content Drawer'ı açar),
      **World Settings** (popover panel açar). **Docs şimdilik atlandı** —
      Forge'un genel bir docs URL'si yok, uydurma link eklemedim; ileride
      hosted docs olursa eklenir. New Level / Save As kapsam dışı.
- [x] Save/Undo/Redo/**Delete** ikon kümesi — token'lı chrome (Delete kalır).
      **Not:** Lead (260px) hamburger eklenince dar kaldığından history kümesi
      workbar başına taşındı (UI.png ile de tutarlı: Save outliner sütununun
      sağında). Aksi halde 260px `overflow:hidden` içinde kırpılıp undo
      tıklanamıyordu (smoke snapshot ile teşhis edildi).
- [x] Add Actor birincil (mavi) buton (`.primary`); araç grubu
      (seç/taşı/döndür/ölçekle + **World/Local 5. ikon**) segmentli görünüm
      (`.editor-tools` konteyner), aktif araç mavi dolgulu.
- [x] Snap widget'ları — zaten ikon-toggle + dropdown (checkbox görsel gizli,
      ikona tıkla toggle); aktif durum accent-mavi vurgulu dolguya geçirildi.
- [x] Perspective / Lit / Show menü butonları token'lı görünümü miras alır.
- [x] Play: birincil mavi split button — sol yarı `data-action="play"`
      (`editor-play` testid korunur, mevcut yeni-sekme davranışı), sağdaki ok
      (`data-play-menu`) menü açar ("Play in New Tab" / "Play in Same Tab";
      `playTest("sameTab")` `window.location.href` kullanır).
- [x] Topbar grid hizası korundu (grid şablonu değişmedi; sol sütun 260px).
- [~] Doğrulama: `build:verify` (tsc + build + engine 908 + verify:dist
      --strict) yeşil. `smoke:browser` bu ortamda geçici olarak güvenilmez
      (dev-server yavaşlığı, 210s timeout'lar — Faz 0'dan bağımsız kanıtlandı);
      testid sözleşmesi (`editor-save/undo/redo`, `add-actor-button`,
      `add-shape-cube`, `editor-play`, `editor-status`, `forge-editor`) bilinçli
      korundu. Ortam yatışınca smoke tekrar koşulmalı.

### Faz 2 — Add Actor Flyout

Tek kaynak: tüm placeable aktörler artık `buildAddActorEntries()` içindeki
`AddActorEntry[]` deskriptör listesinden geliyor (key/label/category/icon/drag
payload/onClick). Aynı liste üç yüzeyi besliyor — kategori alt menüleri,
Recently Used ve düz arama sonuçları — böylece drag payload'ları ve tıklama
eylemleri asla ayrışmıyor. Eski dağınık bağlama blokları (`[data-add-actor]`,
`[data-add-shape]`, player-start/ambient-sound blokları, singleton click'leri,
`bindSpecialActorButton`) tek `bindAddActorMenu()` + `bindAddActorEntry()` ile
değiştirildi; `data-add-*` fonksiyonel attribute'ları yerini `data-add-key`'e
bıraktı (`data-testid="add-shape-cube"` korundu).

- [x] Flyout üstüne arama alanı (`[data-add-search]`): yazınca kategoriler
      gizlenip düz filtrelenmiş sonuç listesi (`[data-add-results]`) gösterilir
      (label + kategori üzerinden filtre); boş sorguda kategoriler + Recently
      Used geri gelir. Enter tek/ilk eşleşmeyi yerleştirir.
- [x] "Recently Used" bölümü (`[data-add-recent]`): son 5 kullanılan aktör,
      `localStorage` (`forge.editor.recentActors`) kalıcılığı; drag'de ve
      click-yerleştiren aktörlerde kaydedilir, arama sırasında gizlenir,
      bilinmeyen key'ler yüklemede elenir.
- [x] Kategori satırlarına ikon (`ACTOR_TYPE_ICONS`) + sağa hizalı chevron
      (`::after` + `margin-left:auto`); hover alt menü davranışı korundu.
- [x] Aktör satırlarına tip ikonları (kategori + Recently Used + arama ortak
      `addActorItemMarkup`).
- [x] **Sürükle-bırak korunur:** `bindAddActorEntry` her satıra (kategori,
      Recently Used, arama sonucu) aynı dragstart/dragend + payload'ı bağlar;
      light (`x-forge-light-actor`), asset (`x-3dgamedev-asset`), special
      (`x-forge-special-actor`) kanalları ve status mesajları bire bir korundu.
- [~] Doğrulama: `npx tsc --noEmit` ✅ + `test:engine` 908 ✅ + `build:verify`
      (verify:dist --strict dahil) ✅. `smoke:browser`: editor-authoring'in
      Add Actor→cube drag→transform→undo×2→redo×2 adımları (19–68) geçti; test
      yalnız sonraki `editor-save` tıklamasında global 150s bütçesini aştı
      (Faz 1'de belgelenen dev-server yavaşlığı, değişiklikten bağımsız).
      Recently Used artık aynı label'ı iki kez üretebildiği için
      `target-point` ve `spline-point-edit` smoke'ları kategori kapsamına
      (`[data-add-categories]` / `[data-add-key="spline"]`) alındı.

### Faz 3 — Scene Outliner

- [x] Başlık çubuğu: "SCENE OUTLINER" + sağda filtre ikonu (tip bazlı
      filtre popover'ı — mesh/character/light/environment/volume/terrain/gameplay/widget
      ailelerini göster-gizle).
- [x] Satırlar: aktör tip ikonu (Faz 0 setinden) + ad + sağda SVG göz/kilit
      (emoji kalktı); seçili satır mavi vurgu; hover durumları.
- [x] Arama alanı Add Actor flyout ile aynı `UI_ICONS.search` SVG'sini kullanır;
      `Search actors...` ipucu ve ikonlu alan; Scene Outliner'a ait tip filtresi
      aramanın sağında aynı `tabpanel` içinde kalır. Satır grid'i ikon, ad ve
      göz/kilit aksiyonlarını tek satırda hizalar.
- [x] Panel kabuğu Details ile aynı sekme şeridi ve mavi aktif-tab alt çizgisine
      geçirildi; mevcut aktör satırlarına dokunulmadı. `Scene Outliner` ilk
      `tabpanel` olarak ayrıldı; ileride `Placed Actors` gibi paneller aynı şeride
      ikinci sekme olarak eklenebilir.
- [x] Alt bilgi satırı: "N actors (M selected)" — scene-object render akışında
      güncellenir; seçim değişimi aynı akıştan yeni Outliner görünümünü alır.
- [x] Hiyerarşi girintisi ve grup satırları yeni görsel dile uyarlandı;
      drag-to-parent olay bağları korunmuştur. UI.png karşılaştırması sonrası
      satır yüzeyleri kart/çerçeve yerine ince ayraçlı yoğun listeye çekildi;
      tip ikonlarının arka plan kutusu kaldırıldı.
- [~] Doğrulama: `npm.cmd run build:verify` ✅ (TypeScript + import sınırları +
      Vite build + engine 908 + strict dist). Yeni `tests/smoke/outliner.spec.ts`,
      göz/kilit, sayaç ve mesh filtresini kapsar. Hedefli Playwright koşusu bu
      ortamda iki kez başlangıçtaki seviye yüklemesinde 30 sn içinde Outliner satırı
      üretmeden zaman aşımına uğradı; mevcut dev-server/smoke gecikmesi giderilince
      yeniden çalıştırılmalı.

### Faz 4 — Details Paneli

- [x] Details başlangıcı: seçili aktör kartı kaldırıldı; panel doğrudan Name
      alanıyla başlar.
- [x] Katlanabilir bölümler: `detail-section` başlığına chevron + tıklayınca
      katlama; katlanma durumu bölüm anahtarıyla `localStorage`'da kalıcı;
      "Advanced" varsayılan katlı.
- [x] Genel bölüm aç/kapa: her başlıktaki kebab menüsü kaldırıldı; Name alanının
      sağındaki küçük toggle tüm bölümleri Collapse All / Expand All olarak açar.
- [x] Transform satırları: X/Y/Z etiketleri renkli kutucuk (kırmızı/yeşil/
      mavi token'ları), alan odak/hover durumları.
- [x] Scale satırına uniform-kilit (zincir) toggle'ı: kilitliyken bir eksene
      girilen değer oranı koruyarak üçüne uygulanır (undo tek komut).
- [x] Pivot bölümü: sayısal XYZ + "Reset Pivot / Center Pivot / Use Base"
      buton üçlüsü (mevcut pivot preset'leri bu adlandırmaya bağlanır).
- [x] Materials: slot satırına küre thumbnail (`ThumbnailRenderer` ile,
      Content Browser'daki malzeme önizlemesiyle aynı yoldan) + mevcut
      dropdown/eylemler.
- [x] "Placement" bölümü: mevcut Snap to Floor buraya taşınır; **Snap to
      Wall eklenir** (seçimin yönüne göre en yakın duvara/dikey yüzeye
      raycast — Snap to Floor'un yatay eşleniği, tek undo komutu);
      Lock Movement checkbox'ı outliner'daki `locked` bayrağına bağlanır.
- [x] AI Navigation, Collision, Physics, metadata bölümleri yeni bölüm
      görseline geçirilir (davranış aynı).
- [x] Sekme şeridi restyle: **World Settings sekmesi kaldırılır** (karar —
      hamburger popover'a taşındı); kalan sekmeler Details / Mesh Paint /
      Foliage. `data-inspector-tab="world"` kaldırılırken smoke/testid
      referansları aynı turda güncellenir.
- [x] Mesh Paint ve Foliage panelleri, Details ile aynı kart tabanlı açılır/kapanır
      bölüm başlıklarını ve `localStorage` kalıcılığını kullanır. Mesh Paint'teki
      Transfer araçları ayrı bir bölüm olarak düzenlendi; mevcut paint/foliage
      davranışları korunur.
- [x] Referans görsel düzeltmesi: panel 410px sabit inspector genişliğine,
      mavi aktif-tab alt çizgisine ve koyu kart tabanlı section yüzeylerine
      geçirildi; coordinate alanları X/Y/Z vurgu çizgileri ve yoğun Unreal-benzeri
      spacing ile yeniden düzenlendi.
- [x] Details kaydırma yüzeyi: görünür scrollbar/gutter gizlenir; mouse tekeri
      ve trackpad kaydırması korunur.
- [x] Editor kaydırma yüzeyleri: Scene Outliner, Content Drawer, Mesh Paint ve
      Foliage'da görünür scrollbar/gutter gizlenir; mouse tekeri ve trackpad
      kaydırması korunur.
- [~] Doğrulama: Details transform smoke adımı + undo/redo; save-validator
      etkilenmez (yeni layout alanı yok — Snap to Wall yalnız transform yazar).
      `details-panel.spec.ts` başlık/katlanma/pivot/material DOM sözleşmesini ekler;
      hedefli Playwright çalışması mevcut dev-server ortamında ilk Outliner satırı
      üretilmeden 30 sn zaman aşımına uğradı. `npx tsc --noEmit` ✅;
      `npm.cmd run build:verify` ✅.

### Faz 5 — Content Drawer

- [x] Üst araç çubuğu: `+ Add` (mevcut `/__content-new` akışları),
      `Import` (mevcut), `Save All` → mevcut Save Layout eylemine bağlanır
      (ayrı bir "tüm asset'leri kaydet" sistemi **bu planın kapsamı dışı**).
- [x] Geri/ileri gezinme: klasör gezinme geçmişi (basit stack) + ok butonları.
- [x] Breadcrumb: `All > Content > …` tıklanabilir yol parçaları (mevcut
      yol etiketinin yerine).
- [x] Sol ağaca "Favorites" bölümü: klasör context menüsünden ekle/çıkar,
      `localStorage` kalıcılığı.
- [x] Arama satırı: arama + huni (filtre) ikonu → mevcut asset tipi
      filtresi popover olarak.
- [x] **Dişli (ayarlar) menüsü** (karar): mevcut Dev Content toggle'ı,
      drawer kilidi (dışarı tıklayınca kapanmayı engelle), Tall/Short
      yükseklik seçimi ve Refresh buraya taşınır — işlev aynen korunur,
      üst çubuktan kalkar.
- [x] Görünüm ikonu: thumbnail boyutu (küçük/orta/büyük).
- [x] Kart görünümü: klasör ve asset kartları taslak diline geçer; asset
      kartında alt satır tip etiketi ("Static Mesh", "Material", "Texture",
      "Effect" …); grid üstünde "N items" sayacı. Alt "content-drawer-status"
      satırı kaldırılır; mesajlar ana status bar'a akar (karar).
- [x] Drawer başlık çubuğu ("CONTENT DRAWER" + katla/aç) restyle; mevcut
      aç/kapa davranışı korunur; **status bar'daki "Content Drawer" açma
      butonu kalır** (karar — drawer kapalıyken tek görünür giriş).
- [x] Katman düzeni: Drawer yalnız Outliner ile Details arasındaki alt alanı
      kaplar; açıkken Outliner Drawer üstüne kadar kısalır, Details ise status
      bara kadar kesintisiz kalır. Kapanınca Outliner eski tam yüksekliğine döner.
- [x] Klasör dili: grid kartları büyük sarı klasör glyph'i, sol ağaç ise küçük
      sarı klasör ikonları kullanır; seçili klasör referanstaki mavi vurguyla görünür.
- [x] Filter assets: popover açık durumu ve uygulanmış filtre durumu ayrıldı;
      dışarı tıklama/Drawer kapanışı popover'ı kapatır ve toggle takılı kalmaz.
- [x] Kapalı Drawer hizası: Content Drawer, masaüstünde 6px aşağı taşınarak
      gizlenir; status bar'daki Content Drawer girişi aynı sol/alt boşlukla
      panelin üst kenarına hizalanır ve ince panel şeridi görünmez.
- [~] Doğrulama: content browser smoke + sürükle-bırak yerleştirme + context
      menüler regresyonsuz. `content-drawer-redesign.spec.ts` toolbar, breadcrumb,
      gezinme geçmişi ve görünüm boyutu sözleşmesini ekler; hedefli Playwright
      koşusu önceki Faz 4’teki dev-server başlangıç zaman aşımı giderildiğinde
      yeniden çalıştırılmalıdır. `npm.cmd run build:verify` ✅; son hedefli koşu,
      uygulama `Forge · loading level` durumundan çıkmadan asset ağacını üretmediği
      için breadcrumb beklerken zaman aşımına uğradı.

### Faz 6 — Viewport Overlay'leri

- [ ] Üst bilgi şeridi (viewport içinde, ortalanmış): kamera modu · görünüm
      modu · World/Local space · aktif grid snap değeri · seçim özeti
      ("1 object selected"). **Salt okunur** gösterge, state ile senkron
      (karar: World/Local toggle'ı toolbar'da; şerit yalnız yansıtır).
      Parçalara tıklayınca ilgili topbar menüsünün açılması opsiyonel
      genişletme.
- [ ] Sağ-alt kontrol kümesi: pan/orbit modu, seçimi çerçevele (mevcut F
      kısayolunun butonu), tam ekran (Fullscreen API).
- [ ] Sol-alt eksen mini-gizmosu: three.js `ViewHelper` (veya hafif özel
      çizim) — ayrı küçük viewport'ta render, tıklayınca eksene hizalı
      kamera görünüşü (Top/Front/Left mevcut kamera preset'lerini kullanır).
- [ ] Overlay'ler yalnız editör modunda; `?debug` perf overlay'i ile çakışma
      kontrolü (konumlar ayrık).
- [ ] Doğrulama: gizmo/kamera etkileşimi regresyonsuz; runtime `/` rotasında
      hiçbir overlay görünmez.

### Faz 7 — Durum Çubuğu

- [ ] Alt durum çubuğu düzeni: solda mevcut durum mesajı ("Ready" + ton),
      sağda "No Errors / N Errors" ve "N Unsaved Changes".
- [ ] Kirli-durum takibi: komut yığını derinliği + son Save Layout işaretinin
      karşılaştırması ("N Unsaved Changes" sayısı = son kayıttan bu yana
      komut sayısı; kaydette sıfırlanır). Content/asset kaydetmeleri kapsam
      dışı — yalnız layout kirliliği.
- [ ] Kirli durumda marka satırındaki level adına yıldız (*) eklenir
      (Faz 1'deki "Forge · `level-adı`" metnini besler).
- [ ] Hata sayacı: `window.onerror` / `unhandledrejection` dinleyicisi +
      editörün kendi `error` tonlu status çağrıları; tıklayınca son hatayı
      gösteren mini popover (ilk sürümde konsola yönlendirme yeterli).
- [ ] Doğrulama: kaydet → sayaç sıfırlanır; değişiklik → sayaç artar
      (smoke'a küçük adım eklenebilir).

### Faz 8 — Kapanış: Regresyon, Smoke, Doküman

- [ ] `npm run build:verify` (tsc + vite build + test:engine +
      verify:dist --strict) yeşil.
- [ ] `npm run smoke:browser` yeşil; DOM değişikliklerinden etkilenen
      senaryolar güncellendi.
- [ ] Editör bundle boyutu kontrolü: yeni SVG/CSS'in oyun build'ine
      sızmadığı doğrulanır (`verify:dist --strict` + chunk incelemesi).
- [ ] Alt editörler (Material/SkeletalMesh/SoundCue/Particle/BT/ST) için
      token uyumu **ayrı takip** olarak not edilir (bu plan ana kabuğu
      hedefler; alt editörler token'ları kalıtımla kısmen alır).
- [ ] Bu doküman `docs/completed/`e taşınır; `docs/COMPLETED_WORK_INDEX.md`
      girdisi eklenir; UI.png dokümanın yanına taşınır.

## Bilinçli Sapmalar (taslak ≠ birebir)

- **Mesh Paint sekmesi kalır** — taslakta yok ama mevcut özellik; taslak
  eksiksiz bir özellik listesi değil, görsel dil referansı.
- **Save All = Save Layout** — ayrı çok-asset kayıt sistemi bu planda yok.
- **Hamburger menü minimal** — yalnız mevcut eylemlerin menü karşılığı;
  File/Edit/Window tarzı tam menü çubuğu kapsam dışı.
- **Kebab menüler** yalnızca anlamlı eylemi olan bölümlere konur; boş menü
  koymak için yer tutucu eklenmez.
- Taslaktaki örnek içerik (highpolyplane, checker_01 vb.) sadece mock veri;
  plan hiçbir yerde bu adlara bağlanmaz.

## Kapsam Dışı

- Dock/undock, sürüklenebilir/yüzen paneller, panel tab tear-off.
- Çoklu viewport / bölünmüş görünüm.
- Açık tema veya tema seçici (tek koyu tema token'lanır; token'lar ileride
  temalamayı ucuzlatır).
- React/Vue vb. framework geçişi.
- Alt editörlerin (Persona, Material Editor…) tam restyle'ı (ayrı iş).

## Riskler / Notlar

- **Smoke kırılganlığı:** DOM yapısı değişen her fazda `smoke:browser`
  koşulmalı; `data-testid` sözleşmesi bilinçli korunmalı.
- **CSS büyümesi:** `editorUi.css` ~5k satır; token geçişi sırasında ölü
  kural temizliği fırsatı var ama agresif silme regresyon riski taşır —
  temizlik ayrı, küçük commitlerde.
- **Snap to Wall** tek gerçek "yeni engine-dokunuşlu" özellik: raycast
  yönü/aday yüzey seçimi (en yakın dikey yüzey) net tanımlanmalı; ilk sürüm
  "kameraya göre ileri yönde en yakın engel" gibi basit bir kuralla başlar.
- **ViewHelper:** three örnek `ViewHelper`'ı addons'tan gelir; editör
  chunk'ında kalmalı (dinamik importun arkasında).
- **`?debug` perf overlay konumu:** `body.editor-mode #debug-stats` bugün
  topbar (44px) ve outliner (260px) ölçülerine sabitlenmiş; bu ölçüler
  değişirse offset'ler birlikte güncellenmeli.
- Uygulama sırası Faz 0 → 8 lineer; Faz 2–7 kendi içinde bağımsız olduğundan
  gerekirse yeniden sıralanabilir (yalnız hepsi Faz 0'a bağımlı).
