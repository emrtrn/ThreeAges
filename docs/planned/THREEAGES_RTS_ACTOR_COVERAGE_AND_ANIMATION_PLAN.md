# ThreeAges RTS Tam Actor Kapsamasi ve Skeletal Animasyon Plani

Olusturulma tarihi: 2026-07-22  
Durum: Planlandi. Baslangic dilimi: Guard + Isci UAL1 locomotion pilotu.

## 1. Karar ve amac

Evet: uzun vadeli hedefte her oynanabilir RTS unit'i ve her gameplay building
kimligi bir Actor Script karsiligina sahip olmalidir. Ancak bunu tek seferde
legacy tablolari silerek yapmak dogru degildir. Actor Script yalnizca sunum ve
authoring otoritesidir; balance JSON oynanis sayilarini, Level mekansal veriyi
ve RTS sistemleri simulasyonu tasimaya devam eder.

Bu plan iki sonucu birlikte teslim eder:

1. `?rts&flags=contentAssets` altinda Guard ve Isci, ayni UAL1 skeletal mesh
   uzerinde idle/yurume animasyonlari oynatan gercek bir teknik pilot olur.
2. Tum 11 building balance id'si, construction ile yas/seviye varyantlarini
   kapsayan kademeli Actor cataloguna tasinir; eksik her mapping yalnizca kendi
   legacy gorseline geri duser.

Bu, tek bir UAL1 mesh'ini hem Guard hem Isci icin kullanmayi ilk testte kabul
eder. Bu teknik bir paylasimdir; nihai rol okunabilirligi icin farkli mesh,
ekipman veya author edilmis material ayrimi sonra gerekir.

## 2. Mevcut durum

### 2.1 Faz C'nin yaptigi ve yapmadigi

- `BP_RTS_Guard.actor.json`, `ual1-standard-rm` skeletal mesh id'sine
  baglidir. `guard_placeholder`, bugunku balance kimligidir; gercek Guard
  gameplay satiridir.
- `worker_placeholder`, `archer_placeholder` ve `siege_placeholder` catalogta
  mapping tasimaz; bunlarin fallback'i `Unit` icindeki capsule/box
  geometrisidir. Oyunda gorulen kapsul bu birimlerden biri olabilir.
- Barracks construction, Settlement Lv1 ve Lv2 Actor Script ile calisir.
  Diger yapilar halen `rtsBuildingArt.ts` -> `RtsBuildingVisuals` legacy
  yolundan gelir. Bu Faz C'nin kasitli pilot siniridir.
- UAL1 gercek skin ve animation clip'leri tasir. `UAL1_Standard_RM.skeleton.json`
  `Idle_Loop`, `Walk_Loop`, `Sprint_Loop` gibi semantic isimleri tanimlar.
- Buna ragmen `RtsActorVisualFactory`, glTF yuklerken yalnizca `scene` template'ini
  saklar. `gltf.animations` atilir; `RtsPresentationHandle` mixer veya frame
  delta almaz. Dolayisiyla bugunku Actor Guard hareketli mesh degil, statik
  skeletal pose'dur.
- Mevcut `RtsBuildingVisuals.applyToCenter()` Actor adapter'ini bypass eder.
  Command Center'in tam kapsama girmesi icin bu ayri yol da tasinmalidir.

### 2.2 Building envanteri

Balance tablosunda 11 id vardir:

| Grup | Id'ler | Authoring kapsami |
| --- | --- | --- |
| Yas/seviye degisen | command_center, house, depot, outpost, farm, market, barracks, archery_range | Settlement/Town x Lv1/Lv2/Lv3 |
| Sabit model | lumber_camp, quarry, gold_mine | Her id icin tek completed Actor |

Bu, tamamlanmis gorunum icin 51 Actor class ref'i (48 yas/seviye + 3 sabit)
ve construction icin 11 class ref'i demektir. Ayni static mesh birden fazla
Actor tarafindan kullanilabilir; Actor class sayisi editor authoring kimligini
acik tutar. Gercek construction mesh'i yoksa construction Actor, tamamlanmis
meshi veya acikca author edilmis placeholder component agacini kullanir.

## 3. Degismez sinirlar

- `public/game-data/balance/*.json`: maliyet, can, footprint, uretim,
  prerequisite, level ve savas sayilarinin tek otoritesidir. Actor'a tasinmaz.
