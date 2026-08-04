# ThreeAges RTS Performans ve Kalite Devam Dokümanı

Oluşturulma tarihi: 2026-07-28  
Durum: Uygulama ve ilk ölçüm tamamlandı; maliyet ayrıştırma deneyleri sırada.  
Kapsam: RTS çalışma zamanında grafik kalitesi, takılma (stutter) gözlemi,
tekrarlanabilir Chrome DevTools kaydı ve sonraki optimizasyon kararları.

Bu doküman, performans çalışmasının başka bir oturumda güvenle sürdürülmesi
için otorite kaydıdır. Ölçüm sonucu ile oyuncu donanımındaki gerçek performans
sonucu birbirinden ayrılır: mevcut headless kayıtlar **aynı makinede göreli
karşılaştırma** içindir; oyuncuya dönük GPU sonucu için görünür Chromium ile
tekrar gerekir.

## 1. Başlangıç isteği ve sınırlar

İstenenler:

- Oyunun performansını sistematik biçimde değerlendirmek.
- Chrome DevTools Performance kaydıyla takılmaları yakalayan, tekrarlanabilir
  ve rapor üreten bir araç sağlamak.
- Forge Editor'daki Low / Medium / High ve otomatik kalite mekanizmasının RTS'de
  kullanılabilirliğini değerlendirmek ve entegre etmek.
- Kullanılmayan starter/development dokuların proje tamamlanınca kaldırılacağını
  kabul etmek; bu geçici asset envanterini ilk darboğazın tek açıklaması saymamak.

Alınan ürün kararları:

- İlk iş shader warm-up/derleme yarışını güvenli hale getirmek, ardından küçük
  fakat gerçek RTS kalite adaptörünü eklemek oldu.
- LOD şu aşamada kapsam dışıdır. Modeller zaten düşük poligonlu kabul ediliyor;
  sonraki karar veriyle desteklenene kadar LOD sistemi eklenmeyecek.
- Önce maliyeti kalite bileşenlerine ayıran A/B ölçüm yapılacak. Kalıcı görsel
  indirim, yalnızca bu deneyin sonucunda uygulanacak.

## 2. Teslim edilmiş sistemler

### 2.1 RTS grafik kalitesi ve adaptif ayar

`RtsApp`, Forge'un paylaşılan kalite altyapısını kullanır:

- `FrameMetricsMonitor`: render edilen karelerin zaman serisini toplar;
  oyun simülasyonunu değiştirmez.
- `AdaptiveQualityController`: yerleşik kare-zamanı trendinden geri alınabilir
  kalite basamakları uygular.
- `QUALITY_PROFILES`: Low, Medium, High (ve motor seviyesinde Ultra/Custom)
  ayarlarını çözer.
- Kullanıcı tercihi `forge.userSettings` içinde saklanır. Seçilen profil,
  hedef FPS, adaptif ayarın açık olup olmadığı ve manuel seçim bilgisi oturumlar
  arasında korunur.

RTS duraklatma katmanında Low / Medium / High seçimi ve Adaptive aç-kapa akışı
vardır. Etkili ayarlar render ölçeği, piksel oranı, gölge, gölge haritası,
post-process geçitleri (AO, DoF, bloom, SMAA), parçacık ve foliage mesafesine
uygulanır. Adaptif sistem yalnızca maç aktifken ve kullanıcı izin verdiyse
çalışır; oyuncunun kalıcı tercihini geçersiz kılmaz.

İlgili kod:

| Yol | Sorumluluk |
| --- | --- |
| `engine/perf/qualityProfiles.ts` | Saf kalite profil tanımları ve çözümleme |
| `engine/perf/frameMetrics.ts` | Kare-zamanı ölçümü |
| `engine/perf/adaptiveQuality.ts` | Geçici, geri alınabilir adaptif basamaklar |
| `src/game/rts/RtsApp.ts` | RTS uygulaması, tercih saklama, renderer/post-process uygulaması |

### 2.2 Tekrarlanabilir RTS performans matrisi

`npm run perf:rts`, aynı RTS maçı için Low, Medium, High ve Adaptive satırlarını
çalıştırır. Her satır:

1. Yeni bir browser context açar; önceki satırın ayarını devralmaz.
2. İlgili grafik tercihini `forge.userSettings` içine sayfa yüklenmeden yazar.
3. Canvas, seçilen kalite, harita sanatı ve actor asset'lerinin hazır olmasını
   bekler. Böylece asset/GLTF parse anı ile steady-state sahne karıştırılmaz.
4. Maçı başlatır, warm-up süresini bekler.
5. Sabit WASD kamera kaydırma ve mouse-wheel zoom senaryosunu uygular.
6. rAF frame pacing, Chrome ana iş parçacığı sayaçları, RTS render telemetrisi
   ve bir Chrome trace'i kaydeder.

