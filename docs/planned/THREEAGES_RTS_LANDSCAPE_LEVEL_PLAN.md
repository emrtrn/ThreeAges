# ThreeAges RTS Landscape Level Uygulama Plani

Olusturulma tarihi: 2026-07-23  
Durum: Planlandi - uygulama baslamadi  
Kapsam: `gameplay_proof` presetini Forge Editor ile duzenlenen, Landscape tabanli, oynanabilir bir RTS Level'a tasimak.

## 1. Hedef

`?rts&preset=gameplay_proof` artik kodla uretilen kart/blockout sahnesi yerine
Forge Level Editor'da tasarlanan ayni Level'i calistirir.

Tasarimci su isleri TypeScript degistirmeden yapabilir:

- Landscape olusturmak, sculpt etmek ve paint katmanlarini duzenlemek.
- Yol spline'lari, dekor, isik ve atmosfer eklemek.
- Oyuncu/dusman baslangiclarini, kaynaklari, agaclari, stratejik noktalari,
  build anchor'larini ve AI rotalarini tasimak.
- Level'i kaydedip ayni dosyayi RTS runtime'inda gormek.

V1'in oynanis hedefi **duz veya cok dusuk egimli oynanabilir ova**dir.
Gorunen tepe, sirt ve kayaliklar dekoratif veya acik navigation blocker olarak
kalir. Birimlerin yamac takip etmesi bu planin sonraki, ayri bir fazidir.

## 2. Basari Tanimi

Asagidaki akisin kod degisikligi olmadan calismasi hedeflenir:

1. Tasarimci RTS Landscape Level'ini Editor'da acar.
2. Landscape, yol, dekor veya RTS marker'ini degistirip kaydeder.
3. `http://127.0.0.1:5173/?rts&preset=gameplay_proof&flags=levelAssets`
   adresini acar.
4. Runtime ayni Level'in sahnesini ve marker tabanli oyun alanini kullanir.
5. Oyuncu/dusman baslangiclari, kaynaklar, agaclar, yapilasma, AI rota ve
   iki-flank ulasilabilirligi bozulmadan mac oynanir.

## 3. Mevcut Durum - Dogrulanacak Baslangic Noktasi

| Alan | Mevcut durum | Bu plandaki sonuc |
| --- | --- | --- |
| Landscape editor | Sculpt, paint, spline ve foliage authoring ile sidecar save mevcut | RTS Level'i ayni mekanizmayla tasarlanir |
| RTS spatial veri | `RtsLevelAdapter` start/resource/tree/anchor/route/blocker marker'larini `RtsSpatialLayout`a cevirir | `gameplay_proof` Level'i bu marker'larin tek aktif kaynagi olur |
| RTS runtime art | Authored static instance + light mount edilebiliyor | Landscape mount'u ve flat-ground fallback gate'i eklenir |
| Preset | `gameplay_proof.json` Level referansi tasimiyor | Ayrilmis RTS Level'a `levelRef` eklenir |
| Editor acilis | `?editor` varsayilan TestLevel'i acar | RTS Level'i secip/acabilen guvenli bir akis eklenir |
| Hareket ve picking | X/Z navigation, `y = 0` ground plane raycast'i | V1'de duz alan korunur; terrain-aware davranis ayri fazda gelir |

### 3.1 Kaynak dokuman uyumsuzlugu

`THREEAGES_RTS_CONTENT_ASSETIZATION_PLAN.md` Faz E basliginda Landscape
mount'u teslim edilmis gibi yaziyor. Kodda `buildAuthoredWorld(...)` yalnizca
static instance ve light yukluyor; `createRtsGround()` ile duz zemin her zaman
ekleniyor. Bu plan, uygulamaya baslarken eski dokumandaki bu satirlari gercek
uygulama durumuna gore duzeltir.

## 4. Otorite ve Sinirlar