- `public/game-data/content/rts-content.json`: balance id -> Actor ref ve
  presentation secim tablosudur. Asset path'leri balance dosyasina girmez.
- `public/assets/ThreeAges/Actors/`: component agaci, mesh, transform, varsayilan
  clip ve salt sunum authoring'idir.
- `RtsApp`, `Unit`, `UnitSystem`, `RtsBuildingVisuals`: Actor handle'larini
  simulation state'inden besler; Actor Script gameplay karari vermez.
- Root motion kullanilmaz. Mevcut RTS navigation/unit hareketi konumu otoriter
  kalir; UAL1 sidecar'indaki `lockXZ` ayarlari korunur.
- `contentAssets` flag'i kapaliyken ve tek bir Actor mapping'i bozukken legacy
  oyun oynanabilir kalir. Bir dosyadaki hata tum asset pack'i kapatmamalidir.

## 4. Hedef teknik sozlesme

### 4.1 Unit presentation ve animasyon

`RtsPresentationHandle` asagidaki presentation-only bilgiyi alacak sekilde
genisletilir:

```ts
update({
  deltaSeconds,
  locomotion: "idle" | "move",
  dying,
}): void;
```

`Unit`, var olan hareket/path durumundan bu kucuk snapshot'i uretir; Actor
factory yalnizca snapshot'i clip secimine cevirir. `RtsApp` render-frame
delta'sini `UnitSystem.updatePresentation(...)` icinden handle'a iletir.

Factory bir skeletal Actor yuklediginde:

1. glTF `scene` ile birlikte `animations` listesini cache'ler;
2. skeleton sidecar'ini yukleyip `animationSet` semanticlerini okur;
3. unit instance'i basina `CrossfadeAnimator` kurar;
4. idle icin `Idle_Loop`, hareket icin `Walk_Loop` (gerekirse `Jog_Fwd_Loop`)
   secip crossfade uygular;
5. handle dispose edilirken mixer action'larini durdurur ve uncaches eder.

Ilk dilim sadece idle/move uygular. `Sword_Attack`, `Fixing_Kneeling` ve
`Death01` sonraki animasyon durumlaridir; combat/worker/death presentation
olaylari kesinlestirilmeden oynatilmamalidir.

### 4.2 Catalogun yas/seviye yapisi

Bugunku `levels: { "1": actorRef }` yalnizca Barracks'in Settlement pilotuna
yeter. Tam kapsama icin schema, age ve level'i birlikte secmelidir:

```json
{
  "buildings": {
    "barracks": {
      "construction": { "settlement": "...", "town": "..." },
      "completed": {
        "settlement": { "1": "...", "2": "...", "3": "..." },
        "town": { "1": "...", "2": "...", "3": "..." }
      }
    }
  }
}
```

Migration, eski `constructionActorRef` ve `levels` seklini okuyup yeni seklin
lehine cozecek; eski pilot catalogu derhal kirilmaz. Resolver girdisi
`(buildingId, state, age, level)` olur. Command Center, placement preview,
construction, age reset ve level-up bu tek resolver'i kullanir.

### 4.3 Hata izolasyonu

`RtsActorVisualFactory.load()` bugun bir ref yuklenemezse tum factory'yi
fallback'e iter. Yeni davranis her Actor ref'ini bagimsiz yukler, basarisiz
ref'i `unavailable` olarak kaydeder ve bir kez uyarir. Basarisiz unit/building
yalnizca kendi capsule/legacy modelini kullanir; calisan mapping'ler Actor
sunumuna devam eder.

## 5. Uygulama fazlari

### Faz 1 - Animasyon altyapisi ve Guard/Isci pilotu

Teslimatlar:

- `RtsPresentationHandle` delta + locomotion snapshot sozlesmesi.
- glTF animation cache, UAL1 skeleton-sidecar loader ve `CrossfadeAnimator`
  tabanli handle.
- `BP_RTS_Guard` ile yeni `BP_RTS_Worker` Actor asset'leri; ikisi de UAL1'i
  kullanir, idle/move clip'leri author edilir.
- Catalogta Guard ve Isci mapping'i; mevcut role ring/health bar/pick target
  korunur.
- Per-ref failure isolation ve mevcut capsule fallback regression testi.

