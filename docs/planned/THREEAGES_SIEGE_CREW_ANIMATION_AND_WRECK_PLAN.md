# ThreeAges — Topçu Muhafızı Animasyon ve Top Enkazı Planı

Oluşturulma tarihi: 2026-08-13
Durum: **Faz 0-6 uygulandı; görsel kabul kullanıcıda.**

## 1. Amaç

`public/assets/ThreeAges/Characters/Siege/Siege.glb` içindeki 18 klibi Topçu
(`siege_placeholder`) biriminin muhafız ekibinde kullanmak; ekibi bugünkü
"üç klipli yolcu"dan, topun durumunu okuyan bir sunum durumu makinesine
çıkarmak; ve topun ölümünü yan yatan bir kapsül olmaktan çıkarıp parçalanan,
alev alan bir enkaza dönüştürmek.

Bu çalışmada aşağıdaki kurallar değişmez:

- Konum, hız, hedef, menzil, hasar, cooldown ve ölüm anı simülasyonun
  otoritesindedir. Animasyon yalnızca **gerçekleşmiş** durumu gösterir.
- Ekip (crew) bir simülasyon birimi değildir; seçilemez, hedeflenemez, ayrı
  canı yoktur. `rtsActorVisualFactory.createUnitCrew` bunu bugün de böyle
  kuruyor ve bu plan bu sınırı genişletmez.
