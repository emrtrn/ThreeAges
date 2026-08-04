# ThreeAges RTS - Yaban Hayati Hareket Cilasi Plani (donus + duraklama)

Olusturulma tarihi: 2026-08-04
Durum: **Faz 0 kilitli, Faz 1 ve Faz 2 uygulandi** (2026-08-04). Bes sorunun
besi de **A** cevaplandi (§4). Kalan: kullanici gorsel kabulu, Faz 3 (Q3 = B,
ayri madde olarak ertelendi) ve Faz 4'un tam mac kabulu.
Onkosul: V1 (`...WILDLIFE_AND_HUNTING_PLAN.md`), V2
(`...V2_PASTURE_AND_TAMING_PLAN.md`) ve V3'un Faz 3'u
(`...V3_PREDATOR_PRESSURE_PLAN.md`) tamamlandi; hepsinin gorsel kabulu verildi.

Bu dosya bir surum plani degil, bir **cila** planidir: yeni oynanis satmaz, var
olan hareketi izlenebilir yapar. Yirtici planinin Faz 4/5/7'sini **bloklamaz**;
paralel yurutulebilir.

## 1. Hedef

Bugun bir hayvan bir **yol izleyicisi** gibi hareket ediyor: A'dan B'ye yuruyor,
B'ye varinca C'ye **anlik** donuyor ve yeniden yuruyor. Iki sey eksik ve ikisi de
ayni cumleyi kuruyor - *bu hayvan B'ye neden gitti?*

- **Donus anlik.** Govde tek karede 120 derece cevriliyor. Bu, canli bir seyin
  yapabilecegi bir sey degil; oyuncunun gordugu, hedefi degisen bir imlec.
- **Duraklama anlamsiz.** Rahat surude duraklama var ama tehdit altindaki suruda
  **yok** (§3.2), ve varken de ne yapildigi turden bagimsiz: duran kurt ot yiyor
  (§3.3).

Kazanc dogrudan §1'in kendisi: harita, oyuncu bakmadigi zaman da bir seylerin
oldugu bir yer gibi gorunur. V3 bunu *olay* duzeyinde verdi (kurt isciye
saldiriyor); bu plan *davranis* duzeyinde verir.

## 2. Basari Tanimi

1. Hicbir hayvan tek karede buyuk bir aci donmez; donus **gorulebilir bir sure**
   alir ve tur bazlidir (agir sigir, cevik tilki).
2. Otcul durdugunda **otlar**; etcil durdugunda otlamaz, **kolacan eder**.
3. Bir hayvan hedefe vardiginda orada bir sey yapar - "neden gitti" sorusu
   ekrandan cevaplanir.
4. Kacistan sonra da durur: baski altindaki suru de otlar (bugunku sifir
   duraklama kapanir).
5. Tur farki **veriden** gelir, koddan degil; kod tek bir kural bilir.
6. Ayak kaymasi **artmaz**: donus, sunumun kendi kalibrasyonuyla uyumlu kalir ve
   donerken yurume klibi hala rate 1 civarinda oynar.
7. Hicbir sey navigasyona baglanmaz - hayvan hala bir nav ajani degildir
   (V1 Faz 2 karari korunur).

## 3. Mevcut Durum - Olculen Baslangic Noktasi

Asagidaki dort sayi 1200 saniyelik kosulardan olculdu (36000 tick, 1/30 s),
tahmin degil.

### 3.1 Donus tek karede ve **buyuk**

Bir hayvan durdugu yerden kalkarken govdesinin cevirdigi aci:

| tur / senaryo | ortalama donus | 90 derecenin ustu |
| --- | --- | --- |
| deer / rahat | **122 derece** | 89 / 110 kalkis (%81) |
| wolf / rahat | **123 derece** | 95 / 120 kalkis (%79) |
| deer / tehdit altinda | 83 derece | 44 / 95 |
| wolf / tehdit altinda | 111 derece | 97 / 140 |

Hepsi **tek tick**. Sebep tek satir ve uc yerde tekrar ediyor:
`facing: Math.atan2(dx, dz)` - `advanceRoam`'in yurume dali, `advanceLed` ve
`advanceHunt`. Hicbiri bir onceki facing'i okumuyor, yani bir donus hizi
kavrami **hic yok**.

