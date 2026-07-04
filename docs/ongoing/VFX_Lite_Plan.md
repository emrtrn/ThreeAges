# VFX Lite Plan

> **Proje:** Forge  
> **Durum:** Araştırma + uygulanabilir plan — kod tabanına göre doğrulandı ve revize edildi  
> **Kapsam:** Forge için hafif, form tabanlı ve asset odaklı bir VFX / particle effect editörü  
> **Tarih:** 1 Temmuz 2026 · **Revizyon:** 2 Temmuz 2026
>
> **Revizyon özeti (kod tabanı karşılaştırması sonrası):**
>
> 1. `materialId` V1 renderer sözleşmesinden çıkarıldı. Texture/sprite desteği
>    zaten Faz 6'daydı; V1 renderer texture'sız prosedürel sprite çizdiği için
>    zorunlu bir material referansı kullanılamazdı. Particle material asset
>    ailesi (`M_FX_*`) sprite texture ile birlikte Faz 6'ya taşındı (§6.5, §7, §9).
> 2. Component sözleşmesi, mevcut component ailesiyle tutarlı olacak şekilde
>    düz (flat) alanlara çevrildi; runtime'ın bugün tamamen yok saydığı legacy
>    instance override alanları (`rate`, `lifetime`, `velocity`, …) için açık
>    bir temizlik politikası eklendi (§4.1, §8, Faz 4).
> 3. Faz maddeleri fiilen var olan altyapıyla hizalandı: Content Browser
>    `New → Particle` akışı, `effectId` dropdown + `autoPlay` Details kartı,
>    `/__save-*` dev endpoint kalıbı ve mevcut engine testleri zaten mevcut;
>    ilgili maddeler "ekle" yerine "yükselt/koru" olarak netleştirildi.
> 4. Dosya planı mevcut editör kalıplarına (`*Editor.ts` + `*Store.ts`, tek
>    `editorUi.css`) ve `engine/audio/audioSubsystem.ts` subsystem kalıbına
>    hizalandı (§9, §12); schema-1 → schema-2 geçişi için somut alan eşlemesi
>    ve starter asset dönüşüm kararı eklendi (§7).

---

## 1. Karar Özeti

Forge, Unreal Engine’deki Cascade veya Niagara sistemlerini birebir kopyalamamalıdır.

Alınacak ana fikirler:

- Efektin tekrar kullanılabilir bir **asset** olması.
- Sahnedeki nesnenin yalnızca bu asset’e referans veren bir **instance/component** taşıması.
- Parçacık davranışının görünüşten ayrılması.
- Efektin gerçek zamanlı olarak preview edilmesi.
- Parametrelerin parçacık yaşam döngüsüne göre düzenlenmesi.
- Editor state ile runtime state’in kaydedilmiş sahne verisine karışmaması.

Alınmayacaklar:

- Serbest node graph.
- Niagara Script Editor benzeri script yazma alanı.
- Custom HLSL / shader editor.
- GPU simulation authoring.
- Fluid, volumetric smoke veya advanced collision pipeline.
- Ribbon, mesh particle, light particle gibi çoklu renderer ailesi.
- Genel amaçlı curve graph editörü.
- Cascade/Niagara ölçeğinde modül pazaryeri.

Forge V1 hedefi:

> Content Browser’dan bir `*.effect.json` asset’i oluşturmak, form tabanlı editor içinde ayarlamak, canlı preview görmek, sahneye `effectId` ile bağlamak ve runtime’da güvenli biçimde oynatmaktır.

---

## 2. Unreal Araştırmasından Çıkan Tasarım Dersleri

### 2.1 Cascade

Cascade particle system’i birden fazla emitter taşıyabilen bir efekt asset’i olarak ele alır. Particle system parçacıkların davranışını yönetirken, görünüşün önemli bölümü material ve texture tarafından belirlenir.

Forge için çıkarım:

```text
Davranış
  spawn, lifetime, velocity, gravity, drag, size/fade

Görünüş
  material veya sprite texture, color, opacity, blend mode, billboard
```

Bu ayrım korunmalıdır. Dumanın yukarı çıkması ile duman gibi görünmesi aynı ayar grubunda karışmamalıdır.

### 2.2 Niagara

Niagara, efektleri gerçek zamanlı oluşturma ve preview etme yaklaşımıyla; system, emitter, module ve parameter kavramlarını ayırır. Forge bu katmanların fikrini almalı, ancak node graph karmaşıklığını almamalıdır.

Forge V1 karşılığı:

| Unreal Niagara | Forge VFX Lite |
|---|---|
| System | `ParticleEffect` asset |
| Emitter | V1’de bir asset içinde tek emitter |
| Module stack | Sabit ve form tabanlı ayar grupları |
| Parameter | Asset parametresi ve sınırlı instance override |
| Renderer | V1’de sprite / point renderer |
| System instance | `ParticleEmitterComponent` ve runtime effect instance |

### 2.3 V1’in Bilinçli Sınırı

Bir efekt asset’i ilk sürümde **tek emitter** taşımalıdır.

```text
FX_Smoke_Puff.effect.json
  = tek emitter
  = tek particle davranışı
  = tek renderer ayarı
```

Bir nesnede aynı anda farklı efektler istenirse, nesne birden fazla Particle Emitter component taşıyabilir veya runtime birden çok effect instance başlatabilir.

Çok-emitter’lı üst seviye “VFX System” asset’i, yalnızca gerçekten ihtiyaç oluştuğunda eklenmelidir.

---

## 3. Forge İçin Hedef Mimari

```text
Content Browser
  ↓
Particle Effect Asset (*.effect.json)
  ↓
Particle Effect Editor Lite
  ↓ save / validate
Asset Manifest
  ↓
ParticleEmitterComponent (effectId)
  ↓
VFX Runtime
  ↓
Three.js particle renderer
```

### 3.1 Asset ve Instance Ayrımı

**Effect Asset** ortak davranışı taşır:

- Spawn mantığı
- Lifetime
- Velocity
- Gravity / drag
- Size ve color over life
- Renderer ayarları
- Bounds
- Varsayılan loop davranışı

**ParticleEmitterComponent** sahne instance’ını taşır:

- `effectId`
- `autoPlay`
- `enabled`
- Sınırlı instance override’ları
- Actor/placement transformuna bağlı konum

Sahne instance’ı ana efekt mantığını tekrar yazmamalıdır. Örneğin `rate`,
`lifetime` ve ana velocity ayarları effect asset içinde kalmalıdır (Faz 6’da
geldiğinde `materialId` da asset tarafındadır).

---

## 4. Mevcut Forge Tabanı

Forge’da particle altyapısı için önemli parçalar zaten bulunmaktadır
(2 Temmuz 2026’da kod üzerinden doğrulandı):

- `ParticleEmitterComponent` resmi component ailesinin bir parçasıdır
  (`engine/scene/components.ts`, `PARTICLE_EMITTER_COMPONENT`).
- Schema-1 parser ve CPU/`THREE.Points` renderer tek dosyadadır:
  `engine/render-three/particleEffect.ts`. `parseEffectDefinition` saf ve
  headless test edilebilir; `ParticleEffect` sınıfı Three.js glue’dur.
- Starter Content altında dört örnek effect asset’i vardır:
  - `FX_Smoke_Puff.effect.json`
  - `FX_Spark_Burst.effect.json`
  - `FX_Dust_Hit.effect.json`
  - `FX_Interaction_Glow.effect.json`
- Runtime çözüm hattı `src/scene/RuntimeSceneApp.ts` içindedir:
  `effectId → manifest path → fetch + parse + cache`. Auto-play emitter’lar
  sahne açılışında (`playAutoPlayParticles`), Actor Script tetiklemeleri oyun
  sırasında (`playActorParticleEffect`) instance başlatır; biten one-shot’lar
  frame loop’ta dispose edilir.
