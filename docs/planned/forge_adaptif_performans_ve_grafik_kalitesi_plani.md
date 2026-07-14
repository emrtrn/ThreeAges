# Forge — Adaptif Performans ve Grafik Kalitesi Sistemi

**Durum:** Teknik taslak / uygulama planı (2026-07-14: Forge'un mevcut altyapısıyla hizalandı)  
**Hedef platform:** Tarayıcı tabanlı Three.js oyunları  
**Kapsam:** WebGL tabanlı Forge oyunlarında otomatik kalite ayarı, darboğaz tahmini, manuel kalite profilleri ve oyuncu ayarları menüsü.

> **Revizyon notu (2026-07-14):** Plan, Forge'da halihazırda var olan performans
> altyapısının (SubsystemProfiler, perf budget, `?debug` overlay, post-process
> pipeline, UserSettingsStore, UI framework) üzerine inşa edilecek şekilde
> güncellendi. Kalite ayarları **çekirdek** (bugünkü motorla doğrudan
> uygulanabilir) ve **genişletme** (önce mekanizması kurulmalı / fork'a ait)
> olarak ikiye ayrıldı. Bkz. §1.1 ve §11.

---

## 1. Amaç

Forge içinde çalışan oyunların farklı bilgisayarlarda mümkün olduğunca akıcı çalışmasını sağlamak.

Sistem iki farklı kullanım biçimini desteklemelidir:

1. **Adaptif optimizasyon açık**
   - Oyun, gerçek oyun içi performansı izler.
   - FPS yerine esas olarak **frame time** ölçer.
   - Uzun süreli performans düşüşlerinde, darboğaz türünü tahmin eder.
   - Sadece ilgili kalite ayarlarını azaltır.
   - Performans uzun süre stabil kalırsa kaliteyi kontrollü biçimde artırabilir.

2. **Manuel kalite seçimi**
   - Oyuncu `Ultra`, `High`, `Medium` veya `Low` profilini seçebilir.
   - Manuel seçim yapıldığında adaptif sistem oyuncunun seçtiği profilin dışına çıkmaz.
   - İsteğe bağlı olarak oyuncu, “Manuel + Adaptif İnce Ayar” modunu açabilir. Bu modda seçtiği kalite profili başlangıç kabul edilir, sistem yalnızca küçük ayarlamalar yapar.

Ana tasarım ilkesi:

> Donanım verisi ilk tahmin için kullanılabilir; nihai kalite kararları gerçek oyun içi ölçümlere dayanmalıdır.

İkinci tasarım ilkesi (Forge'a özgü):

> Kalite katmanı **yalnızca runtime'da düşürür/kısar**; yazarın sahne datasına
> (layout, post-process aktörü, ışık aktörleri) asla yazmaz ve authored olarak
> kapalı bir efekti asla açmaz. Kalite = authored değerlerin üzerine binen
> geçici bir çarpan/kapama katmanı.

### 1.1 Forge'daki mevcut durum (bu plan neyin üzerine kuruluyor?)

Bu plan sıfırdan bir sistem değil; aşağıdaki mevcut modüllerin genişletilmesidir.
Uygulamaya başlarken önce bunlar okunmalı:

| Mevcut parça | Dosya | Plan ile ilişkisi |
|---|---|---|
| Subsystem tick profiler (rolling window, avg/last/peak, yalnız `?debug`) | `engine/core/subsystemProfiler.ts` | §7.3'ün CPU tarafı **hazır**; darboğaz sınıflandırmada pasif CPU sinyali (§8.1) |
| Perf budget (draw call / tri / texture eşikleri + OVER işareti) | `engine/perf/perfBudget.ts` | Faz 0'ın bütçe iskeleti **hazır**; profil bütçeleriyle genişletilir |
| `?debug` overlay (fps, draw call, tri, subsystem perf, memory/heap, budget, vfx, AI, UI) | `src/scene/debugStats.ts` | §13 overlay'in çoğu **hazır**; frame-time/P95/kalite satırları eklenecek |
| Renderer istatistikleri | `engine/render-three/renderer.ts` (`readRenderStats`, `readRenderMemory`) | §7.2 **hazır** |
| Post-process pipeline: **GTAO** (SSAO değil), Bloom, DoF, SMAA, vignette, CA, grain, grading | `engine/render-three/postProcess.ts` + `engine/scene/postProcess.ts` | Kalite katmanının GPU düğmeleri; ayarlar `LayoutPostProcess` **authored data** — üzerine override katmanı gerekir |
| Gölge: `PCFSoftShadowMap`, mapSize **2048 kod sabiti** | `engine/render-three/lights.ts` | mapSize authored değil → doğrudan kalite katmanına bağlanabilir |
| Pixel ratio üst limiti (`MAX_PIXEL_RATIO = 2` sabiti) | `src/scene/SceneRuntimeCore.ts` | Profil alanına dönüşecek |
| Kalıcı kullanıcı ayarları (schema'lı envelope, normalize) | `engine/persistence/userSettingsStore.ts` | Grafik tercihleri **buraya** eklenir (ham `localStorage` değil) |
| UI framework (screen stack, ViewModel, `.ui.json`, UMG-benzeri) | `src/ui/RuntimeUiSubsystem.ts`, `engine/ui/*` | Grafik ayarları ekranı bu sistemle yapılır |
| VFX runtime (effect başına `maxParticles`, pooling, debug snapshot) | `engine/vfx/*`, `engine/render-three/vfxSubsystem.ts` | Global `particleDensity` çarpanı eklenecek (küçük iş) |
| Subsystem mimarisi (`init/start/update/dispose`, `EngineUpdateContext`) | `engine/core/EngineApp.ts` | `FrameMetricsMonitor` ve `AdaptiveQualityController` birer subsystem olur |
| Frame loop (`requestAnimationFrame`, `deltaMs` 100 ms clamp) | `src/scene/RuntimeSceneApp.ts` | Frame-time örnekleme buraya bağlanır (spike ölçümü **clamp'ten önceki ham delta** ile) |

Mevcut olmayanlar (bu planın asıl işi): frame-time istatistikleri (P95/spike),
kalite profilleri ve merkezi uygulayıcı, oyuncu grafik ayarları ekranı, adaptif
kontrolcü, darboğaz sınıflandırma, donanım ipuçları.

---

## 2. Neden sadece donanım bilgisine güvenilmemeli?

Tarayıcı, cihaz hakkında sınırlı bilgi sağlayabilir:

- Mantıksal işlemci çekirdeği sayısı
- Yaklaşık cihaz belleği
- Dokunmatik / mobil cihaz bilgisi
- Bazı durumlarda WebGL renderer bilgisi

Ancak bu bilgiler kesin değildir. Tarayıcılar gizlilik nedeniyle bilgiyi azaltabilir, yuvarlayabilir veya hiç vermeyebilir. Aynı GPU bile farklı sürücü, güç modu, sıcaklık ve ekran çözünürlüğünde farklı sonuç verir.

Bu nedenle şu yaklaşım kullanılmalıdır:

```text
Donanım sinyali → başlangıç profili için ipucu
Gerçek frame time → kalite kararının ana kaynağı
Render testleri → GPU / CPU darboğaz tahmini
Oyun alt sistem ölçümleri → asıl sorunun bulunması
```

---

## 3. Performans hedefleri

Forge genelinde varsayılan hedef:

| Hedef türü | Frame time | Yaklaşık FPS |
|---|---:|---:|
| Akıcı hedef | 16.7 ms | 60 FPS |
| Kabul edilebilir | 20.0 ms | 50 FPS |
| Orta kalite alt sınırı | 25.0 ms | 40 FPS |
| Düşük kalite alt sınırı | 33.3 ms | 30 FPS |

Önerilen varsayılan strateji:

- Masaüstü cihazlarda hedef: **60 FPS**
- Zayıf cihazlarda minimum kabul edilebilir hedef: **30 FPS**
- Sistem FPS değerini tek başına karar aracı olarak kullanmamalıdır.
- Karar için ortalama frame time, yüzde 95 frame time ve spike sayısı birlikte takip edilmelidir.

Örnek:

```text
Ortalama: 17 ms
P95: 31 ms
Sonuç: Ortalama iyi, ancak kısa süreli takılmalar var.
```

Bu durumda kaliteyi düşürmek yerine shader derleme, asset yükleme, garbage collection veya ani spawn kaynaklı spike araştırılmalıdır.

### 3.1 Tarayıcıda ölçüm gotcha'ları (uygulamada zorunlu)

- **VSync kademelenmesi:** `requestAnimationFrame` monitör yenileme hızına
  kilitlidir. 120/144 Hz ekranlarda frame time 8.3/16.7/25 ms basamaklarında
  kademelenir; yük artınca ortalama "yumuşakça" değil basamak atlayarak bozulur.
  Ölçüm başlarken birkaç saniyelik minimum frame time'dan yenileme hızı tahmin
  edilmeli ve hedef frame time buna göre yorumlanmalıdır (120 Hz cihazda 16.7 ms
  hedefi "her iki vsync'te bir kare" demektir, bu kabul edilebilir).
- **Sekme görünürlüğü:** `visibilitychange` ile sekme arka plana geçtiğinde rAF
  durur; geri gelince dev bir delta oluşur. Tüm örnek pencereleri görünürlük
  değişiminde **sıfırlanmalıdır**, yoksa tek sekme geçişi "spike" sayılır.
- **Delta clamp'i:** `RuntimeSceneApp` frame loop'u `deltaMs`'i 100 ms'e
  clamp'ler (simülasyon stabilitesi için doğru). Frame-time istatistiği ise
  **clamp'ten önceki ham delta** ile beslenmelidir; yoksa 100 ms üstü büyük
  takılmalar histogramda görünmez.
- **`renderer.info` + EffectComposer:** composer birden çok iç `render()`
  çağrısı yapar ve `info.autoReset` varsayılanı her çağrıda sayaçları sıfırlar —
  okunan değer yalnız son pass'ı gösterebilir. Post-process aktifken doğru
  frame toplamı için `info.autoReset = false` + frame başında manuel `reset()`
  stratejisi gerekir (Faz 1 maddesi).
- **`performance.memory`:** Chrome dışında yok; heap satırı zaten opsiyonel
  (bkz. `formatByteSize` kullanımı `debugStats.ts`). Karar mantığı heap'e
  **dayanmamalıdır**, yalnız teşhis sinyali olarak kullanılabilir.
- **GPU timer query (`EXT_disjoint_timer_query_webgl2`):** her cihazda yok;
  varsa darboğaz sınıflandırmaya ek kanıt olarak eklenebilir, ama sistem onsuz
  da çalışmak zorundadır.

---

## 4. Sistem mimarisi

```text
FrameMetricsMonitor  (yeni: engine/perf/frameMetrics.ts — pure çekirdek)
├─ Ham rAF delta'sından frame time toplar (her zaman açık, ucuz)
├─ 1sn / 5sn / 30sn pencerelerde ortalama, P95, spike sayısı
├─ Yenileme hızı tahmini + visibilitychange'de pencere sıfırlama
└─ Not: SubsystemProfiler'dan farkı — o yalnız ?debug'da ve CPU tick
   ölçer; frame-time izleme production'da da açık kalır

SubsystemProfiler  (MEVCUT: engine/core/subsystemProfiler.ts)
└─ CPU alt sistem süreleri (avg/last/peak) — pasif CPU darboğaz sinyali

HardwareHintCollector  (yeni: engine/perf/hardwareHints.ts — pure çekirdek)
├─ CPU çekirdek / yaklaşık RAM / çözünürlük / DPR / mobil tahmini
└─ Uygunsa WebGL renderer ipucu — yalnız BAŞLANGIÇ profili için

BottleneckClassifier  (yeni: engine/perf/bottleneckClassifier.ts — pure)
├─ Önce pasif sinyaller: frame time yüksek + subsystem toplamı düşük → GPU;
│  subsystem toplamı yüksek → CPU (hangi subsystem olduğu zaten belli)
├─ Draw call / bütçe aşımı sinyali (perfBudget MEVCUT)
├─ Spike deseni: asset yükleme / shader derleme ayrımı
├─ Belirsizse (fallback) kısa render-scale karşılaştırma testi
└─ Sonucu güven seviyesi + kanıt listesiyle üretir

QualityProfileManager  (yeni: engine/perf/qualityProfiles.ts — pure çözümleme
│                        + src/scene tarafında uygulayıcı adapter)
├─ Ultra / High / Medium / Low / Custom çözümlemesi
├─ Authored data'ya DOKUNMAZ: post-process/gölge/partikül değerlerinin
│  üzerine runtime çarpan/kapama uygular (İlke #2)
└─ Ayar geçişlerini güvenli uygular (bkz. Faz 2: pass rebuild, shadow map
   dispose, composer resize)

AdaptiveQualityController  (yeni: engine/perf/adaptiveQuality.ts — pure karar
│                            çekirdeği; Subsystem olarak kaydedilir)
├─ Performans pencerelerini izler, karar gecikmesi + hysteresis uygular
├─ Tek adımda tek küçük ayar değiştirir
└─ Oyuncu tercihini (manuel profil) asla aşmaz

Grafik Ayarları Ekranı  (MEVCUT UI framework ile: .ui.json + ViewModel,
│                         src/ui/RuntimeUiSubsystem.ts üzerinden)
├─ Adaptif toggle, profil seçimi, hedef FPS
├─ Gelişmiş ayarlar (ilk sürümde kapalı bölüm)
└─ Kalıcılık: UserSettingsStore (MEVCUT, schema bump ile `graphics` alanı)

Debug Overlay  (MEVCUT: src/scene/debugStats.ts — genişletilecek)
├─ MEVCUT: fps, draw call, tri, subsystem perf, memory, budget, vfx, AI, UI
└─ EKLENECEK: frame avg/P95/spike, aktif profil, adaptif durum,
   son kalite kararı + nedeni (confidence)
```

Yerleşim kuralları: pure çekirdekler `engine/perf/` altına gider ve
`tools/engine-tests.ts`'e deterministik testlerle eklenir (SubsystemProfiler
deseni: side-effect free, enjekte edilebilir saat). DOM / three / renderer'a
dokunan uygulayıcı katman `src/scene` tarafında kalır. `verify:imports`
boundary'leri geçerli: engine, `src/`'den import edemez.

---

## 5. Oyuncu ayarları deneyimi

### 5.1 Ana grafik menüsü

Önerilen düzen:

```text
GRAFİK

Grafik Kalitesi
[ Ultra | High | Medium | Low | Custom ]

Adaptif Optimizasyon
[ Açık / Kapalı ]

Hedef Kare Hızı
[ 60 FPS ] [ 30 FPS ]

Gelişmiş Ayarlar (ilk sürümde kapalı / açılır bölüm)
- Render Scale
- Gölgeler
- Ambient Occlusion (GTAO)
- Bloom
- Anti-Aliasing (SMAA)
- Partikül Yoğunluğu
- (genişletme) Görüş Mesafesi, NPC Yoğunluğu — mekanizması kurulduğunda, bkz. §11
```

Ekran, mevcut UI framework'üyle (`.ui.json` + ViewModel + screen stack) yapılır;
ayrı bir DOM/React ayar paneli **kurulmaz**. Kalıcılık `UserSettingsStore`
üzerinden (schema bump + `graphics` alanı + normalize); ham `localStorage`
erişimi yazılmaz.

### 5.2 Toggle davranışı

| Oyuncu tercihi | Sistem davranışı |
|---|---|
| Adaptif açık + profil otomatik | Sistem Medium ile başlar, ölçüm sonucuna göre profil/alt ayar belirler |
| Adaptif açık + Ultra/High/Medium/Low seçili | Seçilen profil taban kabul edilir; sistem yalnızca izin verilen aralıkta ince ayar yapar |
| Adaptif kapalı + profil seçili | Profil sabit kalır |
| Adaptif kapalı + gelişmiş ayar değiştirildi | Profil `Custom` olur ve ayarlar sabit kalır |

### 5.3 Oyuncuya gösterilecek durum mesajları

Sistem karar verdiğinde agresif pop-up göstermemelidir. Ayarlar ekranında veya küçük bir toast ile sade bilgi verilebilir:

```text
Performans için gölge kalitesi düşürüldü.
```

```text
Sistem performansı stabil buldu. Render kalitesi artırıldı.
```

```text
Manuel grafik profili aktif. Otomatik ayarlama kapalı.
```

Oyuncu her zaman son otomatik değişikliği geri alabilmelidir.

---

## 6. Kalite profilleri

Aşağıdaki tablo Forge için başlangıç profilidir. **Çekirdek** satırların bugünkü
motorda doğrudan karşılığı vardır; **genişletme** satırları önce mekanizmasının
kurulmasını gerektirir (§11'deki ayrımla birebir aynı).

**Çekirdek ayarlar:**

| Ayar | Ultra | High | Medium | Low |
|---|---:|---:|---:|---:|
| Render scale | 1.00 | 1.00 | 0.85 | 0.70 |
| Device pixel ratio üst limiti | 2.00 | 1.75 | 1.50 | 1.00 |
| AO (GTAO pass) | Açık* | Açık* | Kapalı | Kapalı |
| Bloom | Açık* | Açık* | Açık* (yarım çözünürlük) | Kapalı |
| DoF (Bokeh pass) | Açık* | Açık* | Kapalı | Kapalı |
| Shadow map çözünürlüğü (bugün 2048 sabit) | 2048 | 1024 | 512 | 256 / Kapalı |
| Shadow distance çarpanı | 1.0 | 0.75 | 0.5 | 0.35 |
| Anti-aliasing | SMAA* | SMAA* | SMAA* | Kapalı |
| Partikül yoğunluğu (VFX global çarpanı) | %100 | %80 | %55 | %30 |
| Foliage cull distance çarpanı | 1.0 | 0.85 | 0.65 | 0.45 |

\* "Açık" = **authored değere izin ver** demektir: `LayoutPostProcess` aktörü o
efekti kapalı yazmışsa kalite katmanı **açmaz** (İlke #2). Kalite yalnız
kapatır/kısar. SMAA da aynı kurala tabidir; ayrıca MSAA (`antialias: true`)
WebGL context yaratılırken sabitlenir ve runtime'da değiştirilemez — AA
kademesi pratikte "composer'da SMAA var/yok"tur, "yüksek/orta/düşük" değil.

**Genişletme ayarları** (önce mekanizma: distance-based update, LOD, texture
streaming — çoğu Faz 7 veya fork işi):

| Ayar | Ultra | High | Medium | Low |
|---|---:|---:|---:|---:|
| Görüş mesafesi | %100 | %85 | %65 | %45 |
| Uzak LOD geçişi | Geç | Orta | Erken | Çok erken |
| NPC bütçesi | %100 | %80 | %60 | %35 |
| AI update hızı | 60 Hz | 30 Hz | 15–20 Hz | 10 Hz |
| Uzak animasyon update hızı | 60 Hz | 30 Hz | 15 Hz | 8–10 Hz |
| Texture maksimum boyutu | 2048 | 2048 | 1024 | 512–1024 |

Not: "Shadow update sıklığı" (2 frame'de bir gölge güncelleme) ilk taslakta
vardı; three.js'te `shadow.autoUpdate/needsUpdate` ile mümkün ama hareketli
ışık/objelerde görsel artefakt riski taşır — kazancı küçük, riski görünür
olduğu için profillerden çıkarıldı, ileride ihtiyaç kanıtlanırsa eklenir.

### 6.1 Kritik not — profil değerleri kimin?

Bu değerler "nihai doğru ayarlar" değildir ve **oyun türü şablon kataloğu
Forge'da tutulmaz** (Forge genel platformdur; tür bilgisi fork'un işidir).
Model şudur:

- Engine, `QUALITY_PROFILES` **template default**'unu taşır (perfBudget'taki
  `DEFAULT_PERF_BUDGET` deseniyle aynı: kod içinde default, fork override eder).
- Her oyun fork'u kendi profil değerlerini ve bütçelerini `src/game` /
  proje datası tarafında override eder (yoğun NPC'li simülasyon ile mini
  servis oyununun bütçeleri farklıdır).
- Kalite **isimleri** (Ultra/High/Medium/Low) ve ayar **anahtarları** tüm
  fork'larda ortak kalır; yalnız değerler değişir.

---

## 7. Ölçülmesi gereken metrikler

### 7.1 Temel frame metrikleri (yeni: `engine/perf/frameMetrics.ts`)

```ts
interface FrameMetrics {
  frameTimeMs: number;
  averageFrameTimeMs: number;
  p95FrameTimeMs: number;
  spikeCount: number;
  sampleWindowSeconds: number;
  /** Tahmini monitör yenileme aralığı (ms) — hedef yorumlama için, bkz. §3.1 */
  estimatedRefreshIntervalMs: number;
}
```

Takip edilmesi gerekenler:

- Son frame süresi (**clamp'ten önceki ham rAF delta'sı**, bkz. §3.1)
- Son 1 saniye ortalama frame time
- Son 5 saniye ortalama frame time
- Son 5 saniye P95 frame time
- 33.3 ms üzerindeki frame sayısı
- 50 ms üzerindeki frame sayısı
- 100 ms üzerindeki büyük takılma sayısı

Uygulama notu: pure, saat enjekte edilebilir bir aggregator olarak yazılır
(SubsystemProfiler'ın `RollingWindow` deseni; P95 için pencere başına sıralama
yerine sabit boyutlu örnek tamponu yeterli) ve `tools/engine-tests.ts`'te
deterministik test edilir. Bu monitor **production'da da açık** kalır (adaptif
sistem ona muhtaç) — maliyeti frame başına birkaç sayı itmek kadar olmalıdır.

### 7.2 Three.js render metrikleri (MEVCUT)

`engine/render-three/renderer.ts` bunu zaten sağlıyor: `readRenderStats`
(draw call + triangle) ve `readRenderMemory` (geometry / texture / program).
Yeni bir toplayıcı yazılmaz; gerekiyorsa points/lines alanları aynı
fonksiyonlara eklenir.

Dikkat: post-process composer aktifken `renderer.info` yalnız son pass'ı
raporlayabilir — `info.autoReset` stratejisi gerekir (bkz. §3.1, Faz 1 maddesi).

### 7.3 Oyun alt sistem metrikleri (MEVCUT)

Bu iş `SubsystemProfiler` ile zaten yapılıyor: her subsystem'ın `update()`
maliyeti id bazında rolling window'da tutulur (avg / last / peak) ve `?debug`
overlay'i en pahalı üçünü gösterir. İlk taslaktaki sabit alanlı `SystemTiming`
arayüzü yerine bu id-bazlı model **korunur** — yeni subsystem eklendikçe
kendiliğinden ölçülür.

Adaptif sistem için gereken tek ek: profiler bugün yalnız `?debug`'da
etkinleşiyor (`EngineApp.enableProfiling`). Darboğaz sınıflandırma pasif CPU
sinyaline muhtaç olduğundan, adaptif mod açıkken de etkinleştirilmelidir
(pencere boyutu küçük tutularak; profiler zaten ucuz — kayıt başına birkaç
aritmetik işlem).

Kapsam dışı kalan ölçümler (raycast, spawn, render-prep) bugün ayrı subsystem
değil; ihtiyaç kanıtlanırsa ilgili kod subsystem'laştırılır — bu plan için
blocker değildir.

### 7.4 Dünya metrikleri (kısmen MEVCUT)

```ts
interface WorldMetrics {
  visibleObjectCount: number;
  activeEntityCount: number;
  activeNpcCount: number;      // MEVCUT: AiDebugSnapshot.controllerCount
  activePhysicsBodyCount: number;
  particleCount: number;       // MEVCUT: VfxDebugSnapshot.aliveParticles
  activeLights: number;
  shadowCastingLights: number;
}
```

Partikül ve AI sayıları debug snapshot'lardan zaten okunuyor; eksik olanlar
(ışık sayıları, fizik gövde sayısı) aynı snapshot desenine eklenir.

---

## 8. Darboğaz sınıflandırma stratejisi

Tarayıcıda GPU ve CPU sürelerini her cihazda kesin biçimde ayırmak mümkün değildir. Bu nedenle sistem, mutlak teşhis yerine **olasılık temelli sınıflandırma** yapmalıdır.

```ts
type BottleneckType =
  | "gpu"
  | "cpu"
  | "draw-call"
  | "asset-loading"
  | "memory-pressure"
  | "transient-spike"
  | "unknown";

interface BottleneckResult {
  type: BottleneckType;
  confidence: number; // 0–1
  evidence: string[];
}
```

### 8.1 Önce pasif sinyaller (Forge'da bedava)

Forge'da `SubsystemProfiler` CPU tick maliyetini zaten alt sistem bazında
ölçüyor. Bu, ilk taslaktaki "render scale'i canlı oyunda geçici düşürüp ölç"
aktif testinin çoğu durumda **gereksiz** olduğu anlamına gelir — aktif test
oyuncunun gözü önünde görüntüyü bulanıklaştırır ve §17.1 riskiyle çelişir.

Pasif sınıflandırma:

```text
frame time yüksek  +  subsystem CPU toplamı düşük (frame'in küçük parçası)
  → iş GPU/compositor tarafında → GPU şüphesi yüksek

frame time yüksek  +  subsystem CPU toplamı yüksek
  → CPU şüphesi yüksek; hangi subsystem olduğu profiler sıralamasında ZATEN görünür
    (ai / physics / vfx / ui ... — ayrıca teşhis gerekmez)

draw call bütçe üstü (perfBudget MEVCUT) + render scale duyarsızlığı
  → sahne karmaşıklığı / draw call şüphesi
```

CPU toplamı frame'i açıklamıyorsa aradaki fark GPU'ya, tarayıcı compositing'e
veya rAF-dışı işlere (GC, worker) aittir; confidence buna göre düşük tutulur.

### 8.2 Aktif GPU testi (yalnız fallback)

Pasif sinyaller çelişkili veya güven düşükse, kısa süreli render scale
karşılaştırması yapılabilir:

```text
1.00 render scale → 28 ms
0.75 render scale → 18 ms   (%15+ iyileşme → GPU darboğazı olasılığı yüksek)
```

Kurallar: test birkaç saniyeyi geçmez, oturum başına nadiren çalışır, sonucu
cache'lenir; mümkünse sahne geçişi/yükleme anına denk getirilir. Varsa
`EXT_disjoint_timer_query_webgl2` ek kanıt olarak kullanılabilir ama zorunlu
değildir (§3.1).

GPU tarafında sık görülen nedenler (Forge bağlamında):

- GTAO pass (tam ekran normal+depth G-buffer render'ı — en pahalı pass)
- DoF (Bokeh), Bloom, SMAA
- Büyük shadow map / çok sayıda shadow-casting light
- Yüksek device pixel ratio (retina'da 4× piksel)
- Transparan partiküller (overdraw)
- Reflection plane'ler (sahneyi ikinci kez render eder)

CPU tarafında sık görülen nedenler:

- NPC AI / pathfinding (profiler'da `ai` olarak görünür)
- Fizik (profiler'da görünür)
- Animation mixer güncellemeleri
- Sık object allocation → GC spike'ları
- Çok yüksek draw call için render hazırlığı (three'nin sahne traversal'ı —
  profiler subsystem'larında DEĞİL, frame'in "açıklanamayan" kısmında görünür)

### 8.3 Draw call yoğunluğu

Draw call sorunu çoğu zaman CPU + GPU karışık maliyet üretir.

Şüphe sinyalleri:

```text
Draw call sayısı profil bütçesinin üzerinde
ve görünür obje sayısı yüksek
ve render scale değişimi sınırlı fayda sağlıyor
```

Çözüm yönü (bunlar içerik optimizasyonlarıdır → Faz 7 / §10.3; adaptif
sistem yalnız işaretler):

- `InstancedMesh` / mesh merge / batching (foliage zaten instanced)
- Aynı materyali paylaşma
- Uzak objeleri cull etme, LOD
- Statik sahnede chunk bazlı birleştirme

### 8.4 Asset yükleme / bellek / shader spike

Belirtiler:

- Yeni bölgeye girince kısa donma
- İlk kez görülen efektte takılma
- İlk kez kullanılan materyalde spike
- Uzun oynanışta performans düşüşü
- Texture geç yüklenmesi
- Sayısal ortalama iyi, ama P95 kötü

Bu durumda otomatik kalite düşürmek ilk çözüm olmamalıdır (karar ağacı bu
yüzden spike desenini EN BAŞTA eler, §9.3). Önce şu konular incelenmelidir
(çoğu Faz 7 maddesi):

- Shader warm-up / preload (`renderer.compileAsync` — boot/loading akışına)
- Asset preload / texture streaming / decode
- Spawn işlemlerinin karelere yayılması, object pool
- Garbage allocation azaltma
- Asset yaşam döngüsü ve unload

---

## 9. Adaptif karar mantığı

### 9.1 Karar pencereleri

Sistem anlık FPS düşüşünde ayar değiştirmemelidir.

Önerilen başlangıç değerleri:

```text
Değerlendirme aralığı: 5 saniye
Kalite düşürme eşiği: hedef frame time'ın %25 üstü
Kalite artırma süresi: en az 30–60 saniye stabil performans
Ayar değişimi sonrası bekleme: 10–20 saniye
Bir kararda değiştirilecek ayar: yalnızca 1 küçük adım
```

Örnek 60 FPS hedefi:

```text
Hedef: 16.7 ms
Düşürme eşiği: yaklaşık 21 ms
```

Örnek 30 FPS hedefi:

```text
Hedef: 33.3 ms
Düşürme eşiği: yaklaşık 41 ms
```

### 9.2 Hysteresis

Kalite sistemi sürekli aşağı-yukarı oynamamalıdır.

```text
Kalite düşürme = daha hızlı tepki
Kalite artırma = daha yavaş ve daha temkinli tepki
```

Örnek:

```text
5 saniye boyunca kötü performans → kaliteyi bir adım azalt
45 saniye boyunca stabil performans → kaliteyi bir adım artırmayı değerlendir
```

### 9.3 Önerilen karar ağacı

```text
Frame time hedefin üzerinde mi? (pencereler görünürlük değişiminde sıfırlanır, §3.1)
        │
        ▼
Bu durum en az 5 saniye sürdü mü?
        │
   Hayır ──► Ayar değiştirme
        │
       Evet
        │
        ▼
Spike deseni mi? (ortalama iyi, P95 kötü; asset yükleme / ilk efekt anlarıyla örtüşüyor)
        │
   Evet ──► Kaliteyi değiştirme; yükleme / shader warm-up sürecini işaretle
        │
   Hayır
        │
        ▼
Subsystem CPU toplamı yüksek mi? (SubsystemProfiler — pasif, MEVCUT)
        │
   Evet ──► CPU ağırlıklı kabul et
        │          └─ CPU kalite basamağını azalt (en pahalı subsystem'ı hedefle)
        │
   Hayır
        │
        ▼
CPU toplamı düşük ve frame yüksek mi? (fark GPU tarafında)
        │
   Evet ──► GPU ağırlıklı kabul et
        │          └─ GPU kalite basamağını azalt
        │
   Belirsiz
        │
        ▼
Draw call bütçe üstü mü? (perfBudget — MEVCUT)
        │
   Evet ──► Sahne karmaşıklığı basamağını azalt
        │
   Hayır
        │
        ▼
Fallback: kısa render-scale testi (nadir, §8.2) sonuç verdi mi?
        │
   Evet ──► İlgili basamağı azalt
        │
   Hayır ──► Güven düşük; tek küçük genel kalite adımı uygula
```

---

## 10. Kalite azaltma öncelikleri

Kalite azaltma, tek bir “profil düşür” işlemi olmamalıdır. Sistem önce en yüksek etki / en düşük görsel kayıp sağlayan ayarları değiştirmelidir.

### 10.1 GPU ağırlıklı azaltma sırası

MVP'de mevcut düğmelerle (üstteki maddeler görsel olarak en az fark edilir):

```text
1. GTAO'yu kapat (en pahalı pass; authored açıksa)
2. DoF'u kapat
3. Bloom'u yarım çözünürlüğe düşür, sonra kapat
4. Shadow map çözünürlüğünü düşür (2048 → 1024 → 512)
5. Shadow distance çarpanını azalt
6. SMAA'yı kapat
7. Partikül yoğunluğunu düşür
8. Foliage cull distance'ı kıs
9. Render scale düşür (görünür — geç basamak)
10. Son çare: pixel ratio limitini 1.0'a indir
```

(Genişletme mekanizmaları kurulunca araya girer: LOD erken geçişi, görüş
mesafesi, gölge atan ışık sayısı sınırı.)

### 10.2 CPU ağırlıklı azaltma sırası

Önemli: pasif teşhis hangi subsystem'ın pahalı olduğunu söyler (§8.1); sıra
körlemesine değil, **en pahalı subsystem'dan başlayarak** uygulanır. MVP'de
mevcut tek CPU düğmesi partikül yoğunluğudur; diğerleri Faz 7 / genişletme:

```text
MVP:
1. Partikül yoğunluğu / spawn hızı çarpanını düşür (vfx subsystem)
2. Gerekirse profil seviyesini düşür (GPU basamaklarını da beraberinde götürür)

Genişletme (Faz 7 mekanizmaları kurulunca):
3. Uzak NPC AI update oranını azalt (distance-based AI tick)
4. Uzak NPC animasyon güncellemesini azalt
5. Fizik simülasyonunu yakın / aktif objelerle sınırla
6. Aktif NPC / spawn bütçesini azalt (spawn sistemi olan fork'larda)
```

### 10.3 Sahne karmaşıklığı azaltma sırası

Bunlar runtime kalite düğmesi değil, **içerik/yazarlık optimizasyonlarıdır**
(Faz 7); adaptif sistem bunları tetiklemez, veri sağlar:

```text
1. Aynı materyalli statik objeleri merge et / InstancedMesh kullan
   (foliage zaten InstancedMesh; statik prop'lar için değerlendirilir)
2. Uzak prop kümelerini gizle / chunk bazlı aktivasyon
   (foliage Faz 2'deki chunking işiyle ortak altyapı)
3. LOD mesafelerini erkene çek / billboard-impostor (LOD sistemi kurulursa)
4. Texture varyasyonlarını azalt
```

---

## 11. Örnek veri modeli

Model iki katmandır. **Çekirdek** alanların bugünkü motorda uygulayıcısı vardır;
**genişletme** alanları ayrı bir arayüzde tutulur ki profil şeması, karşılığı
olmayan alan taşımasın (fork'lar genişletme arayüzünü kendi mekanizmalarıyla
doldurur).

```ts
export type QualityLevel = "ultra" | "high" | "medium" | "low" | "custom";

/** Çekirdek: her alanın bugünkü Forge'da doğrudan uygulayıcısı var. */
export interface QualitySettings {
  renderScale: number;      // composer + renderer boyut çarpanı
  maxPixelRatio: number;    // bugünkü MAX_PIXEL_RATIO sabitinin yerini alır

  // Post-process gate'leri: authored (LayoutPostProcess) değerin ÜZERİNE
  // kapama/kısma uygular; authored kapalıysa açamaz (İlke #2).
  aoAllowed: boolean;              // GTAO pass
  dofAllowed: boolean;             // Bokeh pass
  bloomAllowed: boolean;
  bloomResolutionScale: 1 | 0.5;   // UnrealBloomPass boyutu
  smaaAllowed: boolean;            // MSAA context'te sabit; runtime AA = SMAA

  shadowsEnabled: boolean;         // renderer.shadowMap.enabled
  shadowMapSize: 256 | 512 | 1024 | 2048; // bugün lights.ts'te 2048 sabit
  shadowDistanceScale: number;     // shadow camera boyut çarpanı

  particleDensity: number;         // vfx global spawn/maxParticles çarpanı
  foliageCullDistanceScale: number;
}

/**
 * Genişletme: önce mekanizması kurulmalı (Faz 7) ya da fork'a ait.
 * Template profilleri bu alanlara değer YAZMAZ; şema fork override'ı için var.
 */
export interface QualityExtensions {
  viewDistanceMultiplier?: number;
  lodBias?: number;
  npcBudgetMultiplier?: number;
  aiUpdateHz?: number;         // AI subsystem bugün her frame tick'ler
  farAnimationUpdateHz?: number;
  maxTextureSize?: 512 | 1024 | 2048; // loader-time resize pipeline gerektirir
}

export interface GraphicsPreferences {
  adaptiveOptimizationEnabled: boolean;
  targetFrameRate: 30 | 60;
  selectedQualityLevel: QualityLevel;
  allowAdaptiveFineTuning: boolean;
  customSettings?: Partial<QualitySettings>;
}
```

Kalıcılık: `GraphicsPreferences`, `UserSettings`'e `graphics` alanı olarak
eklenir (`engine/persistence/userSettingsStore.ts` — schema bump + eski kayıt
için normalize/varsayılan; mevcut audio/locale deseniyle aynı). Adaptif sistemin
o an uyguladığı geçici düşürmeler **kaydedilmez** — yalnız oyuncunun tercihi
kalıcıdır.

### 11.1 Kalite profili örneği (template default — fork override eder)

```ts
export const QUALITY_PROFILES: Record<Exclude<QualityLevel, "custom">, QualitySettings> = {
  ultra: {
    renderScale: 1.0,
    maxPixelRatio: 2.0,
    aoAllowed: true,
    dofAllowed: true,
    bloomAllowed: true,
    bloomResolutionScale: 1,
    smaaAllowed: true,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    shadowDistanceScale: 1.0,
    particleDensity: 1.0,
    foliageCullDistanceScale: 1.0,
  },

  high: {
    renderScale: 1.0,
    maxPixelRatio: 1.75,
    aoAllowed: true,
    dofAllowed: true,
    bloomAllowed: true,
    bloomResolutionScale: 1,
    smaaAllowed: true,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    shadowDistanceScale: 0.75,
    particleDensity: 0.8,
    foliageCullDistanceScale: 0.85,
  },

  medium: {
    renderScale: 0.85,
    maxPixelRatio: 1.5,
    aoAllowed: false,
    dofAllowed: false,
    bloomAllowed: true,
    bloomResolutionScale: 0.5,
    smaaAllowed: true,
    shadowsEnabled: true,
    shadowMapSize: 512,
    shadowDistanceScale: 0.5,
    particleDensity: 0.55,
    foliageCullDistanceScale: 0.65,
  },

  low: {
    renderScale: 0.7,
    maxPixelRatio: 1.0,
    aoAllowed: false,
    dofAllowed: false,
    bloomAllowed: false,
    bloomResolutionScale: 0.5,
    smaaAllowed: false,
    shadowsEnabled: false,
    shadowMapSize: 256,
    shadowDistanceScale: 0.35,
    particleDensity: 0.3,
    foliageCullDistanceScale: 0.45,
  },
};
```

---

## 12. Örnek kontrol akışı

Kontrolcü, global durum yerine Forge'un `Subsystem` deseniyle yazılır
(`engine/core/Subsystem.ts` — `update(context)` her tick `deltaSeconds` alır)
ve karar çekirdeği **pure** kalır ki `tools/engine-tests.ts`'te sahte
metriklerle deterministik test edilebilsin:

```ts
// Pure karar çekirdeği (engine/perf/adaptiveQuality.ts) — DOM/three yok.
export type AdaptiveDecision =
  | { kind: "none" }
  | { kind: "reduce"; bottleneck: BottleneckResult }
  | { kind: "increase" };

export function decideAdaptiveStep(state: {
  metrics: FrameMetrics;
  preferences: GraphicsPreferences;
  cooldownRemainingSeconds: number;
  stableDurationSeconds: number;
  classify: () => BottleneckResult;
}): AdaptiveDecision {
  if (!state.preferences.adaptiveOptimizationEnabled) return { kind: "none" };
  if (state.cooldownRemainingSeconds > 0) return { kind: "none" };

  const targetFrameTime =
    state.preferences.targetFrameRate === 60 ? 16.7 : 33.3;

  const degraded = state.metrics.averageFrameTimeMs > targetFrameTime * 1.25;
  const stable = state.metrics.averageFrameTimeMs < targetFrameTime * 0.9;

  if (degraded && state.metrics.sampleWindowSeconds >= 5) {
    return { kind: "reduce", bottleneck: state.classify() };
  }
  if (stable && state.stableDurationSeconds >= 45) {
    return { kind: "increase" };
  }
  return { kind: "none" };
}

// Subsystem sarmalayıcı (src/scene tarafı): her update'te frame metriklerini
// besler, decideAdaptiveStep'i çağırır, kararı QualityProfileManager
// uygulayıcısına iletir ve cooldown'u (reduce: 15sn, increase: 20sn) sayar.
// Manuel profil sınırı ve allowFineTuning kuralları uygulayıcıda zorlanır.
```

---

## 13. Performans debug overlay (MEVCUT — genişletilecek)

`?debug` overlay'i (`src/scene/debugStats.ts`) fps, draw call, triangle,
subsystem perf, memory/heap, budget, vfx, AI ve UI bloklarını **zaten**
gösteriyor. Bu plan yalnız şu satırları ekler (aynı pure `format*` fonksiyon
deseniyle, unit test edilebilir):

```text
frame 17.2ms p95 26.5 spikes 3        ← FrameMetricsMonitor'dan
quality: Medium (adaptive on)          ← aktif profil + mod
last: GTAO off (gpu, conf 0.78, 42s)  ← son otomatik karar + nedeni + yaşı
```

Debug overlay oyuncuya varsayılan olarak gösterilmez (`?debug` URL bayrağı
mevcut davranış); geliştirici ve test modunda erişilebilir. Oyuncunun göreceği
tek performans yüzeyi, ayarlar ekranındaki sade özet ve §5.3'teki durum
mesajlarıdır.

---

## 14. Fazlara ayrılmış yapılacaklar listesi

## Faz 0 — Performans hedefleri ve bütçeler

### Amaç
Forge için ölçülebilir performans hedeflerini belirlemek.

Kısmen mevcut: `DEFAULT_PERF_BUDGET` (500 draw call / 1M tri / 128 texture,
`engine/perf/perfBudget.ts`) template bütçesi olarak zaten var ve overlay'de
aşım işaretleniyor. Oyun türü başına bütçe kataloğu Forge'da tutulmaz — fork
kendi bütçesini override eder (§6.1 modeli).

### Yapılacaklar

- [ ] Hedef cihaz sınıflarını tanımla: düşük, orta, yüksek seviye masaüstü / laptop
- [ ] Her cihaz sınıfı için hedef FPS tanımla
- [ ] 30 FPS ve 60 FPS hedef modlarını netleştir
- [ ] Template draw call / triangle / texture bütçelerini gözden geçir
      (mevcut `DEFAULT_PERF_BUDGET` değerleri yeterli mi?)
- [ ] Bütçe setine partikül ve fizik gövdesi sayısı ekle (perfBudget genişletmesi)
- [ ] En yoğun örnek sahneyi "benchmark scene" olarak seç (template'in
      `playground` layout'u yeterince yoğun değilse yoğun bir test layout'u ekle)
- [ ] Performans kabul kriterlerini dokümante et

### Çıkış kriteri

```text
Forge içinde bir sahnenin "hedefi geçti / hedefi geçemedi" denebilecek sayısal bütçeleri vardır.
```

---

## Faz 1 — Temel performans ölçüm altyapısı

### Amaç
Kalite kararlarından önce güvenilir telemetri toplamak.

Büyük kısmı mevcut: `renderer.info` toplama, subsystem timing, memory/heap,
budget bloğu ve `?debug` overlay'in kendisi hazır. Bu fazın gerçek işi
frame-time istatistiği ve overlay'e eklenen birkaç satırdır.

### Yapılacaklar

- [x] ~~Debug overlay oluştur~~ (mevcut: `src/scene/debugStats.ts`)
- [x] ~~`renderer.info` metriklerini topla~~ (mevcut: `readRenderStats` / `readRenderMemory`)
- [x] ~~Alt sistem sürelerini ölç~~ (mevcut: `SubsystemProfiler`, `?debug`)
- [ ] `engine/perf/frameMetrics.ts` — pure frame-time aggregator (ham rAF
      delta'sı, 1/5/30 sn pencereler, ortalama, P95, spike sayaçları,
      yenileme hızı tahmini) + `tools/engine-tests.ts` testleri
- [ ] `RuntimeSceneApp` frame loop'una bağla: **clamp'ten önceki ham delta**
      beslenir; `visibilitychange`'de pencereler sıfırlanır (§3.1)
- [ ] Production'da da açık, ucuz çalıştığını doğrula (yalnız subsystem
      profiler `?debug`'a bağlı kalır)
- [ ] Composer aktifken doğru draw-call toplamı: `info.autoReset` stratejisi (§3.1)
- [ ] Overlay'e frame avg / P95 / spike satırını ekle (pure `format*` deseni)
- [ ] Aktif partikül / AI sayaçları overlay'de zaten var; fizik gövdesi ve
      ışık sayaçlarını ekle (§7.4)
- [ ] Ölçüm penceresini JSON olarak konsola export edilebilir hâle getir
      (geliştirme build'i; cihaz raporu toplamak için)

### Çıkış kriteri

```text
Geliştirici, yoğun sahnede frame süresi, P95, draw call, triangle, texture ve aktif sistem sayılarını görebilir.
```

---

## Faz 2 — Kalite profilleri ve merkezi ayar yönetimi

### Amaç
Bugün motorda karşılığı olan tüm pahalı sistemleri ortak kalite ayarlarına
bağlamak. (Genişletme alanları — LOD, görüş mesafesi, NPC/AI/animasyon Hz,
texture limiti — bu fazın DIŞINDA; bkz. §11 ve Faz 7.)

### Yapılacaklar

- [ ] `engine/perf/qualityProfiles.ts` — profil tanımları + pure çözümleme
      (profil → efektif QualitySettings; authored post-process ile birleşme
      kuralı: kalite yalnız kapatır/kısar, İlke #2) + testler
- [ ] Ultra / High / Medium / Low template profillerini tanımla; `Custom` durumu
- [ ] Uygulayıcı adapter (src/scene): render scale — renderer + composer
      boyutunu birlikte ölçekle (`setSize`/`setPixelRatio` etkileşimine dikkat)
- [ ] Pixel ratio üst sınırını `MAX_PIXEL_RATIO` sabitinden profile taşı
- [ ] Gölgeleri bağla: `renderer.shadowMap.enabled` + `lights.ts`'teki 2048
      sabit mapSize'ı profile bağla (mapSize değişiminde
      `light.shadow.map.dispose()` + null'lama gerekir) + shadow camera
      boyutuna `shadowDistanceScale`
- [ ] AO (GTAO) / DoF / Bloom / SMAA gate'lerini bağla: efektif
      `ResolvedPostProcess` üzerinden pass'leri yeniden kur (mevcut
      `setEffectPasses` bu rebuild'i zaten destekliyor); Bloom yarım
      çözünürlük seçeneği
- [ ] Partikül yoğunluğunu bağla: vfx subsystem'a global `particleDensity`
      çarpanı (spawn rate + `maxParticles`'a uygulanır)
- [ ] Foliage cull distance çarpanını bağla (foliage Faz 2 cull-fade işiyle
      koordine et)
- [ ] Ayar değişiminin güvenliği: pass rebuild / shadow map dispose /
      composer resize tek bir "apply" noktasında, frame sınırında yapılır;
      art arda değişimler debounce edilir
- [ ] Editor viewport'u etkilenmez: kalite katmanı yalnız runtime'da
      (`RuntimeSceneApp`) devrededir; adaptif sistem editörde çalışmaz

### Çıkış kriteri

```text
Tek bir kalite profili değişikliği; render scale, gölge, post-process ve
partikül davranışını layout datasına dokunmadan tutarlı şekilde günceller.
```

---

## Faz 3 — Oyuncu grafik ayarları ekranı

### Amaç
Oyuncuya hem sade seçim hem de kontrol imkânı vermek — mevcut UI framework'ü
(`.ui.json` + ViewModel + screen stack, `RuntimeUiSubsystem`) ve
`UserSettingsStore` ile; sıfırdan panel/depolama yazılmaz.

### Yapılacaklar

- [ ] `UserSettings`'e `graphics: GraphicsPreferences` alanı ekle
      (`userSettingsStore.ts` — schema bump, normalize, eski kayıt için
      varsayılanlar; audio/locale deseniyle aynı) + testler
- [ ] Grafik ayarları ekranını `.ui.json` + ViewModel ile oluştur
      (UiWidgetEditor'da düzenlenebilir olması bonus)
- [ ] Ultra / High / Medium / Low seçenekleri
- [ ] Adaptif optimizasyon toggle'ı
- [ ] 30 FPS / 60 FPS hedef seçimi
- [ ] Seçili profil bilgisini göster
- [ ] Gelişmiş ayar değişince `Custom` durumuna geç
- [ ] "Varsayılana dön" aksiyonu
- [ ] Oyuncunun son tercihlerini oyun açılışında yükle ve uygula
- [ ] Ayar uygulandığında kısa durum mesajı göster (§5.3 — agresif pop-up yok)
- [ ] Gelişmiş ayarlar ilk sürümde kapalı / açılır bölüm; `Custom` akışı
      isterse bu dilimin sonuna ertelenebilir (MVP profil + toggle ile tamam)

### Çıkış kriteri

```text
Oyuncu adaptif modu açıp kapatabilir ve Ultra / High / Medium / Low profillerinden birini kalıcı olarak seçebilir.
```

---

## Faz 4 — Başlangıç performans testi ve donanım ipuçları

### Amaç
Oyunun ilk açılışta makul bir kalite ile başlamasını sağlamak.

### Yapılacaklar

- [ ] `engine/perf/hardwareHints.ts` — pure çözümleme (girdiler dışarıdan
      enjekte edilir: `hardwareConcurrency`, `deviceMemory`, ekran, DPR,
      UA/touch ipucu, `WEBGL_debug_renderer_info` string'i) + testler
- [ ] İpuçlarını toplayan ince tarayıcı adapter'ı (src/scene)
- [ ] Başlangıç profili seçme kuralını tanımla (ipucu yoksa Medium başla)
- [ ] Ayrı benchmark sahnesi YERİNE ilk oynanışın ilk 8–15 saniyesini ölçüm
      penceresi olarak kullan (yükleme/warm-up spike'ları pencereden düşülür);
      sonuçla profili bir kez yukarı/aşağı düzelt
- [ ] İlk ölçüm sonucunu UserSettings'e kaydet (tekrar tekrar kalibre etme)
- [ ] Kullanıcının daha önce yaptığı manuel seçim her zaman otomatik
      kalibrasyonun önüne geçer

### Çıkış kriteri

```text
Yeni bir oyuncu oyuna doğrudan aşırı ağır veya aşırı düşük kaliteyle başlamaz; sistem ölçüm sonucuna göre dengeli bir başlangıç seçer.
```

---

## Faz 5 — Darboğaz sınıflandırma

### Amaç
Sistemin hangi kalite ayarını neden değiştireceğini belirlemesi.

### Yapılacaklar

- [ ] `engine/perf/bottleneckClassifier.ts` — pure sınıflandırıcı; girdi:
      FrameMetrics + SubsystemProfileSnapshot + perf budget durumu + testler
- [ ] Pasif kural setini uygula (§8.1): CPU toplamı yüksek → CPU (en pahalı
      subsystem işaretlenir); CPU düşük + frame yüksek → GPU
- [ ] Adaptif mod açıkken SubsystemProfiler'ı `?debug` olmadan da etkinleştir
      (§7.3 — küçük pencereyle)
- [ ] Draw call yoğunluğu kurallarını tanımla (perfBudget aşımı sinyali)
- [ ] Asset yükleme / shader warm-up spike algılamasını ekle (spike anlarını
      yükleme olaylarıyla ilişkilendir)
- [ ] Fallback render-scale karşılaştırma testini ekle (nadir, kısa, sonucu
      cache'li — §8.2)
- [ ] Her teşhis için confidence score + kanıt listesi üret
- [ ] Belirsiz durumda güvenli, küçük genel kalite azaltma kuralını ekle
- [ ] Geliştirici overlay'inde karar nedenini göster (§13 `last:` satırı)

### Çıkış kriteri

```text
Sistem “FPS düştü” demekle kalmaz; mümkünse GPU, CPU, draw call veya yükleme spike'ı kaynaklı olduğunu işaretler.
```

---

## Faz 6 — Adaptif kalite kontrolü

### Amaç
Kaliteyi kararlı, küçük adımlarla otomatik değiştirmek.

### Yapılacaklar

- [ ] `engine/perf/adaptiveQuality.ts` — pure karar çekirdeği (§12
      `decideAdaptiveStep`) + deterministik testler (pencere/cooldown/
      hysteresis senaryoları sahte metriklerle)
- [ ] Subsystem sarmalayıcı: `EngineApp.registerSubsystem` ile kaydolur,
      yalnız runtime'da (editörde asla)
- [ ] 5 saniyelik bozulma algılama penceresi
- [ ] 30–60 saniyelik stabil performans penceresi
- [ ] Ayar değişimi sonrası cooldown
- [ ] Hysteresis mantığı (düşürme hızlı, artırma temkinli)
- [ ] GPU azaltma sırasını uygula (§10.1 — MVP basamakları)
- [ ] CPU azaltma sırasını uygula (§10.2 — en pahalı subsystem hedefli)
- [ ] Tek seferde yalnızca bir ayar basamağı değiştir
- [ ] Oyuncunun manuel profil sınırlarına saygı göster
      (`allowFineTuning` yalnız izin verilen aralıkta)
- [ ] Son yapılan otomatik değişikliği kayıt altına al (overlay + geri alma)
- [ ] Oyuncuya gerekirse sade bildirim göster (§5.3)

### Çıkış kriteri

```text
Oyun uzun süre zorlandığında görsel kaliteyi kontrollü azaltır; performans stabil olduğunda ayarları acele etmeden geri artırabilir.
```

---

## Faz 7 — Sahne ve içerik optimizasyon bağları

### Amaç
§11'deki **genişletme** alanlarının mekanizmalarını kurmak, böylece kalite
profilleri post-process'in ötesinde gerçek içerik yükünü de ölçekleyebilsin.
Bu faz büyük ve dilimlenebilir; her madde kendi başına bir dilimdir ve
ihtiyaç kanıtlandıkça (profiler verisiyle) çekilir — hepsi önkoşul değildir.

### Yapılacaklar

- [ ] NPC AI için distance-based update sistemi kur (AI subsystem bugün her
      frame tick'ler) → `aiUpdateHz` alanını canlandırır
- [ ] Uzak karakter animasyonları için düşük frekanslı mixer update
      → `farAnimationUpdateHz`
- [ ] Chunk bazlı sahne aktivasyonu (foliage Faz 2 chunking işiyle ortak
      altyapı — önce foliage'da kanıtla, sonra genelle)
- [ ] Statik tekrar eden prop'larda `InstancedMesh` / mesh merge stratejisi
      (foliage zaten instanced; statik placement'lara genelleme)
- [ ] LOD şablonları + `lodBias` (three `LOD` düğümü veya mesafe kademesi)
- [ ] Uzak nesneler için billboard / impostor değerlendirmesi
- [ ] Fizik gövdeleri için aktif alan sınırı → NPC yoğun fork'lar için
- [ ] Spawn sistemlerini frame'lere yayma + object pool (spawn'lı fork'larda)
- [ ] Shader warm-up / preload aşaması (spike sınıfını kökten azaltır;
      `renderer.compileAsync` — boot/loading UX'ine eklenir)
- [x] ~~Partikül sistemine yoğunluk çarpanı ekle~~ (Faz 2'ye alındı — çekirdek)

### Çıkış kriteri

```text
Kalite profili değiştiğinde sadece post-process değil; NPC, prop, LOD, fizik ve partikül yükü de gerçekten azalır.
```

---

## Faz 8 — Test matrisi ve doğrulama

### Amaç
Sistemin farklı cihazlarda stabil ve anlaşılır davranmasını doğrulamak.

Otomasyon tabanı: pure çekirdekler (frame metrics, classifier, karar mantığı,
profil çözümleme) zaten `npm run test:engine`'de deterministik test edilir;
`npm run smoke:browser` (Playwright) editör/runtime boot'u kapsıyor — buna
"kalite profili değişimi render'ı kırmıyor" smoke'u eklenebilir. Aşağıdaki
matris ise elle yapılan cihaz doğrulamasıdır.

### Yapılacaklar

- [ ] smoke:browser'a kalite senaryosu ekle: profil değiştir → sahne render
      etmeye devam ediyor, konsol hatasız
- [ ] Düşük / orta / yüksek seviye cihaz test listeleri oluştur
- [ ] Entegre GPU'lu laptop + harici GPU'lu masaüstü testleri
- [ ] Pil modu / priz modu karşılaştırması (aynı cihaz, iki güç profili)
- [ ] Yüksek DPI / Retina + 120/144 Hz monitör testleri (§3.1 kademelenme)
- [ ] Farklı tarayıcı testleri (Chrome / Firefox / Safari — `performance.memory`
      ve timer query farkları)
- [ ] Yoğun benchmark sahnesi testleri (Faz 0'daki sahne): çok partikül,
      çok NPC, gölge + tüm post-process açık varyantları
- [ ] Uzun oynanış / bellek sızıntısı testi (heap + geometry/texture sayıları
      overlay'den izlenir)
- [ ] Ayarların sürekli açılıp kapanmadığını doğrula (hysteresis kanıtı:
      overlay `last:` satırının sıklığı)
- [ ] Manuel seçimin korunduğunu doğrula (yeniden açılışta UserSettings)
- [ ] Kalite değişimlerinin oyuncuya görsel olarak rahatsız edici olmadığını
      kontrol et

### Çıkış kriteri

```text
Farklı cihaz sınıflarında oyun hedef performansa yaklaşır; sistem gereksiz kalite değişiklikleri yapmaz ve manuel tercihleri korur.
```

---

## 15. Öncelik sırası

İlk sürüm için en yüksek değer sağlayacak sıra:

```text
1. Faz 1 — Frame-time ölçümü (kalanı; altyapının çoğu mevcut)
2. Faz 2 — Merkezi kalite profilleri (çekirdek düğmeler)
3. Faz 3 — Oyuncu grafik ayarları (UI framework + UserSettingsStore)
4. Faz 6 — Basit adaptif kontrol
5. Faz 5 — Darboğaz sınıflandırma (pasif sinyaller önce)
6. Faz 7 — İçerik sistemlerinin kaliteye bağlanması (dilim dilim, veriye göre)
7. Faz 4 — Donanım ipuçları ve başlangıç kalibrasyonu
8. Faz 8 — Geniş cihaz test matrisi
```

Bu sıra önemlidir. Önce ölçemediğin sistemi otomatikleştirmemelisin. Ardından
kalite ayarları merkezi olarak çalışmalı; ancak bundan sonra adaptif sistem
güvenilir karar verebilir.

Çalışma biçimi (Forge kuralı): her dilim build-passing olmalı — pure çekirdek +
testleriyle birlikte gelir, `npx tsc --noEmit` + `npm run test:engine` yeşil
kalır; renderer'a dokunan dilimlerde `npm run build:verify`. Faz 6'ya
gelindiğinde bile Faz 5'siz basit sürüm çalışabilir (teşhis "unknown" →
genel küçük adım) — fazlar birbirini bloke etmez.

---

## 16. İlk sürüm için sadeleştirilmiş MVP

Forge için ilk uygulanabilir sürüm aşağıdaki kapsamla başlanabilir:

- [ ] Frame time / P95 / spike ölçümü (`frameMetrics.ts` + overlay satırı)
- [x] ~~Draw call / triangle / texture debug overlay'i~~ (mevcut)
- [ ] Ultra / High / Medium / Low profil sistemi (çekirdek alanlar, §11)
- [ ] Adaptif optimizasyon toggle'ı
- [ ] Manuel profil seçimi
- [ ] `UserSettingsStore.graphics` ile ayar kaydı
- [ ] 5 saniye süren performans düşüşünde tek adım kalite azaltma
- [ ] 45 saniye stabil performansta tek adım kalite artırma
- [ ] Teşhis: pasif sinyaller (frame vs. subsystem CPU toplamı — profiler mevcut)
- [ ] GPU şüphesinde sıra: GTAO → DoF → Bloom → shadow map → SMAA →
      partikül → render scale
- [ ] CPU şüphesinde: partikül yoğunluğu + profil adımı (NPC/AI düğmeleri
      Faz 7 mekanizmalarını bekler)

MVP aşamasında kesin GPU/CPU teşhisi ve render-scale probe'u zorunlu değildir.
Öncelik, **ölçülebilir, kararlı ve oyuncu kontrolünü koruyan** bir sistem
kurmaktır.

---

## 17. Riskler ve dikkat edilmesi gerekenler

### 17.1 Kalite değişimlerinin görsel olarak dikkat çekmesi

Render scale veya gölge çözünürlüğü aniden değişirse oyuncu bunu fark edebilir.

Önlem:

- Değişimleri yükleme ekranında veya sahne geçişinde uygulamayı tercih et
- Zorunlu canlı değişimlerde küçük adımlarla ilerle
- Render scale değişimini nadir kullan (aktif GPU probe'u da bu yüzden
  yalnız fallback'tir, §8.2)
- Önce GTAO, DoF, bloom, partikül yoğunluğu gibi daha az dikkat çeken
  ayarları değiştir

### 17.2 Yanlış teşhis

Bir asset yükleme spike'ı CPU darboğazı gibi görünebilir.

Önlem:

- Tekil spike'ta kalite değiştirme
- Karar için en az 5 saniyelik pencere kullan
- Confidence score düşükse küçük değişiklik yap veya hiçbir şey yapma
- Son kararı debug log'a yaz

### 17.3 Oyuncu kontrolünün kaybolması

Otomasyon oyuncunun seçtiği Ultra profilini sürekli Medium'a çekerse kötü bir deneyim oluşur.

Önlem:

- Manuel modda otomatik değiştirme yapma
- “Manuel + Adaptif İnce Ayar” ayrı bir seçenek olsun
- Oyuncuya son değişikliğin nedenini göster
- Tek tıkla önceki ayara dönme imkânı ver

### 17.4 Zayıf optimizasyonu maskeleme riski

Adaptif kalite sistemi kötü tasarlanmış bir sahneyi çözmez.

Önlem:

- Draw call, texture, NPC, fizik ve partikül bütçelerini en baştan uygula
  (perfBudget overlay'i zaten aşımı işaretliyor)
- Profiling sonucu en pahalı sistemi hedefle
- Sistem kararlarını içerik optimizasyonu için veri kaynağı olarak kullan

### 17.5 Authored sahne datasını bozma riski (Forge'a özgü)

Post-process, gölge ve ışık ayarları `LayoutPostProcess` / ışık aktörleri
olarak **yazarlık datasıdır**. Kalite katmanı bunları layout'a yazarsa Save
Layout kirlenir; ayrıca dev server'ın layout autosave davranışıyla birleşince
fark edilmeden commit'lenebilir.

Önlem:

- Kalite katmanı yalnız runtime'da, çözümlenmiş (`ResolvedPostProcess` vb.)
  değerlerin üzerine uygulanır; layout nesnelerine ve `__save-*`
  endpoint'lerine asla dokunmaz (İlke #2)
- Editör viewport'u kalite katmanının tamamen dışındadır; adaptif subsystem
  editörde kaydedilmez

### 17.6 Kalıcılık ve editör sızıntısı

- Adaptif sistemin geçici düşürmeleri `UserSettings`'e yazılmaz — yalnız
  oyuncunun bilinçli tercihi kalıcıdır; aksi hâlde tek kötü oturum kaliteyi
  kalıcı düşürür
- Yeni modüller `?editor` dinamik importunun dışında, oyun bundle'ında yaşar;
  `verify:dist --strict` + `verify:imports` boundary'leri korunur

---

## 18. Son karar

Forge için en doğru yaklaşım:

```text
Manuel kalite profilleri + Adaptif optimizasyon toggle'ı + Gerçek oyun içi telemetri
```

Bu üçlü birlikte çalışmalıdır.

- Oyuncu kontrolü isterse kaliteyi manuel seçer.
- Oyuncu akıcılık isterse adaptif modu açar.
- Forge, donanım modeline körü körüne güvenmez.
- Sistem gerçek sahnede ölçüm yapar (SubsystemProfiler + frame metrics).
- Darboğazı önce pasif sinyallerle tahmin eder.
- En düşük görsel kayıpla en doğru kalite ayarını değiştirir — authored
  sahne datasına dokunmadan.
- Geliştirici ise `?debug` overlay ve loglarla neden karar verildiğini görebilir.

Sistemin yarısı (ölçüm, profiler, bütçe, overlay, ayar deposu, UI framework)
Forge'da zaten var; bu plan kalan yarıyı — frame istatistiği, merkezi kalite
katmanı, oyuncu ekranı ve adaptif kontrolcüyü — mevcut desenlerle tamamlar.
Bu sistem, Forge'u yalnızca "Three.js ile çalışan oyun üreten bir yapı"
olmaktan çıkarıp; farklı cihazlara uyum sağlayabilen, yayınlanabilir ve
ölçeklenebilir bir web oyun platformuna yaklaştırır.
