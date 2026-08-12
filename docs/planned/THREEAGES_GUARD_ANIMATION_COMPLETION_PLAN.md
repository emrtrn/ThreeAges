# ThreeAges — Muhafız Animasyon Tamamlama Planı

Oluşturulma tarihi: 2026-08-11  
Durum: **Devam ediyor — Faz 1, 2, 2b, 3 (3a/3b dahil), 4 ve 5a kabul edildi.
Faz 4 tasarım kapısı kapandı: blok yolu denendi ve elendi, yerine Tapınak
alanında iyileşme duruşu uygulanıp kabul edildi. Geriye yalnız Faz 5b ve Faz 6
kaldı; ikisi de hâlâ tasarım kapısında.**

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
| `rest` | `guard_sword_and_shield_crouch_idle` | — | Faz 4, Tapınak alanında iyileşme |
| `attack` | `guard_sword_and_sheld_attack_2` | `attack_4`, `slash_5`, `kick` | Tamam |
| `hit` | `guard_sword_and_shield_impact_1` | `impact_2`, `impact_3` | Tamam (hareket hâlinde üst gövde) |
| `death` | `guard_sword_and_shield_death_1` | `death_2` | Tamam |

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

Faz 4 bu kuralı ihlal etmez, uygular: `crouch_idle` ancak simülasyonda gerçekten
var olan bir duruma (`SupportAuraSystem`'in o tick iyileştirdiği birim)
bağlandıktan sonra atandı. `block` klipleri ise gerçek bir blok mekaniği
olmadığı için authorlanmamış durumda ve bir engine kontrolü bunu koruyor.

### K-05 — Görsel kabul otomatik testten ayrıdır

Engine testleri sözleşme ve regresyon kanıtıdır. Aşağıdaki dünya içi kabuller
kullanıcı gözlemi olmadan kapatılmaz:

- Aynı anda 10 muhafızın yürüme/koşma ritmi ve ayak kayması.
- Darbe, iyileşme duruşu, ölüm ve yeniden locomotion geçişlerinin okunurluğu.
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

**Durum:** ✅ Kapandı — kod ve otomasyon 2026-08-11'de bitti, ilk görsel kabul
**reddedildi** (ayak kayması) ve düzeltmesi Faz 2b ile kabul edildi.

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

**Durum:** ✅ Tamam — kod ve otomasyon 2026-08-11'de bitti, görsel kabul aynı gün
alındı.

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

**Durum:** ✅ Tamam — kod, veri ve otomasyon 2026-08-11'de bitti, görsel kabul
2026-08-12'de alındı (3a düşüş/ceset ayrımı ve 3b donmuş poz dahil).

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

**Görsel kabul (2026-08-12): ✅ kabul edildi.** Bir muhafız bölüğü kırıldığında
iki farklı düşüş görünüyor; her iki düşüş de sonuna kadar oynuyor, gövde yerde
yattıktan sonra kayboluyor; ceset ne tıklanabilir ne de hedeflenebilir.

### Faz 4 — Tapınak alanında iyileşme duruşu

**Durum:** ✅ Tamam — kod, veri ve otomasyon 2026-08-12'de bitti, görsel kabul
aynı gün alındı.

Bu faz "defans/blok dili" olarak açıldı; tasarım kapısında iki tur döndü ve
**savunma değil, iyileşme** olarak kapandı. Aşağıda hem elenen yol hem seçilen yol
duruyor, çünkü elenme gerekçesi kalan blok asset'leri için de geçerli.

#### 4.1 Ölçülen asset gerçeği (2026-08-12, GLB'den)

| Klip | Süre | `mixamorig:Hips` net yer değiştirme | Şekil |
| --- | --- | --- | --- |
| `guard_sword_and_shield_crouch_idle` | 2.467 s | (0.00, 0.00, 0.00) | **döngü**, tam yerinde |
| `guard_sword_and_shield_crouch` | 0.600 s | (−2.8, −24.5, **+39.5**) | diz çökme geçişi |
| `guard_sword_and_shield_crouching` | 0.533 s | (3.2, 24.9, **−39.5**) | kalkma geçişi |
| `guard_sword_and_shield_crouching_2` | 0.667 s | (0.00, 0.00, 0.00) | döngü, yerinde |
| `guard_sword_and_shield_block_1` | 0.500 s | (−2.9, 23.0, 10.0) | tek atım, öne yaslanma |
| `guard_sword_and_shield_block_2` | 0.533 s | (−1.3, −26.3, −12.0) | tek atım, geri savrulma |
| `sguard_word_and_shield_block_idle` | 1.400 s | (0.0, 0.0, 0.0) | döngü, ayakta guard stance |

Karşılaştırma tabanı: `walk_1` net 154, `idle_3`/`idle_4` net ~0.03 klip birimi.

Üç sonuç:

1. `crouch_idle` **tam yerinde** (net sıfır) — `idle_3`/`idle_4` ile aynı sınıfta,
   yani kilit gerektirmeyen temiz bir döngü. Kullanılan klip bu.
2. `crouch` ile `crouching` birbirinin **tam tersi** (Z ekseninde ±39.5), yani
   authorlanmış bir diz çökme/kalkma çifti. İkisi de bir yürüyüş adımının ~%26'sı
   kadar yer değiştiriyor; kullanılacaklarsa `lockXYZ` şart. Bu fazda
   kullanılmadılar (bkz. "Uygulanmayan").
3. `block_idle` isimlendirmesi bozuk: dosyadaki gerçek ad
   **`sguard_word_and_shield_block_idle`** (`sguard_word`, `guard_sword` değil).
   Sidecar'a doğru yazılmazsa rol sessizce fallback'e düşer.

#### 4.2 Bugün gerçekten var olan oyun kancaları

Tarama sonucu, bir duruşa bağlanabilecek dört aday state var ve hepsi farklı şey
vaat ediyor:

- **`UnitStance = "aggressive" | "hold"`** (`unit.ts`, `H` tuşu). Yalnızca hareket
  ve hedef edinme politikası; hasarla hiç ilgisi yok.
- **`Unit.damageResistance`** (`damageResolution.ts`, `supportAuraSystem`). Gerçek
  ve tek hasar azaltma yolu; her tick sıfırdan yeniden yazılıyor.
- **`BuildingBalanceStats.aura.healPerSecond`** (aynı sistem). Gerçek ve tek can
  geri kazandırma yolu — **bu fazın bağlandığı kanca.**
- **`HealthComponent.impactCount`** (Faz 2). Uygulanmış hasarı sayar; emilmiş bir
  vuruşu ayırt edemez.

#### 4.3 Elenen yol: blok (2026-08-12, uygulandı ve geri alındı)

İlk kapı kararı `block_1`/`block_2`'yi aura **emilimine** bağlamaktı: Tapınak
alanındaki birim vurulduğunda `hit` yerine kalkan cevabı oynasın. Kodu, verisi ve
4 engine kontrolü yazıldı, `build:verify` yeşil geçti; sonra **kullanıcı
gözleminde elendi**: emilim koşulu (alanın içinde olmak *ve* tam o anda vurulmak)
sahada yeterince sık kurulmadığı için davranış pratikte gözlemlenemedi.

`block` rolü, `impactAbsorbed` sinyali ve dört kontrol bu yüzden tamamen geri
alındı. Bugün sidecar'da blok klibi authorlanmış **değil** ve bir engine kontrolü
bunu böyle tutuyor: K-04 gereği oyunda gerçek bir blok mekaniği olmadan hiçbir
klip blok rolüne giremez.

Kaydedilmeye değer teknik bulgu: kalkanı **mermiye değil gövdeye** bağlamak
gerekiyordu. Top hasarını *ateş anında* pişirir (`AttackComponent.tryFire`), yani
korumalı bir birime atılıp o birim alandan çıktıktan sonra inen mermi, artık
sahip olmadığı bir korumayla indirilmiştir. Aynı "durumu izle, olayı değil"
ayrımı iyileşme duruşunda da karşılığını buldu (aşağıda madde 2).

#### 4.4 Seçilen yol: iyileşme duruşu (kullanıcı kararı, 2026-08-12)

> "Guard Tapınak alanında iken çömelme hareketi yapsın (dua gibi görünsün, diz
> çökme) ve bu şekilde iyileşsin. İyileşince ayağa kalkar. Yani tapınak
> yarıçapında yaralı askerlerin bekleme animasyonu idle değil çömelme olacak."

