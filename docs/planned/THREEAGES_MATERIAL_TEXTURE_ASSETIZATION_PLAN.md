# ThreeAges — Materyal, Tekrarlanabilir Doku ve Yüzey Assetleştirme Planı

Oluşturulma tarihi: 2026-08-06  
Durum: **Devam ediyor — Faz 0 tamamlanma yolunda; Faz 1 dar çekirdeği ve desktop capability kapısı kanıtlandı, dört-ORM fixture kabulü açık**

## Uygulama Günlüğü

- 2026-08-06 — Faz 0 + Faz 1 dar çekirdeği başlatıldı.
  - [x] Read-only `npm run inventory:threeages-materials` aracı 128 model / 489 primitive, 72 tam UV'li, 56 UV'siz ve 6 tam mevcut sidecar ailesini doğruladı; kaynak GLTF veya sidecar yazmadı.
  - [x] Kaynak slot adları için koruyucu mapping iskeleti `docs/planned/threeages-material-slot-mapping.json` eklendi. `Main`, `Stone`, `Green` ve `Water` aile bazlı inceleme bitmeden apply hedefi değildir.
  - [x] Ortak Landscape material-layer resolver'ı albedo yanında normal, ORM ve scalar PBR bilgilerini Editor, Play ve authored-world yoluna iletmeye başladı.
  - [x] Landscape splat shader'ı dört normal ile dört ORM katmanını paint ağırlıklarıyla karıştırır; eksik normal/ORM güvenli fallback kullanır.
  - [x] `Assetization Faz E` browser smoke, normal map kullanan gerçek authored Landscape'i mount/restart/dispose ederek console hatası olmadan geçti.
  - [x] Renderer texture-unit limiti Landscape'e aktarılır; 16'nın altındaki bilinen cihazda shader açıkça albedo-only varyanta düşer. RTS browser smoke tam PBR yolunu ve `data-rts-landscape-samplers="12/<limit>"` ölçümünü doğruladı.
  - [ ] Dört farklı normal/ORM texture ile browser fixture ve görsel blend kabulü, ilk gerçek texture pilotu ile birlikte kalır.
  - [x] Faz 3 `wood-dark` pilotu için kullanıcı A varyantını kabul etti. Deterministik 1024² BC/N/ORM seti, manifest texture kayıtları ve `M_TA_Wood_Dark` oluşturuldu; henüz model/Landscape slotuna atanmadı.
  - [x] `wood-dark` Material Editor browser smoke, kayıtlı BC/normal/ORM setini açıp `Ready.` durumuna ulaştı; sayfa hatası üretmedi.

## 1. Amaç

Bu planın hedefi, ThreeAges'in stilize low-poly fantastik orta çağ sanat yönüne
uygun, tekrar edilebilir bir yüzey kütüphanesi üretmek ve bu kütüphaneyi:

- `public/assets/ThreeAges/StaticMeshes` altındaki 128 GLTF modele,
- `landscape-1` üzerindeki dört boyama katmanına,
- Kasaba merkezlerinin `Water` materyal slotuna

güvenli ve büyük ölçüde otomatik biçimde uygulamaktır.

Çalışma yalnız yeni doku dosyaları eklemek değildir. Tam hedef şunları birlikte
kapsar:

1. Imagen ile tutarlı, stilize ve gerçekten tekrar edilebilir albedo kaynakları
   üretmek.
2. Normal ve ORM haritalarını deterministik bir yerel işlem hattıyla üretmek.
3. Modelleri 1×1×1 dünya birimi Box UVW projeksiyonuna geçirmek.
4. Kaynak materyal slotlarını ortak ThreeAges materyallerine otomatik eşlemek.
5. İç/dış köşe ve zemin kirlenmesi için geometri tabanlı vertex-color maskeleri
   üretmek.
6. Landscape splat shader'ına dört katmanlı normal ve ORM desteği eklemek.
7. Town Center suyuna River Water'daki görsel dile uyumlu, düşük maliyetli normal
   hareketi vermek.

Bu plan modellerin geometrisini yeniden modellemez, GLTF dosyalarını destructively
değiştirmez ve `public/assets/ThreeAges/Environment` altındaki kendinden materyalli
çevre nesnelerine dokunmaz.

## 2. Kaynak Kararlar ve Görsel Yön

GDD'nin bağlayıcı sanat yönü:

- stilize low-poly fantastik orta çağ,
- sıcak ve doğal çevre renkleri,
- düşük görsel gürültü,
- uzaktan okunabilir bina ve seviye siluetleri,
- paylaşılan materyal ve kontrollü web performansı

olarak korunacaktır.

Bu nedenle üretilecek dokular fotogerçekçi tarama görüntüleri gibi davranmayacak;
model geometrisinin biçimini destekleyen geniş ve sade renk kümeleri kullanacaktır.
Albedo içinde yönlü güneş, sert AO, perspektif, obje gölgesi, yazı veya watermark
bulunmayacaktır.

## 3. Mevcut Durumun Kanıtlı Özeti

### 3.1 Static Mesh envanteri

- Kapsam dizininde **128 GLTF** vardır.
- 72 modelin bütün primitive'lerinde kaynak `TEXCOORD_0` bulunur.
- 56 modelin hiçbir primitive'inde UV yoktur.
- Karışık UV durumunda model yoktur; bir model ya tamamen UV'li ya tamamen UV'sizdir.
- Yalnız 6 modelde `.uvw.json`, `.materials.json` ve `.vertexcolors.json` sidecar
  ailesi bulunmaktadır.
