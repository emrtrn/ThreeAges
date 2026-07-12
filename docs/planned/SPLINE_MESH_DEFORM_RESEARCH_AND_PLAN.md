# Landscape Spline Mesh Deformation Araştırması ve Forge Planı

> Uygulama durumu (2026-07-12): Faz 1 ve opt-in Faz 2 tamamlandı, doğrulandı.

> Tarih: 2026-07-12
> Durum: Faz 1 ve opt-in Faz 2 uygulandı.
> Amaç: Landscape Spline (Road Tool) mesh yerleştirmesini, Unreal'ın
> **Spline Mesh Component** deformasyonuna yaklaştırmak. Yol parçaları hem
> spline eğrisi hem terrain eğimi ile birlikte bükülmeli, uç uca eksiksiz
> bağlanmalı ve boşluk/basamak bırakmamalı.

## Problem

Kullanıcı gözlemi (ekli görsel): virajlı ve eğimli bir yolda mesh parçaları

- **yatay kalıyor** — terrain eğimine göre yatmıyor (pitch yok),
- **uç uca gelmiyor** — parçalar arasında boşluk/örtüşme ve basamaklanma var,
- **viraj boyunca bükülmüyor** — her parça rijit düz bir dikdörtgen olduğu için
  eğri boyunca kırık bir çizgi oluşturuyor.

Kısaca: mevcut sistem eğri boyunca **rijit kopyalar** diziyor; Unreal ise tek bir
mesh'i eğri boyunca **deforme ediyor**.

## Mevcut durum (kod gerçeği)

Kaynak: `engine/scene/landscape.ts` → `computeLandscapeSplineMeshInstances`.

