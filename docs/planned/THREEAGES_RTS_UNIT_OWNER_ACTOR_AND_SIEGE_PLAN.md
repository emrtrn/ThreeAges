# RTS Birim Owner Actor'lari ve Coklu-Component Topcu Plani

Olusturulma tarihi: 2026-07-26  
Durum: Faz 1 ve Faz 3 tamamlandi (2026-07-26). Faz 2 kismen: sekiz Actor
dosyasinin tamami mevcut, kalan madde asagida isaretli. Faz 4 bekliyor.

Renk semasi (kullanici karari, 2026-07-26): isciler her iki tarafta da tintsiz
(`ual1-standard-rm`in kendi sari-turuncusu), oyuncu muhafizi turkuaz `#2fb3ad`,
enemy muhafiz kirmizi `#c23b2f`. Okçu ve topçu rol renklerinde birakildi.

## Karar

RTS birim sunumu, yapilarla ayni Content Actor akisini kullanacaktir. Her
oynanabilir birim kimligi bir varsayilan Actor'a sahip olur; `enemy` owner'i
ayrica kendi, Content Drawer'da duzenlenebilir Actor varyantina sahip olur.

```text
unit balance id + owner
  -> rts-content.json
  -> Player/default veya Enemy Actor ref'i
  -> Actor component agaci + manifest assetleri
  -> Unit presentation handle
```

Actor sadece sunum otoritesidir. `units.json` maliyet, can, hasar, hiz,
uretim, AI karar verme veya navigation verisi tasimaya devam eder. Bir enemy
Actor'un secilmesi AI'yi veya birimin davranisini degistirmez.

## Kapsam

Mevcut dort gameplay kimligi icin sekiz authoring sinifi olur:

| Gameplay id | Varsayilan / player Actor | Enemy Actor |
| --- | --- | --- |
| `guard_placeholder` | `BP_RTS_Guard.actor.json` | `BP_RTS_Enemy_Guard.actor.json` |
| `worker_placeholder` | `BP_RTS_Worker.actor.json` | `BP_RTS_Enemy_Worker.actor.json` |
| `archer_placeholder` | `BP_RTS_Archer.actor.json` | `BP_RTS_Enemy_Archer.actor.json` |
| `siege_placeholder` | `BP_RTS_Siege.actor.json` | `BP_RTS_Enemy_Siege.actor.json` |

Tum dosyalar `public/assets/ThreeAges/Actors/Units/` altinda yer alir ve
Content Drawer > Units tarafindan acilip kaydedilebilir.

`enemy`, yeni bir unit balance id'si degildir. Mevcut birimlerin `owner`
degeridir. Bu nedenle "AI Enemy Unit" adinda tek, role bagimsiz bir Actor
olusturulmaz: her role'un kendi enemy Actor'u vardir. Bu, bir enemy isciyi
duzenlemenin enemy muhafiz veya topcuyu istemeden etkilemesini engeller.

## Katalog sozlesmesi

`rts-content.json.units` girisi varsayilan Actor'u korur ve owner override'i
ekler. Uygulamada isimlendirme `ownerActorRefs` olacaktir:

```json
"worker_placeholder": {
  "actorRef": "assets/ThreeAges/Actors/Units/BP_RTS_Worker.actor.json",
  "ownerActorRefs": {
    "enemy": "assets/ThreeAges/Actors/Units/BP_RTS_Enemy_Worker.actor.json"
  }
}
```

- `actorRef`: player ve ileride explicit override'i olmayan owner'lar icin
  varsayilandir.
- `ownerActorRefs.enemy`: enemy birimin sunumunu yalnizca bu dosyaya yoneltir.
- `ownerActorRefs.player` author edilmez; player icin tek otorite `actorRef`tir.
  Validator bunu reddeder. Boylece iki farkli player otoritesi olusmaz.
- Override'i olmayan veya bozuk bir enemy ref'i varsayilan Actor'a sessizce
  dusmez. Tam katalog yuklendikten sonra acik presentation placeholder gorur ve
  debug sayaci artar. Bu, enemy sanat kapsama hatasini gorunur kilar.

`rtsUnitActorRef` owner parametresi alacak; `RtsActorVisualFactory` bu parametreyi
yok saymak yerine resolver'a iletecek. Ref toplama/manifest yukleme,
`ownerActorRefs` icindeki ref'leri de kapsayacak. `UnitSystem`in yeni spawn ve
zaten sahnede olan birimler icin yaptigi presentation backfill ayni factory
cagrisini kullanmaya devam eder.

## Actor ve asset authoring'i

Ilk uygulama, mevcut `BP_RTS_Guard`i koruyup yukaridaki yedi yeni dosyayi
ekler. Enemy Actor'lar ilk gunde player Actor ile ayni mesh'i kullanabilir;
ayri dosya olmalari yine de Content Drawer'da bagimsiz duzenlenebilirlik
saglar. Farkli siluet, ekipman veya material hazir oldugunda yalnizca ilgili
enemy Actor degistirilir.