- Modeller 1–9 materyal slotu taşır. Tekrarlanan ana kaynak slot adları:
  `Wood`, `Wood_Light`, `Main`, `Walls`, `Stone`, `Stone_Light`, `Dirt`, `Green`,
  `Water`, `Metal`, `Metal_Light`, `Gold`, `Fabric`, `Wheat`, `White`, `Red`,
  `Yellow` ve ürün renkleridir.

### 3.2 Mevcut yüzey sözleşmeleri

- `*.uvw.json`, model geometrisini değiştirmeden planar/box/sphere/cylinder
  projeksiyonu uygulayabilir.
- `*.materials.json`, GLTF materyal sırasını manifest materyal kimliklerine bağlar.
- Forge materyali base color, normal, ayrı roughness/metalness/AO veya paketli ORM,
  opacity, emissive ve iki katmanlı karışımı destekler.
- Katman sürücüleri `constant`, `slope`, `worldHeight`, `maskTexture` ve
  `vertexColor` seçeneklerini destekler.
- `*.vertexcolors.json` asset başına primitive ve vertex sayısıyla RGBA değerleri
  saklayabilir; ancak bu asset varsayılanı RTS model yükleme yolunda bugün otomatik
  uygulanmamaktadır. Köşe maskesi fazı bu runtime/editor parite açığını kapatmalıdır.

### 3.3 Landscape sınırı

Landscape dört ağırlıklı katmanı base-color splat olarak karıştırır. Atanan
materyalin normal ve ORM haritaları bugün `loadForgeMaterialLayer()` tarafından
yüklenmez ve Landscape shader'ına ulaşmaz.

Mevcut dört katman:

| Katman kimliği | Görsel rol | Mevcut kullanım notu |
| --- | --- | --- |
| `grass` | Çayır | Ana zemin |
| `dirt` | Toprak | Yol/pad/runtime repaint içinde de kullanılır |
| `rock` | Doğal kaya | Eğimli/kayalık alan |
| `snow` | Yol çakılı | Adı legacy'dir; spline yollar bu katmanı boyar |

`snow` kimliği bu çalışma sırasında gerçek kara çevrilmeyecektir. Kimliği yeniden
adlandırmak Landscape ağırlıklarını ve spline paint referanslarını etkileyen ayrı
bir veri göçüdür.

### 3.4 Town Center suyu

`TownCenter_SecondAge_Level1/2/3.gltf` modellerinde `Water` slotu vardır. First Age
merkez modellerinde `Water` slotu yoktur. Mevcut slot düz renkli, çift taraflı,
statik bir PBR yüzeyidir.

River Water zaten zaman uniform'u, iki farklı ölçek/hızda kayan normal örnekleri
ve akış hareketi kullanır. Town Center yüzeyi spline, derinlik, kıyı veya foam
verisine sahip olmadığı için tam River Water materyali doğrudan takılmayacak;
aynı normal-hareket dilinin düz UV yüzeyine uygun hafif sürümü kullanılacaktır.

## 4. Kilitli Kararlar

### K-01 — Kesin kapsam

Yazma kapsamı:

- `public/assets/ThreeAges/StaticMeshes`
- yeni `public/assets/ThreeAges/Textures`
- yeni `public/assets/ThreeAges/Materials`
- ilgili manifest kayıtları
- `public/landscapes/landscape-1.landscape.json` materyal atamaları
- gerekli generic Forge materyal/Landscape render kodu
- ThreeAges RTS sunum bağlantıları
- bu plan ve üretim günlüğü/testleri

Kapsam dışı:

- `public/assets/ThreeAges/Environment`
- Environment modellerinin gömülü materyal ve dokuları
- Animals ve karakter/skeleton materyalleri
- model geometri/pivot/collision değişikliği
- gameplay, ekonomi, navigation ve terrain height/paint ağırlığı değişikliği
- River Water spline/foam/reflection davranışının yeniden tasarlanması

### K-02 — Paylaşılan tile materyaller, atlas değil

Bu yüzey ailesi tekrar eden dünya-ölçekli dokular kullanacağı için V1'de atlas
kullanmayacaktır. Atlas, bağımsız tekrar ve mip kenar sızıntısı açısından Box UVW
ile gereksiz karmaşıklık yaratır. Performans ortak materyal kimlikleri ve ortak
texture cache üzerinden kazanılır.

İleride yalnız tekrar etmeyen takım rengi, işaret veya prop ailesi atlaslanabilir;
bu plan onu açmaz.

### K-03 — 1×1×1 dünya birimi Box UVW

Varsayılan sidecar:

```json
{
  "schema": 1,
  "mapType": "box",
  "position": [0, 0, 0],
  "rotation": [0, 0, 0],
  "scale": [1, 1, 1]
}
```

Bu, bir texture tekrarını bir model/dünya birimine bağlar; modeli kendi bounds'una
normalize etmek anlamına gelmez. Envanter aracı model bounds ve olası ölçek
aykırılarını raporlar. Görsel texel yoğunluğu bozuk aileler açıkça kayıtlı override
alabilir; sessiz model-başı rastgele ölçek kullanılmaz.

### K-04 — GLTF değişmez, sidecar otoritedir

Toplu araç hiçbir `.gltf` dosyasını yeniden yazmayacaktır. Ürettiği dosyalar:

- `.uvw.json`
- `.materials.json`
- gerektiğinde `.vertexcolors.json`

