# ThreeAges RTS V3 - Yirtici Baskisi Plani (Wolf, Fox)

Olusturulma tarihi: 2026-08-03
Durum: **Faz 7'nin otomatik gorevleri kapandi (2026-08-04)** - §4'teki bes karar
kilitli (1=A, 2=B, 3=A, 4=B, 5=A); yalnizca Faz 7 tam mac gorsel/oynanis kabulu
acik.
Onkosul: `THREEAGES_RTS_WILDLIFE_AND_HUNTING_PLAN.md` V1 (Faz 0-7) ve
`THREEAGES_RTS_V2_PASTURE_AND_TAMING_PLAN.md` (Faz 0-7) tamamlandi, ikisinin de
gorsel kabulu verildi.

Bu dosya, yaban hayati yol haritasinin (`...WILDLIFE_AND_HUNTING_PLAN.md` §12)
**V3** maddesini yurutur. V1 dosyasi yol haritasinin surucusu olarak
`docs/planned/` altinda kalir; bu dosya onun altindaki ucuncu surumun plani.

## 1. Hedef

V1 haritaya **sonlu**, V2 **kalici** bir yiyecek kolu ekledi. Ikisinin de ortak
bir varsayimi vardi: **harita edilgendir**. Bugun disari cikmanin tek riski
rakip AI'dir, ve rakip AI genelde kendi ekonomisiyle mesguldur. Sonuc, oyunun
kendi sozlerinden ikisinin bos kalmasi:

> **Karakol** neden var? Cunku bir gun dusman gelir. Ne zaman geldigini
> bilmedigin surece Karakol ertelenebilir bir masraftir.
> **Muhafiz eskortu** neden var? Cunku bir gun isci saldiriya ugrar. Ugramadigi
> surece eskort, ekonomiden calinan bir askerdir.

Kurt bu iki soruyu **ilk dakikadan** cevaplar. Bolgenin disindaki yalniz isciye
saldiran bir yirtici, oyuncunun zaten sahip oldugu iki araci - kontrol alani ve
asker - ilk kez **gercekten kullanilan** seyler yapar. Yeni bir sistem satmaz;
var olan sistemlere **neden** kazandirir.

Ikinci kazanc bedavadir: kurtlar geyik de avlar. Harita, oyuncu bakmadigi zaman
da bir seyler olan bir yer gibi gorunur - ve avladigi her geyik, oyuncunun
avlayamayacagi bir geyiktir. V1'in "sonlu kaynak" iddiasina bedava bir baski
eklenir.

Ucuncu kazanc en ucuzu: risk artik **konuma** baglidir. V1 "uzaktaki suru daha
zengin" dedi, V2 "sinirdaki agil daha karli" dedi; ikisinin de bedeli yalnizca
**yuruyus suresiydi**. Kurt o bedeli gercek yapar.

## 2. Basari Tanimi

1. Haritada **kurt yuvalari** vardir; kurtlar kendi bolgelerinde devriye gezer,
   geyik gibi otlamaz - hareketleri avci gibi okunur.
2. Kontrol alaninin **disindaki** yalniz isci, menzile giren bir kurt tarafindan
   hedef alinir. Kurt isciye kosar, `Attack` klibini oynatir ve hasar verir.
3. Kontrol alaninin **icindeki** isci hedef alinmaz. Bu, Karakol'un ve kontrol
   alaninin V3'teki somut degeridir.
4. Saldiri **sessiz degildir**: bildirim akisinda bir uyari cikar ve oyuncu
   kamerayi oraya goturebilir.
5. Saldirilan isci **kacar veya olur**; hicbir sey sessizce kaybolmaz.
   Isci kendi basina kurdu hedef almaz (V1 §3.9 kurali korunur).
6. Yakindaki **Muhafiz kurdu hedef alir** ve oldurur. Bir kurt ilk kez asker
   isteyen, ama ordu istemeyen bir tehdittir.
7. **Karakol** menzilindeki kurdu vurur. Bu, mevcut `defense` blogundan bedava
   gelmelidir - Karakol'a tek satir savunma kodu yazilmaz.
8. Kurtlar **geyik avlar**: bir kurt surusunun dibindeki geyik surusu zamanla
   kuculur. Oyuncu bunu gorebilir ve engellemeye calisabilir.
9. Kurt **hedef secmeyen her seye saldirmaz**: ordunun icinden gecen kurt
   intihar etmez, evcil hayvana ve binaya musallat olmaz (Faz 0 kararlarina
   bagli).
10. AI ayni baskiyi hisseder: kurt bolgesine isci gonderdiginde isci kaybeder ve
    bunu ekonomi teshisinde okuyabilir - kurtlarla dolu bir haritada AI ac
    kalmaz.
11. Kurt **nufus saymaz**, nav grid'ini **bloklamaz** ve sise **tabidir**
    (V1/V2 kurallarinin devami). Kesfedilmemis alandaki kurt gorunmez - pusu
    budur.

## 3. Mevcut Durum - Olculen Baslangic Noktasi

### 3.1 Wolf ve Fox birbirinin ikizi, ama Deer ailesinin **degil**

Uc ailenin `.gltf` animasyon listesi olculdu. Wolf ve Fox **12 klip, kelimesi
kelimesine ayni**. Deer/Stag/Cow/Bull ailesi ise 13 klip tasiyor ve **uc yerde
ayrisiyor**:

| Rol | Deer ailesi (13) | Wolf/Fox (12) |
| --- | --- | --- |
| saldiri | `Attack_Headbutt`, `Attack_Kick` | `Attack` (tek) |
| bosta-2 | `Idle_Headlow` | `Idle_2_HeadLow` |
| dusus | `Jump_toIdle` | `Jump_ToIdle` |

Ucuncu satir bir **tuzak**: fark yalnizca buyuk/kucuk harftir (`toIdle` ve
`ToIdle`). Mevcut `Deer.skeleton.json` / `Cow.skeleton.json` kopyalanip adi
degistirilirse `animationSet.fall` sessizce cozulmez bir klibe isaret eder ve
kurt dusus halinde T-pose'a duser. Kopyala-yapistir burada calismaz; sidecar
elle yazilir.

Iyi haber: `attack` rolu **tek** klibe baglanir (`Attack`), yani V2'nin
`Attack_Headbutt` semasi degismeden calisir - `wildlifeView` zaten
`attacking` + `attackCount` gonderiyor ve rol zincirinde saldiri otlamayi
yeniyor (`wildlifeView.ts:111-125`).

### 3.2 Varliklar manifest'te **hazir**, sidecar ve Actor eksik

`public/assets/manifest.json` `wolf` ve `fox` icin `skeletalMesh` girdilerini
zaten tasiyor (`loadGroup: "Animals"`, `Wolf.gltf` 3.17 MB, `Fox.gltf` 3.16 MB).
Eksik olan uc sey:

- `public/assets/ThreeAges/Animals/Wolf.skeleton.json` (ve Fox) - §3.1'deki
  klip adlariyla, elle.
- `public/assets/ThreeAges/Actors/Wildlife/BP_RTS_Wolf.actor.json` -
  `BP_RTS_Cow.actor.json`'in ikizi; `assetId: "wolf"`, olcek olculecek.
- `public/game-data/content/rts-content.json` `animals` blogu bugun **dort**
  tur tasiyor (deer, stag, cow, bull); wolf/fox eklenir.

Yani Faz 1 tumuyle veri isidir ve tek satir oynanis kodu icermez.

### 3.3 Kod tabani V3'u **iki yerde adiyla** bekliyor

Ikisi de kasitli birakilmis kapilar:

- `src/game/rts/combat/combatTarget.ts:9-22` - `CombatTargetOwner`'in
  `"wild"` degeri icin: *"an animal reads as hostile to both kingdoms. That is
  only ever reached for targets a system actually offers up, so wildlife stays
  unattackable until the hunt deliberately puts an animal in front of a hunter."*
- `src/game/rts/wildlife/wildlifeRetaliation.ts:1-17` - *"V3's predator will
  want to pick its own victim, and it will have to open that door itself."*

Ikinci alinti V3'un mimari kararini onceden veriyor: **yeni bir sistem yazilir**,
`WildlifeRetaliationSystem` genisletilmez. O dosya yirmi satirlik bir kuraldir
ve kural sudur - "elini uzatan canini yakar". Hedef **secen** bir yirtici bambaska
bir sorudur.

### 3.4 Kritik bulgu - asker bir kurdu **hedef alamaz**

`RtsApp.combatTargets()` (`RtsApp.ts:2584`) tam olarak sunu donuyor:

```ts
return [...this.units.all(), ...this.centers.all(), ...this.structures.all()];
```

Yaban hayati bu listede **yok**. `updateUnitEngagement` yalnizca bu listeyi
tarar (`RtsApp.ts:2658`), yani bugun hicbir muhafiz hicbir hayvani hedef
alamaz - avci disinda, ki o da `ResourceSource` yolundan gider, savas yolundan
degil.

Ve listeye **hepsini** eklemek yanlis olur: `nearestHostile`
(`engagementSystem.ts:151-153`) yalnizca `target.owner === unit.owner` bakiyor.
`"wild" !== "player"` oldugu icin her muhafiz, akin sirasinda yaninda otlayan
her geyige saldirmaya baslardi - ordunun yarisi geyik kovalayarak akini bitirirdi.

**Sonuc:** listeye giren sey bir **tur** degil, bir **durum** olmalidir. Ayrinti
Faz 4'te; ama karar bugunden belli: "saldirgan durumdaki yirtici" hedeftir,
"otlayan hayvan" degildir.