Ortalamanin 120 derece cikmasi tesadüf degil: yeni otlama noktasi cemberin
icinde **uniform** seciliyor (`randomPointInHerd`), yani yeni yon eskisiyle
iliskisiz - beklenen aci 90 dereceye yakin ve kuyruk agir.

### 3.2 Kacis sonrasi duraklama **sifir** - yani gercek macta suru otlamiyor

| tur / senaryo | ortalama duraklama | sifir duraklama |
| --- | --- | --- |
| deer / rahat | 4.86 s | 0 / 110 |
| deer / **tehdit altinda** | **0.95 s** | **55 / 95** |
| wolf / tehdit altinda | 4.23 s | 5 / 140 |

Rahat surude `REST_SECONDS_MIN..MAX` (2.5-7) dogru calisiyor. Bozulan sey kacis:
`advanceRoam` bolt bitince `state.restSeconds = 0` yaziyor, varista ilk tick onu
negatife dusuruyor ve hayvan **ayni karede** yeni hedef secip yuruyor. Yani
etrafta insan olan bir suru - yani maçtaki her suru - varislerinin yarisindan
fazlasinda hic durmuyor.

Kurdun etkilenmemesinin nedeni V3: yirtici **hicbir seyden korkmuyor**, yani
bolt yolundan hic gecmiyor. Bu, hatanin tam olarak bolt yolunda oldugunun ikinci
kaniti.

### 3.3 Yaban hayati `idle` rolunu **hic** oynatmiyor

`wildlifeView.ts:122` her duran hayvan icin `working: true` gonderiyor,
`classifyRtsAnimation` (`rtsUnitAnimation.ts:153-154`) `work`'u `idle`'dan
**once** donduruyor. Sonuc: duran her hayvan `work` rolunde, ve
`animationSet.work` her turde `"Eating"`.

Yani **kurt duruyorken ot yiyor**. §2.2'nin istedigi "etcil kolacan eder"
bugun kod duzeyinde ulasilamaz bir hal - `idle` rolune giden yol yok.

### 3.4 Gerekli sanat **zaten alinmis**

Model basina 4-5 kullanilmayan klip var:

| model | kullanilan | **kullanilmayan** |
| --- | --- | --- |
| Wolf | Idle, Walk, Gallop, Gallop_Jump, Jump_ToIdle, Eating, Attack, Death | `Idle_2`, `Idle_2_HeadLow`, `Idle_HitReact1`, `Idle_HitReact2` |
| Deer | ayni sema | `Idle_2`, `Idle_Headlow`, `Idle_HitReact1`, `Idle_HitReact2`, `Attack_Kick` |

`Idle_2_HeadLow` / `Idle_Headlow` tam olarak "basi kaldirip cevreye bakan hayvan"
klibi. Yani bu plan **sanat istemiyor**, yalnizca var olani baglamayi istiyor.

### 3.5 Donus icin desen zaten repoda - TPS karakteri

`characterMovementSystem.ts:333-339`:

```ts
const yawRate = Math.max(0, movement.rotationRate[2]);
runtime.transform.rotation[1] = rotateYawToward(
  runtime.transform.rotation[1], targetYaw, yawRate * engine.deltaSeconds,
);
```

Kullanicinin isaret ettigi sey bu. `rotateYawToward` yeniden yazilmaz, **ayni
fonksiyon** kullanilir - yaban hayati icin tek yeni sey, hangi hizin nereden
geldigi.

### 3.6 RTS **birimleri de** anlik donuyor

`unitMovement.ts:149` `unit.object.rotation.y = Math.atan2(...)`. Yani sorun
yaban hayatina ozel degil; asker de anlik donuyor. Bu bir kapsam sorusu (§4 Q5)
ve **kasitla ayri tutuluyor**: birimin donusu emir/savas hissini degistirir ve
kendi kabul macini hak eder.

### 3.7 Yeni bir animasyon rolu **iki allowlist yuzeyine** dokunur