Kabul:

- Birim dururken `Idle_Loop`, hareket emriyle `Walk_Loop` gorulur; durunca
  crossfade ile idle'a geri doner.
- Guard ve Isci ayni UAL1 mesh'ini kullanabilse de gameplay statlari,
  selection radius, production ve role kurallari degismez.
- Flag kapali yol ve bilerek kirik Worker Actor ref'i legacy oyunu bozmadan
  calisir.

### Faz 2 - Tum building schema ve base coverage

Teslimatlar:

- Age-aware catalog schema + backward-compatible validator/resolver.
- `RtsBuildingVisuals.applyToCenter`, preview, construction ve completed
  path'lerinin tek Actor resolver'ina gecisi.
- Her 11 id icin construction Actor ve Settlement Lv1 completed Actor.
- Manifest registration, Content Drawer klasor/tag duzeni ve asset-health
  coverage.

Kabul:

- Her build-palette yapisi, preview ve construction halinde Content Drawer'da
  author edilen bir Actor kullanir ya da sadece kendi legacy fallback'ine duser.
- Command Center dahil hicbir yapi ozel legacy bypass ile render edilmez.

### Faz 3 - Age/level matrisi ve legacy daraltma

Teslimatlar:

- Sekiz aged yapi icin Settlement/Town x Lv1/Lv2/Lv3 completed Actor setleri.
- Uc sabit resource yapisi icin completed Actor setleri.
- Age reset, structure upgrade ve AI-completed construction sonrasi dogru
  `(age, level)` Actor secimi.
- Kapsama raporu: 11/11 building id, 51/51 completed ref, 11/11 construction
  ref.

Kabul:

- Her completed building varyanti dogru Actor'u secer; Barracks T1 -> T2
  kontrolu tum aged yapi matrisi icin genisler.
- `rtsBuildingArt` yalnizca flag-off veya bilerek eksik mapping fallback'i
  olarak kalir; tum refler tamamlandiginda preload maliyeti de kaldirilir.

### Faz 4 - Unit rol ayrimi ve genis animasyonlar

Teslimatlar:

- Archer ve Siege Actor karar/enventeri; nihai Guard/Worker role gorunurlugu
  (mesh, equipment veya material authoring).
- Guard attack/death, Worker work/death, Archer/Siege uygun durum animasyonlari.
- Unit animasyonlari icin uzaklik/culling profili ve 20/40-unit performans
  regression testi.

Kabul:

- Her unit balance id'si Actor mapping'ine sahiptir; fallback geometry normal
  `contentAssets` akisinda gorunmez.
- Animation state gameplay sonucunu degistirmez ve root motion ile unit
  konumunu kaydirmaz.

## 6. Test ve kabul matrisi

| Katman | Otomatik kontrol | Etkilesimli kabul |
| --- | --- | --- |
| Schema | Bilinen balance id + age/level matrix + eski catalog migration | Yok |
| Factory | UAL1 clips/sidecar semanticleri, mixer dispose, tek-ref fallback | Yok |
| Unit | idle -> move -> idle state, stat/pick target korunumu | `?rts&flags=contentAssets` icinde yurume crossfade'i |
| Building | 11 id ve 62 Actor ref kapsam raporu, preview/construction/upgrade resolver | Content Drawer'da bir model degistir/save -> runtime goruntusu |
| Performans | 20 ve 40 active UAL1 instance frame-budget testi | Kamera yakin/uzak gozlemi |

Her faz sonunda `npx.cmd tsc --noEmit`, `npm.cmd run test:engine`, hedefli
Playwright smoke, `npm.cmd run check:assets` ve `npm.cmd run build:verify`
calisir. Content Drawer'da kaydetme sonrasi goruntu degisikligi otomatik
testin yerine gecmeyen manual kabul olarak kaydedilir.

## 7. Baslangic sirasi

Sonraki uygulama isi Faz 1'dir: once UAL1 animation cache/mixer ve per-ref
fallback izolasyonu, sonra Worker Actor mapping'i, ardindan Guard + Isci
idle/yurume browser smoke'u. Tum yapi Actor migration'i bu calisan skeletal
pilotun ardindan Faz 2'de baslar; boylece ayni anda hem schema matrisi hem
animasyon belirsizligi acilmaz.