### 3.5 Kritik bulgu - `retaliateAgainstAttack` bir kurdu kabul edemez

Imza `attacker: Unit` (`engagementSystem.ts:49`). Bir `WildlifeAnimal` `Unit`
degildir. Genisletme yine de **kucuk**, cunku govde neredeyse hazir:

- `issueAttackOrder(defender, attacker, ...)` zaten `CombatTarget` aliyor
  (`attackPathing.ts:14-19`).
- `combatDistance(defender.position, attacker)` zaten `CombatTarget` aliyor.
- `attacker.owner` ve `attacker.health` `CombatTarget`'ta var.

Tek engel `attacker.dying` (satir 50): bu alan yalnizca `Unit`'te var,
`WildlifeAnimal`'da yok. Yani genisletme bir alanlik bir istir.

Cagri yeri `RtsApp.resolveCombatHit` (`RtsApp.ts:2810-2814`) ve orada
`hit.attacker` bugun **her zaman** bir `Unit`, cunku hasari yalnizca
`updateUnitCombat` uretiyor. Kurdun vurusu bu akista degildir - kendi sisteminden
gelir ve ayni cagriyi kendisi yapmalidir. V1 §3.9'un "isciler yirtici saldirisina
sessizce kurban gider" borcu **tam burada** kapanir.

### 3.6 Kritik bulgu - yirtici **ucuncu bir hareket sekli**

`wildlifeRoaming.ts` bugun iki mod biliyor:

- `advanceRoam` - ev cemberi icinde otlama + tehditten kacis;
- `advanceLed` - cobanin pesinde surulme (V2).

Kurdun ihtiyaci olan **kovalama** ucuncusudur ve ikisinin de tersidir: bir hedefe
dogru, kendi iradesiyle, ve **ev cemberinin disina**. Bugun cikamaz -
`RoamProfile.homeX/homeZ` sabit ve `advanceRoam` her zaman cemberin icinde bir
nokta secer.

Kucuk bir tesellisi var: `WildlifeAnimal.rehome(profile)` zaten var (V2'nin
penleme icin yazdigi sey) ve kurdun bolgesini tasimak icin **aynen** kullanilir.
Yani "kurt avini kovalar, sonra yeni bulundugu yerde devriyeye doner" tek cagri.

### 3.7 Kritik bulgu - validator **her** turden yakalanabilirlik istiyor

`validateGameData.ts:1149-1162` bir esitsizlik zorunlu kiliyor:

```
FASTEST_HUNTER_SPEED * fleeRecoverySeconds  >  moveSpeed * fleeSeconds
```

Gerekcesi hakli (yakalanamaz av, pathfinding hatasi gibi gorunur), ama **avci
olan** bir tur icin anlamsizdir: kurt zaten kacmiyorsa `fleeSeconds` bir
tuningdir, sozlesme degil. Ustelik uc alan da `positive()` uzerinden
**zorunlu** ve > 0 olmak zorunda; "kurt kacmaz" demek icin bile bir kacis
profili yazilmasi gerekiyor.

Bu Faz 0'in **Q2**'sine baglanir: kurt avlanabilir mi? Avlanabilirse esitsizlik
aynen gecerlidir ve hicbir sey degismez. Avlanamazsa validator'a bir
"yirtici muafiyeti" ogretilir ve muafiyetin kendisi bir testle pinlenir - aksi
halde muafiyet, ilerideki her turun kacis dengesini sessizce kapatan bir arka
kapi olur.

### 3.8 Kritik bulgu - tehdit modeli **turden habersiz**

`WildlifeSystem.update` bugun tek bir tehdit listesi aliyor ve o liste
`RtsApp.ts:2678`'de **her birimin konumu**:

```ts
this.wildlife.update(dt, this.units.all().map((unit) => unit.position));
```

V3'te bu ucgen kirilir: kurt icin isci **tehdit degil hedeftir**, geyik icin
kurt **tehdittir** (bugun hic tehdit degil - hayvan hayvani korkutmuyor). Yani
tehdit listesi tur bazli hale gelmeli, ve bu `wildlifeSystem.update`'in
imzasina dokunan tek degisiklik.

Not: `owner !== "wild"` olan hayvan zaten hicbir seyden korkmuyor
(`wildlifeSystem.ts:307`, V2 karari). Kurdun evcil hayvana saldirmasi istenirse
o karar buraya da dokunur - Faz 0 **Q5**.

### 3.9 Nufus, sis ve navigasyon kurallari **degismiyor**

Kurt da `Unit` degildir: nufus saymaz (V1 §3.5), nav grid'i bloklamaz (V1 Faz 2),
ve `isWildlifeVisible` (`wildlifeView.ts:37-47`) `"wild"` icin sis kuralini tam
uygular - kesfedilmemis alandaki kurt **cizilmez**. Bu bir eksik degil, ozelligin
kendisidir: pusu, gormedigin yerden gelen seydir.

Bunun bir sonucu var ve Faz 0'da konusulmali: sisin arkasindaki kurt gorunmuyorsa,
oyuncunun aldigi tek sinyal **bildirimdir** (§3.10). Yani bildirim bu surumde
kozmetik degil, oynanisin parcasidir.

### 3.10 Bildirim kanali **yok**

`RtsNotificationKind` (`rtsNotifications.ts:29-47`) `outpost-under-attack` ve
`center-under-attack` tasiyor; **isci** icin bir sey yok. V3 bir tane ekler.
`RtsAttackWatch` (`rtsAttackWatch.ts:21`) saglik dususunu id bazli izleyen genel
bir arac - isciye ayni sekilde uygulanabilir, yeni desen gerekmez.

### 3.11 AI yaban hayatindan tumuyle habersiz

`src/game/rts/ai/` altinda "wildlife" gecen tek satir yok; `pasture` gecen tek
satir `aiEconomyManager.ts:109`, o da bina siralamasi. Yani AI bugun:

- kurt bolgesine isci gondermekten kacinmaz,
- isci kayiplarini bir tehdit olarak okumaz,
- kurt yuzunden dusen bir yiyecek gelirini "tarla eksik" diye teshis eder.

V2 Faz 7'nin dersi burada aynen gecerli: **veri yetmez**. Ayni sekilde V2 Faz 7'de
`isWorkerBusy` closure'inin RtsApp'ten geride kaldigi bulunmustu - `aiTestWorld`
harness'inin RtsApp paritesi V3'te de ayrica kontrol edilmeli.

### 3.12 Harita: yeni marker tipi **gerekmiyor**

Suruler `rtsMapBlockout.ts:482-489`'da alti girdi olarak duruyor ve
`BP_RTS_Herd` marker'i (`rtsLevelAdapter.ts:122-132`) `species` alanini balans
tablosuna karsi dogruluyor. `animals.json`'a `wolf` eklenir eklenmez ayni marker
kurt yuvasi authorlar. Yeni Actor tipi, yeni adapter dali, yeni validator kurali
yok.

V2 Faz 7'nin harita dersi gecerli: is **iki Level'da da** yapilir
(`RTS_CoreMatch` parite testi zorunlu kiliyor, `RTS_GameplayProof` oyunun
kostugu yer).

### 3.13 Karakol verisi hazir - §2.7 muhtemelen **bedava**

`buildings.json` `outpost`: `visionRadius: 30`, `territory.controlRadius: 16`,
`defense: { attackDamage: 10, attackRange: 12, arrowsPerVolley: 2,
damageMultipliers: { light: 1.2, ... } }`. `structureDefense.update` zaten
`combatTargets()` aliyor (`RtsApp.ts:2737`) - yani §3.4'te yaban hayati o listeye
girer girmez Karakol kurdu kendiliginden vurur, ve `light` carpani (1.2) kurda
dogru sekilde uygulanir. Kod degil, **sira** meselesi.

## 4. Tasarim Kararlari (Faz 0 - KILITLENDI 2026-08-03)

Bes sorunun hepsi **oneri yonunde** kullanici tarafindan kilitlendi. Asagidaki
bes madde artik secenek degil **karar**; kod bunlara gore yazilir.

### KARAR 1 - Kurt yalnizca kontrol alani disindaki isciyi hedefler

Kurt, `territory.ownerAt(x, z)` **sahipsiz** donen bir noktadaki isciyi hedefler.
Bolge icindeki isci hicbir kosulda hedeflenmez; asker hicbir kosulda **kurdun**
hedefi degildir (asker kurdu kendi vurabilir - Faz 4).

Gerekce: §1'in tum iddiasi "Karakol ve kontrol alani anlam kazansin" uzerine
kurulu; kurali dogrudan kontrol alanina baglamak o iddiayi **veri yoluyla** degil
**tanim yoluyla** dogru yapar. Reddedilen B (menzile giren herkes) oyuncunun
ordusunu kurt temizligine zorlardi - §2.9'un reddettigi sey. Reddedilen C
(+ yalnizlik kosulu) dogru his verir ama iki kosul iki ayarlanabilir yaricap
demek; A'nin uzerine **sonradan** eklenebilir ve once A'nin oynanis kabulu
alinacak.

`ownerAt(x, z)` `territoryControlSystem.ts:109`'da hazir, yani karar en ucuz
secenek de.

### KARAR 2 - Kurt avlanabilir; kurt eti gecerli bir yiyecek kaynagidir

Avci kulubesi kurdu da avlar; `meatCapacity` gercek bir sayidir (§6: 60).

