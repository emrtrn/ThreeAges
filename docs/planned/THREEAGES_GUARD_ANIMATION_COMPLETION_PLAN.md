# ThreeAges — Muhafız Animasyon Tamamlama Planı

Oluşturulma tarihi: 2026-08-11  
Durum: **Devam ediyor — Faz 1, 2, 2b kabul edildi; Faz 3 (ikinci death varyantı)
kodu/verisi/otomasyonu tamam, görsel kabulü açık. Faz 5a Guard geri çekilmesi
uygulandı, görsel kabulü açık; kalan Faz 4/5b/6 hâlâ tasarım kapısında.**

## 1. Amaç

`Guard.glb` içindeki zengin animasyon setini RTS muhafızlarında güvenli biçimde
kullanmak; birlik içinde görsel çeşitlilik sağlarken aşağıdaki oyun kurallarını
değiştirmemek:

- Hasar, saldırı menzili, cooldown, hedef seçimi ve hareket hızı simülasyonun
  otoritesinde kalır.
- Animasyon hiçbir birimi world konumundan sürüklemez.
- Birim kimliği ve olay sayısı aynıysa klip seçimi tekrar oynatma/sahne yenileme
  sonrasında da aynı kalır.
- Uzak birimlerdeki düşük güncelleme ritmi klip süresini ya da bir sonraki
  saldırının zamanını değiştirmez.

Bu plan yalnızca Guard sunumunu genişletir. İşçi/okçu/topçu davranışı, ekonomi,
combat dengesi ve `Guard.glb` kaynak geometrisi kapsam dışıdır.

## 2. Mevcut Durum — Kanıtlı Başlangıç Noktası

### 2.1 Asset ve materyal

- Kaynak: `public/assets/ThreeAges/Characters/Guard.glb`.
- GLB, tek materyalli dört skinned primitive ve 50 klip içerir.
- Gömülü 2048² dokular yerine `M_Guard.material.json` kullanılır;
  `Guard.materials.json` slot `0` → `m-guard-material` eşlemesini taşır.
- `Guard_BC.png`, `Guard_N.png` ve `Guard_R.png` dosyalarının her biri 512×512'dir.
- Skeletal Mesh Editor artık materyal-slot seçimi, canlı önizleme ve
  `*.materials.json` kaydını destekler.

### 2.2 Çalışan animasyon sözleşmesi

`Guard.skeleton.json` içindeki birincil roller:

| RTS rolü | Birincil klip | Ek klipler | Durum |
| --- | --- | --- | --- |
| `idle` | `guard_sword_and_shield_idle_1` | `idle_2`, `idle_3`, `idle_4` | Tamam |
| `walk` | `guard_sword_and_shield_walk_1` | — | Tamam, ileri hareket |
| `run` | `guard_sword_and_shield_run_1` | — | Tamam, ileri hareket |
| `walkBack` | `guard_sword_and_shield_walk_2` | — | Faz 5a, geri çekilme |
| `runBack` | `guard_sword_and_shield_run_2` | — | Faz 5a, geri çekilme |
| `work` | `guard_sword_and_shield_idle_1` | — | Mevcut davranış korunur |
| `attack` | `guard_sword_and_sheld_attack_2` | `attack_4`, `slash_5`, `kick` | Tamam |
| `hit` | `guard_sword_and_shield_impact_1` | `impact_2`, `impact_3` | Tamam (hareket hâlinde üst gövde), görsel kabul açık |
| `death` | `guard_sword_and_shield_death_1` | — | Tamam |

`animationVariants` seçimi rastgele sayı üretmez. `unit.id` tabanlı seed; idle
için birim başına, attack için de `attackCount` başına kararlı klip seçer. Geri
locomotion bir varyant değildir: `walk_2` ve `run_2` yalnızca gerçek geri
çekilme emrinin semantic rolleridir.

Walk/run ve saldırı varyantlarının root-motion yolları `lockXYZ` ile RTS
simülasyonundan ayrılmıştır. Mevcut testler saldırı/death süresinin hasar veya
despawn zamanlamasını değiştirmediğini de korur.

### 2.3 Önceden doğrulanmış kapılar

- 2026-08-11: idle + attack varyasyonları dünya içinde görsel olarak kabul edildi.
- 2026-08-11: 512 texture'lı `M_Guard` slot materyali browser smoke ile açıldı,
  gömülü materyal ↔ asset materyali canlı önizlemede geçildi.
