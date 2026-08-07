# ThreeAges RTS Kare Maliyeti — Bulgular ve Devam Notları

Oluşturulma tarihi: 2026-08-07
Son güncelleme: 2026-08-07 (ikinci oturum)
Durum: **CPU tarafı çözüldü. GPU tarafı da çözüldü — §8.** Sebep, kimsenin
göremediği bir planar su yansımasıydı: karenin yarısı. §1-§7 birinci oturumun
kaydıdır ve bir kısmı §8 tarafından geçersiz kılınmıştır; hangi bölümün
geçersiz olduğu kendi başlığında yazar.
Kapsam: `?debug` kare maliyeti tablosundan yola çıkan darboğaz avı; lojistik
memoizasyonu (teslim edildi), arazi/GPU araştırması (ikinci oturumda çözüldü).

Bu doküman iki şey için var: teslim edilen işin ne olduğunu kaydetmek, ve
**aynı çıkmazlara tekrar girilmesini önlemek.** İkinci kısım daha uzun, çünkü bu
oturumda dört kez sebep tahmin edildi ve üçünde yanılındı. Ölçüm tuzakları
(§4) bu dokümanın en değerli bölümüdür; GPU tarafına dönmeden önce okuyun.

---

## 1. Başlangıç tablosu

`&debug` → kare maliyeti, 1X, maç 384.4 sn:

```text
kare 49.20 ms (ort 51.35)
çizim              17.00  34.6%
lojistik           13.70  27.8%
hud eşitleme       10.90  22.2%
tanı *              5.60  11.4%
diğer her şey      ~2.0
```

`tanı` yalnızca debug rotasında var, yani oyun sürümünde kare ~43.6 ms ≈ 23 fps.
Simülasyonun "asıl" işi (ai, savaş, hareket, üretim, görüş, mermiler) toplamda
**1 ms'nin altındaydı.** Yani bu hiçbir zaman bir simülasyon ölçek sorunu
değildi.

---

## 2. Teslim edilen: yol grafiği ve lojistik memoizasyonu

`lojistik` ve `hud eşitleme` birlikte karenin %56'sıydı ve **kökleri tek bir
hataydı**: yol topolojisi her tick'te sıfırdan, üstelik onlarca kez yeniden
hesaplanıyordu.

### 2.1 Bulunan fan-out

Tek bir `ProductionLogisticsSystem.snapshots()` çağrısının içinde:

| yer | ne yapıyordu |
| --- | --- |
| `productionLogisticsSystem.ts:48` | `roads.components()` — tüm ağın flood-fill'i |
| `:51` | `depots.mainComponentIds()` → `components()` **tekrar** |
| `:52` | `localEndpoints()` → `depots.snapshots()` → `components()` ×2 |
| `:71` (üretici başına) | `endpointsFor()` → `depots.snapshots()` → `components()` ×2 + aday başına `roads.route()` BFS |
| `:80` (üretici başına) | `depots.snapshots()` → `components()` ×2 |

P üretici ile çağrı başına **~4 + 4P tam flood-fill**. Ve `snapshots()` tick
başına en az **altı kez** çağrılıyordu: kervan şeritleri, transferler,
`syncEconomyUi`, `syncNotifications`, seçim paneli, witness.

Üstüne `components()` kendisi kuadratikti: `[...unvisited].sort()[0]` her bileşen
için kalan tüm anahtar kümesini kopyalayıp sıralıyordu.

### 2.2 Yapılan

- **`RoadGraph.components()`** — `revision` anahtarlı memo. Ayrıca tohumlar bir
  kez sıralanan anahtar listesinden alınıyor (bileşen id sırası birebir korundu).
- **`RoadGraph.route()`** — `(from,to)` + `revision` anahtarlı memo; topoloji
  değişince komple boşalır. Dönen dizi artık paylaşılıyor — hiçbir çağıran onu
  mutasyona uğratmıyor (`readonly RoadCell[]`; `caravanSystem.ts:165` bile yeni
  dizi kurar). **Bu değişmezliği bozmayın.**