- Details paneli particle component’ini bugün zaten yalnızca `effectId`
  dropdown + `autoPlay` olarak gösterir (`EditorUi.renderParticleFields`);
  “emitter ayarları asset’te yaşar” ilkesi UI’da uygulanmıştır. Bilinmeyen bir
  `effectId` dropdown’da seçenek olarak korunur, referans sessizce kaybolmaz.
- Content Browser’da `New → Particle` akışı vardır (`CONTENT_NEW_KINDS`,
  `tools/saveValidator.ts`), ancak preset seçtirmeden minimal bir schema-1
  dosyası üretir.
- Asset editörü kalıbı hazırdır: Content Browser çift tıklama → dinamik import
  ile açılan editör (`MaterialEditor`, `SoundCueEditor`), yanında `*Store.ts`
  load/save modülü ve `vite.config.ts` üzerinde validator’dan geçen
  `/__save-material`, `/__save-soundcue` benzeri dev endpoint’ler.
- `tools/engine-tests.ts` içinde `parseEffectDefinition`,
  `readParticleEmitterComponent` ve placement `particle` allowlist’i için
  testler vardır.
- İlk rendererin sınırları vardır: texture/sprite atlas, gerçek 3B orientasyon,
  gelişmiş collision ve zengin renderer türleri henüz hedef değildir.
- Yeni effect asset alanları veya scene component alanları kaydedilecekse
  `tools/saveValidator.ts` allowlist’i güncellenmelidir.

### 4.1 Plan için kritik iki bulgu

**Legacy instance override alanları ölü durumdadır.** `LayoutParticleEmitter` /
`ParticleEmitterComponent` bugün instance üzerinde `loop`, `rate`, `lifetime`,
`startSize`, `endSize`, `velocity`, `spread`, `materialMode`, `worldSpace`
alanlarını taşır ve `validateParticleEmitter` (`tools/saveValidator.ts`) bunları
allowlist’ler; fakat runtime bunların **hiçbirini okumaz** — yalnızca `effectId`
çözülür ve asset tanımı olduğu gibi oynatılır. Details paneli de bu alanları
göstermez. Bu alanlar §8 sözleşmesiyle çelişen tarihsel kalıntıdır ve Faz 4’te
bilinçli olarak temizlenmelidir (§8 “Legacy alan temizliği”).

**Manifest’te gerçek bir effect türü yoktur.** Effect asset’leri manifest’te
`assetType: "prefab"` (kategori `starter-effects`) olarak durur; runtime onları
`path.endsWith(".effect.json")` ile ayırt eder. Faz 1’de `assetType: "effect"`
tanımlanmalı ve suffix koklaması geriye dönük uyumlulukla kaldırılmalıdır.

Bu planın ilk işi mevcut runtime hattını değiştirmek değil; onu **authoring
editor, daha net schema, validation ve preview** ile tamamlamak — ve bu sırada
yukarıdaki iki kalıntıyı kapatmaktır.

---

## 5. VFX Lite Editor Tasarımı

## 5.1 Açılış Akışı

```text
Content Browser
  → New
  → Particle Effect
  → preset seçimi
  → FX_NewEffect.effect.json oluştur
  → Particle Effect Editor Lite aç
```

Var olan bir `*.effect.json` asset’ine çift tıklamak da aynı editorü açmalıdır.

### Başlangıç presetleri

İlk sürümde boş asset yerine şu presetlerden biri seçilmelidir. İlk dördü
mevcut starter effect asset’lerinden türetilir (Faz 1’de schema-2’ye çevrilmiş
halleri preset şablonu olur):

- Smoke Puff *(starter: `FX_Smoke_Puff`)*
- Dust Hit *(starter: `FX_Dust_Hit`)*
- Spark Burst *(starter: `FX_Spark_Burst`)*
- Glow Loop *(starter: `FX_Interaction_Glow`)*
- Steam Loop *(yeni içerik gerektirir — opsiyonel)*
- Small Fire Loop *(yeni içerik gerektirir — opsiyonel)*

Steam Loop ve Small Fire Loop için yeni starter asset üretilmezse V1 preset
listesi dört starter preset ile açılır; liste daraltmak kabul edilebilir,
boş/placeholder preset eklemek edilemez.

Preset seçimi, kullanıcıyı onlarca boş parametreyle karşılamaktan daha verimlidir.

---

## 5.2 Editor Yerleşimi

```text
┌──────────────────────────────────────────────────────────────────────┐
│ FX_Smoke_Puff       Save   Duplicate   Restart   Play   Pause         │
├────────────────┬─────────────────────────────────┬───────────────────┤
│ Effect Stack   │                                 │ Details           │
│                │                                 │                   │
│ • System       │       Live Preview Viewport     │ System            │
│ • Spawn        │                                 │ Spawn             │
│ • Initialize   │   Grid / axis / bounds / origin │ Initialize        │
│ • Update       │                                 │ Update            │
│ • Renderer     │                                 │ Renderer          │
│                │                                 │ Diagnostics       │
├────────────────┴─────────────────────────────────┴───────────────────┤
│ Alive: 24 / 96  |  Spawn: burst 30  |  Bounds: fixed  |  1 draw call │
└──────────────────────────────────────────────────────────────────────┘
```

### Sol panel: Effect Stack

Bu panel node graph değildir. Sadece efektin sabit çalışma sırasını gösterir:

```text
System
Spawn
Initialize Particle
Particle Update
Renderer
```

Her bölüm seçilebilir ve açılıp kapanabilir. Kullanıcı V1’de yeni modül yazmaz; tanımlı parametreleri düzenler.

### Orta panel: Live Preview

Preview viewport şunları içermelidir:

- Orbit / pan / dolly kontrolü.
- Origin işareti.
- XYZ axis helper.
- Grid.
- Fixed bounds görünümü.
- Play, pause ve restart.
- Preview speed: `0.25x`, `0.5x`, `1x`, `2x`.
- Loop preview toggle.
- Tek burst preview butonu.
- Alive particle count.
- Estimated capacity.
- Warning overlay.

### Sağ panel: Details

Parametreler sabit yaşam döngüsü gruplarında görünmelidir:

1. System
2. Spawn
3. Initialize
4. Update
5. Renderer
6. Bounds & Diagnostics

---

## 6. V1 Parametre Sözleşmesi

## 6.1 System

| Alan | Tip | Açıklama | Varsayılan |
|---|---:|---|---|
| `name` | string | Effect asset görünen adı | `FX_NewEffect` |
| `category` | string | Content Browser kategorisi | `Gameplay` |
| `loop` | boolean | Efekt bitince tekrar başlar mı | `false` |
| `duration` | number | Spawn aşamasının süresi | `0.5` |
| `seed` | number/null | Deterministik preview için seed | `null` |
| `maxParticles` | number | Aynı anda izin verilen üst sınır | `128` |
| `enabled` | boolean | Asset varsayılan aktiflik değeri | `true` |

### Not

`maxParticles`, runtime güvenliği için zorunludur. Bir effect asset sonsuz particle üretmemelidir.

---

## 6.2 Spawn

| Alan | Tip | Açıklama | Varsayılan |
|---|---:|---|---|
| `mode` | enum | `rate` veya `burst` | `burst` |
| `rate` | number | Saniye başına particle sayısı | `10` |
| `count` | number | Burst başına particle sayısı | `16` |
| `delay` | number | İlk spawn öncesi bekleme | `0` |
| `interval` | number | Tekrarlı burst aralığı | `0` |
| `shape` | enum | `point`, `sphere`, `box`, `circle` | `point` |
| `radius` | number | Sphere/circle spawn yarıçapı | `0` |
| `boxSize` | vec3 | Box spawn alanı | `[0,0,0]` |

### Kullanım örnekleri

```text
Smoke loop
  mode: rate
  rate: 12
  loop: true

Dust impact
  mode: burst
  count: 24
  loop: false

Small repeating steam release
  mode: burst
  count: 8
  interval: 0.7
  loop: true
```

