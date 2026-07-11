# Procedural Heightmap Araştırması ve Forge Uygulama Planı

> Tarih: 2026-07-11  
> Durum: Gelecek çalışma planı. Kod uygulanmadı.  
> Bağlı çalışma: [LANDSCAPE_MODE_RESEARCH_AND_PLAN.md](./LANDSCAPE_MODE_RESEARCH_AND_PLAN.md)  
> Amaç: Forge Landscape sistemi içinde seed tabanlı, tekrar üretilebilir ve web ortamında
> güvenli performansla çalışabilen bir **Procedural Heightmap Generator** tasarlamak;
> uygulama fazlarını, veri modelini, editör UX'ini, testleri ve kabul kriterlerini netleştirmek.

---

## Kaynaklar

Bu plan aşağıdaki resmi veya birincil kaynaklardaki terrain üretim yaklaşımlarına göre hazırlandı:

- Gaea — terrain oluşturma iş akışları ve node kategorileri:  
  https://docs.gaea.app/using/index.html
- Gaea — erosion mantığı, resolution independence ve çok geçişli erosion:  
  https://docs.gaea.app/using/using-gaea/understanding-erosion/index.html
- Gaea — maskeler ve terrain-derived data map yaklaşımı:  
  https://docs.gaea.app/using/getting-started/basics/masks.html  
  https://docs.gaea.app/using/using-gaea/colorizing-and-textures/crafting-masks.html
- World Machine — generator, layout, erosion, material ve export yaklaşımı:  
  https://www.world-machine.com/features.php  
  https://www.world-machine.com/learn.php?page=devref
- SideFX Houdini — hydraulic/thermal erosion ve flow/sediment/debris katmanları:  
  https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_erode.html  
  https://www.sidefx.com/docs/houdini/heightfields/erosion.html
- FastNoise Lite — OpenSimplex2, Perlin, Cellular, fractal ve domain warp:  
  https://github.com/Auburn/FastNoiseLite
- Three.js — `BufferGeometry` ve typed-array tabanlı geometry attribute yapısı:  
  https://threejs.org/docs/#api/en/core/BufferGeometry
- MDN — Web Workers, transferable `ArrayBuffer` ve OffscreenCanvas:  
  https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API  
  https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects  
  https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas

> Not: FastNoise Lite MIT lisanslıdır ve JavaScript/TypeScript portu içerir. Yine de
> dependency eklenmeden önce Forge'un mevcut lisans/dependency politikası kontrol edilmelidir.

---

## Ana karar

Procedural Heightmap Generator, Forge'da ayrı bir ana editor mode olmayacak.
Mevcut **Landscape Mode** içine yeni bir **Generate** sekmesi olarak eklenecek.

Önerilen sekme sırası:

```text
Manage | Generate | Sculpt | Paint | Splines
```

Sistem şu sınırlarla başlayacak:

- Landscape'in mevcut `ForgeLandscapeData.heights` verisini üretir veya değiştirir.
- Sonuç, kullanıcı **Apply** demeden kalıcı landscape verisine yazılmaz.
- İlk sürüm destructive apply kullanır; non-destructive Edit Layers beklenmez.
- Aynı seed + aynı config + aynı generator sürümü aynı sonucu üretmelidir.
- İlk sürüm görsel node graph içermez.
- İç veri modeli ileride node graph'a dönüştürülebilecek bir operation stack olarak kurulur.
- Ağır hesaplar Dedicated Web Worker içinde yürütülür.
- İlk sürüm CPU/TypeScript tabanlıdır; WebGPU zorunlu değildir.
- Procedural üretim editör özelliğidir. Runtime procedural world generation ayrı bir çalışma olarak ele alınır.

Bu karar, mevcut Landscape planındaki level-owned heightfield, chunk render, sculpt,
paint, save/reload ve runtime collision sistemlerini yeniden kurmak yerine kullanmayı hedefler.

---

## Neden ayrı bir ana mode değil?

Procedural heightmap üretimi tek başına ayrı bir sahne varlığı değildir. Sonuçta üretilen veri:

- Landscape Actor'ın heightfield verisine uygulanır.
- Sculpt araçlarıyla elle düzenlenir.
- Paint katmanlarıyla materyallendirilir.
- Existing heightmap import/export ile birlikte çalışır.
- Landscape collision ve runtime render yolunu kullanır.

Bu nedenle kullanıcı akışı aynı bağlamda kalmalıdır:

```text
Landscape seç
→ Generate ile başlangıç terrain'i oluştur
→ Sculpt ile düzelt
→ Paint ile katmanları düzenle
→ Save
→ Play
```

---

## Hedef kullanıcı akışı

İlk birleşik milestone sonunda kullanıcı şunları yapabilmelidir:

1. Bir Landscape seçer veya yeni Landscape oluşturur.
2. Landscape Mode > Generate sekmesine geçer.
3. `Rolling Hills`, `Mountain Valley`, `Island` veya `Plateau` preset'i seçer.
4. Seed girer ya da Randomize kullanır.
5. Noise, mountain, warp ve shaping parametrelerini ayarlar.
6. Ana landscape'i değiştirmeden 2D ve 3D preview görür.
7. `Replace`, `Add`, `Subtract`, `Max`, `Min` veya `Blend` apply modunu seçer.
8. `Apply To Landscape` ile sonucu tek bir undo adımı olarak uygular.
9. Sculpt ile terrain'i elle düzenler.
10. İsteğe bağlı slope/height tabanlı otomatik weightmap üretir.
11. Save/Reload sonrası height ve paint verisinin korunduğunu görür.
12. Play modunda terrain'in render ve collision davranışını doğrular.

---

## Kapsam dışı sınırlar

İlk sürümde aşağıdakiler yapılmayacak:

- Gaea veya World Machine seviyesinde tam görsel node graph.
- Sonsuz/chunk streaming procedural world generation.
- Runtime sırasında sürekli terrain regeneration.
- Gerçek zamanlı GPU hydraulic erosion.
- Water simulation veya river mesh üretimi.
- Foliage scatter/spawn.
- Landscape Splines / Road Tool davranışlarının yeniden tasarlanması.
- Non-destructive Landscape Edit Layers.
- Cave, overhang veya dikey terrain. Heightfield yapısının doğal sınırı korunur.
- Çoklu landscape'i tek bir generator graph ile birlikte üretme.
- AI prompt'tan terrain üretme.
- Biome simulation, iklim simülasyonu veya gerçek jeolojik zaman modeli.

Bu sınırlar bilinçlidir. İlk hedef, Forge içinde güvenilir bir terrain başlangıç üreticisi oluşturmaktır.

---

## Procedural terrain uygulamalarının ortak çalışma modeli

Gaea, World Machine ve Houdini gibi araçlarda UI ve algoritmalar farklı olsa da temel zincir benzerdir:

```text
Primitive / Base Shape
        ↓
Fractal Noise / Ridge Noise
        ↓
Combine / Blend
        ↓
Mask / Curve / Warp / Terrace
        ↓
Thermal veya Hydraulic Erosion
        ↓
Derived Maps: Height / Slope / Flow / Sediment / Curvature
        ↓
Heightmap + Weightmap + Export
```

Forge karşılığı:

```text
Generator Config + Seed
        ↓
HeightField Operation Stack
        ↓
Worker Result: Float32Array
        ↓
Preview
        ↓
Apply Mode
        ↓
ForgeLandscapeData.heights
        ↓
Dirty chunk geometry refresh
        ↓
Save / Runtime collision rebuild
```

---

## Temel kavramlar

### Heightfield

Heightfield, her grid noktasında bir yükseklik değeri tutan iki boyutlu veri alanıdır.
Forge içinde ana çalışma verisi PNG değil typed array olmalıdır:

```ts
interface HeightField {
  width: number;
  height: number;
  data: Float32Array; // row-major: z * width + x
  minValue: number;
  maxValue: number;
}
```

Önerilen iç aralık:

```text
0.0 = minimum normalized height
1.0 = maximum normalized height
```

Landscape'e apply sırasında normalized değer, Landscape `heightScale` ve apply ayarlarıyla
mevcut world height modeline dönüştürülür.

### Seed ve determinism

Seed, aynı ayarlarla aynı terrain'in tekrar üretilebilmesi için zorunludur.

Determinism kriteri:

```text
same generatorVersion
+ same seed
+ same resolution
+ same config
= byte-identical veya epsilon-equal output
```

İlk sürümde bütün worker işlemleri tek bir açık seed zinciri kullanmalıdır.
`Math.random()` generator pipeline içinde kullanılmamalıdır.

Her operation kendi alt seed'ini ana seed'den türetmelidir:

```ts
const operationSeed = hashSeed(rootSeed, operation.id, operation.type);
```

Böylece stack'e yeni bir operation eklenmesi, ilgisiz operation'ların seed davranışını
istenmeden değiştirmez.

### Fractal noise

Doğal terrain görünümü için tek noise örneği yerine farklı ölçekte octave'lar birleştirilir:

```ts
function fbm2D(x: number, z: number, settings: FbmSettings): number {
  let value = 0;
  let amplitude = 1;
  let frequency = settings.frequency;
  let amplitudeSum = 0;

  for (let octave = 0; octave < settings.octaves; octave += 1) {
    value += sampleNoise(x * frequency, z * frequency) * amplitude;
    amplitudeSum += amplitude;
    frequency *= settings.lacunarity;
    amplitude *= settings.gain;
  }

  return amplitudeSum > 0 ? value / amplitudeSum : 0;
}
```

Ana parametreler:

| Parametre | Anlamı | Güvenli ilk aralık |
| --- | --- | --- |
| Seed | Tekrar üretilebilir random kaynağı | 32-bit integer |
| Frequency | Büyük/küçük terrain feature ölçeği | `0.25–8.0` normalized UI |
| Octaves | Detay katmanı sayısı | `1–8` |
| Lacunarity | Her octave frekans artışı | `1.5–3.5` |
| Gain | Her octave amplitude azalması | `0.2–0.8` |
| Amplitude | Operation etkisi | `0–1` |
| Offset | Genel height kaydırma | `-1–1` |

UI değeri doğrudan world-coordinate frequency olmak zorunda değildir. Kullanıcı dostu
normalized slider değerleri internal ölçüye dönüştürülmelidir.

### Noise türleri

MVP için önerilen türler:

| Noise türü | Kullanım | MVP |
| --- | --- | --- |
| OpenSimplex2 | Genel hills/terrain tabanı | Evet |
| Perlin | Alternatif yumuşak terrain | Evet |
| Value | Basit/debug üretim | Opsiyonel |
| Cellular/Voronoi | Kaya, plato hücresi, özel maskeler | Sonraki faz |
| Ridged fractal | Dağ sırtları | Evet |
| Billow | Yuvarlak, kabarık tepeler | Sonraki faz |

FastNoise Lite kullanılırsa OpenSimplex2, Perlin, Cellular, fractal ve domain warp hazır
olarak kullanılabilir. Dependency eklenmezse Forge içinde tek bir noise implementasyonu
ile başlanmalı; aynı fazda birden çok algoritma sıfırdan yazılmamalıdır.

### Ridged terrain

Dağ sırtı üretmek için noise değeri ridge biçimine dönüştürülür:

```ts
const ridge = 1 - Math.abs(noiseValue);
const mountain = Math.pow(clamp01(ridge), sharpness);
```

Ridged noise doğrudan bütün terrain'e eklenmek yerine bir mountain mask ile kontrol edilmelidir.

### Domain warp

Domain warp, ana noise örnekleme koordinatlarını başka noise alanlarıyla kaydırır:

```ts
const offsetX = warpX(x, z) * warpStrength;
const offsetZ = warpZ(x, z) * warpStrength;
const height = terrainNoise(x + offsetX, z + offsetZ);
```

Bu işlem:

- Düz ve mekanik noise görünümünü azaltır.
- Dağ sıralarını kıvrımlı yapar.
- Vadileri ve tepeleri daha organik dağıtır.

MVP'de warp strength sınırlı tutulmalı; aşırı warp yüksek frekanslı aliasing ve istenmeyen
keskinlik üretebilir.

### Maskeler

Maskeler bir operation'ın nerede ve ne kadar etkili olacağını belirler.

İlk maskeler:

- Constant mask.
- Radial/Island mask.
- Height range mask.
- Slope range mask.
- Noise mask.
- Invert.
- Multiply/Add mask combine.

Sonraki maskeler:

- Painted mask.
- Spline/road exclusion mask.
- Flow mask.
- Curvature mask.
- Imported PNG mask.

Operation uygulaması:

```ts
output[i] = lerp(input[i], operationResult[i], clamp01(mask[i] * strength));
```

### Height shaping

Noise sonrası terrain'i sanat yönüyle kontrol etmek için şu işlemler gerekir:

- Normalize.
- Clamp.
- Remap range.
- Bias/Gain.
- Height curve.
- Smooth/Blur.
- Sharpen.
- Terrace.
- Invert.
- Edge falloff.

İlk sürümde serbest Bezier curve editor zorunlu değildir. Hazır curve preset'leri yeterlidir:

```text
Linear
Soft Hills
Flat Lowlands
Strong Mountains
Plateau
Coastal Shelf
```

### Erosion

Noise tek başına çoğunlukla “şişirilmiş gürültü” gibi görünür. Erosion, terrain'in doğal
akış ve material transport izleri taşımasını sağlar.

Önerilen sıra:

1. Thermal erosion.
2. Basit flow accumulation.
3. Hydraulic droplet veya grid erosion.
4. Gerekirse WASM/WebGPU optimizasyonu.

#### Thermal erosion

Thermal erosion, yerel eğim talus sınırını aştığında yüksek hücreden düşük hücreye
malzeme aktarır.

Avantajları:

- Hydraulic erosion'dan daha basit.
- Deterministic yapmak kolay.
- Keskin noise sivriliklerini azaltır.
- Forge MVP'si için yeterli görsel iyileştirme sağlar.

İlk parametreler:

```ts
interface ThermalErosionSettings {
  iterations: number;      // 0–50 MVP
  talus: number;           // izin verilen yükseklik farkı/eğim
  transportRate: number;   // 0–1
  strength: number;        // 0–1
}
```

#### Hydraulic erosion

Hydraulic erosion su, sediment capacity, erosion, deposition ve evaporation simüle eder.
Daha doğal vadiler ve flow map üretir ancak daha pahalıdır.

İki yaygın yaklaşım:

- Grid-based rainfall/flow solver.
- Droplet-based particle simulation.

Forge için ilk advanced uygulamada droplet yaklaşımı daha küçük ve bağımsız bir modül olabilir.
Ancak deterministic, cancellation-aware ve iteration-budget sınırlı yazılmalıdır.

Hydraulic erosion MVP'ye dahil edilmemelidir.

---

## Landscape sistemiyle entegrasyon

Mevcut Landscape planına göre Forge şu altyapılara sahiptir veya bu çalışma başlamadan önce
bunlara sahip olmalıdır:

- `ForgeLandscapeData` height array.
- Chunked render.
- Dirty geometry update.
- Sculpt undo/redo.
- Save/reload.
- Heightmap import/export.
- Runtime static trimesh collision.
- Grass/Dirt/Rock/Snow weight layers.

Procedural generator bu altyapıları değiştirmemeli; yalnızca yeni height ve opsiyonel weight
verisi üretmelidir.

### Authority sınırı

Kalıcı terrain authority:

```text
ForgeLandscapeData.heights
```

Generator config tek başına runtime terrain authority değildir. Apply sonrası baked heights
kaydedilir. Bunun nedeni:

- Kullanıcı procedural sonuçtan sonra Sculpt yapabilir.
- Generator dependency sürümü değişebilir.
- Runtime'ın generator pipeline'a bağımlı olması istenmez.
- Save dosyası her zaman doğrudan render edilebilir kalır.

Buna rağmen reproducibility için generator metadata saklanabilir.

---

## Veri modeli önerisi

### Core heightfield türleri

Önerilen dosya:

```text
engine/terrain-generation/core/height-field.ts
```

```ts
export interface HeightFieldSize {
  width: number;
  height: number;
}

export interface HeightField {
  width: number;
  height: number;
  data: Float32Array;
}

export interface ScalarField {
  width: number;
  height: number;
  data: Float32Array;
}
```

`HeightField` mutable olabilir ancak operation API'nin input'u istemeden değiştirmemesi için
ownership kuralları açık yazılmalıdır.

Öneri:

- Generator operation input'u read-only kabul eder.
- Output için caller tarafından sağlanan scratch buffer veya yeni buffer kullanır.
- Hot loop içinde JS object allocation yapılmaz.

### Generator config

İlk sürümde node graph yerine sürümlenmiş operation stack:

```ts
interface ForgeTerrainGeneratorConfig {
  schema: 1;
  type: "terrainGenerator";
  generatorVersion: 1;
  name?: string;
  seed: number;
  resolution: {
    width: number;
    height: number;
  };
  operations: ForgeTerrainOperation[];
  output: {
    normalize: boolean;
    minHeight: number;
    maxHeight: number;
  };
}
```

Operation union örneği:

```ts
type ForgeTerrainOperation =
  | FractalNoiseOperation
  | RidgedNoiseOperation
  | RadialMaskOperation
  | CombineOperation
  | DomainWarpOperation
  | CurveOperation
  | BlurOperation
  | TerraceOperation
  | ThermalErosionOperation;
```

Ortak alanlar:

```ts
interface TerrainOperationBase {
  id: string;
  type: string;
  enabled?: boolean; // absent = true
  name?: string;
  seedOffset?: number;
  strength?: number;
  maskRef?: string | null;
}
```

### İlk operation seti