Blok yerine bu seçildi çünkü koşulu **sürekli ve gözlemlenebilir**: birim alanda
durduğu ve yarası olduğu sürece poz görünür, tek bir vuruş anına bağlı değil. Ve
gösterdiği şey zaten oynuyor — Tapınak gerçekten can veriyor.

#### 4.5 Yapılanlar

1. **Yeni sürekli rol `rest`**, K-01'in üç yüzeyinde birlikte:
   `ANIMATION_SET_ROLES` (`src/scene/assetSkeletonLoader.ts`),
   `SKELETON_ANIMATION_SET_ROLES` (`tools/saveValidator.ts`) ve seçici/testler.
   Skeletal Mesh Editor rol satırını otomatik gösterir; UI değişikliği gerekmedi.
   Tek atımlık değil sürekli: `work` gibi kendi klibine ulaşır, asset authorlamazsa
   `idle`'a düşer — yani rolü olmayan her birim eskisi gibi ayakta bekler.
2. **Sinyal "yarası var ve alanın içinde" değil, "canı gerçekten geri geldi".**
   `SupportAuraSystem` iyileştirdiği birime `Unit.mending = healed > 0` yazıyor;
   `damageResistance` ile aynı her-tick-sıfırdan kuralında, yani iyileşen, alandan
   çıkan veya Tapınağı yıkılan birim bir sonraki tick'te iddiayı düşürüyor ve geri
   alınacak defter kalmıyor. İki koşulu birleştirip türetmek yanlış olurdu: tam
   candaki bir birim alanın içinde de olsa hiçbir şey almıyor. Bunun doğrudan
   sonucu olarak **birim tam cana ulaştığı tick'te `healed` sıfırlandığı için ayağa
   kalkması ayrıca kodlanmadı** — kullanıcının istediği "iyileşince ayağa kalkar"
   davranışı bu tanımdan bedavaya geliyor.