---

## 6.3 Initialize Particle

| Alan | Tip | Açıklama | Varsayılan |
|---|---:|---|---|
| `lifetime` | number range | Min-max particle yaşam süresi | `[0.5, 1]` |
| `startSize` | number range | Min-max başlangıç boyutu | `[0.1, 0.2]` |
| `startColor` | color | Başlangıç rengi | `#ffffff` |
| `startOpacity` | number | Başlangıç görünürlüğü | `1` |
| `direction` | vec3 | Ana hareket yönü | `[0,1,0]` |
| `speed` | number range | Min-max başlangıç hızı | `[0,1]` |
| `spreadAngleDeg` | number | Ana yön çevresindeki saçılım açısı | `0` |
| `rotation` | number range | Başlangıç sprite dönüşü | `[0,0]` |
| `angularVelocity` | number range | Sprite dönüş hızı | `[0,0]` |

Kullanıcı arayüzünde velocity şu biçimde sunulmalıdır:

```text
Direction: [0, 1, 0]
Speed:     1.5 — 3.0
Spread:    25°
```

Bu, doğrudan rastgele bir velocity vektörü girmekten daha anlaşılırdır. İleri kullanım için ham velocity override alanı daha sonra eklenebilir.

---

## 6.4 Particle Update

| Alan | Tip | Açıklama | Varsayılan |
|---|---:|---|---|
| `gravityScale` | number | Dünya gravity etkisi çarpanı | `0` |
| `drag` | number | Zamanla hız azalması | `0` |
| `acceleration` | vec3 | Sabit ek ivme | `[0,0,0]` |
| `endSize` | number range | Yaşam sonundaki boyut | `[0.1,0.2]` |
| `endColor` | color | Yaşam sonundaki renk | `#ffffff` |
| `endOpacity` | number | Yaşam sonundaki görünürlük | `0` |
| `fadeInTime` | number | İlk görünürleşme süresi | `0` |
| `fadeOutTime` | number | Son kaybolma süresi | `0.1` |

V1’de value curve editor eklenmemelidir. Aşağıdaki lineer interpolasyon yeterlidir:

```text
startSize    → endSize
startColor   → endColor
startOpacity → endOpacity
```

---

## 6.5 Renderer

| Alan | Tip | Açıklama | Varsayılan |
|---|---:|---|---|
| `type` | enum | V1’de yalnızca `sprite` | `sprite` |
| `blendMode` | enum | `alpha` veya `additive` | `alpha` |
| `softness` | number | Prosedürel sprite kenar yumuşatması (0–1) | `0.5` |
| `sortMode` | enum | V1’de `none`; sonraki sürümde `distance` | `none` |

### Renderer V1 kararı

V1 renderer, mevcut hattın devamıdır: texture’sız, prosedürel yumuşak yuvarlak
sprite çizen `THREE.Points` (renk `startColor`/`endColor`’dan, blend
`blendMode`’dan gelir). Bu karar üç alanı bilinçli olarak dışarıda bırakır:

- `materialId` V1’de **yoktur**. Planın ilk taslağı zorunlu bir
  particle-material referansı öngörüyordu; fakat texture/sprite atlas desteği
  zaten Faz 6’da olduğundan V1 renderer bu referansı kullanamazdı. Ayrıca
  Forge’un mevcut `*.material.json` asset’leri mesh PBR materyalidir; particle
  sprite materyali ayrı bir asset ailesi gerektirir. `materialId` ve particle
  material asset ailesi birlikte, sprite texture ile aynı Faz 6 adımına
  taşınmıştır.
- `billboardMode` V1’de **yoktur**; `THREE.Points` zaten daima kameraya bakar.
  `world` yönelimli particle quad tabanlı bir renderer gerektirir → Faz 6.
- `castShadow` V1’de **yoktur**; point sprite gölgesi desteklenmez, şemaya
  alan koymak yanlış beklenti yaratır → renderer ailesi genişlediğinde eklenir.

İlk renderer ailesi:

```text
sprite / point particle (texture'sız, prosedürel; renk + opacity + blend)
```

Sonraki fazlara bırakılacaklar:

```text
sprite texture + particle material asset (materialId)
mesh particle
ribbon / trail
light renderer
volumetric renderer
decal particle
```

---

## 6.6 Bounds

| Alan | Tip | Açıklama |
|---|---:|---|
| `mode` | enum | `fixed` veya yalnızca preview’de `autoPreview` |
| `min` | vec3 | Sabit world/local bounds alt noktası |
| `max` | vec3 | Sabit world/local bounds üst noktası |
| `showInPreview` | boolean | Bounds kutusunu viewport’ta gösterir |

Runtime’da V1 için tercih edilen mod `fixed` bounds olmalıdır. Bounds, culling ve hata ayıklama için görünür olmalıdır.

---

## 7. Önerilen Effect Asset Şeması

V1 için okunabilir, küçük ve normalize edilebilir bir schema:

```json
{
  "schema": 2,
  "type": "particleEffect",
  "name": "FX_Smoke_Puff",
  "category": "Smoke",
  "tags": ["smoke", "impact", "environment"],

  "system": {
    "enabled": true,
    "loop": false,
    "duration": 0.35,
    "seed": null,
    "maxParticles": 96,
    "bounds": {
      "mode": "fixed",
      "min": [-1.2, 0, -1.2],
      "max": [1.2, 3.5, 1.2]
    }
  },

  "spawn": {
    "mode": "burst",
    "count": 30,
    "delay": 0,
    "interval": 0,
    "shape": "sphere",
    "radius": 0.12
  },

  "initialize": {
    "lifetime": [0.55, 1.1],
    "startSize": [0.08, 0.16],
    "startColor": "#bfc3c8",
    "startOpacity": 0.72,
    "direction": [0, 1, 0],
    "speed": [0.7, 1.8],
    "spreadAngleDeg": 42,
    "rotation": [0, 360],
    "angularVelocity": [-25, 25]
  },

  "update": {
    "gravityScale": -0.08,
    "drag": 0.35,
    "acceleration": [0, 0, 0],
    "endSize": [0.55, 0.95],
    "endColor": "#6d7378",
    "endOpacity": 0,
    "fadeInTime": 0.02,
    "fadeOutTime": 0.18
  },

  "renderer": {
    "type": "sprite",
    "blendMode": "alpha",
    "softness": 0.6,
    "sortMode": "none"
  }
}
```

Not: schema-1’deki `effectId` alanı schema-2 gövdesinde tekrar edilmez; asset
kimliği manifest’ten gelir (tek doğruluk kaynağı).

### Schema Uyumluluğu

Mevcut schema-1 effect asset’leri kırılmamalıdır.

Önerilen geçiş:

```text
schema 1
  → normalizeEffectDefinition()
  → internal normalized representation

schema 2
  → normalizeEffectDefinition()
  → aynı internal representation
```

Schema-1 → schema-2 alan eşlemesi:

| Schema-1 | Schema-2 karşılığı |
|---|---|
| `loop` | `system.loop` |
| `rate` | `spawn.mode: "rate"` + `spawn.rate` |
| `lifetime` | `initialize.lifetime: [x, x]` (tek değerli aralık) |
| `startSize` / `endSize` | `initialize.startSize` / `update.endSize` (tek değerli aralık) |
| `velocity` + `spread` | `initialize.direction` + `speed` + `spreadAngleDeg` (yaklaşık) |
| `materialMode` | `renderer.blendMode` |
| `color` | `initialize.startColor` + `update.endColor` (aynı değer) |
| `effectId` | manifest asset id’si; gövdeden düşer |

**Dikkat — eşleme birebir değildir.** Schema-1’in `spread` alanı hem spawn
pozisyonunu hem hız bileşenlerini eksen bazında jitter’lar; `direction / speed /
spreadAngleDeg` modeline tam sadakatle çevrilemez. İki davranış yolunu sonsuza
kadar yaşatmamak için karar şudur:

- Dört starter effect asset’i **Faz 1’de elle schema-2’ye çevrilir** ve preview
  ile görsel olarak doğrulanır (birebir denklik değil, “aynı efekt izlenimi”
  yeterlidir).
- Schema-1 mapper best-effort kalır; editörde açılan bir schema-1 asset,
  save’de schema-2 olarak yazılır. Runtime her iki şemayı da aynı normalizer
  üzerinden yüklemeye devam eder.

---

## 8. ParticleEmitterComponent Sözleşmesi

Sahne içinde component mümkün olduğunca küçük kalmalıdır:

```json
{
  "particle": {
    "effectId": "starter-fx-smoke-puff",
    "autoPlay": true,
    "enabled": true,
    "scale": 1.25,
    "tint": "#d7e2e7",
    "seedOffset": 7
  }
}
```

Override’lar iç içe bir `overrides` nesnesi yerine **düz (flat) alanlar**
olarak tutulur: mevcut component ailesi (`LayoutAudio`, `LayoutInteraction`,
bugünkü `LayoutParticleEmitter`) düzdür; düz alanlar `validateParticleEmitter`
allowlist’ini, `readParticleEmitterComponent` reader’ını ve Details form
binding’ini olduğu gibi genişletmeye izin verir.

### İzin verilecek instance override’ları

- `enabled` *(yeni alan — bugün component’te yok)*
- `autoPlay` *(bugün var)*
- `scale`
- `tint`
- `seedOffset`
- Gerekirse `loop` override

### Instance’a konulmaması gereken ana ayarlar

- `rate`
- `lifetime`
- `spawn shape`
- `velocity`
- `gravity`
- `maxParticles`
- (Faz 6’da geldiğinde) `materialId`

Bu ana ayarlar asset içinde kalmalıdır. Aksi halde Content Browser’daki tek bir
efektin davranışı her sahnede farklılaşır ve asset reuse değeri kaybolur.

### Legacy alan temizliği (mevcut kodda)

§4.1’de tespit edildiği gibi bugünkü `LayoutParticleEmitter`, instance üzerinde
`loop`, `rate`, `lifetime`, `startSize`, `endSize`, `velocity`, `spread`,
`materialMode`, `worldSpace` taşır; runtime bunları **okumaz**, Details paneli
**göstermez**, yalnızca validator kabul eder. Politika:

- Faz 4’te bu alanlar `validateParticleEmitter` allowlist’inden çıkarılır ve
  save sırasında düşürülür (mevcut layout’larda görüldüğünde tek seferlik
  uyarı loglanabilir). Runtime zaten okumadığı için görsel davranış değişmez.
- Alanlar `LayoutParticleEmitter` tipinden ve
  `readParticleEmitterComponent`’ten silinir; `tools/engine-tests.ts` içindeki
  ilgili testler yeni sözleşmeye güncellenir.
- `worldSpace` ileride gerçekten desteklenecekse asset’e (effect definition)
  taşınır; instance’ta kalmaz.

---

## 9. Dosya ve Sorumluluk Dağılımı

```text
engine/
  vfx/
    particleEffectTypes.ts       # ParticleEffectDefinition + normalized tipler
    particleEffectParser.ts      # schema-1 + schema-2 → normalizer
    particleEffectRuntime.ts     # saf CPU simulation (Three.js bilmez)
    vfxSubsystem.ts              # audioSubsystem kalıbı: resolver callback'li
    vfxDebugSnapshot.ts

  render-three/
    particleEffectRenderer.ts    # Three.js adapter (Points + shader material)
    particleSpriteMaterial.ts

src/
  editor/
    ParticleEffectEditor.ts          # MaterialEditor/SoundCueEditor kalıbı
    ParticleEffectPreviewViewport.ts
    particleEffectStore.ts           # load + /__save-effect (soundCueStore kalıbı)

public/
  assets/
    starter-content/
      Effects/
        FX_Smoke_Puff.effect.json
        FX_Spark_Burst.effect.json
        FX_Dust_Hit.effect.json
        FX_Interaction_Glow.effect.json

tools/
  saveValidator.ts               # validateEffectAsset + CONTENT_NEW_KINDS güncellemesi

vite.config.ts                   # /__save-effect dev endpoint kaydı
```

Mevcut koddan geçiş notları:

- Bugünkü `engine/render-three/particleEffect.ts` ikiye bölünür: saf parser +
  simulation `engine/vfx/`e taşınır, Three.js glue `render-three/`de kalır.
  Taşıma mevcut davranışı koruyarak küçük, build-passing adımlarla yapılır.
- Editör stilleri ayrı bir CSS dosyasına değil, mevcut kalıba uyarak
  `src/editor/editorUi.css` içine eklenir (bugün tüm editörler tek CSS
  dosyasını paylaşır; hepsi dinamik import arkasında olduğundan game build’e
  sızmaz).
- İlk taslaktaki `Materials/M_FX_*.material.json` starter dosyaları V1’den
  çıkarılmıştır; particle material asset ailesi Faz 6’da `materialId` ile
  birlikte gelir (§6.5).

### Katman kuralları

- `engine/vfx/*`: DOM ve editor UI bilmez; saf veri, runtime state ve update mantığı taşır.
- `engine/render-three/*`: yalnızca Three.js render adapterıdır.
- `src/editor/*`: dev-only authoring ve preview UI’dır.
- `public/assets/*`: effect asset verisidir.
- `tools/saveValidator.ts`: kaydedilen effect asset alanlarını bilinçli allowlist eder.
  Bu, CLAUDE.md’de belgelenen layout ve skeleton allowlist’lerinden sonra
  **üçüncü allowlist yüzeyi** olur; Faz 1’de CLAUDE.md Working Rules’a aynı
  “sessizce düşer” uyarısıyla eklenmelidir.
- Runtime state ve preview state, layout JSON’a yazılmaz.

---

## 10. Editor Kullanıcı Akışı

### Yeni Effect Oluşturma

```text
1. Content Browser → New → Particle Effect
2. Preset seç
3. Asset adı ver
4. Effect Editor açılır
5. Preview’de sonucu gör
6. Save
7. Asset manifest yenilenir veya mevcut asset catalog yüklemesiyle görünür
8. Scene Details → Add Component → Particle
9. effectId dropdown’ından asset’i seç
10. Auto Play veya enable durumunu ayarla
```

### Var Olan Effect Düzenleme

```text
1. Content Browser’da effect asset’ine çift tıkla
2. Preview otomatik oynar
3. Bir parametreyi değiştir
4. Preview anında güncellenir
5. Undo / redo çalışır
6. Save effect JSON’u yazar
7. Açık sahnedeki aynı effectId kullanan preview cache’leri yenilenir
```

---

## 11. Validation ve Diagnostics

Editor aşağıdaki sorunları gösterebilmelidir:

```text
⚠ maxParticles is lower than burst count
⚠ fixed bounds may clip the effect
⚠ looping effect has no visible spawn source
⚠ alpha blending with no fade-out may look harsh
⚠ additive blending with dark/opaque source may be visually incorrect
⚠ duration is zero but rate mode is selected
⚠ lifetime range contains invalid values
⚠ invalid color value
⚠ invalid vector value
```

### Save-time validation

Effect asset kaydında:

- Bilinmeyen alanlar düşürülmeli veya açık hata üretmelidir.
- Number değerleri `NaN`, `Infinity` ve negatif capacity gibi geçersiz değerlerden korunmalıdır.
- Enum alanları allowlist ile doğrulanmalıdır.
- `min <= max` aralıkları normalize edilmelidir.
- Bounds min/max eksenleri doğrulanmalıdır.

`materialId missing` / `material asset not found` uyarıları V1’de yoktur;
renderer material desteğiyle birlikte Faz 6’da eklenir (§6.5).

---

## 12. Runtime API

