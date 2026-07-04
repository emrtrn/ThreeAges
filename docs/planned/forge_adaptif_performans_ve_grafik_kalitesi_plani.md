# Forge — Adaptif Performans ve Grafik Kalitesi Sistemi

**Durum:** Teknik taslak / uygulama planı  
**Hedef platform:** Tarayıcı tabanlı Three.js oyunları  
**Kapsam:** WebGL tabanlı Forge oyunlarında otomatik kalite ayarı, darboğaz tahmini, manuel kalite profilleri ve oyuncu ayarları menüsü.

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

---

## 4. Sistem mimarisi

```text
PerformanceMonitor
├─ Frame time ve FPS toplar
├─ Ortalama / P95 / spike analizi yapar
├─ Renderer istatistiklerini okur
├─ Oyun alt sistem sürelerini toplar
└─ Performans oturum kaydı üretir

HardwareHintCollector
├─ CPU çekirdek bilgisi
├─ Yaklaşık RAM bilgisi
├─ Ekran çözünürlüğü
├─ Device pixel ratio
├─ Mobil / masaüstü tahmini
└─ Uygunsa WebGL renderer ipucu

BottleneckClassifier
├─ GPU ağırlıklı mı?
├─ CPU ağırlıklı mı?
├─ Draw call / görünür obje yoğunluğu var mı?
├─ Bellek / yükleme spike'ı var mı?
└─ Sonucu güven seviyesiyle üretir

QualityProfileManager
├─ Ultra
├─ High
├─ Medium
├─ Low
├─ Custom
└─ Ayar geçişlerini uygular

AdaptiveQualityController
├─ Performans pencerelerini izler
├─ Karar gecikmesi uygular
├─ Tek adımda küçük ayar değiştirir
├─ Sürekli aç/kapa döngüsünü önler
└─ Oyuncu tercihini korur

SettingsUI
├─ Adaptif optimizasyon toggle'ı
├─ Ultra / High / Medium / Low seçimi
├─ Gelişmiş ayarlar
├─ Performans özeti
└─ Varsayılana dön seçeneği

Telemetry / Debug Overlay
├─ Frame time grafiği
├─ Draw call
├─ Triangle sayısı
├─ Texture / geometry sayısı
├─ Aktif NPC sayısı
├─ Partikül sayısı
└─ Mevcut kalite kararının nedeni
```

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

