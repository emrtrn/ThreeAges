# Editör Ortografik Kamera + Wireframe View Mode Planı

> Tarih: 2026-07-09
> Durum: Gelecek faz planı. Kod uygulanmadı.
> Önkoşul: **Faz 1 (UE5 tarzı üst bar) tamamlandı ve commit'lendi** (commit
> `feat(editor): UE5-style toolbar — icon tools, tooltips, snap + camera/view menus`).
> Amaç: Faz 1'de yalnızca **durum + menü** olarak bağlanan Camera ve View Mode
> menülerini gerçek motor davranışına kavuşturmak: teknik görünümlerde (Top /
> Left / Front) **gerçek ortografik projeksiyon + wireframe**, Perspective'de
> **perspektif + lit**; ayrıca View Mode menüsünden bağımsız Lit/Wireframe geçişi.

Bu doküman kullanıcının "Faz 2" olarak adlandırdığı iştir (Faz 1 = UI). Orijinal
planlamada "Faz 4 — Motor desteği" başlığı altında geçiyordu.

---

## 1. Faz 1'den devralınan iskele (hâlihazırda main'de)

`src/scene/SceneApp.ts` içinde durum sahibi olan ama henüz **render tarafı boş**
olan yapı commit'lendi:

- Alanlar: `private cameraView: CameraView = "perspective"`,
  `private viewMode: ViewMode = "lit"`.
- Callback: `onViewStateChanged: (state: ViewportViewState) => void | null` —
  editör iki menü etiketini (`data-camera-label`, `data-viewmode-label`) bununla
  senkron tutuyor.
- Metotlar:
  - `setCameraView(view)` — Perspective için `applyPerspectivePose()`, teknik
    görünümler için mevcut `setTechnicalView("top"|"front"|"side")` çağırıyor;
    ardından `applyViewMode(persp ? "lit" : "wireframe", false)` ile shading
    durumunu eşliyor ve `notifyViewState()` yayınlıyor.
  - `setViewMode(mode)` → `applyViewMode(mode, true)`.
  - `applyViewMode(mode, announce)` — şu an **sadece `this.viewMode = mode`** +
    status mesajı. İçinde `// TODO(view-mode, later step): apply wireframe/lit
    shading to the scene here.` işareti var. **Bu fazın ana doldurma noktası.**
  - `applyPerspectivePose()` — 3/4 açılı perspektif orbit'e döndürür (henüz
    projeksiyon swap'ı yok, sadece perspektif kamerayı konumlandırır).
- `editor/core/tools.ts`: `CameraView = "perspective"|"top"|"left"|"front"`,
  `ViewMode = "lit"|"wireframe"`, `ViewportViewState = { view, mode }`.
- Klavye: `1/2/3` → top/front/left, `4` → perspective; hepsi `setCameraView`
  üzerinden geçiyor (durum otoriter).

Yani UI ve durum akışı hazır; bu faz **projeksiyon** ve **shading** render
davranışını gerçek hale getirir.

---

## 2. UE5 referans davranışı (hedef)

- **Perspective**: perspektif projeksiyon, Lit shading. Serbest orbit/fly.
- **Top / Front / Left (ve Bottom/Back/Right)**: ortografik projeksiyon;
  varsayılan olarak Wireframe shading; eksene kilitli, dönmeyen (orbit yerine
  pan + zoom) 2D-benzeri navigasyon.
- View Mode ile Lit/Wireframe (UE'de Unlit, Detail Lighting vb. de var — Forge
  kapsamı başlangıçta **yalnızca Lit + Wireframe**) bağımsız seçilebilir; ortografik
  görünümde kullanıcı isterse Lit'e geçebilir.
- Perspective'e dönünce shading otomatik Lit'e döner (Faz 1'de bu kural durum
  seviyesinde zaten kodlu).

---

## 3. Mevcut motor kısıtları (neden bu iş nontrivial)

Kamera tek bir **`PerspectiveCamera`**:

- `src/scene/SceneApp.ts:560` → `private camera: PerspectiveCamera;`
- `src/scene/SceneApp.ts:761` → `this.camera = runtimeCore.camera;` (runtime core
  perspektif kamerayı üretir; runtime `/` bu kamerayı paylaşır).