3. **Öncelik sırası:** `death > attack > locomotion > work > rest > idle`.
   Emir alan, dövüşen, düşen veya inşa eden birim diz çökmez; yalnızca yapacak
   başka işi olmayan yaralı asker çöker. Alandaki yaralı bir işçi hâlâ işçidir —
   `work` bilinçli olarak `rest`'in üstünde.
4. **Klip:** `rest` → `guard_sword_and_shield_crouch_idle` (2.467 s, net sıfır).
   Yerinde olduğu için `rootMotion` girdisi **eklenmedi**; test bunu büyüklük
   olarak değil ilişki olarak pinliyor: crouch idle, ayakta idle'larla aynı
   muameleyi görür (kilitsiz), yürüyüş ise kilitli kalır.
5. **Diz çökme/kalkma hızı:** sürekli kanalın 0.18 s'lik blend'i bu poz için sert
   kalıyordu (asker yere düşüp zıplayarak kalkıyor gibi görünüyordu).
   `idle`↔`rest` çiftinin **iki yönü de** 0.45 s'ye çıkarıldı. Yalnızca o çift:
   emir alıp kalkan birim normal hızda kalkmalı, yoksa hücuma yarım saniye diz
   üstünde başlar.

**Uygulanmayan:**

- `crouch` (diz çökme) ve `crouching` (kalkma) geçiş klipleri. Ölçüldüler ve
  authorlanmış bir çift oldukları doğrulandı; kullanılmaları montaj makinesinin
  üç ayrı klibe genelleştirilmesini ister (bugünkü `RtsWorkMontage` tek klibi
  bölümlere ayırıyor). 0.45 s'lik blend aynı okumayı verdiği için ayrı bir dilime
  bırakıldı — istenirse açılacak ilk ek bu.
- Seçenek A: `hold` duruşunda `block_idle` döngüsü. Değerlendirildi, alınmadı;
  hâlâ ucuz ve bağımsız bir ek.
- Crouch **blok** klipleri (`crouch_block_*`) ve seçilebilir bir çömelme stance'i.
  Kullanıcı kararıyla kapsam dışı: yeni bir emir ve menzil/görüş sonuçları demek.

**Otomasyon (4 yeni engine kontrolü, `--filter "Muhafiz Faz 4"`):**