Gelişmiş Ayarlar
- Render Scale
- Gölgeler
- SSAO
- Bloom
- Anti-Aliasing
- Partikül Yoğunluğu
- Görüş Mesafesi
- NPC Yoğunluğu
```

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

Aşağıdaki tablo Forge için başlangıç profili olarak kullanılabilir. Değerler oyun türüne göre ayarlanmalıdır.

| Ayar | Ultra | High | Medium | Low |
|---|---:|---:|---:|---:|
| Render scale | 1.00 | 1.00 | 0.85 | 0.70 |
| Device pixel ratio üst limiti | 2.00 | 1.75 | 1.50 | 1.00 |
| SSAO | Açık | Açık | Kapalı | Kapalı |
| Bloom | Yüksek | Orta | Düşük | Kapalı |
| Shadow map çözünürlüğü | 2048 | 1024 | 512 | 256 / Kapalı |
| Shadow distance | Uzak | Orta | Yakın | Çok yakın |
| Shadow update sıklığı | Her frame | Her frame | 2 frame'de bir | Gerektiğinde |
| Anti-aliasing | Yüksek | Orta | Düşük | Kapalı |
| Partikül yoğunluğu | %100 | %80 | %55 | %30 |
| Görüş mesafesi | %100 | %85 | %65 | %45 |
| Uzak LOD geçişi | Geç | Orta | Erken | Çok erken |
| NPC bütçesi | %100 | %80 | %60 | %35 |
| AI update hızı | 60 Hz | 30 Hz | 15–20 Hz | 10 Hz |
| Uzak animasyon update hızı | 60 Hz | 30 Hz | 15 Hz | 8–10 Hz |
| Texture maksimum boyutu | 2048 | 2048 | 1024 | 512–1024 |

### 6.1 Kritik not

Bu değerler “nihai doğru ayarlar” değildir. Forge içinde farklı oyun türleri için profil şablonları olmalıdır:

- **3D action / karakter odaklı oyun**
- **Yoğun NPC içeren simülasyon**
- **Mini mart / servis oyunu**
- **Açık alan keşif oyunu**
- **Yüksek sayıda prop içeren builder / sandbox**

Her şablon aynı kalite isimlerini kullanabilir ama arka plandaki bütçeleri farklı olmalıdır.

---

## 7. Ölçülmesi gereken metrikler

### 7.1 Temel frame metrikleri

```ts
interface FrameMetrics {
  frameTimeMs: number;
  fps: number;
  averageFrameTimeMs: number;
  p95FrameTimeMs: number;
  spikeCount: number;
  sampleWindowSeconds: number;
}
```

Takip edilmesi gerekenler:

- Son frame süresi
- Son 1 saniye ortalama frame time
- Son 5 saniye ortalama frame time
- Son 5 saniye P95 frame time
- 33.3 ms üzerindeki frame sayısı
- 50 ms üzerindeki frame sayısı
- 100 ms üzerindeki büyük takılma sayısı

### 7.2 Three.js render metrikleri

```ts
interface RenderMetrics {
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
  textureCount: number;
  geometryCount: number;
}
```

Örnek kaynak:

```ts
const renderMetrics = {
  drawCalls: renderer.info.render.calls,
  triangles: renderer.info.render.triangles,
  points: renderer.info.render.points,
  lines: renderer.info.render.lines,
  textureCount: renderer.info.memory.textures,
  geometryCount: renderer.info.memory.geometries,
};
```

### 7.3 Oyun alt sistem metrikleri

```ts
interface SystemTiming {
  inputMs: number;
  worldUpdateMs: number;
  aiMs: number;
  physicsMs: number;
  animationMs: number;
  raycastMs: number;
  spawnMs: number;
  renderPrepMs: number;
  uiMs: number;
}
```

Bu ölçümler mükemmel hassasiyetle başlamak zorunda değildir. İlk sürümde sadece kritik sistemler ölçülmelidir:

1. AI
2. Fizik
3. Animasyon
4. Raycast
5. Spawn / despawn
6. Render öncesi hazırlık
7. UI güncellemeleri

### 7.4 Dünya metrikleri

```ts
interface WorldMetrics {
  visibleObjectCount: number;
  activeEntityCount: number;
  activeNpcCount: number;
  activePhysicsBodyCount: number;
  particleCount: number;
  activeLights: number;
  shadowCastingLights: number;
}
```

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

### 8.1 GPU darboğazı testi

Ana test: kısa süreli render scale karşılaştırması.

```text
1. Mevcut kalite ile kısa örnek al.
2. Render scale'i geçici olarak düşür.
3. Aynı süre boyunca tekrar ölç.
4. Frame time anlamlı derecede iyileşirse GPU ağırlıklı kabul et.
```

Örnek:

```text
1.00 render scale → 28 ms
0.75 render scale → 18 ms
Sonuç → GPU darboğazı olasılığı yüksek
```

Önerilen eşik:

```text
Render scale düşüşü frame time'ı %15 veya daha fazla iyileştirirse:
GPU darboğazı olasılığı yüksek.
```

GPU tarafında sık görülen nedenler:

- SSAO
- Bloom
- Anti-aliasing
- Büyük shadow map
- Çok sayıda shadow-casting light
- Yüksek device pixel ratio
- Transparan partiküller
- Ağır shader'lar
- Çok yüksek çözünürlüklü render target'lar
- Çok sayıda piksel işleyen post-process pass'leri

### 8.2 CPU darboğazı testi

Render scale düşürüldüğünde frame time neredeyse değişmiyorsa, CPU tarafı şüphelidir.

Örnek:

```text
1.00 render scale → 27 ms
0.75 render scale → 26 ms
Sonuç → GPU tarafını hafifletmek fayda sağlamadı.
```

CPU tarafında sık görülen nedenler:

- Çok fazla update çağrısı
- NPC AI
- Pathfinding
- Fizik hesapları
- Raycast yoğunluğu
- Animation mixer güncellemeleri
- Çok sayıda nesnenin transform güncellemesi
- Sık object allocation ve garbage collection
- DOM / React state güncellemeleri
- Çok yüksek draw call sayısı için render hazırlığı

### 8.3 Draw call yoğunluğu

Draw call sorunu çoğu zaman CPU + GPU karışık maliyet üretir.

Şüphe sinyalleri:

```text
Draw call sayısı profil bütçesinin üzerinde
ve görünür obje sayısı yüksek
ve render scale değişimi sınırlı fayda sağlıyor
```

Çözüm yönü:

- `InstancedMesh`
- Mesh merge
- Batched rendering
- Aynı materyali paylaşma
- Uzak objeleri cull etme
- LOD
- Prop cluster sistemi
- Statik sahnede chunk bazlı birleştirme

### 8.4 Asset yükleme / bellek / shader spike

Belirtiler:

- Yeni bölgeye girince kısa donma
- İlk kez görülen efektte takılma
- İlk kez kullanılan materyalde spike
- Uzun oynanışta performans düşüşü
- Texture geç yüklenmesi
- Sayısal ortalama iyi, ama P95 kötü

Bu durumda otomatik kalite düşürmek ilk çözüm olmamalıdır. Önce şu konular incelenmelidir:

- Shader warm-up
- Asset preload
- Texture streaming
- Model / texture decode
- Spawn işlemlerinin karelere yayılması
- Object pool
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
Frame time hedefin üzerinde mi?
        │
        ▼
Bu durum en az 5 saniye sürdü mü?
        │
   Hayır ──► Ayar değiştirme
        │
       Evet
        │
        ▼
Render scale testi anlamlı iyileşme sağladı mı?
        │
   Evet ──► GPU ağırlıklı kabul et
        │          └─ GPU kalite basamağını azalt
        │
   Hayır
        │
        ▼
AI / fizik / animasyon / raycast süresi yüksek mi?
        │
   Evet ──► CPU ağırlıklı kabul et
        │          └─ CPU kalite basamağını azalt
        │
   Hayır
        │
        ▼
Draw call veya görünür obje sayısı yüksek mi?
        │
   Evet ──► Sahne karmaşıklığı basamağını azalt
        │
   Hayır
        │
        ▼
Spike tekil mi ve asset yükleme ile ilişkili mi?
        │
   Evet ──► Kaliteyi değiştirme; yükleme / shader sürecini işaretle
        │
   Hayır ──► Güven düşük; tek küçük genel kalite adımı uygula
```

