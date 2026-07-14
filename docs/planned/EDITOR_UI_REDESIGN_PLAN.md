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
| Sekmeler: Details / World Settings / Foliage | Var (+ Mesh Paint) | Sadece restyle — **Mesh Paint sekmesi kalır** (taslak eksiksiz özellik listesi değil) |
| Content Drawer: +Add, Import, Save All, geri/ileri, breadcrumb, filtre, ayarlar, görünüm | Ağaç, arama, thumbnail'lı kartlar, context menü, Import var | Üst araç çubuğu düzeni, geri/ileri gezinme geçmişi, Favorites, "N items" sayacı, kart tip etiketi |
| Durum çubuğu: Ready · No Errors · N Unsaved Changes | "Ready" + ton var (`editor-status`) | Hata sayacı ve kirli-durum (unsaved) rozeti **yeni** |

## Fazlar ve Checklist

### Faz 0 — Tasarım Token'ları ve İkon Altyapısı (temel)

Görsel dilin tek kaynağı. DOM yapısına dokunmaz; sonraki tüm fazlar bunu tüketir.

- [ ] `editorUi.css` başına CSS custom property token seti: yüzey renkleri
      (bg-0/1/2), kenarlık, metin (birincil/ikincil), vurgu mavisi
      (birincil buton + seçim), başarı/uyarı/hata, border-radius ölçeği,
      spacing ölçeği, X/Y/Z eksen renkleri.
- [ ] Mevcut hard-coded renkleri token'lara geçir (mekanik arama-değiştir;
      görünümde büyük sapma beklenmez, taslak paletine bu adımda yaklaştır).
- [ ] `TOOLBAR_ICONS` benzeri inline-SVG ikon setini genişlet: aktör tip
      ikonları (mesh, ışık, atmosfer, bulut, post process, ses, widget…),
      göz/göz-kapalı, kilit/kilit-açık, filtre, dişli, klasör, arama,
      hamburger, chevron'lar, viewport kontrol ikonları. Emoji kullanımını
      (outliner göz/kilit dahil) SVG ile değiştirmeye hazırla.
- [ ] Ortak kontrol sınıfları: `.btn-primary` (mavi), `.btn-ghost`,
      segmentli buton grubu, chip/rozet, kebab menü butonu.
- [ ] Doğrulama: `npx tsc --noEmit` + `npm run smoke:browser` (görünüm
      değişir, davranış değişmez).

### Faz 1 — Topbar

- [ ] Sol küme: Forge logosu + "Forge · `level-adı`" ikincil metni (karar:
      level adı markada kalır; Faz 7 sonrası kirli durumda yıldız) +
      hamburger menü butonu. Hamburger minimal başlar: Save Layout, Open
      Level, Docs bağlantısı gibi mevcut eylemlerin menü karşılığı (yeni
      özellik icat edilmez).