olacaktır. Mevcut sidecar'lar dry-run raporunda ayrı gösterilir. Varsayılan davranış
korumaktır; kabul sonrası değiştirme yalnız açık `--replace-existing` benzeri bir
bayrakla yapılır.

### K-05 — Imagen yalnız görsel kaynak üretir

Imagen her yüzey ailesi için ayrı çağrıyla albedo adayı üretir. Tek bir büyük
görselden tile kırpılmaz. Normal ve ORM haritaları Imagen'e serbestçe çizdirilmez;
kabul edilmiş albedodan/height girdisinden deterministik araçla türetilir.

Her kabul edilen görsel için nihai prompt, seçilen varyant ve dosya yolu üretim
günlüğüne yazılır. Projede kullanılan nihai dosya yalnız `$CODEX_HOME` altında
bırakılmaz; proje asset dizinine taşınır.

### K-06 — Köşe eskimesi vertex-color tabanlıdır

Box projection aynı UV alanında farklı yüzleri üst üste getirebildiği için modele
özel curvature maskesi ortak UV mask texture olarak bake edilmeyecektir.

Otomatik geometri analizi şu kanalları üretir:

| Kanal | V1 anlamı |
| --- | --- |
| R | İç köşe/cavity kararması; ilk aktif layer maskesi |
| G | Dış/konveks köşe aşınması; kayıtlı ama V1'de opsiyonel |
| B | Zemine yakın kirlenme; kayıtlı ama V1'de opsiyonel |
| A | Gelecek takım/özel maske kullanımı için korunur |

V1 materyali R kanalını `vertexColor` driver olarak kullanır: katman 1 aynı yüzey
dokusunu daha koyu tint, biraz daha yüksek roughness ve kontrollü AO ile uygular.
Geometri yetersiz vertex yoğunluğuna sahipse araç `insufficient-density` raporlar;
maskeyi uydurmak için mesh tessellate etmez.

### K-07 — Landscape normal + ORM desteği zorunludur

Landscape'in dört katmanı aşağıdakileri bağımsız taşıyacaktır:

- albedo/base-color texture ve tint,
- tangent-space normal texture,
- ORM texture: R=AO, G=roughness, B=metalness,
- material scalar çarpanları ve ortak UV tiling.

Eksik texture güvenli fallback üretir:

- normal yoksa düz normal,
- ORM yoksa AO=1 ve materyalin scalar roughness/metalness değerleri,
- base-color yoksa mevcut katman rengi.

Albedo sRGB; normal ve ORM lineer/no-color-space okunur. Dört katman ağırlığı
normalize edilerek albedo, normal, AO, roughness ve metalness aynı paint
ağırlıklarıyla karıştırılır.

### K-08 — Landscape sampler bütçesi ölçülecektir

Tam yol en fazla 4 albedo + 4 normal + 4 ORM sampler'ı kullanır. Desktop web hedefi
için uygulanabilir görünse de shader, shadow ve environment sampler'larıyla birlikte
gerçek renderer limitinde doğrulanmalıdır.

- Shader compile/link hatası kabul edilmez.
- `renderer.capabilities.maxTextures` ve aktif program/sampler sayısı debug ölçümüne
  yazılır.
- Desteklemeyen cihaz için açık albedo-only fallback olabilir; normal/ORM desteği
  desteklenen ana hedefte kapatılmaz.
- Paketleme veya sampler azaltma ancak ölçüm limit gösterirse yapılır; görsel veri
  sözleşmesi sessizce değiştirilmez.

### K-09 — Town Center suyu generic materyal hareketiyle çözülür

Forge materyal tanımına geriye uyumlu, opsiyonel bir normal animasyon bloğu
eklenecektir. Bu özellik “Town Center” kimliğini bilmez; herhangi bir standart
materyalde iki kayan normal örneğini destekleyen generic render özelliğidir.

Önerilen veri şekli uygulama sırasında kesinleştirilecek, şu anlamları taşıyacaktır:

- birincil UV velocity,
- ikincil UV velocity,
- ikincil tiling/scale,
- iki normal örneği arasındaki blend,
- normal strength.

Normal hareketi yoksa mevcut materyal shader/cache davranışı aynen kalır. Town
Center `Water` slotu bu özelliği kullanan ThreeAges su materyaline atanır. Küçük
havuzda River Water'ın spline attributes, shore foam, depth ve planar reflection
sistemleri kopyalanmaz.

### K-10 — Görsel kabul otomasyondan ayrı kapıdır

TypeScript, engine testi ve shader compile kanıtı görsel kabul yerine geçmez.
Pilot ve toplu uygulama fazları ancak hedef RTS kamerasında kullanıcı kabulüyle
kapanır.

## 5. Hedef Doku ve Materyal Kütüphanesi

### 5.1 Zorunlu V1 yüzeyleri