```ts
interface FractalNoiseOperation extends TerrainOperationBase {
  type: "fractalNoise";
  noiseType: "openSimplex2" | "perlin";
  fractalType: "fbm" | "ridged";
  frequency: number;
  octaves: number;
  lacunarity: number;
  gain: number;
  amplitude: number;
  offsetX?: number;
  offsetZ?: number;
}

interface DomainWarpOperation extends TerrainOperationBase {
  type: "domainWarp";
  frequency: number;
  amplitude: number;
  octaves: number;
}

interface RadialMaskOperation extends TerrainOperationBase {
  type: "radialMask";
  centerX: number;
  centerZ: number;
  radius: number;
  falloff: number;
  invert?: boolean;
}

interface CombineOperation extends TerrainOperationBase {
  type: "combine";
  mode: "add" | "subtract" | "multiply" | "max" | "min" | "lerp";
  sourceA: string;
  sourceB: string;
  factor?: number;
}

interface CurveOperation extends TerrainOperationBase {
  type: "curve";
  preset: "linear" | "softHills" | "flatLowlands" | "mountains" | "plateau";
}

interface BlurOperation extends TerrainOperationBase {
  type: "blur";
  radius: number;
  iterations: number;
}

interface TerraceOperation extends TerrainOperationBase {
  type: "terrace";
  steps: number;
  smoothness: number;
}

interface ThermalErosionOperation extends TerrainOperationBase {
  type: "thermalErosion";
  iterations: number;
  talus: number;
  transportRate: number;
}
```

> Not: `sourceA/sourceB` ile operation graph benzeri referanslar ilk MVP için gereğinden fazla
> karmaşık olabilir. İlk uygulama lineer stack olarak başlayabilir. Ancak serialized schema'nın
> gelecekte named intermediate output desteklemesi düşünülmelidir.

### MVP için daha sade stack şeması

Codex uygulamasını küçültmek için Faz 1-5 boyunca şu sade şema tercih edilmelidir:

```ts
interface ForgeTerrainGeneratorConfigV1 {
  schema: 1;
  type: "terrainGenerator";
  generatorVersion: 1;
  seed: number;
  base: {
    noiseType: "openSimplex2" | "perlin";
    frequency: number;
    octaves: number;
    lacunarity: number;
    gain: number;
    amplitude: number;
  };
  mountains?: {
    enabled: boolean;
    frequency: number;
    octaves: number;
    strength: number;
    sharpness: number;
  };
  warp?: {
    enabled: boolean;
    frequency: number;
    strength: number;
  };
  shape?: {
    curvePreset: "linear" | "softHills" | "flatLowlands" | "mountains" | "plateau";
    terraces?: number;
    terraceSmoothness?: number;
    edgeFalloff?: number;
  };
  erosion?: {
    thermal?: {
      enabled: boolean;
      iterations: number;
      talus: number;
      transportRate: number;
    };
  };
}
```

İlk milestone başarıyla tamamlandıktan sonra operation stack şemasına migration yapılabilir.
Node graph ile başlamamak özellikle önemlidir.

### Landscape metadata

`ForgeLandscapeData` içine opsiyonel generation metadata eklenebilir:

```ts
interface ForgeLandscapeGenerationMetadata {
  schema: 1;
  generatorVersion: 1;
  config: ForgeTerrainGeneratorConfigV1;
  appliedAt: string;
  applyMode: "replace" | "add" | "subtract" | "max" | "min" | "blend";
  applyStrength: number;
  generatedResolution: {
    width: number;
    height: number;
  };
  outputHash?: string;
}

interface ForgeLandscapeData {
  // mevcut alanlar...
  generation?: ForgeLandscapeGenerationMetadata;
}
```

Kurallar:

- `generation` yalnızca son applied generator ayarını saklar.
- Baked `heights` her zaman authority'dir.
- Sculpt sonrası metadata silinmek zorunda değildir ancak `modifiedAfterGeneration: true`
  benzeri bir işaret eklenebilir.
- `Regenerate` kullanıcıya mevcut sculpt değişikliklerini kaybettireceğini açıkça göstermelidir.

### Reusable preset asset

İlk milestone'da zorunlu değildir. Sonraki fazda:

```text
public/terrain-generators/<id>.terrain-generator.json
```

```ts
interface ForgeTerrainGeneratorAsset {
  schema: 1;
  type: "terrainGenerator";
  id: string;
  name: string;
  config: ForgeTerrainGeneratorConfig;
}
```

Bu asset şunları sağlar:

- Projeler arasında preset tekrar kullanımı.
- Content Browser üzerinden yönetim.
- Version/migration.
- Preset paylaşımı.

---

## Önerilen klasör yapısı

Forge repo gerçek yapısına göre isimler uyarlanmalıdır; geniş refactor yapılmamalıdır.
Önerilen modüler yapı:

```text
engine/terrain-generation/
├─ core/
│  ├─ height-field.ts
│  ├─ scalar-field.ts
│  ├─ field-utils.ts
│  ├─ seed.ts
│  └─ terrain-generator-types.ts
├─ noise/
│  ├─ noise-provider.ts
│  ├─ fast-noise-lite-provider.ts
│  └─ fractal-noise.ts
├─ generators/
│  ├─ base-terrain-generator.ts
│  ├─ ridged-mountain-generator.ts
│  └─ island-mask-generator.ts
├─ operations/
│  ├─ normalize.ts
│  ├─ combine.ts
│  ├─ curve.ts
│  ├─ blur.ts
│  ├─ terrace.ts
│  └─ domain-warp.ts
├─ erosion/
│  ├─ thermal-erosion.ts
│  └─ hydraulic-erosion.ts
├─ derived/
│  ├─ slope-map.ts
│  ├─ curvature-map.ts
│  ├─ flow-map.ts
│  └─ weightmap-rules.ts
├─ worker/
│  ├─ terrain-generation.worker.ts
│  ├─ terrain-worker-client.ts
│  └─ terrain-worker-protocol.ts
├─ presets/
│  ├─ rolling-hills.ts
│  ├─ mountain-valley.ts
│  ├─ island.ts
│  └─ plateau.ts
└─ index.ts
```

Editor tarafı:

```text
editor/landscape/generate/
├─ landscape-generate-panel.tsx
├─ landscape-generator-state.ts
├─ terrain-preview-controller.ts
├─ terrain-preview-2d.ts
├─ terrain-preview-3d.ts
└─ apply-generated-heightfield.ts
```

Dosya adları Forge'un gerçek yapısına göre değiştirilmelidir. Codex önce ilgili Landscape
panel, state ve renderer dosyalarını bulmalı; aynı pattern'i izlemelidir.

---

## Worker mimarisi

### Neden Worker zorunlu?

Şunlar ana thread'de editor etkileşimini bozabilir:

- 129×129 veya 257×257 üzerinde çok octave noise.
- Birden fazla mask/blur pass.
- Thermal erosion iterasyonları.
- Slope/flow/weight map hesapları.
- Preview için tekrar tekrar generation.

Dedicated Web Worker kullanılmalıdır.

### Mesaj protokolü

```ts
interface GenerateTerrainRequest {
  type: "generate";
  requestId: number;
  config: ForgeTerrainGeneratorConfigV1;
  width: number;
  height: number;
  includeDerivedMaps?: boolean;
}

interface CancelTerrainRequest {
  type: "cancel";
  requestId: number;
}

interface GenerateTerrainProgress {
  type: "progress";
  requestId: number;
  stage: "noise" | "warp" | "shape" | "erosion" | "derived";
  progress: number; // 0..1
}

interface GenerateTerrainSuccess {
  type: "success";
  requestId: number;
  width: number;
  height: number;
  heights: ArrayBuffer;
  slope?: ArrayBuffer;
  flow?: ArrayBuffer;
  stats: {
    min: number;
    max: number;
    mean: number;
    durationMs: number;
  };
}

interface GenerateTerrainFailure {
  type: "failure";
  requestId: number;
  message: string;
  code?: string;
}
```

### Transferable buffer

Worker sonucu `Float32Array.buffer` transferable olarak gönderilmelidir:

```ts
postMessage(result, transferList);
```

Ownership açık olmalıdır. Transfer edilen buffer worker tarafında tekrar kullanılmamalıdır.
Scratch buffer pooling gerekiyorsa copy/transfer stratejisi benchmark edilmelidir.

### Cancellation

Worker bir CPU loop içindeyken yalnızca message event ile anında kesilemeyebilir.
Bu nedenle algoritmalar stage/iteration aralarında cancellation token kontrol etmelidir.

```ts
if (cancelledRequestIds.has(requestId)) {
  throw new TerrainGenerationCancelledError(requestId);
}
```

UI davranışı:

- Her slider değişimi anında generation başlatmamalıdır.
- `150–300 ms` debounce kullanılmalıdır.
- Yeni request başlayınca önceki request iptal edilir veya sonucu stale kabul edilir.
- Yalnızca son `requestId` preview'a uygulanır.

### Error handling

Worker hataları editor'ü çökertmemelidir.

- Hata panel içinde gösterilir.
- Mevcut Landscape değişmez.
- Preview son başarılı sonuçta kalabilir veya temizlenebilir.
- NaN/Infinity tespit edilirse result reject edilir.

---

## Preview mimarisi

### Ana kural

Preview, kullanıcı `Apply` demeden `ForgeLandscapeData.heights` verisini değiştirmemelidir.

### 2D preview

2D preview grayscale heightmap gösterir:

```text
Black = düşük
White = yüksek
```

Ek view seçenekleri:

- Height.
- Slope.
- Flow.
- Rock weight.
- Grass weight.
- Snow weight.