| Veri / davranis | Otorite | Runtime sorumlulugu |
| --- | --- | --- |
| Heightfield, paint, spline, dekor, isik, atmosfer | RTS Level + Landscape sidecar | `RtsApp` generic authored-world host ile mount eder |
| Start, tree, kaynak, strategic point, anchor, AI rota | RTS marker Actor'lari | `RtsLevelAdapter` dogrular, `RtsSpatialLayout` tuketir |
| Maliyet, can, footprint, uretim, AI esigi | `public/game-data/balance/*.json` | RTS sistemleri uygular |
| Baslangic kaynaklari/roster, AI profili | preset | `main.ts` / `RtsApp` uygular |
| Nav gecis kurali | V1: marker blocker + mevcut grid navigation | Landscape goruntusunden otomatik turetilmez |
| Terrain yuksekligi | V1: yalniz sunum | Faz 7'de hareket, picking ve yapi sistemiyle birlikte oynanis verisi olur |

Kurallar:

- `RTS_BLOCKOUT_MAP` hemen silinmez. Flag kapali oldugunda ve Level yuklenemezse
  fallback olmaya devam eder.
- Static mesh veya Landscape goruntusunden gizli gameplay blocker turetilmez.
  Gecilemez alan, acik `BP_RTS_NavigationBlocker` veya ileride tasarlanmis
  heightfield-nav kuraliyla tanimlanir.
- Denge/preset verisi Level'a tasinmaz; Level yalniz mekansal otoritedir.
- `RuntimeSceneApp` RTS'ye tasinmaz. `RtsApp` kompozisyon kok noktasi kalir.
- Shipped Level dosyasi browser smoke tarafindan overwrite edilmez. Editor-save
  kabul testi elle veya izole fixture kopyasi ile yapilir.

## 5. Hedef Asset Envanteri

### 5.1 Yeni/duzenlenecek ana dosyalar

| Yol | Sorumluluk |
| --- | --- |
| `public/assets/ThreeAges/Levels/RTS_GameplayProof.level.json` | `gameplay_proof`un editlenebilir Level'i |
| `public/landscapes/rts-gameplay-proof.landscape.json` | Height, paint layer ve Landscape spline sidecar'i |
| `public/game-data/presets/gameplay_proof.json` | `levelRef` ile opt-in Level baglantisi |
| `public/project.3dgame.json` ve/veya editor Level-ac akisi | RTS Level'ini guvenli sekilde acmak |
| `src/scene/authoredWorld.ts` | Generic Landscape mount destegi |
| `src/game/rts/world/rtsAuthoredWorld.ts` | RTS alan siniri, Landscape host ve fallback karari |
| `src/game/rts/RtsApp.ts` | Flat ground, command/placement/road picking ve yuku birlestirme |
| `src/game/rts/world/rtsGround.ts` | Flat fallback veya V1 geriye-donus zemini |

### 5.2 RTS marker minimum envanteri

- Bir `BP_RTS_KingdomStart`: `owner=player`.
- Bir `BP_RTS_KingdomStart`: `owner=enemy`.
- Tum odun, tas, altin ve yiyecek dugumleri icin `BP_RTS_ResourceNode`.
- Her hasat edilebilir agac icin `BP_RTS_Tree`; forest id ve kapasite korunur.
- Her gecilmez dekoratif sirt/kayalik icin `BP_RTS_NavigationBlocker`.
- Dusman merkez/uretim yerlesimi ve genisleme alanlari icin build anchor /
  expansion marker'lari.
- `rts.route:enemy:base:0` ve gerekli expansion route spline'lari.
- Mevcut mac kurallari kullaniliyorsa strategic point marker'lari.

## 6. Fazlar ve Checklist

### Faz 0 - Envanter ve kabul sahnesi kilidi

Amac: Legacy blockout verisini kayipsiz tasimak icin baslangic envanterini ve
V1 arazi sinirini yazili hale getirmek.

- [ ] `RTS_BLOCKOUT_MAP` start, resource, tree, strategic point, anchor,
  expansion, route ve blocker verisini tabloya cikart.
- [ ] `gameplay_proof`un baslangic kaynaklari, unit roster'i ve AI profilini
  kayda al; Level tasimasinda bunlari degistirme.
- [ ] V1 oynanabilir alanini `RTS_WORLD_HALF_EXTENT` icinde belirle.
- [ ] Duz oynanabilir plato, gecilmez dekoratif yukseklikler ve flank koridorlari
  icin topoloji taslagini onayla.
- [ ] Mevcut `?rts&preset=gameplay_proof` davranisi icin ekran goruntusu ve
  debug referansi al.
- [ ] Mevcut `?rts&debug` rotasinda startlar arasi path ve temel build placement
  davranisini kayda al.