- Karar mantığı saf modüllerde (Three.js'siz, `src/game/rts/units/`), Three.js
  tarafı sürücüde (`src/game/rts/content/`) kalır — `rtsUnitAnimation.ts` /
  `rtsUnitPresentation.ts` ayrımının aynısı.
- Varyasyon `Math.random()` kullanmaz; birim kimliği ve olay sayacına dayalı
  deterministik seçim kullanır (mevcut `resolveRtsAnimationVariant` sözleşmesi).
- Otomatik test ile dünya içi görsel kabul ayrı kapılardır. Görsel kabul
  kullanıcı gözlemi olmadan kapatılmaz.
- Sayısal denge (`min menzil`, `tekme hasarı`) `public/game-data/balance/`
  içine gider; testler büyüklüğü değil sözleşmeyi doğrular.

## 2. Kanıtlı Başlangıç Noktası

### 2.1 Asset

- [x] `Siege.glb` manifestte `siege` kimliğiyle kayıtlı (`assetType:
  skeletalMesh`, `loadGroup: "Siege"`, 1.85 MB, tek skin, tek mesh
  `Siege_Mesh`, 72 node).
- [x] 18 klip mevcut, süreleriyle:

  | Klip | Süre | Kullanım |
  |---|---|---|
  | `siege_idle_1` | 3.57 s | idle temel |
  | `siege_idle_2` | 2.53 s | idle varyant |
  | `siege_push_start` | 4.77 s | itme başlangıcı |
  | `siege_pushing` | 2.70 s | itme döngüsü |
  | `siege_push_stop` | 2.63 s | itme bitişi |
  | `siege_walk_backward` | 1.30 s | geri gidiş |
  | `siege_strafe_left` | 1.33 s | yerinde dönüş (sol) |
  | `siege_strafe_right` | 1.17 s | yerinde dönüş (sağ) |
  | `siege_crouch_start` | 0.60 s | ateş duruşuna geçiş |
  | `siege_crouch_block_start` | 0.50 s | topa destek olmaya geçiş |
  | `siege_crouch_block_idle` | 0.30 s | destek döngüsü |
  | `siege_crouch_block_impact` | 0.70 s | destek sırasında darbe |
  | `siege_crouch_block_end` | 0.53 s | destekten çıkış |
  | `siege_crouch_end` | 0.53 s | ayağa kalkış |
  | `siege_kick` | 1.23 s | tekme |
  | `siege_power_up` | 2.40 s | zafer |
  | `siege_death_1` | 2.33 s | ölüm temel |
  | `siege_death_2` | 3.93 s | ölüm varyant |

- [x] `Siege.skeleton.json` mevcut ve **root-motion authorlanmış**:
  `push_start`, `push_stop`, `pushing`, `walk_backward`, `strafe_left`,
  `strafe_right` → `lockXYZ` / `mixamorigHips`.
- [x] `animationSet`, `animationVariants`, `notifies`, `montages`, `sockets`
  **boş**. Bu planın Faz 0'ı bunları dolduruyor.
- [x] `Siege.materials.json` slot `0` → `m-guard-material`. Yani Siege, Guard'ın
  doku setini paylaşıyor; **yeni doku üretmeye gerek yok**, düşman varyantı için
  mevcut `m-guard-ai-material` (kırmızı BC) yeterli.

### 2.2 Mevcut kablolama

Zincir bugün şöyle işliyor:

1. `public/game-data/content/rts-content.json` → `siege_placeholder.crew`
   = `{ unitId: "guard_placeholder", slots: [[-0.72,0,-1.42],[0.72,0,-1.42]] }`
2. [rtsActorVisualFactory.ts:360](src/game/rts/content/rtsActorVisualFactory.ts#L360)
   `createUnitCrew` her slot için crew Actor'ünü klonlar, topun köküne parentlar.
3. [rtsUnitPresentation.ts:185](src/game/rts/content/rtsUnitPresentation.ts#L185)
   `RtsAttachedCrewAnimator` her üye için bir `CrossfadeAnimator` kurar.
4. Ekip meshleri topun pick target'ıdır: bir muhafıza tıklamak topu seçer.

Yani ekip **görsel olarak zaten var**, sadece Guard mesh'ini ve Guard'ın üç
klibini oynatıyor.

### 2.3 Mevcut sürücünün sınırları

`RtsAttachedCrewAnimator.update` seçiciye şunu veriyor:

```ts
{ planarSpeed, forceWalk?, attacking: false, dying: false, working: false,
  attackCount: 0, impactCount: 0 }
```

ve varyant dizisi geçmiyor, `directionalAimActive` geçmiyor. Sonuç:

- [x] Ulaşılabilir tek rol kümesi `idle / walk / run` — **temel klip, varyantsız**.
- [x] `backward` hiç geçmediği için `walkBack`/`runBack` erişilemez.
- [x] `dying` sabit `false` — top ölse de ekip ayakta idle oynar.
- [x] `attacking` sabit `false` — ateş anında ekip tepki vermez.
- [x] `impactCount` sabit `0` — darbe alınca ekip tepki vermez.
- [x] `onNotify` verilmiyor — ekip klipleri notify yayınlamaz (ayak sesi yok).
- [x] Modülün kendi yorumu bunu zaten söylüyor: *"until purpose-built push
  animations are authored, at which point this small visual driver is the only
  seam."* Bu plan o dikişi açıyor.

### 2.4 Engelleyici bulgu — `crew.unitId` bir denge kimliği olmak zorunda

[rtsContentCatalog.ts:550](src/game/rts/content/rtsContentCatalog.ts#L550):

```ts
if (typeof unitId !== "string" || !context.unitBalance[unitId]) {
  throw new RtsContentCatalogError(`${where}.unitId: must name a known unit balance id`);
}
```

Yani "ekip için ayrı bir `siege_crew` katalog birimi tanımlayıp Actor'ünü ona
bağlamak" bugün **mümkün değil**: `units.json` içine bir `siege_crew` denge
girdisi eklemek gerekirdi ve o girdi anında üretilebilir/AI'nın gördüğü bir
birim hâline gelirdi. Faz 0 bu şemayı düzeltiyor (K-02).

Kodda `spec.unitId`'nin tek kullanımı `rtsUnitActorRef(catalog, spec.unitId,
owner)`; ekip tuning'i (`moveSpeed`) zaten **ana birimden** geliyor. Yani alan
gerçekte bir Actor referansı arayışıdır, denge kimliği değil.

### 2.5 Ölüm bugün nasıl görünüyor

- [x] Siege Actor'ü statik meshlerden kurulu (`chassis`, `barrel`, 4 tekerlek);
  mixer'ı yok, dolayısıyla `presentation.deathSeconds` **undefined**.
- [x] [unit.ts:988](src/game/rts/units/unit.ts#L988) bu durumda kod tip-over'ını
  uyguluyor: `rotation.z = -π/2 * progress`. **Topun yan yatmasının sebebi tam
  olarak budur.**
- [x] Ceset penceresi `max(fallSeconds, UNIT_CORPSE_SECONDS=30 s)`.
- [x] Yapı yıkımının karşılığı hazır ve yeniden kullanılabilir:
  `applyStructureDeformation(root, tuning, seed)`
  ([structureDeformation.ts:229](src/game/rts/structures/structureDeformation.ts#L229))
  — vertex shader'da squash/splay/buckle, paylaşılan geometriyi bozmadan.
- [x] Ekipman düşürme deseni de hazır: `unitGearDebris.ts` (havuzlanmış
  `InstancedMesh`, `RTS_UNIT_GEAR` tablosu, ölüm *kaldırılırken* spawn).
- [x] Manifestte `rts-fx-fire-loop`, `rts-fx-explosion`, `rts-fx-debris-wood`,
  `rts-fx-debris-stone`, `rts-fx-collapse-dust`, `rts-fx-ruin-smoke-black` var.
- [x] Ölen birimler simülasyon kapısının **dışında** sunum güncellemesi almaya
  devam ediyor ([RtsApp.ts:2533](src/game/rts/RtsApp.ts#L2533)), maç bitse bile.

### 2.6 Menzil bugün nasıl

- [x] `siege_placeholder`: `attackRange: 20`, `acquisitionRange: 20`,
  `chaseRange: 20`, `attackCooldown: 5.5`, `turnRateDegPerSecond: 70`,
  `moveSpeed: 3.8`, `maxHealth: 180`.
- [x] Kod tabanında **hiçbir yerde minimum menzil kavramı yok**
  (`minRange|minimumRange|minAttackRange` → 0 eşleşme). `unitCombat.ts`
  yalnızca `distance > unit.attack.range` üst sınırını kontrol ediyor. Yani
  dibindeki düşmana ateş etmesi bir hata değil, hiç yazılmamış bir kural.
- [x] Ekibin ikincil (yakın dövüş) silahı yok. En yakın emsal, Guard'ın binalara
  attığı meşale: `firebrandSystem.ts` — ama o **yalnızca sunum**; hasarı zaten
  `unitCombat` uygulamış oluyor. Tekme gerçek hasar vereceği için o desen
  yetmez; ikinci bir hasar yolu gerekir.

### 2.7 Geri gidiş bugün nasıl

- [x] `T` + sağ tık `armRetreat()` → `issueRetreatAt()`.
- [x] [commandSystem.ts:44](src/game/rts/commands/commandSystem.ts#L44):
  `canPlayerRetreat = (role === "guard" || role === "archer") && !dying`.
  **Topçu bilinçli olarak dışarıda** ("workers and siege keep their orders").
  Beklenti 8 bu kararın geri alınmasını istiyor.
- [x] `Unit.retreating` alanı ve `backward` snapshot alanı zaten var; hareket
  sistemi geri giderken gövde yönünü koruyor.

### 2.8 Dönüş yönü bugün nasıl

- [x] Topun ayrı bir taret ekseni yok: `faceHeading` tüm gövdeyi
  `turnRateDegPerSecond = 70` ile döndürüyor. Namlu gövdeyle döner.
- [x] **İşaretli yaw hızı hiçbir yerde ölçülmüyor.** `measureLocalPlanarVelocity`
  yalnızca öteleme ölçüyor. Beklenti 7 için bunun ikizi gerekiyor.

## 3. Sabit Kararlar

### K-01 — Ekip ayrı bir asset ve ayrı Actor çifti olur

`siege` mesh'i Guard'dan ayrı bir asset olarak kalır. İki yeni Actor:
`BP_RTS_SiegeCrew.actor.json` (`materialSlot` yok → `m-guard-material`) ve
`BP_RTS_Enemy_SiegeCrew.actor.json` (`materialSlot: "m-guard-ai-material"`).
Bu, `BP_RTS_Guard` / `BP_RTS_Enemy_Guard` çiftinin birebir aynısıdır; yeni doku
üretilmez.

### K-02 — `crew` şeması denge kimliğinden Actor referansına taşınır

`RtsUnitContentEntry["crew"]` şu hâle gelir:

```jsonc
"crew": {
  "actorRef": "assets/ThreeAges/Actors/Units/BP_RTS_SiegeCrew.actor.json",
  "ownerActorRefs": { "enemy": "assets/ThreeAges/Actors/Units/BP_RTS_Enemy_SiegeCrew.actor.json" },
  "slots": [ { "position": [-0.72, 0, -1.42] }, { "position": [0.72, 0, -1.42] } ]
}
```

Gerekçe: ekip sunumdur, oynanabilir bir kimlik değil. `unitId` alanı ekibi bir
denge girdisine zincirliyor (§2.4) ve o zincirin tek işlevi bir Actor yolu
bulmaktı. `unitId` desteği **kaldırılır**, taşınmaz — tek tüketicisi Topçu'dur
ve o da bu planla değişiyor.

Dokunulacak yerler: `rtsContentCatalog.ts` (`validateCrew`, `requireExactKeys`,
`rtsContentCatalogRefs` preflight yükleme kümesi), `rtsActorVisualFactory.ts`
(`createUnitCrew`), `rts-content.json`, ve `tools/engine-tests.ts`'teki
`crewedPilot` bloğu (`~36388–36408`) — "bir birim kendini crew yapamaz" testi
"bir crew kendi host Actor'ünü gösteremez" hâline gelir.

### K-03 — Ekip sürücüsü kendi saf durum makinesine sahiptir

Yeni dosya: `src/game/rts/units/siegeCrewAnimation.ts`. `rtsUnitAnimation.ts`'in
genel rol sözlüğü (`idle/walk/run/attack/hit/death/...`) **genişletilmez**:
"topa destek ol", "tekme at", "zafer" genel bir RTS birimi kavramı değil, bu
birimin kavramıdır ve genel sözlüğe eklemek her asset'e ölü rol taşır.

Modül saf kalır (Three.js yok, DOM yok), böylece `test:engine` durum geçişlerini
renderer olmadan doğrular — `rtsUnitAnimation.ts` ile aynı sözleşme.

### K-04 — Ekip durumu topun durumundan türetilir, ayrı simülasyon tutmaz

Durum makinesinin girdisi, `RtsPresentationUpdate`'in ekip için genişletilmiş
hâlidir. Ekip hiçbir şey karar vermez; top ne yapıyorsa onu gösterir.

### K-05 — İki üye aynı fazda, küçük bir gecikmeyle ilerler

Beklenti 4'teki "sırayla" klip **sırası** olarak uygulanır (crouch → block →
idle → …). Buna ek olarak her slot, indeksinden türeyen sabit bir ofsetle
(slot 0: 0 s, slot 1: 0.12 s) faza girer; iki adamın milimetrik senkron
hareketi robotik görünür. Ofset deterministiktir, rastgele değil.

### K-06 — Dönüş yönü eşlemesi tersine kurulur ve görsel kabule tabidir

Beklenti 7 gereği: top **sağa** dönerken `siege_strafe_left`, **sola** dönerken
`siege_strafe_right`. Gerekçe fiziksel: ekip kundağı sola iterek namluyu sağa
çevirir. Bu, koddan bakınca ters göründüğü için hem yorum satırıyla hem de bir
motor testiyle sabitlenir; doğru okunup okunmadığı **kullanıcı gözlemiyle**
kapanır ve gerekirse tek satırda takas edilir.

### K-07 — Minimum menzil bir denge alanıdır, kod sabiti değil

`UnitBalanceStats.minAttackRange?: number` eklenir; yokluğu bugünkü davranıştır
(sıfır minimum). `validateGameData.ts` `0 <= minAttackRange < attackRange`
şartını dosya ve alan adıyla reddeder. Testler büyüklüğü değil ilişkiyi
doğrular: *minimum menzil, atış menzilinden küçüktür* ve *bir Topçu kendi
minimumunun içindeki hedefe ateş etmez*.

### K-08 — Tekme gerçek hasardır ve ikinci bir hasar yolu açar

Tekme sunum değildir (§2.6). `AttackComponent`'e dokunmadan, ayrı bir
`siegeMeleeSystem.ts` (`src/game/rts/combat/`) top için ikinci bir cooldown ve
hasar çözümü taşır; hasar mevcut `resolveDamage` üzerinden geçer, böylece zırh
sınıfı çarpanları ve `holdDamageResistance` tek yerde kalır.

### K-09 — Enkaz, yapı yıkımının parçalarını yeniden kullanır

Top enkazı yeni bir fizik sistemi değildir: `applyStructureDeformation` +
mevcut `rts-fx-*` efektleri + `rtsPresentationMotion` tekerlek pivotları
üzerinde elle sürülen bir zaman çizgisi. Ragdoll yok, gerçek çarpışma yok —
`unitDeath.ts`'in "No ragdoll: the fall is an authored clip or a code tip-over,
never simulated" kuralı korunur.

### K-10 — `push_start` kırpılır, hızlandırılmaz

`siege_push_start` 4.77 s. Ham hâliyle, hareket emri alan bir top neredeyse beş
saniye boyunca "başlıyor" hâlinde kalır ve döngüye hiç ulaşamadan durabilir.

Klibin kalça açısal hızı 0.5 s'lik kovalarda ölçüldü (gövde hareketinin vekili
olarak):

```
0.0s:136  0.5s:97  1.0s:97  1.5s:17  2.0s:16  2.5s:24  3.0s:21  3.5s:22  4.0s:15  4.5s:36   (derece/s)
siege_pushing döngüsü: 17–26 derece/s
```

Yani klip yavaş değil, **fazladan uzun**: ilk ~1.5 s gerçek kalkış, kalan ~3.3 s
`siege_pushing`'in zaten tekrarladığı itme çevrimi. Bu yüzden:

- Sidecar'a bir `montage` (`push`, `enter`/`loop`/`exit`) authorlanır ve `enter`
  klibin ilk **~1.5 s**'si olur. Bölüm süreleri asset bilgisidir, kodda sabit
  değildir — `resolveRtsWorkMontage`'in aynı gerekçesi. GLB'ye dokunulmaz;
  pencere tek sayıyla geri alınabilir.
- Playback rate ile 2–3x hızlandırma **seçilmedi**: hâlihazırda 136 derece/s ile
  başlayan kalkışı karikatürleştirir ve arkasındaki itme turlarını ileri sarar.
  Sürücüde bölüm başına hız kancası mevcut
  ([rtsUnitPresentation.ts:615](src/game/rts/content/rtsUnitPresentation.ts#L615)),
  yani gerekirse ince ayar olarak (≤1.3x) hâlâ elde.

## 4. Fazlar

Durum göstergesi: `[ ]` açık · `[~]` sürüyor · `[x]` tamam.

### Faz 0 — Asset ve katalog bağlantısı

Hedef: Topçu ekibi Guard mesh'i yerine Siege mesh'ini giyer, hiçbir davranış
değişmez.

- [x] `BP_RTS_SiegeCrew.actor.json` ve `BP_RTS_Enemy_SiegeCrew.actor.json`
      yazılır (K-01), manifeste kaydedilir.
- [x] `crew` şeması `actorRef` + `ownerActorRefs`'e taşınır (K-02);
      `validateCrew`, `requireExactKeys`, `rtsContentCatalogRefs` ve
      `createUnitCrew` güncellenir.
- [x] `rts-content.json` yeni şemayla yeniden yazılır.
- [x] `Siege.skeleton.json` `animationSet`'i Faz 1 rolleriyle doldurulur
      (aşağıdaki tablo), `animationVariants.idle = ["siege_idle_2"]`.
- [x] `tools/engine-tests.ts` `crewedPilot` bloğu yeni şemaya göre yazılır;
      "crew Actor'leri preflight yükleme kümesine katılır" iddiası korunur.
- [ ] Görsel kabul: iki muhafız topun arkasında Siege mesh'iyle duruyor, mavi
      ve kırmızı takım renkleri doğru, kılıç/kalkan yok.

### Faz 1 — Locomotion durum makinesi

Karşılanan beklentiler: **1** (idle varyantı), **7** (strafe), **8** (geri gidiş).

- [x] `siegeCrewAnimation.ts` yazılır. Sürekli kanal durumları:
      `idle → pushEnter → pushLoop → pushExit`, `backward`, `strafeLeft`,
      `strafeRight`.
- [x] Öncelik sırası: `dying` > `bracing` (Faz 2) > `oneShot` (Faz 3/5) >
      `backward` > `push*` > `strafe*` > `idle`.
- [x] Strafe koşulu: `planarSpeed <= walkSpeed` (yerinde dönüş) **ve**
      `|yawRate| > turnRate * 0.25`. İlerlerken dönmek strafe değildir; itme
      kazanır.
- [x] `Unit`'e `measureYawRate` eklenir — `measureLocalPlanarVelocity`'nin
      ikizi, sunum-yerel bellek (`lastPresentationYaw`), simülasyon durumu
      yazmaz. Snapshot'a `yawRateDegPerSecond` (işaretli) alanı eklenir.
- [x] `RtsAttachedCrewAnimator` yeni makineyi sürer; `backward`, `attacking`,
      `dying`, `impactCount`, `attackCount` artık ana birimden **geçirilir**.
- [x] Idle varyantı: `resolveRtsAnimationVariant` ile, tohum = slot indeksi +
      birim id. İki muhafız aynı anda aynı idle'ı oynamaz; tekrar oynanışta
      aynı sonucu verir.
- [x] `canPlayerRetreat` Topçu'yu içine alır (§2.7); `commandSystem.ts:243`
      yorumu düzeltilir.
- [x] `push` montajı sidecar'a authorlanır (K-10).
- [x] Notify: `footstep` işaretleri `siege_pushing` ve `siege_walk_backward`
      üzerine authorlanır; `onNotify` ekip üyelerine de geçirilir.
- [x] Motor testleri: geri emir → `backward` klibi; yerinde sağa dönüş →
      `strafe_left`; ilerlerken dönüş → `push` klibi; iki üyenin idle varyantı
      deterministik ve farklı.
- [ ] Görsel kabul: top ilerlerken ekip itiyor, durunca yumuşak geçişle
      ayağa kalkıyor; `T` + sağ tık ile top geri giderken ekip geri yürüyor;
      yerinde dönerken yan adım atıyor ve **yön doğru okunuyor** (K-06).

### Faz 2 — Ateş duruşu

Karşılanan beklenti: **4**.

- [x] Duruş fazları: `standing → crouchIn → braceIn → braced → braceOut →
      crouchOut → standing`. Süreler kliplerden okunur (`durationOfRole`
      deseni), kodda sabit yazılmaz.
- [x] Tetik: topun ateş etme niyeti. `attacking` (menzilde canlı hedef) bunun
      doğru sinyalidir — `unitCombat` zaten "menzildeyim ve hedefime dönüyorum"
      anlamına geliyor. Cooldown'un kendisi tetik değildir: 5.5 s'lik cooldown
      içinde ekip `braced` kalır, her atışta ayağa kalkıp çökmez.
- [x] `braced` sırasında `impactCount` artışı → `siege_crouch_block_impact`
      tek atımlık, `braced`'ın üzerine biner ve bitince `braced`'a döner.
- [x] Çıkış: hareket emri veya hedef kaybı → `braceOut` → `crouchOut`. Ölüm
      duruşu kesintiye uğratır, sarmalamaz (montaj kuralının aynısı).
- [x] Slot ofseti uygulanır (K-05).
- [x] Motor testleri: faz sırası; darbe yalnızca `braced` içinde tetiklenir;
      hareket emri `braceOut`'tan başlar, `crouchIn`'e geri dönmez; ölüm her
      fazı anında keser.
- [ ] Görsel kabul: ateş emri → ekip çöküyor, topa yaslanıyor, atışlar arasında
      o pozisyonda kalıyor; top darbe alınca sarsılıyor; hareket emri →
      kalkıyor ve itmeye geçiyor.

### Faz 3 — Minimum menzil ve tekme

Karşılanan beklenti: **5**.

- [x] `minAttackRange` alanı eklenir (K-07): tip, doğrulama, editör kataloğu
      alanı, `AttackComponent.minRange` getter'ı.
- [x] `unitCombat.ts` ateşi minimumun altında bırakır. **Kritik ayrıntı:** hedef
      düşmez, atış düşer — aksi hâlde top hedefini bırakıp yeniden edinir,
      titrer. `engagementSystem` tarafında da hedef bırakılmaz.
- [x] `siegeMeleeSystem.ts` (K-08): top ayakta (`braced` **değil**) ve düşman
      `kickRange` içindeyse, kendi cooldown'uyla tekme hasarı uygular.
- [x] Denge alanları `units.json`'a: `minAttackRange`, `kickDamage`,
      `kickRange`, `kickCooldown`. Başlangıç değerleri kullanıcı ayarına
      açıktır; testler yalnızca ilişkiyi sabitler.
- [x] Ekip tarafı: tekme bir tek atımdır, `kickCount` sayacıyla retetiklenir —
      `attackCount`'un swing'i retetiklemesiyle aynı desen.
- [x] Notify: `siege_kick` üzerine `body-impact` işareti; mevcut
      `RTS_NOTIFY_EFFECTS` girdisi zaten var, yeni efekt gerekmez.
- [x] Motor testleri: minimumun içindeki hedefe atış yok ama hedef korunuyor;
      minimum ile menzil arasında atış var; tekme yalnızca ayaktayken ve
      yalnızca `kickRange` içinde; tekme hasarı zırh çarpanlarından geçiyor.
- [ ] Görsel kabul: dibe sokulan bir Guard top tarafından vurulmuyor,
      tekmeleniyor ve canı azalıyor.

### Faz 4 — Ölüm ve top enkazı

Karşılanan beklentiler: **2** (ekip ölümü), **3** (enkaz).

- [x] `animationSet.death = "siege_death_1"`,
      `animationVariants.death = ["siege_death_2"]`; ekip sürücüsü `dying`
      geçişinde tek atımlık ölüm klibini oynatır, tohum slot indeksinden gelir
      (iki adam farklı ölür).
- [x] `siegeWreck.ts` (`src/game/rts/units/`) — zaman çizgisiyle sürülen enkaz:
      1. `t=0`: `rts-fx-explosion` bir kez; barrel pivotu serbest bırakılır ve
         yere düşer (yerçekimli basit bir eğri, çarpışma yok).
      2. `t≈0.15 s`: dört tekerlek pivotu kundaktan koparılır, her biri sabit
         bir yöne yuvarlanır ve sürtünmeyle durur; yuvarlanma mevcut
         `wheelSpin` bağlamalarının aynı ekseninden sürülür.
      3. `t=0 → tBreak`: `applyStructureDeformation` ile kundak çöker
         (kendi `StructureDeformationTuning` değerleriyle, bina değerleriyle
         değil).
      4. `t≈0.3 s`den itibaren: `rts-fx-fire-loop` enkaz merkezinde periyodik,
         `rts-fx-ruin-smoke-black` daha seyrek. Efektler mevcut notify
         kanalından istenir; sunum efekt oynatmaz, isteyip geçer.
- [x] `deathSeconds` = `max(en uzun ekip ölüm klibi, tBreak)` olarak raporlanır.
      Bu tek satır **kod tip-over'ını kapatır** (§2.5) — topun yan yatması
      böyle sonlanır.
- [x] Ceset penceresi (30 s) enkazı yerinde tutar; kaldırılırken opsiyonel
      olarak `unitGearDebris` desenine bir `cannonWheel` parçası bırakılabilir
      (kapsam dışı, backlog).
- [x] Motor testleri: `deathSeconds` tanımlı olduğunda `updateDeath` gövdeyi
      döndürmüyor; enkaz zaman çizgisi hızlandırılmış maçta da tamamlanıyor;
      enkaz `dispose` sonrası materyal/geometri sızdırmıyor.
- [ ] Görsel kabul: top ölünce yan yatmıyor; namlu düşüyor, tekerlekler
      ayrılıp yuvarlanıyor, gövde çöküyor ve alev alıyor; iki muhafız iki farklı
      ölüm animasyonu oynuyor.

### Faz 5 — Zafer

Karşılanan beklenti: **6**.

- [x] Tetik: bu topun **atışının** bir düşman merkezini yıktığı an. Sinyal
      `unitCombat`/`pendingImpacts` tarafında zaten var (atışın sahibi ve hedefi
      biliniyor); yeni bir `triumphCount` sayacı ana birime yazılır ve snapshot
      ile ekibe geçer.
- [x] Tek atımlık `siege_power_up` (2.40 s), her fazı keser, `braced` dâhil.
- [x] **Uyarı ve öneri:** merkez düşünce `RtsMatchState` maçı bitirir ve
      simülasyon durur. Sunum güncellemeleri durmaz ([RtsApp.ts:2533](src/game/rts/RtsApp.ts#L2533)),
      yani animasyon zafer ekranının **altında** oynar ve büyük olasılıkla
      görülmez. Bu yüzden tetiğin **yıkılan her düşman yapısını** kapsaması
      önerilir; merkez o kümenin zaten bir üyesidir ve animasyon maç sürerken de
      görünür olur. Karar kullanıcıya aittir (§6, S-1).
- [x] Motor testi: yalnızca öldürücü vuruşu yapan top sayacı artırır, aynı
      hedefe ateş eden diğerleri artırmaz.
- [ ] Görsel kabul: yapı yıkıldığında o topun ekibi zafer hareketi yapıyor.

### Faz 6 — Cila ve kapanış

- [x] Geçiş süreleri tek yerde toplanır ve ayarlanır (locomotion 0.18 s,
      tek atım 0.06 s, duruş geçişleri daha uzun — `REST_FADE_SECONDS`
      gerekçesinin aynısı).
- [x] `docs/architecture/UNREAL_BASICS_LESSONS.md` Progress Log güncellenir.
- [x] `npm run build:verify` yeşil.

## 5. Klip → Rol Eşlemesi (Faz sonu hedef)

| Klip | Bağlanma yeri | Faz |
|---|---|---|
| `siege_idle_1` | `animationSet.idle` | 0 |
| `siege_idle_2` | `animationVariants.idle[0]` | 0 |
| `siege_push_start` | `montages.push` → `enter` | 1 |
| `siege_pushing` | `montages.push` → `loop` (+ `animationSet.walk`/`run` yedeği) | 1 |
| `siege_push_stop` | `montages.push` → `exit` | 1 |
| `siege_walk_backward` | `animationSet.walkBack` | 1 |
| `siege_strafe_left` | ekip rolü `strafeLeft` (top sağa dönerken) | 1 |
| `siege_strafe_right` | ekip rolü `strafeRight` (top sola dönerken) | 1 |
| `siege_crouch_start` | duruş fazı `crouchIn` | 2 |
| `siege_crouch_block_start` | duruş fazı `braceIn` | 2 |
| `siege_crouch_block_idle` | duruş fazı `braced` (döngü) | 2 |
| `siege_crouch_block_impact` | `braced` üzerine tek atım | 2 |
| `siege_crouch_block_end` | duruş fazı `braceOut` | 2 |
| `siege_crouch_end` | duruş fazı `crouchOut` | 2 |
| `siege_kick` | tek atım, `kickCount` | 3 |
| `siege_death_1` | `animationSet.death` | 4 |
| `siege_death_2` | `animationVariants.death[0]` | 4 |
| `siege_power_up` | tek atım, `triumphCount` | 5 |

18 klibin 18'i bağlanır; ölü klip kalmaz.

## 6. Açık Sorular

- **S-1 — kapandı (2026-08-13, kullanıcı):** **Yıkılan her düşman yapısı.**
  Merkez zaten bu kümenin üyesi; yalnızca merkez seçilseydi maç bitiş ekranının
  altında kalıp pratikte hiç görülmeyecekti. Uygulama `RtsApp.creditStructureKill`:
  ayırıcı, savaş sözleşmesinin zaten kullandığı `buildingStats` alanı — yapıda
  var, insanda yok — yani yeni bir tip testi eklenmedi ve merkez bedavaya geldi.
- **S-2 — kapandı (2026-08-13, kullanıcı):** Plandaki başlangıç değerleriyle
  başlandı: `minAttackRange 4`, `kickRange 1.6`, `kickDamage 12`,
  `kickCooldown 2.0`. `units.json`'da, koda dokunmadan ayarlanabilir; testler
  yalnızca ilişkiyi sabitliyor (`minAttackRange < attackRange`,
  `kickRange <= minAttackRange`, `kickDamage < attackDamage`).
- **S-3:** Top minimum menzilin içinde bir düşman varken **geri çekilmeli mi**?
  Bu bir yapay zekâ/komut kararıdır, animasyon kararı değil; plan bunu kapsam
  dışı bırakıyor ve topu yerinde tutup tekme attırıyor.
- **S-4:** Ekip üyeleri Topçu'nun canını paylaşmaya devam ediyor (ayrı canları
  yok). "Bir muhafız ölür, top çalışmaya devam eder" istenirse bu ayrı bir
  plandır — ekip o noktada sunum olmaktan çıkar.

## 7. Doğrulama

- Her faz sonunda: `npx tsc --noEmit` + `npm run test:engine -- --filter siege`.
- Faz 3 gameplay değiştirdiği için ek olarak `--filter "Faz 8"` (AI) çalışır —
  minimum menzil, AI'nın Topçu'yu konumlandırmasını etkileyebilir.
- Faz 6'da `npm run build:verify`.
- Görsel kabul kapıları her fazın son maddesindedir ve kullanıcı gözlemiyle
  kapanır; bunun için Playwright/screenshot altyapısı kurulmaz.

## 8. İlerleme Kaydı

| Tarih | Faz | Not |
|---|---|---|
| 2026-08-13 | — | Plan yazıldı; hiçbir faz uygulanmadı. |
| 2026-08-13 | 0 | `BP_RTS_SiegeCrew` + `BP_RTS_Enemy_SiegeCrew` yazıldı ve manifeste kaydedildi. `crew` şeması `unitId` → `actorRef` + `ownerActorRefs` (K-02); `unitId` desteği kaldırıldı, taşınmadı. `crewedPilot` testi "bir crew kendi host Actor'ünü gösteremez" hâline geldi (owner override yolu dâhil). |
| 2026-08-13 | 1 | `siegeCrewAnimation.ts` (saf, üç kanal). `Unit.measureYawRate` + snapshot alanları `yawRateDegPerSecond` / `turnRateDegPerSecond`. `RtsAttachedCrewAnimator` yeniden yazıldı: `backward`/`attacking`/`dying`/`impactCount` artık geçiyor, notify'lar ekibe de gidiyor. `canPlayerRetreat` Topçu'yu içine aldı. **K-10 uyarlaması:** montage şeması tek klip taşıdığı için `push` montajı yalnızca `enter` penceresini (`siege_push_start` 0–1.5 s) tutuyor; `loop` sidecar `walk` rolü (`siege_pushing`), `exit` ekip klibi (`siege_push_stop`). Ayak sesi işaretleri GLB'den FK ile ölçüldü, tahmin değil. |
| 2026-08-13 | 2 | Duruş fazları klip sürelerinden okunuyor; darbe yalnızca `braced` içinde tetikleniyor (ayaktaki ekip çömelme klibini ödünç almıyor); hareket emri `braceOut`'tan çıkıyor, `crouchIn`'e dönmüyor; ölüm her fazı anında kesiyor. |
| 2026-08-13 | 3 | `minAttackRange` (K-07) + `siegeMeleeSystem.ts` (K-08). `isTradingBlows` artık **atış bandını** okuyor — ateş edemeyen top ekibini boşuna çöktürmüyor, ki tekmenin "ayakta olma" şartı ancak böyle erişilebilir hâle geliyor. `--filter "Faz 8"` yeşil: minimum menzil AI konumlandırmasını bozmadı. |
| 2026-08-13 | 4 | `siegeWreck.ts` saf zaman çizgisi + `applyStructureDeformation` yeniden kullanımı. Enkaz, sunumun *sanatından* tanınıyor (namlu geri tepmesi **ve** tekerlek dönüşü authorlanmış bir Actor tekerlekli toptur) — birimin rolünden değil, çünkü rol bir oynanış gerçeği. Kundak materyalleri ilk ölüm karesinde klonlanıyor (paylaşılan GLTF materyalini yamalamak sahadaki her topu çökertirdi). Raporlanan `deathSeconds` **kod tip-over'ını kapattı**. |
| 2026-08-13 | 5 | `Unit.noteStructureDestroyed` + `RtsApp.creditStructureKill`; `siege_power_up` her fazı kesiyor, ölüm hariç. |
| 2026-08-13 | 6 | Ekip geçiş süreleri `siegeCrewFadeSeconds`'ta toplandı (duruş 0.30 s — `REST_FADE_SECONDS`'ın gerekçesi, ama ondan kısa: top ekibi yorgun değil işini yapıyor). **Mevcut bir motor testi kırıldı ve haklı olarak düzeltildi:** notify efektlerinin ≤0.5 s olma kuralı "adım sesi temposu" varsayımıydı; enkazın alev/duman istekleri kendi zaman çizgisiyle tempolanıyor, dolayısıyla kural tüketiciye göre ayrıldı ve enkaz tarafı `SIEGE_WRECK_TIMING.burnSeconds`'tan türetildi. `build:verify` yeşil. |