2D preview üretimi için `ImageData`/OffscreenCanvas kullanılabilir. İlk sürümde main-thread
canvas da yeterli olabilir; asıl generation worker içinde kalmalıdır.

### 3D preview

İki seçenek:

1. Mevcut Landscape üzerinde geçici preview geometry.
2. Panel içinde küçük bağımsız preview scene.

Öneri: **Mevcut Landscape üzerinde geçici preview overlay/geometry**.

Avantajları:

- World scale doğrudan görülür.
- Diğer actor'larla ilişki anlaşılır.
- Apply sonucuna daha yakın görünür.

Kurallar:

- Preview geometry ayrı object/material olarak tutulmalıdır.
- Selection/collision sistemine dahil edilmemelidir.
- Save sırasında serialize edilmemelidir.
- Generate tab kapatılınca temizlenmelidir.
- Apply sonrası preview temizlenmeli ve gerçek dirty chunks güncellenmelidir.

Daha güvenli ilk adım olarak 2D preview ile başlanabilir; 3D live preview Faz 3 sonunda eklenebilir.

---

## Apply davranışı

Generated field mevcut Landscape çözünürlüğüne resample edilir veya generation doğrudan aynı
resolution'da yapılır.

İlk sürümde generation resolution = landscape vertex grid olmalıdır.

Apply modları:

| Mode | Formül | Kullanım |
| --- | --- | --- |
| Replace | `result = generated` | Yeni terrain oluşturma |
| Add | `result = current + generated * strength` | Detay/dağ ekleme |
| Subtract | `result = current - generated * strength` | Havza/vadi oyma |
| Max | `result = max(current, generated)` | Mevcut üstüne dağ bindirme |
| Min | `result = min(current, generated)` | Çukur/kanal bindirme |
| Blend | `result = lerp(current, generated, strength)` | Kontrollü karışım |

Height range ve world mapping açık tanımlanmalıdır.

Önerilen apply ayarları:

```ts
interface TerrainApplySettings {
  mode: "replace" | "add" | "subtract" | "max" | "min" | "blend";
  strength: number;
  heightOffset: number;
  heightAmplitude: number;
  clampToLandscapeRange: boolean;
  preserveBorder?: boolean;
}
```

### Undo/Redo

Apply tek bir undo command olmalıdır.

129×129 `Float32Array` yaklaşık 66 KB'dır; before/after full height snapshots MVP için kabul
edilebilir. Daha büyük resolution'larda patch/delta sıkıştırma düşünülür.

```ts
interface ApplyGeneratedTerrainCommand {
  landscapeId: string;
  before: Float32Array;
  after: Float32Array;
  generationMetadata?: ForgeLandscapeGenerationMetadata;
}
```

Kurallar:

- Apply sonrası dirty geometry refresh edilir.
- Undo gerçek height array'i ve metadata'yı geri getirir.
- Redo generated result'ı tekrar hesaplamaz; stored `after` snapshot uygular.
- Apply sonrası Save landscape sidecar'ını dirty görmelidir.

### Collision

Mevcut Landscape kararına göre collision sculpt/apply sırasında canlı rebuild edilmez.
Collision Save/Play sırasında sidecar'dan rebuild edilir.

Generate Apply sonrası editor render güncellenir; Play açıldığında yeni collider üretilir.

---

## Preset tasarımı

İlk preset'ler code-defined ve versioned olabilir.

### Rolling Hills

```text
Base: low-frequency FBM
Mountains: off veya çok düşük
Warp: düşük
Curve: Soft Hills
Edge falloff: off
Thermal erosion: düşük/kapalı
```

### Mountain Valley

```text
Base: medium FBM
Mountains: ridged, medium/high
Warp: medium
Curve: Mountains
Thermal erosion: medium
```

### Island

```text
Base: FBM + ridged
Radial edge falloff: on
Coastal shelf curve: on
Warp: low/medium
Thermal erosion: low
```

### Plateau

```text
Base: low-frequency noise
Curve: Plateau
Terrace: low step count, smooth transitions
Warp: low
Thermal erosion: off/low
```

### Valley Basin

```text
Base: low-frequency hills
Center/diagonal valley mask
Mountains: edge weighted
Curve: flat lowlands + raised borders
```

Valley Basin ilk milestone için opsiyoneldir.

Her preset:

- Sabit default config üretir.
- Seed'i overwrite etmez.
- UI'da açıklama ve küçük preview taşır.
- User parametre değiştirdiğinde `Custom` durumuna geçer.

---

## Otomatik weightmap üretimi

Bu çalışma Landscape Paint'in yerini almaz. Derived map'lerden başlangıç weight dağılımı
üretebilir.

İlk sabit layer seti:

```text
Grass / Dirt / Rock / Snow
```

Örnek kurallar:

```ts
rock = smoothstep(rockSlopeStart, rockSlopeEnd, slope);
snow = smoothstep(snowHeightStart, snowHeightEnd, height) * (1 - rock * 0.35);
dirt = flowOrCurvatureContribution * (1 - rock) * (1 - snow);
grass = max(0, 1 - rock - snow - dirt);
normalizeWeights(grass, dirt, rock, snow);
```

İlk weightmap fazında flow zorunlu değildir:

- Rock = slope.
- Snow = height + düşük slope preference.
- Dirt = mid slope veya noise variation.
- Grass = kalan ağırlık.

### Güvenlik kuralı

Otomatik weightmap mevcut paint'i kullanıcı onayı olmadan overwrite etmemelidir.

UI:

```text
[ ] Generate material weights
Mode: Replace All / Blend With Existing
Blend Strength: 0..1
```

Apply height ve weight için ayrı butonlar daha güvenlidir:

```text
[Apply Height]
[Generate Weight Preview]
[Apply Weights]
```

---

## Derived maps

### Slope map

Komşu height farklarından gradient ve slope hesaplanır.

Kullanım:

- Rock weight.
- Walkable terrain analizi.
- Debug view.
- Foliage integration hook.

### Curvature map

Yüzeyin convex/concave yapısını yaklaşıklar.

Kullanım:

- Soil/dirt birikimi.
- Ridge/valley selection.
- Snow/toz birikimi.

MVP weightmap için zorunlu değildir.

### Flow accumulation

Her hücrenin aşağı yönü ve upstream akış birikimi hesaplanır.

Kullanım:

- Nehir yatağı adayları.
- Wetness/dirt mask.
- Erosion debug.
- İleride water/spline önerileri.

İlk implementation D8 flow direction kullanabilir. Sink filling ve gerçek watershed çözümü daha
sonraki faza bırakılabilir.

### Normal map

Landscape render zaten geometry normals hesaplıyorsa ayrıca normal-map export ilk fazda gerekli
değildir. Heightmap export yanında opsiyonel offline normal map sonraki faz olabilir.

---

## Heightmap export ve bit derinliği

Mevcut Landscape heightmap export sistemiyle aynı yol kullanılmalıdır.

Kurallar:

- Internal authority `Float32Array` kalır.
- PNG yalnızca import/export/preview formatıdır.
- 8-bit PNG küçük basamaklanma yaratabilir.
- Mevcut export destekliyorsa 16-bit grayscale tercih edilir.
- Browser API ve mevcut PNG encoder 16-bit desteklemiyorsa bu eksik açıkça belgelenmelidir.
- Export normalization yöntemi metadata veya UI'da belirtilmelidir.

Örnek export seçenekleri:

```text
Height Range: Landscape Range / Data Min-Max / Custom
Flip Y: On/Off
Bit Depth: 8 / 16 (supported ise)
```

---

## Performans bütçesi

Kesin değerler browser ve cihaz benchmark'ıyla doğrulanmalıdır. İlk hedefler:

| Resolution | Kullanım | Hedef |
| --- | --- | --- |
| 65×65 | Hızlı preview/test | Anlık hissedilmeli |
| 129×129 | Ana MVP landscape | UI bloklamamalı |
| 257×257 | Genişletilmiş test | Worker zorunlu; erosion sınırlandırılmalı |
| 513×513+ | Sonraki faz | MVP kapsam dışı |

Başlangıç limitleri:

```text
Octaves: max 8
Thermal iterations: max 50
Blur radius: max 8
Blur iterations: max 8
Live preview resolution: max landscape resolution, tercihen adaptive
Hydraulic droplets: MVP'de yok
```

### Memory tahmini

Bir `Float32Array`:

```text
129² ≈ 16,641 değer ≈ 65 KB
257² ≈ 66,049 değer ≈ 258 KB
513² ≈ 263,169 değer ≈ 1.0 MB
```

Birden çok scratch buffer ve derived map memory'yi katlar. Worker stage'leri gereksiz field kopyası
üretmemelidir.

### Adaptive preview

İleride:

- Slider sürüklenirken 65×65 preview.
- Input bırakılınca 129×129 preview.
- Apply öncesi target resolution generation.

İlk MVP'de landscape resolution 129×129 olduğu için tek resolution daha basit ve yeterlidir.

---

## Validation ve güvenli sınırlar

Generator config validator şu kontrolleri yapmalıdır:

- Schema ve generatorVersion destekleniyor mu?
- Seed finite 32-bit integer'a normalize edilebilir mi?
- Width/height allowlist içinde mi?
- Octaves integer ve limit içinde mi?
- Frequency, gain, lacunarity finite mı?
- Strength/amplitude finite ve limit içinde mi?
- Erosion iterations limit içinde mi?
- Unknown operation/type reject veya safe ignore politikası net mi?
- Result array length doğru mu?
- Result içinde NaN/Infinity var mı?
- Min/max range beklenen güvenli aralıkta mı?

Worker dışından gelen config trusted kabul edilmemelidir.

---

## Determinism ve versioning

Generator çıktısı algoritma değişikliklerinden etkilenebilir. Bu nedenle:

```ts
generatorVersion: 1
```

zorunludur.

Kurallar:

- Bug fix output'u değiştiriyorsa version bump değerlendirilir.
- Eski Landscape baked heights ile render olmaya devam eder.
- `Regenerate` eski version desteklenmiyorsa kullanıcıya açıklama gösterir.
- Preset config migration açık fonksiyonlarla yapılır.
- Test fixture'ları version bazlı tutulur.

Hash opsiyonel ama yararlıdır:

```ts
outputHash = hashFloat32Array(heights);
```

Bu hash:

- Same seed determinism testinde.
- Save/reload integrity testinde.
- Regeneration comparison'da kullanılabilir.

---

## Editor UX önerisi

### Generate panel

```text
Landscape Mode > Generate

Preset
  [Mountain Valley ▼]

Seed
  [8142] [Randomize] [Previous] [Next]

Base Terrain
  Noise Type      [OpenSimplex2 ▼]
  Frequency       [────●────]
  Octaves         [────●────]
  Lacunarity      [────●────]
  Gain            [────●────]
  Amplitude       [────●────]

Mountains
  [x] Enable Ridged Mountains
  Frequency       [────●────]
  Strength        [────●────]
  Sharpness       [────●────]

Warp
  [x] Enable Domain Warp
  Frequency       [────●────]
  Strength        [────●────]

Shape
  Curve           [Mountains ▼]
  Edge Falloff    [────●────]
  Terraces        [0]

Erosion
  [ ] Thermal Erosion
  Iterations      [20]
  Talus           [────●────]
  Transport       [────●────]

Preview
  View            [Height ▼]
  [Regenerate Preview]
  [Auto Preview]

Apply
  Mode            [Replace ▼]
  Strength        [1.0]
  Height Scale    [1.0]
  Height Offset   [0.0]
  [Apply Height To Landscape]
```

### State davranışı

- Landscape seçili değilse panel create/select çağrısı gösterir.
- Locked/hidden Landscape için Apply disabled olur.
- Parametre değişince preset `Custom` olur.
- Auto Preview açıkken debounce generation yapılır.
- Generation sırasında progress ve Cancel gösterilir.
- Apply öncesi current heights snapshot alınır.
- Landscape selection değişince stale preview temizlenir.
- Tab kapanınca pending worker işi iptal edilir.

### Seed navigation

Kullanışlı küçük özellik:

```text
Randomize
Previous Seed
Next Seed
```

Previous/Next, seed geçmişini UI session state içinde tutabilir. Kalıcı dosyaya yazılması zorunlu değildir.

---

## Test stratejisi

### Unit testler

#### HeightField core

- [ ] Index hesaplama doğru.
- [ ] Clone/copy doğru.
- [ ] Normalize sabit field durumunda NaN üretmiyor.
- [ ] Clamp min/max sınırlarını koruyor.
- [ ] Resample köşe değerlerini koruyor.
- [ ] Input array length validation çalışıyor.

#### Seed

- [ ] Aynı seed aynı sequence üretir.
- [ ] Farklı seed farklı sequence üretir.
- [ ] Negative/large seed normalize edilir.
- [ ] Operation sub-seed stable'dır.

#### Noise

- [ ] Output finite.
- [ ] Output beklenen aralıkta.
- [ ] Aynı config epsilon-equal/byte-equal.
- [ ] Octave 1 ve octave N davranışı test edilir.
- [ ] Ridged transform sınırları test edilir.

#### Operations

- [ ] Add/Subtract/Multiply/Min/Max/Blend formülleri.
- [ ] Radial mask merkez ve kenar değerleri.
- [ ] Curve preset monotonic behavior.
- [ ] Terrace step count.
- [ ] Blur sabit field'i değiştirmiyor.
- [ ] Thermal erosion total material drift toleransı.
- [ ] Cancellation check çalışıyor.

#### Derived maps

- [ ] Flat field slope = 0.
- [ ] Linear ramp slope sabit.
- [ ] Weight toplamları yaklaşık 1.
- [ ] Weight değerleri 0..1.
- [ ] NaN/Infinity yok.

### Worker testleri

- [ ] Request/response protocol.
- [ ] Transfer edilen buffer doğru uzunlukta.
- [ ] Stale request sonucu UI'a uygulanmıyor.
- [ ] Cancel request kontrollü kapanıyor.
- [ ] Invalid config failure döndürüyor.
- [ ] Worker exception editor state'i bozmuyor.

### Integration testleri

- [ ] Selected Landscape resolution worker'a doğru geçiyor.
- [ ] Preview gerçek `heights` verisini mutate etmiyor.
- [ ] Apply dirty geometry update çağırıyor.
- [ ] Apply tek undo command oluşturuyor.
- [ ] Undo önceki height'ı geri getiriyor.
- [ ] Redo generated height'ı geri getiriyor.
- [ ] Save/Reload height korunuyor.
- [ ] Generation metadata korunuyor.
- [ ] Play runtime yeni height'ı gösteriyor.
- [ ] Play collision yeni terrain şekline göre rebuild ediliyor.

### Smoke testler

Önerilen test dosyaları:

```text
tests/smoke/landscape-generate-preview.spec.ts
tests/smoke/landscape-generate-apply.spec.ts
tests/smoke/landscape-generate-save-reload.spec.ts
tests/smoke/landscape-generate-weights.spec.ts
```

Smoke senaryosu:

1. Test level aç.
2. Medium Landscape oluştur/seç.
3. Generate tab aç.
4. `Mountain Valley`, seed `8142` seç.
5. Preview üret.
6. Preview var, landscape data henüz değişmemiş doğrula.
7. Apply Replace.
8. Center/edge height örneklerinin değiştiğini doğrula.
9. Undo ve Redo doğrula.
10. Save ve reload.
11. Aynı sample height değerlerini doğrula.
12. Play aç ve oyuncunun terrain üstünde grounded kaldığını doğrula.

### Görsel regression yaklaşımı

Sadece screenshot pixel match'e güvenilmemelidir. Öncelik:

- Height sample değerleri.
- Output hash.
- Min/max/mean istatistikleri.
- Deterministic fixture.

Screenshot smoke, panel görünürlüğü ve kaba preview doğrulaması için yardımcı olabilir.

---

## Codex çalışma protokolü

Codex her fazda şu sırayı izlemelidir:

1. Önce mevcut Landscape implementation dosyalarını ve test pattern'lerini bul.
2. İlgili veri modellerini ve save endpoint validator'larını oku.
3. Faz kapsamı dışında refactor yapma.
4. Public API ve schema değişikliklerini önce type + validator + test ile ekle.
5. Core algoritmayı UI'dan bağımsız geliştir.
6. Worker eklenmeden önce core generator unit testlerini geçir.
7. UI state'i worker protocol'den ayır.
8. Preview ile Apply verisini ayır; preview kalıcı state'i mutate etmesin.
9. Her faz sonunda typecheck ve ilgili testleri çalıştır.
10. Dokümandaki checklist'i yalnızca test ve doğrulama tamamlandıktan sonra `[x]` yap.

Her fazın önerilen doğrulama komutları:

```bash
npx tsc --noEmit
npm run test:engine
npm run build:verify
```

Repo içinde daha özel Landscape veya smoke test komutları varsa onlar da çalıştırılmalıdır.

### Codex'e verilecek başlangıç talimatı

```text
PROCEDURAL_HEIGHTMAP_RESEARCH_AND_PLAN.md dosyasını ana çalışma planı olarak kullan.
Önce LANDSCAPE_MODE_RESEARCH_AND_PLAN.md ve mevcut Landscape implementation/test
dosyalarını incele. Yalnızca aktif fazın kapsamını uygula. Faz dışı node graph,
hydraulic erosion, WebGPU, runtime procedural generation veya geniş refactor yapma.
Her faz sonunda typecheck, engine testleri ve ilgili smoke testleri çalıştır; sonuçları
dokümana tarihli not olarak ekle ve yalnızca doğrulanmış maddeleri tamamlandı işaretle.
```

---

# Fazlara ayrılmış çalışma planı

## Faz 0 — Repo incelemesi ve kararların doğrulanması

### Hedef

Procedural generator'ın mevcut Landscape sistemiyle bağlanacağı gerçek dosyaları, state akışını,
undo/save/render yollarını bulmak. Kod yazmadan önce entegrasyon haritası çıkarmak.

### Kontrol listesi