`animationSet`'e rol eklemek `SKELETON_ANIMATION_SET_ROLES`
(`tools/saveValidator.ts:2603`) **ve** loader'in `normalizeAssetSkeleton`
(`src/scene/assetSkeletonLoader.ts`) tarafina eklenmeyi gerektirir - yoksa alan
kaydederken sessizce dusulur (CLAUDE.md'nin ikinci allowlist yuzeyi). Loader'in
kendi yorumu bunu zaten yaziyor. Q3 = B secilirse bu is listeye girer.

### 3.8 Duraklama bugun **tek bir sayi ciftinden** geliyor

`REST_SECONDS_MIN = 2.5` / `MAX = 7`, `wildlifeRoaming.ts`'te **sabit**. Turden
bagimsiz: sigir da geyik de kurt da ayni sure duruyor. Balans tablosuna
tasinmasi bu planin en ucuz maddesi ve §2.5'in ("tur farki veriden gelir")
kosulu.

### 3.9 Olcum tekrari - **once / sonra** (2026-08-04)

Ayni kosu tekrarlandi: 36000 tick, 1/30 s (1200 s), tek hayvan, sabit tohum.
"Tehdit altinda" = surunun cemberinin disinda, 14 birim uzakta duran dort kisi
(rim `fleeRadius` icinde kalir, yani bolt sik olur ama hayvan aralarda otlama
noktalarina da varir).

| olcu | once | sonra |
| --- | --- | --- |
| deer / rahat - ortalama kalkis donusu | 117.8 derece | **7.2 derece** |
| deer / rahat - 90 derece ustu kalkis | 84 / 113 | **0 / 110** |
| wolf / rahat - ortalama kalkis donusu | 125.0 derece | **9.8 derece** |
| wolf / rahat - 90 derece ustu kalkis | 93 / 119 | **0 / 132** |
| deer / tehdit - ortalama kalkis donusu | 103.5 derece | **7.3 derece** |
| deer / tehdit - 90 derece ustu kalkis | 49 / 86 | **0 / 135** |
| **deer / tehdit - sifir duraklama** | **53 / 85** | **0 / 64** |
| deer / tehdit - ortalama duraklama | 1.71 s | **6.65 s** |
| deer / rahat - ortalama duraklama | 4.71 s | 4.73 s |
| wolf / rahat - ortalama duraklama | 4.77 s | **3.50 s** |
| tek tick'te en buyuk donus (deer) | 179.9 derece | **7.33 derece** |
| ayni, turun butcesi (220/30) | - | 7.33 derece |

Okunacak dort sey:

1. **Tek tick'te 90 derece ustu donus sifira indi** - §7 Faz 1'in kabul maddesi.
   Olculen en buyuk tek-tick donusu turun kendi butcesine **tam olarak** esit
   (7.33 = 220/30), yani cap gercekten baglayici.
2. **Kacis sonrasi sifir duraklama kapandi** (53/85 -> 0/64) - §7 Faz 2'nin
   kabul maddesi. Plan "rahat sururunkine yaklasir" diyordu; KARAR 4'un
   soluklanmasi yuzunden **ustune cikti** (6.65 s > 4.73 s), ki istenen his de
   budur: kacan hayvan varinca daha uzun durur.
3. **Rahat surunun duraklamasi degismedi** (4.71 -> 4.73 s): geyigin araligi
   zaten 2.5-7 idi ve tabloya oldugu gibi tasindi, yani bu yol bozulmadi.
4. **Kurdun duraklamasi kisaldi** (4.77 -> 3.50 s), cunku kurt artik paylasilan
   2.5-7'yi degil kendi 2-5'ini kullaniyor - §2.5 tek satirda gorunuyor.

Kalkis sayisinin tehdit altinda artmasi (86 -> 135) pivotun yan urunu: yerinde
donus bir "duruyor -> yuruyor" gecisi daha uretir. O gecislerde olculen aci
kucuk, cunku donusu zaten pivot yapmistir.

## 4. Tasarim Kararlari (Faz 0 - **KILITLI**, 2026-08-04)

Bes sorunun **besi de A** cevaplandi. Asagida her karar ve uygulamada ne haline
geldigi yazili.

### KARAR 1 (Q1 = A) - Donus hizi turden gelir

`animals.json`'a tur basina `turnRateDegPerSecond`. Sigir agir (110), tilki cevik
(360); §2.1 ve §2.5 birlikte karsilanir. `validateGameData` pozitif olmasini ve
**720** ust sinirini zorlar - ustu, yarim saniyede tam tur, yani gene anlik
sicrama.

Reddedilenler: tek paylasilan sabit (§2.5'i vermiyor, ilk tuning turunda zaten
bolunecekti) ve `moveSpeed`'ten turetme (kod veri yerine tahmin uretir; repo bu
deseni `walkClipSpeed`'te bilerek reddetmisti).

### KARAR 2 (Q2 = A) - Esik: kucuk aci yururken, buyuk aci yerinde

`PIVOT_THRESHOLD_DEG = 45` (`wildlifeRoaming.ts`). Esigin altinda hayvan
**yururken** doner ve yay cizer; ustunde **once yerinde doner**, sonra yurur.
Esik durum bilgisi tasimayan bir karsilastirma: her tick donus butcesi
harcandikca aci kuculur, yani pivot kendi kendini bitirir.

Yerinde donus **duraklamanin devami** olarak gosterilir (hiz 0, aktivite
degismez), yani yeni bir animasyon rolu gerekmedi.

Pivot yalniz otlama dalinda. Surme (`advanceLed`) ve kovalama (`advanceHunt`)
donus hizina tabi ama **pivotsuz**: kosede durup nisan alan bir surulen hayvan
suruden dusuyordu, duran bir yirtici da her kovalamayi kaybederdi (§9).

### KARAR 3 (Q3 = A) - Aktivite bildirilir; kolacan (B) ayri madde

`WildlifeAnimal.activity` (`"moving" | "grazing" | "alert"`) sunuma bildirilir;
`wildlifeView` artik `working`'i hizdan turetmiyor. Otcul -> `work` (Eating),
etcil -> `idle`. **Hicbir allowlist yuzeyine dokunulmadi** (§5.3).

Ucuncu deger (`alert`) bugun yalnizca "otlamiyor" demek, ama §3.4'un
kullanilmayan `Idle_2_HeadLow` klibinin baglanacagi yeri simdiden aciyor - Faz 3
bu seami yeniden yazmadan eklenebilir.

**Faz 3 (B) bilinçli olarak ertelendi**: once "kurt ot yemesin" kabulu alinir,
sonra "kurt kolacan etsin" eklenir. Iki belirsizligi ayni maca sokmamak, V3
KARAR 4'un ayni gerekcesi.

### KARAR 4 (Q4 = A) - Sifir duraklama bir hataydi; soluklanma eklendi

Bolt bitince `state.restSeconds = 0` yerine
`rollRestSeconds(profile, random) + profile.fleeRecoverySeconds` yazilir. Kacan
hayvan varinca **daha uzun** durur; olculdu (§3.9), tehdit altindaki geyigin
ortalama duraklamasi 1.71 s -> 6.65 s.

### KARAR 5 (Q5 = A) - RTS birimleri kapsam disi

`unitMovement.ts:149` bu planda **degistirilmedi**. Birimin donusu emir hissini,
savas hedeflemesini ve formasyonu etkiler; ayri bir plan ve ayri bir kabul maci
hak eder. `rotateYawToward` artik hem TPS karakteri hem yaban hayati tarafindan
paylasildigi icin o plan bedava baslar.

**Kapsam disi (bu plana sizmayacaklar):**

- Yurume/kosma arasi hizlanma ve yavaslama (ivme profili).
- Hayvanin navigasyona baglanmasi (V1 Faz 2 karari).
- Ayak yerlesimi (IK), egim uyumu, zemin yuksekligi ornekleme.
- Suru icinde birbirinden kacinma / ayrisma (separation).
- Baş-govde ayrik bakis (look-at / aim offset).
- Yeni klip **uretimi** - plan yalnizca var olani baglar.

## 5. Dokunulacak Dosyalar

### 5.1 Kod

| Dosya | Is |
| --- | --- |
| `src/game/rts/wildlife/wildlifeRoaming.ts` | Donus hizi (uc dalda da), kacis sonrasi duraklama, duraklama araliginin profilden okunmasi. Plan agirligi burada. |
| `src/game/rts/wildlife/wildlifeSystem.ts` | `wildProfileFor` yeni alanlari profile tasir; `WildlifeAnimal` aktiviteyi yayinlar. |
| `src/game/rts/wildlife/wildlifeView.ts` | `working`'i hizdan turetmeyi birakir, aktiviteyi okur (Q3). |
| `src/game/data/gameDataTypes.ts` | `AnimalBalanceStats`: `turnRateDegPerSecond`, duraklama araligi, (Q3=B ise) bosta tercihi. |
| `src/game/data/validateGameData.ts` | Yeni alanlarin dogrulamasi; **dosya ve alan adiyla** reddetme. |
| `engine/...` (`rotateYawToward`'in evi) | **Yeniden yazilmaz**, paylasilir. Konumu Faz 1'de tespit edilir; gerekiyorsa tasinir. |
| `src/game/rts/units/rtsUnitAnimation.ts` | Yalniz Q3 = B ise: yeni bosta rolu ve fallback zinciri. |
| `tools/engine-tests.ts` | §8'deki sozlesme testleri. |

### 5.2 Veri ve varlik

| Dosya | Is |
| --- | --- |
| `public/game-data/balance/animals.json` | Alti turun hepsine yeni alanlar. |
| `public/assets/ThreeAges/Animals/*.skeleton.json` | Yalniz Q3 = B ise: ikinci bosta klibi baglanir. |

### 5.3 Allowlist notu

Q3 = **A** secilirse **hicbir** allowlist yuzeyine dokunulmaz: aktivite bir
runtime alanidir, kaydedilen veri degil. Q3 = **B** secilirse §3.7'deki **iki**
yuzey de guncellenir (`SKELETON_ANIMATION_SET_ROLES` + `normalizeAssetSkeleton`)
ve dogrulanir - varsayilmaz: bir sidecar editorde kaydedilip yeniden yuklenir.

## 6. Balans Verisi (oneri)

Sayilar **oneridir**, kabul macinda ayarlanir; sozlesme testleri hicbirini
pinlemez (CLAUDE.md).

```json
"deer":  { "turnRateDegPerSecond": 220, "restSeconds": { "min": 2.5, "max": 7 } },
"stag":  { "turnRateDegPerSecond": 200, "restSeconds": { "min": 3,   "max": 8 } },
"cow":   { "turnRateDegPerSecond": 120, "restSeconds": { "min": 4,   "max": 9 } },
"bull":  { "turnRateDegPerSecond": 110, "restSeconds": { "min": 4,   "max": 9 } },
"wolf":  { "turnRateDegPerSecond": 300, "restSeconds": { "min": 2,   "max": 5 } },
"fox":   { "turnRateDegPerSecond": 360, "restSeconds": { "min": 1.5, "max": 4 } }
```

Gerekceler:

- **Yirtici hizli doner, otcul yavas.** Kurt 300 / tilki 360, sigir 110 - bu
  ayrim §2.1'in "tur bazli" iddiasinin tamami ve tek bakista okunur.
- **220 derece/s** bir geyige 120 derecelik ortalama donusu ~0.55 saniyede
  yaptirir: gorulebilir ama beklenmez. Bugun 0.033 saniye (tek kare).
- **Yirtici daha kisa durur** (2-5), cunku devriye gezen bir hayvanin bosta
  hali kisa ve tekrarlidir; otlayan bir hayvaninki uzundur.
- Faz 0'da Q1 = A secilirse validator ust sinir olarak `720` (yarim saniyede tam
  tur) uygular; ustu artik donus degil, gene anlik siçramadir.

## 7. Fazlar ve Checklist

### Faz 0 - Karar kilidi **[TAMAM]**

- [x] §4'teki Q1-Q5 cevaplandi (besi de **A**); bolum "KARAR 1-5" olarak yeniden
  yazildi ve gerekceler kayda gecti.
- [x] §2 degismedi: Q3 = A secildigi icin §2.2 dusurulmedi, yalniz "kolacan"
  yerine "otlamaz" olarak karsilandi (Faz 3 kalan is).

### Faz 1 - Donus hizi **[TAMAM, gorsel kabul bekliyor]**

- [x] `rotateYawToward`'in evi **`src/game/playerMovement.ts`** cikti (engine'de
  degil). Tasinmadi, **paylasildi**: `wildlifeRoaming.ts` onu ve
  `shortestYawDeltaDeg`'i import ediyor. Tek yeni sey bir birim koprusu -
  `transform.rotation` derece, yaban hayati facing'i radyan (§3.5).