| Kimlik | Kullanım | Kaynak slot/istisna | Dosya seti |
| --- | --- | --- | --- |
| `wood-dark` | Koyu taşıyıcı ahşap | `Wood` | BC + N + ORM |
| `wood-light` | Açık/yeni ahşap | `Wood_Light` | BC + N + ORM |
| `tree-bark` | Doğal ağaç gövdesi | Tree/Pine modellerindeki `Wood` override | BC + N + ORM |
| `roof-clay` | Kiremit/kil çatı | Yapı `Main` slotu | BC + N + ORM |
| `wall-plaster` | Sıcak açık sıva/kil | `Walls` | BC + N + ORM |
| `stone-masonry` | Kaba yığma yapı taşı | Yapı `Stone` slotu | BC + N + ORM |
| `stone-cut-light` | Açık kesme taş/kireçtaşı | `Stone_Light` | BC + N + ORM |
| `rock-natural` | Kaynak kaya/dağ | Rock/Mountain `Stone` override | BC + N + ORM |
| `earth-compacted` | Sıcak sıkıştırılmış toprak | `Dirt` | BC + N + ORM |
| `grass-meadow` | Landscape çayır | Landscape `grass` | BC + N + ORM |
| `road-gravel` | Yol/çakıl | Landscape legacy `snow` | BC + N + ORM |
| `foliage-broadleaf` | Geniş yapraklı ağaç | Tree `Green` override | BC + N + ORM |
| `foliage-pine` | Çam yeşilliği | Pine `Green` override | BC + N + ORM |
| `water-center` | Town Center havuzu | Second Age `Water` | BC opsiyonel + N + scalar PBR |

Landscape `dirt`, `rock` ve `grass` katmanları sırasıyla `earth-compacted`,
`rock-natural` ve `grass-meadow` yüzeylerini paylaşır. Bu paylaşım aynı texture
assetini kullanabilir; Landscape için ayrı tiling materyali oluşturulabilir.

### 5.2 İlk fazda düz/PBR parametre olarak kalabilecek slotlar

`Metal`, `Metal_Light`, `Gold`, `Fabric`, `Wheat`, takım renkleri ve ürün renkleri
ilk pilotta ayrı Imagen yüzeyi gerektirmez. Bunlar ortak renk + roughness/metalness
materyalleriyle korunur. Uzak RTS kamerasında eksik görsel değer kanıtlanırsa ikinci
doku paketi açılır.

### 5.3 Dosya adlandırma

Önerilen dizinler:

```text
public/assets/ThreeAges/
  Textures/
    Surfaces/
      T_TA_Wood_Dark_BC.png
      T_TA_Wood_Dark_N.png
      T_TA_Wood_Dark_ORM.png
      ...
    Water/
      T_TA_Water_Center_N.png
  Materials/
    M_TA_Wood_Dark.material.json
    M_TA_Wood_Dark_Worn.material.json
    M_TA_Landscape_Grass.material.json
    M_TA_Water_Center.material.json
```

`BC`, `N`, `ORM` sonekleri manifest adı ve texture kullanım niyetiyle eşleşir.
İlk kabul PNG kaynaklarıyla yapılır. Görsel sonuç kilitlendikten sonra runtime
KTX2/WebP dönüşümü ayrı ölçümlü optimizasyon olabilir; normal/ORM kayıplı biçime
körlemesine çevrilmez.

## 6. Imagen Üretim Sözleşmesi

### 6.1 Ortak prompt iskeleti

Her yüzey `stylized-concept` use-case'iyle ve aşağıdaki ortak şartlarla üretilir:

- intended asset: seamless tileable game surface texture,
- stylized low-poly medieval fantasy,
- warm natural ThreeAges palette,
- orthographic/flat surface read,
- medium-low contrast and low visual noise,
- no directional lighting, cast shadows or ambient-occlusion baking,
- no perspective, border, frame, object, text, logo or watermark,
- no single landmark feature that reveals repetition,
- no long directional grain unless the yüzey specifically requires it.

Ahşap ve kiremitte Box UV yön uyuşmazlığını büyütecek uzun damarlar veya belirgin
kiremit sıraları kullanılmaz. Yeşillik, alpha-card fotoğrafı değil, solid low-poly
canopy geometrisini renklendiren yönsüz organik yüzey olur.

### 6.2 Varyant ve seçim

- Her yüzey için önce iki aday üretilir.
- Adaylar aynı prompt ailesini kullanır; sanat yönünü rastgele değiştiren ek obje
  veya palet eklenmez.
- Seçim 1×1 görüntüden değil 3×3 tile sheet ve en az bir model preview üzerinden
  yapılır.
- Kullanıcı kabul etmeden aday “final” adını almaz.
- Seçilen prompt ve varyant `docs/art/THREEAGES_TEXTURE_GENERATION_LOG.md` içinde
  kaydedilir.

### 6.3 Yerel post-process

Önerilen araç: `tools/threeages-texture-pipeline.py`.

Görevleri:

- power-of-two ve kare boyut doğrulaması,
- gerçekten seamless kenar üretimi/iyileştirmesi,
- 3×3 tile preview üretimi,
- seam hata metriği ve eşik raporu,
- kontrollü grayscale height üretimi veya elle verilmiş height girdisini alma,
- Sobel/benzeri yöntemle tangent-space normal üretimi,
- materyal presetine göre AO/roughness/metalness kanallarını ORM olarak paketleme,
- albedo/normal/ORM renk uzayı niyetini raporlama,
- dosyaları non-destructive/versioned üretme.

Imagen çıktısı bu araçtan geçmeden runtime finali sayılmaz.

## 7. Toplu Static Mesh Assetleştirme Aracı

Önerilen araç: `tools/threeages-materialize-static-meshes.mjs`.

### 7.1 Girdiler

- kesin allowlist kökü: `public/assets/ThreeAges/StaticMeshes`,
- GLTF `materials[]` isim/sıra bilgisi,
- model/primitive/vertex/bounds envanteri,
- manifest materyal kimlikleri,
- açık mapping config'i,
- asset-pattern istisnaları,
- mevcut sidecar'lar.

Önerilen config: `tools/data/threeages-static-mesh-material-map.json`.