- Rol sınıflandırması: `resting` diz çöktürür, `resting` yokken idle kalır, bayrağı
  hiç göndermeyen çağıran Faz 4 öncesi davranışı korur; hareket, saldırı, ölüm
  **ve iş** birimi ayağa kaldırır; rol kendi klibine ulaşır, authorlanmamışsa
  `idle`'a düşer; poz hıza göre ölçeklenmez.
- Dürüstlük: alan yaralıyı diz çöktürür **ve** canı gerçekten geri gelir; tam
  candaki birim ayakta kalır; yarıçap dışındaki yaralı ve düşman birim çökmez;
  inşa hâlindeki Tapınak kimseyi iyileştirmez; **yara kapandığı tick'te birim
  ayağa kalkar**; yarıçaptan çıkmak pozu aynı tick'te düşürür; düşmekte olan gövde
  diz çökmez.
- Sidecar: rol editör kaydından sağ çıkar, Guard klibi authorlar, klip GLB'de
  gerçekten vardır, bir crouch klibidir, ayakta idle'lar gibi kilitsizdir (yürüyüş
  ise kilitlidir), ve **blok rolü authorlanmamıştır** + `hit` havuzuna crouch/block
  sızmamıştır (K-04).
- K-02: poz hasarı, iyileşme hızını (aura'nın veri oranı) ve saldırganın
  cooldown'unu değiştirmez; dövüşen Guard diz çökmez.

**Görsel kabul (2026-08-12): ✅ kabul edildi.** Yaralı Guard Tapınak yarıçapında
diz çöküp bekliyor, canı dolarken pozda kalıyor, dolunca ayağa kalkıyor.

### Faz 5 — Hareket başlangıcı, duruş ve yön değiştirme

**Durum:** Faz 5a tamam ve kabul edildi; Faz 5b keşif + görsel prototip gerektirir.

#### Faz 5a — Guard geri çekilmesi

Seçili canlı Guard'larda `T` ile tek bir geri çekilme emri kurulur; sonraki
zemin sağ tık hedefi normal navigasyon/formasyon hedefine dönüşür. Guard rota
boyunca mevcut yönünü korur, otomatik hedef edinimi veya alınan hasar bu
oyuncu emrini kovalamaya çeviremez. Bu sırada `walkBack`/`runBack` sırasıyla
`walk_2`/`run_2` kliplerini oynatır. İşçi, okçu ve topçu bu emre dahil olmaz.

**Otomatik kanıt:** `tsc --noEmit`; hedefli engine kontrolleri yönü koruma,
oyuncu-emri önceliği, rol filtresi ve sidecar rol ayrımını kapsar.

**Görsel kabul (2026-08-12): ✅ kabul edildi.** Guard geri adımda kalkan/yüz
yönünü koruyor, ayak kayması yok, normal sağ tık hareketi hâlâ yalnız `_1`
döngülerini kullanıyor.

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

**Açık görsel kabul kalmadı.** Faz 1, 2b, 3, 4 ve 5a dünya içinde kabul edildi.

1. Fonksiyonel iş olarak yalnız Faz 5b ve Faz 6 kaldı, ikisi de hâlâ tasarım
   kapısında. En ucuz sıra Faz 6 (generic notify dispatcher) çünkü tek gereksinimi
   runtime altyapısı, yeni oyun mekaniği değil. Faz 5b (turn/strafe) sunumun bugün
   taşımadığı yönsel hız verisini istiyor ve önce o verinin nereden geleceğine
   karar verilmeli.
2. İsteğe bağlı, bağımsız ve sırayla en ucuz üç ek §4.5'in "Uygulanmayan"
   listesinde duruyor: `crouch`/`crouching` geçiş klipleriyle gerçek diz çökme ve
   kalkma hareketi (montaj makinesini üç klibe genelleştirmek), `hold` duruşunda
   `block_idle` döngüsü, ve crouch blok. Üçü de bu planın kapsamı içinde ama
   hiçbiri teslim kapısının şartı değil.
3. Teslim kapısı (§7) için kalan tek madde: Faz 5b/6'nın ya uygulanması ya da açık
   tasarım kararlarıyla ayrı bir backlog belgesine taşınması.
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
- 2026-08-12 — **Görsel kabul: Faz 3 (3a/3b dahil) dünya içinde kabul edildi.**
  İki farklı düşüş görünüyor, düşüşler sonuna kadar oynuyor, ceset donmuş pozda
  bekleyip kayboluyor.
- 2026-08-12 — Faz 4 tasarım kapısı ölçümle açıldı: altı blok klibinin süresi ve
  `mixamorig:Hips` net yer değiştirmesi GLB'den okundu (`block_1/2` ve
  `crouch_block_1` kilitsiz kullanılamaz), `block_idle`'ın gerçek adının
  `sguard_word_and_shield_block_idle` olduğu bulundu, ve bugün var olan üç oyun
  kancası (`hold` stance, `damageResistance`, `impactCount`) ile üç seçenek
  (A/B/C) belgelendi.