- [x] `RoamProfile.turnRateDegPerSecond`; `wildProfileFor` **ve**
  `penProfileFor` (pastureSystem) onu tasir.
- [x] Uc dalin ucu de facing'i **atamak** yerine **cevirmek** ile gunceller.
  Kapsam onerilenden genis: `advanceRoam`'in yurume dali disinda **yakalanma**
  ve **bolt** dallari da cape tabi, cunku §2.1 istisna tanimiyor - kalkis
  karesinde 120 derece sicrayan bir govde, oyuncunun en cok baktigi anda fixi
  geri alirdi.
- [x] Q2 = A: `PIVOT_THRESHOLD_DEG = 45` ustundeki aci once yerinde donulur
  (hiz 0), sonra yurunur.
- [x] `animals.json` (alti turun hepsi) + `AnimalBalanceStats` + validator
  (`turnRateDegPerSecond` pozitif, ust sinir 720).
- [x] Kabul: `npx tsc --noEmit` ve `npm run test:engine` yesil kosuldu;
  `npm run check:assets` PASS. **Olcum tekrarlandi (§3.9)**: tek karelik 90+
  derece donusler **84/113 -> 0/110**. `build:verify` icin §8'in notuna bak.
- [ ] **Kullanici gorsel kabulu:** hayvanlar donerken donuyor, kayarak degil.