Config iki seviyeli olur:

1. Genel slot eşlemesi (`Wood` → `M_TA_Wood_Dark`).
2. Asset ailesi istisnası (`Resource_Tree*` içindeki `Wood` → `M_TA_Tree_Bark`).

### 7.2 Komut davranışı

Varsayılan dry-run:

- 128 modelin tamamını listeler,
- UV var/yok durumunu raporlar,
- her slot için hedef materyali gösterir,
- eşlenmeyen veya birden fazla anlama gelen slotu hata yapar,
- mevcut sidecar'ı ve değişip değişmeyeceğini gösterir,
- `Environment` veya başka dizine taşan path'i reddeder,
- dosya yazmaz.

Apply modu:

- yalnız açık `--apply` ile yazar,
- atomik/geçici dosya + rename davranışı kullanır,
- aynı girdide aynı JSON'u üretir,
- GLTF ve collision sidecar'larına dokunmaz,
- ikinci çalıştırmada değişiklik üretmez,
- mevcut sidecar değişimi için ayrıca açık onay bayrağı ister.

### 7.3 Slot kuralları

Genel eşlemeler yalnız kaynak slot adı semantik olarak yeterliyse kullanılır.
Örnek istisnalar:

- `Stone`: bina için masonry, Rock/Mountain/Gold resource için natural rock.
- `Green`: ağaç foliage, market/ürün, Town Center dekoru için farklı materyal.
- `Main`: yapı ailesinde çatı olsa da asset envanteriyle doğrulanmadan global
  olarak kiremite çevrilmez.
- `Water`: yalnız gerçek su slotu taşıyan Second Age Town Center modellerinde
  hareketli su materyaline bağlanır.

Eşlenmeyen slot sessizce boş bırakılmaz; raporlanan açık karar haline gelir.

## 8. Otomatik Köşe/Kir Maskesi

### 8.1 Geometri analizi

Araç her primitive için:

1. Index ve position/normal accessor'larını çözer.
2. Yakın konumları toleranslı olarak eşleyip topolojik komşuluk kurar.
3. Komşu yüz normal açılarını hesaplar.
4. Signed dihedral mümkünse iç/konkav ve dış/konveks ayrımını yapar.
5. Alan ve açı ağırlıklı maskeyi vertex'lere dağıtır.
6. Model bounds'una göre zemin yakınlığı maskesi üretir.
7. RGBA float dizisini mevcut `AssetVertexColorsDef` şemasına yazar.

Maske modelde yeni vertex üretmez ve source normals/indices değiştirmez.

### 8.2 Runtime/editor paritesi

Bu faz yalnız sidecar üretmekle kapanmaz. Generic shared yükleme yolu:

- `.vertexcolors.json` dosyasını asset path'ten yükler,
- mesh name + primitive index + vertex count eşleşmesini doğrular,
- reimport sonrası position verisiyle güvenli repair/fallback uygular,
- geometry `color` attribute'unu template/clone'a uygular,
- Static Mesh Editor, Scene Editor, RuntimeSceneApp ve RTS Actor visual yolunda aynı
  sonucu verir.

Asset sidecar bulunmaması veya primitive eşleşmemesi model yüklemeyi düşürmez;
warning/fallback üretir.

### 8.3 Materyal kullanımı

Her aşınmalı materyal iki katmanlı olur:

- Layer 0: kabul edilmiş ana PBR yüzeyi.
- Layer 1: aynı texture seti veya kontrollü koyu varyant; daha yüksek roughness.
- Driver: `vertexColor`, kanal `r`.
- Contrast/min/max değerleri materyal ailesi başına paylaşılır.

AO ve curvature birbirine eşit sayılmaz. ORM içindeki mikro AO yüzey detayını;
vertex R ise model geometrisi birleşimlerini temsil eder.

## 9. Landscape PBR Teknik Tasarımı

### 9.1 Veri çözümleme

`loadForgeMaterialLayer()` yalnız albedo değil şu veriyi döndürecek biçimde
genişletilir:

- base color + baseColor texture,
- normal texture,
- ORM texture,
- uv tiling,
- roughness, metalness, aoIntensity scalar değerleri.

SceneApp, RuntimeSceneApp ve `authoredWorld` içindeki üç çözümleme yolu aynı
shared sonuç tipini kullanmalı; aynı mantığın üç ayrı kopyasıyla drift
oluşturulmamalıdır.

Texture cache/dispose sahipliği açık kalır. Aynı texture iki kez dispose edilmez;
scene rebuild ve authored-world dispose sonrasında sızıntı kalmaz.

### 9.2 Shader karışımı

- Mevcut `landscapeWeight` RGBA attribute'u tek paint otoritesidir.
- Dört ağırlık normalize edilir.
- Albedo lineer uzayda mevcut sRGB texture dönüşümünden sonra ağırlıklı karışır.
- Tangent-space normal örnekleri unpack edilir, ağırlıklı toplanır ve normalize
  edilir; terrain yüzey normaline/TBN'e taşınır.
- ORM R/G/B kanalları aynı ağırlıklarla karışır.
- AO, roughness ve metalness Three.js PBR ışık hesabına doğru shader chunk'ında
  uygulanır.
- Debug `height`, `slope`, `layer` görünümleri PBR splat'ten etkilenmez.

### 9.3 Parite ve fallback

Aynı Landscape materyali:

- editor lit viewport,
- RuntimeSceneApp Play,
- authored world içeren `?rts` yolu

