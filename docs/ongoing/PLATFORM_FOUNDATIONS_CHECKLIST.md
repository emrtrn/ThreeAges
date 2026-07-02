# Platform Temelleri — Eksik Sistemler Planı ve Checklist

> Tarih: 2026-07-01
> Durum: Aktif plan. Kod henüz yazılmadı.
> Amaç: Platform yeterlilik değerlendirmesinde tespit edilen, henüz hiçbir
> plana bağlanmamış temel eksikleri kapatmak: **CI/CD**, **Fizik/Collision
> sertleştirme**, **Seviye Akışı (Level Travel)**, **Save-Game/Persistence**,
> **Boot/Loading UX**, **Performans Altyapısı**.
> Kapsam dışı (ayrı planları var/olacak): AI sistemi
> (`docs/planned/AI_SYSTEM_RESEARCH_AND_PLAN.md`), VFX genişlemesi (plan
> hazırlığı kullanıcıda), networking/multiplayer, gerçek level streaming.

---

## Durum Lejantı

- `[ ]` başlanmadı
- `[~]` devam ediyor (nerede durduğu Progress Log'da)
- `[x]` bitti ve doğrulandı

Her `[x]` öncesi değişmez gate (projenin yerleşik ritmi):

```bash
npx tsc --noEmit        # temiz olmalı
npm run test:engine     # tüm check'ler (şu an 466) geçmeli
npm run build           # başarılı olmalı
# veya birleşik: npm run build:verify  (build + engine tests + strict dist scan)
```

Çalışma akışı kuralı: rutin/küçük işler için otomatik branch/commit/push yok;
iş biter, gate çalışır, kullanıcıya bildirilir. Sadece açıkça istenirse
commit/push yapılır.

Sınır kuralları (CLAUDE.md / ARCHITECTURE.md): oyun kuralları `src/game/*` +
sahne verisinde; `engine/*` editor/game import etmez; `RuntimeSceneApp` asla
`editor/*` import etmez. Yeni layout/sidecar alanları **save-validator
allowlist'ine** (`tools/saveValidator.ts`) işlenmek zorunda, yoksa kayıtta
sessizce düşer. Runtime state (save-game dahil) asla layout dosyalarına
yazılmaz — `Layout Data ≠ Save Game Data` dersi korunur.

---

## Genel Bakış ve Önerilen Sıra

| # | Faz | Bağımlılık | Neden bu sırada |
|---|-----|-----------|-----------------|
| P0 | CI/CD koruma ağı | — | Ucuz, mevcut gate'leri otomatikleştirir; sonraki tüm fazları korur. |
| P1 | Fizik/Collision sertleştirme | — | Oyun hissinin ön koşulu; saf helper'lar üstünde bağımsız ilerler. |
| P2 | Seviye Akışı (Level Travel) | — | Save-game "hangi level'dayım"a, loading UX travel'a dayanır. |
| P3 | Save-Game / Persistence | P2 | Load → level travel + spawn restore akışını kullanır. |
| P4 | Boot / Loading UX | P2 (kısmen) | İlk yükleme bağımsız; travel loading P2 API'sine bağlanır. |
| P5 | Performans Altyapısı | — | Bağımsız; diğer fazlarla paralel/aralara serpiştirilebilir. |

Önerilen akış: **P0 → P1 → P2 → P3 → P4 → P5**. P5 istenirse P1'den sonra öne
alınabilir (subsystem timing, fizik işini ölçmeyi kolaylaştırır).

---

# P0 — CI/CD Koruma Ağı

## Amaç

Elle çalıştırılan `build:verify` disiplinini otomatik bir gate'e çevirmek:
her push/PR'da tip kontrolü, engine testleri, build ve strict dist taraması
kendiliğinden çalışsın.

## Mevcut durum (kanıt)

- `.github/workflows` yok (2026-07-01 kontrol edildi); tüm gate'ler manuel.
- Gate zinciri hazır: `npm run build:verify` = `build` (içinde
  `tsc --noEmit`) + `test:engine` (466 check) + `verify:dist -- --strict`
  (`package.json:18`).
- Ek sağlık kontrolü mevcut: `npm run check:assets`
  (`tools/run-asset-manifest-health.mjs`).
- Repo'nun GitHub remote'u olup olmadığı bu planın yazımında doğrulanmadı;
  P0.1'deki karar buna bağlı.

## Kapsam kararı

- Deploy (Pages/Netlify vb.) template kapsamı dışı: her oyun fork'u kendi
  deploy hedefini seçer (`docs/planned/GAME_FORK_WORKFLOW.md` ile uyumlu).
  Bu faz yalnızca doğrulama CI'ı kurar; deploy ayrı bir fork-içi iştir.

## Checklist

- [x] **P0.1 — Remote/karar:** repo GitHub'a bağlı
  (`origin = https://github.com/emrtrn/Forge.git`, 2026-07-02 doğrulandı) →
  **A yolu (GitHub Actions)** seçildi. B yolu (pre-push hook) opsiyonel yerel
  ayna olarak backlog'da bırakıldı — istenirse eklenir.
- [x] **P0.2 — Workflow:** `.github/workflows/ci.yml` — push + PR (main),
  Node 24 (`actions/setup-node`, npm cache açık), `npm ci`,
  `npm run build:verify`, `npm run check:assets`. `concurrency` ile aynı ref'in
  uçuşta koşusu iptal edilir.
- [x] **P0.3 — Dist artifact:** başarılı build'de `dist/` 7 gün retention'lı
  artifact olarak yüklenir (`if-no-files-found: error`).
- [x] **P0.4 — Dokümantasyon:** `docs/architecture/LAUNCH_WORKFLOW.md`'ye
  "Continuous Integration" bölümü; CLAUDE.md "Working Rules"a tek satır CI notu
  eklendi.

## Kabul kriterleri

- Kasıtlı bozuk bir tip hatası push'unda CI kırmızı; düzeltince yeşil.
  *(İlk canlı koşuyla doğrulanacak — push kullanıcı onayına bağlı.)*
- CI süresi makul (< ~5 dk) — cache çalışıyor. *(İlk koşuda ölçülecek.)*

---

# P1 — Fizik/Collision Sertleştirme

## Amaç

Kinematik karakter çözümünü "düz zeminli kutu dünyası"ndan, küçük bir oyunun
gerçek level geometrisini (rampa, döndürülmüş duvar, hızlı hareket)
taşıyabilir hâle getirmek — saf/headless-test edilebilir çekirdek ritmini
bozmadan.

## Mevcut durum (kanıt)

Sanılandan ileride — G3 log'undaki "birim-küp" sınırlaması kısmen aşılmış:

- Saf planar çözüm: `src/game/collision.ts` — `resolvePlanarMovement` X/Z
  ayrı eksen (duvar kayması), dikey span gate, yalnızca-yeni-penetrasyon.
- **Zemin probe + basamak zaten var:** `findGroundAt`, `findLandingGround`,
  `filterWalkableBlockers`, `GroundProbeOptions.maxStepUp/maxStepDown`
  (`src/game/collision.ts:30-43`); default'lar `maxStepHeight 0.45`,
  `maxStepDown 0.2` (`src/game/characterMovementSystem.ts:44-45`).
- Dikey hareket: `src/game/verticalMotion.ts` — gravity/jump/floor clamp;
  floor'u caller (ground probe) sağlıyor.
- Asset-başına collision authoring tamam: primitifler, preset/kanal/yanıt
  (`docs/completed/STATIC_MESH_COLLISION_EDITOR_CHECKLIST.md`); Rapier
  backend + ragdoll mevcut (`engine/physics/physicsSubsystem.ts`).

Gerçek eksikler:

- **Eğim/rampa yok:** `src/game` altında slope/ramp izi yok (grep boş).
  AABB blocker'lar ya tam engel ya basamak; eğik yüzeyde yürüme yok.
- **Tünelleme guard'ı yok:** çözüm adım-başına; büyük `dt` spike'ı veya çok
  yüksek hızda ince duvar atlanabilir (sweep/substep yok).
- **Döndürülmüş collider davranışı doğrulanmadı:** blocker sorgusu AABB
  (`staticBlockerAabbs`); 45° döndürülmüş bir duvarın AABB şişmesinin oyun
  hissine etkisi test edilmedi.
- **Hareketli platform yok:** sorgu yalnızca *statik* blocker döndürür;
  kinematik taşıyıcı + karakteri taşıma kavramı yok.

## Kapsam kararı (karar noktası)

**Seçenek A — saf helper'ları genişlet** (öneri): mevcut headless çekirdeğe
substep + eğim desteği eklenir; test ritmi ve `engine`/`game` sınırı korunur.
**Seçenek B — Rapier KCC'ye geçiş:** Rapier'in KinematicCharacterController'ı
(shape-cast, slope limit, step offset yerleşik) kullanılır; güç kazanılır ama
headless test yüzeyi daralır, davranış Rapier sürümüne bağlanır.

Öneri: **A ile başla**; şu tetikleyicilerden biri gerçekleşirse B'ye geç:
(1) mesh-collider'lı organik geometri ihtiyacı, (2) eğim çözümünün saf AABB
dünyasında iki denemede oturmaması, (3) hareketli platform + karakter
etkileşiminin A'da kirlenmesi.

## Checklist

- [x] **P1.1 — Tünelleme guard'ı (substep):** `resolvePlanarMovementSubstepped`
  (`src/game/collision.ts`) — hareketi `safeSubstepLength` (en ince blocker
  X/Z kalınlığı / 2, 0.01 taban) uzunluğunda parçalara bölüp her parçayı
  koşan-pozisyondan yeniden çözer; `MAX_MOVEMENT_SUBSTEPS = 32` tavanı.
  `characterMovementSystem.resolvePlanarAgainstBlockers` bunu kullanır.
  **Yan bulgu + düzeltme:** substep, `resolvePlanarMovement`'taki gizli bir
  bug'ı ortaya çıkardı — "already inside" (zaten içeride) kontrolü flush
  temasta float hatasına duyarlıydı (`0.9-0.3+0.3 = 0.9000000000000001`
  "içeride" sanılıp bir sonraki itme duvardan geçiyordu; tek-geçişte de
  karelerce sürünme riski). `alreadyPenetrating` (± `PENETRATION_EPSILON`
  1e-6) ile sağlamlaştırıldı; gerçek derin örtüşme (zemin/platform içinde
  durma) muaf kalır. Headless: yüksek hızda ince duvardan geçmeme, tek-adım
  eşdeğerliği, hızlı çaprazda duvar kayması, `safeSubstepLength`.
- [x] **P1.2 — Döndürülmüş collider — DÜZELTİLDİ (sadece doğrulama değil).**
  İnceleme, çerçevelenen "AABB şişmesi"nden daha ciddi bir *bug* buldu:
  hareket-blocker AABB'leri placement rotasyonunu tamamen yok sayıyordu
  (`bodyAabb`/`primitiveAabb` yalnız `origin + center` kullanıyordu).
  Architecture duvarlarının collision kutusu pivotu köşede (ör. `Wall_400x300`
  center `[2,1.5,0]`); duvar döndürülünce bu offset döndürülmediği için
  collider **metrelerce** yanlış yere gidiyordu → kullanıcının bildirdiği
  "duvardan geçme" + "boş yolda görünmez duvar" semptomlarının kök nedeni.
  Fizik gövdesi (Rapier) ve render-mesh rotasyonu doğru uyguluyordu; sadece
  kinematik karakterin çözdüğü blocker yolu atlıyordu. **Çözüm:** saf
  `engine/physics/rotatedBox.ts` (`rotatedBoxAabb`, `rotatePointAboutOrigin`);
  `physicsSubsystem` blocker türetimi artık `body.transform.rotation` (+
  primitive local rotasyonu) ile döndürülmüş kutunun dünya AABB'sini üretir.
  Headless: 90° köşe-pivot duvar mesh'i takip eder, 45° şişme simetrik,
  primitive+body rotasyon kompozisyonu, compound + tekil collider yolları.
  **KALICI MİMARİ KARAR:** AABB hareket modeli korunur — off-axis rotasyonda
  *şişme kabul edildi* (45° ince duvar daha dolgun bir footprint alır). Tam
  OBB (dar-faz) collision backlog'da; tetikleyici: şişmenin hissi bozacak
  kadar büyük olduğu gözlenirse.
- [x] **P1.3 — Eğim/rampa spike + KALICI MİMARİ KARAR:** **Seçenek A (saf
  çekirdek) seçildi** (kullanıcı onayı 2026-07-02). Rapier grounding'e (B)
  gidilmedi — headless test yüzeyi ve `engine`/`game` sınırı korunur.
  Uygulanan varyant: rampalar **`complexAsSimple` (trimesh)** collision kullanır;
  fizik bu üçgenleri (placement rotasyonu bake edilmiş, `normalY` önceden
  hesaplı) `staticSurfaceTriangles()` ile ayrı bir kanaldan sunar; ground probe
  bunları örnekleyip gerçek eğim yüksekliğini interpolasyonla bulur, `normalY`
  üstünden slope limit uygular. **Blocker/surface ayrımı:** bir trimesh üçgeni
  `SURFACE_MAX_WALL_DEGREES` (50°) üstünde ise duvar (`staticBlockerAabbs`),
  altında ise yürünebilir yüzey — yoksa rampanın kendi üçgen-AABB'leri çıkışı
  dikey duvar gibi engellerdi. Karakterin authored slope limit'i (≤50°) yürür
  vs kayar ayrımını yapar. Tetikleyici (B'ye geçiş): mesh-collider'lı organik
  geometri veya bu ayrımın kirlenmesi.
- [x] **P1.4 — Eğim uygulaması:** `maxSlopeAngleDeg` (varsayılan 45°)
  `CharacterMovement` prop'u oldu (Rotation Rate kalıbı: `components.ts` reader
  default + `actorScript.ts` default template + `ActorScriptEditor` "Max Slope
  Angle°" alanı). Free-form component prop olduğu için `saveValidator`
  allowlist'i gerekmedi (`normalizeParams` serbest geçirir). Saf modül
  `src/game/slopeSurface.ts` (`triangleUpNormal`, `sampleTriangleHeight`
  barycentric XZ, `slopeCosFromDegrees`); ground probe
  (`findGroundAt`/`findLandingGround`) surfaces + `maxSlopeCos` tüketir;
  `characterMovementSystem` fizikten surface'leri ve karakterin limitini geçirir.
  Headless: üçgen normal/örnekleme, limit-altı rampada yürüme, limit-üstü
  reddi, düz-AABB'nin alçak rampayı yenmesi, döndürülmüş yüzey normali,
  **uçtan uca `CharacterMovementSubsystem` "rampada eğimi izleyerek yürür"**.
  **Authoring notu:** eğim desteği için rampa asset'inin collision Complexity'si
  Static Mesh editöründe **"Use Complex Collision As Simple"** olmalı; box/tilt
  collision hâlâ düz-tepeli davranır.
- [ ] **P1.5 — Test alanı içeriği:** playground'a (veya ayrı
  `CollisionGym.level.json`) merdiven, rampa, dar koridor, ince duvar,
  döndürülmüş engel bölümü. Dev sunucusunun demo layout'u otomatik
  kaydettiği bilinen davranışına dikkat (bkz. memory/CLAUDE.md) — gym'i
  default scene yapma.
- [x] **P1.6 — Hareketli platform (kinematik taşıyıcı + carry).** Yeni tipli
  `MovingPlatform` component (`offset`/`speed`/`startPhase`) + saf çekirdek
  `engine/physics/movingPlatform.ts` (ping-pong üçgen dalga, sabit hız, uçlarda
  temiz yön dönüşü — teleport yok). `MovingPlatformSubsystem` platformu sürer,
  transform'u render+fizik sink'ine yazar, her platform için güncel dünya AABB'si
  + bu-frame delta'sını `platforms()` ile yayınlar; **karakter hareketinden ÖNCE**
  register edilir (carry'de frame gecikmesi yok). Component varlığı collider'ı
  **movable (kinematik)** yapar → statik blocker cache'inden düşer (yoksa eski
  konumda hayalet AABB kalırdı). CharacterMovement platformları (a) blocker, (b)
  zemin probe yüzeyi, (c) **yatay carry** olarak tüketir; carry ayrıca
  collision-resolve edilir (platform seni duvardan içeri itemez), dikey takip
  mevcut ground-probe + step-smoothing ile; rising-platform yükselişi uphill
  ölçümünden **çıkarılır** (asansörde yürümek yavaşlamaz). `movingPlatform` alanı
  `saveValidator` allowlist'ine (`validateMovingPlatform` → `applyTransformFields`)
  işlendi; editörde Details "Moving Platform" eklenebilir component'i (yalnız
  static-mesh instance'larda) + undo/redo snapshot cloning. Headless: saf
  matematik, subsystem hareket+delta+ping-pong, adapter (movable + statik
  blocker'dan hariç), uçtan uca **carry** ve **asansör + uphill muafiyeti**,
  validator round-trip/ret. Engine 494→500. **Sınırlar (backlog):** yalnız
  translation (dönme carry'si yok); >~6 u/s dikey platform step-smooth ease'ini
  aşabilir; carry AABB modeli (dönük platform footprint şişmesi P1.2 kararıyla
  aynı).

## Kabul kriterleri

- Karakter: basamak çıkar/iner (regresyon), limit-altı rampada yürür,
  yüksek hızda ince duvardan geçmez, döndürülmüş engelde "görünmez duvar"
  hissi kabul edilen sınırda.
- Tüm yeni çekirdek saf ve `tools/engine-tests.ts`'te test edilmiş.

---

# P2 — Seviye Akışı (Level Travel)

## Amaç

Runtime'ın tek-layout hayatını bitirmek: oyun içinden başka bir level'a
geçiş (kapı/portal/menü), oyuncunun hedef spawn'da doğması, sahnenin temiz
sökülüp kurulması.

## Mevcut durum (kanıt)

- Runtime yalnızca `manifest.editor.defaultScene`'i yükler
  (`src/scene/RuntimeSceneApp.ts:876`); başka level'a geçiş API'si yok.
- Starter content'te birden çok level var (`Levels/Playground.level.json`,
  `Levels/TestLevel.level.json`) ama runtime'dan erişilemiyor.
- Spawn altyapısı mevcut: `src/game/gameModes/playerSpawn.ts`,
  `src/scene/playerStartIcon.ts`.
- Sensor collider + tek-temas davranış kalıbı hazır (`goal-reached`,
  `src/game/behaviors.ts`) — travel trigger'ı için doğal zemin.
- Schema-driven gameplay metadata Details panelinde düzenlenebiliyor
  (`public/assets/metadata-schema.json` hattı) — hedef level/spawn için yeni
  layout alanı gerekmeyebilir.

## Kapsam kararı

- Bu faz **travel**'dır, **streaming değil**: tek seferde bir level yüklü;
  async ön-yükleme/komşu level'ları açık tutma kapsam dışı.
- Travel *mekanizması* generic (engine/scene-runtime tarafı); travel
  *tetikleyicisi* oyun tarafı (`src/game` behavior + metadata).

## Checklist

- [x] **P2.1 — Teardown/rebuild denetimi + düzeltme.** `RuntimeSceneApp`'e
  `teardownScene()` eklendi: renderer/kamera/engine spine + input/resize
  listener'ları (constructor sahibi, level'lar arası paylaşılan) korunur;
  sahne sökülür. **Kritik bulgu:** yüklü GLTF'ler `GltfModelLoader`'da id ile
  cache'li/paylaşımlı — instanced statikler, karakterler, actor'lar ve override
  klonları cache'li modeli klonlar/instance'lar, bu yüzden **paylaşılan
  geometri/materyal dispose EDİLMEZ** (sonraki level için cache'te kalır),
  yalnızca sahneden çıkarılır. Yalnız sahne-sahibi GPU kaynakları dispose
  edilir: InstancedMesh instance buffer'ları (`mesh.dispose()`), sentetik
  `shape:` primitive geometrisi, probe/planar/reflective/blocking objeleri,
  sky/cloud dome'ları, reflection target'ları, ışık shadow map'leri, post-process
  pipeline, per-scene override materyalleri. Subsystem'ler **hemen** boşaltılır
  (`physics/behavior.setEntities([])`, `characterMovement.clear()`,
  `animation.clear()`) — böylece async yükleme sırasında motor boş dünya tick'ler
  (yarı-kurulu sahne asla simüle edilmez). Manuel heap doğrulaması (20+
  gidiş-geliş, Chrome profili) kullanıcıya kalan smoke.
- [x] **P2.2 — Travel API.** Saf state machine `src/scene/levelTravel.ts`
  (`idle→unloading→loading→idle`, tek pending slot = latest-wins) headless test
  edildi; `RuntimeSceneApp.requestLevelTravel(layoutPath, spawnTag?)` +
  `runTravel()` bunu sürüyor. `runTravel` ilk teardown'dan önce bir microtask
  yield eder (travel çoğunlukla behavior tick'inden istenir; sahne tick
  ortasında sökülmesin). `loadActiveProjectScene` → proje-yükleme + `buildScene`
  (ilk boot ve travel paylaşır; `startSceneRuntime` yeniden `setEntities` +
  physics init'i güvenle çalıştırır — hiçbir subsystem `start()` implemente
  etmiyor).
- [x] **P2.3 — Oyun tarafı trigger.** `level-travel` behavior'u
  (`src/game/behaviors.ts`): sensor temas + once kalıbı (`goal-reached`'ten),
  `params.targetLevel`/`targetSpawn` okur, `onLevelTravel` host callback'i
  çağırır; RuntimeSceneApp bunu `requestLevelTravel`'a bağlar. `targetLevel`
  yoksa inert.
- [x] **P2.4 — Veri/allowlist: gerek yok.** `spawnTag` placement `metadata`'sında,
  `targetLevel`/`targetSpawn` behavior `params`'ında yaşıyor — ikisi de
  `saveValidator`'ın `validateMetadata`'sından serbest geçiyor (Rotation Rate
  kalıbı). Yeni `LayoutPlacement`/singleton alanı eklenmedi, allowlist
  değişmedi.
- [x] **P2.5 — Menüden başlatma.** Shell'de rezerve `travel:<layoutPath>` /
  `travel:<layoutPath>#<spawnTag>` UI mesajı (`handleTravelUiMessage`),
  `game:*` kalıbı gibi hem screen-host hem world-UI `onMessageAction`'da
  yakalanır; `travel:` ile başlamayan mesaj yine `ui-action` olarak gameplay'e
  iletilir.
- [x] **P2.6 — Testler.** Engine 500→506 (+6): travel state machine (idle
  başlangıç, mid-travel kuyruk/latest-wins, pending promote, idle'a dönüş +
  beginLoading no-op), `findPlayerStartTransform` spawnTag (tag eşleşme > sıra,
  eşleşmeyen/yok → ilk marker, marker yok → null), `level-travel` behavior
  uçtan uca (temasta tek-ateşleme + target/spawn, targetLevel'siz inert).
  Manuel smoke (Playground ↔ TestLevel portal gidiş-geliş) kullanıcıya kalan.

## Kabul kriterleri

- Oyun içi bir portal ile iki level arasında gidip gelinebiliyor; oyuncu
  doğru spawn'da doğuyor; konsol hatasız; heap stabil.
- Editor guardrail'i korunur: travel/runtime durumu layout'a yazılmaz.

---

# P3 — Save-Game / Persistence

## Amaç

Oyuncu ilerlemesini (hangi level, nerede, hangi bayraklar) ve kullanıcı
ayarlarını (ses, locale) kalıcılaştırmak; sürümlü, bozuk-veriye dayanıklı,
oyun-fork'unun genişletebileceği generic bir katman kurmak.

## Mevcut durum (kanıt)

- Save-game **hiç yok**; repo'daki tek kalıcılık Play kamera devri
  (`src/play/cameraHandoff.ts:34` — localStorage, tek anahtar).
- Mimari ders zaten kayıtlı ama uygulanmamış: `Layout Data ≠ Save Game Data`
  (`docs/architecture/UNREAL_BASICS_LESSONS.md`, Ana Sonuç bloğu).
- Lokalizasyon/locale altyapısı mevcut (`engine/ui/uiLocale.ts`,
  `Localization/en.loc.json`/`tr.loc.json`) — "seçili dil" ayarının kalıcı
  tutulacağı yer bu fazdır.

## Kapsam kararı

- Depolama ilk fazda **localStorage** (senkron, küçük JSON); IndexedDB'ye
  geçiş tetikleyicisi: kayıt boyutunun ~100KB'ı aşması veya binary ihtiyaç.
- İki ayrı kayıt türü: **SaveGame** (slot'lu oyun ilerlemesi) ve
  **UserSettings** (slot'suz; ses seviyesi, locale, erişilebilirlik).
- Generic çekirdek `engine/`e (saf, storage-adapter'lı); *ne kaydedileceği*
  oyun tarafında (`src/game/`) serializer olarak tanımlanır. Engine, oyun
  şemasını bilmez.

## Checklist

- [x] **P3.1 — Saf çekirdek:** `engine/persistence/saveGameStore.ts` —
  generic `SaveGameStore<TPayload>` eklendi: slot listeleme/yazma/okuma/silme,
  namespaced slot key'leri, zarf şeması `{ schema, gameId, createdAt,
  updatedAt, payload }`, `migrate(fromSchema, payload)` ile tek-adımlı migration
  zinciri, bozuk/uyumsuz JSON'da `null` + logger uyarısı (crash yok), storage
  okuma/yazma/silme/listeleme hatalarında yutma + sonuç/uyarı. Storage adapter
  arayüzü + `MemoryStorageAdapter`/`createMemoryStorageAdapter` ve
  `createLocalStorageAdapter` eklendi. Headless: round-trip + overwrite
  timestamp koruması, slot sıralama/silme, 1→3 migration zinciri, corrupt JSON,
  `setItem` throw/quota yutma. Engine 506→510.
- [x] **P3.2 — Oyun serializer sözleşmesi:** `src/game/saveGame.ts` —
  `collectSaveState()` / `applySaveState()` eklendi. İlk payload kapsamı:
  aktif level path, oyuncu `position` + `facingYawDeg`, gameplay bayrakları.
  `BehaviorContext.state` artık `persist(key, value)` opt-in yüzeyi sunar;
  `BehaviorSubsystem.getPersistentStateSnapshot()` / `applyPersistentStateSnapshot()`
  yalnız bu opt-in kayıt-değer çiftlerini taşır. `lamp-toggle` davranışı
  `enabled` bayrağını kalıcı işaretler. Dikey hız/havada-olma kaydedilmez
  (spawn grounded başlar — basitlik). Headless: opt-in snapshot/restore,
  serializer collect/apply, bozuk player transform reddi, non-JSON flag filtreleme.
  Engine 510→513.
- [x] **P3.3 — Load → travel entegrasyonu:** `RuntimeSceneApp.requestSaveGameLoad(payload)`
  eklendi: payload `applySaveState()` ile doğrulanır, hedef level P2 travel
  kuyruğuna alınır, normal portal/menu travel gelirse bekleyen save restore
  temizlenir. Hedef level build + GameMode possession sonrası kayıtlı player
  transform'u spawn yerine uygulanır; `CharacterMovementSubsystem`,
  `BehaviorSubsystem`, render ve physics transform'ları aynı anda resetlenir;
  respawn baseline kayıtlı pozisyona alınır. `BehaviorSubsystem` persistent
  state snapshot'ı restore eder. Headless: restore yalnız hedef level yüklendiğinde
  tüketilir; `BehaviorSubsystem.resetEntityTransform()` sonraki tick'te eski
  transform overwrite'ını önler. Engine 513→515.
- [x] **P3.4 — UserSettings:** `engine/persistence/userSettingsStore.ts`
  ayrı slotless localStorage anahtarı (`forge.userSettings`) kullanır; ses bus
  seviyelerini (`engine/audio/audioBus.ts` hattı) ve locale tercihini saklar.
  Boot'ta audio mix hemen uygulanır; locale tabloları yüklendikten sonra user
  locale, `worldSettings.locale` üstüne override edilir. Runtime API:
  `setUserAudioBusVolume()`, `setUserLocale()`; UMG Lite için rezerve message
  action'ları: `settings:audio:<bus>:<volume>` ve `settings:locale:<locale>`.
  Bozuk veri default ayarlara düşer, write failure `false` döner. Engine 515→518.
- [x] **P3.5 — UI:** starter content'e `hud` ve `menu` `.ui.json` assetleri
  eklendi; manifest'te `hud` / `menu` id'leri `worldSettings.hudWidget` ve
  `pauseMenuWidget` referanslarını karşılar. Save/load menüsü üç sabit slotu
  (`quick`, `slot-1`, `slot-2`) ViewModel bind alanlarıyla gösterir ve
  `save:write:<slot>`, `save:load:<slot>`, `save:delete:<slot>` message
  action'ları üretir. `RuntimeSceneApp` bu mesajları `SaveGameStore<GameSaveState>`
  üzerinden `collectSaveState()` / `requestSaveGameLoad()` / `deleteSlot()` yoluna
  bağlar; slot satırları yazma/silme sonrası yenilenir. Engine 518→520.
- [x] **P3.6 — Checkpoint davranışı:** `checkpoint` behavior'u
  (`src/game/behaviors.ts`) — `goal-reached`/`level-travel` ile aynı sensor
  temas + once kalıbı: statik sensor'e ilk temasta (yalnız kinematik oyuncu
  değebilir) sahne başına **tam bir kez** otomatik kayıt yazar, kalan overlap
  storage'ı spam'lemez. `params.slot` hedef slotu seçer, yoksa **`"quick"`**
  (yerleşik yükleme menüsü ekstra authoring'siz geri yükleyebilsin diye).
  Host callback `onCheckpoint(entityId, slot)` → `RuntimeSceneApp.writeCheckpointSave()`:
  manuel save menüsüyle aynı `collectCurrentSaveState()` → `SaveGameStore.writeSlot()`
  yolu; başarısızlık konsol uyarısına düşer (checkpoint geçişi oyunu kesmez),
  başarıda save-UI alanları yenilenir (açık menü autosave'i yansıtır). Param
  free-form (`slot` behavior `params`'ında) → `saveValidator` allowlist'i
  gerekmedi; `BEHAVIOR_SCRIPT_IDS`'e eklendi (Actor Script editörü önerisi).
  Headless: authored slot'a tek-ateşleme (temas + once), slotsuz `"quick"`
  fallback. Engine 520→522.
- [ ] **P3.7 — Doğrulama içeriği:** playground'a checkpoint + toplanabilir
  bayrak örneği; kaydet → sayfayı yenile → yükle → aynı yer/bayrak smoke'u.

## Kabul kriterleri

- Yenile-sonrası tam geri dönüş: level + konum + bayraklar + ayarlar.
- Bozuk localStorage verisi oyunu düşürmez (temiz "yeni oyun" düşüşü).
- Engine katmanında oyun şeması sızıntısı yok; sınır kuralları korunur.

---

# P4 — Boot / Loading UX

## Amaç

Soğuk açılışta ve level travel sırasında siyah ekran yerine ilerleme gösteren,
hata durumunu yakalayan bir yükleme deneyimi.

## Mevcut durum (kanıt)

- Yükleme ilerlemesi/ekranı yok: `RuntimeSceneApp`'te `LoadingManager` /
  `onProgress` izi yok (grep, 2026-07-01).
- Web Audio unlock **zaten çözülmüş**: `resumeContext()`
  (`engine/audio/audioSubsystem.ts:272`) ilk `pointerdown`'a bağlı
  (`src/scene/RuntimeSceneApp.ts:1600`) — bu faz onu yeniden yapmaz.
- UMG Lite screen stack + scrim mevcut (`src/ui/RuntimeUiSubsystem.ts`) —
  loading ekranı için hazır taşıyıcı.

## Checklist

- [ ] **P4.1 — İlerleme sayacı (saf):** manifest'ten türetilen ön-yükleme
  listesi (GLB'ler, texture'lar, ses dosyaları, locale/ui json'ları) +
  `{loaded, total, failed}` sayan saf bir progress aggregator; loader
  hattına (GLTF/texture/audio yükleyicileri) tamamlanma callback'leri
  bağlanır. Headless test: sayaç, hata toplama, boş liste.
- [ ] **P4.2 — Loading ekranı:** starter content'e `UI_Loading.ui.json`;
  boot'ta screen stack'e push, progress bind (ViewModel), asset'ler hazır +
  ilk frame render olunca pop. `?debug`'da asset sayısı/süre dökümü.
- [ ] **P4.3 — Hata durumu:** kritik asset başarısızlığında retry butonlu
  hata ekranı (message action); kritik-olmayan (ör. tek ses dosyası)
  eksikte konsol uyarısı + devam. "Kritik" tanımı: layout'un referansladığı
  model asset'leri — karar netleşince buraya işlenir.
- [ ] **P4.4 — Travel loading:** P2 travel state machine'inin
  `loading` durumu aynı loading ekranını gösterir; kısa geçişlerde
  flicker'ı önlemek için minimum gösterim süresi (ör. 300ms) veya eşikli
  gecikme — karar.
- [ ] **P4.5 — "Başlamak için tıkla" (karar):** pointer-lock/fullscreen
  isteyen oyun modları için loading→başlangıç arasına opsiyonel etkileşim
  kapısı. Template default'u: kapı yok (mevcut pointerdown unlock yeterli);
  fork'lar açabilir.

## Kabul kriterleri

- Soğuk yüklemede progress görünür; yükleme bitmeden oyun input'u akmaz.
- Travel sırasında loading durumu görünür, geçiş sonrası temiz kapanır.
- Editor moduna sızıntı yok (loading UI yalnız runtime shell'de).

---

# P5 — Performans Altyapısı

## Amaç

"Yavaşladı ama neden?" sorusuna repo içinden cevap verebilmek: subsystem
zamanlamaları, bellek sayaçları, bütçe eşikleri ve offline asset raporu.

## Mevcut durum (kanıt)

- `?debug` overlay'i fps + draw call + üçgen + GameMode/UI/script-message
  anlık görüntüsü veriyor (`src/scene/debugStats.ts:20-28`); subsystem tick
  süreleri, bellek sayaçları ve eşik uyarısı yok.
- Offline asset hattı var: `npm run check:assets`
  (`tools/run-asset-manifest-health.mjs`), gltf-transform/meshoptimizer
  devDependency; runtime LOD yok.

## Kapsam kararı

- **Runtime LOD bu fazda kapsam dışı** (karar): offline optimizasyon +
  bütçe raporu önce gelir; LOD tetikleyicisi = tek sahnede üçgen bütçesinin
  içerikle aşılması ve draw-call/üçgen kaynaklı ölçülmüş fps düşüşü.
- Ölçüm kodu `?debug`/dev yolunda kalır; production frame döngüsüne sabit
  maliyet eklenmez.

## Checklist

- [ ] **P5.1 — Subsystem tick timing:** engine update döngüsünde
  (`engine/core/EngineApp.ts` hattı) debug-etkinken subsystem başına ms
  ölçümü; overlay'e "en pahalı 3 subsystem" satırı. Saf toplama/istatistik
  (rolling ortalama) headless test edilir.
- [ ] **P5.2 — Bellek sayaçları:** `renderer.info` (geometries, textures,
  programs) + varsa `performance.memory` (Chrome-only, guard'lı) overlay'e.
- [ ] **P5.3 — Bütçe eşikleri:** basit sabitler (ör. draw call, üçgen,
  texture sayısı) — aşımda overlay satırı vurgulanır. Bütçelerin nerede
  yaşayacağı karar noktası: kod sabiti (basit, öneri) vs
  `project.3dgame.json` editor alanı (fork-başına ayar; manifest şeması +
  doküman notu gerektirir).
- [ ] **P5.4 — Offline asset raporu:** `tools/`'a perf raporu (yeni script
  veya `check:assets` genişletmesi): GLB başına üçgen/vertex sayısı, texture
  boyutları/çözünürlükleri, en büyük 10 asset; eşik aşımı uyarısı. CI'a
  (P0) bilgi-amaçlı adım olarak eklenebilir (fail etmez).
- [ ] **P5.5 — Doküman:** `?debug` overlay'inin okunuşu + bütçe felsefesi
  kısa notu (`docs/architecture/LAUNCH_WORKFLOW.md` veya bu dosyanın
  sonuna).

## Kabul kriterleri

- `?debug` ile bir sahnenin darboğazı (hangi subsystem / render mi)
  overlay'den okunabiliyor.
- Asset raporu tek komutla çalışıyor; en büyük maliyetleri listeliyor.
- Production bundle'a ölçüm maliyeti sızmıyor (`build:verify` strict scan).

---

## Backlog (bu plana bilinçli alınmayanlar)

- ~~Hareketli platform (P1.6)~~ — **tamamlandı** (translation-only; dönme carry'si
  + hızlı dikey platform ince ayarı backlog'da kaldı).
- OBB/rotated collider tam desteği (P1.2 kararına bağlı).
- IndexedDB storage adapter'ı (P3 tetikleyicisi: kayıt boyutu).
- Runtime LOD + level streaming (P5 kararı: içerik ölçeği gerektirene dek).
- Cloud save / çoklu profil, networking, replay.

## Progress Log

- *2026-07-01* — Plan oluşturuldu (platform yeterlilik değerlendirmesinin
  çıktısı). Henüz hiçbir faza başlanmadı. Değerlendirme sırasında düzeltilen
  önemli tespit: zemin probe + basamak çık/in collision katmanında zaten
  mevcut (`findGroundAt`/`maxStepUp`/`maxStepDown`); P1 bu yüzden eğim,
  tünelleme, döndürülmüş collider ve platforma odaklanır. Audio unlock da
  mevcut; P4 yükleme ekranına daraltıldı.
- *2026-07-02* — **P0 tamamlandı (kod tarafı).** Remote doğrulandı
  (`github.com/emrtrn/Forge.git`) → GitHub Actions (A yolu).
  `.github/workflows/ci.yml` eklendi: push/PR→main, Node 24 + npm cache,
  `npm ci` → `build:verify` (466 engine check + `verify:dist --strict` PASS) →
  `check:assets`, başarıda `dist/` 7 gün artifact; `concurrency` ile ref
  iptali. Dokümantasyon (LAUNCH_WORKFLOW "Continuous Integration" + CLAUDE.md
  Working Rules) eklendi. Yerel gate yeşil (`npm run build:verify`). **Açık
  kalan:** canlı CI koşusu (kırmızı-on-break / yeşil-on-fix, süre < ~5 dk)
  henüz gözlenmedi — ilk push kullanıcı onayı gerektiriyor (working-style
  kuralı: otomatik push yok). B yolu (pre-push hook) opsiyonel backlog.
  **Sıradaki:** P1 — Fizik/Collision sertleştirme.
- *2026-07-02* — **P1.2 + P1.1 tamamlandı.** Kullanıcı üç semptom bildirdi:
  (1) box-collision'lı Architecture modellerinden geçme, (2) düz/açık yolda
  görünmez engel, (3) eğimli yolda düz yürüme. Kök neden analizi: (1)+(2) aynı
  bug'ın iki yüzü — **blocker AABB türetimi placement rotasyonunu yok sayıyordu**
  ve Architecture duvarlarının collision pivotu köşede (center offset ~2m), bu
  yüzden döndürülen duvarın collider'ı metrelerce kayıyordu (P1.2). Düzeltildi
  (`engine/physics/rotatedBox.ts` + `physicsSubsystem` blocker türetimi
  rotasyon-farkında; şişme kabul kararı). P1.1: `resolvePlanarMovementSubstepped`
  tünelleme guard'ı + `resolvePlanarMovement`'ta flush-temas float
  hassasiyetinin `PENETRATION_EPSILON` ile sağlamlaştırılması. Engine testleri
  466→476 (+10), `build:verify` yeşil (strict dist PASS). (3) = eğim, halen
  açık; gerçek slope desteği gerektiriyor (P1.3/P1.4) — AABB modelinde
  rampa/tilt hâlâ düz-tepeli olduğundan bu ayrı bir tasarım kararı. **Sıradaki:**
  P1.3 slope spike/karar.
- *2026-07-02* — **P1.3 + P1.4 tamamlandı (eğim/rampa, semptom #3).** Karar:
  **Seçenek A (saf çekirdek)** — kullanıcı onayladı. Rampalar `complexAsSimple`
  trimesh; fizik `staticSurfaceTriangles()` (rotasyon bake + `normalY`), ground
  probe interpolasyonla gerçek eğim yüksekliği + slope limit; trimesh üçgeni
  >50° ise duvar/blocker, ≤50° ise yürünebilir yüzey (rampanın kendi üçgenleri
  çıkışı engellemesin diye). `maxSlopeAngleDeg` (45°) CharacterMovement prop'u
  (allowlist gerekmedi — free-form). Yeni saf modül `src/game/slopeSurface.ts`.
  Engine testleri 476→486 (+10, uçtan uca "rampada eğimi izleyerek yürür"
  dahil), `build:verify` yeşil, `check:assets` PASS. **Kullanıcı için:** mevcut
  rampanın collision Complexity'sini "Use Complex Collision As Simple" yap.
  **Sıradaki:** P1.5 test alanı içeriği (rampa/merdiven gym — sanat asset'i
  gerektirir) veya P2. P1 çekirdek sertleştirmesi (tünelleme + rotasyon + eğim)
  tamam.
- *2026-07-02* — **Fizik feel iyileştirmeleri ×2 (kullanıcı geri bildirimi, P1
  devamı).** (1) **Merdiven inişinde erken düşme animasyonu:** ground probe'un
  aşağı-snap eşiği `maxStepDown` hard-coded 0.2 idi; küçük basamak derinlikleri
  karakteri airborne sayıp fall animasyonuna sokuyordu. Artık CharacterMovement
  prop'u (editörde "Max Step Down", varsayılan **0.5**) — 50 cm'e kadar iniş
  grounded kalır (stepSmoothSpeed ile yumuşak iner), daha büyük düşüş yine
  falling'e girer. (2) **Yokuş/merdiven çıkarken yürüme yavaşlaması:** yeni saf
  modül `src/game/uphillSlowdown.ts` — kare başına grounded probe hedefinin
  yükselişi / uygulanan planar mesafe = tırmanma eğimi örneği; üstel filtre
  (τ=0.25s) merdivenin spike'lı örneklerini gerçek rise/run eğimine yakınsatır
  (filtre lineer olduğundan merdiven ≈ eşdeğer rampa okur). Yeni prop
  `uphillSpeedScale` (varsayılan 0.65; 45°+ tırmanışta hız çarpanı, düze doğru
  lineer 1'e köprülenir, 1 = kapalı) planar hızı ölçekler; iniş/duruş/havada
  örnek 0 → hız τ ölçeğinde geri gelir. Rapor edilen `planarSpeed` de ölçekli
  olduğundan locomotion blend'i uyumlu yavaşlar. İki prop da free-form
  (allowlist gerekmez). Engine 487→494 (+7: saf örnekleme/yakınsama/stair-mean/
  ölçek eşlemesi + uçtan uca merdivende yavaşlayıp düzde toparlama, 0.4 iniş
  grounded, 0.6 iniş falling→landing), `build:verify` yeşil.
- *2026-07-02* — **Step-smoothing (kullanıcı geri bildirimi: merdiven step-up'ı
  anlık, kamera zıplıyor).** Kullanıcı collision+eğimi test edip commit etti;
  merdiven kurunca step yüksekliğine tek frame'de snap edip kamerayı zıplattığını
  fark etti. `characterMovementSystem` grounded zemin takibi artık
  `approachHeight` ile yeni zemine `stepSmoothSpeed` (units/s) hızında yaklaşıyor
  — step birkaç frame'e yayılıyor, rampalar etkilenmiyor (kare-başı yükseliş ease
  bütçesinin altında). `stepSmoothSpeed` (varsayılan 6) yeni CharacterMovement
  prop'u (allowlist'siz free-form; editörde "Step Smooth Speed"). Not: sabit-hız
  ease'in "hızlı merdivende geride kalma" gerilimi var; kullanıcı prop'u ayarlar,
  gerekirse Unreal-tarzı mesh/kamera-offset ayrıştırmasına geçilir. Engine 487,
  build:verify PASS.
- *2026-07-02* — **P1.6 tamamlandı: hareketli platform (kinematik carry).**
  Tipli `MovingPlatform` component (`offset`/`speed`/`startPhase`) + saf çekirdek
  `engine/physics/movingPlatform.ts` (ping-pong üçgen dalga). Yeni
  `MovingPlatformSubsystem` platformu sürer, transform'u render+fizik'e yazar,
  güncel AABB + bu-frame delta'yı `platforms()` ile sunar; **karakter
  hareketinden önce** register (carry lag'siz). Component varlığı collider'ı
  movable (kinematik) yapıyor → adapter (`colliderComponent` yeni `movable`
  param'ı) statik blocker cache'inden hariç tutuyor. CharacterMovement combined
  blocker (statik + platform) üstünde çözüyor: platform hem yan-blocker hem
  zemin; **yatay carry** ayrı collision-resolve (duvara itmez), dikey takip
  ground-probe/step-smoothing; rising-platform yükselişi uphill ölçümünden
  çıkarılıyor (asansörde yürürken yavaşlama yok). `movingPlatform` alanı
  `saveValidator`'a (`validateMovingPlatform` → `applyTransformFields`) +
  editör snapshot cloning'e işlendi; Details'te "Moving Platform" eklenebilir
  component (yalnız instance). Engine 494→500 (+6: saf math, subsystem
  hareket/delta/ping-pong, adapter movable+hariç, uçtan uca carry, asansör +
  uphill muafiyeti, validator round-trip/ret). `build:verify` + `check:assets`
  yeşil. **Backlog:** dönme carry'si, >~6 u/s dikey platform ease ince ayarı.
  P1 tamamen kapandı. **Sıradaki:** P1.5 (test alanı içeriği, sanat asset'i
  gerektirir) opsiyonel; ana faz **P2 — Level Travel**.
- *2026-07-02* — **P2 tamamlandı (kod tarafı): Seviye Akışı / Level Travel.**
  P2.1–P2.6 hepsi bitti. Saf state machine `src/scene/levelTravel.ts`
  (`idle→unloading→loading→idle`, tek pending slot latest-wins) +
  `RuntimeSceneApp.requestLevelTravel()`/`runTravel()`/`teardownScene()`/
  `buildScene()`. **Teardown denetimi (P2.1) kritik bulgu:** GLTF'ler
  `GltfModelLoader`'da paylaşımlı cache — klon/instance objelerin **paylaşılan
  geometri/materyali dispose edilmez**, yalnız sahne-sahibi kaynaklar (InstancedMesh
  buffer'ları, sentetik `shape:` geometrisi, sky/cloud/reflection/blocking/probe,
  ışık shadow map, post-process, per-scene override materyalleri). Subsystem'ler
  teardown'da hemen boşaltılır → async yüklemede motor boş dünya tick'ler.
  `level-travel` behavior'u (sensor temas+once, `targetLevel`/`targetSpawn`
  param'ları) + menü için rezerve `travel:<path>#<spawn>` UI mesajı. spawnTag,
  `findPlayerStartTransform`/`computePlayerStartSpawn`'a eklendi (metadata
  `spawnTag` eşleşme, yoksa ilk marker). **P2.4:** allowlist gerekmedi (spawnTag
  metadata'da, target'lar behavior param'ında — hepsi free-form). Engine 500→506
  (+6: state machine, spawnTag seçimi, level-travel behavior uçtan uca). Ağaç
  yeşil (tsc + test:engine 506 + build). **Not:** P1.6 (moving platform) + uphill
  ayrı bir commit'te (`0f77b6c`, başka oturumun fizik işi); bu P2 ondan
  ayrıştırılıp ayrı commit'lendi. **Kullanıcıya kalan smoke:** iki level arası
  portal gidiş-gelişi + 20+ turda heap stabilitesi (Chrome). **Sıradaki:** P3 —
  Save-Game / Persistence (P2 travel API'sine dayanır).
- *2026-07-02* — **P3.1 tamamlandı: Save-Game saf çekirdeği.**
  `engine/persistence/saveGameStore.ts` eklendi: engine oyun şemasını bilmez,
  payload generic/opaque kalır. `SaveGameStore<TPayload>` slot
  listeleme/yazma/okuma/silme, namespaced slot key'leri, `{ schema, gameId,
  createdAt, updatedAt, payload }` zarfı, tek-adımlı `migrate(fromSchema,
  payload)` zinciri, corrupt/uyumsuz JSON'da `null` + logger, storage
  hata-yutma ve sonuç/uyarı yüzeyi sağlar. `MemoryStorageAdapter` ve
  `createLocalStorageAdapter` eklendi. Headless testleri P3 bloğuna eklendi:
  round-trip/overwrite timestamp koruması, slot sıralama/silme, 1→3 migration,
  corrupt JSON ve `setItem` throw/quota yutma. Engine 506→510. **Sıradaki:**
  P3.2 — oyun serializer sözleşmesi (`collectSaveState` / `applySaveState`).
- *2026-07-02* — **P3.2 tamamlandı: oyun serializer sözleşmesi.**
  `src/game/saveGame.ts` eklendi: `collectSaveState()` aktif level path,
  oyuncu position + `facingYawDeg` ve kalıcı gameplay bayraklarını payload'a
  çevirir; `applySaveState()` bozuk payload'u reddedip P3.3'ün uygulayacağı
  restore request'i üretir. `BehaviorContext.state.persist(key, value)` opt-in
  yüzeyi eklendi; `BehaviorSubsystem` yalnız opt-in kayıt-değer çiftlerini
  `getPersistentStateSnapshot()` ile verir ve `applyPersistentStateSnapshot()`
  ile geri basabilir. `lamp-toggle` davranışı `enabled` bayrağını kalıcı işaretler.
  Dikey hız/havada-olma kaydedilmez. Headless: behavior persistent
  snapshot/restore, serializer collect/apply, geçersiz player transform reddi,
  non-JSON flag filtreleme. Engine 510→513. **Sıradaki:** P3.3 — load→travel
  entegrasyonu (level yükle, kayıtlı transform + persistent state geri uygula).
- *2026-07-02* — **P3.3 tamamlandı: load→travel entegrasyonu.**
  `RuntimeSceneApp.requestSaveGameLoad(payload)` public seam'i eklendi:
  `applySaveState()` ile doğrulanan payload hedef level'ı P2 travel kuyruğuna
  alır; normal `requestLevelTravel()` çağrısı gelirse bekleyen save restore
  temizlenir (eski kayıt daha sonra yanlış level'da uygulanmaz). Hedef level
  build + GameMode possession bittikten sonra restore tüketilir: player transform
  render/physics/CharacterMovement/BehaviorSubsystem taraflarına birlikte basılır,
  respawn baseline kayıtlı pozisyona çekilir, persistent behavior state snapshot'ı
  geri yüklenir. `BehaviorSubsystem.resetEntityTransform()` eklendi; save restore
  sonrası behavior tick'i eski transform'u geri yazmaz. Headless: save restore
  yalnız matching loaded level'da tüketilir + behavior transform reset testi.
  Engine 513→515. **Sıradaki:** P3.4 — UserSettings (audio bus volumes + locale).
- *2026-07-02* — **P3.4 tamamlandı: UserSettings.**
  `engine/persistence/userSettingsStore.ts` slotless `forge.userSettings`
  dokümanını ekledi; `audio.busVolumes` ve `locale` normalize edilip schema-1
  envelope olarak yazılır. `RuntimeSceneApp` boot'ta user audio bus seviyelerini
  uygular, locale registry kurulduğunda kullanıcı locale'ini worldSettings
  locale üstüne bindirir. Public runtime setter'ları ve rezerve UMG Lite
  mesajları eklendi: `settings:audio:<bus>:<volume>`,
  `settings:locale:<locale>`. Headless: round-trip, bozuk veri/write failure ve
  user override uygulama testleri. Engine 515→518. **Sıradaki:** P3.5 — UMG Lite
  save/load menü widget'ı ve oyun tarafı message bağları.
- *2026-07-02* — **P3.5 tamamlandı: UMG Lite save/load UI.**
  Starter `hud` ve `menu` `.ui.json` assetleri eklendi, manifest'teki `hud` /
  `menu` id'leri Playground worldSettings referanslarıyla eşlendi. `menu`
  widget'ı `quick`, `slot-1`, `slot-2` satırlarını ViewModel bind'larıyla gösterir
  ve Save/Load/Delete için `save:*:<slot>` message action'ları üretir. Oyun
  tarafında `src/game/saveGameUi.ts` slot/message sözleşmesini saf helper olarak
  tutar; `RuntimeSceneApp` aktif level path + pawn transform + persistent state'i
  `SaveGameStore<GameSaveState>` slotlarına yazar, load'u P3.3 restore akışına
  sokar, delete sonrası slot ViewModel'ini yeniler. Headless: message parser,
  ViewModel alanları, starter UI bind/action sözleşmesi. Engine 518→520.
  **Sıradaki:** P3.6 — checkpoint behavior'u.
- *2026-07-02* — **P3.6 tamamlandı: checkpoint behavior'u.**
  `checkpoint` behavior'u (`src/game/behaviors.ts`) `goal-reached`/`level-travel`
  ile aynı sensor temas + once kalıbını kullanır: statik sensor'e ilk temasta
  (yalnız kinematik oyuncu değebilir) sahne başına tam bir kez otomatik kayıt
  yazar. `params.slot` hedef slotu seçer, yoksa `"quick"` fallback (yerleşik
  yükleme menüsü ekstra authoring'siz geri yükleyebilsin). Yeni host callback
  `onCheckpoint(entityId, slot)` → `RuntimeSceneApp.writeCheckpointSave()`: manuel
  save menüsüyle aynı `collectCurrentSaveState()` → `SaveGameStore.writeSlot()`
  yolu, başarısızlıkta konsol uyarısı (checkpoint geçişi oyunu kesmez), başarıda
  save-UI alanları refresh + flush. `slot` free-form behavior param'ı → allowlist
  gerekmedi; `BEHAVIOR_SCRIPT_IDS`'e eklendi (Actor Script editörü önerisi).
  Headless: authored slot'a tek-ateşleme + slotsuz `"quick"` fallback. Engine
  520→522 (+2), `build:verify` yeşil (strict dist PASS). **Sıradaki:** P3.7 —
  doğrulama içeriği (playground'a checkpoint + toplanabilir bayrak; kaydet →
  yenile → yükle smoke'u; sanat/layout içeriği gerektirir).