Gerekce, uc bacakli. Birincisi: §3.7'deki validator esitsizligi **degismeden**
gecerli kalir, yani "yirtici muafiyeti" arka kapisi **hic acilmaz** ve §8 bunu
pinler. Ikincisi: `huntableAnimalsNear` / `remainingNear` / carcass temizligi
zaten tur-agnostik yazilmis - bu karar **sifir kod**. Ucuncusu oynanis: kurt
bolgesi artik "tehlikeli **ve** zengin" olur; bu, V1'in "safe kucuk, external
buyuk" deseninin aynisi ve oyunun kendi dilinde konusur.

Kabul edilen risk: avci kulubesi kurt bolgesine kurulup kurtlari sistematik
avlayabilir. Bu **istenen** davranistir (oyuncu riski kabul edip odulu aliyor),
ama Faz 7 kabul macinda olculur.

### KARAR 3 - Kurt surusu tukenir, yenilenmez

Temizlenen bolge **kalici olarak** guvenlidir. Yuva yeni kurt dogurmaz.

Gerekce: oyunun her kaynagi sonlu (agac, geyik, maden); yenilenen tek sey V2'nin
**oyuncuya ait** peni. Yenilenen bir tehdit, oyuncunun kazanabilecegi bir seyi
kazanilamaz yapar ve "temizledim" anini yok eder. Reddedilen B ayrica `bear()`
benzeri bir uretim dongusu ve yirtici icin ayri bir ayar yuzeyi isterdi; bu karar
**sifir kod**.

Bedeli kabul edildi ve Faz 7'ye borc yazildi: kurt yuvalari **oyuncunun bir gun
gecmek zorunda kalacagi** yerlere konmali (dis maden, stag surusu, agil
koridoru), yoksa erken oyunda temizlenip oyundan cikarlar.

### KARAR 4 - Fox V3'e girmez; V3.1'e ertelenir

V3 yalniz **Wolf** gonderir. Fox'un `.skeleton.json`, `.actor.json`,
`rts-content.json` ve `animals.json` girdileri Faz 1'de **yazilir** (ayni rig,
bedava) ama **hicbir Level'a konmaz** ve `predator` blogu **tasimaz**.

Gerekce: Wolf ve Fox ayni rigdir (§3.1), yani Fox'un maliyeti **sanat degil
kural**: "tampondan calmak" bugun hicbir sistemin yaptigi bir sey degil - hasar
degil, hirsizlik. `EconomyProductionSystem`'in tampon alanina disaridan yazan ilk
sey olur ve kendi kabul olcumunu hak eder. Wolf'un oynanis kabulu alinmadan
ikinci bir yirtici davranisi eklemek, iki belirsizligi ayni maca sokmaktir.

Sonuc: **Faz 6 bu surumde yoktur**; uygulama sirasi Faz 5'ten Faz 7'ye gecer.

### KARAR 5 - Kurt yalniz yabani hayvani (geyik/stag) avlar

Evcil hayvan (`owner !== "wild"`) ve bina **dokunulmazdir**.