üzerinde eşleşmelidir. Eksik veya bozuk bir katman texture'ı bütün Landscape'i
görünmez yapmaz; yalnız o kanalın fallback değerine döner ve açıklanabilir warning
üretir.

## 10. Town Center Hareketli Su Teknik Tasarımı

### 10.1 Generic materyal sözleşmesi

`ForgeMaterialDef` geriye uyumlu opsiyonel normal-animation alanı alır. Normalizer,
Material Editor, save validator ve material loader aynı default/limitleri paylaşır.
Alan yoksa shader patch ve zaman maliyeti oluşmaz.

İki örnek aynı normal texture'ı kullanabilir:

- örnek A: ana tiling ve yavaş X/Y velocity,
- örnek B: farklı scale, farklı yön ve hız,
- sonuç: normalize edilmiş blend ve ayarlanabilir normal strength.

Shader program cache key animasyon var/yok ve gerekli varyantı ayırır. Time uniform'u
render sırasında güncellenir; her frame yeni materyal veya texture oluşturulmaz.

### 10.2 ThreeAges su materyali

`M_TA_Water_Center`:

- temiz mavi/yeşil tint,
- düşük metalness,
- kontrollü roughness,
- hafif transparency ve double side yalnız gerçek mesh ihtiyacı doğrulanırsa,
- `T_TA_Water_Center_N` üzerinden çift normal hareketi,
- foam, kıyı, spline akışı veya gameplay etkisi olmadan

tanımlanır.

`TownCenter_SecondAge_Level1/2/3` modellerinin `Water` slotu bu materyale bağlanır.
Su hareketi modelin seçim/picking, shadow, fog ve takım tint davranışını bozmaz.

## 11. Uygulama Fazları

### Faz 0 — Envanter ve sözleşme testleri

- [ ] 128 modelin slot, primitive, UV, bounds ve sidecar envanterini otomatik çıkar.
- [ ] Kaynak slot → hedef yüzey config'ini oluştur.
- [ ] Belirsiz `Main`, `Stone`, `Green` slotlarını asset ailesi istisnalarıyla çöz.
- [ ] Mevcut 6 sidecar'ı preserve/replace listesi olarak kaydet.
- [ ] `Environment` dışlama ve GLTF değişmezlik kontrolünü teste bağla.
- [ ] Texture/material naming ve manifest id standardını kilitle.

Kabul: Dry-run 128/128 modeli kapsar, eşlenmeyen/çift anlamlı slot bırakmaz, hiçbir
dosya yazmaz ve scope dışına çıkmaz.

### Faz 1 — Landscape normal + ORM altyapısı

- [ ] Shared Landscape material-layer resolver'ı normal/ORM/scalar PBR ile genişlet.
- [ ] SceneApp, RuntimeSceneApp ve authored-world çözümleme yollarını hizala.
- [ ] Dört normal haritasını ağırlıklı ve normalize biçimde karıştır.
- [ ] Dört ORM haritasını paint ağırlıklarıyla PBR chunk'larına uygula.
- [ ] Eksik-map fallback ve doğru color-space ayarlarını ekle.
- [ ] Texture cache/dispose ve scene rebuild regresyonlarını ekle.
- [ ] Sampler/capability ölçümü ve albedo-only düşük-capability fallback'ini ekle.

Kabul: Dört katmana farklı normal/roughness test fixture'ı verildiğinde editor,
Play ve RTS authored world aynı yüzey ayrımını gösterir; console/shader hatası ve
texture sızıntısı yoktur.

### Faz 2 — Generic normal hareketi ve Town Center suyu

- [ ] Materyal şemasına opsiyonel çift-normal hareket alanını ekle.
- [ ] Normalizer, Material Editor, save validator ve renderer'ı güncelle.
- [ ] Program cache ve time uniform yaşam döngüsünü test et.
- [ ] ThreeAges su normalini ve `M_TA_Water_Center` materyalini oluştur.
- [ ] Üç Second Age Town Center `Water` slotunu bu materyale bağla.
- [ ] Static Mesh Editor preview ve RTS runtime hareket paritesini doğrula.

Kabul: Su normal detayı iki yönde kesintisiz hareket eder; yüzey donuk değildir,
River Water'a yabancı görünmez ve spline/foam/reflection koduna bağımlı değildir.

### Faz 3 — Imagen yüzey pilotu

İlk pilot yüzeyleri:

- [x] `wood-dark`
- [ ] `wood-light`
- [ ] `roof-clay`
- [ ] `wall-plaster`
- [ ] `stone-masonry`
- [ ] `rock-natural`
- [ ] `earth-compacted`
- [ ] `grass-meadow`
- [ ] `road-gravel`
- [ ] `tree-bark`
- [ ] `foliage-broadleaf`
- [ ] `foliage-pine`
- [ ] `water-center`

Her yüzey için:

- [ ] İki Imagen albedo adayı üret.
- [ ] Final prompt ve varyantı üretim günlüğüne yaz.
- [ ] Seamless post-process ve 3×3 preview üret.
- [ ] Normal ve ORM üret.
- [ ] Manifest texture kayıtlarını ekle.
- [ ] Materyal assetini oluştur ve Material Editor preview'da doğrula.

Kabul: Kullanıcı, doku ailesinin paletini ve tekrar davranışını pilot model/terrain
görüntülerinde kabul eder.

### Faz 4 — Box UVW ve slot atama otomasyonu