- Render: `this.renderer.render(this.scene, this.camera)` (tek çağrı).
- **Gizmo boyutu fov'a bağlı**: `src/scene/SceneApp.ts:7026-7030`
  `calculateGizmoScreenScale(this.camera.fov, distance, viewportHeight)` —
  `OrthographicCamera`'da `fov` yok; ortografikte gizmo ekran boyutu `frustum
  yüksekliği / zoom` üzerinden hesaplanmalı.
- **Kamera kontrolü**: `EditorCameraController` (`src/scene/SceneApp.ts:792`)
  orbit / pan / dolly yapıyor; dolly kamerayı **konum** olarak ileri-geri taşır.
  Ortografikte "yakınlaşma" konum değil **zoom / frustum ölçeği** olmalı, yoksa
  görüntü değişmez.
- **Raycast/picking**: `this.raycaster.setFromCamera(ndc, this.camera)` three.js'te
  hem perspektif hem ortografik kamerayı destekler; kamera referansı doğru
  olduğu sürece sorun yok — ama tüm `this.camera` kullanımları aktif kamerayı
  göstermeli.
- Sky/cloud takibi (`followCameraWithSky/Clouds`) perspektif kamerayı takip
  ediyor; ortografikte bu efektler görsel olarak anlamsızlaşabilir (kabul
  edilebilir; wireframe'de zaten atmosfer önemsiz).

---

## 4. Uygulama planı (alt fazlar)

### F2.1 — Aktif kamera soyutlaması + ortografik projeksiyon

Yaklaşım kararı: **iki kamera bulundur, aktif olanı referansla** (tam swap yerine).

- [ ] `SceneApp`'e `private orthoCamera: OrthographicCamera` ekle; perspektif
      kamerayla aynı `position/quaternion/near/far` senkronize edilir.
- [ ] `private activeCamera: Camera` (veya getter `get activeCamera()`) ekle;
      **render, raycast, gizmo ölçeği ve kamera kontrolü** `this.camera` yerine
      aktif kamerayı kullanacak şekilde güncellenir. (Runtime `/` her zaman
      perspektif kullanır — bu değişiklik editöre özgü kalmalı.)
- [ ] `applyPerspectivePose()` ve `setTechnicalView()` içinde projeksiyonu ata:
      teknik görünümler ortografik kamerayı hedef eksene kilitler; Perspective
      perspektif kameraya döner.
- [ ] Ortografik frustum'u içeriğe göre çerçevele: hedef etrafındaki mesafeye ve
      viewport en-boy oranına göre `left/right/top/bottom` hesapla; resize'da
      güncelle.
- [ ] `getCameraOrbitTarget()` / `markViewChanged()` / `syncAnglesFromCurrentView()`
      aktif kamerayla tutarlı çalışmalı.

> Alternatif (daha küçük ama daha kısıtlı): tek `PerspectiveCamera`'yı koru,
> ortografik "taklit" için çok küçük fov + çok uzak mesafe kullan. **Önerilmez** —
> gerçek paralel projeksiyon vermez, blockout ölçümü için yanıltıcı olur.

### F2.2 — Wireframe shading (View Mode render)

`applyViewMode()` içindeki TODO'yu doldur. İki aday:

- **A) `scene.overrideMaterial`** (önerilen ilk sürüm): Wireframe'de sahneye tek
  bir paylaşılan `MeshBasicMaterial({ wireframe: true })` override ata, Lit'te
  `null`'a çek. Ucuz ve tersinir; malzemeleri değiştirmez.
  - Dikkat: override **her şeyi** etkiler (gizmo, helper'lar, sky/cloud). Gizmo ve
    editör helper'ları ayrı bir katman/`Group`'ta olduğundan, ya bunları
    override'dan muaf tutmak için ayrı bir render pass gerekir, ya da
    `overrideMaterial` yerine (B) seçilir.
- **B) Traverse + `material.wireframe = true/false`** ve orijinal değeri cache'le:
  yalnızca level mesh'lerine uygula, gizmo/helper hariç. Daha çok kod ama editör
  overlay'lerini bozmaz. **Muhtemel doğru seçim**, çünkü gizmo wireframe'de de
  düzgün görünmeli.
- [ ] Karar ver (B öneriliyor), uygula, Lit'e dönüşte orijinal durumları geri yükle.
- [ ] Yeni yüklenen/spawn edilen mesh'ler aktif wireframe durumuna uymalı
      (mesh ekleme yolunda `viewMode` kontrolü).

### F2.3 — Camera ↔ View Mode bağlama davranışı (kural)

Durum kuralları Faz 1'de kodlu; bu fazda **render'a bağlanır**:

- [ ] Top/Left/Front seçilince: ortografik projeksiyon **ve** wireframe render aktif.
- [ ] Perspective seçilince: perspektif projeksiyon **ve** lit render.
- [ ] View Mode menüsünden manuel Lit/Wireframe: yalnızca shading'i değiştirir,
      projeksiyonu değiştirmez (UE davranışı). `onViewStateChanged` etiketleri
      zaten güncelliyor.

### F2.4 — Gizmo, picking ve navigasyon ortografik uyumu

- [ ] `updateGizmoScreenScale()`: ortografikte fov yerine frustum yüksekliği/zoom
      tabanlı ölçek (`calculateGizmoScreenScale`'e ortografik varyant veya ayrı
      hesap).
- [ ] `EditorCameraController`: ortografik modda dolly → `orthoCamera.zoom` /
      frustum ölçeği; orbit → devre dışı veya eksene kilitli; pan aynen çalışır.
- [ ] Raycast/picking'in aktif kamerayla doğru NDC ürettiğini doğrula (seçim,
      gizmo tutamakları, yüzey snap).

### F2.5 — Cila (opsiyonel, sonra)

- [ ] Ek ortografik yönler (Bottom/Back/Right) ve menüye eklenmesi.
- [ ] Ortografik görünümde köşe ekseni/etiketi (X/Z) overlay'i.
- [ ] Görünüm durumunun **oturum içi** kalması (layout'a **yazılmaz** — bkz. §6).
- [ ] Unlit / Detail Lighting gibi ek View Mode'lar (kapsam dışı, gelecekte).

---

## 5. Test planı

- [ ] `npx tsc --noEmit` temiz.
- [ ] Görsel: Perspective↔Top↔Left↔Front geçişlerinde projeksiyon ve shading
      birlikte değişiyor; menü etiketleri (`Perspective`/`Top`... + `Lit`/`Wireframe`)
      senkron. (Playwright screenshot ile — Faz 1'deki `shot.mjs` deseni kullanılabilir.)
- [ ] Gizmo ortografikte doğru boyutta ve tutamaklar tıklanabilir.
- [ ] Seçim/pick ortografikte çalışıyor; yüzey snap doğru.
- [ ] View Mode'dan manuel Wireframe (Perspective'deyken) projeksiyonu bozmuyor.
- [ ] `npm run build:verify` yeşil; runtime `/` hâlâ perspektif ve etkilenmemiş.
- [ ] `npm run smoke:browser` (editör boot / placement / undo-redo / save) geçiyor.

## 6. Notlar / risk

- **Save-validator etkisi yok**: kamera görünümü + view mode **oturum durumu**;
  layout dosyasına (`LayoutPlacement` vb.) yeni alan eklenmez, dolayısıyla
  `tools/saveValidator.ts` allowlist'i değişmez. (Layout'a yazmamaya özen göster.)
- **Runtime izolasyonu**: tüm bu iş editöre özgü. Runtime `/` `RuntimeSceneApp`
  perspektif kamerayı paylaşır; ortografik/wireframe editör kodu game bundle'a
  sızmamalı (mevcut `?editor` dinamik import sınırı korunur).
- **En büyük risk** aktif-kamera soyutlamasının `this.camera` kullanımlarının
  hepsini kapsamaması: render/raycast/gizmo/controller dışında sky/cloud takibi,
  Play kamera handoff (`getPlayCameraHandoff`) gibi noktalar perspektif kamerayı
  beklediğinden, ortografik aktifken bunların perspektif kamerayı kullanmaya
  devam etmesi gerekebilir. Handoff daima perspektif kamera pose'unu vermeli.
- Küçük adımlarla, her adım `tsc` + görsel doğrulama ile ilerlenmeli
  (build-passing steps).