- **`DepotLogisticsSystem`** — `snapshots` / `mainComponentIds` / `componentIds` /
  `endpointsFor` tek memo yuvasında. Anahtar: `roads.version +
  structures.completedVersion + centers.version`. (Bu sistem territory ve
  occupation'a bağlı **değil**; bilerek anahtarda yoklar.)
- **`ProductionLogisticsSystem.snapshots()`** — memoize edildi, gövde
  `computeSnapshots()`'a ayrıldı, iki döngü-değişmezi üretici döngüsünden çıktı
  (`endpointsFor(owner)` sahip başına bir kez; `depots.snapshots()` çağrı başına
  bir kez). Anahtar **beş** girdiyi de kapsar: yol, tamamlanmış yapı kümesi,
  merkezler, işgal, territory.

### 2.3 Eklenen sayaçlar (memo anahtarları için)

- `TerritoryControlSystem.version` — `refresh()`'te artar; ownership grid'inin
  tek yazarı odur, yani tam bir bayatlık anahtarı.
- `LogisticsOccupationSystem.version` — yalnızca `isUsable`'ın cevabını
  değiştirebilecek gerçek değişimde artar.
- `PlacedStructureSystem.completedVersion` — **neden ayrı bir sayaç:** mevcut
  `version` yalnızca üyelik değişimini (place/cancel/destroy/clear) sayar,
  inşaatın *tamamlanmasını* saymaz. Ama bir şantiyenin bitmesi tam olarak onu
  üretici veya depo yapan şeydir. `advanceConstruction`'da `justCompleted`
  üzerinde artar.

### 2.4 Yan düzeltmeler

`LogisticsOccupationSystem.sync()`: hiç işgal yokken `depots.snapshots()`
çağırmadan çıkıyor (yaygın durumda her tick bedava), ve `Map.keys()` üzerinde
iterasyon sırasında silme hatası düzeltildi (anahtarlar artık kopyalanıyor).

### 2.5 Ölçülen sonuç

| | önce | sonra |
| --- | --- | --- |
| lojistik | 13.70 (ort 13.82) | **1.50** (ort 1.34) |
| hud eşitleme | 10.90 (ort 11.39) | **1.00** (ort 1.10) |
| tanı | 5.60 | **1.00** |

`tanı` da düştü çünkü witness aynı snapshot'ları çağırıyordu.

**Bağımsız doğrulama:** `npm run test:engine:slow` süresi ~161 sn'den ~49 sn'ye
indi. Aynı komut, aynı 1300+ kontrol — fark yalnızca hızlandırılmış maç AI
kontrollerinin daha az yol taraması yapması. Headless simülasyonda ölçülebilir
3.5× fark.

---

## 3. Teslim edilen: `graf` debug satırı

`?debug` panelinde `çizim` satırının altında:

```text
çizim 535 çağrı · 1.81M üçgen
graf 5,622 düğüm · 923 mesh (geçiş başına gezilir)
```

`RtsApp.sceneGraphStats()`, mevcut snapshot kadansında (her kare değil — yoksa
açıklamaya çalıştığı maliyetin üstüne bir gezinme eklerdi). `traverse` değil
**`traverseVisible`**: three.js görünmez bir alt ağacı komple atlar, dolayısıyla
gizli dal karenin ödediği şeyin parçası değildir.

Sayı `canvas.dataset.rtsPerf`'e de yazılır.

**Nasıl okunur:** düğüm sayısı büyük + çizim çağrısı küçük → kare
*gönderilmiyor, geziliyor* (instancing draw call'u birleştirir, traversal'ı
birleştirmez; gölge veren ışık grafı ikinci kez yürür). Düğüm sayısı da küçükse
maliyet başka yerdedir.

---

## 4. ÖLÇÜM TUZAKLARI — GPU tarafına dönmeden önce oku

Bu oturumda GPU tarafında dört hipotez denendi, üçü çöktü. Çökme sebepleri
hipotezlerin kendisinden daha öğreticiydi.

### 4.1 `arazi/harita` sweep kovası "arazi" demek DEĞİL

**ÇÖZÜLDÜ (§8.2).** Kova bölündü; içindeki sakin nehir suyunun planar
yansımasıydı. Aşağısı bu maddenin neden doğru teşhis edildiğini kaydeder.

**En önemli madde.** `src/game/rts/RtsApp.ts:2389` civarındaki GPU sweep adımı:

```ts
{ id: "arazi/harita", apply: hide([this.groundGroup, this.authoredWorld?.root]) }
```

`authoredWorld.root` **authored Level'ın tamamıdır**: arazi mesh'i, boyanmış
bitki örtüsü, statik harita sanatı, nehir suyu, çevre. Hepsi tek satırda.

Bu yüzden "arazi GPU'nun %77'si" cümlesi hiçbir zaman doğru olmadı. Arazi
mesh'inin kendisi o 11-13 ms'nin yalnızca **~2 ms**'si (§4.3'teki deney).
Oturum boyunca arazi shader'ı kovalandı; ölçülen kova araziden çok daha genişti,
ve shader kaldıraçlarının neden hiçbir şey getirmediği de bu.