Her mesh `assets/manifest.json`daki bir `assetId`ye baglidir. Yeni model
import edilirse once manifest kaydi eklenir; `.actor.json` dosyasina dosya yolu
degil, yalnizca bu id yazilir. `SkeletalMeshComponent` yalnizca `skeletalMesh`,
`StaticMeshComponent` yalnizca `staticMesh` asseti kullanir.

Mevcut pakette insan karakteri icin `ual1-standard-rm` vardir; Worker/Archer
icin nihai role-ozgu model veya ekipman gelene kadar bu bir teknik gecis
secenegidir, nihai sanat karari degil. Her role ayni insan modelini kalici
olarak atamak rol okunabilirligini dusurur. Content Actor'lar bu gecisi
kolaylastirir: modele veya component agacina sonradan gecmek gameplay degisimi
gerektirmez.

## Topcu: component agaci ve tekerlek hareketi

Topcu bir tek birlesik mesh olarak author edilmez. Hem player hem enemy siege
Actor'u en az su semantic component yapisini tasir:

```text
root (Transform)
|- chassis       (StaticMeshComponent)
|- turretPivot   (Transform)
|  `- barrel     (StaticMeshComponent)
|- leftWheelPivot  (Transform, wheel-spin motion)
|  `- leftWheel  (StaticMeshComponent)
`- rightWheelPivot (Transform, wheel-spin motion)
   `- rightWheel (StaticMeshComponent)
```

- `chassis`, `barrel`, `leftWheel` ve `rightWheel` manifestte kayitli, ayri
  static mesh assetleri olur. Sol/sag tekerlek ayni asseti paylasabilir, fakat
  farkli component id ve pivotlari olmak zorundadir.
- Pivotlar tekerlek merkezinde author edilir. Meshin export orijini merkezde
  degilse mesh pivotun altinda local `position` ile merkezlenir; runtime bu
  export hatasini tahmin etmez.
- Namlu `turretPivot` altinda kalir. Namlu yukselmesi, recoil ve hedefe donus
  bu dilimin kapsami degildir; bu hiyerarsi sonraki sunum durumlarini eklemeye
  uygundur.
- Her Actor kendi named component agacina sahip olur. Actor Script assetler
  arasinda component inheritance olmadigi varsayilir; player/enemy siege
  agaclari bilerek acik dosyalar olarak tutulur ki ikisi Content Drawer'da
  bagimsiz degistirilebilsin.

### Tekerlek-donusu sozlesmesi

Static mesh tekerlekler icin presentation-only `wheelSpin` metadata'si
eklenecek. Metadata tekerlegi tasiyan `Transform` pivotunun prop'u olarak
saklanir ve Actor Script Editor'da bu Transform seciliyken bir "RTS wheel spin"
bolumuyle duzenlenir:

```json
{
  "id": "leftWheelPivot",
  "component": "Transform",
  "parent": "root",
  "props": {
    "position": [-0.72, 0.34, -0.18],
    "rtsPresentationMotion": {
      "kind": "wheelSpin",
      "axis": "x",
      "radius": 0.34,
      "direction": 1
    }
  }
}
```

`rtsPresentationMotion` Actor'un genel engine davranisi degildir; RTS unit
presentation adapter'inin okudugu, allowlistli bir sunum prop'udur. Runtime:

1. Actor agaci olusturulduktan sonra motion yazan component id'lerini bulur.
2. Her frame, unit'in olculen gercek planar hizini kullanir. Birim crowd veya
   path blokaji nedeniyle ilerlemiyorsa tekerlek de donmez.
3. Donus miktarini `speed * deltaSeconds / radius` radyan olarak hesaplar ve
   yalnizca tanimli local eksene uygular; `direction` sol/sag export yonu
   farklarini duzeltir.
4. Unit gameplay konumu, navigation'i ve skeletal root motion bu kod tarafindan
   degistirilmez.

`radius` sifir/negatif/non-finite olamaz; `axis` yalniz `x`, `y` veya `z`; 
`direction` yalniz `-1` veya `1` olur. Yanlis metadata, ilgili Actor'u ref ve
component id ile placeholder'a dusuren validation hatasidir. Tekerlek componenti
olmadan `wheelSpin` yazmak da hatadir.

Bu mekanizma generic bir "Actor tick script"e donusturulmez. Sadece unit
presentation handle'i icinde calisir ve birim hareketinin gorunur karsiligidir.

## Uygulama asamalari

### Faz 1 — Katalog ve owner resolver — **TAMAMLANDI (2026-07-26)**

