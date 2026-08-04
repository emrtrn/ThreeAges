# ThreeAges RTS - Yaban Hayati Hareket Cilasi Plani (donus + duraklama)

Olusturulma tarihi: 2026-08-04
Durum: **Faz 0 acik** - §4'teki bes soru kullanicida.
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

## 4. Tasarim Kararlari (Faz 0 - **kullanicida**)

Bes soru. Her birinde bir **oneri** var ve gerekcesi yazili; kullanici kilitler,
sonra kod yazilir.

### Q1 - Donus hizi nereden gelir?

- **A (oneri): `animals.json`'a tur basina `turnRateDegPerSecond`.** Sigir agir,
  tilki cevik olur; §2.1 ve §2.5 birlikte karsilanir. Validator pozitif ve
  makul bir ust sinir (ornegin 720) zorunlu kilar.
- B: tek bir paylasilan sabit. Ucuz ama §2.5'i vermiyor ve ilk tuning turunda
  zaten tur basina bolunecek.
- C: `moveSpeed`'ten turetilen bir formul. Kod, veri yerine tahmin uretir; repo
  bu deseni `walkClipSpeed`'te bilerek reddetmisti (Deer ve Cow ayni klipten
  farkli sayi authorluyor).

### Q2 - Hayvan yururken mi doner, yerinde mi?

- **A (oneri): esik.** Aci kucukse (< bir `pivotThreshold`) **yururken** doner -
  yay cizer, dogal. Buyukse **once yerinde doner**, sonra yurur. §3.1'in
  kuyrugu agir oldugu icin (kalkislarin %80'i 90 derecenin ustu) yalniz yay
  cizmek hayvani cemberin yarisini tarayarak yururken birakir, ki bu da yeni bir
  "neden oraya gitti" sorusudur.
- B: her zaman yururken don (saf `rotateYawToward`). En az kod, ama yukaridaki
  kuyruk yuzunden en cok yay.
- C: her zaman yerinde don. Okunakli ama hayvani her kalkista birkac saniye
  cakili birakir; suru statik gorunur.

Not: A secilirse yerinde donus **duraklamanin devami** olarak gosterilir
(hiz 0, rol `idle`/`work`), yani yeni bir animasyon rolu gerektirmez.

### Q3 - Duran hayvan ne yapiyor?

- **A (oneri, ucuz): yaban hayati sunuma bir "aktivite" bildirir**, hizdan
  turetilmez. Otcul -> `work` (Eating), etcil -> `idle`. §3.3'un kapisi acilir,
  yeni klip **rolu** eklenmez, iki allowlist yuzeyi **dokunulmaz**.
- B (zengin): `animationSet`'e ikinci bir bosta rolu (`idle_alert` ->
  `Idle_2_HeadLow` / `Idle_Headlow`) eklenir; etcil duraklamanin bir kismini
  kolacan ederek gecirir. §3.4'un sanatini gercekten kullanan tek secenek, ama
  §3.7'nin iki allowlist yuzeyine dokunur ve kendi testini hak eder.
- C: bugunku gibi birak. §2.2 dusurulur.

Oneri **A, sonra ayri bir madde olarak B** - once "kurt ot yemesin" kabulu
alinir, sonra "kurt kolacan etsin" eklenir. Iki belirsizligi ayni maça sokmamak,
V3 KARAR 4'un ayni gerekcesi.

### Q4 - Kacis sonrasi duraklama (§3.2) bir hata mi, bir ayar mi?

- **A (oneri): hata; duzeltilir ve ustune bir "soluklanma" eklenir.** Bolt
  bitince `restSeconds = 0` yerine turun kendi duraklama araligindan bir deger
  yazilir; istege bagli olarak `fleeRecoverySeconds` ile iliskilendirilir -
  kacan hayvan varinca **daha uzun** durur, ki dogru his de budur.
- B: yalniz sifiri kaldir, soluklanma ekleme. Daha az yuzey, daha az his.

### Q5 - RTS birimleri (§3.6) bu plana dahil mi?

- **A (oneri): hayir, kapsam disi.** Bu plan yaban hayatidir. Birimin donusu
  emir hissini, savas hedeflemesini ve formasyonu etkiler; ayri bir plan ve ayri
  bir kabul maci hak eder. `rotateYawToward` paylasildigi icin o plan **bedava**
  baslar.
- B: ayni pakette yap. Tek dokunusta tutarli bir dunya, ama iki farkli kabul
  olcusunu ayni maca sokar.

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

### Faz 0 - Karar kilidi **[ACIK - kullanicida]**

- [ ] §4'teki Q1-Q5 cevaplanir; bolum "KARAR" olarak yeniden yazilir ve
  gerekceler kayda gecer.
- [ ] Kararlarin §2'yi degistirdigi yerler guncellenir (ozellikle Q3 = C
  secilirse §2.2 dusurulur).

### Faz 1 - Donus hizi (davranis degismez, yalniz aci zamana yayilir)

- [ ] `rotateYawToward`'in evi tespit edilir ve **paylasilir**; ikinci bir kopya
  yazilmaz (§3.5).
- [ ] `RoamProfile`'a donus hizi; `wildProfileFor` onu tasir.
- [ ] Uc dalin ucu de (`advanceRoam` yurume, `advanceLed`, `advanceHunt`)
  facing'i **atamak** yerine **cevirmek** ile gunceller.
- [ ] Q2 = A ise: esigin ustundeki aci once yerinde donulur (hiz 0), sonra
  yurunur.