- [ ] `LANDSCAPE_MODE_RESEARCH_AND_PLAN.md` içindeki güncel durum ve kesinleşen kararları oku.
- [ ] `ForgeLandscapeData` ve normalize/validate fonksiyonlarını bul.
- [ ] Landscape render ve dirty chunk update yolunu bul.
- [ ] Landscape sculpt undo/redo command pattern'ini bul.
- [ ] Landscape import/export implementation'ını bul.
- [ ] Landscape panel/tab state yapısını bul.
- [ ] Save endpoint ve sidecar dirty tracking yolunu bul.
- [ ] Runtime collision rebuild yolunu bul.
- [ ] Existing worker pattern'i varsa repo genelinde ara.
- [ ] Existing dependency/lisans politikasını incele.
- [ ] FastNoise Lite dependency kullanımı veya internal noise kararı ver.
- [ ] Gerçek dosya/path entegrasyon notlarını bu dokümana ekle.
- [ ] Faz 1 için değişecek dosya listesini yaz.

### Çıkış kriteri

- Entegrasyon noktaları belgelendi.
- Noise dependency kararı verildi.
- Faz 1 kapsamı dosya bazında net.
- Henüz editor UI veya erosion kodu yazılmadı.

---

## Faz 1 — HeightField Core + Seed + Deterministic Noise

### Hedef

UI ve Landscape entegrasyonundan bağımsız, test edilebilir procedural heightfield çekirdeği kurmak.

### Kapsam

- `HeightField` typed-array veri modeli.
- Field validation ve temel utility'ler.
- Seed normalization ve sub-seed türetme.
- Noise provider abstraction.
- OpenSimplex2 veya seçilen temel noise.
- FBM ve ridged fractal.
- Normalize/clamp.
- Determinism testleri.

### Kontrol listesi

- [ ] `HeightField` ve `ScalarField` type'larını ekle.
- [ ] Row-major index helper ekle.
- [ ] Clone/copy/create/fill utility'lerini ekle.
- [ ] Finite/range/length validator ekle.
- [ ] 32-bit seed normalization ekle.
- [ ] Stable `hashSeed(rootSeed, operationId, type)` ekle.
- [ ] Noise provider interface ekle.
- [ ] Seçilen noise implementasyonunu entegre et.
- [ ] FBM generator ekle.
- [ ] Ridged fractal generator ekle.
- [ ] Normalize ve clamp operation ekle.
- [ ] Sabit field normalize edge case'ini güvenli yap.
- [ ] Same seed same output testi ekle.
- [ ] Different seed different output testi ekle.
- [ ] NaN/Infinity regression testleri ekle.
- [ ] 65×65 ve 129×129 benchmark notu çıkar.
- [ ] `npx tsc --noEmit` geçir.
- [ ] `npm run test:engine` geçir.

### Kabul kriterleri

- 129×129 heightfield aynı seed/config ile deterministik üretiliyor.
- Sonuç array uzunluğu doğru ve tüm değerler finite.
- Core modül editor veya Three.js import etmiyor.
- Unit testler geçiyor.

---

## Faz 2 — Generator Config + Preset Pipeline

### Hedef

Seed ve parametrelerden kullanılabilir terrain üreten, versioned ve validated config pipeline kurmak.

### Kapsam

- `ForgeTerrainGeneratorConfigV1`.
- Config normalize/validate.
- Base noise + ridged mountains.
- Curve preset.
- Edge falloff/island mask.
- Domain warp.
- Code-defined preset'ler.
- Output stats/hash.

### Kontrol listesi

- [ ] Config type ve schema version ekle.
- [ ] Config default/normalize fonksiyonu ekle.
- [ ] Config validator limitlerini ekle.
- [ ] Base FBM pipeline ekle.
- [ ] Ridged mountain blend ekle.
- [ ] Domain warp ekle.
- [ ] Curve preset operation ekle.
- [ ] Radial edge falloff ekle.
- [ ] Rolling Hills preset ekle.
- [ ] Mountain Valley preset ekle.
- [ ] Island preset ekle.
- [ ] Plateau preset ekle.
- [ ] Min/max/mean stats üret.
- [ ] Stable output hash ekle veya hash stratejisini belgele.
- [ ] Her preset için deterministic fixture testi ekle.
- [ ] Invalid config reject testleri ekle.
- [ ] Preset parametrelerinin safe range testlerini ekle.
- [ ] 129×129 generation benchmark notunu ekle.
- [ ] `npx tsc --noEmit` geçir.
- [ ] `npm run test:engine` geçir.

### Kabul kriterleri

- Dört preset 129×129 terrain üretir.
- Island preset kenarları güvenilir biçimde düşürür.
- Mountain Valley ridged form üretir.
- Config invalid değerleri güvenle normalize/reject eder.
- Aynı fixture hash'i tekrar üretir.

---

## Faz 3 — Web Worker + 2D Preview

### Hedef

Generator'ı editor main thread'inden ayırmak ve Landscape'i değiştirmeden preview sunmak.

### Kapsam

- Worker protocol.
- Worker client.
- Request ID ve stale response koruması.
- Cancellation.
- Progress.
- Generate tab temel UI.
- 2D grayscale preview.
- Auto preview debounce.

### Kontrol listesi

- [ ] Worker request/response type'larını ekle.
- [ ] Dedicated worker entry ekle.
- [ ] Core generator'ı worker içinde çalıştır.
- [ ] `ArrayBuffer` transferable response kullan.
- [ ] Request ID sequence ekle.
- [ ] Stale response ignore et.
- [ ] Cancel mesajı ve cooperative cancellation ekle.
- [ ] Stage progress mesajları ekle.
- [ ] Worker error mapping ekle.
- [ ] Landscape Mode'a Generate sekmesi ekle.
- [ ] Landscape yok/locked/hidden state'lerini ele al.
- [ ] Preset seçimi ekle.
- [ ] Seed input ve Randomize ekle.
- [ ] Base/Mountain/Warp/Shape kontrollerini ekle.
- [ ] Manual Regenerate Preview ekle.
- [ ] Auto Preview + debounce ekle.
- [ ] Grayscale 2D height preview ekle.
- [ ] Min/max/mean ve generation duration göster.
- [ ] Preview'ın landscape heights'i mutate etmediğini test et.
- [ ] Worker cancellation testi ekle.
- [ ] Stale result testi ekle.
- [ ] Panel kapanışında worker cleanup/cancel ekle.
- [ ] `npx tsc --noEmit` geçir.
- [ ] `npm run test:engine` geçir.
- [ ] İlgili editor/smoke testini geçir.

### Kabul kriterleri

- 129×129 preview sırasında editor input/render bloklanmaz.
- Slider değişiklikleri debounce edilir.
- Yalnızca son request preview'a uygulanır.
- Preview landscape sidecar'ını dirty yapmaz.
- Worker hatası editor'ü çökertmez.

---

## Faz 4 — Landscape Apply + Undo/Redo + Save/Reload

### Hedef

Preview sonucunu mevcut Landscape heightfield'ine güvenli ve geri alınabilir biçimde uygulamak.

### Kapsam

- Replace ve Blend ilk zorunlu apply modları.
- Add/Subtract/Max/Min.
- Height amplitude/offset.
- Dirty chunk refresh.
- Undo/redo command.
- Generation metadata.
- Save/reload.
- Runtime render/collision doğrulaması.

### Kontrol listesi

- [ ] `TerrainApplySettings` type ekle.
- [ ] Replace apply ekle.
- [ ] Blend apply ekle.
- [ ] Add apply ekle.
- [ ] Subtract apply ekle.
- [ ] Max apply ekle.
- [ ] Min apply ekle.
- [ ] Height amplitude ve offset ekle.
- [ ] Clamp/range davranışını netleştir ve test et.
- [ ] Apply öncesi before snapshot al.
- [ ] Apply sonrası after snapshot sakla.
- [ ] Tek command undo/redo ekle.
- [ ] Redo sırasında regenerate etme; stored after uygula.
- [ ] Dirty chunk geometry refresh çağır.
- [ ] Landscape sidecar dirty tracking'i bağla.
- [ ] `ForgeLandscapeGenerationMetadata` ekle.
- [ ] Landscape validator'a generation metadata ekle.
- [ ] Save/Reload metadata ve heights testi ekle.
- [ ] Apply sonrası preview temizle.
- [ ] Selection değişiminde preview temizle.
- [ ] Runtime Play render doğrulaması yap.
- [ ] Save/Play collision rebuild doğrulaması yap.
- [ ] `landscape-generate-apply` smoke testi ekle.
- [ ] `landscape-generate-save-reload` smoke testi ekle.
- [ ] `npx tsc --noEmit` geçir.
- [ ] `npm run test:engine` geçir.
- [ ] `npm run build:verify` geçir.

### Kabul kriterleri

- Preview Apply öncesi kalıcı veriyi değiştirmez.
- Apply tek undo adımıdır.
- Undo/Redo exact height sonucunu geri getirir.
- Save/Reload sonrası terrain aynı kalır.
- Play modunda yeni terrain görünür ve collider doğru rebuild edilir.

---

## Faz 5 — 3D Live Preview + Gelişmiş Shaping

### Hedef

Generator sonuçlarını world context içinde görmek ve temel terrain çeşitliliğini artırmak.

### Kapsam

- Temporary 3D preview geometry.
- Preview material/view mode.
- Terrace.
- Blur/smooth.
- Preserve border.
- Apply preview parity.