**İlk iş bu kovayı bölmektir**: arazi mesh'i / bitki örtüsü / nehir suyu / harita
sanatı ayrı satırlar. Bölmeden yapılacak her optimizasyon körlemesine olur.

### 4.2 Kamera pozisyonu her şeyi değiştirir

Aynı arazi, aynı shader, iki farklı yakalama: 1. dakikada 8.52 ms, 10. dakikada
13.07 ms. Fark büyük ölçüde kameraydı — tam ekranı kaplayan bir yüzeyde maliyet
doğrudan kameranın ne kadar zemin gösterdiğine bağlıdır.

**Protokol:** GPU taramalarını sabit kameradan alın. Tercihen tek oturumda,
hiçbir şeye dokunmadan önce/sonra. Bu oturumdaki kare toplamları (49.20 / 34.10 /
21.70 / 15.20) farklı kamera ve maç dakikalarından geldiği için **birbiriyle
karşılaştırılamaz.** Buna karşılık `lojistik` ve `hud eşitleme` sayıları
güvenilirdir: CPU tarafı, kameradan bağımsız.

### 4.3 Elenen hipotezler (hepsi ölçüldü)

| hipotez | deney | sonuç |
| --- | --- | --- |
| Sahne grafı traversal'ı | `graf` sayımı + gölgeleri kapatma | 5.622 düğüm / 923 mesh; gölge kapatmak `çizim`i hiç değiştirmedi → **elendi** |
| Anizotropi (16 → 4) | Arazi katman dokularına tavan | GPU 18.25 → 17.23; arazi 13.61 → 13.29 → **elendi** |
| Doku örnek sayısı + normal/TBN yolu | `pbrEnabled = false` (4 normal örneği + türev TBN + normal harmanı kalkar) | arazi 13.29 → 13.07 → **elendi** |
| Piksel başına aydınlatma | Arazi `MeshBasicMaterial` (ışık yok, gölge yok, doku yok) | arazi 13.07 → 11.18 → **elendi** |

Son satır kesin: **arazinin fragment shader'ı maliyet değil.** Tüm gölgelendirme
işini kaldırmak ~2 ms getirdi. Anizotropi ve PBR kaldıraçlarını tekrar denemeyin.

### 4.4 Geri çekilen sonuç: "fill-rate bound"

Bir ara "oyun fill-rate bound, kaldıraç `renderScale` / `maxPixelRatio`" sonucuna
varıldı. **Bu yanlıştı ve geri çekildi.**

Sebep bir yanlış anlamaydı: kullanıcı "landscape resolution'ı high'dan medium'a
çektim" dediğinde bu, oyunun grafik kalite profili (`QUALITY_PROFILES.high` →
`medium`) sanıldı. Aslında **Details panelindeki Landscape Size → Resolution**
ayarıydı, yani Landscape actor'ünün mesh preset'i:

```text
small: 65×65 · medium: 129×129 · large: 257×257   (engine/scene/landscape.ts:80)
```

Yani `large` (257², ~132k üçgen, 64 chunk) → `medium` (129², ~33k üçgen, 16
chunk). Piksel sayısı hiç değişmedi. Kalite profiline dayanan tüm çıkarımlar
geçersizdir.

**Şu an kanıt neyi destekliyor:** arazi maliyeti mesh çözünürlüğüyle ölçekleniyor,
fragment işiyle değil (§4.3 ile de tutarlı). Ama bu **temiz biçimde
ölçülmedi** — §4.1 ve §4.2 geçerliyken ölçülemezdi de. Beşinci bir hipotez
üretmeden önce kovayı bölün ve sabit kameradan ölçün.

**İkinci oturum eki — fill-rate artık ölçüldü.** Pencere alanı yarıya indirildi
(2.05M → 1.03M piksel, `oran 1.00`, yani gizli HiDPI çarpanı yok): GPU tabanı
16.89 → 13.99 ms, yani **−%17**. Piksel başına maliyet en fazla ~2.8 ms/Mpiksel;
tam pencerede karenin en çok üçte biri fill'dir. Gerçek ama ikincil — `renderScale`
düşürmek birkaç ms alır, görüntüyü bozar ve asıl sebebi (§8) yerinde bırakır.
Hipotez ölü değil, rütbesi düştü.

### 4.5 `çizim` satırı ne ölçüyor

`çizim`, `renderer.render()` etrafındaki duvar süresidir — GPU'nun çizme süresi
değil, CPU'nun kareyi gönderme süresi. Her yakalamada GPU tabanını yakından
takip etti (17.00/13.43 · 25.00/18.25 · 16.30/17.23). 535 çizim çağrısı için
25 ms, çağrı başına ~47 µs demektir ki three.js'te imkânsız (normal 2-5 µs).

Yani `çizim`in mutlak değeri bir iş kalemi değil, **GPU'yu bekleme payıdır.**
Doğrudan optimize etmeye çalışmayın; kalan boşluğu her zaman yutar. GPU tabanı
düşerse o da düşer.

`?debug` GPU zamanlayıcısı şüpheli olarak elendi: `gpuTimer` sonuçları
`QUERY_RESULT_AVAILABLE` ile kontrol ediyor ve poll `çizim` bölgesinin dışında
(`collectGpuSamples`), yani bloklama yok.

---

## 5. Bulunan repo kusuru (düzeltildi)

Geçici ölçüm satırı `const pbrEnabled = false` — arazi PBR yolunu kapatmak için
konulmuştu — **`fe400a90` commit'ine sızdı.** Ajan onu Edit ile geri almıştı ama
kullanıcı o pencerede commit aldı ve commit revert'ten önceki hali yakaladı.
HEAD bir süre arazinin normal/ORM yolunu kapalı taşıdı. Çalışma ağacında
onarıldı.

**Ders:** geçici ölçüm düzenlemeleri bir kullanıcı commit'i ile kesişebilir.
Ya ölçüm bitene kadar commit alınmamalı, ya da geçici düzenleme koymadan önce
bu risk açıkça söylenmeli. Ayrıca: geri alma için `git checkout <dosya>`
kullanmayın — commit edilmemiş her şeyi atar; hedefli Edit kullanın.

---

## 6. Kararlar

- **Landscape `medium` (129×129) kalıyor.** Performanstan bağımsız gerekçe:
  140 birimlik dünyada vertex başına 1.09 birim. `large` 0.55 birim yapardı —
  RTS kamerasının çözemeyeceği bir incelik. Bu bir taviz değil, o harita için
  doğru yazım çözünürlüğü.
- **Anizotropi tavanı geri alındı.** Ölçülebilir kazanç getirmedi ve yanlış bir
  teşhise dayanıyordu. `LANDSCAPE_MAX_ANISOTROPY` / `landscapeLayerAnisotropy`
  ve ilgili engine kontrolü kaldırıldı.