- 2026-08-11: walk/run ikinci döngüleri sidecar'a eklendi.
- `npx tsc --noEmit` geçti.
- `npm run test:engine -- --filter "Skeletal animasyon"` ile 15 hedefli kontrol
  geçti. Bu filtreli sonuç tam yeşil build değildir.

## 3. Sabit Kararlar ve Sınırlar

### K-01 — Sidecar otoritedir

Klip rolü, varyasyon, root-motion, socket ve notify verileri yalnızca
`Guard.skeleton.json` üzerinden yazılır. `Guard.glb` yeniden yazılmaz.

Yeni rol eklenirse aynı değişiklikte şu üç yüzey birlikte güncellenir:

1. `src/scene/assetSkeletonLoader.ts` → `ANIMATION_SET_ROLES` ve normalizasyon,
2. `tools/saveValidator.ts` → `SKELETON_ANIMATION_SET_ROLES` allowlist'i,
3. RTS sunum/engine testleri → rolün olay veya sürekli-durum sözleşmesi.

### K-02 — Görüntü simülasyonu değiştiremez

Bir vuruşun hasarı `AttackComponent`/combat sistemi tarafından belirlenir.
Animation tarafı yalnızca zaten gerçekleşmiş `attackCount`, ölüm veya ileride
eklenecek gerçek bir `impactCount` olayını okuyabilir. Animasyon süresine göre
damage geciktirmek, cooldown bekletmek veya hedef değiştirmek yasaktır.

### K-03 — Root motion in-place kalır

RTS'te konum `unitMovement` tarafından otoriterdir. Yeni sürekli hareket,
attack, impact, block veya death klibi kullanılmadan önce Skeleton Editor'da
root node ve displacement kontrol edilir; yatay konum taşıyan klipler doğru
root node ile `lockXYZ` olur. Kaynak GLB değiştirilmez.

### K-04 — Her klip otomatik olarak kullanılmaz

`attack_1` ve `attack_3` gibi uzun klipler cooldown ile uyum ölçülmeden mevcut
attack havuzuna girmez. `casting`, `crouch`, `sheath` ve `power_up` klipleri
oyunda gerçek bir state/event olmadan sadece isim benzerliğiyle atanmaz.

### K-05 — Görsel kabul otomatik testten ayrıdır

Engine testleri sözleşme ve regresyon kanıtıdır. Aşağıdaki dünya içi kabuller
kullanıcı gözlemi olmadan kapatılmaz:

- Aynı anda 10 muhafızın yürüme/koşma ritmi ve ayak kayması.
- Darbe, blok, ölüm ve yeniden locomotion geçişlerinin okunurluğu.
- Farklı uzaklıklarda mixer seyrek güncellemesinin görünür sıçrama üretmemesi.

## 4. Kalan Fazlar

### Faz 1 — Walk/Run görsel kabulü

**Durum:** ✅ Tamam — görsel kabul 2026-08-11'de alındı.

**Amaç:** İleri `walk_1` ve `run_1` döngülerinin birlik hareketinde doğal
göründüğünü doğrulamak.

**Manuel kabul senaryosu:**

1. En az 10 muhafız seçilir.
2. Açık arazide kısa hedefe ve uzak hedefe hareket emri verilir.
3. Birlik, dar geçit ve serbest arazide gözlenir.
4. Aynı muhafızın hareket emri yenilendiğinde döngüsü sabit kalır; farklı
   muhafızlarda en az iki ritim görünür.

**Kabul:** Ayak kayması, world-position sürüklenmesi, her karede klip reset'i
veya sıfır hızda koşu yoktur. Başarılıysa plan günlüğüne tarihli kabul yazılır.

### Faz 2 — Alınan darbe (`impact`) tepkisi

**Durum:** Kod ve otomasyon tamam (2026-08-11), kullanıcı görsel kabulü açık.

**Kullanılan klipler:** `guard_sword_and_shield_impact_1` (0.73 s, birincil),
`impact_2` (1.00 s), `impact_3` (0.73 s).

**Yapılanlar:**

1. `hit` tek-atımlık semantic rolü üç yüzeye birlikte eklendi (K-01):
   `ANIMATION_SET_ROLES` (`src/scene/assetSkeletonLoader.ts`),
   `SKELETON_ANIMATION_SET_ROLES` (`tools/saveValidator.ts`) ve seçici/testler.
   Skeletal Mesh Editor rol satırını otomatik gösterir; UI değişikliği gerekmedi.