---

## 10. Kalite azaltma öncelikleri

Kalite azaltma, tek bir “profil düşür” işlemi olmamalıdır. Sistem önce en yüksek etki / en düşük görsel kayıp sağlayan ayarları değiştirmelidir.

### 10.1 GPU ağırlıklı azaltma sırası

```text
1. SSAO kapat veya çözünürlüğünü düşür
2. Bloom çözünürlüğünü / yoğunluğunu azalt
3. Shadow map çözünürlüğünü düşür
4. Shadow distance azalt
5. Gölge atan ışık sayısını azalt
6. Anti-aliasing kalitesini azalt
7. Partikül yoğunluğunu düşür
8. Uzak LOD geçişini erkene al
9. Render scale düşür
10. Son çare: görüş mesafesini azalt
```

### 10.2 CPU ağırlıklı azaltma sırası

```text
1. Uzak NPC AI update oranını azalt
2. Uzak NPC animasyon güncellemesini azalt
3. Fizik simülasyonunu yakın / aktif objelerle sınırla
4. Raycast sıklığını azalt veya böl
5. Aktif NPC bütçesini azalt
6. Görüş mesafesi ve aktif entity bütçesini azalt
7. Spawn yoğunluğunu azalt
8. Partikül spawn hızını azalt
9. Statik tekrar eden objelerde instancing / batching uygula
10. Gerekirse profil seviyesini düşür
```