- **LOD ve chunk culling şu an kapsam dışı.** Arazi gerçekten daha ince detay
  isterse doğru iş odur — shader değil. Ama önce §4.1.

---

## 7. Bir sonraki oturum için sıra — TAMAMLANDI

1. ~~**Sweep kovasını böl**~~ — yapıldı (§8.3). Dört satır da eklendi.
2. ~~**Sabit kamera protokolüyle yeniden ölç.**~~ — yapıldı.
3. ~~Baş şüpheli **alfa harmanlı bitki örtüsü overdraw'ı**~~ — **yanlıştı.**
   Ölçüldü: 0.62-0.74 ms. Doküman kendi konusuna sadık kaldı; bu beşinci
   tahmindi ve o da tutmadı. Gerçek sebep §8.

---

## 8. ÇÖZÜM — kimsenin görmediği su yansıması

### 8.1 Ölçüm

Level'ın tek `riverWaters` aktörü `reflectionMode: sharedPlanar`,
`reflectionQuality: high` ile yazılmıştı. Kapatınca, **daha fazla içerikle**:

| | yansıma açık | yansıma kapalı |
| --- | --- | --- |
| GPU taban (sweep) | 13.99 ms | **6.65 ms** (−52%) |
| `çizim` ort | 16.90 ms | **8.17 ms** (−52%) |
| kare ort | 21.55 ms | **13.39 ms** (−38%) |
| draw call | 590 | 703 (*daha çok*) |
| üçgen | 1.68M | 2.06M (*daha çok*) |

### 8.2 Neden hiçbir deney onu bulamadı

`PlanarReflectionSource` (`engine/render-three/planarReflectionSource.ts`)
`high`'da 512×512, MSAA ×2, half-float bir hedefe **tüm sahneyi aynalanmış bir
kameradan baştan render eder**, ve tek kapısı `minUpdateMs: 4` — yani pratikte
her kare. Bunun üç sonucu, bu dokümandaki her başarısız deneyi açıklar:

- Maliyeti **geçiş ve draw call başınadır, üçgen başına değil** → 1.13M üçgen
  (sahnenin %54'ü) silmek 0.24 ms getirdi.
- Hedef boyutu **construction'da sabitlenir** → pencereyi yarılamak (2.05M →
  1.03M piksel) GPU'nun yalnızca %17'sini aldı; fill-rate hipotezi böyle
  ölçülüp rütbesi düştü (bkz. §4.4: en fazla ~2.8 ms/Mpiksel).
- Şeridin **kendi çiziminden** tetiklenir ve şerit `authoredWorld.root`
  altındadır → `arazi/harita` kovasının içinde ama landscape / bitki örtüsü /
  harita sanatı satırlarının hiçbirinde değil. Kova ile alt satırlarının toplamı
  arasındaki o inatçı ~7-10 ms boşluk buydu.

**Ve görünmüyordu.** Editörde görünen yansıma oyun modunda görünmüyordu; kamera
ya nehre bakmıyordu ya da ufak bir dilimini görüyordu. Uzun bir spline şeridinin
sınır kutusu büyük olduğu için frustum'da sayılıyor ve tam sahne render'ını yine
tetikliyor.

### 8.3 Bu oturumda inşa edilen araçlar

- **GPU taraması artık köşeli.** Taban bir kez değil, **her adımın iki yanında**
  ölçülür; satır kendi çiftinin ortasıyla karşılaştırılır. Sebebi: duraklatılmış
  ucuz bir sahne GPU'yu düşük güç durumuna sokuyor, tek tabanlı tarama sonraki
  adımları 3 kat yavaş okuyor ve tablo "içeriği kapatmak 7 ms *ekledi*" diyordu.
  Sürücünün disjoint bayrağı bunu görmez — her süre gerçekten bir süredir,
  sadece yavaşlamış bir GPU'nun. Kendi kazancı kadar oynayan satır artık
  `belirsiz` basılır, tur sürüklenmesi meta satırında raporlanır.
