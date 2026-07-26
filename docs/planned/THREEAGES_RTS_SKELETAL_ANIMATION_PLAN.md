# ThreeAges RTS Skeletal Animasyon Uygulama Plani

Olusturulma tarihi: 2026-07-25
Durum: Faz A-D tamamlandi (C kullanici tarafindan dogrulandi; D gozlem
bekliyor). Faz E'nin sema kismi D ile birlikte indi. Sonraki is: Faz F
(kapsam ve performans).
Kapsam: RTS birimlerinin skeletal mesh'ini yasayan bir karakter haline getirmek;
bosta durma, yurume, saldiri ve olum animasyonlarini oynatan bir sunum katmani.

Bu dokuman `THREEAGES_RTS_ACTOR_COVERAGE_AND_ANIMATION_PLAN.md` icindeki §4.1,
Faz 1 ve Faz 4'un animasyon kismini **yurutme takibi** olarak devralir. O
dokuman kapsam/authoring otoritesi (hangi id hangi Actor'a baglanir) olarak
gecerli kalir; burasi yalnizca "iskelet nasil oynar" sorusunun fazlara bolunmus
kontrol listesidir. Building coverage matrisi bu planin disindadir.

## 1. Hedef

Muhafiz dururken nefes alir, emir alinca yurur, menzile girince saldiri
animasyonu oynatir, oldugunde yere duser. Animasyon hicbir simulasyon sonucunu
degistirmez ve birimin konumunu kaydirmaz.

## 2. Basari Tanimi

Asagidaki akisin calismasi hedeflenir:

1. Mac baslar, muhafizlar `Idle_Loop` ile ayakta bekler.
2. Sag tik emriyle `Walk_Loop`/`Jog_Fwd_Loop` oynar, hiz ile ayak temasi
   uyumludur (buz ustunde kayma yok).
3. Hedef menzile girince birim durur ve `Sword_Attack` oynatir; her saldiri
   cooldown'unda bir kez.
4. Can bitince `Death01` oynar ve birim animasyon bitmeden yok olmaz.
5. 40 birimlik bir ordu kamera altinda frame butcesini bozmaz.

## 3. Mevcut Durum

### 3.1 Elde olan

- `UAL1_Standard_RM.glb` 45 klip tasir. Ihtiyac duyulanlarin hepsi icindedir:
  `Idle_Loop`, `Walk_Loop`, `Jog_Fwd_Loop`, `Sprint_Loop`, `Sword_Idle`,
  `Sword_Attack`, `Punch_Jab`, `Punch_Cross`, `Hit_Chest`, `Hit_Head`,
  `Death01`.
- `UAL1_Standard_RM.skeleton.json` semantic `animationSet` (`idle`/`walk`/`run`)
  ve `Walk_Loop`/`Jog_Fwd_Loop`/`Sprint_Loop` icin `lockXZ` root motion ayarini
  tasir.
- Motor tarafi hazir ve genel amaclidir:
  - `engine/render-three/characterAnimator.ts` - `CrossfadeAnimator`
    (isimle crossfade + faz-senkron agirlikli blend).
  - `engine/render-three/layeredCharacterAnimator.ts` - ust govde slot/montage.
  - `engine/render-three/animationSubsystem.ts` - mixer tick'i ve mesafeye gore
    guncelleme seyreklestirme.
  - `engine/render-three/rootMotion.ts`, `src/game/animationNotifies.ts`,
    `src/scene/assetSkeletonLoader.ts`.
  - `src/game/gameModes/tpsCharacterGameMode.ts` bunlarin birlikte nasil
    kuruldugunun calisan referansidir.
- Actor presentation yolu artik varsayilandir (`contentAssets` flag'i emekli
  edildi) ve per-ref hata izolasyonu tamamlanmistir: tek bozuk Actor yalnizca
  kendi placeholder'ina duser.

### 3.2 Eksik olan dort baglanti

1. **Klipler atiliyor.** `RtsActorVisualFactory.templateFor` yalnizca
   `gltf.scene`'i cache'ler; `gltf.animations` kaybolur.
2. **Klon iskeleti paylasiyor.** `rtsActorPresentationTree.ts` duz
   `template.clone(true)` yapar. Bu, klonu sablonun iskeletine bagli birakir;
   sahne disindaki kemikler hic guncellenmedigi icin mesh gorunmez olur ve
   birim basina bagimsiz poz imkansizdir.
3. **Kimse tick etmiyor.** `RtsPresentationHandle.update(deltaSeconds)`
   `src/game/rts/units/unit.ts` icinde tanimlidir ama hicbir yerden
   cagrilmaz.
4. **RTS'e uygun durum secici yok.** `src/game/locomotionAnimation.ts` TPS
   sekillidir (`grounded`, `velocityY`, ziplama). RTS'in ihtiyaci daha dardir.

## 4. Degismez Sinirlar

- Root motion kullanilmaz. RTS hareketi kodla surulur; sidecar'daki `lockXZ`
  ayarlari korunur ve animatore aktarilir.
- Animasyon durumu simulasyondan **turetilir**, simulasyonu surmez. Hasar,
  menzil, cooldown ve olum kararlari mevcut sistemlerde kalir.
- Klip isimleri koda gomulmez; veri (`skeleton.json` `animationSet` veya
  Actor Script) otoritedir. Kodda yalnizca semantic rol ve dusme zinciri bulunur.
- Sunum render-frame delta'siyla calisir, simulasyon delta'siyla degil - mevcut
  RTS sunum politikasiyla ayni (tracer/can bari her oyun hizinda ayni gorunur).
- Bir birimin Actor'u yoksa veya bozuksa mevcut kapsul fallback'i oynanabilir
  kalir.

## 5. Uygulama Fazlari

### Faz A - Instans basina iskelet ve klip tasima

Ön kosul faz. Bu adim tek basina muhafizlarin gorunurlugunu de duzeltir, cunku
gorunmezligin sebebi paylasilan iskelettir.

- [x] `RtsActorVisualFactory.templateFor` `{ scene, animations, skeleton }`
      cache'lesin; `templateLoads` promise paylasimi korunsun.
- [x] `buildActorPresentationTree` skeletal klonu `SkeletonUtils.clone` ile
      uretsin (`engine/render-three/models.ts` icindeki
      `cloneSkeletonHierarchy` ile ayni yol). Static mesh davranisi degismesin.
- [x] Actor'un klip kaynagi cagirana ulassin. **Sapma:** agac degil, factory
      tasiyor (`animationSourceFor`) - klipler sahne grafigi seklini
      etkilemedigi icin `buildActorPresentationTree` saf kaldi.
- [x] `RtsActorPresentationError` yolu ve placeholder davranisi bozulmasin.
- [x] Engine test: iki ayri klon iki ayri `Skeleton` ornegine baglanir
      ("Skeletal animasyon Faz A"), ayrica geometri/material paylasimi pinlendi.
- [x] Engine test: static mesh Actor agaci (bina yolu) node sayisi ve local
      transform'lari degismeden kalir - mevcut "Actor presentation Faz 2" testi
      artik yeni klon yolundan geciyor ve bu maddenin muhafizi o.

Kabul: Muhafizlar sahada gorunur ve bind pozunda ayakta durur; binalarda
gorsel regresyon yoktur.

### Faz B - Animator sahipligi ve tick zinciri

- [x] `src/game/rts/content/rtsUnitPresentation.ts`: `CrossfadeAnimator`'i
      saran, `RtsPresentationHandle` sozlesmesini dolduran sunum sinifi.
- [x] `createUnitPresentation` bu sinifi dondursun; `pickTargets` ve
      `selectionRadius` davranisi korunsun.
- [x] Skeleton sidecar (`*.skeleton.json`) yuklensin; `animationSet` ve
      `rootMotion` ayarlari animatore verilsin. Sidecar model ile ayni
      `templateFor` cagrisinda yuklenir ve asset basina cache'lenir.
- [x] `dispose` mixer action'larini durdursun ve binding cache'ini biraksin
      (`stopAllAction` + `uncacheRoot`), sonra subtree'yi ayirsin.
      **Sapma:** `AnimationSubsystem`'e kayit yok - `RtsApp` kendi rAF
      dongusunu kullaniyor ve bir subsystem registry'si tasimiyor.
- [x] Tick zinciri: `RtsApp` render dt -> `UnitSystem.updatePresentation` ->
      `Unit` -> `handle.update(...)`.
- [x] `Unit` mevcut hareket/savas/olum durumundan kucuk bir sunum snapshot'i
      uretsin (hiz, saldiri isareti, oluyor mu). Yeni gameplay state eklenmedi;
      hiz gercek yer degistirmeden olculuyor (`measurePlanarSpeed`), boylece
      kalabaliga sikismis birim yavas raporlanir.
- [x] Karar kaydi: tek kanalli `CrossfadeAnimator` kullanilir,
      `LayeredCharacterAnimator` degil - RTS birimi saldirmak icin zaten durur
      ve katmanli animator birim basina iki mixer maliyeti getirir.

- [x] **Tuzak, pinlendi:** mixer yazarin bilesen agacina degil klonlanmis
      modele baglanir. glTF parcalari dugumleri isimle adresler; UAL1 rig'inde
      `root` adli bir kemik var (dinlenme rotasyonu X'te -90°, Z-up telafisi) ve
      Actor Script'ler tabanina `root` demeyi seviyor. Sunum kokune baglanirsa
      `PropertyBinding` once bileseni bulur, kemik hic surulmez ve -90° tum
      birime uygulanir - muhafizlar sirtustu yatar. Engine testi:
      "Skeletal animasyon Faz B: bir kemik adiyla cakisan bileseni klip suremez".

Kabul: **Karsilandi** - kullanici onayladi (2026-07-26): muhafizlar dik duruyor
ve animasyon oynuyor.

### Faz C - Locomotion: bosta / yurume

- [x] `src/game/rts/units/rtsUnitAnimation.ts`: saf (Three.js'siz) durum
      secici - `(hiz, saldiri, olum) -> semantic rol`. Roller:
      `idle`/`walk`/`run`/`attack`/`death`; oncelik olum > saldiri > hiz.
      `attack`/`death` bugun zaten siniflandirilir ama sidecar'da karsiligi
      yoktur (Faz E), bu yuzden idle'a duserler - oynatma semantigi (tek atim)
      Faz D'nin isi.
- [x] Rol dusme zinciri: eksik klip bir ust role duser (`walk` -> `run` ->
      `idle`), asla T-pose'a dusmez. **Karar:** zincir bos donunce secici `null`
      dondurur ve surucu mevcut pozu korur; "eldeki herhangi bir klip" son
      caresi bilerek yok, cunku UAL1 setinde `A_TPose` gercek bir klip adidir
      ve tam da kacinilan poza kilitlerdi.
- [x] Ayak kaymasi: klip zaman olcegi gercek hiza oranlanir
      (`CrossfadeAnimator.setPlaybackRate`, her karede `play` sonrasi yeniden
      uygulanir). `playBlend` secilmedi: sidecar'in blend space'i ornek
      tasimiyor. **Kalibrasyon varsayimi:** run klibi birimin tam `moveSpeed`
      degerinde (Muhafiz icin 6 birim/s), walk klibi onun yarisinda doğru
      okunur; oran `[0.4, 1.8]` araliğina kirpilir. Esikler de birim basina
      `moveSpeed`'ten turetilir - 4 birim/s'lik Isci ile 6'lik Muhafiz ayni
      sabit esigi paylasamaz.
- [x] `lockXZ` root motion ayarinin uygulandigi dogrulandi - engine testi ayni
      klibi ayarli/ayarsiz surerek Z surüklenmesinin yalnizca ayarsiz halde
      olustugunu pinler.
- [x] Engine test: hiz esikleri, rol onceligi ve dusme zinciri
      ("Skeletal animasyon Faz C: hiz esikleri, rol onceligi ve dusme zinciri").
- [x] Engine test: animasyon secimi birim konumunu/statlarini degistirmez
      (yurutulen birimde konum, can, saldiri cooldown'u ve emir degismez).

Kabul: Emirle yurume, durunca crossfade ile idle'a donus; hiz degisiminde
ayak temasi tutarli. **Kullanici gozlemi bekliyor** (kalibrasyon sabitleri
`RTS_LOCOMOTION_CALIBRATION` altinda tek yerde, gerekirse oradan ayarlanir).

### Faz D - Saldiri ve olum

- [x] Saldiri tek atimlik (loop'suz) oynatilir: `CrossfadeAnimator.playOnce`
      (`LoopOnce` + `clampWhenFinished`). Tetik `AttackComponent.blowCount` -
      `tryHit` hasari cozdukten *sonra* artan monoton sayac; her artis bir
      salinim. Bagimlilik yonu bilerek tek yonlu: sayaci kimse savasta okumaz.
- [x] Surekli kanal ile tek atimlik kanal ayrildi: `attack`/`death` rollerinin
      **dongusel** dusme zinciri artik kendi klibine ulasmiyor, `idle`'a
      cikiyor. Menzilde ama darbeler arasinda bekleyen birim kilic klibine
      kilitlenmez.
- [x] Olum: `Death01` oynar ve gecis geri donussuz kilitlenir (`advanceRtsAction`
      death latch). `UNIT_DEATH_SECONDS` (0.35 sn) yerine sunumun bildirdigi
      klip suresi kullanilir (`RtsPresentationHandle.deathSeconds`), boylece
      birim kendi dususu bitmeden despawn olmaz. Klipsiz birim eski sabit
      pencereyi ve kod-tabanli devrilmeyi korur; **authored olumde kod
      rotasyonu devre disi** - ikisi ust uste binerse govde yere gomuluyordu.
- [x] Karar korundu: hasarin animasyon notify penceresinde uygulanmasi bu fazin
      **disindadir**; Faz F'de ayri bir simulasyon degisikligi olarak durur.
- [x] Engine test: saldiri animasyonu hasar/cooldown sonucunu degistirmez
      (sunum kareleri sayaci, cooldown'u ve hedefin canini kimildatmaz;
      reddedilen saldiri animasyon da oynatmaz).
- [x] Engine test: olum animasyonu suresi ile despawn zamanlamasi tutarlidir
      (authored klip bitene kadar registry'de kalir, kapsul fallback'i sabit
      surede cikar).
- [x] **Sapma - Faz E'nin sema kismi buraya cekildi.** D'nin veriye dayali
      olabilmesi icin `attack`/`death` semantic rolleri simdi eklendi:
      `ANIMATION_SET_ROLES` (loader), `SKELETON_ANIMATION_SET_ROLES`
      (`tools/saveValidator.ts` allowlist) ve UAL1 sidecar
      (`Sword_Attack` / `Death01`). Engine test iki listeyi karsilastirip
      round-trip'i pinler. Aksi halde D klip adini koda gomerdi (§4 sinirlarina
      aykiri). Faz E'de artik yalnizca "kodda kalan sabit klip adi yok"
      denetimi kaldi. Editor UI rol listesini `ANIMATION_SET_ROLES`'tan
      urettigi icin iki rol Skeletal Mesh Editor'de kendiliginden goründu.

Kabul: Menzile giren muhafiz her saldirida bir kez `Sword_Attack` oynatir;
olen birim dusme animasyonunu tamamlar. **Kullanici gozlemi bekliyor.**

### Faz E - Klip isimlerini veriye tasima

- [x] `animationSet`'e `attack` ve `death` semantic rolleri eklendi (Faz D'de,
      yukaridaki sapma maddesine bakiniz).
- [x] **Allowlist:** `SKELETON_ANIMATION_SET_ROLES` guncellendi.
- [x] Loader ile validator ayni sekli tanimliyor; engine testi iki listeyi
      dogrudan karsilastiriyor.
- [ ] Kodda kalan sabit klip ismi olmasin; yalnizca semantic rol + dusme zinciri.
      (Denetlenmedi - RTS yolunda sabit klip adi kalmadi, ama TPS tarafindaki
      `locomotionAnimation.ts` hala `CLIP_FALLBACKS` isim sozlugu tasiyor.)
- [x] Engine test: sidecar'da olmayan bir rol icin dusme zinciri devreye girer
      (Faz C testi).

Kabul: Bir klip ismi degistiginde yalnizca veri dosyasi duzenlenir.

### Faz F - Kapsam ve performans

- [ ] Archer / Siege / Worker icin Actor mapping'i (`rts-content.json`) ve rol
      ayrimi karari (ayri mesh, ekipman veya material).
- [ ] Worker icin calisma animasyonu (`Fixing_Kneeling` adayi).
- [ ] Uzak birimlerin mixer'i seyrek guncellensin - kalabalik orduda asil
      kaldirac budur. Iki secenek: `RtsApp`'e engine subsystem registry'si
      tanitip `AnimationSubsystem.setDistanceUpdateSettings` kullanmak, ya da
      ayni `distanceUpdateRate` yardimcisini `rtsUnitPresentation` icinde
      yerel olarak uygulamak.
- [ ] 20 ve 40 aktif skeletal instance ile frame-butce olcumu.
- [ ] (Opsiyonel, ayri karar) Hasarin notify penceresinde uygulanmasi.

Kabul: Normal akista kapsul fallback gorunmez; 40 birimde frame butcesi korunur.

## 6. Test ve Kabul Matrisi

| Katman | Otomatik kontrol | Etkilesimli kabul |
| --- | --- | --- |
| Klon | Instans basina ayri `Skeleton`; static mesh regresyonu yok | Muhafizin gorunur olmasi |
| Handle | Mixer dispose, tick zinciri, snapshot uretimi | Duraklat/devam et |
| Secici | Hiz esikleri, rol dusme zinciri, konum degismezligi | Yurume/durma crossfade'i |
| Aksiyon | Saldiri tetigi hasari degistirmez; olum suresi tutarli | Savas ve olum gozlemi |
| Veri | Sidecar allowlist round-trip (kaydet -> yeniden yukle) | Editor'de klip degistirip save |
| Performans | 20/40 instance frame-butce testi | Kamera yakin/uzak gozlemi |

Her faz sonunda `npx tsc --noEmit`, `npm run test:engine`, gerektiginde
`npm run build:verify` ve `npm run check:assets` calisir. Animatorun kendisi
Three.js'e dokundugu icin headless test edilemez; bu yuzden durum secici
bilerek saf tutulur ve asil test yuku oraya yiklenir.

## 7. Baslangic Sirasi

Faz A ve Faz B birlikte yapilir: A olmadan hicbir sey gorunmuyor, B olmadan
hicbir sey kimildamiyor. Ikisi birlikte ilk gercek dogrulama noktasidir -
"muhafizlar sahada duruyor ve nefes aliyor". Faz C hemen ardindan gelir;
Faz D'ye ancak locomotion stabil olduktan sonra gecilir.

## Ilerleme Kaydi

| Tarih | Faz | Not |
| --- | --- | --- |
| 2026-07-25 | - | Plan olusturuldu; uygulama baslamadi. |
| 2026-07-26 | A | Klip + sidecar cache'i, `SkeletonUtils.clone` ile instans basina iskelet. Muhafizlar gorunur oldu. |
| 2026-07-26 | B | `rtsUnitPresentation` + tick zinciri; authored `Idle_Loop` oynuyor. `tsc`, `test:engine` (1109), `build:verify` gecti. |
| 2026-07-26 | B | Kemik/bilesen isim cakismasi duzeltildi (mixer modele baglanir). Kullanici dogruladi: dik ve hareketli. |
| 2026-07-26 | C | Saf secici `rtsUnitAnimation.ts`, hiza oranli oynatma (`setPlaybackRate`), `moveSpeed` sunuma tasindi. `tsc` ve `test:engine` (1112) gecti. |
| 2026-07-26 | C | Kullanici dogruladi: yurume/durma calisiyor. |
| 2026-07-26 | D | Tek atimlik saldiri/olum (`playOnce` + `advanceRtsAction`), `blowCount` tetigi, despawn artik authored olum klibini bekliyor. `attack`/`death` rolleri sema+allowlist'e eklendi. `build:verify` (1116) gecti. |