2. **Sayaç merkezî olarak `HealthComponent.impactCount`'ta tutulur.** Bunun
   nedeni kapsama: hasar bugün beş ayrı yerden uygulanıyor (`unitCombat`,
   `PendingImpactQueue`, `structureDefenseSystem`, `predatorSystem`,
   `wildlifeRetaliation`) ve sayacı bunlardan birine koymak, altıncısının
   unutulmasına açık kapı bırakırdı. Can puanının gerçekten değiştiği yerde
   sayılınca hiçbir kaynak atlanamaz. `applied > 0` koşulu heal'i, 0 hasarı ve
   ölmüş bedene inen fazla vuruşu dışarıda bırakır.
3. `RtsPresentationUpdate.impactCount` birimlerde `health.impactCount`'tan
   beslenir; hayvan ve kervan görünümleri de aynı gerçek sayacı taşır (bugün
   `hit` klibi authorlamadıkları için hiçbir şey oynamaz).
4. Öncelik `advanceRtsAction` içinde açıkça sıralı:
   `death > yeni impact > yeni attack > work montajı > locomotion`. Darbe hem
   koşan saldırıyı keser hem de kendisi koşarken gelen saldırıya kesilmez.
5. Kuyruk yok: durum her karede girdinin iki sayacını da üstlenir, bu yüzden
   darbe sırasında olan olaylar **düşer**, sonradan oynanmaz. Yarım saniyede üç
   vuruş = sonuncusundan başlayan tek darbe klibi.
6. Varyant seçimi `rtsActionSequence` üzerinden kind'a özel: attack `attackCount`,
   hit `impactCount` kullanır. Aynı state iki sayacı da taşıdığı için bu ayrım
   şarttır — yutulan bir saldırı, oynayan darbe klibini ortasında değiştiremez.

**Root-motion doğrulaması (K-03):** Üç impact klibinin `mixamorig:Hips`
translation kanalı GLB'den ölçüldü. Net yer değiştirme sırasıyla
(0.08, −0.19, −0.09), (0, 0, 0) ve (0, 0, 0) klip birimi — yani hepsi başladığı
yere döner. Karşılaştırma: kilitli `attack_2` net 105.7/249.7/6.1, kilitli
`walk_1` ise 154 birim ilerler. Impact klipleri kilitlenmemiş `idle_1` ile aynı
büyüklük sınıfında olduğu için `rootMotion` girdisi eklenmedi; `lockXYZ`
uygulamak gövdenin geri sarsılmasını da düzleştirirdi.

**Otomasyon (7 yeni engine kontrolü, `--filter "Muhafiz Faz 2"`):**

- Sayaç yalnızca uygulanan hasarla artar; heal, 0 hasar, cesede inen vuruş ve
  `upgradeMax`/`setMax` artırmaz.
- Dört hasar kaynağının dördü de aynı olayı üretir: anlık vuruş, uçuş süreli top
  mermisi (havadayken değil, indiğinde), Karakol yaylım ateşi (ok başına bir
  olay) ve kurt ısırığı.
- Öncelik, restart ve "geçmişi kuyruğa alma" davranışı; `hit` klibi olmayan
  asset'in eskisi gibi davranması.
- Deterministik varyant seçimi ve `rtsActionSequence`'ın kind'a özel olması.
- `hit` rolünün editör kaydından sağ çıkması + Guard sidecar'ının havuzu
  authorlaması; havuzda `block`/`crouch`/`casting`/`power_up` bulunmaması (K-04).
- Darbe animasyonunun hasarı, cooldown'u ve despawn penceresini değiştirmemesi.
- `npx tsc --noEmit` temiz; `npm run test:engine` (fast) 1395 kontrol yeşil.

**Görsel kabul sonucu (2026-08-11): reddedildi.** Duran birimde pose doğru, fakat
yürüyen/koşan birim darbeyi *tüm gövdeyle* oynadığı için bacaklar adım ortasında
donuyor ve simülasyon birimi kaydırmaya devam ederken ayaklar sürünüyor. Düzeltme
Faz 2b.

### Faz 2b — Darbenin üst gövdeye indirilmesi

**Durum:** Kod ve otomasyon tamam (2026-08-11), kullanıcı görsel kabulü açık.

**Bulgu:** Tek `CrossfadeAnimator` tüm gövdeyi sürüyordu; RTS sunumu, TPS
tarafında zaten var olan gövde maskesi altyapısını (`bodyMask`,
`AssetSkeletonDef.upperBodyBone`) hiç kullanmıyordu.

**Yapılanlar:**