### Kontrol listesi

- [ ] Temporary 3D preview object ekle.
- [ ] Preview object save/outliner/collision dışında kalsın.
- [ ] Landscape transform/world spacing ile doğru hizala.
- [ ] Height preview material ekle.
- [ ] Lit preview opsiyonu ekle.
- [ ] 2D/3D preview toggle ekle.
- [ ] Tab kapanınca preview dispose et.
- [ ] Selection değişince preview dispose et.
- [ ] Terrace operation ekle.
- [ ] Blur/smooth operation ekle.
- [ ] Preserve border apply seçeneği ekle.
- [ ] Curve preset'lerini görsel olarak doğrula.
- [ ] Preview ile Apply sample parity testi ekle.
- [ ] Geometry/material dispose leak testi veya manuel kontrol notu ekle.
- [ ] `npx tsc --noEmit` geçir.
- [ ] `npm run test:engine` geçir.
- [ ] `npm run build:verify` geçir.

### Kabul kriterleri

- 3D preview gerçek Landscape konum ve ölçeğinde görünür.
- Preview collision veya save state'e karışmaz.
- Apply edilen terrain preview ile aynı sample değerlerini taşır.
- Preview resource'ları temizlenir.

---

## Faz 6 — Derived Maps + Otomatik Weightmap

### Hedef

Heightfield analizinden slope tabanlı materyal ağırlıkları üretmek ve Landscape Paint ile uyumlu
başlangıç katmanları oluşturmak.

### Kapsam

- Slope map.
- Opsiyonel curvature.
- Height/slope view modes.
- Grass/Dirt/Rock/Snow rule config.
- Weight preview.
- Replace/Blend existing weights.
- Weight normalization.

### Kontrol listesi

- [ ] Slope map generator ekle.
- [ ] Flat/ramp slope unit testleri ekle.
- [ ] Height view mevcutsa generator preview'a bağla.
- [ ] Slope preview ekle.
- [ ] Weight rule config type ekle.
- [ ] Rock = slope rule ekle.
- [ ] Snow = height + slope rule ekle.
- [ ] Dirt = mid-slope/noise rule ekle.
- [ ] Grass = normalized remainder rule ekle.
- [ ] Dört weight'in toplamını normalize et.
- [ ] Her weight'i 0..1 clamp et.
- [ ] Grass/Dirt/Rock/Snow preview seçenekleri ekle.
- [ ] `Generate Weight Preview` ekle.
- [ ] `Apply Weights` ayrı aksiyon ekle.
- [ ] Replace All mode ekle.
- [ ] Blend With Existing mode ekle.
- [ ] Weight apply için undo/redo ekle.
- [ ] Mevcut paint'in onaysız overwrite edilmediğini doğrula.
- [ ] Save/Reload weight testi ekle.
- [ ] Editor + runtime material blend doğrulaması yap.
- [ ] `landscape-generate-weights` smoke testi ekle.
- [ ] `npx tsc --noEmit` geçir.
- [ ] `npm run test:engine` geçir.
- [ ] `npm run build:verify` geçir.

### Kabul kriterleri

- Steep bölgeler Rock ağırlığı alır.
- Yüksek bölgeler Snow ağırlığı alır.
- Her texel/vertex weight toplamı yaklaşık 1'dir.
- Existing paint yalnızca açık kullanıcı aksiyonuyla değiştirilir.
- Save/Reload sonrası weights korunur.

---

## Faz 7 — Thermal Erosion

### Hedef

Noise kaynaklı keskinlikleri azaltan, deterministic ve sınırlı maliyetli ilk erosion sistemini eklemek.

### Kapsam

- Talus-based thermal erosion.
- Worker progress/cancel.
- Preset entegrasyonu.
- Iteration limits.
- Erosion on/off preview parity.

### Kontrol listesi

- [ ] Thermal erosion algoritmasını bağımsız modül olarak ekle.
- [ ] Double-buffer veya safe delta update stratejisi kullan.
- [ ] Border handling politikasını yaz ve test et.
- [ ] Iteration arasında cancellation check ekle.
- [ ] Progress stage ekle.
- [ ] Iterations slider/number input ekle.
- [ ] Talus ayarı ekle.
- [ ] Transport rate ayarı ekle.
- [ ] Strength/blend ayarı ekle.
- [ ] Max iteration validation ekle.
- [ ] Same seed/config deterministic test ekle.
- [ ] Flat field değişmiyor testi ekle.
- [ ] Keskin peak'in yumuşaması testi ekle.
- [ ] NaN/Infinity testi ekle.
- [ ] Total material drift için tolerans testi ekle.
- [ ] Mountain Valley preset'e düşük/orta erosion default ekle.
- [ ] Erosion kapalı preset output'unun değişmediğini doğrula.
- [ ] 65/129/257 benchmark sonucu kaydet.
- [ ] 257 performansı kabul edilemezse UI limitini 129'da tut.
- [ ] `npx tsc --noEmit` geçir.
- [ ] `npm run test:engine` geçir.
- [ ] `npm run build:verify` geçir.

### Kabul kriterleri

- Thermal erosion editor main thread'ini bloklamaz.
- Cancel işlevi çalışır.
- Aynı config deterministic output üretir.
- Erosion kapatıldığında önceki preset fixture'ları değişmez.
- 129×129 ana kullanım güvenilir çalışır.

---

## Faz 8 — Flow Map ve Gelişmiş Maskeler

### Hedef

Terrain analizini ileride nehir, wetness, foliage ve road sistemlerinin okuyabileceği ortak data
map altyapısına genişletmek.

### Kapsam

- D8 flow direction.
- Flow accumulation.
- Basic sink policy.
- Curvature.
- Height/slope/flow mask combine.
- Exportable debug maps.

### Kontrol listesi

- [ ] D8 downhill direction ekle.
- [ ] Flat/sink davranışını açık tanımla.
- [ ] Flow accumulation ekle.
- [ ] Simple synthetic valley test ekle.
- [ ] Curvature approximation ekle.
- [ ] Height range mask ekle.
- [ ] Slope range mask ekle.
- [ ] Flow range mask ekle.
- [ ] Invert mask ekle.
- [ ] Multiply/Add mask combine ekle.
- [ ] Flow preview ekle.
- [ ] Curvature preview ekle.
- [ ] Dirt/wetness weight rule'larına flow opsiyonu ekle.
- [ ] Derived maps'in landscape sidecar'da kalıcı olup olmayacağına karar ver.
- [ ] Varsayılan olarak derived maps'i regenerate edilebilir cache olarak tut.
- [ ] Foliage/Water/Spline sistemleri için read-only hook interface tasarla.
- [ ] Bu fazda foliage veya river mesh spawn etme.
- [ ] `npx tsc --noEmit` geçir.
- [ ] `npm run test:engine` geçir.
- [ ] `npm run build:verify` geçir.

### Kabul kriterleri

- Basit valley fixture'da flow düşük noktaya yönelir.
- Derived maps deterministic ve finite'dır.
- Diğer sistemler heightfield'i mutate etmeden map okuyabilir.
- Kapsam foliage/water üretimine taşmaz.

---

## Faz 9 — Reusable Generator Preset Asset

### Hedef

Generator config'lerini Content Browser üzerinden tekrar kullanılabilir asset haline getirmek.

### Kapsam

- `terrainGenerator` asset type.
- New/save/duplicate/delete.
- Preset picker.
- Built-in vs project preset ayrımı.
- Schema migration.

### Kontrol listesi

- [ ] `ForgeTerrainGeneratorAsset` type ekle.
- [ ] Asset path ve extension kararı ver.
- [ ] Content Browser allowlist/loader ekle.
- [ ] New terrain generator asset flow ekle.
- [ ] Save endpoint ve validator ekle.
- [ ] Built-in preset'leri immutable göster.
- [ ] Built-in preset'ten project copy oluşturma ekle.
- [ ] Landscape Generate paneline preset asset picker ekle.
- [ ] Missing preset fallback davranışı ekle.
- [ ] Asset schema migration testi ekle.
- [ ] Duplicate/delete reference davranışını test et.
- [ ] Save/Reload asset testi ekle.
- [ ] `npx tsc --noEmit` geçir.
- [ ] `npm run test:engine` geçir.
- [ ] `npm run build:verify` geçir.

### Kabul kriterleri

- Kullanıcı bir generator preset'ini asset olarak kaydedebilir.
- Başka Landscape üzerinde aynı asset + seed aynı output'u üretir.
- Missing/invalid asset editor'ü çökertmez.

---

## Faz 10 — Hydraulic Erosion Araştırma Prototipi

### Hedef

Production entegrasyonu yapmadan önce hydraulic erosion yaklaşımını benchmark ve kalite açısından
değerlendirmek.

### Kapsam

- Droplet veya grid solver araştırması.
- CPU worker prototipi.
- Determinism.
- Cancellation.
- 65/129/257 benchmark.
- Quality comparison fixtures.

### Kontrol listesi