- [ ] Dry-run/apply CLI aracını ve mapping config'ini ekle.
- [ ] 1×1×1 Box UVW sidecar üretimini ekle.
- [ ] Genel slot ve asset-ailesi override kurallarını uygula.
- [ ] İdempotency, mevcut-sidecar koruması ve atomik yazmayı test et.
- [ ] Manifest/material id eksikliğini apply öncesi hard error yap.
- [ ] GLTF, collision ve Environment bütünlüğünü hash/diff ile doğrula.

Kabul: Pilot assetlere iki kez uygulama ikinci turda diff üretmez; material slot
sırası kaymaz ve source GLTF byte'ları değişmez.

### Faz 5 — Curvature/cavity vertex maskesi ve runtime paritesi

- [ ] Geometri adjacency/dihedral/ground-proximity analizini ekle.
- [ ] R/G/B/A kanal üretimini ve eşik/preset config'ini ekle.
- [ ] Asset vertex-color shared loader/apply yolunu ekle.
- [ ] Static Mesh Editor, Scene, RuntimeSceneApp ve RTS Actor paritesini bağla.
- [ ] Vertex count/reimport mismatch fallback ve warning'ini test et.
- [ ] Aşınmalı materyal layer presetlerini oluştur.

Kabul: İç köşeler kontrollü koyulaşır, büyük yüzeyler lekelenmez, dış köşe/zemin
kanalları debug görünümünde okunur ve sidecar oyunda gerçekten uygulanır.

### Faz 6 — Temsilci model ve Landscape pilot kabulü

Önerilen temsilciler:

- [ ] `Houses_FirstAge_3_Level3`
- [ ] `Barracks_SecondAge_Level3`
- [ ] `Resource_Tree1`
- [ ] `Resource_PineTree`
- [ ] `Mountain_Single`
- [ ] `TownCenter_SecondAge_Level1`
- [ ] `landscape-1` dört katmanı

Kontrol:

- [ ] Static Mesh Editor yakın/uzak preview.
- [ ] Standart RTS kamera yüksekliğinde okunabilirlik.
- [ ] Çatı/ahşap yönlenmesi ve texel yoğunluğu.
- [ ] Landscape normal/ORM blend ve yol okunabilirliği.
- [ ] Town Center su hareketi.
- [ ] Köşe kararması şiddeti.
- [ ] Takım renklerinin ve model siluetinin kaybolmaması.
- [ ] Kullanıcı görsel kabulü.

Kabul: Kullanıcı pilotu açıkça onaylamadan 128 modele toplu apply yapılmaz.

### Faz 7 — 128 modele kontrollü toplu uygulama

- [ ] Onaylı config ile 128 modele UVW/material sidecar uygula.
- [ ] Uygun modellerde curvature vertex-color sidecar üret.
- [ ] Existing sidecar değişim raporunu incele ve açık replace uygula.
- [ ] Bütün material/texture manifest kayıtlarını doğrula.
- [ ] Eşlenmeyen slot, eksik materyal veya model dışlama kalmadığını raporla.
- [ ] Modelleri aile bazlı görsel galeri/screenshot matrisiyle kontrol et.

Kabul: 128/128 model raporda kararlı sonuca sahiptir; kapsam dışı asset değişmemiş,
runtime'da missing texture/material warning'i oluşmamış ve kullanıcı aile bazlı
görsel kabul vermiştir.

### Faz 8 — Performans, tam doğrulama ve belge kapanışı

- [ ] Önce/sonra texture sayısı, GPU texture memory, program ve draw-call ölçümü al.
- [ ] Landscape sampler/program compile ölçümünü kaydet.
- [ ] Aynı ortak materyalin model instance'ları arasında paylaşıldığını doğrula.
- [ ] Yakın/uzak kamera ve fog altında shimmering/moiré kontrolü yap.
- [ ] `check:assets` ve tam build doğrulamasını çalıştır.
- [ ] Plan checkbox'larını yalnız kanıtla kapat.
- [ ] Kabul edilen prompt/asset günlüğünü tamamla.
- [ ] Bitmiş planı repo belge yaşam döngüsüne göre arşivle.

Kabul: Görsel kalite hedefi korunur, shader/sampler sınırı aşılmaz ve measured
runtime maliyeti kabul edilir.

## 12. Test ve Kabul Matrisi

| Alan | Otomatik kanıt | Browser/manuel kanıt |
| --- | --- | --- |
| Texture tile | boyut, power-of-two, seam metriği, dosya kanalları | 3×3 preview'da dikiş/landmark yok |
| Normal/ORM | kanal ve color-space kontrolü | ışık dönerken normal doğru, roughness okunur |
| Box UVW | 128 sidecar şeması, idempotency | model ailelerinde aynı texel yoğunluğu |
| Slot mapping | GLTF slot sırası → manifest id snapshot'ı | yanlış yüzey/material slot yok |
| Curvature | sentetik konkav/konveks mesh testleri | köşe koyuluğu kontrollü, geniş leke yok |
| Vertex sidecar | mesh/primitive/count doğrulaması | Editor ve RTS görünümü eşleşir |
| Landscape PBR | weight/fallback/shader testleri | dört layer geçişinde normal/roughness sürekliliği |
| Town Center su | schema/cache/time uniform testleri | üç modelde kesintisiz ve sakin hareket |
| Scope | GLTF/Environment hash karşılaştırması | Environment görünümü değişmemiş |
| Performans | texture/program/GPU ölçümü | hedef maçta hitch veya belirgin FPS düşüşü yok |