### 10.3 Sahne karmaşıklığı azaltma sırası

```text
1. Uzak prop kümelerini gizle
2. LOD mesafelerini erkene çek
3. Billboard / impostor kullan
4. Aynı materyalli statik objeleri merge et
5. InstancedMesh kullan
6. Sahneyi chunk'lara böl ve sadece gerekli chunk'ları aktif tut
7. Texture varyasyonlarını azalt
```

---

## 11. Örnek veri modeli

```ts
export type QualityLevel = "ultra" | "high" | "medium" | "low" | "custom";

export interface QualitySettings {
  renderScale: number;
  maxPixelRatio: number;

  ssaoEnabled: boolean;
  bloomEnabled: boolean;
  bloomQuality: 0 | 1 | 2 | 3;

  antiAliasing: "high" | "medium" | "low" | "off";

  shadowsEnabled: boolean;
  shadowMapSize: 256 | 512 | 1024 | 2048;
  shadowDistance: number;
  shadowUpdateInterval: number;

  particleDensity: number;
  viewDistanceMultiplier: number;
  lodBias: number;

  npcBudgetMultiplier: number;
  aiUpdateHz: number;
  farAnimationUpdateHz: number;

  maxTextureSize: 512 | 1024 | 2048;
}

export interface GraphicsPreferences {
  adaptiveOptimizationEnabled: boolean;
  targetFrameRate: 30 | 60;
  selectedQualityLevel: QualityLevel;
  allowAdaptiveFineTuning: boolean;
  customSettings?: Partial<QualitySettings>;
}
```

### 11.1 Kalite profili örneği

```ts
export const QUALITY_PROFILES: Record<Exclude<QualityLevel, "custom">, QualitySettings> = {
  ultra: {
    renderScale: 1.0,
    maxPixelRatio: 2.0,
    ssaoEnabled: true,
    bloomEnabled: true,
    bloomQuality: 3,
    antiAliasing: "high",
    shadowsEnabled: true,
    shadowMapSize: 2048,
    shadowDistance: 120,
    shadowUpdateInterval: 1,
    particleDensity: 1.0,
    viewDistanceMultiplier: 1.0,
    lodBias: 0,
    npcBudgetMultiplier: 1.0,
    aiUpdateHz: 60,
    farAnimationUpdateHz: 60,
    maxTextureSize: 2048,
  },

  high: {
    renderScale: 1.0,
    maxPixelRatio: 1.75,
    ssaoEnabled: true,
    bloomEnabled: true,
    bloomQuality: 2,
    antiAliasing: "medium",
    shadowsEnabled: true,
    shadowMapSize: 1024,
    shadowDistance: 90,
    shadowUpdateInterval: 1,
    particleDensity: 0.8,
    viewDistanceMultiplier: 0.85,
    lodBias: 1,
    npcBudgetMultiplier: 0.8,
    aiUpdateHz: 30,
    farAnimationUpdateHz: 30,
    maxTextureSize: 2048,
  },

  medium: {
    renderScale: 0.85,
    maxPixelRatio: 1.5,
    ssaoEnabled: false,
    bloomEnabled: true,
    bloomQuality: 1,
    antiAliasing: "low",
    shadowsEnabled: true,
    shadowMapSize: 512,
    shadowDistance: 60,
    shadowUpdateInterval: 2,
    particleDensity: 0.55,
    viewDistanceMultiplier: 0.65,
    lodBias: 2,
    npcBudgetMultiplier: 0.6,
    aiUpdateHz: 20,
    farAnimationUpdateHz: 15,
    maxTextureSize: 1024,
  },

  low: {
    renderScale: 0.7,
    maxPixelRatio: 1.0,
    ssaoEnabled: false,
    bloomEnabled: false,
    bloomQuality: 0,
    antiAliasing: "off",
    shadowsEnabled: false,
    shadowMapSize: 256,
    shadowDistance: 35,
    shadowUpdateInterval: 4,
    particleDensity: 0.3,
    viewDistanceMultiplier: 0.45,
    lodBias: 3,
    npcBudgetMultiplier: 0.35,
    aiUpdateHz: 10,
    farAnimationUpdateHz: 10,
    maxTextureSize: 512,
  },
};
```