Kabul:

- Tasima listesi eksiksizdir; yeni Level ayni oyun verisini tasiyabilecektir.
- V1'in duz-zemin siniri aciktir; terrain-aware davranis bu faza sizmaz.

### Faz 1 - Ayrilmis Gameplay Proof Level ve editor acilis akisi

Amac: Tasarimcinin yanlislikla TestLevel'i veya shipped CoreMatch'i duzenlemeden
oyun sahnesini acabilmesi.

- [x] `RTS_GameplayProof.level.json`i CoreMatch/legacy envanterinden yeni,
  ayri bir authoring asset'i olarak olustur. (CoreMatch'ten birebir kopya; yalniz
  `name` = "RTS Gameplay Proof Markers". Manifest'e `rts-gameplay-proof-level`
  girisi eklendi.)
- [x] `gameplay_proof.json`a bu dosya icin `levelRef` ekle.
  (`assets/ThreeAges/Levels/RTS_GameplayProof.level.json`)
- [x] Preset ve Level yukleyici dogrulamalarinin yeni referansi kabul ettigini
  test et. (`Landscape Faz 1` engine testleri: preset ayri Level'a baglaniyor +
  Level legacy spatial sozlesmesini birebir uretiyor.)
- [x] Editor'a Level secme/acma akisi ekle veya manifest varsayilanini guvenli
  sekilde degistirmeden ayni sonucu veren dar bir URL/komut tasarla. (Mevcut
  Content Browser akisi yeterli: yeni Level manifest'te gorunur; sag-tik ->
  "Set Default Level" -> `editor.defaultScene`i yazip reload eder. Manifest
  varsayilani elle degistirilmedi.)
- [x] Editor save hedefinin gorunur oldugunu dogrula; kullanici hangi Level'i
  kaydettigini anlayabilsin. (Mevcut: header'da aktif Level adi +
  tooltip `Active level: <path>`; Save `defaultScene`e yazar.)
- [x] `?rts&preset=gameplay_proof&flags=levelAssets` ile Level marker'larinin
  aktif oldugunu `data-rts-level=authored` witness'iyle kanitla. (Smoke:
  `Landscape Faz 1: the gameplay_proof preset resolves its own authored Level`.)
- [x] Flag kapali rotada legacy fallback'in degismedigini dogrula. (Ayni smoke:
  flag kapali -> `data-rts-level=blockout`.)

Kabul:

- [x] Editor ve runtime ayni `RTS_GameplayProof.level.json`i yukler.
- [x] `gameplay_proof` ile `core_match` asset'leri birbirini overwrite etmez.
  (Ayri dosyalar; test `levelRef`'lerin farkli oldugunu zorlar.)

### Faz 2 - Marker envanterini Level'a tasima

Amac: Oyun mekaniği icin gerekli tum konum verisini koddan Level'a gecirmek.

Not: Faz 1'de `RTS_GameplayProof.level.json` CoreMatch envanterinin birebir
kopyasi olarak olusturuldugu icin marker'lar Level'da zaten yerlesik. Bu fazin
isi, tasinan verinin degerlerini korudugunu ve marker'larin gercekten runtime
otoritesi oldugunu testle kilitlemek.

- [x] Oyuncu/dusman start marker'larini yerlestir. (2 `BP_RTS_KingdomStart`;
  Faz 1 esdeglik testi `playerStart`/`enemyStart` legacy ile ayni.)
- [x] Tum resource node marker'larini tasiyip id, resourceId ve kind degerlerini
  koru. (6 node; `deepEqual(resourceNodes, legacy)`.)
- [x] Tum tree marker'larini tasiyip `treeId`, `forestId`, variant ve capacity
  degerlerini koru. (148 tree; `deepEqual(trees, legacy)`.)