1. `engine/render-three/layeredClipAnimator.ts` — `LayeredClipAnimator`: aynı
   kök üzerinde iki maskeli `CrossfadeAnimator`. `LayeredCharacterAnimator`'dan
   ayrı durmasının nedeni sahiplik modeli: TPS animatörü montajın süresini kendi
   tutar ve mixer'ları `AnimationSubsystem`'e verir; RTS'te süreyi zaten saf
   durum makinesi bilir ve tick'i mesafeye göre kısan RTS döngüsü sahiplenir. Bu
   sınıf hiç zaman tutmaz. Ortak `UnitClipAnimator` arayüzü sayesinde sürücü tek
   bir kez yazılır.
2. Root motion **bölmeden önce** uygulanır. Maskelenmiş yarıda kalça position
   track'i yoktur ve `resolveRootMotionNode` bulduğu ilk position track'e düşer —
   üst yarıya kilit uygulamak rastgele bir kol kemiğini yerine çivilerdi.
3. `RtsActionState.layered`: klip **başladığı karede** belirlenir ve süresince
   değişmez. Kural `canLayerHit && planarSpeed > tuning.walkSpeed`. Duran birim
   tüm gövdeyle sarsılır — korunacak adım yoktur ve impact klipleri kalça geri
   tepmesiyle animate edilmiştir. Yarı yolda durdurulan birim klip ortasında
   torso-only ↔ full-body geçirmez; bu geçiş her iki seçenekten de kötü patlar.
4. `attack` ve `death` asla katmanlanmaz: saldırı zaten yerinde savrulur, ölüm
   tanımı gereği tüm gövdedir (yarısı yürüyen ceset yok).
5. Sürücüde katmanlı darbe dalı **erken dönmez** — locomotion kodu altında
   çalışmaya devam eder. Darbe bittiğinde torso, bıraktığı yürüyüşe değil
   birimin *o anki* yürüyüşüne döner (yürürken vurulup koşmaya başlayan birim).
6. Maliyet yalnızca kullanan asset'te: `upperBodyBone` authorlanmış **ve** gerçek
   kemiklerle eşleşmişse ikinci mixer alınır; eşleşmeyen kemik adı tüm track'leri
   alt kanala düşürüp bedeli boşuna ödetirdi.
7. `collectSubtreeNodeNames` artık sanitize toleranslı. `GLTFLoader` her düğüm
   adını `PropertyBinding.sanitizeNodeName`'den geçirir, yani sidecar'daki
   `mixamorig:Spine` sahnede `mixamorigSpine`'dır. Eşleşmeyen maske "katmanlama
   hiç yazılmamış" gibi görünen tek sessiz hatadır.
8. `Guard.skeleton.json` → `"upperBodyBone": "mixamorig:Spine"`. Kalça ve
   bacaklar locomotion kanalında kalır.
9. `CrossfadeAnimator.release(root)` eklendi; sunumdaki iki `dispose` de artık
   onu çağırır, katmanlı birimde **iki** mixer'ın binding cache'i bırakılır.

**Otomasyon (4 yeni engine kontrolü, `--filter "Muhafiz Faz 2"`):**

- Katmanlama kuralı: hareketli üst gövde / duran tüm gövde, kilitlenen karar,
  attack ve death'in hiç katmanlanmaması, `canLayerHit` yokken eski davranış.
- Maske: iki yazımın da aynı gövdeyi seçmesi, kalça/bacakların dışarıda kalması,
  impact klibinin kalça track'inin alt kanala düşmesi.
- Katmanlı oynatma: bacakların yürümeye devam etmesi, darbe ortasında gaitin
  değişebilmesi, torso'nun güncel gaite dönmesi, death'in iki kanalı da alması.