- [ ] Droplet ve grid solver trade-off notu yaz.
- [ ] Tek yaklaşım seç.
- [ ] Core Landscape/Editor API'den bağımsız prototip yap.
- [ ] Seeded droplet spawn ekle.
- [ ] Gradient sampling ekle.
- [ ] Water/speed/sediment capacity modeli ekle.
- [ ] Erode/deposit adımlarını ekle.
- [ ] Evaporation ve lifetime limitleri ekle.
- [ ] Cancellation check ekle.
- [ ] Determinism testi ekle.
- [ ] NaN/Infinity ve boundary testleri ekle.
- [ ] 65/129/257 benchmark yap.
- [ ] Thermal vs hydraulic görsel/test fixture karşılaştırması yap.
- [ ] Production'a alma veya erteleme kararı yaz.
- [ ] Kabul edilirse ayrı production fazı oluştur.
- [ ] Bu prototipi doğrudan Generate paneline bağlama.

### Kabul kriterleri

Bu fazın başarı ölçütü production feature değildir. Belgelenmiş karar üretilmelidir:

```text
Adopt / Rework / Defer
```

---

## Sonraki fazlar

- Görsel operation stack editor.
- Tam node graph.
- Painted generation masks.
- Landscape Spline exclusion/deformation mask entegrasyonu.
- Imported mask map.
- Multi-landscape/tiled generation.
- Seam-aware tiled terrain generation.
- 513+ resolution ve LOD/streaming entegrasyonu.
- WebAssembly optimizasyonu.
- Opsiyonel WebGPU compute backend.
- Runtime seed-based world generation.
- Biome rule assets.
- River candidate → Landscape Spline önerisi.
- Macro variation ve triplanar material mask üretimi.

---

# Birleşik milestone kabul kriterleri

İlk production milestone Faz 0-7'yi kapsar.

- [ ] Landscape Mode içinde Generate sekmesi görünür.
- [ ] Medium 129×129 Landscape üzerinde çalışır.
- [ ] Rolling Hills, Mountain Valley, Island ve Plateau preset'leri vardır.
- [ ] Seed ile deterministic generation yapılır.
- [ ] Generation worker içinde çalışır.
- [ ] 2D preview kalıcı Landscape verisini değiştirmez.
- [ ] 3D preview world scale'da gösterilir.
- [ ] Replace/Blend/Add/Subtract/Max/Min apply vardır.
- [ ] Apply tek undo/redo command'dır.
- [ ] Dirty chunk geometry doğru güncellenir.
- [ ] Save/Reload sonrası height korunur.
- [ ] Play/runtime terrain render edilir.
- [ ] Save/Play collision rebuild yeni terrain'i kullanır.
- [ ] Slope tabanlı otomatik Grass/Dirt/Rock/Snow weight preview/apply vardır.
- [ ] Thermal erosion worker içinde ve cancellable çalışır.
- [ ] Invalid config/NaN sonucu kalıcı state'e uygulanmaz.
- [ ] `npx tsc --noEmit` geçer.
- [ ] `npm run test:engine` geçer.
- [ ] `npm run build:verify` geçer.
- [ ] İlgili Landscape generation smoke testleri geçer.

---

## Kesin önerilen kararlar

Codex'in belirsizlik yaşamaması için ilk uygulamada şu kararlar kullanılmalıdır:

1. Procedural generator, **Landscape Mode > Generate** sekmesidir.
2. İlk çalışma yalnızca seçili tek Landscape'i etkiler.
3. Kalıcı authority baked `ForgeLandscapeData.heights` verisidir.
4. Apply destructive'tir ancak tek undo command ile geri alınabilir.
5. Generator metadata reproducibility için Landscape sidecar'da saklanır.
6. İlk target resolution **129×129**'dır.
7. 257×257 yalnızca benchmark sonrası açılır.
8. İlk backend TypeScript + Dedicated Web Worker'dır.
9. WebGPU ve WASM MVP kapsamı dışıdır.
10. İlk noise kaynağı FastNoise Lite veya tek bir internal OpenSimplex2 implementasyonudur.
11. Görsel node graph ile başlanmaz.
12. İlk schema sade `ForgeTerrainGeneratorConfigV1` form modelidir.
13. İlk erosion türü thermal erosion'dır.
14. Hydraulic erosion ayrı prototip fazıdır.
15. Preview Apply öncesi Landscape data'yı mutate etmez.
16. Weightmap apply, height apply'dan ayrı kullanıcı aksiyonudur.
17. Existing paint kullanıcı onayı olmadan overwrite edilmez.
18. Runtime procedural generation bu çalışmanın kapsamı değildir.
19. Collision mevcut karara uygun olarak Save/Play sırasında rebuild edilir.
20. Foliage, water ve splines yalnızca future read-only integration hook'ları alır.

---

## Açık kararlar

Faz 0 sırasında repo gerçekleriyle kesinleştirilecek noktalar:

1. FastNoise Lite dependency olarak mı eklenecek, kaynak portu vendor mı edilecek, yoksa internal noise mı yazılacak?
2. Generator metadata doğrudan `.landscape.json` içinde mi tutulacak, ayrı sidecar mı olacak?
3. 3D preview mevcut Landscape mesh'ini geçici attribute ile mi kullanacak, ayrı preview object mi oluşturacak?
4. Height internal aralığı mevcut Landscape kodunda normalized mı world-unit mi?
5. Existing undo sistemi full snapshot için uygun mu, ayrı height patch command mı gerekli?
6. 16-bit PNG export mevcut encoder ile mümkün mü?
7. Worker bundling için repo içinde kullanılan standart pattern nedir?
8. Generate panel mevcut Details panel içinde mi kalmalı, daha geniş dedicated panel alanı mı gerektiriyor?
9. Derived maps yalnızca ephemeral cache mi olacak, yoksa optional sidecar cache mi tutulacak?
10. FastNoise Lite güncellemelerinde deterministic output'un korunması için vendor/version pin gerekli mi?

Bu sorular implementation'ı durduracak genel ürün soruları değildir. Faz 0'da repo pattern'lerine göre
önerilen seçenek seçilmeli ve dokümana gerekçesiyle yazılmalıdır.

---

## Riskler ve azaltma planı

### Risk: Scope node graph'a büyür

**Azaltma:** İlk schema form tabanlı config; operation graph sonraki faz.

### Risk: Preview main thread'i dondurur

**Azaltma:** Generation worker'da; debounce, cancellation ve stale result kontrolü.

### Risk: Aynı seed farklı sonuç üretir

**Azaltma:** `Math.random()` yasak; generatorVersion; fixed dependency version; deterministic fixtures.

### Risk: Preview kalıcı terrain'i bozar

**Azaltma:** Preview ayrı buffer/object; Apply dışındaki yollar landscape `heights` yazamaz.

### Risk: Undo memory maliyeti büyür

**Azaltma:** 129² için full snapshot; 257+ için patch/delta değerlendirmesi.

### Risk: Erosion çok yavaş olur

**Azaltma:** Thermal first; iteration cap; worker; benchmark gate; hydraulic ayrı prototip.

### Risk: Weightmap kullanıcı boyamasını siler

**Azaltma:** Ayrı Apply Weights butonu; replace/blend seçimi; undo/redo.

### Risk: Generator update eski preset sonucunu değiştirir

**Azaltma:** Baked heights authority; generatorVersion; pinned dependency; output hash.

### Risk: 8-bit export banding

**Azaltma:** Internal Float32; 16-bit encoder araştırması; 8-bit limitation UI/dokümanda açık.

### Risk: Büyük config UI karmaşık olur

**Azaltma:** Basic/Advanced bölümleri; preset-first workflow; güvenli defaultlar.

---

## Definition of Done

Bir madde yalnızca kod yazıldığında tamamlanmış sayılmaz. Her faz için:

- Type tanımları ve validation tamam.
- Unit/integration testler tamam.
- Error/cancel/invalid input yolu ele alındı.
- Editor resource cleanup doğrulandı.
- Save/reload ve undo/redo gerekiyorsa doğrulandı.
- Runtime parity gerekiyorsa doğrulandı.
- Typecheck geçti.
- Engine testleri geçti.
- Build verify geçti.
- Smoke testi veya kullanıcı Playground doğrulaması yapıldı.
- Dokümana tarihli uygulama notu eklendi.
- Yalnızca doğrulanan checklist maddeleri `[x]` yapıldı.

---

## Son karar önerisi

Forge'a procedural heightmap üretimi eklenmelidir. Mevcut Landscape sistemi artık heightfield,
sculpt, paint, import/export, save ve runtime collision sağladığı için generator yeni bir terrain
sistemi kurmamalı; bu mevcut hattın başında çalışan bir **başlangıç terrain üretim katmanı** olmalıdır.

En doğru ilk production kapsamı:

```text
Seeded FBM/OpenSimplex2
+ Ridged mountains
+ Domain warp
+ Curve/edge falloff/terrace
+ Worker preview
+ Replace/Blend apply
+ Undo/Redo
+ Save/Reload
+ Slope-based weightmaps
+ Thermal erosion
```

Bu kapsam tamamlanmadan hydraulic erosion, node graph, WebGPU, runtime infinite terrain veya biome
simulation'a geçilmemelidir. Böylece Forge kısa sürede kullanılabilir bir procedural terrain aracı
kazanır; sistem daha sonra kontrollü biçimde profesyonel terrain workflow'larına doğru büyütülebilir.