- [ ] `animals.json` + tipler + validator.
- [ ] Kabul: `npx tsc --noEmit`, `npm run test:engine`, `npm run build:verify`,
  `npm run check:assets` yesil; **olcum** tekrarlanir ve tek karelik 90+ derece
  donuslerin sayisi sifira iner.
- [ ] **Kullanici gorsel kabulu:** hayvanlar donerken donuyor, kayarak degil.

### Faz 2 - Duraklamanin anlami

- [ ] §3.2 kapanir: kacis sonrasi varista da duraklama olur (Q4).
- [ ] Duraklama araligi tur basina veriden gelir (§3.8).
- [ ] Q3'e gore: duran otcul otlar, duran etcil otlamaz.
- [ ] Kabul: olcum tekrarlanir; tehdit altindaki geyigin **sifir duraklamasi**
  55/95'ten 0'a iner ve ortalama duraklama rahat sururunkine yaklasir.
- [ ] **Kullanici gorsel kabulu:** hayvanin bir noktaya neden gittigi ekrandan
  okunuyor.

### Faz 3 - Kolacan (yalniz Q3 = B ise)

- [ ] `animationSet`'e ikinci bosta rolu; **iki** allowlist yuzeyi (§3.7).
- [ ] Rol zinciri ve fallback: klibi olmayan model eski davranisa duser.
- [ ] Bir sidecar editorde kaydedilip yeniden yuklenir - alan **dusmuyor**
  (varsayilmaz, dogrulanir).
- [ ] Kabul: kurt duraklamasinin bir kismini basini kaldirip bakarak geciriyor.
- [ ] **Kullanici gorsel kabulu.**

### Faz 4 - Butun halinde kabul

- [ ] V3'un kurt davranisi bozulmamis: devriye, kovalama, yuvaya donus - donus
  hizi kovalamayi **yavaslatmiyor** (§9'un ilk riski).
- [ ] V2'nin surme kolu bozulmamis: coban pesindeki hayvan hala yetisiyor.
- [ ] V1'in avi bozulmamis: kacan hayvan hala yakalanabiliyor - §3.7'nin
  yakalanabilirlik esitsizligi **donus suresini bilmiyor**, yani bu risk
  olculmeli (§9).
- [ ] Tam mac; **kullanici gorsel kabulu**.

## 8. Test ve Gate

CLAUDE.md kurali: **ayar degil sozlesme**. Hicbir test bir buyuklugu pinlemez.

- [ ] **Donus sinirlidir (Faz 1):** hicbir tick'te facing degisimi turun kendi
  `turnRateDegPerSecond * dt`'sini asmaz - uc hareket dalinin **ucunde de**,
  tablodan **hesaplanarak**.
- [ ] **Donus tamamlanir (Faz 1):** yeterli sure verilen bir hayvan hedef
  yonunu **tutturur**; donus hizi bir hayvani hedefine varmaktan alikoymaz
  (sonsuz yay yok).
- [ ] **Yon dogrudur (Faz 1):** kisa yoldan donulur - 350 dereceye giden bir
  hayvan 10 derece geri doner, 350 derece ileri degil.
- [ ] **Duraklama her varista olur (Faz 2):** kacis **sonrasi** varista da
  duraklama > 0; bugunku sifir yolu bir testle kapatilir.
- [ ] **Duraklama turden gelir (Faz 2):** iki turun duraklama araligi farkliysa
  gozlenen duraklamalar da farklidir - tablodan hesaplanarak, sureye
  pinlenmeden.
- [ ] **Duran hayvanin isi turundendir (Faz 2/3):** otcul `work`, etcil `idle`
  (veya Q3=B'de kolacan) - **hicbir** turde etcil `Eating` oynatmaz.
- [ ] **Hiz yalani yok (regresyon):** bildirilen `speed` her tick'te gercek yer
  degistirmeye esit kalir - V3 Faz 3'te olculen 0 farkin korunmasi.
- [ ] **Yakalanabilirlik (Faz 4):** donus hizi eklendikten sonra da bir avci bir
  geyigi yakalayabiliyor; `validateGameData`'nin esitsizligi donus suresini
  bilmiyorsa bu **ancak** testle yakalanir (§9).
- [ ] **Validator:** sifir/negatif/asiri `turnRateDegPerSecond`, ters duraklama
  araligi (`min > max`), negatif duraklama - hepsi **dosya ve alan adiyla**
  reddedilir.

Kapi: `npx tsc --noEmit`, `npm run test:engine`, `npm run build:verify`,
`npm run check:assets`. Olcek testi: `animals.json`'daki her buyukluk
olceklenip suite yeniden kosulur; **yesil kalmalidir**.

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

- [ ] §2'deki 7 madde uctan uca calisir.
- [ ] §8'deki tum sozlesme testleri gecer; olcek testi yesil kalir.
- [ ] `npx tsc --noEmit`, `npm run test:engine`, `npm run build:verify`,
  `npm run check:assets` yesil.
- [ ] §3.1 ve §3.2'nin olcumleri **tekrarlanir** ve plan dosyasina "once/sonra"
  olarak yazilir.
- [ ] Kullanici gorsel kabulu verdi.
- [ ] §4 kapsam disi listesinden hicbir sey sizmadi.

## 11. Uygulama Sirasi

Faz 0 -> 1 -> 2 -> (Q3 = B ise 3) -> 4.

Faz 1 once gelmelidir: duraklamanin anlami donus duzelmeden **gorulemez** -
bugun hayvan zaten duruyor (rahat surude 4.86 s), ama kalkis anindaki tek
karelik 120 derece o duraklamayi ekranda yok ediyor. Once donus, sonra ona ne
kadar sure verildigi.