### Faz 2 - Duraklamanin anlami **[TAMAM, gorsel kabul bekliyor]**

- [x] §3.2 kapandi: bolt bitisi artik turun araligindan bir duraklama +
  `fleeRecoverySeconds` yaziyor (KARAR 4).
- [x] Duraklama araligi tur basina veriden geliyor (`restSeconds: {min,max}`);
  `REST_SECONDS_MIN/MAX` sabitleri silindi (§3.8).
- [x] Q3 = A: `WildlifeAnimal.activity` yayinlaniyor, `wildlifeView` `working`'i
  hizdan turetmeyi birakti. Duran otcul otlar, duran etcil otlamaz.
- [x] Kabul: olcum tekrarlandi (§3.9); tehdit altindaki geyigin **sifir
  duraklamasi 53/85 -> 0/64**, ortalama duraklama 1.71 s -> 6.65 s (rahat
  sururunun ustune cikti, soluklanma yuzunden - beklenen yon).
- [ ] **Kullanici gorsel kabulu:** hayvanin bir noktaya neden gittigi ekrandan
  okunuyor.

### Faz 3 - Kolacan (Q3 = B) **[ERTELENDI - KARAR 3]**

- [ ] `animationSet`'e ikinci bosta rolu; **iki** allowlist yuzeyi (§3.7).
- [ ] Rol zinciri ve fallback: klibi olmayan model eski davranisa duser.
- [ ] Bir sidecar editorde kaydedilip yeniden yuklenir - alan **dusmuyor**
  (varsayilmaz, dogrulanir).