Gerekce: §2.8 geyik avini zaten istiyor ve o bedava atmosferdir. Evcil hayvan ise
V2'nin **kazanilmis** yatirimidir; onu koruyan bir kural (agilin kendi
savunmasi? coban? cit?) V3'un kapsaminda degil ve onsuz "kurt agili bosaltti"
oyuncuya kaybedilmis bir mac gibi gelir. Reddedilen B dogru ve cekici bir fikir -
ama V3'un degil, **V3.1**'in isi (Fox'la ayni pakette).

**Kapsam disi (V3'e sizmayacaklar):**

- Kurt surusu koordinasyonu (birlikte kusatma, lider takibi).
- Yirticinin bina/duvar hasari.
- Isci kacis yapay zekasi (panik, en yakin binaya siginma).
- Kesif kopegi (`Husky`/`ShibaInu`) - yol haritasinda bagimsiz madde.
- Gece/gunduz veya mevsim bagli yirtici baskisi.
- Kurt icin ayri bir ses/muzik katmani.

## 5. Dokunulacak Dosyalar

### 5.1 Kod

| Dosya | Is |
| --- | --- |
| `src/game/rts/wildlife/predatorSystem.ts` | **Yeni.** Hedef secimi, kovalama, vurus. §3.3'un actigi kapi. |
| `src/game/rts/wildlife/wildlifeRoaming.ts` | Ucuncu mod: `advanceHunt` (hedefe dogru, cember disina) - §3.6. |
| `src/game/rts/wildlife/wildlifeSystem.ts` | Tur bazli tehdit listesi (§3.8); `predator` bayragi; devriye profili. |
| `src/game/rts/combat/engagementSystem.ts` | `retaliateAgainstAttack` saldirgani `CombatTarget`'a genisler (§3.5). |
| `src/game/rts/RtsApp.ts` | `combatTargets()`'a saldirgan yirticilar (§3.4); `predatorSystem` tick sirasi; bildirim; tehdit listesinin turlenmesi. |
| `src/game/rts/ui/rtsNotifications.ts` | `worker-under-attack` kind + kurali (§3.10). |
| `src/game/data/gameDataTypes.ts` | `AnimalBalanceStats`'e yirtici blogu. |
| `src/game/data/validateGameData.ts` | Yirtici blogu dogrulama; Q2'ye gore kacis esitsizligi (§3.7). |
| `src/game/rts/ai/aiEconomyManager.ts` (veya `aiBlackboard.ts`) | Isci kaybini/yirtici bolgesini okuma - Faz 7'de olculecek. |
| `src/game/rts/world/rtsMapBlockout.ts` | Kurt yuvalari (§3.12). |
| `tools/engine-tests.ts` | §8'deki sozlesme testleri. |

### 5.2 Veri ve varlik

| Dosya | Is |
| --- | --- |
| `public/game-data/balance/animals.json` | `wolf` (ve Q4'e gore `fox`) girdisi - §6. |
| `public/assets/ThreeAges/Animals/Wolf.skeleton.json` | **Elle yazilir** - §3.1'in harf tuzagi. |
| `public/assets/ThreeAges/Animals/Fox.skeleton.json` | Ayni (Q4 = B olsa bile bedava). |
| `public/assets/ThreeAges/Actors/Wildlife/BP_RTS_Wolf.actor.json` | `BP_RTS_Cow`'un ikizi; olcek olculecek. |
| `public/game-data/content/rts-content.json` | `animals` blogu: `wolf`, `fox`. |
| `public/levels/RTS_CoreMatch...`, `RTS_GameplayProof...` | Kurt yuvasi marker'lari - **iki Level'da da**. |

### 5.3 Allowlist notu

Bu surum `LayoutPlacement` / `AssetSkeletonDef` / `ParticleEffectDefinition`
alanlarina **yeni alan eklemiyor**: kurt yuvasi mevcut `BP_RTS_Herd` Actor'unun
mevcut degiskenlerini kullaniyor, sidecar mevcut `animationSet` semasini
kullaniyor. Yani CLAUDE.md'nin uc allowlist yuzeyi de **dokunulmadan** dogru
kalir. Bu dogrulanmali, varsayilmamali: Faz 1'de bir kurt yuvasi authorlanip
kaydedilir ve yeniden yuklenir.

## 6. Balans Verisi (oneri)

`animals.json` -> `wolf`. Sayilar **oneridir**, kabul macinda ayarlanir; sozlesme
testleri hicbirini pinlemez (CLAUDE.md).

```json
"wolf": {
  "label": "Kurt",
  "meatCapacity": 60,
  "maxHealth": 55,
  "moveSpeed": 8.5,
  "walkClipSpeed": 1.8,
  "fleeRadius": 0.1,
  "fleeSeconds": 0.5,
  "fleeRecoverySeconds": 4,
  "huntSeconds": 6,
  "roamRadius": 14,
  "tameable": false,
  "predator": {
    "acquisitionRadius": 14,
    "damage": 6,
    "attacksPerMinute": 40,
    "pursuitRadius": 26,
    "preySpecies": ["deer", "stag"]
  }
}
```

Gerekceler:

- `moveSpeed` **8.5**: isciden (6) ve geyikten (7.5) hizli. Kurdun tehdit
  olmasinin tek nedeni budur - kacan isciyi yakalayabilmesi. Ayni sayi, geyik
  avinin da neden isledigini acikliyor.
- `maxHealth` **55**: bir Muhafizin (12 hasar, 1.4 s) yaklasik alti vurusu.
  Tek asker bir kurdu yener, ordu gerekmez (§2.6).
- `meatCapacity` **60**: geyigin (120) yarisi. Odul var ama av hayvani kadar
  degil - kurt bir tehdittir, ekonomik plan degil.
- `fleeRadius` **0.1** + `fleeSeconds` **0.5**: pratikte "kacmaz", ama uc alan da
  pozitif kalir ve §3.7'nin esitsizligi `6 * 4 = 24 > 8.5 * 0.5 = 4.25` ile
  rahatca gecer. **Validator'a hic dokunulmadan** kurt yazilabiliyor - bu, Q2'nin
  B onerisinin en somut kaniti.
- `roamRadius` **14** (devriye) ve `pursuitRadius` **26** (kovalama tasmasi):
  ikincisi birincinin ustunde olmali, yoksa kurt avina yetisemeden doner. Bu bir
  **sozlesme**dir ve testle pinlenir (§8).
- `acquisitionRadius` **14**: Muhafizin `acquisitionRange`'inden (9) genis, cunku
  kurt onu ilk goren olmali - ama Karakol'un `attackRange`'inden (12) cok uzak
  degil, yoksa Karakol'un menziline hic girmeden isci alip kacar.
- `damage` 6 x `attacksPerMinute` 40 = dakikada 240; 50 canli bir isci
  ~12.5 saniyede duser. Yani oyuncunun tepki verecek **zamani var**, ama
  yoksaymak isciye mal olur.

Fox (Q4 = B ise haritaya konmaz, ama veri yazilir): `moveSpeed` 9, `maxHealth`
25, `meatCapacity` 20, `predator` blogu **yok** - V3'te Fox ambiyanstir.

## 7. Fazlar ve Checklist

### Faz 0 - Karar kilidi **[TAMAM 2026-08-03]**

- [x] §4'teki Q1-Q5 kullanici tarafindan cevaplanir; bu bolum "KARAR" olarak
  yeniden yazilir ve gerekceler kayda gecer.
- [x] Kararlarin §2'deki basari maddelerini degistirdigi yerler guncellenir.
  Sonuc: **§2'nin 11 maddesi degismedi** - bes karar da onerilerdi ve §2 zaten
  onerilere gore yazilmisti. Kararlarin plana tek dokundugu yer §7/§11:
  KARAR 4 (Fox ertelendi) **Faz 6'yi bu surumden kaldirir**.

### Faz 1 - Varlik ve veri (oynanis yok) **[KOD TAMAM - authorlama dogrulamasi kullanicida]**

- [x] `Wolf.skeleton.json` **elle** yazilir; `fall` -> `Jump_ToIdle`,
  `attack` -> `Attack`, `idle`/`walk`/`run`/`work`/`death` Deer semasi (§3.1).
  §3.1'in olcumu `.gltf`'ten dogrulandi: Wolf/Fox 12 klip (`Attack`,
  `Jump_ToIdle`, `Idle_2_HeadLow`), Deer ailesi 13 klip (`Attack_Headbutt`,
  `Jump_toIdle`, `Idle_Headlow`) - harf tuzagi gercek.
- [x] `Fox.skeleton.json` ayni sekilde.
- [x] `BP_RTS_Wolf.actor.json` (+ Fox) yazilir; olcek **olculdu**, tahmin
  edilmedi: `.gltf` bind-pose bbox'lari node donusumleriyle birlikte alindi.
  Wolf ham boy 2.681 / uzunluk 5.553; **0.24** olcek -> 0.64 m boy, 1.33 m
  uzunluk. Iki bagimsiz kontrolden de geciyor: geyigin dunya boyunun (4.274 x
  0.20 = 0.855 m) altinda kaliyor **ve** mutlak uzunluk gercek bir kurdunkiyle
  ortusuyor. Fox 0.15 -> 0.40 m boy, 0.88 m uzunluk.
  `selectionRadius`: Wolf 0.6 (Deer ile ayni), Fox 0.45.
- [x] `rts-content.json` `animals` blogu genisler (`wolf`, `fox`).
- [x] `animals.json` `wolf` (+ `fox`) - §6. Fox `predator` blogu **tasimaz**
  (KARAR 4: V3'te ambiyans).
- [x] `gameDataTypes` + `validateGameData` yirtici blogunu tanir
  (`AnimalPredatorBalance` + `validateAnimalPredator`).
- [x] `BP_RTS_Herd` marker'inin `species` secenegine `wolf` eklendi - §3.12'nin
  "yeni marker tipi gerekmiyor" iddiasi boylece **authorlanabilir** hale geldi.
  `fox` kasitla eklenmedi: KARAR 4 geregi haritaya konmayacak.
- [ ] Bir kurt yuvasi authorlanip kaydedilir ve yeniden yuklenir (§5.3 allowlist
  dogrulamasi). **Kullanicida** - editorde yapilacak tek adim. Kod tarafinda
  beklenti: `rtsLevelAdapter.ts:128` `species`'i yalnizca `balance.animals`'a
  karsi dogruluyor, yani `wolf` artik gecerli; yeni alan eklenmedigi icin uc
  allowlist yuzeyi de dokunulmadan dogru kalmali.
  **Bu adim ilk denemede bir editor hatasini acti** (V3'e ait degil, mevcut):
  `cloneActorInstance` (`editor/core/layoutSnapshots.ts`) alan alan kopyalayan
  bir allowlist ve `variableOverrides`'i **hic kopyalamiyordu**. Details
  panelinden yazilan her actor degiskeni, layout'a yazilirken ayni klondan
  gectigi icin sessizce dusuyordu - ve placement sinif varsayilanina donuyordu
  ("wolf sectim, deer kaldi"). Ayni klon surukleme ve undo anlik goruntulerinde
  de kullaniliyor, yani bir marker'i tasimak `herdId`/`species`/`count`
  degerlerini de siliyordu. Duzeltildi ve iki testle pinlendi; eski test bunu
  kaciriyordu cunku fixture'i `variableOverrides` tasimiyordu.
- [x] Kabul: `npx tsc --noEmit`, `npm run test:engine` (1244 check),
  `npm run check:assets`, `npm run build:verify` **yesil**; kurt iki Level'da da
  ve `rtsMapBlockout`'ta **yok**, hicbir davranis degismedi.
  `check:assets`'in Wolf/Fox uyarilari (thumbnail yok, sidecar/actor manifest'te
  kayitli degil) alti hayvanin **hepsinde** ayni - yeni bir uyari sinifi degil.

### Faz 2 - Kurt haritada devriye geziyor (saldiri yok) **[TAMAM 2026-08-04]**

- [x] `wildlifeRoaming`'e ucuncu mod: `advanceHunt` (§3.6). Hedefe dogru,
  `fleeSpeed` (= `moveSpeed`, Gallop'un kalibre edildigi hiz) ile, **yuvadan**
  olculen `pursuitRadius` tasmasina kadar. Pes etme kasitla burada degil: fonksiyon
  nereye varildigini ve ne hizla gidildigini bildirir, tasmanin bittigine karar
  vermek Faz 3'un isi. Bir kovalama ayni zamanda bir kacis **degildir** - iki
  ucus sayaci da sifirlanir, yoksa esikten gecmis bir kurt kovalamayi ters yone
  kacarak gecirir.
- [x] `wildlifeSystem` tehdit listesini turler (§3.8). Uc cevap, ortadaki yeni:
  evcil hayvan hicbir seyden korkmaz (V2), **yirtici hic kimseden korkmaz**,
  geri kalan her yabani hayvan insan ile yirticidan **hangisi yakinsa** ondan
  kacar. Yirtici listesi cagirandan degil **surunun kendisinden** uretiliyor,
  bu yuzden `update`'in imzasi ve her cagiran yeri **degismedi** - §3.8'in
  ongordugu imza degisikligi gereksiz cikti.
- [x] Kurt yuvalari `rtsMapBlockout`'a **ve iki Level'a da**: `west-wolves`
  (-28, -6) ve `east-wolves` (28, 6), ucer kurt. Iki kanat koridorunu tutuyorlar -
  merkez sirtinin etrafindan dolasan bati/dogu yollari, yani her akinin, uzak
  yataga giden her seferin ve her sigir surusunun gectigi zemin. KARAR 3 bunu
  zorunlu kildi: geri gelmeyen bir suru, macin insanlari zaten getirdigi yere
  konmali.
- [x] Kurt cizilir, animasyonlari dogru rolde oynar, sise tabidir (§3.9).
  Kod tarafi Faz 1'de zaten hazirdi; kullanici calisan macta **gordu ve
  hareket ettigini dogruladi**.
- [x] **Devriye yuruyusu** (§2.1'in "geyik gibi otlamaz, hareketleri avci gibi
  okunur" maddesi). Ilk gorsel turda kullanici ayak kaymasi bildirdi ve teshis
  benim ilk tahminimden derindi: `wildProfileFor` her turun otlama hizini
  `walkClipSpeed`'in **kendisine** esitliyor, yani otlarken oynatma hizi her
  zaman tam 1. Bu her otlayan icin dogru - ayak kaymasinin cozumu bu - ama
  yirtici icin yanlis: kurdun bosta davranisi yemek degil, **yiyecek aramak**.
  Sonuc, §2.1'i yazili olmasina ragmen teslim etmemis olmam.
  `predator.patrolSpeed` eklendi (2.4); yirtici otlama hizinin **ustunde**
  devriye gezer, yani ayni yurume klibi rate 1'in ustunde oynar - ayni zeminde
  daha hizli bacaklar, ayaklar hala basili.
- [x] **`walkClipSpeed` 1.8 -> 1.6, olcumle.** 1.8'i tahminle koymustum.
  Kliplerden olculdu (bind-pose IK ayak dugumlerinin ileri eksendeki gezinimi):
  kurdun dunya adimi 0.419, geyigin 0.427, ama kurdun dongusu %9 kisa - yani
  ayaklari saniyede ~%7 daha fazla yol aliyor. Geyik 1.5'te kabul edilmis
  oldugundan kurdun karsiligi 1.6. Not: bu alan **saf geometri degil**; Deer ve
  Cow birebir ayni klip verisini tasiyor (adim 2.14, sure 1.167) ama 1.5 ve 1.1
  authorlanmis, yani icinde bir tempo tercihi de var. Bu yuzden bu sayi bir
  testle **pinlenmedi**; pinlenen sey iliskiler (asagida).
- [x] Kabul: kurt gorunur ve dolasir; hicbir seye saldirmaz, hicbir sey ona
  saldirmaz. **Kullanici gorsel kabulu verildi (2026-08-04).** Ilk turda dort
  maddenin ucu gecmisti (iki kanatta devriye, dogru boy, isciden kacmiyor,
  geyikler kurttan kaciyor); ayak kaymasi `predator.patrolSpeed` + olculmus
  `walkClipSpeed` ile kapandi ve ikinci tur onaylandi.

**Yerlesim olcumle bulundu, gozle degil** - ve ilk deneme testte kirmizi yandi.
(-28, -2) en yakin baslangica 41.2 uzaktaydi; gereken 28 (kontrol yaricapi) + 14
(devriye yaricapi) = 42. Yani *marker* disaridaydi ama **sunun** bir parcasi
iceri giriyordu, ki KARAR 1'i anlamsiz kilardi. (-28, -6) 45.1 veriyor: hem 42'yi
hem de 26'lik kovalama tasmasini asiyor, yani bir kovalama bile baslangic
zeminine giremiyor. Sirt engeline (|x| <= 12, |z| <= 4) uzaklik 16.1, yani
devriye cemberi duvardan 2.1 birim acikta - kurtlar navigasyonu olmayan bir
duvarin icine girmiyor.

**Adalet, haritanin kendi carpikligina karsi olculuyor.** Blockout'un iki
baslangici insa geregi simetrik, orada yuvalar **tam** adil olmali ve oyle.
`RTS_GameplayProof` ise oyuncu baslangicini (-40, 40), dusmani (38, -38)
authorluyor; oradaki **her** suru bu iki birimlik carpikligi zaten tasiyor ve
mevcut V2 adalet testi bunu "harita dengesi, kapsam disi" diye kayda gecirmis.
V3'un gercekten yanlis yapabilecegi sey bu degil - haritayi **daha da**
dengesiz birakmak. Test onu reddediyor: yuvalarin carpikligi (2.68) haritanin
kendi surulerininkini (2.83) asamaz.

### Faz 3 - Kurt isciye saldirir **[KOD TAMAM - gorsel kabul kullanicida]**

- [x] `predatorSystem.ts`: hedef secimi (KARAR 1), kovalama, vurus. Hedef
  `territory.ownerAt(...) === "neutral"` olan **isci**; asker hicbir kosulda
  hedef degil. Secilen kurban **tutulur**, her tick yeniden secilmez - iki isci
  birbirini kesince kurban degistiren bir kurt ikisinin arasinda salinip
  hicbirini isirmazdi.
- [x] Hareket burada **degil**: sistem yalnizca `WildlifeAnimal.hunt` yazar,
  ucuncu modu surunun kendi tick'i kosturur - V2'nin `lead` deseni aynen.
  Bu yuzden `predators.update` surunun tick'inden **once** kosuyor (surme
  kuralinin ayni gerekcesi: bu karede secilen kurban bu karede hareket etmeli).
- [x] Vurus `Attack` klibini `attackCount` uzerinden tetikler (V2 deseni).
  `attacking` bayraginin artik **iki** yazari var; `wildlifeRetaliation` bayragi
  yalnizca kendi yonettigi hayvanlar icin sifirliyor, yoksa sira degisince kurdun
  isirigi sessizce iptal olurdu.
- [x] Olen isci temiz duser: `PastureSystem` / `WorkerConstructionSystem` /
  ekonomi rezervasyonlari birakir. Kontrol edildi ve **sifir kod cikti** - dort
  okuyucunun hepsi `health.depleted` okuyor ve kurdun isirigi zaten
  `health.damage`, yani askerin vurusuyla ayni cagri. Testle pinlendi (coban
  kolu; olen cobanin tuttugu inek claim'siz, lead'siz ve yeniden avlanabilir).
- [x] Isci kendi basina kurdu hedef **almaz** (V1 §3.9) - yapisal olarak dogru:
  `combatTargets()` yaban hayatini hala tasimiyor (Faz 4) ve
  `updateUnitEngagement` isciyi zaten atliyor. Olculdu, varsayilmadi.
- [x] **Kovalama biterken isinlanma yok.** Sadece kosturunca cikan sey: otlama
  modu hayvani `keepInHerdGround` ile cembere **kelepceler**, yani kovalamanin
  sonunda oylece birakilan kurt tasmanin cogunu tek karede geri **ziplardi**.
  Cozum, pes etmeyi yuvaya nisanlanmis bir kovalama yapmak. §3.6'nin onerdigi
  `rehome` **reddedildi** ve gerekce dosyada yazili: yuva, tasmanin, yuva
  yerlesim kuralinin ve harita adalet testinin hepsinin olculdugu sabit nokta -
  kurtla birlikte yuruyen bir yuva, pakedi her kovalamada bir adim kaydirir.
  (§3.6'nin `rehome` onerisi Faz 5'te, geyik oldurme yerinde, yeniden tartilir.)
- [x] Kurt kurbanin **yanina** duruyor, icine degil: `HuntQuarry.standoff`
  (`advanceLed`'in `DRIVE_FOLLOW_GAP`'inin ikizi). Duruş mesafesi isirik
  menzilinin (`CAUGHT_DISTANCE`) altinda, yoksa kurt kapandigi isirigin bir
  tik disinda beklerdi.
- [x] Kabul: bolge disindaki isci saldiriya ugrar ve olur; bolge icindeki isci
  guvendedir. **Kullanici gorsel kabulu verildi (2026-08-04).**
- [x] **Kabulun actigi ikinci hata - geyiklerde de "isinlanma" (V3'e ait degil,
  V1 Faz 2'den beri mevcut).** Kullanici bunu kurdunkine benzeterek bildirdi;
  teshis tahminle degil **olcumle** yapildi (400 saniyelik kosu, tek tehdide
  karsi alti tehdit):
  - `advanceRoam` kacis yonunu **her tick** o anki en yakin tehditten yeniden
    hesapliyordu. Kalabalikta "en yakin" degistikce yon de degisiyor, yani geyik
    dortnala kosarken saniyede birkac kez geri donuyordu. Olculen: hareket eden
    tick'lerin **%14.6'si** govdeyi 90 dereceden fazla ceviriyor; tek kisiyle
    ayni kosu %3.4. Bu fark nedeni adlandirdi. Kacis yonu artik **urkme aninda
    bir kez** secilip bolt boyunca korunuyor.
  - `keepInHerdGround` disari kacan adimi kendi yaricapi boyunca geri
    projeliyordu, yani **tam disari** kosan hayvan basladigi yere iniyor: govde
    dururken `speed === 0` cikiyor ve sunum bunu *duruyor* diye okuyup dortnala
    kosan geyige **yeme klibini** oynatiyordu ("animasyonlari karisiyor").
    Olculen: 400 tick. Artik disari bileseni atilip cember **boyunca** kosuluyor -
    ki `keepInHerdGround`'un dokumaninin zaten iddia ettigi davranis buydu.
  - Sonuc: ters donus %14.6 -> **%0.6**, kacarken yerinde sayma 400 -> **1**.
    Ikisi de sozlesme testiyle pinlendi (buyukluk degil: "bolt yonunu
    degistirmez" ve "kosarken hiz sifir olmaz").

### Faz 4 - Karsilik: asker ve Karakol kurdu vurur **[TAMAM 2026-08-04]**

- [x] `combatTargets()` saldirgan durumdaki yirticiyi icerir - **tur degil
  durum** (§3.4). Durumun sahibi `PredatorSystem.hostile()`: her tick'te yeniden
  kurulan liste. Kapiyi kimin actigi onemli - liste `WildlifeSystem`'den degil
  **yirtici sisteminden** gelir, cunku "hedef secmis olmak" o sistemin bildigi
  tek sey. Iki hal var ve ikisi de hayvanin **cikabilecegi** bir hal:
  - **Birini avliyor olmak.** Kovalamaya henuz baslamis kurt da sayilir:
    eskortun saldiriyi karsilamasi icin ilk isirigin dusmesini beklemesi
    gerekmemeli.
  - **Bir kralligin toprakinda duruyor olmak** (oyun sonrasi eklendi, asagida).
    Otlayan hayvan hangi zemine girerse girsin ikisinde de yok: bolgendeki geyik,
    henuz yakalamadigin bir hayvan, bir tehdit degil.
- [x] `retaliateAgainstAttack` saldirgani `CombatTarget`'a genisledi (§3.5).
  Govde zaten yalnizca ortak sozlesmeyi okuyordu; tek istisna olan `dying`
  `CombatTarget`'a **istege bagli** alan olarak eklendi (yalnizca `Unit`'in bir
  olum pozu var; bina moloz, hayvan les). Cagriyi `RtsApp` yapiyor - donen her
  `PredatorStrike` icin bir satir, `resolveCombatHit`'in her vurus icin yaptigi
  seyin ayni. **V1 §3.9 borcu burada kapandi:** isirilan isci artik akinci
  vurdugunda oldugu gibi donup vuruyor. §2.5 ile catismiyor - kural "isci
  **kendi basina** hedef almaz"di, ve `updateUnitEngagement` isciyi hala
  atliyor; bu kapi yalnizca **zaten yenmis** bir darbeyle aciliyor.
- [x] `worker-under-attack` bildirimi (§3.10); `RtsAttackWatch` isciye baglandi -
  ucuncu ornek kume olarak, ayni tek izleyicide. Karakol'un aksine **konu bazli
  anahtarlanmadi**: bir akin bir ekibi birden yakalar ve dort isci dort satir
  demek olurdu - `MAX_ACTIVE_NOTIFICATIONS`'in tamami, yani Merkez uyarisini
  disari iten bir isci uyarisi. Tek satir kac kisi oldugunu soyluyor.
- [x] Karakol'un kurdu vurdugu dogrulandi - savunma tarafinda **sifir yeni kod**
  (§3.13): kurt `combatTargets()`'a girer girmez `structureDefense` onu
  `nearestHostile`'da buluyor ve `resolveDamage` `light` carpanini (1.2) kendi
  tablosundan uyguluyor. Test bunu iki tablodan **hesaplayarak** pinliyor.
  **Ama ilk gorsel tur bunun kagit uzerinde kaldigini gosterdi** - asagidaki
  "tecavuz hali" maddesi.
- [x] Kabul, kismi: **kullanici dort maddeden ucunu onayladi (2026-08-04)** -
  bildirim akisinda "Isciniz saldiri altinda!" cikiyor; hareket emri altindaki
  asker yoluna devam ediyor ve asker kurda yalnizca bir isci saldiri altindayken
  gidiyor; eskortsuz isci isiriliyor, **donup karsilik veriyor**, sonra dusuyor.
  Eskort maddesi de kabul edildi ve gerekcesiyle: bir muhafiz uc kurdu
  oldururken iscinin olebilmesi **istenen** denge ("olmasi gereken bu").
- [x] Kabul, kalan: **Karakol menzilindeki kurt duser.** Ilk turda dusmuyordu;
  "tecavuz hali" eklendikten sonra **kullanici gorsel kabulu verildi
  (2026-08-04)** - yuvanin yanina dikilen Karakol paki temizliyor.

**Karakol'un atisi bedavaydi ama tetigi hic cekilmiyordu - engel geometri.**
Ilk turun bulgusu, ve yalnizca oynayarak cikti. Saldirgan bir kurt, KARAR 1
geregi, **sahipsiz** zeminde duran bir iscinin yanindadir; Karakol ise
`territory.controlRadius` **16**'ya kadar her noktanin sahibidir ve
`defense.attackRange`'i **12**'dir. Yani vurabilecegi her nokta zaten kendi
bolgesi, ve kendi bolgesinde saldirgan kurt olamaz. Kullanicinin gordugu tam
olarak buydu ve ikinci bir yuzu vardi: yuvanin yanina Karakol dikildiginde
kurtlar **ok yemiyor**, isciler de KARAR 1 sayesinde isirilmiyor - yani pak
"bir anda evcillesmis" gibi duruyor.

**Cozum: durumun ikinci hali - bir kralligin toprakina giren yirtici.** Ayni
`ownerAt` okumasi, isaret ters cevrilmis: sahipsiz zemin iscinin alinabildigi
yer, **sahipli** zemin kurdun vurulabildigi yer. Uc secenek arasindan bu
secildi, cunku:

- `attackRange`'i `controlRadius`'un ustune cekmek (ayar) Karakol'un **PvP**
  menzilini de degistirirdi - kurt icin verilen bir karar askeri dengeyi
  tasiyamaz.
- Oldugu gibi birakmak §2.7'yi kalici olarak kagit uzerinde birakirdi ve
  "evcillesmis pak" gorunumunu de birakirdi.
- Tecavuz hali **tur degil durum** olmayi surduruyor: hayvan senin zemininden
  cikarak o halden cikar, ve otlayan hayvan hicbir zemine girmekle hedef olmaz.
  §9'un ilk riski (ordunun yarisi geyik kovalar) dokunulmadan gecerli kalir.

Bedeli kabul edildi: yuvanin ustune Karakol dikmek artik paki **temizlemenin
yolu**. KARAR 3 zaten "temizlenen bolge kalici olarak guvenlidir" diyor, yani
bu oyunun kendi sozune uyuyor - ama Faz 7'nin harita isi bunu olcmeli: yuvalar
oyuncunun bir gun gecmek zorunda kalacagi yerlerde kalmali, tek bir Karakol'la
oyundan cikarilabilecek kadar ucuz olmamali.

**§2.4'un ikinci yarisi acik.** "Bildirim akisinda bir uyari cikar" teslim
edildi; "oyuncu kamerayi oraya goturebilir" icin bildirim akisinda tiklanabilir
bir odak yok - hicbir bildirim turunde yok, yani V3'e ait bir eksik degil.
Faz 4'un checklist'i yalnizca bildirimi istiyordu; kamera odagi genel bir HUD
isi olarak birakildi.

### Faz 5 - Kurt geyik avlar **[KOD TAMAM - gorsel kabul kullanicida]**

- [x] Kurt `preySpecies` icindeki yabani hayvani hedefler ve oldurur. Hedef
  secimi **tek** fonksiyonda kaldi ve kovalama/isirik govdesi **tek** kod:
  iki kurbanin da sordugu sey `position` ve `health`. Ayrisan sey kurbanin
  cevresi, o yuzden secim etiketli (`worker` / `prey`) - yalnizca insan
  bildirim ureti r, yalnizca insan kurdu orduya hedef yapar, yalnizca av geride
  yenecek bir sey birakir.
- [x] **Insan avin onunde gelir**, ve bu siralama **tam** (geri donusu yok):
  geyigi kovalayan kurdun yanindan gecen isci kovalamayi devralir, ama kurt
  hicbir zaman isciyi birakip geyige donmez - yani oncelik, "tutulan kurban"
  kuralinin engellemek icin var oldugu salinima donusemez. Gerekce §1'in
  kendisi: kurt, eskortun **nedeni**; venizonunu once bitiren bir kurt tam da
  tehdit olmasi gereken anda dekor olurdu.
- [x] Olen geyik normal les olur - avci kulubesi onu **toplayabilir** ve bu
  gercekten bedava cikti: `remainingNear`, `reserveNearest` ve `harvest`
  hayvanin **nasil** oldugunu bilmiyor. Kurt lesten et **yemiyor**: molasi
  zaman, et degil - aksi halde pak, oyuncunun soyabilecegi bir rakip degil bir
  yiyecek **kuyusu** olurdu.
- [x] Kurt oldurdugu geyigin **ustunde** kaliyor, sonra devriyeye doner.
  §3.6'nin onerdigi `rehome` **yeniden tartildi** - §3.6'nin istedigi yerde,
  bitmis bir oldurmenin uzerinde - ve cevap **guclendi**: her lese tasinan bir
  yuva, paki harita boyunca birer geyiklik adimlarla yurutur ve yuvanin tutmak
  icin konuldugu koridor ucuncu ogunde arkada kalir. Yuva sabit; donus, Faz
  3'un yuvaya nisanlanmis kovalamasi.
- [x] **Mola** (yeni). Bu, §2.8'in "zamanla kuculur"unu gercekten zamanla yapan
  sey: bir onceki govde dustugu karede yenisine baslayan bir pak, cayiri
  oyuncunun ilk oldurmeyi fark etmesinden once bosaltir. Suresi **yeni bir
  balans alani degil**, turun kendi `restSeconds`'i - otlamayan bir hayvanin
  authorlanmis ama kullanilmayan tek alani, ve "iki hareket arasinda ne kadar
  durur" bu tur icin tam olarak yemek demek. Molada `feeding` bayragi aciliyor,
  yani hayvan `grazing` aktivitesine dusuyor ve sidecar'in zaten tasidigi
  `Eating` klibi lesin uzerinde oynuyor - "kurt geyigi yiyor" bunun icin bedava.
- [x] Les **kelepceye takilmiyor**: mola boyunca kurt lese nisanlanmis bir
  kovalamada tutuluyor. Birakilsa Faz 3'un tuzagina duserdi - otlama modu
  hayvani devriye cemberine kelepceler, cember disinda kalan bir les de kurdu
  tek karede rimme geri ziplatirdi.
- [x] **Geyik avlayan kurt orduya hedef degildir.** Faz 4'un "birini avliyor
  olmak" hali yalnizca **insan** kovalayana uygulaniyor. Uc cayir oteden geyik
  kovalayan kurt kimseyi tehdit etmiyor; listeye girseydi §2.9'un harcamayi
  reddettigi eskort onun pesine giderdi - §9'un ilk riski, roster yerine av
  yolundan gelmis olurdu. Kendi zeminindeki kurt icin cevap degismedi (tecavuz).
- [ ] Kabul: oyuncu mudahale etmezse kurt bolgesinin yanindaki geyik surusu
  zamanla kuculur; harita canli gorunur. **Kullanici gorsel kabulu.**

**Haritada ne gorunecegi olculdu, umulmadi.** Yuvalar (-28, -6) / (28, 6),
kovalama tasmasi 26; her kralligin geyik surusu (-30, 22) / (30, -22), suru
cemberi 10. Yuvadan suru merkezine 28.07, yani surunun **yakin yarisi** (18.07
ile 26 arasi) tasmanin icinde: kurtlar surunun kendilerine bakan kenarini
yiyor, tamamini degil. Merkez stag surusu (0, 16) yuvadan 35.6, cemberiyle
birlikte en yakin stag 25.6 - yani tam sinirda, ara sira. Yeni marker, yeni
yerlesim, yeni harita isi **gerekmedi**; Faz 2'nin koridor yerlesimi §2.8'i
zaten besliyor.

**Faz 4'un bir testi Faz 5 yuzunden yalan soylemeye basladi ve duzeltildi.**
"Yuvanin yanina dikilen Karakol paki temizler" testi, kulenin otlayan hayvana ok
atmadigini yanina koydugu **geyiklerle** kanitliyordu. Faz 5'ten sonra o geyik
avdir: yarasi artik kule hakkinda hicbir sey soylemez, cunku onu kurtlar yemis
olabilir. Seyirciler `cow`'a cevrildi - `preySpecies` disinda, yani bir yarayi
aciklayabilecek tek sey yeniden ok. Test ayrica bunu **iddia ediyor** (tur
listede degil), yani ilerideki bir tuning turu listeye sigir eklerse test
sessizce zayiflamak yerine kirmizi yanar.

### Faz 6 - Fox: tarla tamponundan hirsizlik **[YOK - V3.1'e ertelendi]**

KARAR 4 geregi bu faz **bu surumde yoktur**; plan Faz 5'ten Faz 7'ye gecer.
Fox'un verisi ve sidecar'i Faz 1'de yazilir ama haritaya konmaz.

### Faz 7 - AI uyumu, harita isi ve kabul maci

- [x] AI isci kaybini okur; kurt bolgesine surekli isci beslemez (§3.11).
- [x] AI'nin yiyecek teshisi kurt kaynakli kaybi "tarla eksik" diye okumaz.
- [x] `aiTestWorld` harness'inin RtsApp paritesi kontrol edilir (V2 Faz 7 dersi).
- [x] Kurt yuvalari iki Level'da da adil: iki kralligin gordugu yuruyus
  mesafeleri kumesi ayni - **hesaplanarak**, pinlenmeden.
- [ ] Tam mac: bolge disi risk hissediliyor, Karakol bir yatirim olarak anlamli,
  eskort bir taktik olarak anlamli. **Kullanici gorsel/oynanis kabulu.**

Faz 7 otomatik kaniti: fatal kurt darbesi AI blackboard'unda den bazli tehdit
olarak okunur; ayni denin kaynak noktasina yeni isci otomatik atanmaz ve paketin
tamami temizlenince bu yasak kalkar. `aiTestWorld`, RtsApp'teki
`PredatorSystem -> WildlifeSystem -> EconomyProductionSystem -> AI` sirasini
aynen tasir. Harita adaleti duz cizgiyle degil, RtsNavigation'in blocker'li
yuruyus yolu uzerinden olculur; `RTS_GameplayProof` batidaki yuva (-45, -6)'ya
tasinarak iki tarafin denlere yuruyus kumesi haritanin mevcut carpikligindan
daha kotu olmayacak hale getirildi.

## 8. Test ve Gate

CLAUDE.md kurali: **ayar degil sozlesme**. Hicbir test bir buyuklugu pinlemez.

- [x] **Klip varligi (Faz 1):** mevcut sidecar testi ("RTS wildlife sidecars name
  clips the shipped animal models actually carry") Wolf/Fox'u kendiliginden
  kapsadi - `Animals/` altindaki her sidecar taraniyor ve her `animationSet`
  degerinin `.gltf` klip listesinde var oldugu dogrulaniyor. Eklenen ikinci yari:
  o test yalnizca **diskte olan** sidecar'lari tariyor, yani hic yazilmamis olana
  sessiz kaliyordu. "every shipped species owns a sidecar and an actor"
  `animals.json` -> `rts-content.json` -> actor -> manifest -> sidecar zincirini
  yuruyor.
- [x] **Veri sozlesmesi (Faz 1):** dort alan da zorunlu ve pozitif; eksik/sifir/
  negatif olan **dosya ve alan adiyla** reddediliyor. `tameable` deseninin ikizi
  burada "yirtici ayni anda evcillestirilebilir olamaz" olarak dustu (KARAR 5) -
  `predator` blogunun kendisi isaret oldugu icin "tasimayan turde alan" hali yok.
- [x] **Menzil sozlesmesi (Faz 1):** `pursuitRadius > roamRadius` ve
  `acquisitionRadius > 0`, turun kendi iki alanindan **hesaplanarak**.
- [x] **Hiz sozlesmesi (Faz 1):** yirticinin `moveSpeed`'i `units.json`'dan
  **okunan** en hizli isci hizindan buyuk (`role === "worker"` maksimumu).
- [x] **Kacis esitsizligi (Faz 1):** KARAR 2 = B, mevcut kural **degismeden**
  gecti (`6 * 4 = 24 > 8.5 * 0.5 = 4.25`) ve muafiyet acilmadigi pinlendi:
  kurdun `fleeSeconds`'i yakalanamaz yapildiginda validator hala reddediyor.
- [x] **Yerellik (Faz 2 maddesi, veri oldugu icin Faz 1'de dustu):** yirticinin
  `pursuitRadius`'u `RTS_WORLD_HALF_EXTENT` olceginde degil - hem testte hem
  validator'da.
- [x] **Tehdit turlemesi (Faz 2):** kurt isciden kacmaz (uzerinde duran isciyle
  bile devriye cemberinde kaliyor); geyik kurttan kacar; evcil hayvan hicbir
  seyden kacmaz - ucu de tek testte, gercek bir yirticinin yaninda.
- [x] **Devriye yuruyusu (Faz 2):** yirticinin `patrolSpeed`'i otlama hizinin
  ustunde **ve** yurume/kosma sinirinin (`moveSpeed * runThreshold`) altinda -
  ikisi de sunum katmaninin kendi kalibrasyon tablosundan **hesaplanarak**,
  sayiya pinlenmeden. Ustelik ortaya cikan oynatma hizi clamp'e takilmiyor
  (takilsaydi ayaklar tam da bu alanin belirledigi hizda kayardi) ve 1'in
  ustunde. Buyuklugun kendisi kasitla pinlenmedi: Deer ve Cow'un ayni klipten
  farkli `walkClipSpeed` authorlamasi, bu alanin bir tempo tercihi de tasidigini
  gosteriyor.
- [x] **Kovalama sozlesmesi (Faz 2):** `advanceHunt` devriye cemberini **asar**
  ama tasmayi **asmaz**; tasmanin ucunda bildirilen hiz sifirdir (duran bir
  govdenin uzerinde Gallop oynamaz); iki ucus sayaci da sifirlanir.
- [x] **Yuva adaleti (Faz 2):** yuvalar cift halinde ve haritanin kendi
  carpikligindan fazlasini eklemiyor; simetrik baslangicli blockout'ta **tam**
  adil.
- [x] **Yuva yerlesimi (Faz 2):** her yuva, devriye yaricapi dahil, iki
  baslangic kontrol alaninin da disinda; kovalama tasmasi bir baslangica
  yetismiyor; her yuva bir suru, tek kurt degil.
- [x] **Hedef secimi (Faz 3, KARAR 1):** kontrol alani disindaki isci hedeflenir,
  icindeki hedeflenmez - `ownerAt` uzerinden. Korunan isci kasitla **daha yakin**
  duruyor, yani mesafe karar verseydi test kirmizi yanardi. Bütün mesafeler
  kurdun kendi `acquisitionRadius`'undan **hesaplaniyor**, biri bile pinlenmedi;
  yara da `damage` tablosundan turetiliyor.
- [x] **Isci pasifligi (Faz 3):** saldiriya ugrayan isci hicbir sey hedef almaz -
  `attackTarget` ve `autoAcquired` olculuyor (V1 §3.9).
- [x] **Temiz olum (Faz 3):** kurdun oldurdugu coban isini birakir; claim, lead
  ve sahiplik sizmaz, inek yeniden avlanabilir hale gelir - V2 Faz 7'nin dort
  okuyucusu.
- [x] **Kovalamanin sonu (Faz 3):** kurt devriye cemberini asiyor, tasmayi
  asmiyor, kurbani dusunce **yuruyerek** donuyor (tek karelik yer degistirme
  turun kendi `moveSpeed`'inden hesaplanarak sinirlaniyor) ve yuvasi yerinde
  kaliyor.
- [x] **Nufus (Faz 3):** kurt da nufus saymaz - mevcut yaban hayati testi bir
  kurt pakediyle genisletildi.
- [x] **Hedeflenebilirlik (Faz 4):** saldirgan kurt `combatTargets()`'ta; otlayan
  geyik/sigir **degil**. Bir muhafiz otlayan hayvani hicbir kosulda hedef almaz -
  ve hedef aldigi anda listeden **cikiyor**, yani durum guncel bir durum, mac
  boyu tasinan bir damga degil. Testin bos olmadigi ayrica kanitlaniyor: ayni
  muhafiza §3.4'un uyardigi naif liste (`wildlife.all()`) verildiginde hemen bir
  hayvan seciyor. Yani cayirin guvenli olmasinin nedeni **kural**, testin
  hayvanlari uzaga koymus olmasi degil. Butun mesafeler iki turun kendi
  yaricaplarindan hesaplaniyor.
- [x] **Karsilik (Faz 4):** kurdun vurdugu isci `retaliateAgainstAttack` yolundan
  geciyor (`attackTarget` + `autoAcquired`) ve yanindaki muhafiz kurdu
  hedefliyor; **hareket emri olan** muhafiz yoluna devam ediyor. Muhafizin
  hedeflemesi kurt **daha kovalarken** olculuyor - eskortun ilk isirigi beklemesi
  gerekseydi eskort olmazdi. Sonunda tek muhafiz kurdu **olduruyor** (§2.6:
  asker ister, ordu istemez); testte olculen sey oldurmenin kendisi, ne kadar
  surdugu degil.
- [x] **Karakol (Faz 4):** menzildeki kurt Karakol atesinden hasar alir ve `light`
  carpani uygulanir - `buildings.json`'dan **hesaplanarak**; ayni menzildeki
  otlayan geyik ise dokunulmadan kaliyor. Bu testin kapsadigi sey durumun
  **avlanma** yarisi, ve testin icine yazildi ki bu yari tek basina gercek bir
  macta neredeyse hic tetiklenmiyor.
- [x] **Tecavuz hali (Faz 4, oynayarak bulundu):** yuvanin yanina dikilen Karakol
  paki **temizliyor** - uc kurt da oluyor, yanlarindaki geyikler tek ok yemiyor,
  ve temizlenen yuva bir daha kimsenin hedefi olmuyor (KARAR 3). Testte **hic
  isci yok**: kule sahip oldugu zemini savunmak icin yeme ihtiyac duymamali.
  Bulgunun kendisi de bir assertion oldu, hatirada birakilmadi:
  `controlRadius > attackRange`, yani kule vurdugundan **oteye** sahip - ilk turda
  hicbir okun atilmamasinin nedeni budur.
- [x] **Av (Faz 5):** kurt yalniz `preySpecies`'teki yabani hayvani oldurur.
  Iki muafiyet **iki ayri kural** tarafindan veriliyor, o yuzden ikisi de ayri
  olculuyor: listede olmayan tur (`preySpecies` reddediyor) ve bir kralligin
  sahip oldugu hayvan (sahiplik onu yabani ekonomiden tumuyle cikariyor - avci
  kulubesinin okudugu ayni satir). Sahipli hayvan kasitla bir **geyik**:
  validator tameable turu ava yazmayi zaten yasakliyor, yani sahiplik
  kontrolunun gercekten sinandigi tek kurulum bu. Bina hic gecmiyor - yapi bu
  sistemin okudugu hicbir listede yok. Testte **hic isci yok**: §2.8'in iddiasi
  oyuncu bakmadiginda da bir seyler oldugudur.
- [x] **Les (Faz 5):** kurdun oldurdugu geyik avci kulubesi tarafindan
  toplanabilir - lesin eti hayvanin tam `meatCapacity`'si, `remainingNear` onu
  sayiyor ve `harvest` tek yukte butunuyle cikariyor. Pinlenen sey buyukluk
  degil turun kendi tablosu; kurdun **yemedigi** de burada pinlendi.
- [x] **Mola ve yuva (Faz 5):** kurt oldurdugu govdenin uzerinde duruyor
  (`speed` sifir, aktivite `grazing`, hicbir sey isirilmiyor), mola turun kendi
  `restSeconds`'inden **kisa degil**, mola boyunca surunun geri kalani
  dokunulmamis kaliyor; sonunda cayir bosaliyor ama **birer birer**, ve yuva
  bittiginde hala yerinde - `rehome` reddi bir assertion olarak duruyor.
- [x] **Harita adaleti (Faz 7):** iki kralligin kurt yuvalarina yuruyus mesafeleri
  kumesi ayni; **hesaplanir**, pinlenmez.
- [x] **AI (Faz 7):** kurt bolgesinde isci kaybeden AI o bolgeyi surekli
  beslemez; uctan uca macta kurtlu haritada ac kalmaz.
- [ ] **Validator:** yirtici blogunda sifir/negatif `damage`, `attacksPerMinute`,
  `acquisitionRadius`, `pursuitRadius`; `pursuitRadius <= roamRadius`; ve
  yirtici olmayan turde tasinan yirtici alani - hepsi **dosya ve alan adiyla**
  reddedilir. Vurusun ne kadar sert oldugu kasitli olarak reddedilmez (V2 Faz 6
  notunun ayni gerekcesi).

Kapi: `npx tsc --noEmit`, `npm run test:engine`, `npm run build:verify`,
`npm run check:assets`. Olcek testi: `animals.json`, `units.json` ve
`buildings.json`'daki her buyukluk olceklenip suite yeniden kosulur; **yesil
kalmalidir**.

Faz 3'te olcek testi kosuldu (x0.6) ve **bir sey buldu**: yeni hedef-secimi
testi yarayi `assert.equal` ile karsilastiriyordu, yani yalnizca `damage` tam
sayiyken geciyordu - ondalikli bir ayarda tek bir ulp fark kirmizi yaniyor.
Tolerans eklendi. Ayni kosuda **V3'e ait olmayan** bir kirilganlik da goruldu
(V1 avlanma fixture'i, "the quarry was brought down"): kaynak temiz agacta,
ayni olceklenmis veriyle, ayni sekilde kirmizi yaniyor - yani mevcut ve V3'un
borcu degil. Not buraya, cozumu Faz 7'nin harita/AI isine.

Faz 4'te olcek testi (x0.6, uc tablo birden) **V3'te hicbir sey bulmadi**:
Faz 1-4'un on uc testinin hepsi olceklenmis veriyle yesil kaldi - yeni ucu de
mesafelerini turun kendi yaricaplarindan, yarayi da binanin kendi tablosundan
hesapladigi icin. Suite yine de iki yerde kirmizi yandi ve **ikisi de V3'e ait
degil**: (1) bir V2 agil fixture'i `missing-livestock` veriyor, cunku kulubenin
`gatherRadius`'u kuculunce authorlanmis sabit mesafedeki suru erisim disina
cikiyor; (2) Faz 3'un notuna dusulen orman/teslimat fixture'i ("one 40-wood tree
reaches camp in four 10-wood deliveries") ayni sekilde. Ikisi de fixture'in
sabit sayisi, kodun sozlesmesi degil - Faz 7'nin harita/AI isine.

Faz 5'te olcek testi (x0.6, uc tablo birden) **V3'te yine hicbir sey bulmadi**:
Faz 1-5'in on alti testinin hepsi olceklenmis veriyle yesil - yeni ucu de
mesafelerini iki turun kendi yaricaplarindan, oldurme suresini `damage` ve
`attacksPerMinute`'ten, mola alt sinirini `restSeconds`'ten hesapladigi icin.
Suite yine tek yerde kirmizi yandi ve o da **V3'e ait degil**: V2'nin
`pastureDriveFixture`'i (bu testte tek bir kurt yok, `PredatorSystem` hic
kurulmuyor) `remainingNear` esitligini kaciriyor, cunku kulubenin `gatherRadius`'u
kuculunce authorlanmis sabit mesafedeki hayvanlar erisimin icine/disina kayiyor -
Faz 3 ve Faz 4'un notlarina dusulen ayni sinif, ayni yer, Faz 7'nin isi.

Gorsel kabul kullanicidadir; otomatik kani uretilmez (CLAUDE.md).

## 9. Riskler ve Onlemler

| Risk | Onlem |
| --- | --- |
| **Ordunun yarisi geyik kovalar** (§3.4). Yaban hayati `combatTargets()`'a topluca girerse her muhafiz her hayvani hedefler. | Listeye giren sey **tur degil durum**: avlayan ya da bir kralligin toprakinda duran yirtici. Otlayan hayvan **hangi zeminde olursa olsun** listeye girmez ve bu testle pinlenir - test ayrica naif listeyi ayni muhafiza vererek riskin gercek oldugunu gosterir. |
| **Kurt haritanin yarisini kovalar.** `pursuitRadius` bir tasma degil bir tasima olursa kurt oyuncunun merkezine kadar gelir. | `pursuitRadius` yuvadan olculur ve validator harita olceginde bir degeri reddeder; yetisemeyen kurt devriyeye doner (`rehome`). |
| **Erken oyun cezasi cok sert.** Ilk bes dakikada isci kaybeden oyuncu geri donemeyebilir. | Hasar oyuncuya **zaman** birakacak sekilde ayarlandi (§6: ~12.5 s) ve bildirim (§3.10) oynanisin parcasi sayildi. Kabul macinda olculur; sertse `damage` degil `acquisitionRadius` dusurulur - tepki suresi degil, karsilasma sikligi. |
| **Kurt yuvalari erken temizlenip oyundan cikar** (Q3 = A'nin bedeli). | Yuvalar oyuncunun **gecmek zorunda kalacagi** yerlere konur (dis maden, stag surusu, agil koridoru). Faz 7'nin harita isi bunu olcer. |
| **Sidecar kopyala-yapistir sessizce kirilir** (§3.1'in harf tuzagi). | `animationSet` degerlerinin `.gltf` klip listesinde var oldugunu dogrulayan test (§8). |
| **AI kurt bolgesine isci beslemeye devam eder** (§3.11). | Faz 7 bunu kendi maddesi yapar; V2 Faz 7'nin "veri yetmez" dersi pesinen kabul edildi. |
| **Yirtici muafiyeti validator'da arka kapi acar** (§3.7). | Q2 = B onerisi muafiyeti hic acmaz; acilirsa muafiyetin kendisi pinlenir. |
| **`predatorSystem` `wildlifeRetaliation`'i yutar.** Iki sistem de "hayvan isciye vurur" der. | Ayri kalirlar ve gerekce dosyada yazilidir: biri **hedef secmez** (elini uzatani vurur), oteki **secer**. Birlestirme, secmeyen kurali secen kurala baglamak olur. |

## 10. Tamamlanma Kapisi

- [ ] §2'deki 11 madde uctan uca calisir.
- [ ] §8'deki tum sozlesme testleri gecer; olcek testi yesil kalir.
- [ ] `npx tsc --noEmit`, `npm run test:engine`, `npm run build:verify`,
  `npm run check:assets` yesil.
- [ ] Kullanici gorsel kabulu verdi.
- [ ] §4 kapsam disi listesinden hicbir sey V3'e sizmadi.
- [ ] V1 §3.9'un "isciler yirtici saldirisina sessizce kurban gider" borcu
  kapandi ve V1 dosyasinin §10 borc listesinde isaretlendi.
- [ ] V1 dosyasinin §12'sinde V3 tamamlandi olarak isaretlendi ve sira V4'e
  (Esek lojistigi) gecti.

## 11. Uygulama Sirasi

Faz 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 7. (KARAR 4 geregi Faz 6 yok.)

Faz 4 (karsilik) Faz 5'ten (geyik avi) **once** gelmelidir: kurt oldurulemeden
geyik avlamaya baslarsa, oyuncunun izleyip mudahale edemedigi bir kayip olur -
ozelligin en kotu hali. Faz 2 ve Faz 3 birbirinden ayrilamaz sirada.