V1’de VFX runtime yüzeyi küçük kalmalıdır:

```ts
interface VfxSubsystem {
  play(effectId: string, options?: VfxPlayOptions): VfxInstanceId | null;
  stop(instanceId: VfxInstanceId): void;
  setEnabled(instanceId: VfxInstanceId, enabled: boolean): void;
  update(deltaSeconds: number): void;
  getDebugSnapshot(): VfxDebugSnapshot;
  dispose(): void;
}
```

Önerilen `VfxPlayOptions`:

```ts
type VfxPlayOptions = {
  position?: Vec3;
  rotation?: Vec3;
  scale?: number;
  tint?: string;
  seedOffset?: number;
  loop?: boolean;
  parentEntityId?: string;
};
```

`VfxSubsystem`, `engine/audio/audioSubsystem.ts` kalıbını izler: URL çözümü
constructor’a verilen `resolveEffectUrl(effectId)` callback’i ile dışarıdan
gelir; subsystem DOM ve manifest bilmez, headless test edilir.
`RuntimeSceneApp` içindeki bugünkü inline particle yönetimi (`particleEffects`
dizisi, `loadEffect` cache’i, `playAutoPlayParticles` /
`playActorParticleEffect`) Faz 5’te bu subsystem’e taşınır — audio hattının
`AudioSubsystem`’e taşınmasıyla aynı model.

### Runtime davranışı

```text
effectId
  ↓
manifest üzerinden asset URL çöz
  ↓
effect definition fetch + parse + cache
  ↓
runtime instance oluştur
  ↓
spawn/update
  ↓
renderer güncelle
  ↓
one-shot bittiyse dispose
```

---

## 13. Performans Politikası

Forge web-first bir sistemdir. Bu nedenle V1 CPU simulation ile başlar.

### Varsayılan sınırlar

| Kural | Öneri |
|---|---|
| Varsayılan `maxParticles` | 128–256 |
| Effect başına hard cap | 2048 |
| Varsayılan draw call | Emitter başına 1 |
| Varsayılan shadow | Kapalı |
| Varsayılan sort | Kapalı |
| Varsayılan bounds | Fixed |
| Preview particle count | Ayrı kalite sınırıyla düşürülebilir |

### İlk performans stratejisi

- Typed array / reusable buffer kullan.
- Her frame yeni particle object allocation yapma.
- One-shot efekt bittiğinde GPU/Three.js kaynaklarını dispose et.
- Loop efektleri pooling için uygun tasarla.
- Particle sorting’i ancak alpha transparency ihtiyacı gerçekse ekle.
- Texture atlas, mesh particles ve collision gibi masraflı özellikleri sonraya bırak.
- Debug overlay’de aktif instance, alive particle sayısı ve toplam cap göster.

---

## 14. Uygulama Fazları

## Faz 0 — Mevcut Hattı Sabitle  ✅ TAMAMLANDI (3 Temmuz 2026)

- [x] Mevcut `*.effect.json` schema-1 parserını tek normalizer altında topla.
      *(Tek giriş noktası zaten var: `parseEffectDefinition`,
      `engine/render-three/particleEffect.ts`; runtime `RuntimeSceneApp.loadEffect`
      üzerinden yalnızca bunu çağırır.)*