- Guard'ın kemiği authorlaması + kemiğin GLB'de gerçekten var olması ve kalçayı
  dışarıda bırakması (yazım hatası aksi hâlde sessizce full-body'ye döner).
- `npx tsc --noEmit` temiz; `npm run verify:imports` geçti; `npm run test:engine`
  (fast) 1399 kontrol yeşil.

**Görsel kabul (2026-08-11): ✅ kabul edildi.** Yürüyen/koşan muhafız vurulduğunda
ayakları kaymadan adımını sürdürüyor, üst gövdesi sarsılıyor.

### Faz 3 — İkinci death varyantı

**Durum:** Kod, veri ve otomasyon tamam (2026-08-11), kullanıcı görsel kabulü açık.

**Klipler:** `guard_sword_and_shield_death_1` (2.333 s, birincil),
`death_2` (3.933 s). Ölçüm GLB'den: `death_1` 2.333 s, `death_2` 3.933 s — plandaki
"3.90 s" tahmini yerine gerçek değer.

**Yapılanlar:**

1. `animationVariants.death` → `["guard_sword_and_shield_death_2"]`. **Kod
   değişikliği gerekmedi:** `rtsActionClip` death için `rtsActionSequence` = 0
   kullanıyor, `durationOfRole("death")` de aynı sequence'ı geçiyor, yani klip ve
   pencere aynı seed'den aynı varyanta çözülüyor.
2. Root motion: `mixamorig:Hips` net yer değiştirme `death_1` (3.8, −115.3, 67.9),
   `death_2` (−24.1, 93.2, 65.0) klip birimi — aynı büyüklük sınıfı. `death_1`
   kilitsiz hâliyle zaten kabul edilmişti; `death_2` de kilitlenmedi. Kilitlemek
   düşüşün kendi savrulmasını düzleştirirdi. Önemli olan **ikisinin aynı
   davranması**, bu yüzden test büyüklüğü değil ilişkiyi pinliyor.
3. Despawn penceresi sorusu incelendi ve **kapandı**: her oyun sorgusu
   `health.depleted`'a bağlı (`unitsOf`/`armyOf`, `bodyMeshes` tıklama hedefleri,
   `engagementSystem` — dolayısıyla `combatTargets` listesindeki cesetler —
   `unitSeparation`, `unitMovement`, görüş kaynakları, AI `armyManager`), death
   penceresinin uzunluğuna değil. `beginDeath()` daha ilk karede seçimden çıkarıp
   saldırganları serbest bırakıyor. Pencere tamamen sunumsal; uzaması yalnızca
   render ve `units.all()` iterasyonunu etkiliyor.

**Faz 3b — donmuş ceset pozu (2026-08-11).** Ceset süresi 30 sn'ye çıkarılmadan
önce ölçülen gerçek maliyet: bir ceset kare başına ~200 interpolant × 2 kanal
(katmanlı animatör), 69 kemik `updateMatrixWorld`, iskelet başına bir
`Skeleton.update()` + bone texture upload, ve 4 draw call / 15k üçgen. AI tarafı
zaten sıfır (Faz 3, madde 3).

Kritik bulgu: **`clampWhenFinished` mixer'ı durdurmuyor.** Three action'ı `paused`
yapıyor (`AnimationAction.js:767`) ama `_update` yine de her interpolantı
değerlendirip PropertyMixer'a yazıyor. Yani donmuş poz için tam animasyon işi
sürüyordu.

Düzeltme: `RtsUnitPresentation` düşüş oynayıp bittiğinde `poseFrozen` bayrağını
kaldırıyor ve o noktadan sonra animatöre hiç girmiyor — seçici de dahil, çünkü
`rtsActionClip` her karede aynı seçimi yeniden kurup dizi/Set ayırıyordu. Bayrak
kareyi tikledikten *sonra* kalkıyor: durum makinesi düşüşün başladığı karede
delta harcamaz, mixer harcar, dolayısıyla kalan süre sıfırlandığında mixer klip
boyundan bir kare fazlasını almış ve clamp'lenmiş son pozda oturmuş oluyor.

`UNIT_CORPSE_SECONDS` 5 → **30**.