Çıktılar `test-results/rts-perf/` altında üretilir:

- `*.md`: kısa karşılaştırma tablosu.
- `*.json`: hamlaştırılmış ölçüm, snapshot ve hata bilgisi.
- `*-<profile>.trace.json`: Chrome DevTools Performance panelinde açılabilen
  iz kaydı.

İlgili kod ve komut:

| Yol / komut | Sorumluluk |
| --- | --- |
| `tools/rts-perf-report.mjs` | Vite başlatma, Playwright senaryosu, CDP trace ve raporlama |
| `npm run perf:rts` | Varsayılan 10 sn warm-up + 10 sn ölçüm matrisi |
| `README.md` "RTS quality matrix" | Güncel kullanım özeti |

Örnekler:

```powershell
# Tam matris
npm.cmd run perf:rts

# Hızlı, karşılaştırmalı yerel kontrol
$env:RTS_PERF_DURATION_MS = "5000"
npm.cmd run perf:rts

# Sadece bir profil veya adaptif davranış
$env:RTS_PERF_PROFILES = "adaptive"
npm.cmd run perf:rts

# Süre sınırı olan CI kapısı
$env:RTS_PERF_MAX_P95_MS = "33.3"
npm.cmd run perf:rts

# Oyuncu GPU'su için görünür Chromium
$env:RTS_PERF_HEADLESS = "false"
npm.cmd run perf:rts
```

Ek değişkenler:

| Değişken | Varsayılan | Etki |
| --- | ---: | --- |
| `RTS_PERF_DURATION_MS` | 10000 | Her profilin ölçüm süresi (ms) |
| `RTS_PERF_WARMUP_MS` | 5000 | Asset/derleme sonrası ısınma (ms) |
| `RTS_PERF_PROFILES` | `low,medium,high,adaptive` | Virgülle ayrılmış profil listesi |
| `RTS_PERF_MAX_P95_MS` | yok | Aşılırsa işlem başarısız olur |
| `RTS_PERF_HEADLESS` | `true` | `false` görünür Chromium açar |
| `RTS_PERF_URL` | yerel Vite `:4174/?rts&debug` | Var olan sunucuyu hedeflemek için URL |

### 2.3 RTS debug telemetrisi

Sadece `?rts&debug` rotasında canvas'ın `data-rts-perf` niteliğine yarım saniye
aralıklarla JSON snapshot yazılır. Rapor aracı bunu toplar; bu yüzden telemetri
sıcak render döngüsüne pahalı bir ölçüm eklemez.

Snapshot içeriği:

- Pencere içi ortalama/P95 kare süresi, örnek sayısı ve 33/50/100 ms spike sayıları.
- Draw call, üçgen sayısı; renderer geometry/texture/program bellek envanteri.
- Seçili kalite, adaptif ayarın durumu ve aktif azaltma derinliği.
- Gölge caster envanteri: `actors`, `mapArt`, `other`; her biri için mesh ve
  üçgen sayısı.

Harita ve actor asset hazır sinyalleri de ölçüm aracında kullanılır:

- `data-rts-map-art=loading|ready|fallback`
- `data-rts-content-assets=ready`

## 3. Uygulanan, hedefli render değişiklikleri

Bu değişiklikler LOD veya gameplay davranışını değiştirmez:

1. Orman ağaçları directional shadow caster değildir; yine de gölge alır,
   görünürlük/fog ve hasat davranışı aynı kalır. Kaynak yatakları ile ridge
   gölge cast etmeye devam eder.
2. Çok sayıda animasyonlu `SkinnedMesh` unit gölge cast etmez; statik bina
   meshleri stratejik okunurluk için caster kalır. Unitler gölge almaya devam
   eder.
3. Debug snapshot ile gölge maliyeti tahmine değil mesh/üçgen envanterine göre
   görülebilir.

İlgili dosyalar:

| Yol | Değişiklik |
| --- | --- |
| `src/game/rts/world/rtsMapArt.ts` | Forest model çağrısında `castShadow=false` |
| `src/game/rts/content/rtsActorPresentationTree.ts` | `SkinnedMesh` için `castShadow=false` |
| `src/game/rts/RtsApp.ts` | Hazır sinyalleri ve debug performans/gölge snapshot'ı |

Not: Kamera göreli güneş gölge frustum'u üzerine bir deneme yapıldı; ölçülebilir
kazanç vermediği için tamamen geri alındı. Bu yaklaşım mevcut çözümün parçası
değildir.

### 3.1 AI hareket ve yerel lojistik sadeleştirmesi (2026-08-04)

Hareketli AI sayısını ve yakınlık sorgularını azaltan ilk oyun-kuralı dilimi uygulandı:

1. Yabani hayvanlar artık oyuncu veya ordu birimlerinden kaçmak için her simülasyon adımında bütün birimleri taramaz. Yalnızca vahşi bir kurt 3 m yakınlık çemberine girdiğinde ilgili av hayvanına tek bir kaçış olayı yayınlanır. Kurt avlama/öldürme davranışı korunur; insan yakınlığı hayvan hareketini değiştirmez.
2. Üretici ile aynı sahibin merkezinin veya Merkeze bağlı, işgal edilmemiş Deposunun bina-kenarı mesafesi otomatik yol erişim mesafesi içindeyse (`roads.json`: 6 hücre x 2 m = 12 m), üretici `direct` aktarım işaretini alır. Yerel tampon, global stok kapasitesine doğrudan aktarılır; dolu stokta tamponda kalır. Bu hat eşek, road BFS veya kervan state-machine oluşturmaz.
3. Eşik dışındaki üreticiler mevcut kuralı korur: manuel yolun Merkez/bağlı Depo ağına ulaşması gerekir ve yalnız o zaman kervan çıkar.

Panelde yerel yapılar `Lojistik: Yerel aktarım` ve `Yerel aktarım: Merkez/Depoya doğrudan gidiyor` olarak okunur. Bu, oyuncunun "merkezin yanı yerel, uzak alan yol ister" zihinsel modelini korur.

Kanıt:

- `test:engine` insan yakınlığının hayvan rotasını değiştirmemesini, kurt yakınlığının kaçışı başlatmasını ve yakın üreticinin yolsuz-kervansız aktarımını kapsar.
- `npx.cmd tsc --noEmit` ve `npm.cmd run build:verify` geçti; build doğrulaması 1305 engine kontrolü ve strict dist denetimini içerdi.
- Tarayıcı doğrulaması: `rts-building-placement.spec.ts` bu oturumda 124 sn süre sınırına ulaştı; bu nedenle panel metni ve canlı maç kabulü açık kalır.

## 4. İlk ölçüm kaydı

Kaynak rapor: `test-results/rts-perf/rts-perf-2026-07-28T12-45-43-721Z.md`  
Koşul: headless Chromium, 1920x1080, 5 sn warm-up, profil başına 5 sn sabit
WASD + wheel senaryosu.

| Profil | Tahmini FPS | P95 ms | >50 ms kare | Draw call | Üçgen | Texture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Low | 7.2 | 233.4 | 32 | 23 | 6,524 | 33 |
| Medium | 3.5 | 316.7 | 18 | 305 | 256,380 | 35 |
| High | 2.8 | 366.8 | 14 | 288 | 252,495 | 35 |

Chrome ana iş parçacığı sayaçları sırasıyla yaklaşık 1885, 2269 ve 2740 ms/s
task süresi raporladı. Bu değerler browser'ın headless geliştirme ortamındaki
zayıf mutlak performansını da içerir; buradan "oyuncu FPS'i budur" sonucu
çıkarılmaz.

Yine de göreli işaret güçlüdür:

- Low ile Medium/High arasındaki draw call ve triangle sıçraması büyüktür.
- Texture sayısı neredeyse sabittir (33 -> 35); ilk odak texture sayısı değil,
  render çözünürlüğü, post-process, gölge ve sahne çizim maliyetidir.
- Gölge envanteri, actor caster'larının önceki yaklaşık 358,888 üçgenlik
  yükünden son snapshot'larda yaklaşık 1,544--5,632 üçgene indiğini doğruladı.
  Toplam P95 headless ortamda yine yüksek kaldı; bu nedenle daha geniş bir
  bileşeni kapatmadan önce maliyet ayrıştırması gereklidir.

## 5. Ölçüm ve yorumlama kuralları

- Karşılaştırılan raporlarda browser sürümü, viewport, URL/map, senaryo,
  warm-up ve ölçüm süresi aynı tutulur.
- İlk yükleme/shader compile araştırılırken warm-up özellikle azaltılır veya
  ayrı bir "cold start" senaryosu eklenir. Steady-state profilde mevcut hazır
  sinyallerinden sonra warm-up kullanılır.
- Bir trace, Chrome DevTools > Performance > Load profile ile açılır. Uzun
  `Task`, `Function Call`, `Layout`, `GC`, WebGL/renderer çağrıları ve frame
  boşlukları aynı zaman aralığında incelenir.
- Headless rapor CI regresyon işaretidir; oyuncuya önerilecek grafik profili
  için en az bir görünür (`RTS_PERF_HEADLESS=false`) referans cihazda kayıt alınır.
- Adaptif satır yapay yük üretmez. Gerçek, sürekli baskı varsa reduction depth
  değişir; değişmiyorsa bu başarısızlık değildir.