- [ ] Kabul: kurt duraklamasinin bir kismini basini kaldirip bakarak geciriyor.
- [ ] **Kullanici gorsel kabulu.**

### Faz 4 - Butun halinde kabul **[testler gecti, tam mac bekliyor]**

- [x] V3'un kurt davranisi bozulmamis: V3 Faz 2/3'un devriye, kovalama ve yuvaya
  donus testleri yesil kaldi. Kovalama dalinda **pivot yok** ve yirticinin donus
  hizi otcullerin ustunde authorlandi (300/360'a karsi 110-220) - §9'un ilk
  riskinin onlemi veriden geliyor, koddan degil.
- [x] V2'nin surme kolu bozulmamis: `advanceLed` donus hizina tabi ama pivotsuz,
  pastura/surme testleri yesil kaldi.
- [x] V1'in avi bozulmamis: **yeni bir test bunu olcuyor** ("locomotion Faz 4: a
  turn rate does not put prey out of a hunter's reach") - en yavas isci bir
  geyigi bir dakika icinde hala koseye sikistiriyor. §9'un dedigi gibi
  `validateGameData`'nin esitsizligi donus suresini bilmiyor, o yuzden bu
  **ancak** testle yakalanabilirdi.
- [ ] Tam mac; **kullanici gorsel kabulu**.

## 8. Test ve Gate

CLAUDE.md kurali: **ayar degil sozlesme**. Hicbir test bir buyuklugu pinlemez.
Hepsi `tools/engine-tests.ts`'te.

- [x] **Donus sinirlidir (Faz 1):** *"no movement branch turns a body faster than
  its species' rate"*. Alti turun **hepsi** icin, uc hareket dalinin **ucunde
  de**, butce `turnRateDegPerSecond * dt`'den **hesaplanarak**.
- [x] **Donus tamamlanir (Faz 1):** *"a turn finishes, and takes the short way
  round"*. Tam arkasindaki hedefe konan bir geyik oraya **variyor**; sure de
  tablodan turetiliyor (yarim tur + kendi yurume hizinda mesafe).
- [x] **Yon dogrudur (Faz 1):** ayni test - 350 dereceye giden hayvan 10 derece
  **geri** donuyor.
- [x] **Duraklama her varista olur (Faz 2):** *"every arrival earns a pause, the
  one after a bolt included"*. Iki katman: bolt bitisinde `restSeconds > 0` ve
  `>= restSeconds.min + fleeRecoverySeconds` (tablodan turetilmis), ustune uzun
  bir tehditli kosuda **sifir duraklamali varis sayisi = 0**.
- [x] **Duraklama turden gelir (Faz 2):** *"how long an animal stands comes from
  its species"*. Her turun gozlenen duraklamalari **kendi** araliginda; ayrica
  authorlanan ortalamasi buyuk olan turun gozlenen ortalamasi da buyuk. Kosu
  uzunlugu da tablodan turetiliyor, yani `restSeconds` yukari cekilince test
  ornekleme yapmayi birakmiyor.
- [x] **Duran hayvanin isi turundendir (Faz 2):** *"a standing animal's job comes
  from what it is, not from its speed"*. Alti turun hepsi icin: otcul `work`,
  etcil `idle` - **hicbir** turde etcil `Eating` rolune ulasmiyor. Hem
  `activity` hem `wildlifeView`'in gonderdigi `working` hem de
  `classifyRtsAnimation`'in donen rolu ayni cumleyi kuruyor.
- [x] **Hiz yalani yok (regresyon):** var olan rim testi korundu ve gecti.
- [x] **Yakalanabilirlik (Faz 4):** *"a turn rate does not put prey out of a
  hunter's reach"*.
- [x] **Validator:** sifir ve **721** `turnRateDegPerSecond` (720'nin kendisi
  legal - sinir bir sinir, bir buyukluk degil), negatif `restSeconds.min/max`,
  eksik `restSeconds`, ters aralik (`min > max`) - hepsi **dosya ve alan adiyla**
  reddediliyor. `{min: 0, max: 0}` bilinçli olarak legal: hic yerlesmeyen bir tur
  bir mizactir, bozuk veri degil.

Kapi: `npx tsc --noEmit` ve `npm run test:engine` bu degisiklikle **yesil
kosuldu**; `npm run check:assets` PASS.

**Not (2026-08-04):** `build:verify` bu planin isi yuzunden degil, ayni anda
suren V3 Faz 5 (yirtici besleme) calismasi yuzunden su an kirmizi -
`predatorSystem.ts` yarim bir refactor'de (`aggressors()` -> `hostile()` yeniden
adlandirmasi ve eksik `chewOn`/`hold`/`beginMeal` uyeleri). O dosyaya
dokunulmadi. O is oturunca tam kapi tekrar kosulmali.