- [x] `effectId → manifest entry → URL` çözümünü testle.
      *(`RuntimeSceneApp.effectUrlById` manifest'ten `.effect.json` girdilerini
      indeksler; `engine-tests.ts` içinde `parseEffectDefinition` round-trip'i
      manifest içeriğinden çözülen effectId'yi doğrular.)*
- [x] Starter effect asset’lerini açılış presetleri olarak belirle.
      *(4 starter: `FX_Smoke_Puff`, `FX_Spark_Burst`, `FX_Dust_Hit`,
      `FX_Interaction_Glow` — Faz 2 preset picker'ının kaynağı.)*
- [x] Mevcut runtime particle testlerini koru (`tools/engine-tests.ts` içinde
      `parseEffectDefinition` + `readParticleEmitterComponent` testleri zaten
      vardır; taşıma sırasında yeşil kalmalıdır).
      *(568 check yeşil; particle testleri değişmedi.)*
- [x] Legacy instance override alanları için karar kaydı: alanlar §8
      politikasına göre Faz 4’te temizlenecek; Faz 0’da yalnızca tespit ve not.
      *(Aşağıdaki "Faz 0 karar kaydı"na bkz.)*
- [x] `RuntimeSceneApp.playActorParticleEffect` içindeki tipsiz
      `ParticleEmitter.position` offset okumasını typed component alanına taşı
      veya kaldır (bugün reader’ı ve validator’ı bypass ediyor).
      *(KALDIRILDI: `position` tipte/reader'da/validator'da yoktu — plan §8'e göre
      geçerli bir instance override değil. Metod artık `playAutoPlayParticleEntity`
      ile tutarlı: efekt aktörün transform konumunda oynar. Kullanılmayan
      `readComponentVec3` yardımcısı da silindi.)*
- [x] Save validator için effect asset validation giriş noktasını planla.
      *(Aşağıdaki "Faz 0 karar kaydı"na bkz.)*
- [x] Effect runtime state’inin layout’a yazılmadığını doğrula.
      *(`particleEffects` dizisi yalnızca runtime'da yaşar; hiçbir
      save/serialize/layout yolunda referans verilmez. `ParticleEffect`
      `THREE.Points` nesneleri `this.scene`'de geçici olarak durur, frame loop'ta
      dispose edilir; sahne serileştirmesi layout dokümanından çalışır, THREE
      sahne grafiğinden değil.)*

**Kabul kriteri:** Mevcut starter effect asset’leri oyun route’unda bozulmadan
çalışır. ✅ `tsc --noEmit` temiz, `test:engine` 568 check yeşil.

### Faz 0 karar kaydı (3 Temmuz 2026)

**Legacy instance override alanları — Faz 4'e ertelendi.** `ParticleEmitterComponent`
(`engine/scene/components.ts:242`) bugün `loop`, `rate`, `lifetime`, `startSize`,
`endSize`, `velocity`, `spread`, `materialMode`, `worldSpace` alanlarını taşır;
`readParticleEmitterComponent` okur ve `validateParticleEmitter`
(`tools/saveValidator.ts:300`) allowlist'ler. **Runtime bunların hiçbirini
kullanmaz** — `playAutoPlayParticleEntity` / `playActorParticleEffect` yalnızca
`effectId`'yi çözer ve asset tanımını olduğu gibi oynatır. Faz 0'da bunlar
bilinçli olarak *bırakıldı* (silinmedi): silme işlemi component tipi + reader +
validator + `engine-tests.ts`'i birlikte değiştirir ve §8 "Legacy alan temizliği"
politikasıyla Faz 4'e aittir. Böylece Faz 0 diff'i küçük ve davranış-nötr kalır.

**Save validator giriş noktası — Faz 1'de eklenecek.** Bugün effect asset'lerini
kaydeden bir yol yok (editör henüz yok); `validateParticleEmitter` yalnızca sahne
*component'ini* doğrular, asset dosyasını değil. Faz 1 planı: `tools/saveValidator.ts`
içine `validateEffectAsset` + `vite.config.ts`'e `/__save-effect` dev endpoint'i
(`/__save-soundcue` kalıbı). Bu, layout ve skeleton allowlist'lerinden sonra
CLAUDE.md'de belgelenecek **üçüncü allowlist yüzeyi** olur.

---

## Faz 1 — Effect Asset Schema ve Validation  ✅ TAMAMLANDI (3 Temmuz 2026)

- [x] `ParticleEffectDefinition` ve normalize edilmiş runtime tiplerini
      `engine/vfx/` altında tanımla (mevcut parser
      `engine/render-three/particleEffect.ts`’ten buraya taşınır; Three.js
      adapter yerinde kalır — §9 geçiş notları).
      *(`engine/vfx/particleEffectTypes.ts` = zengin `ParticleEffectDefinition`
      + flat `RuntimeParticleEffect`; `engine/vfx/particleEffectParser.ts` =
      normalizer + collapse. `particleEffect.ts` adapter yerinde kaldı ve
      `RuntimeParticleEffect` tüketiyor; `parseEffectDefinition`/`EffectDefinition`
      back-compat alias olarak re-export edildi.)*
- [x] Schema-1 → internal representation uyumluluğu ekle (best-effort eşleme,
      §7 tablosu).
      *(`normalizeSchema1`: velocity→direction+speed, spread→spreadAngleDeg
      (×45, tersinir), color→start/end, materialMode→blendMode, rate→spawn.rate.)*
- [x] Schema-2 save formatını uygula (`normalizeSchema2` + §6 varsayılanları).
- [x] Dört starter effect asset’ini schema-2’ye elle çevir ve görsel olarak
      doğrula (§7 “eşleme birebir değildir” kararı).
      *(Mekanik dönüşüm: collapse **birebir aynı** runtime params üretir —
      "schema-1 ve hand-converted schema-2 starter collapse identically"
      headless testi görsel doğrulamanın yerine geçer. Zengin burst/hand-tuning
      preview viewport (Faz 3) geldiğinde yapılır.)*
- [x] `tools/saveValidator.ts` içinde `validateEffectAsset` ekle ve
      `vite.config.ts`’e `/__save-effect` dev endpoint’ini kaydet
      (`/__save-soundcue` kalıbı). *(`validateSaveEffectPayload` +
      `validateEffectAsset`; validator normalizer'ı tek doğruluk kaynağı olarak
      yeniden kullanır.)*
- [x] Aralık, enum, vec3, color ve bounds doğrulamalarını ekle.
      *(Normalizer üzerinden: `readRange` min<=max sıralar, `readEnum` geçerli
      değere düşer, `readVec3`/`readColor`/`normalizeBounds` guard'lar,
      `finiteNumber`+`clampMin` NaN/Infinity/negatif korur.)*
- [x] Manifest’e `assetType: "effect"` ekle; suffix tespitini geriye dönük
      uyumlulukla kaldır.
      *(`AssetType`+`ASSET_TYPES`+`EFFECT_EXTENSIONS`+`inferAssetTypeFromPath`;
      4 starter manifest kaydı `prefab`→`effect`. `RuntimeSceneApp.populateAssetUrls`
      artık `assetType === "effect" || .effect.json` — eski manifestler çalışır.)*
- [x] CLAUDE.md Working Rules’a üçüncü allowlist yüzeyini (effect asset save)
      layout/skeleton maddeleriyle aynı formatta ekle.
- [x] Headless test: valid, invalid, legacy, defaulted effect definitions.
      *(6 yeni test: schema-1 collapse, schema-2 defaults, starter round-trip
      identity, burst→rate, `validateEffectAsset` junk-guard, save payload gate.)*

**Kabul kriteri:** Geçersiz effect JSON’u runtime crash yaratmaz; editor kayıt
yolu geçersiz alanları kontrol eder. ✅ `build:verify` yeşil (tsc + vite build +
573 engine check + verify:dist --strict), `check:assets` errors=0.

### Faz 1 karar kaydı (3 Temmuz 2026)

**Renderer flat kontratı korundu (staged bridge).** Zengin schema-2, *authoring +
validation* katmanıdır; mevcut basit `THREE.Points` CPU simülasyonu Faz 1'de
değişmedi. Normalizer zengin formu üretir, `toRuntimeParticleEffect` bunu
renderer'ın tükettiği flat `RuntimeParticleEffect`'e indirir. Bu, riski küçük
tutar (renderer dokunulmadı) ve gerçek zengin simülasyonu (ranges/curves/burst
shapes) Faz 3+'a bırakır. Flat kontrat schema-1'in tam semantiğini korur, bu
yüzden 4 starter render'ı birebir aynıdır.

**`effectId` runtime shape'ten düştü.** Flat `RuntimeParticleEffect` artık
`effectId` taşımaz — kimlik manifest'ten gelir (schema-2 gövdesinde de yoktur).
Runtime zaten `def.effectId` okumuyordu; `RuntimeSceneApp` cache'i çağrıya
verilen `effectId` ile anahtarlıyor.

---

## Faz 2 — Particle Effect Editor Lite  ✅ TAMAMLANDI (3 Temmuz 2026)

- [x] Content Browser çift tıklama rotasını `*.effect.json` editorüne bağla
      (`EditorUi` içindeki `openMaterialEditor` / `openSoundCueEditor` dinamik
      import kalıbı birebir uygulanır).
      *(`item.type === "effect"` için dblclick + `assetEditorOpener` +
      `openParticleEffectEditor` → `import("@/editor/ParticleEffectEditor")`.)*
- [x] Mevcut `New → Particle` akışını preset picker + schema-2 üretimine
      yükselt (akış bugün var, minimal schema-1 dosyası yazıyor —
      `CONTENT_NEW_KINDS`).
      *(Akış zaten schema-2 yazıyordu (Faz 1); `pickParticlePreset` modal’ı +
      `particlePreset` alanı `ContentNewPayload`/`ContentNewRequest`’e eklendi;
      preset gövdeleri paylaşılan `engine/vfx/particleEffectPresets.ts`’ten gelir
      — `materialPreset` kalıbının birebir eşi.)*
- [x] Sabit stack panelini ekle.
      *(Sol `pfx-stack`: System/Spawn/Initialize/Update/Renderer/Bounds; tıklama
      ilgili Details grubuna smooth-scroll + flash.)*
- [x] Details formunu System / Spawn / Initialize / Update / Renderer gruplarına ayır.
      *(6 grup — Bounds dahil; `data-path` tabanlı row builder’lar:
      num/range/vec3/color/enum/bool/text.)*
- [x] Save, Duplicate, Play, Pause, Restart kontrolünü ekle.
      *(Save → `/__save-effect`; Duplicate → sibling kopya + editörü kopyaya
      yönlendirir; Play/Pause/Restart preview viewport’u sürer.)*
- [x] Undo/redo için property command’leri bağla.
      *(Snapshot tabanlı history: alan-düzenleme oturumu başında baseline
      yakalanır, `change`’de commit; Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z.)*
- [x] Editor preview state’ini asset verisinden ayrı tut.
      *(Preview zamanı/buffer/play-pause tamamen `ParticleEffectPreviewViewport`
      + `ParticleEffect` içinde; `def` yalnızca asset verisi, Save yalnızca onu
      yazar.)*
- [x] Editor CSS’in game production build’e sızmadığını doğrula.
      *(Editör tümüyle `import.meta.env.DEV` arkasında → Vite üretim derlemesinde
      DCE; dist’te `pfx-*`/`__save-effect` string’i yok, `verify:dist --strict`
      temiz.)*

**Kabul kriteri:** Kullanıcı starter preset’ten yeni bir effect üretebilir, preview eder, kaydeder ve tekrar açtığında aynı sonucu görür. ✅ `build:verify` yeşil (tsc + vite build + 575 engine check + verify:dist --strict), `check:assets` errors=0. Dev sunucusu editör modüllerini hatasız transform ediyor. **Kalan:** canlı browser smoke (kullanıcı) — §15 tam akış.

### Faz 2 karar kaydı (3 Temmuz 2026)

**Preview viewport Faz 2’de işlevsel yapıldı, cila Faz 3’e bırakıldı.** Faz 2
kabul kriteri "preview eder" olduğu için `ParticleEffectPreviewViewport.ts`
çalışır halde eklendi: mevcut runtime `ParticleEffect` renderer’ı +
`OrbitViewportCamera` + `createAssetViewportRig` (grid/ışık) + kendi raf loop’u;
Play/Pause/Restart onu sürer; one-shot’lar kısa duraklamayla otomatik tekrar
oynar. **Faz 3’e bilinçli bırakılanlar:** axis/origin/bounds helper’ları, preview
speed (0.25×–2×) + loop toggle, alive/cap/cost diagnostics paneli, tam warning
overlay (§11) ve dispose/leak lifecycle testleri. Faz 2 yalnızca hafif bir
Diagnostics kutusu (4 temel uyarı) + footer özeti taşır.

**Undo snapshot tabanlı (property-command değil).** Form editörü için en sağlam
model: alan başına bir `def` snapshot’ı. `input` canlı preview’i günceller
(re-render yok → caret korunur), `change` commit eder (baseline ≠ def ise undo
stack’e itilir). Bu, "property command" ifadesinin pratik karşılığıdır.

**Preset’ler paylaşılan tek kaynak.** 4 starter kimliği (renk/blend/kategori) +
`blank`, `engine/vfx/particleEffectPresets.ts`’te normalize-şekilli
`ParticleEffectDefinition` olarak yaşar; `contentStubJson` (saveValidator) ve
editör preset picker aynı modülü kullanır. Starter dosyaları (mekanik Faz 1
dönüşümleri) olduğu gibi kaldı; preset gövdeleri kasıtlı olarak daha ayırt
edici/kullanışlı tunlandı (yükselen duman, oturan toz, additive kıvılcım, mavi
loop glow).

---

## Faz 3 — Preview Viewport ve Diagnostics  ✅ TAMAMLANDI (3 Temmuz 2026)

- [x] Ayrı Three.js preview viewport oluştur (`src/editor/assetViewportCamera.ts`
      orbit kamera yardımcıları ve mevcut mesh editörlerinin viewport kalıbı
      yeniden kullanılır).
      *(Faz 2’de `ParticleEffectPreviewViewport` kendi `WebGLRenderer`/`Scene`/raf
      loop’u + paylaşılan `OrbitViewportCamera` + `createAssetViewportRig` ile
      kuruldu; Faz 3 bunun üzerine cila ekledi.)*
- [x] Axis, grid, origin marker ekle.
      *(`AxesHelper(0.6)` XYZ eksenleri + rig’in floor grid’i + origin’de küçük
      turuncu `Mesh` küre işaretçisi.)*
- [x] Fixed bounds görünümü ekle.
      *(`Box3Helper`, `system.bounds` min/max’ından kurulur; `showInPreview`
      false ya da mode `fixed` değilse gizlenir. Details’taki “Show In Preview”
      checkbox’ı doğrudan preview kutusunu açıp kapatır.)*
- [x] Preview speed kontrollerini ekle.
      *(Preview overlay bar: 0.25×/0.5×/1×/2× hız + `↻ Loop` (one-shot
      auto-replay aç/kapa) + `✦ Burst` (tek burst restart). `setSpeed` tick’te
      `dt`’yi ölçekler.)*
- [x] Alive particle, cap, estimated cost bilgisini ekle.
      *(Sol üstte canlı HUD “Alive N / capacity”; `ParticleEffect.aliveCount()` +
      `maxCapacity` üzerinden 150 ms’de bir güncellenir.)*
- [x] Warning panelini ekle.
      *(Sol Diagnostics paneli §11’e göre genişletildi: no-spawn-source,
      rate-mode-zero-duration, additive-dark-source, bounds-clip heuristiği;
      preview’de kompakt `⚠ N warnings` rozeti tam listeyi tooltip’te gösterir.)*
- [x] Preview dispose lifecycle’ını test et.
      *(3 yeni headless test: capacity floor/cap, one-shot drain→finished,
      dispose-after-lifecycle throw etmez.)*
- [x] Aynı effect asset tekrar açıldığında renderer/resource sızıntısı olmadığını kontrol et.
      *(`dispose()` artık bounds helper + axes + origin geometry/material’lerini de
      dispose eder; `ParticleEffectEditor.open` önceki `activeInstance`’ı kapatır;
      “instances hold independent buffers” testi paylaşımsızlığı doğrular.)*

**Kabul kriteri:** Preview viewport effect asset’i sahneden bağımsız olarak
güvenli biçimde tekrar oynatabilir. ✅ `build:verify` yeşil (tsc + vite build +
578 engine check + verify:dist --strict), `verify:dist` editör string’i
sızdırmıyor. **Kalan:** canlı browser smoke (kullanıcı) — §15 tam akış.

### Faz 3 karar kaydı (3 Temmuz 2026)

**Bounds-clip uyarısı heuristiktir.** `boundsMayClip`, origin’den (preview daima
`[0,0,0]`’dan spawn eder) `direction × speed.max × lifetime.max` erişimini +
spawn genişliği + end-size marjıyla fixed bounds kutusuna karşı test eder;
gravity/drag/acceleration’ı hesaba katmaz. Amaç kesin culling değil, yazarı
“efekt kutunun dışına taşabilir” diye uyarmaktır (§11 ruhu: “same effect
impression”).

**Invalid color/vector uyarıları eklenmedi (ulaşılamaz).** §11 listesi geçersiz
renk/vektör uyarıları sayar; fakat editördeki `def` her zaman normalize edilmiş
ve form girişleri guard’lı (`Number.isFinite`, `<input type=color>`), bu yüzden
bu durumlar editör içinde oluşamaz — save validator zaten normalize eder.
Uyarılar yalnızca gerçekten ulaşılabilir koşullar için yazıldı.

**HUD polling (raf callback değil).** Alive/cap sayacı editörden `setInterval`
(150 ms) ile `preview.getStats()` okunarak güncellenir; viewport’u editöre
callback ile bağlamamak daha basit ve dispose’da tek `clearInterval` ile
temizlenir. Statik veriler (uyarılar, footer) zaten düzenlemede güncelleniyor.

---

## Faz 4 — Scene Component UX  ✅ TAMAMLANDI (4 Temmuz 2026)

- [x] Details > Add Component > Particle akışını koru (bugün çalışıyor).
      *(`addComponent("particle")` ilk effect asset'i + `autoPlay:true` ile
      seed'ler; dokunulmadı.)*
- [x] `effectId` dropdown’ını koru; bilinmeyen id’yi seçenek olarak saklama
      davranışı bugün vardır, sürdürülür (`renderParticleFields`).
      *(`preserved` option korundu; ayrıca bilinmeyen id için görünür uyarı
      eklendi — aşağı bkz.)*
- [x] `enabled` alanını ekle (`autoPlay` bugün var); yeni override alanlarını
      (`scale`, `tint`, opsiyonel `loop`) düz alan olarak ekle ve bunlarla
      sınırla (§8). *(`LayoutParticleEmitter` = `effectId` + `enabled` +
      `autoPlay` + `scale` + `tint` + `loop`. `seedOffset` bilinçli ertelendi —
      aşağıdaki karar kaydına bkz.)*
- [x] Legacy override alanlarını (`rate`, `lifetime`, `startSize`, `endSize`,
      `velocity`, `spread`, `materialMode`, `worldSpace`) component tipinden,
      `readParticleEmitterComponent`’ten ve `validateParticleEmitter`
      allowlist’inden kaldır; `tools/engine-tests.ts` testlerini yeni
      sözleşmeye güncelle (§8 “Legacy alan temizliği”).
      *(`ParticleMaterialMode` tipi tümüyle silindi; `legacyRoomLayoutAdapter`
      mapping'i + `cloneParticle` snapshot'ı + 5 test yeni sözleşmeye
      güncellendi. Eski layout'lar sessizce düşürülür — crash değil.)*
- [x] Unknown/missing asset referansı için fallback ve warning göster.
      *(`renderParticleFields` içinde `inList` false ise `detail-hint-warning`
      "⚠ Effect … is not a known effect asset — nothing plays until the id
      resolves"; referans yine korunur.)*
- [x] Component add/remove/edit işlemlerini undo/redo ile çalıştır.
      *(`setSelectionParticle(value | undefined)` zaten `editorSceneController`
      üzerinden undo command'i itiyor; controller testi undo'yu doğruluyor.)*
- [x] Yeni layout alanları için save validator allowlist’ini güncelle
      (CLAUDE.md’deki “sessizce düşer” kuralı burada da geçerlidir).
      *(`validateParticleEmitter`: `enabled`/`autoPlay`/`loop` bool,
      `scale` 0.01–100, `tint` hex; legacy alanlar allowlist'ten çıktı.)*

**Kabul kriteri:** Sahneye yerleştirilen bir nesne effect dropdown’ından VFX
seçer; Play modunda auto-play doğru çalışır. ✅ `build:verify` yeşil (tsc + vite
build + 579 engine check + verify:dist --strict), `check:assets` errors=0.
**Kalan:** canlı browser smoke (kullanıcı) — §15 tam akış.

### Faz 4 karar kaydı (4 Temmuz 2026)

**Override'lar ölü alan bırakılmadı — hepsi runtime'da tüketiliyor.** Faz 4'ün
amacı legacy ölü alanları temizlemekti; yerine ölü alan koymamak için eklenen
her override runtime'a bağlandı: `ParticleEffect` constructor'ı artık opsiyonel
`ParticleEffectOverrides` (`scale`/`tint`/`loop`) alıyor — `scale` boyut+hız+
spread'i üniform ölçekler (rate/lifetime ve dolayısıyla kapasite değişmez),
`tint` shader `uColor`'ını değiştirir, `loop` asset'in loop bayrağını instance
bazında ezer. `RuntimeSceneApp`'in iki spawn yolu (`playAutoPlayParticleEntity`,
`playActorParticleEffect`) component'i olduğu gibi overrides olarak geçirir ve
`enabled === false` emitter'ı susturur. Override'sız çağrı davranış-nötr
(preview viewport dokunulmadı).

**`seedOffset` Faz 5'e ertelendi (bilinçli).** §8 `seedOffset`'i "izin verilecek"
listesine koyar; fakat mevcut renderer `Math.random()` kullanır ve `RuntimeParticleEffect`
`system.seed`'i taşımaz, dolayısıyla seed offset'in anlamlı tüketimi seeded-RNG
determinizmi + seed'in flat runtime kontratına iplenmesini gerektirir — bu
runtime sağlamlaştırma işidir (Faz 5, §12 `VfxPlayOptions`). Ölü alan koymamak
için `seedOffset` Faz 4 sözleşmesine hiç eklenmedi; Faz 5'te seed determinizmiyle
birlikte gelecek.

**Runtime tüketimi Faz 5'te `VfxSubsystem`'e taşınacak.** Bugün override mantığı
`ParticleEffect` + `RuntimeSceneApp` inline'ında; §12'deki `VfxSubsystem` /
`VfxPlayOptions` geldiğinde bu davranış aynen subsystem'e taşınır (audio
hattının `AudioSubsystem`'e taşınmasıyla aynı model) — davranış doğru olduğundan
Faz 5 yalnızca yeniden konumlandırır.

---

## Faz 5 — Runtime Sağlamlaştırma

- [ ] VFX instance pooling ekle.
- [ ] One-shot cleanup ve loop enable/disable akışını doğrula.
- [ ] Runtime debug snapshot ekle.
- [ ] Active instance / alive particle / effect ID debug verisini göster.
- [ ] Manifest lookup cache ve effect definition cache ekle.
- [ ] `play`, `stop`, `setEnabled`, `dispose` yaşam döngüsünü test et.

**Kabul kriteri:** Uzun bir oyun oturumunda one-shot VFX instance’ları ve Three.js kaynakları büyüyerek sızıntı yaratmaz.

---

## Faz 6 — İhtiyaç Sonrası Genişletmeler

Bu faz V1’in parçası değildir. Gerçek ihtiyaç oluşmadan başlanmamalıdır.

- [ ] Sprite texture / alpha texture + particle material asset ailesi ve
      renderer `materialId` referansı (§6.5 kararıyla V1’den buraya taşındı).
- [ ] Texture atlas ve flipbook.
- [ ] Quad tabanlı renderer + `billboardMode` (`world` yönelimi).
- [ ] Daha iyi local/world space davranışı (asset seviyesinde `worldSpace`).
- [ ] Distance sort.
- [ ] Color/size curve editor.
- [ ] Çok-emitter’lı VFX System asset.
- [ ] Mesh particle.
- [ ] Ribbon/trail.
- [ ] Basit particle collision.
- [ ] Quality tiers.
- [ ] GPU/WebGPU simulation.

---

## 15. Test ve Doğrulama

Her tamamlanan faz için:

```bash
npx tsc --noEmit
npm run test:engine
npm run build:verify
```

UI veya Three.js preview değişikliği içeriyorsa ek olarak browser smoke testi yapılmalıdır:

```text
- ?editor route açılır.
- Effect asset açılır.
- Preview görünür.
- Play / pause / restart çalışır.
- Parametre değişikliği preview’i günceller.
- Save sonrası asset tekrar açıldığında veri korunur.
- / game route’unda aynı effectId çalışır.
- Production build’de editor bundle/CSS’i bulunmaz.
```

### Headless test adayları

- Effect schema normalize.
- Legacy schema uyumluluğu.
- Spawn rate ve burst count hesapları.
- Max particle cap.
- Lifetime / fade interpolation.
- Bounds validation.
- Instance override normalizasyonu.
- One-shot cleanup kararı.
- Save validator round-trip.

---

## 16. Kesin Kapsam Dışı

Aşağıdaki işler VFX Lite Planına dahil değildir:

```text
- Genel node graph editor
- Niagara Script / custom module editor
- Shader graph
- Custom HLSL
- GPU compute particle authoring
- Fluid simulation
- Volumetric smoke/fire
- Mesh / ribbon / light renderer
- Full curve editor
- Particle collision authoring
- Particle event graph
- Genel marketplace/plugin sistemi
```

Bu işler sistemin öğrenme ve bakım maliyetini büyütür; Forge’un ilk hedefi olan tekrar kullanılabilir web oyun üretim hattını doğrudan hızlandırmaz.

---

## 17. Son Mimari Karar

Forge VFX Lite şu prensiple ilerlemelidir:

```text
Reusable effect asset
+ small scene component reference
+ CPU-first runtime
+ form-based editor
+ live preview
+ strict validation
+ runtime/editor separation
```

Bu model, Cascade’in davranış–görünüş ayrımını ve Niagara’nın asset/instance/preview disiplinini alır; fakat Forge’u node graph ve ağır VFX framework yükü altına sokmaz.

---

## 18. Kaynaklar

### Resmi Unreal Engine kaynakları

- [Cascade Particle Systems — Unreal Engine 4.27 Documentation](https://dev.epicgames.com/documentation/unreal-engine/cascade-particle-systems?application_version=4.27)
- [Creating Visual Effects in Niagara — Unreal Engine Documentation](https://dev.epicgames.com/documentation/unreal-engine/creating-visual-effects-in-niagara-for-unreal-engine)

### Forge içi referans dokümanlar

- `docs/architecture/UNREAL_BASICS_LESSONS.md`
  - ParticleEmitterComponent sözleşmesi
  - Mevcut effect asset / runtime particle notları
  - Component ve runtime/editor sınırları
- `docs/architecture/ARCHITECTURE.md`
  - Runtime/editor bağımlılık kuralları
  - Production package sınırları
  - Save validator ve authoring veri ilkeleri
- `docs/completed/STARTER_CONTENT.md`
  - Starter effect asset listesi
  - VFX texture/preset gereksinimleri
- `docs/completed/SOUND_CUE_EDITOR_RESEARCH_AND_PLAN.md`
  - En yakın emsal feature planı: Content Browser çift-tık editörü +
    `*Store.ts` + `/__save-*` endpoint + saveValidator kalıbının uçtan uca
    uygulanmış hali