- 2026-08-12 — Faz 4, birinci deneme (**Seçenek B, geri alındı**): tek-atımlık
  `block` rolü `hit`'in yuvasında aura emilimine bağlandı, `build:verify` yeşil
  geçti. Kullanıcı gözleminde elendi — emilim koşulu (alanın içinde olmak *ve* tam
  o anda vurulmak) sahada yeterince sık kurulmadığı için davranış görülemedi. Rol,
  sinyal ve dört kontrol tamamen geri alındı.
- 2026-08-12 — **Kullanıcı kararı: iyileşme duruşu.** Faz 4 uygulandı: sürekli
  `rest` rolü üç yüzeye eklendi (`crouch_idle`, 2.467 s, net sıfır — kilit
  gerekmedi), sinyal `SupportAuraSystem` → `Unit.mending = healed > 0`, öncelik
  `work > rest > idle`, ve `idle`↔`rest` çiftinin iki yönü de 0.45 s'ye
  yavaşlatıldı. "İyileşince ayağa kalkar" ayrıca kodlanmadı: tam canda `healed`
  sıfır olduğu için tanımdan geliyor. 4 yeni engine kontrolü.
  `npm run build:verify` tam yeşil: `verify:imports`, `vite build`,
  `test:engine:slow` 1420 kontrol, `verify:dist --strict`. Dünya içi görsel kabul
  açık.
- 2026-08-12 — **Görsel kabul: Faz 4 (Tapınak alanında iyileşme duruşu) ve
  Faz 5a (Guard geri çekilmesi) dünya içinde kabul edildi.** Yaralı Guard alanda
  diz çöküp bekliyor ve canı dolunca ayağa kalkıyor. Bu kabulle planda açık görsel
  kabul kalmadı; geriye yalnız Faz 5b ve Faz 6 tasarım kapıları duruyor.
- 2026-08-12 — Faz 2b kontrolü `Guard ust govde kemigini authorlar` `main`'de
  kırmızı bulundu: `upperBodyBone`'u GLB'nin ham `mixamorig:Spine` yazımına
  pinliyordu, sidecar ise bir editör kaydından sonra sanitize edilmiş
  `mixamorigSpine` taşıyor. Runtime ikisini de kabul ettiği için oyun etkilenmemiş.
  Kontrol runtime ile aynı biçimde iki tarafı da sanitize ediyor artık.
- 2026-08-11 — Faz 5a uygulandı: `walk_2`/`run_2` ileri varyant havuzundan
  çıkarılıp `walkBack`/`runBack` rollerine taşındı. `T` ardından zemin sağ tık
  yalnız Guard'lara yönü koruyan geri rota verir; TypeScript ve hedefli engine
  kontrolleri geçti. Dünya içi görsel kabul açık.

## 7. Teslim Kapısı

Plan ancak şu şartlar birlikte sağlandığında tamam kabul edilir:

- ✅ Faz 1 ile Faz 3'ün görsel kabulleri kaydedilmiş (2026-08-11 / 2026-08-12),
- ✅ Faz 2 gerçek hasar kaynaklarının tamamını kapsayan testlerle kanıtlanmış,
- ✅ Faz 4 ile Faz 5a uygulanıp kabul edilmiş (2026-08-12),
- Faz 5b/6 ya uygulanıp kabul edilmiş ya da açık tasarım kararlarıyla ayrı
  backlog belgesine taşınmış — **tek açık madde bu,**
- ✅ tam doğrulama (`npm run build:verify`) temiz geçmiş (2026-08-12, 1420 kontrol),
- Guard materyal, root-motion ve animasyon sidecar'ları manifest/runtime/editor
  yollarında tutarlı kalmış olmalı.