## 13. Doğrulama Komutları

Her TypeScript fazında hızlı kapı:

```powershell
npx.cmd tsc --noEmit
npm.cmd run test:engine -- --filter material,landscape,uvw,vertex,river-water
```

Filtre yalnız ilgili label'lar repo testlerinde bulunduğu ölçüde daraltılır; boş veya
yanlış filtre yeşil kanıt sayılmaz.

Asset fazlarında:

```powershell
npm.cmd run check:assets
git diff --check
```

Browser doğrulaması:

- `?editor` Static Mesh Editor materyal/UVW preview,
- Landscape lit mode dört katman,
- `?rts=&preset=gameplay_proof&flags=levelAssets` hedef oyun yolu,
- console error ve shader compile/link hatası kontrolü,
- pilot ve aile bazlı screenshots.

Broad shader/asset rollout ve final kapıda:

```powershell
npm.cmd run build:verify
```

Playwright ek katmandır; TypeScript ve engine testlerinin yerine geçmez. Manuel
görsel kabul de otomatik testle kapatılmaz.

## 14. Riskler ve Önlemler

| Risk | Önlem |
| --- | --- |
| Imagen tile kenarları dikiş yapar | deterministic seamless pass + 3×3 preview + seam eşik testi |
| Ahşap/kiremit yönü Box UV'de yanlış okunur | yönsüz/stilize yüzey dili; model-aile override'ı |
| Tek `Stone`/`Green` eşlemesi yanlış asseti boyar | genel mapping yerine asset-aile istisnaları ve hard-error dry-run |
| Landscape 12 sampler ile cihaz limitine yaklaşır | capability ölçümü, shader compile kabulü, açık düşük-capability fallback |
| Normal blend hatalı aydınlatma üretir | normalize edilmiş tangent-space blend ve ışık dönüşlü browser testi |
| ORM yanlış renk uzayında okunur | NoColorSpace doğrulaması ve kanal fixture testi |
| Vertex maskesi seyrek meshte geniş leke olur | density raporu; maskeyi atla, mesh'i otomatik tessellate etme |
| Sidecar yazımı mevcut manuel ayarı ezer | dry-run, default preserve, açık replace bayrağı |
| Asset vertex color runtime'da uygulanmaz | shared loader/apply fazı tamamlanmadan curvature kabulünü kapatma |
| Hareketli su her instance için materyal çoğaltır | paylaşılan materyal/cache ve uniform yaşam döngüsü testi |
| Environment yanlışlıkla etkilenir | kesin allowlist + hash/diff scope testi |
| Doku ayrıntısı RTS kamerasında gürültü yapar | uzak kamera kabulü, düşük kontrast, mip/anisotropy kontrolü |

## 15. Güvenlik ve Yazma Sınırı

Toplu araç yeni bir dev-server yazma endpoint'i açmadan lokal CLI olarak çalışır.
Yazma hedefini resolved absolute path ile doğrular ve yalnız StaticMeshes sidecar
uzantılarına izin verir. Manifest/material/texture ekleme adımları açık dosya
listesiyle yapılır.

İleride araç editör UI'sına veya localhost endpoint'ine taşınırsa path traversal,
payload validation ve overwrite sınırları için scoped Codex Security incelemesi
önerilir; bu plan otomatik olarak güvenlik taraması başlatmaz.

## 16. İlk Uygulanabilir Dilim

İlk kod dilimi **Faz 0 + Faz 1'in dar çekirdeği** olmalıdır:

1. Mevcut 128 model için read-only inventory/dry-run raporu ve mapping config
   iskeleti.
2. `loadForgeMaterialLayer()` sonucuna normal/ORM/scalar PBR alanları.
3. `LandscapeLayerTexture` sözleşmesinin bu alanlarla genişletilmesi.
4. Dört layer normal/ORM shader blend'i ve eksik-map fallback testleri.
5. Editor + RTS authored-world üzerinde sentetik/Starter texture ile browser smoke.
6. Henüz Imagen üretimi, Town Center suyu veya toplu sidecar yazımı yapmama.

Bu dilim Landscape'in kabul edilmiş PBR verisini gerçekten tüketebildiğini
kanıtlar. Doku üretimine geçildiğinde görüntü yalnız albedo fallback'iyle değil,
nihai hedef shader yoluyla değerlendirilebilir.

## 17. Tamamlanma Kriteri

Plan ancak aşağıdakiler birlikte sağlanınca tamamlanmış sayılır:

- Zorunlu V1 yüzeylerinin kabul edilmiş BC/N/ORM setleri proje içinde ve manifestte
  kayıtlıdır.
- Landscape dört katmanda albedo, normal ve ORM'yi Editor, Play ve RTS yolunda
  eşdeğer biçimde karıştırır.
- Üç Second Age Town Center su yüzeyi kesintisiz, düşük maliyetli normal hareketi
  gösterir.
- 128 Static Mesh'in tamamı açık mapping sonucuna, geçerli Box UVW sidecar'ına ve
  uygun materyal slotlarına sahiptir.
- Uygun modellerin curvature/cavity sidecar'ları runtime'da gerçekten uygulanır.
- GLTF dosyaları ve `Environment` assetleri değişmemiştir.
- Asset health, TypeScript, ilgili engine testleri, tam build ve browser smoke
  kapıları geçer.
- Texture/program/GPU ölçümü hedef desktop web bütçesinde kabul edilir.
- Pilot ve toplu aile görünümü kullanıcı tarafından manuel olarak kabul edilir.