---

## 12. Örnek kontrol akışı

```ts
function updateAdaptiveQuality(metrics: FrameMetrics): void {
  if (!graphicsPreferences.adaptiveOptimizationEnabled) {
    return;
  }

  if (cooldownRemainingSeconds > 0) {
    return;
  }

  const targetFrameTime = graphicsPreferences.targetFrameRate === 60
    ? 16.7
    : 33.3;

  const degraded = metrics.averageFrameTimeMs > targetFrameTime * 1.25;
  const stable = metrics.averageFrameTimeMs < targetFrameTime * 0.9;

  if (degraded && metrics.sampleWindowSeconds >= 5) {
    const bottleneck = bottleneckClassifier.classify();

    qualityProfileManager.reduceOneStep({
      bottleneck,
      respectManualProfile: true,
      allowFineTuning: graphicsPreferences.allowAdaptiveFineTuning,
    });

    cooldownRemainingSeconds = 15;
    return;
  }

  if (stable && stableDurationSeconds >= 45) {
    qualityProfileManager.increaseOneStep({
      respectManualProfile: true,
      allowFineTuning: graphicsPreferences.allowAdaptiveFineTuning,
    });

    cooldownRemainingSeconds = 20;
  }
}
```

---

## 13. Performans debug overlay

Forge editöründe ve geliştirme build'lerinde görünür olmalıdır.

```text
FPS: 58
Frame: 17.2 ms
P95: 26.5 ms
Draw Calls: 148
Triangles: 640k
Textures: 83
Geometries: 110
Active NPC: 24
Particles: 215
Quality: Medium
Adaptive: On
Last Action: SSAO disabled (GPU bottleneck, confidence 0.78)
```

Debug overlay oyuncuya varsayılan olarak gösterilmemelidir. Ancak geliştirici ve test modunda mutlaka erişilebilir olmalıdır.

---

## 14. Fazlara ayrılmış yapılacaklar listesi

## Faz 0 — Performans hedefleri ve bütçeler

### Amaç
Forge için ölçülebilir performans hedeflerini belirlemek.

### Yapılacaklar

- [ ] Hedef cihaz sınıflarını tanımla: düşük, orta, yüksek seviye masaüstü / laptop
- [ ] Her cihaz sınıfı için hedef FPS tanımla
- [ ] 30 FPS ve 60 FPS hedef modlarını netleştir
- [ ] Her oyun türü için draw call bütçesi belirle
- [ ] Her oyun türü için triangle bütçesi belirle
- [ ] Texture ve VRAM bütçesi için başlangıç sınırları tanımla
- [ ] Maksimum aktif NPC, fizik objesi ve partikül bütçelerini belirle
- [ ] En yoğun örnek sahneyi “benchmark scene” olarak seç
- [ ] Performans kabul kriterlerini dokümante et

### Çıkış kriteri

```text
Forge içinde bir sahnenin “hedefi geçti / hedefi geçemedi” denebilecek sayısal bütçeleri vardır.
```

---

## Faz 1 — Temel performans ölçüm altyapısı

### Amaç
Kalite kararlarından önce güvenilir telemetri toplamak.

### Yapılacaklar

- [ ] `PerformanceMonitor` modülünü oluştur
- [ ] `requestAnimationFrame` delta zaman ölçümünü ekle
- [ ] 1 sn, 5 sn ve 30 sn örnek pencereleri oluştur
- [ ] Ortalama frame time hesapla
- [ ] P95 frame time hesapla
- [ ] Frame spike sayacı ekle
- [ ] `renderer.info` metriklerini topla
- [ ] Aktif NPC / partikül / fizik gövdesi sayaçlarını ekle
- [ ] Debug overlay oluştur
- [ ] Geliştirme build'inde metrik kaydı ekle
- [ ] Ölçüm verisini konsola veya yerel log dosyasına export edilebilir hâle getir