1. [x] `RtsUnitContentEntry`ye `ownerActorRefs` ekle; schema validator'i owner
   anahtarlarini ve Actor reflerini dogrulasin. — `ownerActorRefs` +
   `validateOwnerActorRefs`; `player` anahtari ve bilinmeyen owner reddedilir.
2. [x] Owner-aware `rtsUnitActorRef` yaz; factory'nin mevcut `_owner`
   parametresini bu resolver'a bagla. — owner parametresi varsayilan `"player"`.
   Ayrica `createUnitPresentation` artik yuklenememis bir ref icin `null`
   dondurup legacy govdeye dusmuyor; placeholder handle'i donduruyor.
3. [x] Katalog ref toplama, pack load raporu ve coverage testine enemy
   reflerini ekle. — `rtsContentCatalogRefs` owner ref'lerini de topluyor;
   coverage `unit:<id>@enemy` gap'i uretiyor (yeni
   `rtsUnitOwnerActorRefIsAuthored`), yani fallback bir kapsama bosluguu gizleyemez.
4. [x] Dort varsayilan ve dort enemy mapping'i `rts-content.json`e gir.

Not: Plan yazilirken yalnizca `BP_RTS_Guard` vardi; iskelet-animasyon track'i bu
arada Worker/Archer/Siege varsayilan Actor'larini da eklemisti. Bu nedenle Faz 1
ile birlikte yalnizca dort enemy dosyasi yazildi (yedi degil) ve Faz 2 adim 1
kapandi.

Kabul: player ve enemy ayni gameplay id ile spawn oldugunda farkli Actor
ref'leri secilir; bir enemy ref'i bozulursa player birimi etkilenmez ve debug
overlay bunu placeholder olarak raporlar.

### Faz 2 — Dort rolun Content Actor seti

1. [x] Worker, Archer ve Siege varsayilan Actor'larini; Guard, Worker, Archer ve
   Siege enemy Actor'larini olustur. — Sekizi de mevcut ve manifestte kayitli.
   Enemy'ler simdilik ayni `ual1-standard-rm` mesh'ini kirmizi aile
   `materialTint`leriyle kullaniyor; nihai sanat Faz 4.
2. [x] Tum sekiz ref'in manifest/component validation'dan gectigini dogrula. —
   mevcut "Faz 2: every catalog Actor is renderable" testi artik sekizini de
   kapsiyor (ref toplama enemy'leri de aldigi icin).
3. [x] Eski `approvedUnitExceptions` listesini kaldir; kapsama istegi dort unit
   balance id'sinin tamamini zorunlu kabul etsin. — liste bos; alan yalnizca
   yari-authored fork'lar icin kaciş yolu olarak duruyor.
4. [ ] Her unit icin pick target, secim halkasi, health bar ve existing animation
   handle davranisini regression testle koru.

Kabul: normal `?rts` akisi role-shaped kod geometrisine dusmez; Content
Drawer'da bir Actor'un mesh veya transformu kaydedildiginde o role'un yeni
oyununda gorunur.

### Faz 3 — Siege component motion — **TAMAMLANDI (2026-07-26)**

1. [x] `rtsPresentationMotion.wheelSpin` parse/validate et; Actor Script
   Editor'a form alanlarini ekle ve raw prop round-trip'ini koru. — yeni
   `src/game/rts/content/rtsPresentationMotion.ts`; hatali metadata
   `validateRtsPresentationActor` uzerinden Actor'u placeholder'a dusuruyor.
   Editor'da her `Transform` icin "RTS wheel spin" bolumu (toggle, axis, radius,
   direction); prop normal Actor Script props verisi oldugu icin `/__save-actor`
   yolunda ek allowlist gerekmiyor, round-trip testle pinlendi.
2. [x] Actor presentation tree'de component id -> runtime node baglantisini
   presentation handle'a ver. — node'lar `RTS_ACTOR_COMPONENT_ID` userData'si
   tasiyor (isim degil: component id'leri bone isimleriyle ayni namespace'i
   paylasiyor), `findActorComponentNode` + `bindRtsWheelSpins`.
3. [x] Wheel driver'i `RtsUnitPresentation.update()` icine ekle; skeletal
   animatorla birlikte, fakat ondan bagimsiz calissin. — animator early
   return'unun *ustunde*: topçunun mixer'i yok, animator'a bagli olsa tekerlekler
   hic donmezdi. Olculen `planarSpeed` kullaniliyor, authored `moveSpeed` degil.
4. [x] Player ve enemy Siege Actor'larini ayri chassis/barrel/tekerlek
   componentleriyle author et.

Not: Pakette topçu sanati yok. Iki Siege Actor'u da manifestteki primitive
shape'lerden kuruldu (`shape-cube` govde, `shape-cylinder` namlu, `shape-torus`
tekerlek) ve torus'un merkez-disi export orijini pivot altinda local `position`
ile merkezlendi. Nihai mesh Faz 4'un isi; component agaci ve wheelSpin sozlesmesi
model degistiginde aynen kalir.

