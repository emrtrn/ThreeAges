# ThreeAges RTS Painted Roads Plani (Yol Araci + Landscape Paint)

Olusturulma tarihi: 2026-07-24  
Durum: Faz 0-5 uygulandi (kod + testler yesil, kullanici Faz 0-4'u test etti);
Faz 6 gorsel/smoke kaniti kullaniciya bagli  
Kapsam: RTS yol aracinin gorselini kutu mesh'lerden landscape paint katmanina
tasimak. Grid/lojistik mantigi ve maliyet modeli degismez; degisen yalniz
sunumdur. Spline aktor veya road mesh bu planin kapsaminda degildir.

Isaretler: `[ ]` yapilmadi, `[~]` kismen, `[x]` tamam.

## 1. Hedef

Oyuncunun (ve AI'nin) yol araciyla insa ettigi yollar, ekrandaki kahverengi
kutu tile'lar yerine, landscape'in dirt katmanina (M_GroundDirty) boyanmis
dogal patikalar olarak gorunur — el ile landscape paint yapilmis yolla ayni
gorsel dil.

Bunu saglayan birlesme noktasi: motorun Landscape Spline (Faz 6 Road Tool)
makinesi zaten koridor + smoothstep falloff + Catmull-Rom yumusatma ile paint
uygulayabiliyor (`applyLandscapeSplinePaint`). Runtime yol agi her degisiminde
bir `ForgeLandscapeSpline`'a cevrilir ve ayni fonksiyonla boyanir. Boylece
editor spline araciyla oyuncu yol araci ayni veri tipini ve ayni boyama
fonksiyonunu konusur.

Sanayi-donemi izgara gorunumunu kiran uc kaldirac:

1. `smooth: true` Catmull-Rom — kose donusleri kavise doner.
2. Koridor `width`/`falloff` — keskin kenar yerine cimenle karisan yumusak kenar.
3. Deterministik jitter + genislik/strength varyasyonu — uzun duz kosular
   hafifce kivrilir, elle boyanmis hissi verir (Faz 4).

## 2. Basari Tanimi

1. `?rts&preset=gameplay_proof&flags=levelAssets` rotasinda yol insa edilir;
   yol kutu mesh olarak degil, terrain'e boyanmis dirt patika olarak gorunur.
2. Yol silme/reset sonrasi terrain eski haline doner (boya kalinti birakmaz).
3. Lojistik davranis birebir korunur: hucre maliyeti, bagladigi bilesenler,
   depot/market/AI yol kullanimlari degismez.
4. Landscape mount edilmemisse (fallback duz zemin) bugunku kutu render aynen
   calisir; mac hicbir kosulda yolsuz/karanlik kalmaz.
5. Landscape sidecar dosyasina runtime'dan hicbir yazma olmaz.

## 3. Mevcut Durum - Dogrulanmis Baslangic Noktasi

| Alan | Mevcut durum | Bu plandaki sonuc |
| --- | --- | --- |
| Yol rotasi | `RoadGraph` 4-yonlu (Manhattan) grid, `cellSize: 2` (`public/game-data/balance/roads.json`) | Aynen kalir; yalniz gorsel degisir |
| Yol gorseli | `RoadPlacementSystem.createSegmentMesh` merkez pad + kol kutulari | Landscape varken uretilmez; boya devralir |
| Commit kancasi | `RoadConstructionService.onCommitted` -> `RtsApp` icinde `renderNetwork()` (RtsApp.ts ~640) | Ayni kancaya painter sync'i baglanir |
| Spline paint makinesi | `applyLandscapeSplinePaint` + `splineToPolyline(smooth)` + smoothstep koridor (`engine/scene/landscape.ts`) | Runtime painter bunu dogrudan cagirir |
| Canli chunk guncelleme | `updateLandscapeObjectGeometry` kirli chunk'lari yeniden kurar; editor fircasi emsal (`SceneApp.refreshLandscapeGeometry`) | Boya sonrasi donen bounds ile cagrilir |
| Runtime landscape mount | `buildAuthoredWorld` yukler ama `AuthoredWorldHandle` data/object disari acmiyor | Handle genisletilir (Faz 1) |
| Landscape verisi | `landscape-1`: 129x129, spacing 1.094, aktor origin'de (dunya = lokal) | Koordinat donusumu trivial |
| Paint katmanlari | grass=starter-mat-grass, dirt=m-grounddirty, rock=m-gravel, snow slotu=m-cooblestone | Oyuncu yolu: `dirt`; cag terfisi: cobblestone (Faz 5) |
| El referansi | Editor spline'i: width 4 / falloff 3, smooth, cobblestone paint | Ana yol referansi; oyuncu patikasi biraz dar olur |
| Fog | Unknown=opak siyah duzlem, explored=yari. Kutu yollar da ayni sekilde gorunuyor | Boyali yol ayni davranisi verir; regresyon yok |
| Testler | `RoadGraph` ve `applyLandscapeSplinePaint` testleri `tools/engine-tests.ts` icinde | Yeni donusum ayni harness'a eklenir |

## 4. Otorite ve Sinirlar

| Veri / davranis | Otorite | Kural |
| --- | --- | --- |
| Yol topolojisi, maliyet, baglanti | `RoadGraph` + `roads.json` | Painter salt okur; asla graph'a yazmaz |
| Terrain boyasi (runtime) | Bellek-ici `ForgeLandscapeData` kopyasi | Diske/sidecar'a yazilmaz; dev save endpointleri zaten editor-only |
| Terrain yuksekligi | Degismez | Runtime'da `deform` KAPALI kalir — `y = 0` picking/nav kontrati ve collider bozulmasin |
| Kutu-mesh render | Fallback | Landscape mount edilmemisse tek gorsel yol olarak kalir |
| Engine genelligi | `engine/` + `src/scene/` | RTS kurali sizmaz; handle'a eklenen alanlar genel amaclidir (herhangi bir fork kullanabilir) |
| Painter yeri | `src/game/rts/roads/` | Oyuna ozgu politika (katman secimi, genislik, jitter) game kodunda yasar |

Ek kurallar:

- Boya destructive oldugundan mount aninda katman agirliklarinin el degmemis
  (pristine) kopyasi alinir; her ag degisimi "restore -> tam yeniden boya"
  olarak uygulanir. Tek tip yol, silme/reset/AI dahil tum mutasyonlari kapsar.
- Painter, `RoadGraph.version` uzerinden kirlilik kontrolu yapar; hangi yoldan
  mutasyon gelirse gelsin (`commit`, `remove`, `clear`) tek `sync()` girisi
  vardir. (`reset()` `onCommitted` atesletmez — kancaya guvenilmez.)
- Onizleme (translucent kutular) bu planda degismez; okunur bir affordance.

## 5. Dokunulacak Dosyalar

| Yol | Sorumluluk |
| --- | --- |
| `src/scene/authoredWorld.ts` | `AuthoredWorldHandle.landscapes` (data + object + position + layerColors) |
| `src/game/rts/roads/roadTerrainPainter.ts` (yeni) | Graph -> spline donusumu, pristine snapshot, restore + repaint, chunk refresh |
| `src/game/rts/roads/roadPlacementSystem.ts` | Landscape varken kutu-mesh uretimini devre disi birakma |
| `src/game/rts/RtsApp.ts` | Painter kurulumu, `loadAuthoredWorld` baglantisi, sync noktalari (commit/reset) |
| `public/game-data/balance/roads.json` (veya sabitler) | Gorsel parametreler: width, falloff, strength, jitter genligi |
| `tools/engine-tests.ts` | Graph -> spline donusum ve restore/repaint birim testleri |

## 6. Fazlar ve Checklist

### Faz 0 - Parametre kilidi ve referans goruntu

Amac: "Dogal" gorunumun hedefini olcule baglamak; tuning'i tahmine degil
karsilastirmaya dayandirmak.

- [ ] El ile boyanmis patikanin (mevcut ekran goruntusu) referans olarak
  kayda alinmasi; ayni acidan "once" goruntusu (kutu yollar) alinmasi.
  (Kullaniciya bagli — tarayici goruntusu gerekir.)
- [x] Baslangic parametrelerinin karara baglanmasi: oyuncu yolu
  `layerId: "dirt"`, `width 2.5` (cellSize x 1.25), `falloff 2.0`,
  `strength 0.9`. (El referansi ana yol: 4/3/1.0 — oyuncu patikasi dar kalir.)
- [x] Parametrelerin nerede yasayacaginin secimi: `roads.json` `visual` blogu
  (`RoadVisual`, `validateRoadBalance` — `visual` yoksa yerlesik varsayilanlar).
- [ ] 129 grid / 1.094 spacing cozunurlugunun 2.5 genislikte yeterli okunur
  kenar verdiginin goz karariyla teyidi (kullaniciya bagli gorsel dogrulama).

Kabul:

- [x] Parametre seti ve saklama yeri yazili (`roads.json` `visual`); Faz 4
  tuning'i bu taban uzerinden A/B yapilabilir.

### Faz 1 - AuthoredWorldHandle landscape erisimi

Amac: Runtime kabugun (RtsApp) mount edilmis landscape'in verisine ve render
nesnesine ulasabilmesi. Genel amacli host genisletmesi; RTS bilgisi icermez.

- [x] `buildAuthoredWorld` donusune `landscapes: readonly MountedLandscape[]`
  eklenmesi: `{ data: ForgeLandscapeData; object: LandscapeObject;
  position: Vec3; layerColors: LandscapeLayerColors }`
  (`src/scene/authoredWorld.ts`).
- [x] `layerColors`'in disari verilmesi — `updateLandscapeObjectGeometry`
  vertex-color fallback'inin dogru tintle calismasi icin gerekli.
- [x] Dispose semantiginin korunmasi: handle dispose'u `root`'u traverse ederek
  chunk geometrilerini serbest birakir; painter yeni geometriyi ayni mesh
  child'ina koydugu icin dispose guncel geometriyi yakalar (dogrulandi).
- [x] `npx tsc --noEmit` (Painted Roads dosyalarinda temiz) + `test:engine` yesil.

Kabul:

- [x] RtsApp, `handle.landscapes[0]` uzerinden data + object'e erisebiliyor
  (`setupRoadPainter`); salt kontrat genislemesi, davranissal degisiklik yok.

### Faz 2 - RoadTerrainPainter cekirdegi (graph -> spline -> paint)

Amac: Yol agini dogal boyaya ceviren, test edilebilir cekirdek.

- [x] Saf donusum fonksiyonu: `roadGraphToLandscapeSpline(segments, opts)`
  (`src/game/rts/roads/roadTerrainPainter.ts`, three.js'siz).
  - Derece != 2 / yon degistiren (kose) hucreler kontrol noktasi olur; ayni
    dogrultudaki ara hucreler atilir (yarim-kenar dedup ile her kenar bir kez).
  - Kavsaklar paylasilan point'e baglanan segmentlerdir.
  - `smooth: true`; her segmente `paint: { enabled, layerId, strength }`;
    point'lere `width`/`falloff` (Faz 0 parametreleri). Tek hucreli yol
    sifir-uzunluklu self-segment ile disk olarak boyanir.
- [x] Painter: `RoadPaintSurface` pristine snapshot + boyali bounds takibi;
  `repaint()` = onceki bolge pristine'den geri yukle -> spline kur ->
  `applyLandscapeSplinePaint` -> birlesik dirty bounds dondur.
  `RoadTerrainPainter.sync()` bunu `updateLandscapeObjectGeometry` ile besler.
- [x] Dunya -> landscape-lokal donusumu `position` offset'i ile (aktor
  origin'de; local = world - origin). Rotasyon destegi kapsam disi (dokumante).
- [x] Birim testleri (`tools/engine-tests.ts`, 8 yeni check): duz kosu tek
  segment; L kosesi paylasilan point; T kavsagi 3 kollu paylasilan point;
  lone-cell dab; jitter determinizmi + genlik siniri; reroute residu birakmaz
  (restore+repaint == taze paint); reset/bos graph pristine'e doner.
- [x] `test:engine` yesil (1084 check; tsc Painted Roads dosyalarinda temiz).

Kabul:

- [x] Donusum ve restore/repaint testlerle kanitli.

### Faz 3 - RtsApp entegrasyonu ve fallback

Amac: Painter'in gercek oyun akisina baglanmasi; kutu render'in devri.

- [x] `loadAuthoredWorld` basarisinda (`handle.landscapeCount > 0`)
  `setupRoadPainter` painter'i kurar; `RoadPlacementSystem.setPaintedMode(true)`
  kutu segment mesh'lerini durdurur (preview kutulari kalir).
- [x] Sync noktalari: `onCommitted` kancasi `syncRoadVisuals()`e baglandi
  (`renderNetwork()` + `roadPainter?.sync(all, version)`); `restartMatch`
  akisinda `roadPainter?.reset()`. Hepsi tek `RoadGraph.version` kontrollu giris.
  (`remove()` RtsApp'te cagrilmiyor — gelecekteki combat hook'u; ayni sync'e
  dusecek sekilde hazir.)
- [x] AI yol insasi ayni `onCommitted` -> `RoadConstructionService.build`
  kancasindan gecer, dolayisiyla ayni sync'ten boyanir (yollar sahipsiz).
- [x] Landscape'siz rota: `setupRoadPainter`e hic girilmez, `data-rts-roads`
  "mesh" kalir, kutu render aynen calisir.
- [x] Restart: `roadPainter?.reset()` pristine restore + `lastVersion=-1`;
  dispose'da `authoredWorld.dispose()` sonrasi `roadPainter = null`.
- [ ] Fog etkilesimi goz karariyla teyit (kullaniciya bagli gorsel dogrulama;
  boya kutu ile ayni fog binderi altinda oldugu icin regresyon beklenmez).
- [~] Witness eklendi: `canvas.dataset.rtsRoads = "mesh" | "painted"`.
  `smoke:browser` genisletmesi (RTS rotasinda boya witness'i) acik; su an
  build agaci esZamanli riverWater WIP'i yuzunden gecici olarak kirmizi.

Kabul:

- [x] Kod yolu tamam: landscape'li rotada insa/restart dongusu boyayi surer;
  landscape'siz rotada kutu gorunum birebir korunur (witness ile ayrilir).

### Faz 4 - Dogallik tuning'i (jitter ve varyasyon)

Amac: Izgara hissini kiran organik dokunuslar; tumu deterministik (ayni ag
her boyamada ayni gorunur).

- [x] Uzun duz kosulara `jitterSpacingCells` (varsayilan 5) hucrede bir ara
  kontrol noktasi; hucre koordinatindan turetilen hash ile dik yonde
  `+-jitter` (varsayilan 0.6) birim jitter. Yol mantiksal hucrelerinde kalir
  (paint kozmetik; nav/lojistik `RoadGraph`'tan okunur, degismez).
- [x] Kose/kavsak (node) noktalari jitter'siz kalir — kavsak okunurlugu korunur
  (plandaki "daha kucuk jitter"den daha guvenli secim; dokumante edildi).
- [x] Nokta basina genislik varyasyonu (`widthVariation`, +-%15 varsayilan)
  interior jitter noktalarinda.
- [x] Parametreler `roads.json` `visual`'dan okunur; `jitter: 0` +
  `widthVariation: 0` => Faz 3 davranisi (dumduz kosu). Testle sabitlendi.
- [ ] Referans goruntuyle yan yana karsilastirma; kullanici onayi (bekliyor).

Kabul:

- [x] Ayni yol agi iki kez boyandiginda ayni sonucu verir (determinizm testi:
  "roadGraphToLandscapeSpline jitter is deterministic ...").
- [ ] Kullanici gorunumu "dogal" olarak onaylar (gorsel onay bekliyor).

### Faz 5 - Cag baglantisi (opsiyonel, ayri onay)

Amac: Merkez-gudumlu ilerlemeyle gorsel terfi — yol agi ayni kalir, boyanan
katman cag ile degisir.

- [x] Age -> `layerId` secimi `roads.json` `visual.ageLayers` ile veri-gudumlu:
  `settlement -> dirt` (M_GroundDirty), `town -> rock` (m-cobblestonerough =
  M_CobbleStone_Rough). Cozumleme `RtsApp.roadLayerForAge`; eslesmeyen age
  varsayilan `layerId`'ye duser (asla yolsuz kalmaz).
  (Not: kullanici landscape'te materyalleri yeniden atadi — cobblestone artik
  "rock" slotunda, "grass"=genel, "dirt"=1. cag, "rock"=2. cag, "snow"=gravel.)
- [x] Tier "completed" event'inde (player) `roadPainter.setLayer(event.age) +
  syncRoadVisuals()` -> tek repaint (restore + yeni katmanla boya). `setupRoadPainter`
  baslangicta mevcut age katmanini kurar; `reset()` settlement katmanina doner.
- [x] Layer id'leri sabit (grass/dirt/rock/snow); gorunumu atanan materyal
  belirler (R4 karari). 2. cag yolu, cobblestone materyalinin atandigi "rock"
  slotunu boyar (`layerId: "rock"`); sidecar/validator migrasyonu gerekmez.

Kabul:

- [x] Cag atlaminda mevcut yollar tek repaint'te yeni katmana terfi eder;
  `RoadGraph` topolojisi/maliyeti degismez (painter salt okur). Testle sabit:
  "Faz 5: an age layer swap promotes the same road with no old-layer residue".
- [ ] Gorsel onay: town cagina gecince yollarin cobblestone'a donmesi (kullanici).

### Faz 6 - Kabul, smoke ve dokumantasyon

Amac: Kaniti toplamak ve plani kapatmak.

- [ ] Once/sonra ekran goruntuleri (Faz 0 referanslariyla ayni aci) — kullanici.
- [~] Smoke kapsami: witness (`data-rts-roads`) eklendi; RTS rotasinda boya
  witness assertion'i acik (build agaci esZamanli riverWater WIP'i yuzunden
  gecici kirmizi).
- [x] `docs/architecture/UNREAL_BASICS_LESSONS.md` Progress Log kaydi (2026-07-24).
- [x] Bu dokumanin checklist'i kanitla guncellendi.
- [x] Davranis degisikligi Progress Log'da notlandi (yol gorseli artik terrain
  boyasi; landscape'siz rotada kutu render fallback).

Kabul:

- [~] Dokumanlar gercek durumu anlatiyor. `test:engine` yesil; `build:verify`
  Painted Roads acisindan temiz ama esZamanli riverWater WIP'i bitene kadar
  butun gate yesillenemez.

## 7. Riskler ve Acik Kararlar

- **R1 - Repaint maliyeti:** `applyLandscapeSplinePaint` tum grid'i tarar
  (16.6k vertex x sub-segment sayisi). Commit sikliginda kabul edilebilir
  (editor apply ile ayni sinif). Gerekirse iyilestirme: taramayi spline
  bbox + falloff pad ile sinirla. Faz 3 sonunda olculur, erken optimizasyon
  yapilmaz.
- **R2 - Fog "explored" sizintisi:** Yari seffaf explored alanda sonradan
  insa edilen AI yolu gorunur. Bugunku kutu yollarla birebir ayni davranis
  oldugu icin regresyon degildir; "hatirlanan durum" fog'u ileride ayri bir
  konu.
- **R3 - Cozunurluk:** 1.094 spacing'de 2.5 birimlik yol 2-3 vertex'tir;
  kenarlar yumusak/benekli okunur (istenen el-boyamasi hissi). Daha keskin
  istenirse editor tarafinda `resampleLandscapeData` ile 257'ye cikma
  secenegi vardir — runtime plani etkilemez, ayri authoring karari.
- **R4 - 4 katman siniri ve slot adlari (KARAR: id'ler korundu):** Splat malzemesi
  4 katmanla sinirli; layer id'leri (grass/dirt/rock/snow) sabit birer anahtar,
  gorunumu atanan materyal belirliyor. Kullanici cobblestone'u "rock" slotuna
  atadi, dolayisiyla `ageLayers.town = "rock"`. Id'ler **degistirilmedi** —
  yeniden adlandirma sidecar + validator migrasyonu gerektirir, gorsel kazanc yok.
- **R5 - Cift gorsel kaynak:** Editor'de elle boyanmis yollar ile runtime
  yol boyasi ayni katmani kullanir; pristine restore yalniz runtime'in
  boyadigi bolgeyi geri alir, el boyamasi korunur (snapshot mount'taki
  durumu — el boyamasi dahil — taban kabul eder). Bu davranis Faz 2
  testlerinde sabitlenir.
- **R6 - Rotanin kendisi:** 4-yonlu arama korunur; 8-yonlu/kose-maliyetli
  arama lojistik semantige dokunan ayri bir gameplay karari olarak kapsam
  disidir. Gorsel yumusatma + jitter bu plandaki cozumdur.