### Çıkış kriteri

```text
Geliştirici, yoğun sahnede frame süresi, P95, draw call, triangle, texture ve aktif sistem sayılarını görebilir.
```

---

## Faz 2 — Kalite profilleri ve merkezi ayar yönetimi

### Amaç
Tüm pahalı sistemleri ortak kalite ayarlarına bağlamak.

### Yapılacaklar

- [ ] `QualityProfileManager` modülünü oluştur
- [ ] Ultra / High / Medium / Low profillerini tanımla
- [ ] `Custom` profil durumunu ekle
- [ ] Render scale ayarını merkezi hâle getir
- [ ] Pixel ratio üst sınırını merkezi hâle getir
- [ ] Gölge ayarlarını profile bağla
- [ ] SSAO ve bloom pass'lerini profile bağla
- [ ] Anti-aliasing ayarını profile bağla
- [ ] Partikül yoğunluğunu profile bağla
- [ ] LOD bias ve görüş mesafesini profile bağla
- [ ] NPC bütçesi ve AI update hızını profile bağla
- [ ] Uzak animasyon update hızını profile bağla
- [ ] Texture kalite limitini profile bağla
- [ ] Ayar değiştiğinde sahneyi güvenli biçimde güncelle

### Çıkış kriteri

```text
Tek bir kalite profili değişikliği; render, gölge, efekt, NPC, partikül ve LOD davranışlarını tutarlı şekilde günceller.
```

---

## Faz 3 — Oyuncu grafik ayarları ekranı

### Amaç
Oyuncuya hem sade seçim hem de kontrol imkânı vermek.

### Yapılacaklar

- [ ] Grafik ayarları panelini oluştur
- [ ] Ultra / High / Medium / Low seçeneklerini ekle
- [ ] Adaptif optimizasyon toggle butonunu ekle
- [ ] 30 FPS / 60 FPS hedef seçimini ekle
- [ ] Seçili profil bilgisini göster
- [ ] Manuel ayar değişince `Custom` durumuna geç
- [ ] “Varsayılana dön” aksiyonunu ekle
- [ ] Ayarları `localStorage` veya proje ayar depolama sistemine kaydet
- [ ] Oyuncunun son tercihlerini oyun yeniden açıldığında yükle
- [ ] Ayar uygulandığında kısa durum mesajı göster
- [ ] Gelişmiş ayarları ilk sürümde kapalı / açılır bölüm yap

### Çıkış kriteri

```text
Oyuncu adaptif modu açıp kapatabilir ve Ultra / High / Medium / Low profillerinden birini kalıcı olarak seçebilir.
```

---

## Faz 4 — Başlangıç performans testi ve donanım ipuçları

### Amaç
Oyunun ilk açılışta makul bir kalite ile başlamasını sağlamak.

### Yapılacaklar

- [ ] `HardwareHintCollector` modülünü oluştur
- [ ] Ekran çözünürlüğünü ve device pixel ratio değerini oku
- [ ] CPU çekirdek sayısı ipucunu oku
- [ ] Cihaz belleği ipucunu oku
- [ ] Mobil / masaüstü sınıflandırması ekle
- [ ] Uygunsa WebGL renderer ipucunu topla
- [ ] Başlangıç profili seçme kuralını tanımla
- [ ] Kısa benchmark alanını veya menü testini oluştur
- [ ] 8–15 saniyelik ölçümden sonra başlangıç profili öner
- [ ] İlk ölçüm sonucunu kaydet
- [ ] Kullanıcının daha önce yaptığı manuel seçimi otomatik testin önüne koy

### Çıkış kriteri

```text
Yeni bir oyuncu oyuna doğrudan aşırı ağır veya aşırı düşük kaliteyle başlamaz; sistem ölçüm sonucuna göre dengeli bir başlangıç seçer.
```

---

## Faz 5 — Darboğaz sınıflandırma

### Amaç
Sistemin hangi kalite ayarını neden değiştireceğini belirlemesi.