Olcek testi: `restSeconds` x3 ve `turnRateDegPerSecond` x2 ile turetilmis kosu
uzunluklari her turde 61-88 varis uretiyor (testlerin kendi esigi 20), yani
sozlesmeler tuning'e degil sekle bagli. `animals.json`'in **tumunu** x1.25
olceklemek ise bu planla ilgisiz, **onceden var olan** bir capraz-dosya bagini
kiriyor: `wolf.roamRadius` (14) `outpost.controlRadius`'un (16) altinda kalmak
zorunda ve 17.5'e cikiyor. O bagi bu plan eklemedi.

Gorsel kabul kullanicidadir; otomatik kani uretilmez (CLAUDE.md).

## 9. Riskler ve Onlemler

| Risk | Onlem |
| --- | --- |
| **Donus hizi avi bozar.** Kacan hayvan donerken yavaslamiyor ama yon degistirmesi geciktigi icin efektif kacis mesafesi degisir; `validateGameData`'nin yakalanabilirlik esitsizligi bunu **bilmiyor**. | Faz 4'un kendi maddesi: avin hala bittigi olculur. Bozulursa cozum esitsizligi karmasiklastirmak degil, donus hizini tabandan yukseltmektir. |
| **Kovalama yavaslar.** V3'un kurdu hedefe dogru surekli yeniden nisan aliyor; donus hizi bunu bir yaya cevirirse kurt isciyi yakalayamaz. | Yirticinin donus hizi digerlerinin ustunde onerildi (§6) ve Faz 4 kovalamayi ayrica olcuyor. Gerekirse kovalama dalinda donus hizi carpani - ama **veriden**, koddan degil. |
| **Yerinde donus suruyu statik gosterir** (Q2 = A/C). | Yerinde donus duraklamanin devami olarak gosterilir, yani zaten duran bir hayvanin uzerine bir bekleme daha binmez; esik Faz 1'de gorsel kabulle ayarlanir. |
| **Coban surusu geride kalir** (V2). `advanceLed` donus hizina tabi olursa hayvan kosede coban yolunu keserken yalpalar. | Faz 4'un kendi maddesi. `DRIVE_FOLLOW_GAP` zaten bir tampon; yetmezse surme dalinda donus hizi serbest birakilir ve gerekce yazilir. |
| **Ikinci bosta rolu sessizce dusulur** (§3.7). | Iki allowlist yuzeyi de guncellenir **ve** bir sidecar kaydet/yeniden yukle turuyla dogrulanir; klibi olmayan model icin fallback zinciri testle pinlenir. |
| **Bu plan V3'u bloklar.** | Bloklamaz: dosya kesisimi `wildlifeRoaming` + `wildlifeSystem`, ve V3 Faz 4/5 asil olarak `RtsApp`/`engagementSystem` tarafinda. Sira serbest; ayni anda calisiliyorsa kesisen iki dosya once birlestirilir. |