- [x] Central ridge, map edge ve gecilmez dekorasyonlar icin acik blocker
  marker'larini tasiyip legacy AABB'lerle karsilastir. (1 `BP_RTS_NavigationBlocker`
  = merkez sirt; adapter AABB'si `deepEqual(navigationBlockers, legacy)`. Kenar
  blocker'i yok — Faz 0 karari #3: sadece dunya-siniri.)
- [x] Enemy base build anchor'larini tasiyip `owner` ve building id degerlerini
  dogrula. (14 anchor; `owner=enemy` + `deepEqual` anchor karsilastirmasi.)
- [x] Expansion marker uclusunu ve zorunlu enemy route spline'larini tasiyip
  route tag kurallarini dogrula. (2 bolge x 3 rol + 5 route; `deepEqual(enemyExpansions/enemyBaseRoute, legacy)`,
  adapter `rts.route:enemy:<region>:<index>` tag kuralini zorlar.)
- [x] Strategic point'leri tasiyip regional-victory flag'i acikken kontrol et.
  (2 point; Faz 2 otorite testi `StrategicPointSystem` ile contest davranisini
  kanitlar.)
- [x] Level marker hareketinin runtime spawn, kaynak veya AI rota davranisini
  degistirdigini hedefli bir testle kanitla. (`Landscape Faz 2` testi: player
  start -> nav route baslangici; resource node -> `canExtractAt`; strategic
  point -> contest konumu marker'i takip eder.)

Kabul:

- [x] `resolveRtsSpatialLayout(level)` legacy oyun yuzeyine esdeger veri uretir.
- [x] Oyuncu ve dusman arasinda iki flank uzerinden en az bir gecerli rota vardir.
  (`keeps both flanks` + Faz 2 testi tasinan start'tan da rota planlar.)
- [x] `levelAssets` kapaliyken eski blockout maci calismaya devam eder.
  (smoke: flag kapali -> `data-rts-level=blockout`.)

### Faz 3 - Landscape authoring asset'i ve V1 saha tasarimi

Amac: Kartezyen grid goruntusunu, oyun kurallarini bozmadan gercek araziyle
degistirmek.

- [ ] Level'a 140x140 dunya ayak izini kapsayan Landscape ekle; spacing ve
  vertex yogunlugunu performans/hedef sanat kararina gore sec.
- [ ] Landscape sidecar yolunu `rts-gameplay-proof.landscape.json` olarak
  sabitle ve save/reload'u dogrula.
- [ ] Merkezi oynanabilir plato ile iki flank koridorunu duz veya cok dusuk
  egimli tut.
- [ ] Yollarin, bina alanlarinin ve iki base'in altini duzle; yapi footprinti
  icin yeterli bosluk birak.
- [ ] Uc, sirt, gol yatagi veya gecilemez dekoru oynanabilir alandan ayir;
  gerekiyorsa marker blocker ekle.
- [ ] Grass/Dirt/Rock/Snow katmanlarina gercek materyalleri bagla; gorunen
  layer adi atanmis materyal adini yansitsin.
- [ ] Road spline'larini olustur; yolun gameplayde walkable fakat build
  placement icin rezervli olma kuralini koru.
- [ ] Foliage'i ayri authoring konusu olarak ele al; dekoratif instance ile
  depletable RTS tree marker otoritesini birbirine karistirma.
- [ ] Kamera, golge ve fog okunurlugunu top-down gorusle kontrol et.

Kabul:

- Editor Landscape save/reload sonrasinda height, paint ve spline verisini
  korur.
- Mac basladiginda zemin grid degil, ayni Landscape goruntusudur.
- Oynanabilir alanin hicbir zorunlu yolu gorunmez egim nedeniyle belirsiz veya
  kullanilamaz hale gelmez.

### Faz 4 - Authored Landscape runtime mount ve flat fallback gate'i

Amac: RTS runtime'inin Level Landscape'ini generic kodla yuklemesi; fallback
rotasinin guvenilir kalmasi.

- [ ] `AuthoredWorldHandle` / `buildAuthoredWorld`a Landscape sidecar yukleme,
  render group olusturma ve GPU dispose destegi ekle.
- [ ] Landscape material/texture, golge alma ve sidecar fetch hatalarini
  generic host'ta ele al.
- [ ] `rtsAuthoredWorld`a RTS Landscape alan sinirini ve proje URL cozucusunu
  ekle; generic host RTS sabitlerini bilmesin.
- [ ] `RtsApp`te Level Landscape basariyla yuklendiginde duz plane/grid'i
  gizle veya kaldir; Landscape yuklenemezse duz plane/grid geri kalsin.
- [ ] Legacy ridge/dekor gate'ini authored Landscape ile cakismaz hale getir.
- [ ] Fog, territory ve command marker katman siralarini Landscape ustunde
  okunur kil.
- [ ] Restart/dispose sonrasi Landscape geometry, material ve texture
  kaynaklarinin serbest kaldigini test et.
- [ ] `data-rts-authored-world` witness'ini `ready` ve `fallback` durumlariyla
  browser smoke'ta kanitla.

Kabul:

- `levelAssets` acikken RTS ayni Landscape'i render eder.
- Landscape sidecar veya asset hatasi maci karartmaz/kitlenmez; flat fallback
  calisir.
- Flag kapaliyken mevcut `createRtsGround()` davranisi degismez.

### Faz 5 - V1 duz-zemin oynanis uyumlulugu

Amac: Gercek arazi goruntusu altinda mevcut X/Z RTS kurallarini guvenle korumak.

- [ ] Command, road ve building placement ground raycast'lerinin V1 duz
  oynanabilir alanda beklenen X/Z noktasini verdigini kontrol et.
- [ ] Unit, command center, structure ve progress overlay'lerinin zeminle
  cakisarak okunmaz hale gelmedigini kontrol et.
- [ ] Baslangic unitlerinin, kaynak noktalarinin ve agaclarin Landscape'e
  gorsel olarak dogru oturdugunu elle dogrula.
- [ ] Birim hareketi, unit separation, tree harvesting, worker construction ve
  AI expansion akisini iki flankte smoke et.
- [ ] Yapi preview/placement, yol placement ve control territory sinirlarini
  kontrol et.
- [ ] Fog of war ve regional victory flag'leri acikken terrain/dekor
  okunurlugunu kontrol et.
- [ ] Eglimli veya oyuk alanlara birim/path/placement girmesini V1 tasarimla
  engelle; gerekirse o alanlari blocker ile kapat.

Kabul:

- Normal bir gameplay match'i baslatma, ekonomi, yapi, uretim ve savas
  akisini regress etmez.
- Duz zemin varsayimi gizli bir failure degil, authored Level tasarimiyla
  korunmus bilincli bir sinirdir.

### Faz 6 - Editor-to-runtime kabul ve dokumantasyon

Amac: Bir tasarimcinin sahneyi kendi basina duzenleyip runtime'da dogrulayabilmesi.

- [ ] Editor'da RTS Gameplay Proof Level'ini acma adimlarini dokumante et.
- [ ] Landscape actor secimi -> `Details > Landscape Mode` -> Sculpt/Paint
  akisini dokumante et.
- [ ] Marker yerlesimi icin id/tag/owner degismezleriyle kisa authoring
  rehberi ekle.
- [ ] Kaydet -> runtime ac -> Level flag kontrolu icin kesin URL'leri ekle.
- [ ] Editor save'in shipped Level'i degistirdigini acikca bildir; fixture/
  kopya ile deneme yolunu tanimla.
- [ ] Eski blockout ve yeni Landscape URL'lerini yan yana smoke et.
- [ ] Bu dokumanin checklist'ini kanitla birlikte guncelle; ana assetization
  planindaki stale Faz E Landscape iddiasini duzelt veya buraya yonlendir.

Kabul:

- Yeni bir oturum, ekstra kod kesfi yapmadan ayni Level'i Editor'da degistirip
  RTS'de gorebilir.
- Manuel browser kabul adimlari otomatik testlerden ayri ve acik kayitlidir.

### Faz 7 - Terrain-aware RTS (V1 sonrasi, ayri onay gerekir)

Bu faz V1'e dahil degildir. V1 kabulunden sonra, yukseklik farkli yollarda
oynanis istenirse birlikte ele alinacaktir:

- [ ] Landscape height sample API'sini RTS runtime'a bagla.
- [ ] Unit Y konumunu terrain height'a projekte et; spawn, move, separation ve
  combat mesafesini ayni kuralla guncelle.
- [ ] Ground picking'i `y=0` plane yerine Landscape raycast'ine tasi.
- [ ] Building/road preview ve tamamlanmis yapilari terrain yuksekligi ve
  egimine hizala.
- [ ] Eğim, step-height ve gecilebilirlik profilini veriyle tanimla.
- [ ] Grid navigation'a height/slope maliyeti ya da heightfield nav katmani
  ekle; route, formation ve congestion davranisini yeniden test et.
- [ ] Projectile, health/progress overlay, selection/marquee ve fog'un terrain
  yukseklikleriyle uyumlulugunu tamamla.

Bu fazin baslamasi, mekanik arazi avantaji/engeli istenip istenmedigine dair
ayri tasarim karari gerektirir.

## 7. Test ve Kabul Matrisi

| Degisiklik | Otomatik kanit | Manuel/browser kabul |
| --- | --- | --- |
| Preset/Level baglantisi | preset-loader ve `rtsLevelAdapter` testleri | `data-rts-level=authored` |
| Marker tasimasi | start/resource/tree/route reachability testleri | start, kaynak ve AI rota yerlesimi |
| Landscape sidecar | landscape save/validator/engine testleri | Editor sculpt/paint -> reload |
| Runtime mount | authored-world unit/smoke testi | `data-rts-authored-world=ready`, gorunur terrain |
| Flat fallback | hata/fallback regression testi | flag kapali veya yanlis sidecar ile oynanabilir sahne |
| RTS oynanis | hedefli command, placement, nav, economy testleri | iki flank move, build, road, hasat, AI match |
| Kaynak omru | TypeScript + engine test | restart, Level reload ve browser console hatasi kontrolu |

Her uygulama fazinda asgari gate:

```powershell
npx.cmd tsc --noEmit
npm.cmd run test:engine
npm.cmd run build:verify
```

UI/render/picking degisen fazlardan sonra ek browser gate:

```powershell
npm.cmd run smoke:browser -- tests/smoke/rts-assetization-baseline.spec.ts
```

Landscape authoring degisikliklerinde ilgili Landscape smoke'lari da
calistirilir. Otomasyon, Editor -> shipped Level overwrite kabulunun yerine
gecmez; bu adim kontrollu manuel test olarak kayit edilir.

## 8. Riskler ve Kararlar

| Risk | Etki | Onlem |
| --- | --- | --- |
| Landscape'i render etmek terrain navigation sanilabilir | Birimler egimde havada/zeminde kalabilir veya picking sapar | V1 plato siniri ve blocker'larla koru; Faz 7'yi ayri tut |
| Level artindan gameplay blocker cikarmak | Cift otorite, gizli path failure | Oynanis blocker'larini marker/balance ile acik tanimla |
| `gameplay_proof` Level'i CoreMatch ile paylasmak | Editor save yanlis senaryoyu bozar | Ayrilmis `RTS_GameplayProof.level.json` kullan |
| Shipped JSON'a browser smoke ile yazmak | Calisma agaci kirlenir | Fixture/kopya ve manuel kabul kullan |
| Foliage ile hasat agaclarini aynilastirmak | Kaynak durumu ile dekor cakisir | `BP_RTS_Tree` gameplay otoritesini koru |
| Yeni World mount kaynak sizintisi | Restart sonrasi GPU/DOM bozulur | Handle dispose ve restart smoke zorunlu |

## 9. Tamamlanma Kapisi

Bu plan ancak su maddelerin tamami kanitlandiginda tamamlanir:

- [ ] `gameplay_proof` kendi Level referansini tasir ve `levelAssets` ile acar.
- [ ] Editor ayni Level'i guvenli sekilde acar ve kaydeder.
- [ ] Level Landscape'i sculpt/paint/spline verisiyle runtime'da gorunur.
- [ ] Start, kaynak, agac, AI rota/anchor ve blocker'lar Level'dan gelir.
- [ ] Duz oynanabilir plato uzerinde command, build, road, economy ve AI match
  kabul edilir.
- [ ] Flag kapali/failure durumunda legacy flat blockout fallback calisir.
- [ ] TypeScript, engine, build ve ilgili browser smoke gate'leri yesildir.
- [ ] Editor -> save -> runtime manuel kabul kaydi alinmistir.
- [ ] Assetization planindaki Landscape durum notu gercek kodla uyumludur.

## 10. Uygulama Sirasi

Bir sonraki kod dilimi **Faz 1** olmalidir: ayrilmis Gameplay Proof Level'i,
`levelRef` baglantisi ve Editor'da o Level'i acma akisi. Bu tamamlanmadan
Landscape sanatina gecilmez; aksi halde tasarim calismasi yanlis sahneye veya
gecici blockout otoritesine yapilmis olur.