- Her segment, `splineToPolyline` ile bir merkez çizgisine (sub-segment'lere)
  çözülüyor. `smooth` açıksa segment başına `LANDSCAPE_SPLINE_CURVE_SUBDIVISIONS`
  (=8) Catmull-Rom alt noktası üretiliyor; kapalıysa segment başına tek düz parça.
- Merkez çizgisi boyunca `spacing` aralıkla **ayrık instance** noktaları
  hesaplanıyor (`distance = spacing/2, spacing*1.5, …`), her biri o adımda
  **ortalanıyor**.
- Her instance'ın:
  - **position**: merkez çizgisi üzerinde interpolasyon (Y dahil),
  - **rotation**: `[0, yaw, 0]` — yalnız yaw (`atan2(dx, dz)` + `yawOffset`);
    **pitch/roll yok** (tip yorumunda da yazılı: "pitch/roll are 0 in Faz 6"),
  - **scale**: `mesh.scale` (sabit; parçayı adım boyuna göre germiyor).
- Render: `buildLandscapeSplineMeshGroup` → `buildSceneInstancedModel` →
  `createInstancedModelGroup`. Yani parçalar **InstancedMesh** olarak, ham GLTF
  geometrisiyle, rijit çiziliyor. Geometri deforme edilmiyor.

### Neden görseldeki hatalar oluşuyor

1. **Pitch yok:** Y değişse bile parça yatay duruyor → eğimde basamak.
2. **Fit-to-length yok:** parça sabit ölçekli; adım boyu ≠ mesh boyu olunca
   ya boşluk ya örtüşme. Ortalanmış yerleşim ek olarak eklem hizasını bozuyor.
3. **Bükülme yok:** rijit parça düz bir kiriş; virajda kırık poligon çizgisi.
4. **`alignToTerrain` bağlı değil:** flag tipte var ve validator allowlist'inde
   (`tools/saveValidator.ts`), ama `computeLandscapeSplineMeshInstances` içinde
   **hiç kullanılmıyor** — ölü ayar.
5. **Merkez çizgisi Y'si authored nokta yüksekliğinden geliyor**, terrain
   yüzeyinden örneklenmiyor. `landscapeHeightAt` (bilinear) mevcut ama spline mesh
   yolunda çağrılmıyor.

## Unreal referansı

Unreal **Spline Mesh Component**: bir base static mesh'i, ileri ekseni boyunca
(genelde X, Forge'da +Z seçtik) parametrize edip iki uç arasında **Hermite eğrisi**
ile deforme eder. Her uç bir konum + tangent taşır; mesh'in her vertex'i, ileri
eksenindeki oranına göre eğri üzerinde bir çerçeveye (tangent/up/right)
yeniden yerleştirilir. Sonuç: mesh eğri boyunca pürüzsüz bükülür, uçlar komşu
segmentle tam hizalanır, up-vektörü ile bank/roll verilebilir.

Referans:
- Spline Mesh Component:
  https://dev.epicgames.com/documentation/unreal-engine/spline-mesh-component-in-unreal-engine
- Landscape Splines:
  https://dev.epicgames.com/documentation/unreal-engine/landscape-splines-in-unreal-engine

## Yaklaşımlar

### Yaklaşım A — Yönlendirilmiş + boya-göre-gerdirilmiş instance (ucuz, artımlı)

InstancedMesh render'ı korunur; ama parça başına:

- **Sub-segment başına tek parça** yerleştir (ayrık `spacing` yerine), böylece
  uçlar komşu alt parçayla paylaşılır → boşluk kapanır.
- **Fit-to-length:** parçanın +Z ölçeğini `subSegmentLength / meshForwardLength`
  yaparak alt parçayı tam doldur (mesh'in ileri-eksen uzunluğu `localBounds`'tan).
- **Tam yönelim:** yaw + **pitch** (`atan2(-dy, yatayUzunluk)`) + opsiyonel roll.
- **`alignToTerrain`:** açıkken up-vektörünü terrain normalinden al
  (`landscapeHeightAt` komşu örnekleri ile normal).

Artılar: InstancedMesh'i ve mevcut boru hattını korur, düşük risk, büyük görsel
kazanç (parçalar birleşir ve eğime yatar). smooth=8 alt bölümle virajda kırılma
gözle görülmez düzeye iner.

Eksiler: her parça hâlâ düz bir kiriş; çok keskin virajda hafif fasetlenme kalır.
Euler `[x,y,z]` (XYZ sıralı — bkz. `transforms.ts`) yaw+pitch+roll'u temiz
birleştirmeye yetmez; **instance yönelimi quaternion/matris olarak taşınmalı**
(bkz. Açık sorular).

### Yaklaşım B — Gerçek spline mesh deformasyonu (Unreal muadili)

Segment (veya alt parça) başına **benzersiz deforme `BufferGeometry`** üret:

- Base mesh'i +Z boyunca `[0..L]` parametrele.
- Her vertex için `t = z / L`; eğri üzerinde Hermite ile konum + tangent bul;
  parallel-transport (veya terrain normali) ile up/right çerçevesi kur; vertex'in
  (x, y) enkesitini bu çerçeveye taşı.
- Normalleri yeniden hesapla; UV'yi koru (asfalt dokusu +Z boyunca akmalı).

Artılar: Unreal kalitesi — pürüzsüz bükülme, kusursuz eklem, bank. En iyi görsel.

Eksiler: daha fazla iş; instancing yerine segment başına geometri (draw call /
bellek — komşu segmentleri tek geometriye **merge** ile azaltılabilir); base mesh
**+Z boyunca tile'lanacak** şekilde authored olmalı; picking/collision ayrı ele
alınmalı.

## Önerilen yol: fazlı

**Faz 1 — Yaklaşım A (hızlı kazanç).** Görseldeki üç hatayı da büyük ölçüde kapatır,
riski düşük, mevcut InstancedMesh yolunu korur. Öncelik bu.

**Faz 1 tamamlanma notu (2026-07-12).** `computeLandscapeSplineMeshInstances`
artık her polyline alt-parçası için bir instance üretir; host modelin local +Z
bound'unu geçirerek bu parçayı tam uzunluğa gerer. Tangent/up/right frame'i
quaternion olarak render katmanına taşınır, pitch ile terrain-normal hizası ve
opsiyonel bank korunur. `fitToLength`, `alignToTerrain` ve `bank` Details UI ve
save allowlist üzerinden kalıcıdır. Engine testleri fit, pitch, terrain-normal
ve save round-trip davranışını kapsar.

**Faz 2 tamamlanma notu (2026-07-12).** `Deform Mesh Along Curve` seçeneği,
her kaynak mesh primitive'inin +Z vertexlerini yüksek çözünürlüklü spline
polyline'ı boyunca yeniden yerleştirir. UV'ler korunur, normaller tekrar
hesaplanır; terrain normal hizası, bank ve material-slot override'ları aynı
render yolunda uygulanır. Bu mod opt-in'dir; mevcut spline'lar Faz 1 instanced
yolunda kalır. Collision için deforme geometri henüz kullanılmaz.

Her iki faz da yalnız **compute + render** katmanını değiştirir; veri modeli
(`ForgeLandscapeSpline`) büyük ölçüde aynı kalır, sadece birkaç mesh alanı eklenir.

## Faz 1 uygulama notları (grounded)

1. **Çerçeve matematiği** (`computeLandscapeSplineMeshInstances` içinde):
   - Tangent `T = normalize(end - start)` (Y dahil → pitch buradan gelir).
   - `yatayUzunluk = hypot(dx, dz)`; `pitch = atan2(-dy, yatayUzunluk)`.
   - `alignToTerrain` açıkken up = terrain normali; kapalıyken up = dünya-Y.
   - Right/up dikleştir (Gram-Schmidt) → ortonormal çerçeve.
2. **Yönelimi quaternion olarak taşı.** `LandscapeSplineMeshInstance.rotation:
   Vec3` (Euler) yerine `orientation: [x,y,z,w]` (quaternion) ekle veya yanına
   koy. Render `composeTransformMatrix` Euler XYZ kullandığı için, temiz
   pitch+yaw+roll'u Euler ile üretmek sıralamaya takılır; frame → quaternion
   (`setFromRotationMatrix`) en temizi. `LayoutPlacement` zaten quaternion mı Euler
   mı taşıyor — kontrol edilmeli; gerekirse instanced yol için ayrı bir matris
   kompozisyonu.
3. **Fit-to-length.** Mesh'in +Z boyu `localBounds` (`SceneApp`/`RuntimeSceneApp`
   zaten `computeModelLocalBounds` ile dolduruyor) → `scaleZ = segLen / boyZ`.
   Bu yüzden compute'a mesh'in ileri-eksen uzunluğu parametre olarak geçmeli
   (engine katmanı localBounds'a erişemez; host geçirir).
4. **Alt parça başına tek instance.** `spacing` semantiği değişir: artık
   "örnekleme aralığı" değil, opsiyonel "alt bölme". Basit ilk sürüm: her polyline
   alt parçasına bir fitted mesh. (Geriye uyum: `spacing` alanı UI'da kalabilir,
   ama Faz 1'de "parça başına bir mesh" varsayılan olabilir.)
5. **Terrain normali** için `landscapeHeightAt`'i export edip komşu örneklerle
   normal hesapla (render mesh'i zaten `left/right/up/down` farkıyla normal
   üretiyor — aynı desen).

## Faz 2 uygulama notları (özet)

- Segment başına deforme `BufferGeometry` (Hermite konum + tangent, parallel
  transport up).
- `buildLandscapeSplineMeshGroup`'un instanced dalı yerine "deform" dalı; komşu
  aynı-asset segmentleri `BufferGeometryUtils.mergeGeometries` ile birleştir.
- Materyal: Faz 1'de eklenen slot override yolu (`applyMaterialSlots`) burada da
  uygulanmalı (deforme mesh de aynı materyali almalı).
- UV: base mesh UV'sini koru; tekrar sayısı `segLen`'e göre +Z'de ölçeklenebilir.

## Dokunulacak yüzeyler (allowlist / entegrasyon)

- `engine/scene/landscape.ts`: compute imzası + çerçeve/quaternion mantığı; tip
  (`LandscapeSplineMeshInstance`, mesh alanları). Yeni mesh alanı eklenirse
  **iki yer** güncellenmeli:
  - `tools/saveValidator.ts` → `validateLandscapeSplines` mesh bloğu (yoksa alan
    **sessizce düşer** — CLAUDE.md allowlist gotcha).
  - `SceneApp` View/Patch (`LandscapeSplineSegmentView` / `...Patch`) + setter +
    `getSelectedLandscapeSplineSegments` + Details UI (`specialActorDetails.ts`).
- `src/scene/SceneRuntimeCore.ts` (`buildLandscapeSplineMeshGroup`) + iki host
  (`SceneApp.rebuildLandscapeSplineMeshes`, `RuntimeSceneApp.buildRuntimeLandscapeSplineMeshes`):
  mesh ileri-eksen uzunluğunu / localBounds'u compute'a geçir; Faz 2'de deform dalı.
- `tools/engine-tests.ts`: `computeLandscapeSplineMeshInstances` testlerini pitch /
  fit-to-length / alignToTerrain için genişlet (mevcut "lays instances along the
  tangent" ve branch/loop testlerinin yanına).

## Önerilen yeni mesh alanları

`ForgeLandscapeSpline...segment.mesh` içine (hepsi opsiyonel, geriye uyumlu):

- `fitToLength?: boolean` — parçayı alt parça boyuna gerdir (Faz 1 varsayılan açık).
- `alignToTerrain?: boolean` — **zaten var, sadece bağla** (up = terrain normali).
- `bank?: number` — virajda roll katsayısı (opsiyonel, Faz 1 sonu / Faz 2).
- (Faz 2) `deform?: boolean` — gerçek deformasyona geç.

`yawOffset`, `scale`, `offset`, `spacing` mevcut alanlar korunur.

## Riskler / açık sorular

1. **Euler vs quaternion:** Instanced yol yönelimi şu an Euler Vec3. Pitch+yaw(+roll)
   için quaternion/matris gerek. `LayoutPlacement` ve `composePlacementMatrix`'in
   quaternion desteği araştırılmalı; yoksa spline instanced'a özel matris kompozisyonu.
2. **Merkez çizgisi Y kaynağı:** authored nokta yüksekliği mi, terrain yüzeyi mi
   baz alınacak? `alignToTerrain` + terrain-snap kararı netleşmeli (yol deform'u
   `applyLandscapeSplineDeform` terrain'i düzleştiriyorsa ikisi tutarlı olmalı).
3. **Performans:** Faz 2'de segment başına geometri draw call artırır; merge şart.
4. **Collision:** `mesh.collision` bayrağı deforme mesh ile nasıl çalışacak (Faz 2)?
5. **Base mesh yönü:** +Z ileri sözleşmesi doküman + import ipucu olarak sabitlenmeli
   (yeni yol asset'leri +Z boyunca modellenmeli — `yawOffset` acil düzeltme olarak kalır).

## Özet karar

- **Faz 1'i öner:** yönlendirilmiş + fit-to-length + pitch + `alignToTerrain` bağla,
  InstancedMesh'i koru. Görseldeki basamak/boşluk/yatay-kalma hatalarının çoğunu
  kapatır, risk düşük.
- **Faz 2 opt-in uygulandı:** sampled spline boyunca unique BufferGeometry üretir;
  yüksek sayıda deforme segmentte geometry merge performans iyileştirmesi olarak açık kalır.
- Veri modeli neredeyse sabit; yeni alanlar opsiyonel ve allowlist'e eklenmeli.