## 6. Sıradaki iş: LOD yerine kalite maliyetini A/B ayrıştırma

Amaç, Medium/High maliyetinin hangi parçasının baskın olduğunu ölçmek; görsel
kaliteyi körlemesine azaltmamak. Bir sonraki geliştirme, `perf:rts` aracına
high tabanlı custom kalite varyantlarını eklemektir. `custom` profilinin varsayılan
tabanı Medium olduğundan, deney satırları High'ın tüm ayarlarını açıkça temel
alıp yalnızca incelenen alanı değiştirmelidir.

Önerilen deney matrisi:

| Satır | High'a göre tek fark | Cevapladığı soru |
| --- | --- | --- |
| `high` | Baz çizgi | Karşılaştırma referansı |
| `high-no-shadows` | `shadowsEnabled=false` | Gölge haritası/çizimi baskın mı? |
| `high-no-post` | AO, DoF, bloom, SMAA kapalı | Post-process bütçesi ne kadar? |
| `high-render-085` | Render ölçeği 0.85 | İç çözünürlük/GPU fill-rate baskın mı? |
| `medium` | Ürün profili | High varyantları oyuncu profiline ne kadar yaklaştırıyor? |

Uygulama kabulü:

- Her varyant ayrı browser context'te çalışır ve aynı hazır sinyallerini bekler.
- JSON/Markdown satırı varyantın tam etkin ayarlarını taşır; sonuç sonradan
  yeniden yorumlanabilir.
- High satırıyla aynı ölçüm koşullarında P95, draw call/üçgen, Chrome task ve
  varsa GPU-visible telemetry karşılaştırılır.
- Anlamlı iyileşme gösteren tek bileşen, görünür browser'da yeniden doğrulanır.

Karar rehberi:

| Bulgular | Sonraki olası karar |
| --- | --- |
| `high-render-085` açık ara iyiyse | Adaptif sistemin önce render scale basamağını kullanması; High profilinin ölçeğini yeniden değerlendirme |
| `high-no-post` anlamlı iyiyse | Bloom/SMAA çözünürlüğü veya geçitlerini profile göre düzenleme |
| `high-no-shadows` anlamlı iyiyse | Shadow map boyutu/mesafesi, caster sayısı ve cascade kapsamı üzerinde ikinci tur çalışma |
| Hiçbiri anlamlı değil, task/script yüksekse | Trace üzerinden JS/simülasyon/hot-path analizi; render ayarı azaltmak çözüm değildir |
| Draw call baskınsa | Static batching/instancing, görünürlük culling ve render-group düzeni araştırılır; LOD otomatik varsayılmaz |

## 7. Doğrulama geçmişi

Bu çalışma sırasında daha önce başarıyla çalıştırılan kontroller:

```powershell
npx.cmd tsc --noEmit
npm.cmd run test:engine
npm.cmd run build:verify
npx.cmd playwright test tests/smoke/rts-graphics-quality.spec.ts
```

`build:verify` TypeScript, import denetimi, Vite build, engine testleri ve dist
denetimini kapsar. Render/kalite kodu değiştiğinde bu kapılar ile ilgili
Playwright smoke tekrar çalıştırılmalıdır. `git diff --check` de teslimden önce
temiz olmalıdır.

## 8. Sonraki oturum için kısa başlangıç

1. Çalışma ağacında kullanıcının başka değişiklikleri olabilir; yalnızca
   performansla ilgili dosyalara dokun ve ilgisiz değişiklikleri geri alma.
2. `engine/perf/qualityProfiles.ts` içindeki `resolveQualitySettings`in Custom
   profilini varsayılan olarak Medium tabanlı çözdüğünü dikkate al.
3. `tools/rts-perf-report.mjs` içine Bölüm 6'daki A/B varyantlarını ekle.
4. Önce kısa (5 sn) headless koşuyla varyantların doğru uygulandığını kontrol et.
5. En umut verici sonucu görünür Chromium ve daha uzun sabit senaryoda doğrula.
6. Sonuçları bu dokümanın Bölüm 4'üne tarih/senaryo ile ekle; kalıcı profil
   değişikliğini ancak o zaman uygula.

## 9. Kapsam dışı / daha sonra

- LOD: mevcut karar gereği şu an planlanmıyor.
- Starter/development asset temizliği: yayın öncesi ayrı envanter/temizlik işi;
  ölçüm aracının hazır olma beklemesini bozmayacak şekilde ele alınmalı.
- Gerçek cihaz matrisi: düşük/orta/yüksek sınıf GPU'larda görünür browser
  kayıtları, oyuncuya dönük varsayılan kalite profili kararı öncesinde gerekli.
- Cold-start shader warm-up raporu: steady-state raporundan ayrı tutulmalı;
  asset yükleme ve shader compile davranışını karıştırmamalı.
