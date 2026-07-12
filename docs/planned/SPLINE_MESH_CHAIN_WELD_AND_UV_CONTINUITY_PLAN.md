# Landscape Spline Mesh Chain Weld ve Sürekli UV Planı

> Tarih: 2026-07-12  
> Durum: Uygulama ve doğrulama tamamlandı (2026-07-12); kadraja alınmış piksel-seam karşılaştırması isteğe bağlı takip işidir.
> Amaç: Aynı yol zincirindeki ardışık spline segmentlerinin birleşim çizgilerini
> kaldırmak; yüzey normallerini ve UV koordinatlarını segment sınırları boyunca
> kesintisiz hâle getirmek.

## Kullanıcı problemi

Yol hafif bir virajda bile segment sınırında ince bir çizgi / ton farkı
gösteriyor. Bu, virajın keskinliğinden çok render yapısından kaynaklanır:

- `Deform Mesh Along Curve`, her authored segment için ayrı `BufferGeometry`
  üretir.
- Komşu geometriler aynı dünya konumunda bitse de vertex ve normal verisini
  paylaşmaz.
- Her segment kaynak mesh'in UV aralığını yeniden başlatır; asfalt dokusu ve
  çizgiler sınırda gözle fark edilir şekilde kesilebilir.

## Mevcut kod gerçeği

`src/scene/SceneRuntimeCore.ts` içindeki `buildLandscapeSplineMeshGroup`:

1. Her `mesh.deform === true` segment için yüksek çözünürlüklü spline polyline
   üretir.
2. Her GLTF primitive'ini ayrı olarak `deformSplineMeshGeometry` ile büker.
3. Bu mesh'leri aynı asset grubuna ekler; fakat geometrileri merge/weld etmez.

Bu yüzden bugün segmentler uç uca gelir, ancak aydınlatma ve UV sürekliliği
garanti edilmez.

## Hedef davranış

Aynı spline içindeki, aynı `assetId` ve uyumlu mesh ayarlarına sahip doğrusal
yol zinciri tek bir deforme render yüzeyi olur:

- birleşim vertexleri tekilleştirilir (weld),
- normaller bütün zincir üzerinden bir kez hesaplanır,
- UV'nin yol-boyu ekseni zincirin kümülatif mesafesinden türetilir,
- ayrık branch/junction'lar otomatik olarak ayrı zincirlere bölünür,
- mevcut instanced yol ve `deform: false` davranışı değişmez.

## Kapsam ve kapsam dışı

Kapsam:

- `mesh.deform === true` spline mesh render yolu,
- lineer, uç uca bağlı segment zincirleri,
- aynı GLTF primitive/material için geometry merge + weld,
- sürekli asfalt UV'si ve ortak normal hesaplaması,
- editor/runtime ortak render fonksiyonu ve engine testleri.

Kapsam dışı:

- kavşak yüzeyi üretimi (T/X junction),
- deforme render mesh'ini collision'a bağlamak,
- yol omzu/terrain blend decal sistemi,
- `deform: false` instanced yolun değişmesi.

## Önerilen tasarım

### 1. Spline'ı zincirlere ayır

`engine/scene/landscape.ts` içine renderdan bağımsız bir resolver ekle:

- yalnız mesh-enabled + `deform: true` segmentleri alır,
- `assetId`, `yawOffset`, `scale`, `offset`, `alignToTerrain`, `bank` ve
  material-uyumlu ayarlar aynı olan segmentleri aday kabul eder,
- point degree'i 2 olan ardışık bağlantıları tek zincirde yürütür,
- degree'i 1 olan noktaları zincir ucu; degree'i 3+ olan noktaları junction
  sınırı kabul eder,
- her zincir için yönü tutarlı, tekrar etmeyen control-point/polyline dizisi ve
  kümülatif uzunluk döndürür.

Bu resolver branch'leri yanlışlıkla tek şerit gibi birleştirmez.

### 2. Zincir boyunca tek deform alanı kullan

`deformSplineMeshGeometry` için segment yolu yerine zincir yolu ver:

- source +Z koordinatını `[0, 1]` yol parametresine dönüştür,
- bu parametreyi zincirin toplam arc-length'i boyunca örnekle,
- her vertex için tangent ve devamlı frame üret,
- frame'i zincir başında kurup sonraki örneklerde parallel transport ile taşı;
  böylece segment birleşiminde roll/normal sıçraması olmaz.

Terrain hizası açıksa frame up vektörü terrain normaline yumuşak biçimde
yaklaştırılır; bank son aşamada tangent çevresinde uygulanır.

### 3. Sürekli UV üret

Deforme edilen geometri için:

- UV'nin genişlik eksenini (`u`) kaynak mesh'ten koru,
- yol-boyu eksenini (`v`) `cumulativeDistance / tileLength` yap,
- `tileLength` ilk teslimde source mesh'in local +Z uzunluğu olsun; daha sonra
  isteğe bağlı `uvTileLength` mesh alanına genişletilebilir,
- aynı material slotu kullanan ardışık segmentlerde UV başlangıcı sıfırlanmaz.

Bu, asfalt dokusunun ve çizgilerin segment sınırında yeniden başlamasını önler.

### 4. Primitive bazında merge + weld

