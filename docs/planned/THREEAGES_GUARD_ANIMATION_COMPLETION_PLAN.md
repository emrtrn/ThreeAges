# ThreeAges — Muhafız Animasyon Tamamlama Planı

Oluşturulma tarihi: 2026-08-11  
Durum: **Devam ediyor — temel bağlama, materyal paritesi ve hareket/saldırı çeşitliliği tamam; sonraki oturum Faz 1 görsel kabulü veya Faz 2 darbe tepkisinden başlar.**

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
| `walk` | `guard_sword_and_shield_walk_1` | `walk_2` | Tamam, görsel kabul açık |
| `run` | `guard_sword_and_shield_run_1` | `run_2` | Tamam, görsel kabul açık |
| `work` | `guard_sword_and_shield_idle_1` | — | Mevcut davranış korunur |
| `attack` | `guard_sword_and_sheld_attack_2` | `attack_4`, `slash_5`, `kick` | Tamam |
| `death` | `guard_sword_and_shield_death_1` | — | Tamam |

`animationVariants` seçimi rastgele sayı üretmez. `unit.id` tabanlı seed;
idle/walk/run için birim başına, attack için de `attackCount` başına kararlı klip
seçer. Bu nedenle bir kalabalıkta çeşitlilik görünür, fakat aynı muhafız her
karede farklı pozdan başlamaz.

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

**Durum:** Kod tamam, kullanıcı görsel kabulü açık.

**Amaç:** Yeni `walk_2` ve `run_2` döngülerinin birlik hareketinde doğal
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

**Durum:** Planlandı — sonraki fonksiyonel dilim.

**Asset adayları:**

- `guard_sword_and_shield_impact_1` — 0.70 s
- `guard_sword_and_shield_impact_2` — 0.97 s
- `guard_sword_and_shield_impact_3` — 0.70 s

**Yapılacaklar:**

1. `hit` adlı tek-atımlık semantic rolü sidecar/validator sözleşmesine ekle.
2. Birim sunum snapshot'ına oyun verisi olmayan, yalnızca gerçek hasar uygulanınca
   artan bir `impactCount` aktar.
3. Tüm hasar kaynaklarını kapsa: anlık melee/ranged hit,
   `PendingImpactQueue` ile geciken top atışı ve predator vuruşu. Sadece `applied
   > 0` değişiklikler tepki üretmelidir.
4. `RtsUnitPresentation` içinde önceliği açıkça tanımla:
   `death > yeni impact > yeni attack > work > locomotion`.
5. Aynı kısa aralıktaki vuruşlar için kuyruk yerine son gerçek darbeye restart
   uygulanıp bitince locomotion'a dönülsün; eski darbeler sonradan oynatılmasın.
6. Üç impact klibini `hit` varyantı olarak seed + `impactCount` ile deterministik
   seç; hepsine root-motion doğrulaması uygula.

**Otomasyon:**

- Impact sayacı yalnızca gerçek damage'le artar; heal, miss veya 0 applied artmaz.
- Her damage kaynağı aynı presentation olayını üretir.
- Death, impact'i keser; impact ne attack cooldown'una ne de hasar miktarına oy
  verir.
- `npx tsc --noEmit` ve `npm run test:engine -- --filter "Skeletal animasyon"`.

**Görsel kabul:** Muhafız yürürken, savaşırken ve ölmeden hemen önce hasar alır;
pose okunur, spam halinde kilitlenmez, öldüğünde death klibi önceliklidir.

### Faz 3 — İkinci death varyantı

**Durum:** Faz 2 kabulünden sonra dar, güvenli asset dilimi.

**Asset adayı:** `guard_sword_and_shield_death_2` — 3.90 s.

**Yapılacaklar:**

1. `death_2` root-motion/pivotunu Skeleton Editor'da incele ve gerekli in-place
   ayarı ekle.
2. `animationVariants.death` içine yalnızca klip ve despawn süresi uyumluysa ekle.
3. Her birimin seed'inin ölüm klibini sabit seçtiğini ve presentation'ın seçtiği
   klip süresince `unitDeath` tarafından sahnede kaldığını test et.

**Kabul:** Uzun death klibi zarar verilemeyen yeni bir oyun durumu yaratmaz;
ölümden sonra hedefleme, selection ve removal mevcut davranışını korur.

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

**Durum:** Keşif + görsel prototip gerektirir.

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

1. Önce Faz 1'in dünya içi görsel kabulünü sor/kaydet. Kabul geldiyse bu planın
   Uygulama Günlüğü'ne yalnızca kanıtla birlikte işaret ekle.
2. Ardından Faz 2 ile başla; `RtsPresentationUpdate`, `Unit`,
   `RtsUnitPresentation`, `rtsUnitAnimation`, `RtsApp.resolveCombatHit`,
   `PendingImpactQueue` ve predator damage yollarını birlikte incele.
3. `hit` rolünü eklemeden önce her hasar yolunu listele; eksik kaynak varsa
   cosmetic event için tek bir merkezi köprü seç.
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
- 2026-08-11 — `walk_2` ve `run_2`, sabit birim seed'iyle hareket varyantlarına
  eklendi. Hedefli skeletal testler ve TypeScript kontrolü geçti; dünya içi
  görsel kabul açık.

## 7. Teslim Kapısı

Plan ancak şu şartlar birlikte sağlandığında tamam kabul edilir:

- Faz 1 ile Faz 3'ün görsel kabulleri kaydedilmiş,
- Faz 2 gerçek hasar kaynaklarının tamamını kapsayan testlerle kanıtlanmış,
- Faz 4/5/6 ya uygulanıp kabul edilmiş ya da açık tasarım kararlarıyla ayrı
  backlog belgesine taşınmış,
- tam doğrulama (`npm run build:verify`) temiz geçmiş,
- Guard materyal, root-motion ve animasyon sidecar'ları manifest/runtime/editor
  yollarında tutarlı kalmış olmalı.