- [ ] Save/Undo/Redo/**Delete** ikon kümesi restyle — Delete kalır (karar).
- [ ] Add Actor'ı birincil (mavi) buton yap; araç grubu
      (seç/taşı/döndür/ölçekle + **World/Local 5. ikon**, karar) segmentli
      görünüm alır, aktif araç dolgulu.
- [ ] Snap widget'ları ikon + değer dropdown'u görünümüne geçir; **checkbox
      kalkar, ikona tıklamak aç/kapa toggle olur** (aktifken vurgulu dolgu;
      karar).
- [ ] Perspective / Lit / Show menü butonlarını restyle et.
- [ ] Play: birincil mavi split button — sol yarı mevcut Play davranışı
      (kaydet + runtime'ı yeni sekmede aç), sağdaki ok küçük menü
      ("Yeni sekmede oynat" / "Aynı sekmede oynat").
- [ ] Topbar grid hizasını koru (sol sütun = outliner genişliği); dar
      ekranda taşma davranışını gözden geçir.
- [ ] Doğrulama: smoke senaryoları (save/undo/redo/play testid'leri).

### Faz 2 — Add Actor Flyout

- [ ] Flyout üstüne arama alanı: yazınca kategori listesi yerine düz
      filtrelenmiş sonuç listesi (tüm `data-add-*` girdileri tek indekste).
- [ ] "Recently Used" bölümü: son N (örn. 3–5) eklenen aktör tipi,
      `localStorage` kalıcılığı.
- [ ] Kategori satırlarına ikon + sağa hizalı chevron; alt menü açılış
      davranışı (hover/tık) mevcut haliyle korunur.
- [ ] Aktör satırlarına tip ikonları.
- [ ] **Sürükle-bırak korunur:** bugün flyout girdileri viewport'a
      sürüklenebilir (`draggable` + dragstart); arama sonuçları ve Recently
      Used satırları da aynı drag davranışını almalı.
- [ ] Doğrulama: `add-shape-cube` smoke akışı + klavye ile menü gezinme
      bozulmadı.

### Faz 3 — Scene Outliner

- [ ] Başlık çubuğu: "SCENE OUTLINER" + sağda filtre ikonu (tip bazlı
      filtre popover'ı — ışık/mesh/volume vb. göster-gizle).
- [ ] Satırlar: aktör tip ikonu (Faz 0 setinden) + ad + sağda SVG göz/kilit
      (emoji kalkar); seçili satır mavi vurgu; hover durumları.
- [ ] Alt bilgi satırı: "N actors (M selected)" — seçim/sahne değişiminde
      güncellenir.
- [ ] Hiyerarşi girintisi ve grup satırları yeni görsel dile uyarlanır;
      drag-to-parent davranışı regresyonsuz.
- [ ] Doğrulama: outliner'a dokunan smoke adımları + göz/kilit tıklama
      davranışı.

### Faz 4 — Details Paneli

- [ ] Aktör başlığı: tip ikonu + ad + sağda tip rozeti ("Static Mesh",
      "Light" …) + alt satır "Instance / `assetId`".
- [ ] Katlanabilir bölümler: `detail-section` başlığına chevron + tıklayınca
      katlama; katlanma durumu bölüm anahtarıyla `localStorage`'da kalıcı;
      "Advanced" varsayılan katlı.
- [ ] Bölüm başlığına kebab (⋮) menü çengeli: ilk sürümde "Reset to default"
      / "Collapse all" gibi düşük maliyetli eylemler; boş kalacaksa kebab'ı
      sadece uygun bölümlere koy.
- [ ] Transform satırları: X/Y/Z etiketleri renkli kutucuk (kırmızı/yeşil/
      mavi token'ları), alan odak/hover durumları.
- [ ] Scale satırına uniform-kilit (zincir) toggle'ı: kilitliyken bir eksene
      girilen değer oranı koruyarak üçüne uygulanır (undo tek komut).
- [ ] Pivot bölümü: sayısal XYZ + "Reset Pivot / Center Pivot / Use Base"
      buton üçlüsü (mevcut pivot preset'leri bu adlandırmaya bağlanır).
- [ ] Materials: slot satırına küre thumbnail (`ThumbnailRenderer` ile,
      Content Browser'daki malzeme önizlemesiyle aynı yoldan) + mevcut
      dropdown/eylemler.
- [ ] "Placement" bölümü: mevcut Snap to Floor buraya taşınır; **Snap to
      Wall eklenir** (seçimin yönüne göre en yakın duvara/dikey yüzeye
      raycast — Snap to Floor'un yatay eşleniği, tek undo komutu);
      Lock Movement checkbox'ı outliner'daki `locked` bayrağına bağlanır.
- [ ] AI Navigation, Collision, Physics, metadata bölümleri yeni bölüm
      görseline geçirilir (davranış aynı).
- [ ] Sekme şeridi (Details / World Settings / Mesh Paint / Foliage) restyle.
- [ ] Doğrulama: Details transform smoke adımı + undo/redo; save-validator
      etkilenmez (yeni layout alanı yok — Snap to Wall yalnız transform yazar).

### Faz 5 — Content Drawer

- [ ] Üst araç çubuğu: `+ Add` (mevcut `/__content-new` akışları),
      `Import` (mevcut), `Save All` → mevcut Save Layout eylemine bağlanır
      (ayrı bir "tüm asset'leri kaydet" sistemi **bu planın kapsamı dışı**).
- [ ] Geri/ileri gezinme: klasör gezinme geçmişi (basit stack) + ok butonları.
- [ ] Breadcrumb: `All > Content > …` tıklanabilir yol parçaları (mevcut
      yol etiketinin yerine).
- [ ] Sol ağaca "Favorites" bölümü: klasör context menüsünden ekle/çıkar,
      `localStorage` kalıcılığı.
- [ ] Arama satırı: arama + huni (filtre) ikonu → mevcut asset tipi
      filtresi popover olarak.
- [ ] **Dişli (ayarlar) menüsü** (karar): mevcut Dev Content toggle'ı,
      drawer kilidi (dışarı tıklayınca kapanmayı engelle), Tall/Short
      yükseklik seçimi ve Refresh buraya taşınır — işlev aynen korunur,
      üst çubuktan kalkar.
- [ ] Görünüm ikonu: thumbnail boyutu (küçük/orta/büyük).
- [ ] Kart görünümü: klasör ve asset kartları taslak diline geçer; asset
      kartında alt satır tip etiketi ("Static Mesh", "Material", "Texture",
      "Effect" …); grid üstünde "N items" sayacı. Alt "content-drawer-status"
      satırı kaldırılır; mesajlar ana status bar'a akar (karar).
- [ ] Drawer başlık çubuğu ("CONTENT DRAWER" + katla/aç) restyle; mevcut
      aç/kapa davranışı korunur; **status bar'daki "Content Drawer" açma
      butonu kalır** (karar — drawer kapalıyken tek görünür giriş).
- [ ] Doğrulama: content browser smoke + sürükle-bırak yerleştirme + context
      menüler regresyonsuz.

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