`SceneRuntimeCore` render aşamasında, her zincir ve GLTF primitive için:

1. Deforme geometry parçalarını üret.
2. Uyumlu attribute setleriyle `BufferGeometryUtils.mergeGeometries` kullan.
3. Birleşim vertexlerini epsilon-tabanlı `mergeVertices` ile weld et.
4. `computeVertexNormals()` çağrısını yalnız birleşmiş geometri üzerinde yap.
5. Sonucu tek `Mesh` olarak asset grubuna ekle ve mevcut material-slot override
   akışını koru.

`mergeVertices` UV seam'lerini de etkileyebileceği için weld anahtarı position
ile birlikte UV/normal sınırlarını koruyacak şekilde doğrulanmalıdır. Uyumlu
olmayan primitive attribute'ları için güvenli geri dönüş: ayrı mesh bırakmak.

## Uygulama adımları

1. Chain resolver + saf unit testleri ekle: açık zincir, ters yönlü segment,
   kapalı loop ve branch sınırı.
2. `deformSplineMeshGeometry`yi chain path + kümülatif mesafe API'sine geçir;
   tangent/frame ve UV sürekliliği testlerini ekle.
3. Renderer'da aynı asset/primitive chain geometrilerini merge + weld et;
   material override ve disposal davranışını doğrula.
4. Editor ve Play'de gerçek `SM_Asphalt` ile görsel smoke:
   hafif viraj, eğim, üç ardışık point ve loop.
5. Draw call / triangle sayısını önce-sonra ölç; yalnız deforme zincirlerde
   kabul edilebilir olduğundan emin ol.
6. Bu dokümanı sonuçlar, sınırlamalar ve sonraki collision kararıyla güncelle.

## Kabul kriterleri

- Hafif virajda iki segment arasındaki ince shading çizgisi görünmez.
- Asfalt dokusu ve yol çizgileri segment sınırında yeniden başlamaz.
- Birleşim çevresindeki normal yönleri kesintisizdir.
- Branch/junction bölgeleri güvenle ayrı zincir kalır; yanlış yüzey oluşmaz.
- `deform: false` mevcut instanced davranışı aynen korur.
- `npx tsc --noEmit`, `npm run test:engine` ve `npm run build:verify` geçer.

## Riskler ve kararlar

- Junction mesh üretimi bu planın dışında kalır; branch sınırında ayrı mesh
  bırakmak görsel olarak güvenli varsayılandır.
- Kaynak yol mesh'inin +Z boyunca yeterli topology'si yoksa weld, eğri kalitesini
  tek başına artıramaz; asset authoring gereklidir.
- UV'nin yol çizgisi tasarımıyla uyumu gerçek asset üzerinde kontrol edilmelidir.
- Deforme collision ayrı bir sonraki çalışma olarak kalır.

## Önerilen ilk dilim

Önce **açık, branch içermeyen aynı-asset yol zinciri** için resolver + sürekli
UV + weld uygulanmalı. Junction, loop ve performans batch'i ilk dilim doğrulanınca
ayrı takip işleri olmalıdır.

## Uygulama durumu (2026-07-12)

- `resolveLandscapeSplineMeshChains`, aynı deform mesh ayarlarına sahip açık
  zincirleri çözer; ters authored segmentleri yönlendirir ve branch noktalarını
  zincir sınırı olarak korur. Kapalı loop çözümlemesi de test kapsamındadır.
- Render yolu her chain/GLTF primitive çifti için parçaları birleştirip weld eder;
  normaller weld sonrasında tek sefer hesaplanır. `uv.v`, zincirin kümülatif
  mesafesini kaynak mesh +Z uzunluğuna göre tile eder; segment başında yeniden
  başlamaz.
- `SM_Asphalt` yeniden adlandırması manifest ve smoke level ile eşitlendi; üç
  kontrol noktalı authored spline'ın iki segmenti de `sm-asphalt` + `deform`
  kullanır, bu yüzden gerçek sahne tek bir uyumlu zincir üretir.
- Playwright smoke editor ve Play'i açar, iki authored mesh ayarını doğrular,
  runtime `scene loaded` kaydını ve loading overlay'in kapanmasını bekler; iki
  modda da browser/page error görülmedi. Başlangıç kamerası yolun kadrajına
  bakmadığından ekran görüntüsü shading çizgisini insan gözüyle karşılaştırmak
  için uygun değildir.
- Ölçülebilir render değişimi primitive başına iki bağımsız segment mesh'inden
  tek welded mesh'e geçiştir: **2 -> 1 draw mesh**, triangle topology korunur.
  Editor post-process OutputPass ve Play başlangıç frustum'u global WebGL
  sayaçlarını bu delta için anlamlı bir önce/sonra ölçüm yapmaz.
- `npm.cmd run check:assets` (0 error), hedef Playwright smoke ve
  `npm.cmd run build:verify` geçti; son gate 779 engine kontrolü ve strict dist
  doğrulamasını içerir.
- Gelecekteki isteğe bağlı iş: yolun üzerine bakan sabit bir test kamerasıyla
  seam odaklı screenshot karşılaştırması; terrain hizası/banklı zincirlerde
  parallel-transport frame değerlendirmesi sürer.