## 10. Tamamlanma Kapisi

- [x] §2'deki 7 madde uctan uca calisir - 2. maddenin "kolacan" yarisi haric
  ("etcil durdugunda otlamaz" verildi, "kolacan eder" Faz 3'te).
- [x] §8'deki tum sozlesme testleri gecer; olcek testi (bu planin alanlari
  uzerinde) yesil kalir - §8'in notuna bak.
- [x] `npx tsc --noEmit`, `npm run test:engine`, `npm run check:assets` yesil.
  `build:verify` eszamanli V3 Faz 5 calismasi yuzunden bekliyor (§8 notu).
- [x] §3.1 ve §3.2'nin olcumleri **tekrarlandi** ve §3.9'a "once/sonra" olarak
  yazildi.
- [ ] Kullanici gorsel kabulu verdi.
- [x] §4 kapsam disi listesinden hicbir sey sizmadi: ivme profili, navigasyon,
  IK/egim, separation, look-at ve yeni klip uretimi - hicbirine dokunulmadi;
  RTS birimleri (KARAR 5) da kapsam disinda birakildi.

## 11. Uygulama Sirasi

Faz 0 -> 1 -> 2 -> (Q3 = B ise 3) -> 4.

**Yurutuldu:** Faz 0 (kararlar) -> Faz 1 (donus) -> Faz 2 (duraklama +
aktivite) -> Faz 4'un otomatik yarisi. Faz 3 KARAR 3 geregi ertelendi; Faz 4'un
tam mac kabulu ve Faz 1/2'nin gorsel kabulu kullanicida.

Faz 1 once gelmelidir: duraklamanin anlami donus duzelmeden **gorulemez** -
bugun hayvan zaten duruyor (rahat surude 4.86 s), ama kalkis anindaki tek
karelik 120 derece o duraklamayi ekranda yok ediyor. Once donus, sonra ona ne
kadar sure verildigi.