Olcek tuzagi: `Shapes` paketinin modelleri accessor'larinda 100 birim, fakat
0.01'lik kucultmeyi glTF *node*'unda tasiyorlar — yani dosyada zaten 1 birimlik.
Olcuyu accessor'dan okuyup bir 0.01 daha uygulamak topçuyu 100 kat kucuk yapar:
yuklenir, validate olur, tekerlegi doner ve gorunmez. Actor verisinin icinde
bunu soyleyebilecek hicbir sey yok, o yuzden regression testi mesh'in kendisini
okuyup yazili `radius`un gercek tekerlek yaricapina esit oldugunu ve govdenin
bir arac boyutunda kaldigini dogruluyor.

Kabul: topcu yururken iki tekerlek ayni mesafeyi kat edecek sekilde doner,
dururken donmez; component local transformlari ve namlu/pivot hiyerarsisi
korunur.

### Faz 4 — Sanat ve browser kabul

1. Gerekliyse Worker/Archer/Siege icin nihai meshleri import et ve manifestte
   kaydet; role okunabilirligini yeniden incele.
2. Enemy Actor'lara farkli mesh/ekipman/material uygulanacaksa sadece
   owner-varyant dosyalarini degistir.
3. `?rts&debug` altinda player ve enemy ordularini, hareketli topcuyu ve
   Content Drawer'da acilan tum sekiz Actor'u browser smoke ile dogrula.

## Test matrisi

| Katman | Senaryo | Beklenen |
| --- | --- | --- |
| Catalog unit | `enemy` override | Enemy ref secilir, player `actorRef`te kalir |
| Catalog unit | bilinmeyen owner anahtari | Yuklemede anlamli validation hatasi |
| Factory | sekiz unit Actor ref'i | Her biri mesh/manifest/component agaci ile yuklenir |
| Factory | bozuk enemy ref | Yalniz o varyant placeholder; player ref saglam |
| Tree | Siege'in dort mesh componenti | Chassis, barrel, sol ve sag tekerlek ayri node'lardir |
| Presentation | wheelSpin | Hareket mesafesi/radius kadar local pivot doner; dururken donmez |
| Unit regression | pick/ring/health | Actor degisimi gameplay veya secimi bozmaz |
| Browser | `?rts&debug` | Sekiz Actor yuklu, placeholder sayisi 0, console error yok |
| Browser | Content Drawer | Sekiz Actor aranir, acilir ve durumlari `Ready.` olur |

Her TypeScript degisikliginden sonra:

```text
npx.cmd tsc --noEmit
npm.cmd run test:engine
npm.cmd run build:verify
```

Actor/Three.js/Content Drawer degisikligi oldugu icin ayrica hedefli Playwright
smoke calistirilir. Onemli testler `rts-assetization-baseline`e eklenecek veya
ayri bir `rts-unit-actor-presentation` spec'ine konur. Content Drawer kaydi ve
oyun goruntusu arasindaki manuel kabul, otomatik testin yerine gecmez.

## Dosya etkisi envanteri

- `public/game-data/content/rts-content.json`
- `public/assets/ThreeAges/Actors/Units/BP_RTS_*.actor.json`
- `public/assets/manifest.json` ve yeni mesh dosyalari (sanat import edilirse)
- `src/game/rts/content/rtsContentCatalog.ts`
- `src/game/rts/content/rtsContentValidation.ts`
- `src/game/rts/content/rtsActorVisualFactory.ts`
- `src/game/rts/content/rtsActorPresentationTree.ts` (runtime node metadata
  gerekiyorsa)
- `src/game/rts/content/rtsUnitPresentation.ts`
- `src/editor/ActorScriptEditor.ts`
- Ilgili engine ve Playwright testleri

Yeni `*.skeleton.json` sidecar alani eklenirse, save yolunda sessizce
dusmemesi icin `tools/saveValidator.ts`de ilgili `validate*` fonksiyonuna da
allowlist eklenmelidir. Bu plandaki `rtsPresentationMotion` Actor prop'u ise
Actor Script'in normal props verisidir; yine de editor ve save round-trip testi
zorunludur.

## Bilincli olarak sonraya birakilanlar

- Top namlusunun hedefe donmesi, atis recoil'i ve muzzle VFX.
- Tekerleklerin terrain egimine gore suspension'i.
- Worker work, Guard/Archer attack ve death animation state'leri.
- Material override veya faction-skin sistemi. Enemy Actor dosyalari bunu
  destekleyecek authoring noktasini simdiden saglar, fakat sistem ayri bir
  karardir.
- Yeni unit rolleri. Yeni bir balance id eklendiginde hem varsayilan hem enemy
  Actor mapping'i coverage testi tarafindan zorunlu kilinmalidir.