Geriye kalan ceset başına maliyet — sıradaki optimizasyonun hedefi — sahne
grafiği kemik güncellemesi, `Skeleton.update()` ve draw call'lar. Bunları
kaldırmanın doğru yolu ceset başına poz pişirmek **değil** (Guard'ın 9.835
vertex'i ceset başına ~236 KB benzersiz geometri, hem de savaşın ortasında):
farklı ceset pozu yalnızca **iki** tane — `death_1` ve `death_2`'nin son kareleri.
Bir kez pişirilip iki `InstancedMesh`'e bağlanırsa sahadaki tüm cesetler 2 draw
call'a iner, iskelet/mixer/bone texture tamamen kalkar, tint `instanceColor` ile
taşınır. Bu iş ölçüm sonucuna bağlandı.

**Faz 3a — düşüş ile ceset süresinin ayrılması (kullanıcı bulgusu, 2026-08-11):**

Görsel kabulde ölüm animasyonu bitmeden gövde siliniyordu. İki ayrı neden vardı
ve ikisi de düzeltildi:

1. **Pencere = klip süresiydi.** Klibin *tam* uzunluğu pencere olduğu için en
   ufak gecikme (mixer'ın ilk kare farkı, mesafe throttle'ının banked zamanı)
   sonu kırpıyordu. Artık iki süre ayrı: `Unit.fallSeconds` düşüşün kendisi
   (authored klip ya da kapsül devrilmesi), `UNIT_CORPSE_SECONDS = 5` ise gövdenin
   alanda kalma tabanı. Pencere ikisinin büyüğü, yani düşüş her zaman sığıyor.
   Kapsül devrilmesi hâlâ kendi hızında iniyor — 5 saniyeye yayılmıyor.
2. **İki saat uyuşmuyordu.** Sunum *render* deltasıyla ilerliyor (bilinçli: can
   barı ve mermi izi her oyun hızında aynı görünmeli), pencere ise *simülasyon*
   deltasıyla harcanıyordu; simülasyon deltası render'ın hız çarpanı katı. 4×
   hızda pencere, beklediği klipten dört kat hızlı tükeniyordu. `updateDeath`
   artık simülasyon hızını alıyor ve **yalnızca düşüş kısmını** ölçekliyor: ceset
   bekleme süresi simülasyon saniyesi olarak kalıyor, çünkü hızlandırılmış bir
   savaşta oyuncu alanın da o hızda temizlenmesini bekler.

**Otomasyon (3 yeni engine kontrolü, `--filter "Muhafiz Faz 3"`):**

- 40 seed üzerinde: oynatılan klip ile bildirilen `deathSeconds` **daima aynı
  klibin uzunluğu**; havuzun iki klibi de gerçekten çekiliyor; aynı seed her
  tekrarda aynı düşüşü veriyor; birimin sonunda yaptığı/aldığı vuruşlar ölüm
  klibini seçmiyor; varyantsız asset tek uzunluğunu koruyor.
- Uzun pencere iki uzunluk için de: depleted anında oyun dışı, ilk karede
  deselect + saldırgan serbest, ceset tıklanamaz, klip bitene kadar alanda,
  bir kare erken gitmiyor, iki kez deselect etmiyor.
- Guard'ın iki death klibini de authorlaması, ikisinin de GLB'de gerçekten var
  olması (yazım hatası sessizce birincile döner) ve root-motion muamelesinin
  ikisinde aynı olması.
- Faz 3a: düşüş ile ceset penceresinin ayrı olması, kapsülün kendi hızında
  devrilip sonra yatması, ve **1×/2×/4×/8× hızlarda düşüşün ekran zamanında
  yarıda kesilmemesi** (aynı testte cesetlerin de o hızda temizlendiği).
- Faz 3b: düşüş bittiğinde donma (bir kare erken değil), donan pozun klibin son
  pozu olması ve 30 sn boyunca kaymaması, ölüm klibi olmayan asset'in hiç
  donmaması.
- `npx tsc --noEmit` temiz; `npm run test:engine:slow` (tam) 1415 kontrol yeşil.

**Görsel kabul (açık):** Bir muhafız bölüğü kırıldığında iki farklı düşüş görünür;
her iki düşüş de sonuna kadar oynar, gövde 5 sn yerde yattıktan sonra kaybolur;
ceset ne tıklanabilir ne de hedeflenebilir.

### Faz 4 — Defans/blok dili için oyun-state tasarımı

**Durum:** Tasarım kapısı — doğrudan klip ataması yapılmayacak.

**Asset adayları:** `block_1`, `block_2`, `crouch_block_1`, `crouch_block_2`,
`block_idle`.

Bugünkü `hold` stance yalnızca hareket/engagement politikasıdır; gerçek bir block
olayı, stamina veya hasar azaltma zamanı değildir. Bu yüzden her alınan darbede
`block` oynatmak savunma mekanizması varmış gibi yanıltıcı olur.

**Önce karar verilmesi gerekenler:**

- Block yalnızca gelecekteki savunma yeteneğinin başarılı sonucu mu, yoksa
  cosmetic bir guard stance mı?
- Başarılı block varsa damage/resistance nerede hesaplanacak ve hangi event
  `blockCount` aktaracak?
- Crouch blok seçilebilir bir stance mi, yoksa yalnızca sinematik/AI asseti mi?

Bu karar verilmeden bu faz açılmaz.

### Faz 5 — Hareket başlangıcı, duruş ve yön değiştirme

**Durum:** Faz 5a tamam, görsel kabul açık; Faz 5b keşif + görsel prototip gerektirir.

#### Faz 5a — Guard geri çekilmesi

Seçili canlı Guard'larda `T` ile tek bir geri çekilme emri kurulur; sonraki
zemin sağ tık hedefi normal navigasyon/formasyon hedefine dönüşür. Guard rota
boyunca mevcut yönünü korur, otomatik hedef edinimi veya alınan hasar bu
oyuncu emrini kovalamaya çeviremez. Bu sırada `walkBack`/`runBack` sırasıyla
`walk_2`/`run_2` kliplerini oynatır. İşçi, okçu ve topçu bu emre dahil olmaz.

**Otomatik kanıt:** `tsc --noEmit`; hedefli engine kontrolleri yönü koruma,
oyuncu-emri önceliği, rol filtresi ve sidecar rol ayrımını kapsar.

**Görsel kabul:** Guard öne bakarken arkasındaki zemine `T` ardından sağ tık;
geri adımın kalkan/yüz yönünü koruduğu, ayak kayması olmadığı ve normal sağ
tık hareketinin hâlâ yalnız `_1` döngülerini kullandığı doğrulanmalı.

#### Faz 5b — Dönüş ve strafe

**Asset adayları:** `180_turn_1`, `strafe_1..4`, `sheath_sword_1/2`.

**Gerekli veri:** Mevcut sunum yalnızca planar speed ve hedefe yüzü döner; yönsel
hız, dönüş açısı, stop/start olayı veya ekipman durumu yoktur. Bu veri olmadan
strafe ya da 180° dönüş klipleri rastgele tetiklenmez.

**Dar yaklaşım:** Önce yalnız `abs(shortestYawDelta)` yüksek ve gerçek hareket
başlamadan önceki pivot anı için turn event araştırılır. Formasyon ve crowd
recovery boyunca idle'a düşmemesi temel kabul şartıdır.

### Faz 6 — Footstep, shield ve hit VFX/SFX notify hattı

**Durum:** Generic runtime notify tüketicisi eksik.

Skeletal Mesh Editor notifies'i sidecar'a yazabiliyor; fakat RTS
`RtsUnitPresentation` bunları runtime'da yayınlamıyor. Bu faz önce generic,
tekrar tetiklemeyen clip-playhead notify dispatcher tasarlar; ardından Guard
kliplerine `footstep`, `sword-swing`, `shield-hit` ve `body-impact` işaretleri
ekler.

**Kabul:** Crossfade, uzaktaki düşük cadence, klip restart ve pause/resume
durumlarında notify iki kere atılmaz; ses/VFX gameplay hasarını değiştirmez.

## 5. Sonraki Oturum İçin Başlangıç Noktası

1. Önce Faz 3'ün görsel kabulünü sor/kaydet: bir muhafız bölüğü kırıldığında iki
   farklı düşüş görünmeli, uzun düşüş sahnede takılı kalmamalı. Kabul geldiyse
   Uygulama Günlüğü'ne kanıtla birlikte tarihli satır eklenir.
2. Fonksiyonel iş kalmadı — Faz 4/5/6 tasarım kapısında. Kapıyı açmak §4'teki
   soruların yanıtlanmasına bağlı; en ucuz sıra Faz 6 (generic notify
   dispatcher) çünkü tek gereksinimi runtime altyapısı, yeni oyun mekaniği değil.
   Faz 4 (block) gerçek bir savunma mekaniği kararı, Faz 5 (turn/strafe) ise
   sunumun bugün taşımadığı yönsel hız verisini istiyor.
3. Teslim kapısı (§7) için kalan: Faz 4/5/6'nın ya uygulanması ya da açık tasarım
   kararlarıyla ayrı bir backlog belgesine taşınması, ve `npm run build:verify`
   ile tam doğrulama.
4. Her TypeScript değişikliğinden sonra `npx tsc --noEmit`; her dar dilimden
   sonra ilgili filtreli engine testini çalıştır. Kalabalık/darbe görünümü için
   browser veya kullanıcı görsel kabulü açıkça ayrı yazılır.

## 6. Uygulama Günlüğü

- 2026-08-11 — `Guard.glb` muhafız Actor'ına bağlandı; birincil
  idle/walk/run/attack/death rolleri sidecar'a atandı.
- 2026-08-11 — Deterministik `animationVariants` altyapısı eklendi; idle ve
  attack için Guard varyantları bağlandı. Saldırı yalnız gerçek `attackCount`
  artışında seçilir.
- 2026-08-11 — Görsel kabul: idle/attack geçişleri çalışıyor.
- 2026-08-11 — 512² `M_Guard` materyali, Skeletal Mesh Editor slot yüzeyi ve
  `Guard.materials.json` üzerinden Guard'a atandı.
- 2026-08-11 — `walk_2` ve `run_2` önce sabit birim seed'iyle ileri hareket
  varyantlarına eklendi; sonraki incelemede kaynak kliplerin geri hareket ettiği
  görüldü. Bu ilk atama geçersizdir ve Faz 5a ile kaldırılmıştır.
- 2026-08-11 — Faz 2 uygulandı: `hit` rolü, `HealthComponent.impactCount`
  merkezî sayacı, `advanceRtsAction` içinde death > impact > attack önceliği ve
  üç impact klibinin deterministik varyant havuzu. Dört hasar yolunun dördü de
  test altında; 7 yeni engine kontrolü, `tsc --noEmit` ve fast `test:engine`
  (1395 kontrol) yeşil. Dünya içi görsel kabul açık.
- 2026-08-11 — Faz 2 görsel kabulü **reddedildi**: yürüyen/koşan muhafız darbeyi
  tüm gövdeyle oynayınca ayak kayması oluşuyor.
- 2026-08-11 — Faz 2b uygulandı: `LayeredClipAnimator` ile üst gövde slotu, klip
  başlangıcında kilitlenen `RtsActionState.layered` kararı, Guard'a
  `upperBodyBone: "mixamorig:Spine"` ve sanitize toleranslı maske araması. 4 yeni
  engine kontrolü; `tsc --noEmit`, `verify:imports` ve fast `test:engine`
  (1399 kontrol) yeşil.
- 2026-08-11 — **Görsel kabul: Faz 1 (walk/run varyantları) ve Faz 2b (katmanlı
  darbe) dünya içinde kabul edildi.** Yürüyen muhafız vurulduğunda adımını
  sürdürüyor, ayak kayması giderildi.
- 2026-08-11 — Faz 3 uygulandı: `death_2` (3.933 s) varyant havuzuna eklendi, kod
  değişikliği gerekmedi. Despawn penceresinin tamamen sunumsal olduğu — her oyun
  sorgusunun `health.depleted`'a bağlı olduğu — incelenip teste bağlandı.
- 2026-08-11 — Faz 3a: kullanıcı ölüm animasyonunun bitmeden kesildiğini bildirdi.
  Düşüş (`fallSeconds`) ile ceset penceresi (`UNIT_CORPSE_SECONDS = 5`) ayrıldı ve
  `updateDeath` simülasyon hızını alarak düşüş kısmını ölçekler oldu — sunum
  render saatinde, pencere simülasyon saatinde ilerlediği için 2×+ hızlarda klip
  kırpılıyordu. 5 yeni/güncellenmiş engine kontrolü.
- 2026-08-11 — Faz 3b: düşüş bitince sunum animatörü kalıcı olarak duruyor
  (`poseFrozen`); `clampWhenFinished`'in mixer'ı durdurmadığı ölçülerek bulundu.
  `UNIT_CORPSE_SECONDS` 30'a çıkarıldı. Instanced ceset havuzu ölçüme bağlandı.
  `tsc --noEmit` ve tam `test:engine:slow` (1415 kontrol) yeşil. Dünya içi görsel
  kabul + kare bütçesi ölçümü açık.
- 2026-08-11 — Faz 5a uygulandı: `walk_2`/`run_2` ileri varyant havuzundan
  çıkarılıp `walkBack`/`runBack` rollerine taşındı. `T` ardından zemin sağ tık
  yalnız Guard'lara yönü koruyan geri rota verir; TypeScript ve hedefli engine
  kontrolleri geçti. Dünya içi görsel kabul açık.

## 7. Teslim Kapısı

Plan ancak şu şartlar birlikte sağlandığında tamam kabul edilir:

- Faz 1 ile Faz 3'ün görsel kabulleri kaydedilmiş,
- Faz 2 gerçek hasar kaynaklarının tamamını kapsayan testlerle kanıtlanmış,
- Faz 4/5/6 ya uygulanıp kabul edilmiş ya da açık tasarım kararlarıyla ayrı
  backlog belgesine taşınmış,
- tam doğrulama (`npm run build:verify`) temiz geçmiş,
- Guard materyal, root-motion ve animasyon sidecar'ları manifest/runtime/editor
  yollarında tutarlı kalmış olmalı.