### Yapılacaklar

- [ ] `BottleneckClassifier` modülünü oluştur
- [ ] Render scale karşılaştırma testini ekle
- [ ] GPU darboğazı eşiklerini tanımla
- [ ] CPU alt sistem sürelerini topla
- [ ] AI / fizik / animasyon / raycast için yüksek kullanım eşiklerini belirle
- [ ] Draw call yoğunluğu kurallarını tanımla
- [ ] Asset yükleme spike algılamasını ekle
- [ ] Her teşhis için confidence score üret
- [ ] Belirsiz durumda güvenli, küçük genel kalite azaltma kuralını ekle
- [ ] Geliştirici overlay'inde karar nedenini göster

### Çıkış kriteri

```text
Sistem “FPS düştü” demekle kalmaz; mümkünse GPU, CPU, draw call veya yükleme spike'ı kaynaklı olduğunu işaretler.
```

---

## Faz 6 — Adaptif kalite kontrolü

### Amaç
Kaliteyi kararlı, küçük adımlarla otomatik değiştirmek.

### Yapılacaklar

- [ ] `AdaptiveQualityController` modülünü oluştur
- [ ] 5 saniyelik bozulma algılama penceresini ekle
- [ ] 30–60 saniyelik stabil performans penceresini ekle
- [ ] Ayar değişimi sonrası cooldown uygula
- [ ] Hysteresis mantığını ekle
- [ ] GPU için azaltma sırasını uygula
- [ ] CPU için azaltma sırasını uygula
- [ ] Sahne karmaşıklığı için azaltma sırasını uygula
- [ ] Tek seferde yalnızca bir ayar basamağı değiştir
- [ ] Oyuncunun manuel profil sınırlarına saygı göster
- [ ] Son yapılan otomatik değişikliği kayıt altına al
- [ ] Oyuncuya gerekirse sade bildirim göster

### Çıkış kriteri

```text
Oyun uzun süre zorlandığında görsel kaliteyi kontrollü azaltır; performans stabil olduğunda ayarları acele etmeden geri artırabilir.
```

---

## Faz 7 — Sahne ve içerik optimizasyon bağları

### Amaç
Sistemin kalite ayarları ile gerçek oyun içeriğinin birlikte ölçeklenmesini sağlamak.

### Yapılacaklar

- [ ] Tekrar eden prop'larda `InstancedMesh` stratejisi tanımla
- [ ] Statik sahneler için mesh merge / batching sistemi belirle
- [ ] LOD şablonlarını oluştur
- [ ] Uzak nesneler için billboard / impostor yaklaşımını değerlendir
- [ ] Chunk bazlı sahne aktivasyon sistemi oluştur
- [ ] NPC AI için distance-based update sistemi kur
- [ ] Uzak animasyonlar için düşük frekanslı update sistemi kur
- [ ] Fizik gövdeleri için aktif alan sınırı getir
- [ ] Raycast çağrılarını bütçe ve zamanlama sistemine bağla
- [ ] Partikül sistemine yoğunluk çarpanı ekle
- [ ] Spawn sistemlerini frame'lere yay
- [ ] Object pool kullanımını değerlendir
- [ ] Shader warm-up / preload aşaması ekle

### Çıkış kriteri

```text
Kalite profili değiştiğinde sadece post-process değil; NPC, prop, LOD, fizik ve partikül yükü de gerçekten azalır.
```

---

## Faz 8 — Test matrisi ve doğrulama

### Amaç
Sistemin farklı cihazlarda stabil ve anlaşılır davranmasını doğrulamak.

### Yapılacaklar

