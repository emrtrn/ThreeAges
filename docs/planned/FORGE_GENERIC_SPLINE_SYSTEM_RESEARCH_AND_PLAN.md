# Forge Generic Spline System — Araştırma ve Üretim Planı

> Tarih: 2026-07-13  
> Durum: Faz 0–3 tamamlandı; Faz 4 (scene actor, save/load ve debug render) sırada.
> Bağlı çalışma: Landscape Spline **implement edilmiş durumda** — plan dokümanı
> (`LANDSCAPE_MODE_RESEARCH_AND_PLAN.md`) tamamlanıp silindi
> (`docs/COMPLETED_WORK_INDEX.md`, geçmişi git'te). Güncel referans kodun kendisidir:
> `engine/scene/landscape.ts` ve `engine/render-three/landscape.ts`.
> Amaç: Forge içinde Unreal Engine Blueprint Spline yaklaşımına benzer, Landscape'ten bağımsız, level içinde düzenlenebilir ve runtime tarafından sorgulanabilir bir **Spline Actor / Spline Component sistemi** geliştirmek.

---

## 0. Repo inceleme notları — 2026-07-13

Bu doküman yazıldıktan sonra yapılan ön-inceleme, aşağıdaki repo gerçeklerini
tespit etti. Faz 0 çalışması bu notların üstüne devam etmelidir; plandaki genel
öneriler ile çelişen her yerde **bu bölüm geçerlidir**.

### 0.1 Landscape Spline zaten var

- Veri modeli: `engine/scene/landscape.ts` — `ForgeLandscapeSpline`,
  `ForgeLandscapeSplinePoint` (per-point `width`/`falloff` ve **hâlihazırda
  `arriveTangent`/`leaveTangent` alanları var**), `ForgeLandscapeSplineSegment`.
- Eğri matematiği: uniform **Catmull-Rom** (`splineToPolyline`,
  `LANDSCAPE_SPLINE_CURVE_SUBDIVISIONS = 8`, `smooth` bayrağı). Catmull-Rom,
  cubic Hermite'in tangent'ları komşulardan türetilen özel hali olduğundan bu
  plandaki Hermite çekirdeği (`curveAuto` ≈ Catmull-Rom) ile uyumludur; Faz 11
  adapter'ı gerçekçidir.
- Mesh üretimi: `engine/render-three/landscape.ts` —
  `deformSplineMeshGeometry` (spline boyunca geometry bükme),
  `buildLandscapeSplineMeshGroup`, `computeLandscapeSplineMeshInstances`
  (rigid segment/instance yerleşimi) **çalışır durumda**. Faz 8–9 için birebir
  precedent; generic sistemin bunları kopyalamak yerine hangi kısımları
  `engine/spline` çekirdeğine çekeceği Faz 0'da belirlenmelidir.
- Kalıcılık: landscape verisi layout içinde değil `*.landscape.json` sidecar'da
  (`LayoutLandscape.dataRef`), `tools/saveValidator.ts` →
  `validateLandscapeData` → `validateLandscapeSplines` ile doğrulanıyor.
- Smoke test: `tests/smoke/landscape-spline-chain.spec.ts`.

### 0.2 Layout ve save-validator entegrasyonu (kritik)

- Layout actor deseni: `engine/scene/layout.ts` içindeki `RoomLayout`, her actor
  türünü ayrı tiplenmiş array olarak taşır (`lights`, `blockingVolumes`,
  `targetPoints`, `landscapes`, …). Generic Spline de aynı deseni izlemelidir:
  `splines?: LayoutSplineActor[]` + ortak alanlar (`id`, `name?`, `hidden?`,
  `locked?`, `groupId?`, `nodeId?`, `parentId?`, `position`, `rotation?`).
- **Allowlist tuzağı:** `/__save-layout`, `tools/saveValidator.ts` üzerinden
  yazar. Yeni `splines` array'i ve `LayoutSplineActor`'ın her alanı için orada
  bir `validateSplineActor` (ve nested spline/generator validation) eklenmezse
  veri **save sırasında sessizce düşer**. Bu, Faz 4'ün ilk maddesi olmalıdır
  (bkz. CLAUDE.md "Save-validator allowlist gotcha").

### 0.3 Adlandırma ve dosya düzeni düzeltmeleri

- Repo **camelCase düz dosya** kullanır (`engine/scene/targetPoint.ts`,
  `engine/render-three/foliage.ts`); §6'daki kebab-case iç içe klasör önerisi
  (`spline-types.ts`, `core/`) **uygulanmamalıdır**. Gerçekçi hedef:
  `engine/spline/` altında az sayıda camelCase dosya (`splineTypes.ts`,
  `splineCurve.ts`, `splineFrames.ts`, …) veya mevcut desene tam uyum için
  `engine/scene/spline.ts` + `engine/render-three/spline.ts` ayrımı.
- Editor bölünmesi: extracted editor modülleri top-level `editor/` altında
  (`core`, `gizmos`, `input`, `render-three`, `scene`); panel/UI kodu
  `src/editor/panels/*` altında (ör. `src/editor/panels/foliage/`). §6'daki
  `editor/spline/` listesi bu iki katmana dağıtılmalıdır.
- Unit testler ayrı `*.test.ts` dosyaları değildir: `npm run test:engine`,
  `tools/engine-tests.ts` içindeki `check(...)` bloklarını çalıştırır. §22.1'in
  core/frame/generator testleri oraya eklenmelidir. §22.2'deki
  `tests/smoke/spline-*.spec.ts` önerisi mevcut Playwright düzeniyle uyumludur.

### 0.4 Mevcut, örtüşen altyapılar (Faz 0'da incelenecek)

- `LayoutTargetPoint` (`engine/scene/targetPoint.ts`) — AI patrol rota
  authoring'i zaten var (`tests/smoke/ai-patrol.spec.ts`). Path Follower,
  target-point patrol ile ilişkisini (yan yana mı, ortak API mi) Faz 6'da
  netleştirmelidir.
- `LayoutMovingPlatform` behavior'ı — mevcut hareketli platform verisi.
- Foliage chunk-based instancing (`engine/scene/landscapeFoliage.ts`,
  `engine/render-three/foliage.ts`) — Faz 7 Instance Placement Generator'ın
  render yolu için birincil reuse adayı.
- Details panel özel actor entegrasyonu:
  `src/editor/panels/details/specialActorDetails.ts`.

### 0.5 Entegrasyon haritası — yeni bir actor türü nasıl eklenir (Faz 0 çıktısı, 2026-07-13)

`TargetPoint` (en yeni/en basit özel actor) iz sürülerek çıkarılan zincir; Generic
Spline Actor aynı deseni izleyecek:

1. **Tip:** `engine/scene/layout.ts` — `LayoutXxx` interface + `RoomLayout`'a
   opsiyonel array (`splines?: LayoutSplineActor[]`).
2. **Engine yardımcıları:** `engine/scene/<actor>.ts` deseni
   (ör. `engine/scene/targetPoint.ts`): `resolveXxx()` defaults +
   `uniqueXxxId()` / `uniqueXxxName()`. Spline için ek olarak eğri çekirdeği
   ayrı dosya(lar)da tutulur (`engine/scene/spline.ts` veya `engine/spline/`).
3. **Save allowlist:** `tools/saveValidator.ts` — `validateXxx` fonksiyonu +
   `validateRoomLayoutPayload` gövdesine array kablolaması (bkz. §0.2).
4. **Selection:** `editor/core/selection.ts` — `Selection` union'ına
   `{ kind: "spline"; index: number }` + `cloneSelection` / `selectionId` /
   `parseSelectionId` / `selectionsEqual` dallarına ekleme.
5. **Editor sahne entegrasyonu:** `src/scene/SceneApp.ts` —
   `private xxxObjects[]` render helper listesi; `addXxx` / `removeXxx` /
   `setXxx(index, patch)` metodları, hepsi
   `executeCommand({ label, redo, undo })` (undo/redo deseni) +
   `emitSceneObjectsChanged()` + `scheduleAutoSave()`;
   `rebuildXxxObject(index)` / `refreshXxxObject(index)` görsel güncelleme.
6. **Editor UI:** `src/editor/EditorUi.ts` —
   `bindSpecialActorButton("[data-add-spline]", "spline", ...)` Add Actor
   girişi; Details render'ı `src/editor/panels/details/specialActorDetails.ts`
   içine `renderSplineDetails(...)`.
7. **Transform gizmo:** `editor/gizmos/*` (builder/handles/interaction/
   transformDrag) — mevcut selection üzerinden çalışır; spline **point** editi
   için Faz 5'te aynı gizmo altyapısının point'e bağlanması gerekir.
8. **Runtime:** `src/scene/RuntimeSceneApp.ts` layout'tan okur; runtime
   registry precedent'i `engine/ai/targetPoints.ts`
   (`createTargetPointIndex` + `targetPointEntriesFromLayout`) — spline
   registry (`getSplineById`/`getSplinesByTag`) aynı desende
   `engine/` altında kurulmalı.
9. **Layout load/normalize:** `src/scene/roomLayout.ts` → `loadRoomLayout()` →
   `normalizeLoadedRoomLayout()` (legacy migration noktası).
10. **Asset yükleme / instancing:** `engine/render-three/gltfModelLoader.ts`,
    `models.ts` (InstancedMesh kullanımı), `engine/render-three/foliage.ts`
    (chunk-based instancing), manifest: `engine/assets/manifest.ts`.
11. **Testler:** unit → `tools/engine-tests.ts` (`check(...)`);
    smoke → `tests/smoke/spline-*.spec.ts` (Playwright,
    `landscape-spline-chain.spec.ts` örnek).

### 0.6 Faz 1'de değişecek/oluşacak dosyalar (2026-07-13)

Faz 1 yalnızca core veri modeli + validation + unit test kapsar; editor/scene
dosyalarına dokunulmaz:

- **Yeni:** `engine/scene/spline.ts` — `ForgeSplinePoint`,
  `ForgeSplineComponentData`, normalize/resolve/validate yardımcıları,
  `uniqueSplinePointId`. (Eğri matematiği Faz 2'de ayrı dosyaya —
  `engine/scene/splineCurve.ts` — eklenir; Faz 1 sadece veri sözleşmesi.)
- **Değişecek:** `tools/engine-tests.ts` — normalize/validation `check(...)`
  testleri.
- **Bilinçli olarak Faz 1 dışı:** `engine/scene/layout.ts` +
  `tools/saveValidator.ts` (`LayoutSplineActor` kablolaması Faz 4'te,
  scene entegrasyonuyla birlikte yapılır ki layout'a ölü alan girmesin).

Karar notları: geniş component/ECS refactor **gerekmiyor** (actor-first desen
bütün mevcut özel actor'larla tutarlı); spline verisi layout içinde inline
taşınabilir (landscape'in `dataRef` sidecar'ı yalnızca büyük veri için).

---

## 1. Ana karar

Forge içinde iki farklı spline kullanım alanı birbirinden ayrılmalıdır:

1. **Landscape Spline**
   - Landscape Mode'a aittir.
   - Terrain flatten/raise/lower yapar.
   - Landscape layer paint uygular.
   - Yol veya nehir yatağı gibi araziye bağlı sonuçlar üretir.

2. **Generic Spline Actor / Spline Component**
   - Level içindeki bağımsız bir scene actor'dır.
   - Landscape bulunmadan da çalışır.
   - Hareket rotaları, procedural instance yerleşimi, çit, boru, kablo, ray, özel yol sistemleri ve oyun scriptleri için kullanılabilir.
   - Runtime API ile başka actor ve sistemler tarafından sorgulanabilir.

Önerilen temel mimari:

```text
Spline Actor
├─ Spline Component
│  ├─ Control points
│  ├─ Segment interpolation
│  ├─ Arc-length cache
│  └─ Transform sampling API
│
├─ Optional editor generators
│  ├─ Instance Placement Generator
│  ├─ Rigid Segment Generator
│  ├─ Deformed Spline Mesh Generator
│  └─ Custom Script Generator
│
└─ Runtime consumers
   ├─ Path Follower
   ├─ AI route logic
   ├─ Camera rail
   ├─ Vehicle/train movement
   └─ Game-specific scripts
```

### Kesin öneri

Generic Spline, yeni bir ana editor mode olarak başlamamalıdır.

İlk kullanıcı akışı:

```text
Add Actor > Spline
→ Spline Actor seç
→ Contextual Spline Edit aracını aç
→ Point ekle/taşı/sil
→ Details panelinden spline ve generator ayarlarını düzenle
```

Bunun nedeni:

- Generic spline, Landscape gibi bütün editörü kapsayan bir çalışma modu değildir.
- Normal actor selection, transform, duplicate, hide, lock ve hierarchy davranışlarını kullanmalıdır.
- Bir level içinde çok sayıda spline bulunabilmelidir.
- Landscape Spline ile UI ve veri sahipliği karışmamalıdır.

---

## 2. Sistem hedefleri

İlk production milestone sonunda kullanıcı şunları yapabilmelidir:

1. Level'a bir Spline Actor eklemek.
2. Viewport içinde spline point eklemek, taşımak, silmek ve segmenti bölmek.
3. Linear ve smooth curve segmentler oluşturmak.
4. Spline'ı açık veya closed loop yapmak.
5. Spline uzunluğunu ve herhangi bir mesafedeki konum/yön/rotasyon/transform değerini almak.
6. Bir actor'ı spline üzerinde sabit dünya hızıyla hareket ettirmek.
7. Spline boyunca belirli aralıklarla mesh instance yerleştirmek.
8. Çit, direk, lamba veya dekorasyonu deterministic şekilde üretmek.
9. Boru, kablo, yol şeridi veya ray için segment mesh üretmek.
10. Save/Reload ve Play sonrasında spline verisini ve üretilen sonucu korumak.
11. Spline verisini game script veya Forge'un gelecekteki Blueprint benzeri sistemi üzerinden sorgulamak.
12. Landscape Spline sisteminin ileride aynı spline matematik çekirdeğini kullanabilmesine izin vermek.

---

## 3. MVP kapsamı

### MVP'ye dahil

- Level-owned `Spline Actor`.
- Reusable ve renderer bağımsız spline math çekirdeği.
- Control point position.
- Linear ve auto-smooth curve.
- Açık ve closed loop spline.
- Arc-length tablosu.
- Distance-based sampling.
- Position, tangent, direction, rotation ve transform sorguları.
- Editor point manipulation.
- Undo/Redo.
- Save/Reload.
- Runtime debug render.
- Path follower örneği.
- Instanced mesh placement.
- Rigid segment placement.
- Basit deform spline mesh üretimi.
- Deterministic randomization.
- Scriptable generator arayüzü.

### MVP dışı

- Tam Unreal Blueprint graph sistemi.
- NURBS.
- Rational Bezier.
- Spline boolean operasyonları.
- Otomatik yol intersection çözümü.
- Kavşak mesh üretimi.
- Gerçek zamanlı kablo fizik simülasyonu.
- Runtime oyuncu tarafından çizilen ağ sistemleri.
- Çok kullanıcılı eşzamanlı spline düzenleme.
- Büyük dünya streaming entegrasyonu.
- GPU compute tabanlı spline generation.
- Tam procedural road network generator.
- NavMesh'in spline tarafından otomatik bake edilmesi.

Bu sınırlar ilk sistemi küçük tutmak için bilinçlidir.

---

## 4. Landscape Spline ile sınır ilişkisi

Generic Spline ve Landscape Spline aynı kavramı kullanır ancak aynı actor değildir.

| Konu | Generic Spline | Landscape Spline |
| --- | --- | --- |
| Veri sahibi | Level / scene actor | Landscape data |
| Landscape zorunlu mu? | Hayır | Evet |
| Ana amaç | Genel rota ve procedural üretim | Terrain deformasyonu ve paint |
| Runtime query | Ana özellik | İkincil özellik |
| Bir level içinde adet | Çoklu | Landscape'e bağlı çoklu |
| Mesh üretimi | Instance, rigid segment, deform mesh | Yol/nehir segmentleri |
| Terrain değiştirme | Varsayılan olarak hayır | Evet |
| Editor girişi | Add Actor + contextual edit | Landscape Mode > Splines |

### Paylaşılması gereken altyapı

Aşağıdaki kod generic olmalıdır:

- Curve interpolation.
- Segment evaluation.
- Arc-length hesaplama.
- Distance-to-parameter lookup.
- Tangent ve frame üretimi.
- Point validation.
- Closed-loop davranışı.
- Sampling utility'leri.

### Paylaşılmaması gereken davranış

Aşağıdakiler Landscape tarafında kalmalıdır:

- Heightfield deformasyonu.
- Landscape weight paint.
- Landscape chunk dirty hesaplama.
- Terrain collision rebuild.
- Road corridor falloff maskesi.

İleride Landscape Spline şu şekilde generic çekirdeği tüketebilir:

```text
LandscapeSplineData
      ↓ normalize/adapter
SplineCurve Core
      ↓ sampled corridor
Landscape deformation + paint
```

Generic Spline actor'ın doğrudan Landscape verisini değiştirmesi MVP'de yasak olmalıdır.

---

## 5. Terminoloji

### Spline Actor

Level'a yerleştirilen actor. Transform, ad, görünürlük, kilit ve serialized spline component verisini taşır.

### Spline Component

Control point'lerden eğri oluşturan, cache üreten ve sorgu API'si sunan reusable sistem.

### Control Point

Spline'ın düzenlenebilir ana noktası.

### Segment

İki control point arasındaki spline bölümü.

### Tangent

Spline'ın bir noktadaki ilerleme yönünü ve eğri şeklini belirleyen vektör.

### Arc-length cache

Spline parametresi ile gerçek dünya mesafesi arasındaki dönüşümü hızlandıran örnekleme tablosu.

### Generator

Spline verisini kullanarak editör veya runtime çıktısı üreten modül.

### Consumer

Spline'ı değiştirmeden konum, yön veya transform verisini kullanan sistem.

---

## 6. Önerilen katmanlı mimari

```text
engine/spline/
├─ core/
│  ├─ spline-types.ts
│  ├─ spline-validation.ts
│  ├─ spline-segment.ts
│  ├─ spline-curve.ts
│  ├─ spline-arc-length.ts
│  ├─ spline-frames.ts
│  └─ spline-sampling.ts
│
├─ scene/
│  ├─ spline-actor.ts
│  ├─ spline-component.ts
│  ├─ spline-scene-adapter.ts
│  └─ spline-runtime-registry.ts
│
├─ generators/
│  ├─ spline-generator-types.ts
│  ├─ instance-placement-generator.ts
│  ├─ rigid-segment-generator.ts
│  ├─ deform-mesh-generator.ts
│  ├─ generator-cache.ts
│  └─ generator-registry.ts
│
├─ runtime/
│  ├─ spline-query-api.ts
│  ├─ spline-path-follower.ts
│  └─ spline-debug-renderer.ts
│
└─ tests/
   ├─ spline-curve.test.ts
   ├─ spline-distance.test.ts
   ├─ spline-frames.test.ts
   └─ spline-generators.test.ts

editor/spline/
├─ spline-edit-tool.ts
├─ spline-point-gizmos.ts
├─ spline-selection-state.ts
├─ spline-details-panel.ts
├─ spline-generator-panel.ts
└─ spline-editor-commands.ts
```

> **2026-07-13 düzeltmesi:** Yukarıdaki ağaç kavramsal katmanları gösterir;
> dosya adları ve düzen repo desenine uyarlanmalıdır (bkz. §0.3): camelCase düz
> dosyalar, kebab-case değil; unit testler `tools/engine-tests.ts` içinde;
> editor kodu top-level `editor/` + `src/editor/panels/*` ayrımına dağıtılır.
> Sırf bu belgeye uymak için geniş klasör refactor'u yapılmamalıdır.

---

## 7. Veri modeli önerisi

### 7.1 Level actor modeli

İlk sürümde spline verisi küçük olduğu için layout içinde tutulabilir
(`RoomLayout.splines?: LayoutSplineActor[]`; landscape'in `dataRef` sidecar
deseni yalnızca veri büyürse gerekir).

> **Save-validator zorunluluğu (2026-07-13):** `RoomLayout`'a eklenen `splines`
> array'i ve bu tipin her alanı `tools/saveValidator.ts` allowlist'ine
> (`validateSplineActor` benzeri yeni fonksiyonlar) eklenmek zorundadır; aksi
> halde alanlar Save Layout sırasında sessizce düşer. Nested
> `ForgeSplineComponentData`, `ForgeSplinePoint` ve her generator def alanı da
> aynı kurala tabidir. Bkz. §0.2 ve CLAUDE.md.

```ts
interface LayoutSplineActor {
  id: string;
  type: "spline";
  name?: string;
  hidden?: boolean;
  locked?: boolean;

  position: Vec3;
  rotation?: Vec3;
  scale?: Vec3;

  spline: ForgeSplineComponentData;
  generators?: ForgeSplineGeneratorDef[];

  runtime?: {
    enabled?: boolean;
    debugVisible?: boolean;
    tags?: string[];
  };
}
```

Actor transform ile point coordinate space net ayrılmalıdır.

Öneri:

- Serialized point konumları actor-local space'te saklanır.
- Editor ve runtime API world/local space seçeneği sunar.
- Actor transform değişince point array yeniden yazılmaz.

### 7.2 Spline component modeli

```ts
interface ForgeSplineComponentData {
  schema: 1;
  closed: boolean;
  defaultUp: Vec3;
  reparamStepsPerSegment: number;
  points: ForgeSplinePoint[];
}
```

```ts
interface ForgeSplinePoint {
  id: string;
  position: Vec3;

  pointType: "linear" | "curveAuto" | "curveCustom";

  arriveTangent?: Vec3;
  leaveTangent?: Vec3;
  tangentsLinked?: boolean;

  roll?: number;
  scale?: Vec2;

  metadata?: Record<string, string | number | boolean>;
}
```

### 7.3 İlk point type sınırı

MVP:

- `linear`
- `curveAuto`
- `curveCustom`

Sonraki faz:

- `curveClamped`
- `constant`
- Ayrı arrive/leave interpolation türleri.

### 7.4 Generator union

```ts
type ForgeSplineGeneratorDef =
  | ForgeSplineInstanceGeneratorDef
  | ForgeSplineRigidSegmentGeneratorDef
  | ForgeSplineDeformMeshGeneratorDef
  | ForgeSplineCustomGeneratorDef;
```

```ts
interface ForgeSplineGeneratorBase {
  id: string;
  type: string;
  name?: string;
  enabled?: boolean;
  editorPreview?: boolean;
  runtimeEnabled?: boolean;
  seed?: number;
}
```

---

## 8. Spline matematik modeli

### 8.1 Eğri türü

MVP için önerilen eğri modeli:

- Linear segment için doğrudan lineer interpolation.
- Curve segment için cubic Hermite interpolation.
- `curveAuto` tangent değerleri komşu point'lerden hesaplanır.
- `curveCustom` tangent değerleri serialized tutulur.

Cubic Hermite seçiminin nedenleri:

- Point + tangent modeli Unreal yaklaşımına yakındır.
- Editor tangent handle üretimi kolaydır.
- Linear ve smooth segmentler aynı segment API altında tutulabilir.
- Bezier'e dönüştürülebilir.

Örnek segment değerlendirme API'si:

```ts
interface EvaluatedSplineSample {
  position: Vec3;
  tangent: Vec3;
  direction: Vec3;
}

function evaluateSegment(
  start: ForgeSplinePoint,
  end: ForgeSplinePoint,
  t: number,
): EvaluatedSplineSample;
```

`t` değeri `0..1` aralığındadır ancak dünya mesafesi değildir.

### 8.2 Auto tangent

İlk güvenli yaklaşım:

```text
interior tangent = (next.position - previous.position) * tension
```

Uç point'lerde tek taraflı fark kullanılabilir.

Gereken ayarlar:

- Global auto tangent tension.
- Point bazında custom tangent'e geçiş.
- Closed-loop komşuluk desteği.
- Çok yakın veya çakışan point'lerde sıfır vektör koruması.

### 8.3 Arc-length tablosu

Sabit hızla hareket için parametre tabanlı değil, mesafe tabanlı sorgu gerekir.

Her segment için örnekleme tablosu:

```ts
interface SplineArcSample {
  distance: number;
  segmentIndex: number;
  t: number;
}

interface SplineArcLengthCache {
  totalLength: number;
  samples: SplineArcSample[];
  version: number;
}
```

Distance query:

```text
requested distance
→ clamp veya wrap
→ arc table içinde binary search
→ iki örnek arasında interpolation
→ segmentIndex + t
→ segment evaluation
```

Kurallar:

- Point, tangent veya actor scale değişince cache invalid olmalı.
- Her frame cache yeniden üretilmemeli.
- İlk varsayılan `reparamStepsPerSegment` 8 veya 12 olabilir.
- Deform mesh kalite ayarı runtime path sampling ayarından ayrı tutulmalıdır.

### 8.4 Coordinate space

Bütün query fonksiyonlarında açık coordinate space kullanılmalıdır:

```ts
type SplineSpace = "local" | "world";
```

Önerilen API:

```ts
getLocationAtDistance(distance, space)
getDirectionAtDistance(distance, space)
getTangentAtDistance(distance, space)
getRotationAtDistance(distance, space)
getTransformAtDistance(distance, space)
getClosestDistanceToPoint(worldPoint)
getSplineLength()
```

### 8.5 Orientation frame

Yalnızca tangent kullanmak, mesh ve actor roll davranışı için yeterli değildir.

Bir sample frame:

```ts
interface SplineFrame {
  position: Vec3;
  tangent: Vec3;
  normal: Vec3;
  binormal: Vec3;
  rotation: Quat;
  scale: Vec2;
  roll: number;
}
```

İlk yaklaşım:

1. Tangent normalize edilir.
2. `defaultUp` ile sağ vektör hesaplanır.
3. Tangent, up vektörüne çok paralelse güvenli alternatif axis seçilir.
4. Point roll değeri uygulanır.
5. Scale segment boyunca interpolate edilir.

İleri aşamada kablo ve 3D loop'larda frame flip sorununu azaltmak için **parallel transport frame** uygulanmalıdır.

Frenet frame tek başına varsayılan seçilmemelidir; curvature sıfıra yaklaştığında veya inflection point'lerde ani dönme üretebilir.

---

## 9. Editor UX önerisi

### 9.1 Actor oluşturma

```text
Add Actor
└─ Spline
   ├─ Empty Spline
   ├─ Closed Loop Spline
   ├─ Fence Spline preset
   ├─ Cable Spline preset
   └─ Road Spline preset
```

MVP'de yalnızca `Empty Spline` zorunludur. Preset'ler generator sistemi tamamlandıktan sonra eklenmelidir.

### 9.2 Edit mode

Spline Actor seçildiğinde contextual toolbar:

```text
Select Point | Add Point | Delete | Split Segment | Toggle Closed | Focus
```

Viewport davranışları:

- Point'e tıklama: point seç.
- Boş spline segmentine çift tıklama: segmenti split et.
- `Alt + Drag`: point duplicate.
- `Delete`: seçili point'i sil.
- `Shift + Click`: çoklu point seçimi.
- Transform gizmo: seçili point/point'leri taşı.
- Custom tangent modunda tangent handle göster.
- Actor kilitliyse point edit engellenir.

Kısayollar, Forge'un mevcut editor input kurallarıyla çakışmamalıdır. Repo incelemesinde mevcut interaction conventions esas alınmalıdır.

### 9.3 Point görünümü

Önerilen viewport görselleri:

- Control point: küçük küre veya kare handle.
- Seçili point: belirgin outline.
- Linear segment: düz çizgi.
- Curve segment: sampled polyline.
- Tangent handle: point'ten çıkan iki çizgi.
- Başlangıç noktası: farklı ikon veya küçük ok.
- Closed loop: son ve ilk point arasında segment.
- Direction marker: belirli aralıklarla küçük oklar; opsiyonel.

### 9.4 Details panel

Actor seviyesi:

```text
Spline
- Closed Loop
- Default Up Axis
- Reparam Steps
- Debug Visible
- Total Length (read-only)
- Point Count (read-only)
```

Point seviyesi:

```text
Selected Point
- Position
- Point Type
- Roll
- Scale X/Y
- Tangents Linked
- Arrive Tangent
- Leave Tangent
- Metadata
```

Generator seviyesi:

```text
Generators
- Add Generator
- Enable/Disable
- Preview
- Rebuild
- Seed
- Generator-specific settings
```

### 9.5 Undo/Redo

Aşağıdakilerin her biri kontrollü editor command olmalıdır:

- Point ekleme.
- Point silme.
- Point move stroke.
- Tangent değişimi.
- Point type değişimi.
- Closed loop toggle.
- Segment split.
- Generator config değişimi.

Drag sırasında her mouse move ayrı undo olmamalıdır.

Öneri:

```text
pointer down → before snapshot
pointer move → live preview
pointer up → single command commit
```

---

## 10. Runtime query API

Generic Spline'ın en önemli özelliği, yalnızca mesh üreticisi değil runtime veri kaynağı olmasıdır.

Önerilen public API:

```ts
interface SplineQuery {
  readonly id: string;

  getLength(): number;
  isClosed(): boolean;

  getLocationAtDistance(distance: number, space?: SplineSpace): Vec3;
  getDirectionAtDistance(distance: number, space?: SplineSpace): Vec3;
  getTangentAtDistance(distance: number, space?: SplineSpace): Vec3;
  getRotationAtDistance(distance: number, space?: SplineSpace): Quat;
  getTransformAtDistance(distance: number, space?: SplineSpace): Transform;

  getClosestDistanceToPoint(point: Vec3, space?: SplineSpace): number;
  getPointCount(): number;
  getPoint(index: number): Readonly<ForgeSplinePoint>;
}
```

Runtime spline registry:

```ts
getSplineById(id: string): SplineQuery | null
getSplinesByTag(tag: string): SplineQuery[]
```

Kurallar:

- Runtime consumer serialized spline array'e doğrudan erişmemelidir.
- Query API cache'i kullanmalıdır.
- Invalid spline null-safe davranmalıdır.
- Bir veya sıfır point içeren spline editorü ya da runtime'ı çökertmemelidir.

---

## 11. Path Follower sistemi

İlk örnek runtime consumer bir `Spline Path Follower` olmalıdır.

```ts
interface SplinePathFollowerConfig {
  splineId: string;
  speed: number;
  startDistance?: number;
  direction?: 1 | -1;
  wrapMode: "clamp" | "loop" | "pingPong";
  orientToSpline?: boolean;
  applyPitch?: boolean;
  applyRoll?: boolean;
  rotationOffset?: Vec3;
  positionOffset?: Vec3;
}
```

Runtime update:

```text
distance += speed * deltaSeconds * direction
→ wrap mode uygula
→ spline.getTransformAtDistance(distance)
→ offset uygula
→ actor transform güncelle
```

### Kabul davranışları

- Hız world-unit/second olmalıdır.
- FPS değişimi hareket mesafesini bozmamalıdır.
- Closed loop üzerinde dikiş noktasında sıçrama olmamalıdır.
- Ping-pong uçlarda yön değiştirmelidir.
- Ters yönde orientation doğru çevrilmelidir.
- Mesh forward axis farkı rotation offset ile çözülebilmelidir.

### AI route sınırı

Spline path, NavMesh yerine geçmez.

İlk kullanım:

- Scripted patrol.
- Camera rail.
- Tren/araç için kılavuz rota.
- Flying actor route.
- Cutscene movement.

Engelden kaçınma, pathfinding ve crowd davranışı ayrı navigation sisteminin sorumluluğudur.

---

## 12. Instance Placement Generator

Bu generator mesh'i deforme etmeden spline boyunca instance dizer.

Kullanım:

- Çit direği.
- Sokak lambası.
- Ağaç.
- Yol kenarı taşı.
- Elektrik direği.
- Dekorasyon.
- İşaret levhası.

Önerilen veri modeli:

```ts
interface ForgeSplineInstanceGeneratorDef extends ForgeSplineGeneratorBase {
  type: "instances";
  meshAsset: string;

  spacing: number;
  startOffset?: number;
  endOffset?: number;

  alignToSpline: boolean;
  applyPitch?: boolean;
  applyRoll?: boolean;

  lateralOffset?: number;
  verticalOffset?: number;
  rotationOffset?: Vec3;
  scale?: Vec3;

  random?: {
    positionJitter?: Vec3;
    rotationJitter?: Vec3;
    scaleMin?: number;
    scaleMax?: number;
  };

  placementMode?: "distance" | "point";
  includeEndPoint?: boolean;
  collision?: boolean;
}
```

### Instance üretim kuralları

- Tekrarlanan non-interactive nesneler `InstancedMesh` veya Forge eşdeğeriyle üretilmelidir.
- Her instance için actor oluşturulmamalıdır.
- Random sonuçlar seed ile deterministic olmalıdır.
- Spacing sıfır veya negatif olamaz.
- Çok kısa spline güvenli şekilde sıfır veya bir instance üretmelidir.
- Closed loop'ta ilk ve son instance üst üste binmemelidir.
- Generated objects editor selection sistemini gereksiz kalabalıklaştırmamalıdır.

### Point placement mode

`placementMode: "point"` olduğunda her control point'e bir instance yerleştirilir.

Kullanım:

- Elektrik direği noktaları.
- Yol işaretleri.
- Spline node debug nesneleri.
- Kavşak marker'ları.

---

## 13. Rigid Segment Generator

Rigid segment generator mesh'i bükmez. Spline boyunca tekrar eden düz mesh parçaları yerleştirir.

Kullanım:

- Modüler çit panelleri.
- Ray parçaları.
- Kısa boru modülleri.
- Duvar segmentleri.
- Köprü korkulukları.

```ts
interface ForgeSplineRigidSegmentGeneratorDef extends ForgeSplineGeneratorBase {
  type: "rigidSegments";
  meshAsset: string;
  segmentLength: number;
  fitMode: "fixed" | "stretchLast" | "distribute";
  alignToSpline: boolean;
  rotationOffset?: Vec3;
  scale?: Vec3;
  gap?: number;
  placePostsAtJoints?: boolean;
  jointMeshAsset?: string;
}
```

### Fit modları

- `fixed`: Sabit aralık kullan; sonda boşluk kalabilir.
- `stretchLast`: Son parçayı kalan mesafeye göre uzat.
- `distribute`: Parça sayısını hesapla ve aralığı eşit dağıt.

MVP'de `fixed` yeterlidir. Diğerleri aynı fazda küçük maliyetliyse eklenebilir.

---

## 14. Deformed Spline Mesh Generator

Bu generator, bir static mesh geometry'sini spline boyunca büker.

Kullanım:

- Yol yüzeyi.
- Kablo.
- Hortum.
- Boru.
- Ray.
- Nehir şeridi.
- Şerit ışık.

### Önemli tasarım kararı

İlk uygulama, bütün spline için tek dev geometry üretmemelidir.

Öneri:

```text
Point 0 → Point 1 = generated mesh section 0
Point 1 → Point 2 = generated mesh section 1
...
```

Bu yaklaşım:

- Dirty segment rebuild'i kolaylaştırır.
- Editor değişikliklerinde tüm geometry'yi yeniden üretmez.
- Material ve collision yönetimini sadeleştirir.
- Unreal Spline Mesh zihinsel modeline yakındır.

Önerilen veri modeli:

```ts
interface ForgeSplineDeformMeshGeneratorDef extends ForgeSplineGeneratorBase {
  type: "deformMesh";
  meshAsset: string;

  forwardAxis: "x" | "y" | "z";
  upAxis: "x" | "y" | "z";

  widthScale?: number;
  heightScale?: number;
  lateralOffset?: number;
  verticalOffset?: number;

  uvMode: "stretch" | "tileByDistance";
  uvTileLength?: number;

  sampleStepsPerSegment?: number;
  smoothNormals?: boolean;
  collision?: "none" | "generatedTrimesh";
}
```

### Deformation mantığı

Mesh vertex'leri source mesh forward axis boyunca normalize edilir:

```text
source forward coordinate
→ 0..1 segment parameter
→ spline frame sample
→ source lateral/up offset frame'e uygulanır
→ deformed world/local vertex
```

Basitleştirilmiş ifade:

```ts
position = frame.position
  + frame.binormal * sourceLateral * widthScale
  + frame.normal * sourceUp * heightScale;
```

### Mesh hazırlama kuralları

Kullanıcıya açık beklentiler:

- Mesh forward axis doğru tanımlanmalıdır.
- Mesh pivot ve başlangıç/bitiş sınırları anlamlı olmalıdır.
- Yol mesh'i segment boyunca uzayacak biçimde hazırlanmalıdır.
- UV'ler tile moduna uygun olmalıdır.
- Çok yüksek polygon mesh editor rebuild maliyetini artırır.

### İlk sürüm sınırlamaları

- Segment intersection çözmez.
- Keskin köşelerde otomatik bevel üretmez.
- Caps opsiyonel veya sonraki fazdır.
- Non-uniform actor scale dikkatle normalize edilmelidir.
- Generated collision yalnızca explicit açıldığında oluşturulmalıdır.

---

## 15. Boru ve kablo profilleri

Kablo ve boru için iki yaklaşım vardır:

### A. Hazır mesh deformasyonu

- Artist tarafından hazırlanmış segment mesh kullanılır.
- UV ve material kontrolü iyidir.
- MVP için önerilir.

### B. Procedural cross-section extrusion

- Daire, kare veya özel profile spline boyunca extrude edilir.
- Asset gerektirmez.
- Boru çapı ve radial segment sayısı kolay ayarlanır.
- Daha fazla geometry ve normal/UV kodu gerektirir.

Öneri:

- MVP: hazır mesh deformasyonu.
- Sonraki faz: `Spline Profile Asset` ile procedural extrusion.

```ts
interface ForgeSplineProfileAsset {
  schema: 1;
  type: "splineProfile";
  id: string;
  name: string;
  vertices: Vec2[];
  closed: boolean;
  materialSlots?: number[];
}
```

Hazır profiller:

- Cable Round 8.
- Pipe Round 12.
- Pipe Round 16.
- Ribbon.
- Road Strip.
- Curb.

---

## 16. Özel yol scriptleri ve generator API

Sistem yalnızca hardcoded generator'lardan oluşmamalıdır. Ancak ilk fazda kullanıcı kodunu doğrudan editor process içinde sınırsız çalıştırmak da risklidir.

Önerilen iki aşama:

### Aşama 1 — Registered engine generators

```ts
interface SplineGeneratorPlugin<TDef extends ForgeSplineGeneratorBase> {
  type: TDef["type"];
  validate(def: unknown): TDef;
  build(context: SplineGeneratorBuildContext, def: TDef): SplineGeneratorOutput;
  dispose(output: SplineGeneratorOutput): void;
}
```

Registry:

```ts
registerSplineGenerator(plugin)
```

Bu yöntemle oyun veya Forge modülleri yeni generator ekleyebilir.

### Aşama 2 — Script component bridge

Forge'un Blueprint benzeri scripting sistemi oluştuğunda spline node'ları eklenebilir:

```text
Get Spline Length
Get Location At Distance
Get Direction At Distance
Get Transform At Distance
Get Closest Distance To Point
Get Spline Point Count
Get Spline Point
```

Custom road sistemi örneği:

```text
Spline sample
→ lane center hesapla
→ road mesh üret
→ curb instance diz
→ lamp instance diz
→ gameplay lane metadata üret
```

### Generator output sınırı

Generator'lar doğrudan layout actor array'ine kalıcı child actor basmamalıdır.

Tercih edilen çıktı:

- Transient editor preview objects.
- Runtime generated render objects.
- Opsiyonel baked geometry cache.
- Açıkça istenen interactable actor output'u için ayrı `Bake To Actors` komutu.

---

## 17. Save, rebuild ve authority modeli

Kalıcı authority:

```text
Spline points + spline settings + generator definitions
```

Generated mesh/instances varsayılan authority değildir.

Akış:

```text
Load level
→ Spline Actor deserialize
→ Spline cache build
→ Enabled generators rebuild
→ Editor veya runtime output oluştur
```

Avantajları:

- Point düzenlemesi sade kalır.
- Generated child object listesi save dosyasını şişirmez.
- Deterministic rebuild mümkündür.
- Generator bug fix'leri eski level'lara uygulanabilir.

Risk:

- Çok ağır generator'lar load süresini artırabilir.

İleri çözüm:

```text
.spline-cache.bin
```

Cache anahtarı:

```text
spline data hash
+ generator config hash
+ source mesh version
+ generator version
```

MVP'de disk cache zorunlu değildir.

---

## 18. Dirty tracking ve rebuild politikası

Değişiklik türleri:

| Değişiklik | Gerekli rebuild |
| --- | --- |
| Point position | Etkilenen komşu segmentler + arc cache |
| Auto tangent point | Önceki, mevcut, sonraki segment |
| Custom tangent | İlgili segment veya segmentler |
| Closed loop toggle | İlk/son segment + full length cache |
| Generator spacing | İlgili generator full rebuild |
| Mesh asset değişimi | İlgili generator full rebuild |
| Actor transform | World transform update; mümkünse geometry rebuild yok |
| Point roll/scale | İlgili segment mesh rebuild |

İlk güvenli uygulama bütün spline cache'ini rebuild edebilir; ancak bütün level spline'larını rebuild etmemelidir.

Generator preview için debounce uygulanmalıdır:

```text
point drag
→ spline line live update
→ ağır generator preview düşük frekansta update
→ pointer up full quality rebuild
```

Önerilen davranış:

- Hafif debug line: her frame güncellenebilir.
- Instance generator: 30–60 ms debounce.
- Deform mesh: drag sırasında düşük sample; bırakınca full sample.
- Collision: drag sırasında rebuild edilmez; commit sonrası yapılır.

---

## 19. Performans ilkeleri

### 19.1 Cache

- Arc-length cache yalnızca spline değiştiğinde oluşturulmalı.
- Runtime follower her frame yalnızca binary search + segment evaluate yapmalı.
- Sample arrays typed array veya compact structures kullanabilir.

### 19.2 Instance kullanımı

- Tekrarlanan statik öğeler instancing kullanmalı.
- Binlerce generated child actor üretilmemeli.
- Frustum culling Forge'un mevcut instancing yolunu kullanmalı.

### 19.3 Geometry rebuild

- Dirty segment mantığı hedeflenmeli.
- Kaynak mesh geometry her segment için yeniden parse edilmemeli.
- Shared source vertex buffers veya preprocessed deform template cache kullanılmalı.

### 19.4 Limitler

İlk güvenli editor uyarıları:

| Ayar | Uyarı eşiği önerisi |
| --- | --- |
| Control point | 1.000+ |
| Generated instance | 10.000+ |
| Deform segment | 500+ |
| Segment sample steps | 64+ |
| Generated triangles | Proje hedeflerine göre ölçülmeli |

Hard limit yerine uyarı tercih edilmelidir. Gerçek sınırlar benchmark ile belirlenmelidir.

### 19.5 Web hedefi

Forge web tabanlı olduğu için:

- Editor drag sırasında gereksiz allocation yapılmamalıdır.
- Geometry update sonrası eski buffer ve material referansları dispose edilmelidir.
- Büyük generated geometry ana thread'i uzun süre bloklamamalıdır.
- Gerekirse ileri fazda deform mesh worker'a taşınabilir.
- Worker'a Three.js object gönderilmemeli; typed geometry data gönderilmelidir.

---

## 20. Validation ve hata davranışı

Normalize/validate katmanı aşağıdakileri ele almalıdır:

- Eksik `points` array.
- Duplicate point ID.
- NaN/Infinity position veya tangent.
- Negatif spacing.
- Geçersiz point type.
- Tek point closed loop.
- Aynı konumda ardışık point.
- Missing mesh asset.
- Invalid forward/up axis çakışması.
- Çok düşük sample step.
- Invalid generator type.
- Eski schema migration.

Kurallar:

- Invalid level verisi editorü çökertmemeli.
- Hatalı generator devre dışı kalıp açıklayıcı diagnostic üretmeli.
- Spline'ın geri kalanı kullanılabilir kalmalı.
- Save öncesi normalized schema yazılmalı.
- Missing asset düzeltildiğinde generator yeniden rebuild edilebilmeli.

---

## 21. Debug ve diagnostics

Debug overlay seçenekleri:

- Spline line.
- Control point index/id.
- Tangent vectors.
- Direction arrows.
- Arc-length sample points.
- Local frame normal/binormal.
- Segment bounds.
- Generated instance count.
- Generated triangle count.
- Rebuild time.
- Cache version.

Details panel read-only diagnostics:

```text
Length: 128.4 m
Points: 12
Segments: 11
Arc Samples: 132
Instances: 43
Generated Triangles: 18,920
Last Rebuild: 4.8 ms
Warnings: 0
```

Debug görünüm shipping runtime'da varsayılan kapalı olmalıdır.

---

## 22. Test stratejisi

### 22.1 Unit testler

> **2026-07-13:** Bu testler ayrı `*.test.ts` dosyaları olarak değil,
> `tools/engine-tests.ts` içine `check(...)` blokları olarak eklenir ve
> `npm run test:engine` ile çalışır (bkz. §0.3).

Spline core:

- Linear interpolation.
- Hermite endpoint doğruluğu.
- Tangent continuity.
- Closed-loop segment count.
- Length approximation.
- Distance clamp/wrap.
- Binary search lookup.
- Local/world transform.
- Auto tangent determinism.
- Zero-length segment güvenliği.
- NaN/Infinity koruması.

Frame:

- Düz yatay spline orientation.
- Dikey spline fallback axis.
- Roll interpolation.
- Scale interpolation.
- Ters yön sample.
- Closed-loop seam orientation.

Generator:

- Instance count.
- Spacing.
- Closed-loop duplicate önleme.
- Seed determinism.
- Missing asset handling.
- Rigid segment placement.
- Deform mesh endpoint mapping.
- UV tile length.
- Dirty segment rebuild.

### 22.2 Editor smoke testler

Önerilen dosyalar:

```text
tests/smoke/spline-actor-create.spec.ts
tests/smoke/spline-point-edit.spec.ts
tests/smoke/spline-save-reload.spec.ts
tests/smoke/spline-instance-generator.spec.ts
tests/smoke/spline-path-follower.spec.ts
tests/smoke/spline-deform-mesh.spec.ts
```

### 22.3 Ana smoke senaryosu

1. Test level aç.
2. Empty Spline Actor ekle.
3. Üç point oluştur.
4. Orta point'i yana ve yukarı taşı.
5. Point type'ı `curveAuto` yap.
6. Closed Loop aç/kapat doğrula.
7. Instance generator ekle.
8. Mesh seç ve spacing ayarla.
9. Instance sayısını doğrula.
10. Save ve reload.
11. Point positions, length ve instance count değerlerini doğrula.
12. Play aç.
13. Bir actor'ı Path Follower ile spline üzerinde hareket ettir.
14. Hızın frame rate'ten bağımsız olduğunu doğrula.
15. Level'dan çıkarken generated resource leak olmadığını doğrula.

### 22.4 Görsel test yaklaşımı

Pixel-perfect screenshot tek doğrulama kaynağı olmamalıdır.

Öncelik:

- Point world positions.
- Spline length epsilon karşılaştırması.
- Sample transform değerleri.
- Instance transform hash'i.
- Generated vertex/index count.
- Deterministic output hash.
- Resource/dispose counters.

Screenshot yalnızca UI ve kaba geometry doğrulaması için kullanılmalıdır.

---

## 23. Codex çalışma protokolü

Codex her fazda şu sırayı izlemelidir:

1. Önce mevcut scene actor, layout serialization ve editor selection kodunu bul.
2. Mevcut transform gizmo, undo/redo ve instancing desenlerini incele.
3. Landscape Spline kodu varsa yalnızca ortaklaştırılabilecek spline matematiğini tespit et; doğrudan büyük refactor yapma.
4. Public schema değişikliklerini önce type + normalize/validate + test ile ekle.
5. Spline math çekirdeğini Three.js ve editor UI'dan bağımsız geliştir.
6. Core testler geçmeden viewport tool yazma.
7. Editor preview ile runtime output'u aynı query API üzerine kur.
8. Her fazda yalnızca o fazın checklist maddelerini uygula.
9. Kapsam dışı intersection, road network, physics cable veya node graph ekleme.
10. Her faz sonunda typecheck, engine testleri ve ilgili smoke testleri çalıştır.
11. Checklist maddesini yalnızca test ve manuel doğrulama tamamlandıktan sonra `[x]` yap.
12. Gerçek dosya yollarını ve alınan mimari kararları tarihli not olarak bu dokümana ekle.

Önerilen doğrulama komutları:

```bash
npx tsc --noEmit
npm run test:engine
npm run build:verify
```

Repo içinde daha özel editor, spline veya smoke komutları varsa ayrıca çalıştırılmalıdır.

---

# 24. Fazlara ayrılmış üretim planı

## Faz 0 — Repo incelemesi ve entegrasyon haritası

### Hedef

Kod yazmadan önce Generic Spline sisteminin bağlanacağı gerçek Forge dosyalarını, veri akışlarını ve mevcut altyapıları bulmak.

### Kontrol listesi

- [x] Landscape Spline kapsamını ve güncel implementation durumunu oku. *(2026-07-13: plan dokümanı tamamlanıp silindi; güncel durum §0.1'de — `engine/scene/landscape.ts` + `engine/render-three/landscape.ts` incelendi.)*
- [x] Level/layout actor serialization tiplerini bul. *(2026-07-13: `engine/scene/layout.ts`, `RoomLayout` tiplenmiş array deseni; bkz. §0.5-1.)*
- [x] Actor create/delete/duplicate akışını bul. *(2026-07-13: `src/scene/SceneApp.ts` `addTargetPoint`/`removeTargetPoint` deseni; bkz. §0.5-5.)*
- [x] Editor selection state'i bul. *(2026-07-13: `editor/core/selection.ts` `Selection` union + `selectionStore.ts`; bkz. §0.5-4.)*
- [x] Transform gizmo implementation'ını bul. *(2026-07-13: `editor/gizmos/` — builder/handles/interaction/transformDrag; bkz. §0.5-7.)*
- [x] Undo/Redo command pattern'ini bul. *(2026-07-13: `SceneApp.executeCommand({label, redo, undo})` + `editor/core/history.ts`; bkz. §0.5-5.)*
- [x] Scene render object registry veya adapter yolunu bul. *(2026-07-13: SceneApp içi `xxxObjects[]` + `rebuild/refreshXxxObject`; bkz. §0.5-5.)*
- [x] Runtime scene load ve entity registry yolunu bul. *(2026-07-13: `src/scene/RuntimeSceneApp.ts` + registry precedent `engine/ai/targetPoints.ts`; bkz. §0.5-8/9.)*
- [x] Static mesh asset loader'ı bul. *(2026-07-13: `engine/render-three/gltfModelLoader.ts` + `engine/assets/manifest.ts`; bkz. §0.5-10.)*
- [x] Instanced mesh kullanım örneklerini bul. *(2026-07-13: `engine/render-three/foliage.ts` chunk instancing, `models.ts`, `picking.ts`; bkz. §0.5-10.)*
- [x] Geometry clone/deform utility'lerini ara. *(2026-07-13: `engine/render-three/landscape.ts` `deformSplineMeshGeometry`; bkz. §0.1.)*
- [x] Collision generation ve resource dispose desenlerini bul. *(2026-07-13: landscape collision `engine/scene/collision.ts` + `LayoutLandscape.collision` deseni; dispose deseni SceneApp object listelerinde. Derin inceleme Faz 9 collision prototipi öncesine ertelendi.)*
- [x] Existing path, rail, camera route veya waypoint sistemi varsa incele. *(2026-07-13: `LayoutTargetPoint` patrol rotaları (`engine/ai/targetPoints.ts`) ve `LayoutMovingPlatform` behavior'ı; Path Follower ile ilişki kararı Faz 6'ya not edildi — bkz. §0.4.)*
- [x] Landscape Spline için yazılmış curve math kodu varsa tespit et. *(2026-07-13: var — Catmull-Rom `splineToPolyline` + deform/instance üretimi; bkz. §0.1.)*
- [x] Reuse edilecek ve edilmeyecek modülleri belgeye yaz. *(2026-07-13: bkz. §0.1 ve §0.4.)*
- [x] `Spline Actor` için gerçek layout entegrasyon noktasını belirle. *(2026-07-13: `RoomLayout.splines?: LayoutSplineActor[]`; bkz. §0.2 ve §0.5.)*
- [x] Faz 1'de değişecek dosyaların listesini yaz. *(2026-07-13: bkz. §0.6.)*
- [x] Geniş component/ECS refactor'u gerekip gerekmediğini değerlendir. *(2026-07-13: gerekmiyor — actor-first desen mevcut bütün özel actor'larla tutarlı; bkz. §0.6.)*
- [x] MVP'de actor-first yaklaşımını doğrula. *(2026-07-13: doğrulandı; bkz. §0.6.)*

### Çıkış kriteri

- Entegrasyon dosyaları isimleriyle belgelendi.
- Core, editor, scene ve runtime sınırları netleşti.
- Faz 1 dosya kapsamı belirlendi.
- Henüz viewport tool veya mesh generator kodu yazılmadı.

---

## Faz 1 — Spline core veri modeli ve validation

### Hedef

Renderer ve editor'den bağımsız spline veri sözleşmesini oluşturmak.

### Kontrol listesi

- [x] `ForgeSplinePoint` tipini ekle. (`engine/scene/spline.ts`)
- [x] `ForgeSplineComponentData` tipini ekle.
- [x] Schema version alanını ekle.
- [x] `linear`, `curveAuto`, `curveCustom` point type'larını ekle.
- [x] Closed loop alanını ekle.
- [x] Default up alanını ekle.
- [x] Roll ve scale alanlarını ekle.
- [x] Custom tangent alanlarını ekle.
- [x] Point ID normalization ekle.
- [x] Duplicate ID düzeltme veya validation davranışını ekle.
- [x] Vec3 finite validation ekle.
- [x] Invalid point type fallback ekle.
- [x] Reparam step clamp ekle.
- [x] Boş, tek point ve iki point spline testlerini ekle.
- [x] Closed-loop minimum point davranışını test et.
- [x] Schema migration test iskeleti ekle.

### Kabul kriterleri

- Spline verisi pure TypeScript olarak normalize edilebilir.
- Hatalı input NaN veya exception üretmeden güvenli değere dönüşür.
- Unit testler geçer.
- Three.js import'u core type/validation katmanına sızmaz.

---

## Faz 2 — Segment evaluation ve arc-length cache

### Hedef

Linear ve smooth spline'ı mesafe tabanlı sorgulayabilen matematik çekirdeğini kurmak.

### Kontrol listesi

- [x] Linear segment evaluation ekle. (`engine/scene/splineCurve.ts`)
- [x] Cubic Hermite segment evaluation ekle.
- [x] Curve position fonksiyonunu ekle.
- [x] Analitik veya güvenli tangent evaluation ekle.
- [x] Auto tangent hesaplama ekle.
- [x] Closed-loop komşuluk desteği ekle.
- [x] Segment count utility ekle.
- [x] Arc-length sample table üret.
- [x] Total length hesapla.
- [x] Distance-to-segment/t binary search ekle.
- [x] Clamp davranışı ekle.
- [x] Closed-loop wrap davranışı ekle.
- [x] `getLocationAtDistance` ekle.
- [x] `getDirectionAtDistance` ekle.
- [x] `getTangentAtDistance` ekle.
- [x] Length approximation epsilon testleri ekle.
- [x] Cache invalidation/version modeli ekle.
- [x] Sıfır uzunluklu segment testleri ekle.
- [x] Determinism testleri ekle.

### Kabul kriterleri

- Aynı input aynı sample sonuçlarını üretir.
- Mesafe tabanlı hareket curve yoğunluğundan bağımsızdır.
- Closed loop seam güvenli çalışır.
- 1.000 query için gereksiz cache rebuild yapılmaz.

---

## Faz 3 — Frame, rotation ve transform sampling

### Hedef

Actor movement ve mesh generation için kararlı orientation frame üretmek.

### Kontrol listesi

- [x] Local frame veri tipini ekle. (`engine/scene/splineFrame.ts`)
- [x] Tangent + default up ile normal/binormal üret.
- [x] Parallel axis fallback ekle.
- [x] Quaternion rotation üret.
- [x] Point roll interpolation ekle.
- [x] Point scale interpolation ekle.
- [x] `getRotationAtDistance` ekle.
- [x] `getTransformAtDistance` ekle.
- [x] Local/world space dönüşümü ekle.
- [x] Actor transform ve scale etkisini test et.
- [x] Dikey spline orientation testi ekle.
- [x] Ters yönde orientation yardımcı fonksiyonu ekle.
- [x] Closed-loop seam roll testi ekle.
- [x] Parallel transport frame için tasarım notu ekle.

### Kabul kriterleri

- Yatay, eğimli ve dik spline'larda finite rotation üretilir.
- Roll ve scale segment boyunca yumuşak değişir.
- World/local query sonuçları actor transformuyla tutarlıdır.

---

## Faz 4 — Scene Spline Actor, save/load ve debug render

### Hedef

Spline verisini level-owned bağımsız actor olarak scene'e eklemek.

> İlerleme (2026-07-13): editor actor/persistence/debug render ve Play runtime
> registry foundation tamamlandı. Viewport point edit aracı Faz 5'in sonraki dilimidir.

### Kontrol listesi

- [x] `LayoutSplineActor` veya repo eşdeğeri tipi ekle (`engine/scene/layout.ts`, `RoomLayout.splines`).
- [x] Layout normalize/validate akışına spline actor ekle.
- [x] **`tools/saveValidator.ts` allowlist'ine `splines` array'ini ve bütün alanlarını ekle; Save Layout round-trip'te hiçbir alanın düşmediğini test et (bkz. §0.2).**
- [x] Add Actor > Spline komutunu ekle.
- [x] Varsayılan iki veya üç point'li spline oluştur.
- [x] Actor transform desteğini ekle. (debug renderer local spline'ı actor transformuyla world space'e örnekler)
- [x] Scene adapter/runtime object oluştur. (Play `SplineRegistry`; `?debug` sampled-line adapter'ı)
- [x] Spline sampled debug line render et. (`engine/render-three/spline.ts`)
- [x] Debug line resolution ayarını ekle.
- [x] Actor hidden/locked davranışını uygula. (renderer `hidden`'ı uygular; `locked` edit tool entegrasyonunda korunacak)
- [ ] Actor duplicate davranışını test et. (runtime registry duplicate id'leri deterministik olarak atlar; editor duplicate akışı ayrıca doğrulanacak)
- [x] Actor delete sırasında resources dispose et. (`disposeSplineObject`)
- [x] Save/Reload sonrası points ve settings korunmasını test et. (save allowlist round-trip engine testi)
- [x] Play/runtime tarafında spline registry oluştur.
- [x] Runtime debug görünürlüğünü opsiyonel yap. (`?debug`)

### Kabul kriterleri

- Kullanıcı level'a Spline Actor ekleyebilir.
- Save/Reload sonrasında şekli değişmez.
- Spline Actor normal actor transform ve hierarchy davranışlarıyla uyumludur.
- Debug renderer resource leak üretmez.

---

## Faz 5 — Viewport Spline Edit Tool

### Hedef

Control point ve tangent'ları doğrudan viewport içinde düzenlemek.

### Kontrol listesi

- [x] Spline Actor seçildiğinde contextual edit aracını göster. (selected actor için point overlay + Details panel)
- [x] Control point picking ekle. (screen-space marker picking)
- [x] Seçili point görselini ekle.
- [x] Point transform gizmo bağlantısını ekle. (world/local dönüşümü, tek undo command)
- [x] Point add komutunu ekle.
- [x] Point delete komutunu ekle.
- [x] Segment split komutunu ekle.
- [x] Closed loop toggle komutunu ekle. (Faz 4 Details kontrolü)
- [x] Linear/Curve Auto/Curve Custom point type UI ekle.
- [ ] Custom tangent handle render et.
- [ ] Tangent handle drag ekle.
- [ ] Linked/broken tangent davranışı ekle.
- [ ] Multi-select point move destekleniyorsa ekle; değilse sonraki faz notu yaz.
- [ ] Drag işlemini tek undo command yap.
- [ ] Add/Delete/Split için undo/redo ekle.
- [ ] Locked actor edit koruması ekle.
- [ ] Degenerate segment warning göster.
- [ ] Point index/id debug seçeneği ekle.
- [ ] Spline detail panelini ekle.
- [ ] Selected point detail panelini ekle.
- [ ] Editor smoke testleri ekle.

### Kabul kriterleri

- Kullanıcı viewport içinde spline şeklini oyunu çalıştırmadan düzenleyebilir.
- Undo/Redo point editlerini eksiksiz geri alır.
- Point drag sırasında editor kabul edilebilir akıcılıkta kalır.
- Save/Reload sonrası custom tangent verisi korunur.

---

## Faz 6 — Runtime query API ve Path Follower

### Hedef

Spline'ı oyun sistemlerinin kullanabileceği runtime path haline getirmek.

### Kontrol listesi

- [ ] `SplineQuery` public interface'i ekle.
- [ ] Runtime spline registry ekle.
- [ ] ID ile spline bulma ekle.
- [ ] Tag ile spline bulma ekle.
- [ ] Length query ekle.
- [ ] Location/direction/tangent/rotation/transform query'lerini aç.
- [ ] Closest-distance-to-point yaklaşımını ekle.
- [ ] Path Follower component/system ekle.
- [ ] Speed world-unit/second yap.
- [ ] Clamp wrap mode ekle.
- [ ] Loop wrap mode ekle.
- [ ] Ping-pong wrap mode ekle.
- [ ] Reverse direction ekle.
- [ ] Orientation offset ekle.
- [ ] Apply pitch/roll seçeneklerini ekle.
- [ ] Missing spline fallback davranışını ekle.
- [ ] Closed-loop seam hareket testini ekle.
- [ ] Farklı delta-time fixture testini ekle.
- [ ] Örnek patrol/camera rail test sahnesi oluştur.

### Kabul kriterleri

- Actor spline üzerinde sabit dünya hızıyla hareket eder.
- 30 FPS ve 120 FPS simülasyonunda aynı sürede yaklaşık aynı mesafeyi alır.
- Loop ve ping-pong davranışı görünür sıçrama üretmez.
- Runtime query'ler serialized veriye doğrudan bağımlı değildir.

---

## Faz 7 — Instance Placement Generator

### Hedef

Çit direği, lamba, ağaç ve dekorasyon gibi meshleri spline boyunca verimli biçimde dizmek.

### Kontrol listesi

- [ ] Generator base type ve registry ekle.
- [ ] `instances` generator schema ekle.
- [ ] Mesh asset picker ekle.
- [ ] Distance spacing ekle.
- [ ] Start/end offset ekle.
- [ ] Align-to-spline ekle.
- [ ] Lateral ve vertical offset ekle.
- [ ] Rotation offset ekle.
- [ ] Static scale ekle.
- [ ] Seeded position/rotation/scale jitter ekle.
- [ ] Closed-loop duplicate önleme ekle.
- [ ] Control-point placement mode ekle.
- [ ] Instanced render yolunu kullan.
- [ ] Source mesh missing handling ekle.
- [ ] Generator enable/disable ekle.
- [ ] Editor preview toggle ekle.
- [ ] Runtime enabled toggle ekle.
- [ ] Instance count diagnostic ekle.
- [ ] Point drag preview debounce ekle.
- [ ] Save/Reload testini ekle.
- [ ] Deterministic transform hash testi ekle.
- [ ] Resource disposal testini ekle.

### Kabul kriterleri

- Spline boyunca binlerce nesne ayrı actor oluşturmadan üretilebilir.
- Aynı seed ve config aynı instance transformlarını üretir.
- Spacing değişince yalnızca ilgili generator rebuild edilir.
- Closed-loop başlangıç noktasında duplicate instance oluşmaz.

---

## Faz 8 — Rigid Segment Generator

### Hedef

Çit paneli, ray veya modüler duvar gibi bükülmeyen parçaları spline boyunca yerleştirmek.

### Kontrol listesi

- [ ] `rigidSegments` schema ekle.
- [ ] Segment length ayarı ekle.
- [ ] Fixed fit mode ekle.
- [ ] Mesh orientation offset ekle.
- [ ] Gap ayarı ekle.
- [ ] Segment center transform hesapla.
- [ ] Segment direction alignment ekle.
- [ ] Closed-loop segment yerleşimini ekle.
- [ ] Joint post opsiyonunu ekle.
- [ ] Joint mesh asset picker ekle.
- [ ] Distribute veya stretch-last için karar notu yaz.
- [ ] Instancing uygunsa kullan.
- [ ] Kısa spline davranışını test et.
- [ ] Keskin dönüşlerde warning ekle.
- [ ] Save/Reload ve runtime parity testi ekle.

### Kabul kriterleri

- Modüler çit örneği spline boyunca üretilebilir.
- Segmentler yönle hizalanır.
- Generator editor ve runtime'da aynı yerleşimi üretir.

---

## Faz 9 — Deformed Spline Mesh

### Hedef

Yol, boru, kablo ve şerit meshlerini spline segmentlerine göre bükmek.

### Kontrol listesi

- [ ] `deformMesh` schema ekle.
- [ ] Source mesh preprocessing cache ekle.
- [ ] Forward axis seçimini ekle.
- [ ] Up axis seçimini ekle.
- [ ] Segment bazlı geometry generation ekle.
- [ ] Source forward coordinate normalization ekle.
- [ ] Spline frame üzerinden vertex deformation ekle.
- [ ] Roll ve scale uygulamasını ekle.
- [ ] Lateral/vertical offset ekle.
- [ ] Index buffer üretimini doğrula.
- [ ] Normal transformation veya recompute ekle.
- [ ] UV stretch mode ekle.
- [ ] UV tile-by-distance mode ekle.
- [ ] Sample steps ayarını ekle.
- [ ] Dirty segment rebuild ekle.
- [ ] Drag sırasında düşük kalite preview ekle.
- [ ] Commit sonrası full-quality rebuild ekle.
- [ ] Missing/invalid mesh axis warning ekle.
- [ ] Generated triangle diagnostic ekle.
- [ ] Generated geometry disposal ekle.
- [ ] Opsiyonel static trimesh collision prototipi ekle.
- [ ] Road strip test asset'i ile doğrula.
- [ ] Pipe/cable test asset'i ile doğrula.
- [ ] Closed-loop seam UV ve geometry testini ekle.

### Kabul kriterleri

- Bir road-strip mesh'i eğri boyunca görünür kırılma olmadan bükülür.
- Bir cable/pipe mesh'i roll ve scale değişimlerini takip eder.
- Point değişikliğinde yalnızca gerekli spline actor/generator rebuild edilir.
- Save/Reload ve Play sonucu editor preview ile uyumludur.

---

## Faz 10 — Generator extensibility ve script bridge

### Hedef

Forge ve oyun modüllerinin spline kullanan özel üreticiler yazabilmesini sağlamak.

### Kontrol listesi

- [ ] Typed generator plugin interface ekle.
- [ ] Generator registry lifecycle belirle.
- [ ] Validation hook ekle.
- [ ] Build/dispose hook ekle.
- [ ] Editor panel schema veya custom inspector hook kararı ver.
- [ ] Generator output ownership kurallarını yaz.
- [ ] Generator'ın layout'u doğrudan mutate etmesini engelle.
- [ ] Deterministic seed utility'yi public yap.
- [ ] Custom generator test fixture ekle.
- [ ] Example `roadDecorations` generator yaz.
- [ ] Runtime script API node/function listesi ekle.
- [ ] Spline reference property picker ekle.
- [ ] Missing plugin type fallback UI ekle.
- [ ] Plugin version/migration yaklaşımını belgeye yaz.

### Kabul kriterleri

- Yeni bir spline generator, core dosyaları değiştirilmeden registry üzerinden eklenebilir.
- Invalid veya missing plugin level load'u bozmaz.
- Custom generator aynı spline query API'sini kullanır.

---

## Faz 11 — Landscape bridge

### Hedef

Generic spline çekirdeğini Landscape Spline sistemiyle kontrollü şekilde paylaşmak; iki sistemin veri sahipliğini karıştırmamak.

### Kontrol listesi

- [ ] Mevcut Landscape Spline data modelini yeniden incele.
- [ ] Generic core'a adapter yazılabilecek alanları belirle.
- [ ] Landscape point verisini `SplineCurve` input'una dönüştüren adapter ekle.
- [ ] Terrain corridor sampler'ın generic query API kullanmasını sağla.
- [ ] Landscape width/falloff davranışını Landscape tarafında tut.
- [ ] Landscape deform ve paint kodunu generic generator registry'ye taşımama kararını koru.
- [ ] Generic Spline Actor'dan Landscape modifier oluşturma UX'ini ayrıca değerlendir.
- [ ] Gerekirse `Convert To Landscape Spline` komutu tasarla.
- [ ] Gerekirse `Create Generic Spline Copy` komutu tasarla.
- [ ] Conversion'ın destructive veya linked olup olmayacağına karar ver.
- [ ] İlk sürümde linked live-reference yerine kopya dönüşümünü tercih et.
- [ ] Landscape save/reload regression testlerini çalıştır.
- [ ] Generic spline testlerini yeniden çalıştır.

### Kabul kriterleri

- Landscape ve Generic Spline aynı math çekirdeğini kullanabilir.
- Generic Spline değişiklikleri Landscape save/render davranışını bozmaz.
- Terrain deformasyonu yalnızca Landscape-owned veri ve command akışından yapılır.

---

## Faz 12 — Performans, kalite ve production hardening

### Hedef

Sistemi gerçek Forge projelerinde güvenilir kullanılabilir hale getirmek.

### Kontrol listesi

- [ ] 10, 100, 500 ve 1.000 point benchmark yap.
- [ ] 100, 1.000 ve 10.000 instance benchmark yap.
- [ ] Deform mesh triangle benchmark yap.
- [ ] Editor drag frame-time ölç.
- [ ] Runtime query throughput ölç.
- [ ] Arc cache memory ölç.
- [ ] Generated geometry memory ölç.
- [ ] Repeated edit/save/play resource leak testi yap.
- [ ] WebGL context resource disposal doğrula.
- [ ] Chrome ve Firefox test et.
- [ ] Düşük/orta/yüksek cihaz profillerinde test et.
- [ ] Warning threshold'larını benchmark'a göre ayarla.
- [ ] Debounce ve preview quality ayarlarını tune et.
- [ ] Invalid data fuzz testleri ekle.
- [ ] Schema migration testleri ekle.
- [ ] Documentation ve tooltips yaz.
- [ ] Örnek içerik level'ı oluştur.
- [ ] Fence örneği oluştur.
- [ ] Cable/pipe örneği oluştur.
- [ ] Camera rail örneği oluştur.
- [ ] Patrol route örneği oluştur.
- [ ] Road strip örneği oluştur.
- [ ] `npx tsc --noEmit` geçir.
- [ ] `npm run test:engine` geçir.
- [ ] `npm run build:verify` geçir.
- [ ] İlgili smoke testlerin tamamını geçir.

### Kabul kriterleri

- Edit/save/reload/play döngüsü güvenilir çalışır.
- Uzun editor oturumunda generated resource leak gözlenmez.
- Orta ölçekli spline içerikleri web hedefinde kabul edilebilir performans gösterir.
- Ana kullanım örneklerinin her biri örnek level'da doğrulanır.

---

# 25. Milestone önerisi

## Milestone A — Path Core

Kapsam:

```text
Faz 0–6
```

Sonuç:

- Spline Actor.
- Viewport point düzenleme.
- Save/Reload.
- Runtime query.
- Path Follower.

Bu milestone tek başına değerlidir ve generator'lardan önce tamamlanmalıdır.

## Milestone B — Procedural Placement

Kapsam:

```text
Faz 7–8
```

Sonuç:

- Instance placement.
- Çit/direk/lamba/ağaç.
- Rigid segment yerleşimi.

## Milestone C — Spline Mesh

Kapsam:

```text
Faz 9
```

Sonuç:

- Yol.
- Boru.
- Kablo.
- Ray ve ribbon mesh.

## Milestone D — Extensibility ve Landscape paylaşımı

Kapsam:

```text
Faz 10–12
```

Sonuç:

- Custom generator API.
- Landscape core paylaşımı.
- Production hardening.

---

# 26. Birleşik production kabul kriterleri

- [ ] Level'a Generic Spline Actor eklenebilir.
- [ ] Point ekleme, silme, taşıma ve segment split çalışır.
- [ ] Linear, Auto Curve ve Custom Tangent çalışır.
- [ ] Closed Loop çalışır.
- [ ] Undo/Redo bütün temel edit işlemlerini geri alır.
- [ ] Save/Reload sonrası spline şekli korunur.
- [ ] Local/world query API çalışır.
- [ ] Arc-length tabanlı sabit hızlı hareket çalışır.
- [ ] Path Follower clamp/loop/ping-pong destekler.
- [ ] Instance Placement Generator çalışır.
- [ ] Deterministic random placement çalışır.
- [ ] Rigid Segment Generator çalışır.
- [ ] Deformed Spline Mesh çalışır.
- [ ] Road strip, pipe ve cable test içerikleri doğrulanır.
- [ ] Generated output editor/runtime paritesine sahiptir.
- [ ] Missing mesh veya invalid data editorü çökertmez.
- [ ] Closed-loop seam'de duplicate instance oluşmaz.
- [ ] Generated resources doğru dispose edilir.
- [ ] Runtime registry ID ve tag ile spline bulabilir.
- [ ] Custom generator registry üzerinden eklenebilir.
- [ ] Landscape ve Generic Spline veri sahipliği ayrıdır.
- [ ] Ortak spline math çekirdeği Landscape tarafından kullanılabilir.
- [ ] `npx tsc --noEmit` geçer.
- [ ] `npm run test:engine` geçer.
- [ ] `npm run build:verify` geçer.
- [ ] İlgili editor smoke testleri geçer.

---

# 27. Kesin önerilen ilk kararlar

Codex'in belirsizlik yaşamaması için ilk implementation'da aşağıdaki kararlar varsayılan kabul edilmelidir:

1. Sistem adı ilk aşamada **Generic Spline** veya **Spline Actor** olsun.
2. Generic Spline, Landscape Mode içine eklenmesin.
3. Spline Actor level-owned ve çoklu olsun.
4. Point verisi actor-local space'te saklansın.
5. İlk spline tipi cubic Hermite + linear olsun.
6. İlk point type seti `linear`, `curveAuto`, `curveCustom` olsun.
7. Distance query için arc-length lookup table kullanılsın.
8. Runtime movement parametre `t` ile değil world distance ile yapılsın.
9. Generated mesh ve instances kalıcı authority olmasın.
10. Save edilen authority spline data + generator config olsun.
11. Instance tekrarlarında actor yerine instancing kullanılsın.
12. Mesh deformation segment bazında yapılsın.
13. İlk deformation source static mesh üzerinden yapılsın; procedural profile extrusion sonraya bırakılsın.
14. Editor drag sırasında collision rebuild yapılmasın.
15. Generic Spline terrain'i doğrudan değiştirmesin.
16. Landscape Spline ile yalnızca core math paylaşımı hedeflensin.
17. Büyük component/ECS refactor'u MVP kapsamında yapılmasın.
18. Önce Path Core milestone'u tamamlanmadan yol/kablo generator'ına geçilmesin.
19. Custom script sistemi doğrudan arbitrary eval ile değil typed registry üzerinden başlasın.
20. Her faz sonunda test edilmemiş checklist maddesi tamamlandı işaretlenmesin.

---

# 28. Riskler ve önlemler

| Risk | Etki | Önlem |
| --- | --- | --- |
| Landscape ve Generic Spline'ın tek sistemde karışması | Veri sahipliği ve UX karmaşası | Ortak core, ayrı actor/data/UI |
| Arc-length cache olmadan hareket | Virajlarda hız değişimi | Mesafe tabanlı LUT |
| 3D spline frame flip | Kablo/yol ani dönmesi | Güvenli up fallback, sonra parallel transport |
| Her nesneyi actor üretmek | Web performans kaybı | Instanced rendering |
| Her drag'da ağır mesh rebuild | Editor takılması | Debounce + low-quality preview |
| Generated output'u save etmek | Büyük ve kırılgan level dosyası | Config authority + deterministic rebuild |
| Source mesh axis belirsizliği | Ters/bükük mesh | Explicit forward/up axis ve preview |
| Closed-loop duplicate output | Dikiş noktasında üst üste mesh | End-exclusive sampling |
| Çok genel component sistemi refactor'u | Projenin dağılması | Actor-first MVP |
| Script generator'ın kontrolsüz mutation'ı | Save ve undo bozulması | Typed build context ve output ownership |
| Collision rebuild maliyeti | Editör bloklanması | Commit sonrası ve explicit collision |
| Normal/UV bozulması | Yol ve boru görsel hataları | Segment test assets ve diagnostics |

---

# 29. Codex'e verilecek başlangıç talimatı

```text
FORGE_GENERIC_SPLINE_SYSTEM_RESEARCH_AND_PLAN.md dosyasını ana çalışma planı olarak kullan.
Önce bu dokümanın §0 "Repo inceleme notları" bölümünü ve mevcut Landscape Spline kodunu
(engine/scene/landscape.ts, engine/render-three/landscape.ts) incele; sonra Forge'un
mevcut level/layout serialization, actor creation, editor selection, transform gizmo,
undo/redo, runtime scene load, static mesh asset ve instancing yollarını incele.

Yalnızca Faz 0 üzerinde çalış. Henüz Spline Editor, mesh deformation, Path Follower veya
generator kodu yazma. Generic Spline ile Landscape Spline veri sahipliğini birleştirme.
Geniş ECS/component refactor'u yapma. Gerçek entegrasyon dosyalarını, reuse edilecek mevcut
altyapıları, riskleri ve Faz 1'de değişecek dosya listesini bu dokümana tarihli not olarak ekle.

Her fazda sadece aktif fazın kapsamını uygula. Önce type + normalize/validate + unit test,
sonra core math, sonra scene/editor/runtime entegrasyonu sırasını koru. Her faz sonunda
npx tsc --noEmit, npm run test:engine, npm run build:verify ve ilgili smoke testleri çalıştır.
Yalnızca test ve manuel doğrulaması tamamlanan checklist maddelerini [x] yap.
```

---

# 30. Önerilen ilk test sahnesi

```text
Spline_System_Test_Range
├─ Area A — Linear Path
│  └─ Sabit hızlı follower
├─ Area B — Curved Path
│  └─ Auto ve custom tangent karşılaştırması
├─ Area C — Closed Loop
│  └─ Loop ve ping-pong follower
├─ Area D — Fence Generator
│  └─ Direk + rigid panel
├─ Area E — Decoration Instances
│  └─ Lamba/ağaç ve seeded jitter
├─ Area F — Road Strip
│  └─ Deformed road mesh + UV tile
├─ Area G — Pipe/Cable
│  └─ Roll, scale ve dikey spline testi
└─ Area H — Stress Test
   ├─ 500 point spline
   ├─ 10.000 instance
   └─ Yüksek triangle deform mesh
```

Bu test sahnesi, sistem geliştikçe her milestone için tek bir görsel doğrulama alanı sağlar.

---

# 31. Sonuç

Forge için doğru yaklaşım, Landscape Spline'ı büyütüp genel amaçlı hale getirmek değildir.

Önerilen sistem:

```text
Bağımsız Spline Actor
+ reusable Spline Component core
+ distance-based runtime query API
+ generator/consumer modülleri
+ Landscape için ayrı adapter
```

Bu ayrım sayesinde aynı temel spline sistemi;

- hareket rotası,
- AI patrol yolu,
- kamera rayı,
- procedural çit,
- lamba/ağaç dizimi,
- boru,
- kablo,
- yol şeridi,
- ray,
- ve proje özel generator'lar

üretebilir. Landscape Spline ise terrain deformasyonu ve paint görevine odaklanmaya devam eder.