- **Dört alt satır:** `↳ arazi (landscape)`, `↳ bitki örtüsü`,
  `↳ harita sanatı`, `↳ nehir suyu`. (§7.1'in istediği bölme.)
- **`çözünürlük W×H · oran R · N piksel`** satırı overlay'de. Piksel başına
  maliyet sorusunu tahminden çıkarır.

### 8.4 Yeni ölçüm tuzakları

- **Canlı CPU sayısını taramanın *duraklatılmış* tabanıyla kıyaslamayın.** Bu
  oturumda tam bir tur boyunca "CPU-bound'sun" sonucuna bu hatadan varıldı;
  §4.5 baştan doğruydu. İki canlı sayı yan yana konduğunda `çizim` her zaman
  GPU'yu yakından takip etti.
- **İç içe `renderer.render()`, `info.autoReset` yüzünden sayaçları karenin
  ortasında sıfırlar.** Yansıma açıkken okunan `çizim N çağrı · M üçgen`
  değerleri eksiktir. Taramanın GPU süreleri etkilenmez.

### 8.5 Motor kusuru — kapatıldı

`PlanarReflectionSource.update()`'in tek koşulu `minUpdateMs` idi: ekran
kaplaması, mesafe, frustum sorulmuyordu. Frustum culling tek başına yetmez —
nehir şeridi uzun bir spline izler, sınır kutusu suyun kendisi çözülemez hale
geldikten çok sonra da ekranda kalır.

Eklenen kapı (`engine/render-three/planarReflectionSource.ts`):

- `planarReflectionScreenCoverage(bounds, viewProjection)` — saf fonksiyon,
  tüketicilerin ekrana düşen payını `[-1,1]` küpüne kırparak döner. Projeksiyonun
  eksene hizalı sınırı eğri bir gövdeyi olduğundan büyük gösterir; bu **bilerek**
  öyle.
- Bir köşe gözün arkasındaysa `null` döner ve çağıran bunu **çiz** diye okur:
  ucuz bir kapı, borçlu olmadığı bir kareyi ödeyebilir; borçlu olduğunu asla
  düşüremez.
- `PLANAR_REFLECTION_MIN_SCREEN_COVERAGE = 0.01` — ekranın %1'i.
- Kapı `minUpdateMs`'ten **önce** çalışır ve `lastUpdateAt`'i damgalamaz:
  görünmediği için atlanan bir kare, ondan sonrakini de ertelememeli.
- Kapı yansımadan önce çalıştığı için, suyu ekrana geri getiren kare aynı
  zamanda onu tazeleyen karedir — girişte bayat yakalama görünmez.

Motor kontrolü: *"Planar reflection skips its nested scene render when the water
is not worth it"* — dolu görüş, ekran dışı, dilim, gözü saran kutu ve boş grup.

### 8.6 Kalan iş

- **Proje kararı (veri):** bu Level'ın nehri için `low` (kaynak hiç kurulmaz,
  `src/scene/authoredWorld.ts`) ya da `medium` (256², MSAA yok, ~30 Hz). Kapı
  artık maliyeti kendiliğinden kısıyor, ama kamera suya *baktığında* `high` yine
  tam bedelini ister; bu Level için `medium` muhtemelen doğru yazım.
- Yeni taban (~6.65 ms GPU) üzerinde en büyük kalem **birimler: 3.46 ms (%52).**
  Bir sonraki hedef orasıdır.

## 9. Yararlı komutlar

```bash
npx tsc --noEmit                                  # ~9 sn, her düzenlemeden sonra
npm run test:engine                               # FAST ~5 sn
npm run test:engine:slow                          # tümü, ~49 sn (eskiden ~161)
npm run test:engine -- --filter "lojistik,road,caravan,depot,market"
ENGINE_TESTS_TIMING=1 npm run test:engine         # kontrol başına süre
```

`tools/` type-check edilmez (tsconfig kapsamı dışında), yani `engine-tests.ts`
içindeki fixture literal'leri `tsc` sessizken bayatlayabilir. Bir snapshot
arayüzüne alan eklerken fixture'ı elle güncelleyin.