- [ ] Düşük seviye cihaz test listesi oluştur
- [ ] Orta seviye cihaz test listesi oluştur
- [ ] Yüksek seviye cihaz test listesi oluştur
- [ ] Entegre GPU içeren laptop testleri yap
- [ ] Harici GPU içeren bilgisayar testleri yap
- [ ] Pil modu / priz modu karşılaştırması yap
- [ ] Yüksek DPI / Retina ekran testleri yap
- [ ] Farklı tarayıcı testleri yap
- [ ] En yoğun sahne testlerini yap
- [ ] Çok NPC'li test sahnesi oluştur
- [ ] Yoğun partikül test sahnesi oluştur
- [ ] Gölge ve post-process test sahnesi oluştur
- [ ] Uzun oynanış / bellek sızıntısı testi yap
- [ ] Ayarların sürekli açılıp kapanmadığını doğrula
- [ ] Manuel seçimin korunup korunmadığını doğrula
- [ ] Kalite değişimlerinin oyuncuya görsel olarak rahatsız edici olmadığını kontrol et

### Çıkış kriteri

```text
Farklı cihaz sınıflarında oyun hedef performansa yaklaşır; sistem gereksiz kalite değişiklikleri yapmaz ve manuel tercihleri korur.
```

---

## 15. Öncelik sırası

İlk sürüm için en yüksek değer sağlayacak sıra:

```text
1. Faz 1 — Temel performans ölçümü
2. Faz 2 — Merkezi kalite profilleri
3. Faz 3 — Oyuncu grafik ayarları
4. Faz 6 — Basit adaptif kontrol
5. Faz 5 — Darboğaz sınıflandırma
6. Faz 7 — İçerik sistemlerinin kaliteye bağlanması
7. Faz 4 — Donanım ipuçları ve başlangıç benchmark'ı
8. Faz 8 — Geniş cihaz test matrisi
```

Bu sıra önemlidir. Önce ölçemediğin sistemi otomatikleştirmemelisin. Ardından kalite ayarları merkezi olarak çalışmalı; ancak bundan sonra adaptif sistem güvenilir karar verebilir.

---

## 16. İlk sürüm için sadeleştirilmiş MVP

Forge için ilk uygulanabilir sürüm aşağıdaki kapsamla başlanabilir:

- [ ] Frame time ve P95 ölçümü
- [ ] Draw call / triangle / texture debug overlay'i
- [ ] Ultra / High / Medium / Low profil sistemi
- [ ] Adaptif optimizasyon toggle'ı
- [ ] Manuel profil seçimi
- [ ] `localStorage` ile ayar kaydı
- [ ] 5 saniye uzun süren performans düşüşünde tek adım kalite azaltma
- [ ] 45 saniye stabil performansta tek adım kalite artırma
- [ ] İlk GPU testi olarak render scale karşılaştırması
- [ ] GPU şüphesinde önce SSAO, bloom ve shadow kalite azaltma
- [ ] CPU şüphesinde NPC / AI / partikül bütçesi azaltma

MVP aşamasında kesin GPU/CPU teşhisi yapmak zorunda değilsin. Öncelik, **ölçülebilir, kararlı ve oyuncu kontrolünü koruyan** bir sistem kurmaktır.

---

## 17. Riskler ve dikkat edilmesi gerekenler

### 17.1 Kalite değişimlerinin görsel olarak dikkat çekmesi

Render scale veya gölge çözünürlüğü aniden değişirse oyuncu bunu fark edebilir.

Önlem:

- Değişimleri yükleme ekranında veya sahne geçişinde uygulamayı tercih et
- Zorunlu canlı değişimlerde küçük adımlarla ilerle
- Render scale değişimini nadir kullan
- Önce SSAO, bloom, partikül yoğunluğu gibi daha az dikkat çeken ayarları değiştir

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
- Profiling sonucu en pahalı sistemi hedefle
- Sistem kararlarını içerik optimizasyonu için veri kaynağı olarak kullan

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
- Sistem gerçek sahnede ölçüm yapar.
- Darboğazı tahmin eder.
- En düşük görsel kayıpla en doğru kalite ayarını değiştirir.
- Geliştirici ise debug overlay ve loglarla neden karar verildiğini görebilir.

Bu sistem, Forge’u yalnızca “Three.js ile çalışan oyun üreten bir yapı” olmaktan çıkarıp; farklı cihazlara uyum sağlayabilen, yayınlanabilir ve ölçeklenebilir bir web oyun platformuna yaklaştırır.
