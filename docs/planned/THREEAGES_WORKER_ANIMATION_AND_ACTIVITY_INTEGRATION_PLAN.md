# ThreeAges — Worker Animasyon ve Aktivite Entegrasyon Planı

Oluşturulma tarihi: 2026-08-13
Son asset güncellemesi: 2026-08-15 (yeni Worker paketi)
Son ölçüm/denetim: 2026-08-18 (Faz ≤5 kapanışı + Faz 6 ilk dilimi + barrel devrinin
kaldırılması + toz/kıymık bağlamalarının kaldırılması, §12.4)
Durum: **Faz 1, 1A, 2, 3, 4 ve 5 kapandı (2026-08-18). Faz 6'nın işaret dilimi
uygulandı (§12.1); Faz 6'dan kalan ses (ayrı plan) ve efekt okunurluk kabulü.
Sıradaki: Faz 7 (performans/teslim). Kullanıcı gözü bekleyen kabul maddeleri
§17'de toplandı, hiçbiri faz bloke etmiyor.**

## 0. Aktif Asset Sözleşmesi — `worker.glb`

Eski `Characters/Worker/Worker.glb` (33 klipli Mixamo paketi) kaldırıldı. RTS
`worker` asset kimliği artık `public/assets/ThreeAges/Characters/Worker/worker.glb`
dosyasını ve yanındaki `worker.skeleton.json` / `worker.materials.json`
sidecar'larını kullanır.

### 0.1 Ölçülen asset gerçeği (2026-08-16, GLB'den doğrudan okundu)

| Özellik | Değer |
| --- | --- |
| Dosya boyutu | 5,65 MB |
| Animasyon klibi | 51 |
| Skin / eklem | 1 skin, 65 eklem |
| Mesh / primitive | 2 (`avaturn_body`, `avaturn_look_0`) |
| Vertex / üçgen | 10.409 vertex, 18.201 üçgen |
| GLB içi texture | Yok — görünüm dış sidecar materyallerinden gelir |
| Bind-pose boy | ~1,847 m (kalça yüksekliği ~0,967 m) |
| Sahne kökü | `Root`, ölçek 0,01 — animasyon track'leri **santimetre** birimindedir |
| Rig adlandırma | `mixamorig:*` **değil**; sade `Hips`, `RightHand`, `LeftHand` ailesi |
| `T-Pose` klibi | Yeni pakette **yok** |

Bu, eski paketin karakterinden temel bir kopuştur: eski Worker 60.000 üçgen ve
33 eklemliydi, yenisi 18.201 üçgen ve 65 eklemli. Faz 7'nin bütün performans
gerekçesi bu yüzden yeniden yazıldı (§13).

### 0.2 Runtime rol eşlemesi (bugün `worker.skeleton.json` içinde authored)

| RTS rolü | Klip | Süre (s) |
| --- | --- | ---: |
| `idle` | `Idle_FoldArms_Loop` | 2,567 |
| `idle` varyantı | `Idle_Loop` | 2,567 |
| `walk` | `Walk_Loop` | 1,400 |
| `run` | `Sprint_Loop` | 0,733 |
| `work` (construction / repair / mining) | `Fixing_Kneeling` montage | 5,267 |
| `workCultivation` | `Farming_dig_and_plant_seeds` | 5,533 |
| `workCultivation` varyantları | `Farming_plant_a_plant` / `Farming_watering` | 7,500 / 5,600 |
| `workHunting` | `Attack` | 2,300 |
| `workChopping` | `TreeChopping_Loop` | 1,033 |
| `carryPose` (üst gövde katmanı) | `Farming_box_idle` | 5,967 |
| `carryIdle` (katmansız yedek) | `Farming_holding_idle` | 5,900 |
| `carryWalk` (katmansız yedek) | `Farming_holding_walk` | 1,367 |
| `combatIdle` (dövüş arası duruş) | `Idle_Torch_Loop` | 1,333 |
| `attack` (menzilli misilleme) | `OverhandThrow` | 1,400 |
| `attackHunting` | `Attack` | 2,300 |
| `attackMelee` | `Punch_Jab` (+ `Punch_Cross`) | 0,933 / 1,067 |
| `hit` | `React_Chest` (+ `React_Head`) | 0,800 / 1,000 |
| `death` | `Death` | 2,467 |

Soketler: `right-hand-tool` (`RightHand`, önizleme `axe`), `throw-release`
(`RightHand`, önizleme `rock`), `carry-box` (`Hips`, `position: [0, 0.03, 0.24]`,
önizleme `crate`). Crate'in el/gövde hizası hâlâ dünya içi görsel kabul bekliyor.

### 0.4 Soket ölçek sözleşmesi (2026-08-17'de düzeltildi)

Sahne kökü 0,01 ölçekli olduğu için **kemiğe doğrudan asılan her prop, authored
boyutunun %1'i kadar çiziliyordu** — 39 cm'lik Crate 3,9 mm, balta birkaç
milimetre. İkisinin de dünyada görünmemesinin sebebi buydu; kod, test ve
görünürlük mantığı doğru çalışıyordu, prop yalnızca ölçek altında yok oluyordu.
Aynı hata editörün socket overlay'inde de vardı (4 cm'lik işaretçi 0,4 mm), yani
soketler görsel olarak hiç authorlanamamıştı.

`engine/render-three/skeletalSocket.ts` artık kemik ile soket arasına ölçeği
iptal eden bir mount düğümü koyuyor; **runtime ve editör aynı yoldan geçiyor**.
Sözleşme: soket offset'i ve prop ölçeği **dünya birimindedir (metre)**, rigin
export birimi ne olursa olsun. Authored `[0, 0.03, 0.24]` artık gerçekten 3 cm
yukarı / 24 cm ileri demek.

Ölçülen ham prop boyutları: Crate 9,75 × 8,65 × 9,75 cm (4× → ~39 cm),
Axe 7,3 × 20 × 1,2 cm. Baltanın `position: [0, 0.45, 0]` offset'i bozuk cm
uzayında ayarlandığı için (gerçekte 4,5 mm) sıfırlandı; artık 45 cm anlamına
gelip eli terk ederdi. Balta ölçeği kullanıcı kabulünde 5,5 → **3,5** yapıldı
(20 cm × 3,5 = **70 cm**): iki elle kullanılan kesim baltası değil, tek elle
tutulan küçük bir el baltası isteniyor.

### 0.3 Materyal sözleşmesi

`worker.materials.json` iki slot bildirir: `m-worker-face-material` ve
`m-worker-cloth-material`. Kumaş materyali `Worker_Cloth_Blue_BC.png` +
normal + ORM kullanır; düşman Actor'u slot 1'i `m-worker-cloth-material-copy`
(`Worker_Cloth_Red_BC.png`) ile override eder. Yani takım renk ayrımı **asset
tarafında yapılmıştır** (§11.2).

## 1. Amaç

`worker.glb` içindeki 51 animasyonu RTS Worker biriminde aşamalı biçimde
kullanmak; önce güvenli temel locomotion'ı kurmak, ardından Worker'ın gerçek
işiyle eşleşen aktivite animasyonlarını, prop/soket bağlantılarını ve sunumsal
efektleri eklemek.

Bu planın hedefi yalnızca daha çok klip oynatmak değildir. Her animasyon,
simülasyonun gerçekten ürettiği bir Worker durumunu doğru ve okunur biçimde
göstermelidir. Paketin 51 klibinin yaklaşık üçte ikisinin RTS'de karşılığı
yoktur ve olmaması normaldir (§4.4).

## 2. Değişmez Kurallar

- Birimin konumu, yönü, hızı, rotası, iş ataması, üretim miktarı, kaynak taşıması,
  hasarı ve ölüm kararı simülasyonun otoritesinde kalır.
- Animasyon, montage ve notify yalnızca gerçekleşmiş durumu gösterir; ekonomi
  tick'ini, kaynak kazancını, inşaat ilerlemesini veya saldırı sonucunu belirlemez.
- Root-motion kaynağı `worker.skeleton.json` ve Skeletal Mesh Editor'dür. Kullanıcı
  tarafından authorlanan root-motion satırları korunur; kaynak GLB destructive
  biçimde yeniden yazılmaz.
- Varyant seçimi `Math.random()` kullanmaz. Aynı birim, aynı aktivite ve aynı olay
  sırası replay-dostu deterministik sonuç üretir.
- Prop gerektiren klipler, görünür ve doğru hizalanmış prop olmadan runtime
  havuzuna alınmaz.
- Otomatik test ve dünya içi görsel kabul ayrı kapılardır. Görsel kabul, kullanıcı
  gözlemi veya hedefli browser doğrulaması olmadan tamamlanmış sayılmaz.
- Yeni sidecar alanı gerekirse `src/scene/assetSkeletonLoader.ts` ve
  `tools/saveValidator.ts` aynı dilimde güncellenir.

## 3. Kanıtlı Başlangıç Noktası

### 3.1 Asset envanteri

- [x] `worker.glb` manifestte `worker` kimliğiyle, `assetType: "skeletalMesh"`
  olarak kayıtlı (`Worker Faz 1` kontrolü yolu da pinliyor).
- [x] 51 klip, 65 eklem, 2 primitive, 10.409 vertex, 18.201 üçgen ölçüldü.
- [x] Model ~1,847 m; rig `mixamorig:` öneki taşımıyor, root eklem `Hips`.
- [x] Animasyon track'leri santimetre biriminde; sahne kökü `Root` 0,01 ölçekli.
- [x] GLB içinde texture yok; görünüm `M_Worker_Face` ve `M_Worker_Cloth`
  sidecar materyallerinden geliyor.
- [x] `worker.materials.json` iki slotu (`face`, `cloth`) doğru sırada bildiriyor.
- [x] **`gltf-transform validate` çalıştırıldı (2026-08-18, v4.4.0): hata yok.**
  İki uyarı ve iki bilgi notu var, ikisi de asset gerçeği ve ikisi de zararsız:
  `NODE_SKINNED_MESH_NON_ROOT` (iki skinned mesh düğümü, `/nodes/65` ve
  `/nodes/66`, kök değil — üstlerindeki transform onlara işlemez, ki bu skinned
  mesh için zaten böyle olması gereken şey) ve iki `UNUSED_OBJECT`
  (`TEXCOORD_0`; GLB'de texture yok, görünüm sidecar materyallerinden geliyor —
  yani UV'yi kullanan bir materyal GLB'nin içinde yok, dışında var). Hiçbiri
  runtime'da bir davranışa karşılık gelmiyor.
- [x] **Duplicate klip taraması yapıldı (2026-08-18): yok.** 51 klibin 51'i de
  ayrı animasyon verisi taşıyor. `Idle_Loop` ile `Idle_FoldArms_Loop` şüpheliydi
  çünkü süre (2,567 s), kanal sayısı (198) ve keyframe sayısı (77) birebir aynı —
  ama sampler baytları farklı. Karşılaştırma ada veya süreye değil veriye
  bakıyor: her kanalın hedef düğümü, path'i ve input/output accessor baytları.
  Kalıcı kontrol: `Worker Faz 1: varyant havuzundaki klipler gercekten farkli
  animasyon verisi tasir` — sidecar'daki **her** varyant havuzunu gezer, yani
  ileride eklenen bir varyant da kendiliğinden kapsanır. Bu bir tuning değil
  sözleşme: birbirinin aynısı iki klipten oluşan havuz, bellek harcayıp tek poz
  gösterir ve hiçbir belirti vermez.

### 3.2 Mevcut runtime bağlantısı

- [x] `BP_RTS_Worker.actor.json` ve `BP_RTS_Enemy_Worker.actor.json` `worker`
  assetini kullanıyor; ikisi de `selectionRadius: 0.43` koruyor.
- [x] Düşman Actor'u yalnız kumaş slotunu (`m-worker-cloth-material-copy`)
  override ediyor; asset varsayılanı değiştirilmiyor.
- [x] `worker.skeleton.json` §0.2'deki 14 semantic rolü, 4 varyant havuzunu,
  3 soketi, `work` montage'ını ve 5 root-motion satırını authorlıyor.
- [x] Runtime selector `work`, `workCultivation`, `workHarvest`, `workLivestock`,
  `workHunting`, `workChopping`, `carryIdle`, `carryWalk`, `attack`,
  `attackHunting`, `attackMelee`, `hit`, `death` rollerini destekliyor
  (`src/game/rts/units/rtsUnitAnimation.ts`).
- [x] **`workHarvest` ve `workLivestock` runtime'da var ama sidecar'da yok.** İkisi
  de `work` fallback'ine düşüyor. Eksik olan kod değil, klip bağlaması ve gerçek
  gameplay state'i (§9.3).
- [x] Oyuncu/AI Worker materyal ayrımı mavi/kırmızı kumaş texture'ıyla yapıldı.

### 3.3 Root-motion başlangıç durumu (2026-08-16 ölçümü)

Hips translation track'i santimetre biriminde okunup metreye çevrildi. `lockXYZ`
kökün üç bileşenini de klibin ilk karesine sabitler (`engine/render-three/rootMotion.ts`).

| Klip | Net XZ ilerleme | Dikey salınım | Kilit |
| --- | ---: | ---: | --- |
| `Walk_Loop` | 0,000 m | 5,6 cm | `lockXYZ` |
| `Sprint_Loop` | 0,000 m | 14,6 cm | `lockXYZ` |
| `Farming_holding_walk` | 1,598 m | 5,8 cm | `lockXYZ` |
| `Farming_wheelbarrow_walk` | 1,570 m | 8,9 cm | `lockXYZ` |
| `Fixing_Kneeling` | 0,000 m | 52,5 cm | `lockXYZ` |
| `Death` | 0,485 m | 87,1 cm | kilitsiz |
| `Farming_holding_turn_left` / `_right` | 0,298 / 0,205 m | ~1,7 cm | kilitsiz |
| `Farming_box_turn_left` / `_right` | 0,184 / 0,136 m | ~1,1 cm | kilitsiz |

Bundan çıkan işlerin tamamı kapandı:

- [x] `Walk_Loop` ve `Sprint_Loop` **zaten yerinde kliplerdir**; eski pakette
  gerekçe olan "1,69 m / 3,01 m ham ilerleme" yeni pakette yoktur. Buradaki
  `lockXYZ` artık yalnız yürüyüş/koşu dikey salınımını siliyor. **Karar
  (2026-08-17): `lockXYZ` kalıyor, salınımsız yürüyüş kabul edildi (§7.2).**
- [x] `Fixing_Kneeling` diz çökerken kalçayı 52,5 cm indiriyor. **Çözüldü ve
  kabul edildi (2026-08-17):** `lockXYZ` → `lockXZ`, havada diz çökme bitti (§8).
- [x] `Death` klibi 0,485 m ilerliyor ve kilitli **bırakıldı (karar 2026-08-18)**.
  Gameplay tarafı zaten pinli: root-motion hiçbir yoldan birim konumuna,
  rotasyonuna veya varış kararına yazmaz (`Worker Faz 1`, §6.2), yani düşen
  Worker'ın gameplay kökü yerinde durur. Geriye kalan yarım metre, düşüşün
  gövdeyi öne taşıması — kilitlemek ölümü yerinde çökmeye çevirirdi. Dünyada
  kayma gibi okunursa tek satırlık `lockXZ` düzeltmesi var (§17).
- [x] Dönüş klipleri (`box_turn_*`, `holding_turn_*`) 0,14–0,30 m taşıyor.
  **Karar (2026-08-18): bağlanmıyorlar** (§10.2 / §11.3), dolayısıyla kilit
  kararına gerek kalmadı. Bağlanmaları gündeme gelirse bu ölçüm burada duruyor.

## 4. Animasyon Kataloğu — 51 Klip

### 4.1 Runtime'a bağlı klipler (19)

§0.2 tablosundaki 19 klip. Bunların dışındaki hiçbir klip bugün oynatılmıyor.

### 4.2 Bağlanmayı bekleyen tarım/hasat ailesi (9)

| Klip | Süre (s) | Not |
| --- | ---: | --- |
| `Farm_Harvest` | 2,567 | Kısa, döngüye uygun hasat; `workHarvest` için ilk aday |
| `Farm_PlantSeed` | 2,833 | `Farming_dig_and_plant_seeds`'in kısa alternatifi |
| `Farm_Watering` | 3,867 | `Farming_watering`'in kısa alternatifi |
| `Farming_pick_fruit_1/2/3` | 8,033 / 6,167 / 7,133 | Meyve toplama; uzun |
| `Farming_pull_plant_1/2` | 4,700 / 4,767 | Ürün söküm |
| `Farming_plant_tree` | 9,133 | Ağaç dikimi; RTS'de karşılığı yok |

Bu ailenin tamamı gerçek bir **ürün hasadı gameplay state'i** olmadığı için
bağlanmadı. Odun, maden, altın ve av işleri bu klipleri semantik olarak
doğrulamaz.

### 4.3 Bağlanmayı bekleyen taşıma ailesi (8)

| Klip | Süre (s) | Faz |
| --- | ---: | --- |
| `Farming_box_turn_left` / `_right` | 1,567 / 1,167 | Faz 4; root kilidi kararı gerekli |
| `Farming_holding_idle` | 5,900 | Bugün `idle` varyantı; taşıma rolünde değil |
| `Farming_holding_turn_left` / `_right` | 1,067 / 1,067 | Faz 4; root kilidi kararı gerekli |
| `Farming_wheelbarrow_idle` | 1,433 | Faz 4; el arabası prop'u yok |
| `Farming_wheelbarrow_walk` | 1,000 | Kilitli ama bağlı değil; tek walk klibi (eski `walk_1/2` yok) |
| `Farming_wheelbarrow_dump` | 6,267 | Faz 4; gerçek boşaltma olayı yok |
| `Farming_kneeling_idle` | 4,300 | Nötr diz çökme pozu; `Fixing_Kneeling` tercih edildiği için boşta |

### 4.4 RTS Worker'ında karşılığı olmayan genel karakter klipleri (15)

`Chest_Open`, `Consume`, `Crouch_Fwd_Loop`, `Crouch_Idle_Loop`,
`Interact`, `Jog_Fwd_Loop`, `LayToIdle`, `PickUp_Table`, `Push_Loop`, `Roll`,
`Sitting_Enter`, `Sitting_Exit`, `Sitting_Idle_Loop`, `Sitting_Talking_Loop`.

(`Idle_Torch_Loop` bu listeden 2026-08-17'de çıktı: `combatIdle` rolüne bağlandı,
§11.1B. Pakette gerçek bir dövüş duruşu klibi yok; kol yukarıda tutan bu poz en
yakın aday olarak seçildi ve kullanıcı onayı bekliyor.)

Bunlar asset içeriği olarak kalır, runtime havuzuna girmez. Tek istisna adayı:
`Jog_Fwd_Loop` (1,000 s), `Walk_Loop` ile `Sprint_Loop` arasında ara bir yürüyüş
kademesi gerekirse değerlendirilebilir — bugün böyle bir gameplay hız bandı yok.

### 4.5 Yeni pakette **olmayan** ve bu yüzden iptal edilen hedefler

- **`Worker_cow_milking` yok.** Sağım animasyonu artık asset'te bulunmuyor; §9.3
  bu yüzden yeniden yazıldı.
- **Genel strafe/turn klibi yok.** Eski `left_strafe`, `right_turn`,
  `right_turn_90` gitti; yeni pakette yalnız taşıma durumuna özel dönüşler var.
  §11.3 buna göre daraltıldı.
- **`T-Pose` yok.** "T-Pose runtime rolüne girmez" kontrolü artık boş küme
  üzerinde çalışıyor; koruyucu olarak kalabilir.

## 5. Sabit Tasarım Kararları

### K-01 — Uygulama sırası

1. Actor bağlantısı ve temel locomotion,
2. locomotion dünya içi kabulü,
3. güvenli nötr çalışma pozu,
4. işe göre Worker aktivite sözleşmesi ve iş animasyonları,
5. prop/soket bağlantıları,
6. eksik savaş/ölüm, turn ve materyal kararları,
7. notify/VFX/SFX,
8. performans ve nihai teslim.

Bir fazın görsel kabul kapısı kapanmadan onu temel alan sonraki faza geçilmez.

### K-02 — Sidecar semantiği, gameplay gerçeğini izler

Klip adları runtime koduna dağılmaz. Birincil roller, varyantlar, root-motion,
socket, montage ve notify verileri `worker.skeleton.json` içinde tutulur. Ancak
"hangi işi yapıyor" bilgisi sidecar'da tahmin edilmez; gerçek Worker atama
sisteminden sunuma aktarılır.

### K-03 — İş çeşitliliği kare başına rastgele seçilmez

Bir Worker aynı işin ortasında her döngüde ilgisiz başka bir harekete geçmez.
Varyant seçimi birim kimliği, aktivite türü ve iş başlangıç/iş çevrimi sayacıyla
deterministik yapılır. Aktivite değişmeden seçimin kararlı kalması tercih edilir.

### K-04 — İnşaat için yanlış araç hareketi kullanılmaz

`Fixing_Kneeling`, construction, repair ve mining için kabul edilen iş klibidir.
Tarım klipleri bu rollere bağlanmaz. Klip başlangıç/loop/bitiş bir arada olduğu
için sidecar montage'i yalnız bir kez diz çöker (0–0,7 s), iş sürerken orta
pencereyi loop'lar (0,7–4,033 s) ve `working` bittiğinde yalnız bir kez kalkar
(4,033–5,267 s).

### K-05 — Prop görünürlüğü ve animasyon birlikte değişir

Kutu, yük ve el arabası için animasyon seçimi ile prop görünürlüğü aynı
presentation state'inden beslenir. Animasyon değişip prop bir kare geriden gelmez;
uzak animasyon throttle'ı prop görünürlüğünü geciktirmez.

### K-06 — Bir rolün runtime desteği, o rolün bağlanabilir olduğu anlamına gelmez

`workHarvest` ve `workLivestock` selector'da mevcut ve `work`'e düşüyor. Bu roller
ancak simülasyonda gerçek bir hasat/hayvan işi ataması doğduğunda sidecar'a
bağlanır; klip var diye state uydurulmaz.

## 6. Faz 1 — Actor Bağlantısı ve Temel Locomotion

**Durum:** ✅ Tamamlandı — kullanıcı dünya içi locomotion kabulü: 2026-08-13,
yeni `worker.glb` paketiyle yeniden bağlandı: 2026-08-15.

### 6.1 Actor ve materyal bağlantısı

- [x] İki Actor'ın skeletal mesh `assetId` değeri `worker`.
- [x] Asset varsayılan materyal slotları (`face`, `cloth`) doğrulandı; oyuncu
  Actor'u override kullanmaz.
- [x] `selectionRadius: 0.43` gameplay sözleşmesi korundu.
- [x] Model yönü, ölçeği ve zemin oturuşu dünya içi locomotion kabulünde doğrulandı.

### 6.2 Birincil semantic roller

| RTS rolü | Klip | Süre | Durum |
| --- | --- | ---: | --- |
| `idle` | `Idle_FoldArms_Loop` | 2,567 s | ✅ |
| `walk` | `Walk_Loop` | 1,400 s | ✅ |
| `run` | `Sprint_Loop` | 0,733 s | ✅ |

- [x] Üç temel rol `worker.skeleton.json.animationSet` içinde.
- [x] Bu fazda kutu, holding, wheelbarrow veya turn klipleri genel locomotion
  varyantlarına eklenmedi.
- [x] Worker `moveSpeed: 6` ile walk/run eşikleri ve playback rate test edildi
  (`rtsPlaybackRate("run", 6) === 1`).
- [x] Animasyonun birim konumu, rotası veya varış kararını değiştirmediği pinlendi.

### 6.3 Otomasyon

- [x] `Worker Faz 1` kontrolü: manifest yolu, iki Actor, materyal slotları,
  sidecar rolleri, GLB'de klip varlığı, root-motion kilitleri ve selector çıktısı.
- [x] `T-Pose` hiçbir runtime rolüne girmiyor (yeni pakette klip zaten yok).
- [x] `npx.cmd tsc --noEmit` ve `npm.cmd run test:engine -- --filter "Worker Faz 1"`.

## 7. Faz 1A — Locomotion Dünya İçi Görsel Kabulü

**Durum:** ✅ **Yeni paketin kullanıcı kabulü: 2026-08-17** (kabul turu 1. durak).

### 7.1 Kabul ortamı

- [x] Kabul turu canlı dev sunucusunda, normal `?rts&mode=free` maçında yapıldı;
  ayrı bir Worker preseti gerekmedi.
- [x] **Worker kabul preseti Faz 7'ye taşındı (karar 2026-08-18).** Kabul turu üç
  kez presetsiz yürüdü; presetin tek gerçek müşterisi §13.1'in 8+8/16+16/22+22
  ölçümü ve orada zaten gerekli. Faz 1A'yı bekletmesi için sebep yok.
- [x] **Placeholder/console error kapısı otomasyona bağlandı.** Bunu browser
  smoke'a taşımaya gerek kalmadı: placeholder'ın *sessiz* olduğu hal — sidecar
  404'ü yüzünden soketsiz iskelete düşüp kapsüle dönme — 2026-08-17'de yaşandı ve
  iki kontrolle kapatıldı (`Skeletal sidecar: …harfi harfine…` + `rtsActorVisualFactory`
  artık hangi bileşenin neden bağlanamadığını yazıyor). Geriye kalan "gözle bak"
  kısmı §17'de.

### 7.2 Kullanıcı görsel kontrolü

- [x] Kısa hedefte yürüyüşe başlama ve duruşa dönüş.
- [x] Uzun hedefte koşu döngüsü ve playback hızı.
- [x] Ayak kayması: kabul edildi.
- [x] Keskin yön değişiminde root drift / gameplay kökünden ayrılma: yok.
- [x] Idle havuzunun (`Idle_FoldArms_Loop`, `Idle_Loop`) tekrarında sıçrama yok.
- [x] **Karar:** yürüyüş/koşu dikey salınımının `lockXYZ` ile silinmiş olması
  kabul edildi (2026-08-17). `lockXZ`'ye dönülmeyecek.
- [x] Eski paket locomotion kabulü kaydedildi: 2026-08-13 (`çalışıyor, devam et`).

**Çıkış kapısı:** ✅ Kapandı — sonraki fazların görsel kapıları artık açılabilir.

## 8. Faz 2 — Güvenli Nötr Çalışma Sunumu

**Durum:** ✅ **Tamamlandı** — sözleşme, `Fixing_Kneeling` montage'ı ve dünya içi
görsel kabul (2026-08-17, kabul turu 2. durak).

- [x] Genel `work` fallback'i tek ve stabil bir klibe bağlı.
- [x] İnşaat ve onarım artık ayakta nötr idle'a değil, `Fixing_Kneeling`
  montage'ına gider (K-04); bu, eski "diz çökme yanıltıcı" kararının bilinçli
  revizyonudur — yeni klip alet kullanan bir onarım pozudur.
- [x] `working` false olduğunda idle'a güvenli dönüş otomasyonla doğrulandı.
- [x] İşe yürürken `work` klibinin locomotion'dan önce başlamadığı test edildi.
- [x] İş bittiği veya Worker serbest bırakıldığı karede pozun temizlendiği inşaat,
  maden ve ekonomi çıkış testleriyle doğrulandı.
- [x] Kullanıcı görsel kabulü (eski klip): 2026-08-13.
- [x] **Havada diz çökme düzeltildi ve kabul edildi (2026-08-17).** Kullanıcı dünyada Worker'ın
  zeminin üstünde asılı diz çöktüğünü gördü; sebebi §3.3'ün önceden işaret ettiği
  şeydi: `lockXYZ` klibin 52,5 cm'lik kalça inişini de pinliyordu, yani gövde
  çömelirken kalça ayakta kalıyordu. `Fixing_Kneeling` artık `lockXZ` — yatay
  kayma hâlâ kilitli, dikey iniş oynuyor.
- [x] Montage'ın enter → loop → exit geçişi dünya içinde kabul edildi (2026-08-17).
- [x] `Farming_kneeling_idle` kullanılmayacak; `Fixing_Kneeling` kabul gördü.
  Klip yedek nötr poz adayı olarak assette duruyor.

## 9. Faz 3 — İşe Göre Aktivite Sözleşmesi ve Animasyonlar

**Durum:** ✅ **Kapandı (2026-08-18).** Aktivite sözleşmesi ve cultivation
uygulandı; hasat ve hayvancılık **kapsam dışı kararıyla** kapatıldı (§9.3).

### 9.1 Aktivite veri sözleşmesi

- [x] `RtsPresentationUpdate` için gameplay kararlarından türetilen, yalnız okunur
  `workerActivity` sözleşmesi eklendi.
- [x] Kategori kümesi: `generic`, `construction`, `repair`, `cultivation`,
  `harvest`, `livestock`, `mining`, `lumber`, `hunting`, `carryingBox`,
  `carryingLoad`, `wheelbarrow`.
- [x] `Unit` içinde bu durumun yalnız sunum amaçlı olduğu belgelendi.
- [x] `WorkerConstructionSystem`, `EconomyProductionSystem` ve `PastureSystem`
  yalnız sahip oldukları gerçek atama bilgisini bildirir; renderer bina/resource
  kimliğinden iş tahmini yapmaz.
- [x] İş bırakma, iş değişimi, bina kaybı, kaynak tükenmesi ve Worker ölümü dahil
  bütün çıkış yollarında aktivite temizlenir.
- [x] Construction, repair ve mining `work` rolünü paylaşır; lumber ayrı
  `workChopping`, av ayrı `workHunting` rolüne gider.

### 9.2 Tarım eşlemeleri

- [x] `cultivation` ana klibi `Farming_dig_and_plant_seeds`; dünya içi görsel
  kabul: 2026-08-13 (eski paketin aynı adlı klibiyle).
- [x] `Farming_plant_a_plant` ve `Farming_watering` yalnız cultivation'ın
  deterministik varyant havuzunda.
- [x] Uzun cultivation kliplerinin iş süresi değiştiğinde kesilmesi gameplay'i
  değiştirmez; seçim yalnız `working` ve sunumsal activity okur.
- [x] İş animasyonunun kaynak miktarı veya üretim tick'ini değiştirmediği hedefli
  selector ve ekonomi testleriyle doğrulandı.
- [ ] Yeni paketin cultivation kliplerinin dünya içi kabulü tekrarlanmadı — §17'ye
  taşındı. Klip adları eski paketle birebir aynı olduğu için bağlama değişmedi;
  bakılacak olan yalnız yeni rigin aynı hareketi nasıl gösterdiği.
- [x] **Kısa alternatifler kapsam dışı (karar 2026-08-18).** `Farm_PlantSeed`
  (2,833 s) ve `Farm_Watering` (3,867 s), uzun kliplerin kısaltılmış hâli;
  cultivation sürekli loop olduğu için okunurluk farkı ancak kesilme anında
  ortaya çıkar ve kesilme zaten gameplay'e bağlı değil (§9.2). Uzun klipler
  kabul görmüş durumda; kısa çift assette yedek olarak duruyor.

### 9.3 Hasat ve hayvancılık — asset değişimiyle yeniden yazıldı

Yeni pakette **sağım klibi yoktur**; eski `Worker_cow_milking` gitti. Buna karşılık
`workHarvest` ve `workLivestock` rolleri runtime'da hazır ve `Farm_Harvest`,
`Farming_pick_fruit_*`, `Farming_pull_plant_*` klipleri assette duruyor.

**Karar (kullanıcı, 2026-08-18): ikisi de kapsam dışı, belgelenerek kapatıldı.**
§15'in teslim kapısı bu iki çıkıştan birini zaten kabul ediyor ("ya state
uygulanmış ya da kapsam dışı kararı belgelenmiş"); seçilen ikincisi.

- [x] **`workHarvest` bağlanmıyor.** Ürün hasadı için gerçek bir gameplay ataması
  yok ve bu plan onu tasarlamıyor: yeni bir bina/kaynak/Worker döngüsü demek,
  yani Faz 6'dan büyük ayrı bir ekonomi işi. K-06 gereği klip var diye state
  uydurulmadı; rol runtime'da duruyor ve `work` fallback'inde kalıyor.
- [x] **`workLivestock` bağlanmıyor.** Mevcut `livestock` state'i hayvan
  sakinleştirme/sürmedir, Ağıl geliri penned hayvanlardan Worker olmadan üretilir
  ve pakette sağım klibi yok. Sakinleştirme `work` fallback'inde kalır.
- [x] Sağım istenirse bu bir **asset işidir** (klip üretimi + inek hizası), plan
  işi değil. Bu satır o işin giriş noktası olarak duruyor.
- [x] Uygun klip yokken hiçbir rol yanıltıcı klip ile doldurulmadı; nötr fallback
  korundu. Beş klip (`Farm_Harvest`, `pick_fruit_1/2/3`, `pull_plant_1/2`)
  assette bağlanmadan duruyor — boşa giden maliyet değil, hasat işi gündeme
  gelirse hazır bekleyen havuz.

### 9.4 Deterministik çeşitlilik

- [x] Cultivation klipleri sürekli loop olduğu için ayrı sunumsal sequence sayacı
  gerekmedi; seçici birim kimliği + semantic rolle sabit seçim yapar.
- [x] Aynı Worker ve aynı aktivitede seçimin kararlı olduğu test edildi.
- [x] Farklı Worker seed'lerinin havuzda çeşitlilik gösterdiği doğrulandı.
- [x] Aktivite değişmeden her loop'ta ilgisiz klibe sıçrama olmadığı test edildi.
- [x] Yeniden oluşturulan presentation aynı salt-okunur snapshot'tan aynı seçimi
  üretir ve `workerActivity`/`working` gameplay state'ine yazmaz.

**Çıkış kapısı:** ✅ Kapandı (2026-08-18) — tarım kabul edildi, hasat ve
hayvancılık için kapsam dışı kararı belgelendi.

## 10. Faz 4 — Prop, Soket ve Taşıma Animasyonları

**Durum:** ✅ **Kapandı (2026-08-18).** Crate taşıma iki Actor'da da bağlı, poz
ailesi karara bağlandı, soket hizası dünya içinde kabul edildi (2026-08-17),
**eşek barrel devri kaldırıldı (§10.2A, kullanıcı kararı)** ve el arabası kapsam
dışı bırakıldı (§10.4).

### 10.1 Soket sözleşmesi

- [x] `right-hand-tool` (`RightHand`) ve `throw-release` (`RightHand`) soketleri
  authorlandı; balta ve taş bunları kullanıyor.
- [x] İki elle tutulan Crate için gövde-stabil `carry-box` soketi `Hips` üzerinde
  authorlandı; offset'i editörden pozlanıyor (son tur 2026-08-18).
- [x] **`LeftHand` soketi açılmadı (karar 2026-08-18).** Bugün tek elle bağlanan
  hiçbir prop yok: balta sağ elde, taş sağ elde, crate gövdede (`carry-box`). Kullanılmayan soket, sidecar'da doğrulaması olmayan ölü veridir;
  ihtiyaç doğduğunda tek satır authoring işi.
- [x] **Prop kesişmesi kabul turunda doğrulandı (2026-08-17).** Crate ve balta iki
  Actor'da da izlendi; `carry-box` hizası ve baltanın el hizası kabul edildi.
  `turn` klipleri bu maddenin kapsamında değil çünkü hiçbiri bağlanmıyor (§11.3).
  Soket 2026-08-18'de editörde yeniden pozlandı; yeni hizanın kabulü §17'de.

### 10.2 Kutu taşıma

- [x] `Crate.gltf` pivotu tabanda, ham boyut ~9×17×9 cm. Ölçek 2026-08-18'de
  büyütüldü (4× → önce 6,4×, ardından kullanıcı editörde **5×**'te karar kıldı) ve
  `carry-box` soketi editörde yeniden pozlandı. Ölçek de soket transformu da
  authored görünüş, sözleşme değil: kontroller artık sayıyı değil **iki Worker'ın
  aynı ölçeği taşıdığını**, ölçeğin pozitif/tekdüze olduğunu ve soketin `Hips`
  üzerinde durup kaydı atlatmadığını pinliyor — eski `[4, 4, 4]` ve
  `position: [0, 0.03, 0.24]` assert'leri tam da bu authoring turunda kırıldı.
- [x] `carryIdle` = `Farming_holding_idle`, `carryWalk` = `Farming_holding_walk`;
  görünürlük Crate ile aynı `loaded` state'inden besleniyor.
- [x] **AI Worker'da Crate eklendi (2026-08-17).** `BP_RTS_Enemy_Worker.actor.json`
  artık oyuncu Actor'undaki `carriedCrate` bileşenini birebir taşıyor (`crate`,
  aynı ölçek, `rtsCargoVisibility: "loaded"`, `carry-box` soketi); `Worker Faz 4`
  kontrolü iki Actor'u birden pinliyor.
- [x] **Kullanıcı kararı (2026-08-17), iki adımda:** önce holding çiftine geçildi
  (`Farming_box_walk` klibi olmadığı için kutu idle'ı ↔ elde yürüyüş sıçraması
  kabul edilmemişti). Ardından kullanıcı dünyada bakıp asıl çözümü istedi:
  **katmanlı blend.** Artık `carryPose` = `Farming_box_idle` yalnız üst gövdede
  tutuluyor, bacaklar normal `walk`/`run`/`idle` oynuyor. Poz sıçraması sorunu
  ortadan kalktı, çünkü ortada tek bir taşıma klibi kalmadı: gövde yükü tutuyor,
  bacaklar birimin gerçek hızıyla yürüyor. Holding çifti katmansız yedek olarak
  duruyor (üst gövde kemiği veya `carryPose` authorlamayan asset'ler için).
- [x] **Crate'in `carry-box` hizası dünya içinde kabul edildi (2026-08-17),
  iki tarafta da** — oyuncu ve AI Worker'ı aynı turda izlendi; katmanlı blend
  (üst gövde yükü tutuyor, bacaklar birimin gerçek hızıyla yürüyor) kabul edildi.
- [x] **Prop kaybolması ile animasyon dönüşü aynı karede — test edildi
  (2026-08-18).** Sözleşme yapısal: tek bir `carrying` boolean'ı hem cargo
  düğümlerine hem selector'a gidiyor, arada birini bir kare geciktirebilecek
  hiçbir şey yok (K-05). Kontrol bunu iki tarafından da okuyor: yükün bırakıldığı
  karede crate zaten görünmez **ve** aynı kare taşıma pozundan çıkmış oluyor
  (`Worker Faz 4: kaynak donusu…`).
- [x] **Dönüş klipleri bağlanmıyor (karar 2026-08-18).** `Farming_box_turn_*` ve
  `Farming_holding_turn_*` bağlanmadığı için root kilidi kararına gerek kalmadı.
  Gerekçe §11.3 ile aynı: bu klipler taşıma durumuna özel dört dönüştür, genel
  bir yön değiştirme sunumu kurmaya yetmezler ve tek başlarına bağlanınca
  simülasyonun yönelimiyle çakışma riski taşırlar (0,14–0,30 m root taşıması).

### 10.2A Eşek barrel yükleme — **KALDIRILDI (2026-08-18)**

**Kullanıcı kararı:** mekanik tamamen sökülsün. Uzakta kamp kurup bekleyerek
denendi ve fıçı yine görünmedi; kullanıcı bunun peşine daha fazla düşmek yerine
özelliğin kalkmasını istedi.

Neden ısrar edilmedi — özelliğin bilançosu baştan kötüydü ve ölçüldü: fıçı
penceresi sevkiyat başına `loadSeconds` = **2 saniye**, sevkiyat aralığı tam
kadrolu bir üreticide **~1 dakika**. Yani en iyi ihtimalle oyun süresinin %3'ü,
ve yalnız merkeze 8 birimden uzak (`autoConnect.maxCells × cellSize`), yolla
bağlı üreticilerde — yakın üreticiler zaten `transport: "direct"`, hiç eşek
görmüyor. Görünürlüğü bu kadar düşük bir sunum için taşınan yük yüksekti: iki
sistemin senkronize ettiği bir presentation state, ayrı bir tick sırası
sözleşmesi, cargo düğümlerinde bir activity filtresi ve iki Actor'da ikinci bir
prop.

**Sökülenler:**
- `EconomyProductionSystem.applyCaravanLoadPresentation` / `pickLoadBearer` /
  `loadBearers` / `isCaravanLoadingAt` ctor parametresi.
- `RtsApp`'teki çağrı ve `caravans.isLoadingOn(producerLaneId(...))` kablolaması.
- `Caravan.loadingActive`, `CaravanSystem.isLoadingOn`, `caravanLoadBearer` /
  `CaravanLoadBearer`. `isCaravanCarrying` artık doğrudan evreden cevap veriyor
  (`outbound || unloading`) — eşeğin **kendi** pannier'ları aynen duruyor.
- `rtsCargoVisual.ts`'teki activity filtresi tümüyle: `rtsCargoActivity` prop'u,
  `readRtsCargoActivity`, `CARGO_ACTIVITIES`, `RtsCargoVisualDef.activity`,
  `applyRtsCargoVisibility`'nin üçüncü parametresi. Tek yükü olan bir taşıyıcıya
  filtre gerekmiyordu; filtre yalnız §10.2A için vardı.
- `WorkerActivity`'den `carryingLoad`.
- İki Worker Actor'undan `carriedBarrel` bileşeni ve crate'in üzerindeki
  `rtsCargoActivity`.
- Kontroller: `Worker Faz 4A` (devir) ve bu oturumda eklenen kapsam kontrolü.

**Duran:** eşeğin kendi fıçıları (`BP_RTS_Donkey` pannier'ları, `rtsCargoSway`),
üreticiden merkeze kervan lojistiğinin tamamı, işçinin kendi crate'i. Yani
ekranda değişen tek şey, işçinin elinde 2 saniyeliğine beliren fıçının artık hiç
belirmemesi.

### 10.3 Genel elde taşıma

- [x] `Farming_holding_walk` `carryWalk` rolünde kullanılıyor.
- [x] **Kullanıcı kararı (2026-08-17): `Farming_holding_idle` taşıma rolüne ait.**
  `idle` varyant havuzundan çıkarıldı; boş elli Worker artık "elinde bir şey
  tutuyor" pozunu oynayamaz. Havuz `Idle_FoldArms_Loop` + `Idle_Loop` olarak kaldı.
  `Worker Faz 1` kontrolü bunu ilişki olarak pinliyor: idle havuzu hiçbir taşıma
  klibini içeremez (klip adı sabitlemeden).
- [x] **Yük yokken holding klipleri seçilemiyor — test edildi (2026-08-18).**
  Tek bir hızda değil, boş elli bir işçinin girebileceği her durumda: altı hız
  (0 → 12 birim/s) × işte olma/olmama. Korunan hata, elinde olmayan bir sandığı
  taşıyor gibi yürüyen işçi.
- [x] **Depoya bırakma karesi doğrulandı (2026-08-18).** Aynı kontrolün son
  bölümü: yükün bırakıldığı karede crate görünmez ve gövde taşıma pozunu terk
  etmiş oluyor — ikisi de tek `carrying` snapshot'ından.

### 10.4 El arabası

Yeni pakette üç klip var: `Farming_wheelbarrow_idle` (1,433 s),
`Farming_wheelbarrow_walk` (1,000 s, `lockXYZ` ile kilitli ama role bağlı değil),
`Farming_wheelbarrow_dump` (6,267 s). Eski plandaki `walk_1/2` ve dönüş klipleri
**yok**; tek yürüyüş klibi var.

**Karar (2026-08-18): el arabası kapsam dışı, backlog'a alındı.** İki bağımsız
gerekçe var ve ikisi de kendi başına yeterli:

1. **Prop yok.** Projede wheelbarrow asseti bulunmuyor. Değişmez kural gereği
   (§2) prop gerektiren klip görünür prop olmadan runtime havuzuna alınmaz, yani
   asset üretilmeden bu klipler zaten bağlanamaz.
2. **Karşılığı olan gameplay yok.** `wheelbarrow` activity'si hiçbir sistem
   tarafından üretilmiyor ve K-06 gereği klip var diye state uydurulmuyor.
   "Uzak üreticinin yükü nasıl taşınır" sorusunun cevabı **eşek kervanı**; el
   arabası aynı soruya ikinci bir cevap olurdu. (§10.2A'nın işçi-eşek devir
   sunumu sonradan kaldırıldı, ama kervan lojistiğinin kendisi duruyor.)

- [x] Wheelbarrow asseti üretilmediği için klipler bağlanmadı.
- [x] `Farming_wheelbarrow_idle/walk/dump` assette bağlanmadan duruyor;
  `Farming_wheelbarrow_walk` sidecar'da `lockXYZ` kilidini koruyor, yani asset
  üretilirse kilit kararı hazır.
- [x] Boşaltma animasyonunun kaynak transferini etkilememesi kuralı, iş gündeme
  geldiğinde uygulanacak sözleşme olarak burada duruyor.

## 11. Faz 5 — Savaş Rolleri ve Takım Okunurluğu

**Durum:** ✅ **Kapandı (2026-08-18).** Odun/balta ve takım rengi kabul edildi
(2026-08-17), misilleme sunumu iki turda ölçülüp düzeltildi (§11.1A, §11.1B),
turn/strafe kapsam dışı kararı yazıldı (§11.3). Kalan tek şey kullanıcı gözü:
taşın doğru rakiple izlenmesi ve `combatIdle` klip onayı (§17).

### 11.1 Attack, hit ve death

- [x] Av kampında prey kaynak sistemi `hunting` bildirdiğinde `workHunting`
  rolüyle `Attack` çalışır; temas anında hayvan tek vuruşla düşer ve
  `attackHunting` olayı `Attack` klibini yalnız bir kez oynatır.
- [x] Ölü hayvandan et toplama `Fixing_Kneeling` montage'ına girer; Attack
  tekrarlanmaz.
- [x] Worker uzaktaki otomatik misilleme hedefini 1,25–6 birim bandında
  `OverhandThrow` ile vurur. `Rock.gltf` yalnız görsel uçuş izidir.
- [x] Hedef 1,25 birimin içindeyse `Punch_Jab` / `Punch_Cross` varyantı oynar.
- [x] Gerçek health impact sayacı `React_Chest` / `React_Head` varyantını, death
  state'i `Death` tek-atımını başlatır; ölüm tüm kanallardan önceliklidir.
- [x] `TreeChopping_Loop` yalnız lumber assignment'ının `workChopping` rolünde
  çalışır; `Axe.glb` iki Actor'da `right-hand-tool` soketinde yalnız bu
  activity'de görünür. **2026-08-17: balta dünyada görünmüyordu** — görünürlük
  mantığı doğruydu, prop §0.4'teki 0,01 ölçek hatası yüzünden birkaç milimetre
  çiziliyordu. Soket mount'u düzeltildi, `position` offset'i sıfırlandı.
- [x] **Balta ve odun kesme dünya içinde kabul edildi (2026-08-17):** balta
  görünür, boyu (~70 cm) doğru, yalnız lumber assignment'ında elde.
- [ ] Montage zaman pencereleri, Worker kalabalığı, taş elden çıkışı ve punch
  temaslarının dünya içi görsel kabulü — **§17'ye taşındı** (doğru rakiple).
- [x] `Death` klibinin kilitsiz root ilerlemesi **karara bağlandı (2026-08-18):**
  kilitsiz kalıyor, gameplay kökü zaten etkilenmiyor (§3.3). Gözle bakma §17'de.
- [x] **Taşın `throw-release` soketinden çıktığı koda bağlandı (2026-08-17,
  §11.1B):** `RtsApp` taşı `pendingThrows`'ta park ediyor ve notify anında **o
  anki soket konumundan** fırlatıyor. Görsel kabul §17'de.

### 11.1A Misilleme sunumu — 2026-08-17'de ölçüldü ve düzeltildi

Kabul turunun 5. durağında kullanıcı "taş atmıyor, yumruk atmıyor" dedi. Zincir
baştan sona headless koşturuldu; **ölü kod yolu yok**, iki authored karar
çarpışıyordu.

**Taş: bant, melee bir saldırganla yapısal olarak boş.** İşçi menzili 6, minimumu
1,25. Guard **melee ve menzili 1,2** — yani işçiyi döven Guard, işçinin atış
minimumunun *içinde* duruyor ve taş orada tanım gereği imkânsız; o mesafenin
cevabı zaten yumruk. Ölçüm: Archer'la (menzil 14) koşturulduğunda çalışıyor —
işçi 12 birimden vurulunca hedefe yürüyor, 6'ya kapatıyor ve ölene kadar **3 taş
atıyor** (t=6,40 s). Yani taşın tek gerçek sahnesi menzilli bir saldırgandır ve
kabul turu bunu yanlış rakiple denemişti.

- [ ] Taşı bir düşman **Archer**'ı işçinin üstüne salarak tekrar gözle (§17).
- [x] Guard'a karşı taş atılmaması bilinçli bant kararıdır; `minAttackRange`
  düşürülmeyecek.

**Yumruk: gameplay'de iniyordu, ekrana çıkmıyordu.** Guard yanında, işçinin
yaşadığı 5,6 saniyede gameplay **3 yumruk** indiriyor ama ekranda **1 tanesi**
başlıyordu (irkilme 5). Sebep `advanceRtsAction`'ın 2. kuralı: alınan darbe
yumruğu hem kesiyor hem yutuyor ("bir aksiyon gövdeyi tutarken gelen olaylar
kuyruğa alınmaz, düşürülür"). Guard 1,4 s'de bir vuruyor, `React_Chest` 0,8 s,
işçinin yumruk cooldown'ı 2 s → yumrukların çoğu bir irkilme penceresine düşüyordu.

- [x] **Kullanıcı kararı (2026-08-17): irkilmeye bekleme süresi.** Öncelik kuralı
  değişmedi — alınan darbe hâlâ salınımı keser — yalnız gövdenin ne *sıklıkta*
  kesilebileceği sınırlandı: `RTS_FLINCH_REFRACTORY_SECONDS`
  (`src/game/rts/units/rtsUnitAnimation.ts`). Ölçülen sonuç: Guard senaryosunda
  ekrandaki yumruk 1 → **2**, irkilme 5 → 3; Archer senaryosunda taş 2 → **3**,
  irkilme 5 → 3. Sunum-only: yutulan irkilme kuyruğa da alınmıyor, sayaçlar
  akmaya devam ediyor.
- [x] Değer (1,8 s) authored bir görünüştür, sözleşme değil. Yeni engine kontrolü
  (`RTS irkilme araligi: …`) yalnız ilişkiyi pinliyor — iki irkilme authored
  aradan yakın başlayamaz, dövülen birim kendi darbesini en az bir kez gösterir,
  ve süre geçtiğinde alınan darbe hâlâ salınımı keser. Bütün fixture süreleri
  sabitin kendisinden türetiliyor, böylece yeniden tuning yeşil kalıyor.
- [ ] Düzeltmenin dünya içi kabulü (dövülen işçi artık karşılık veriyor gibi
  okunuyor mu) — §17.

### 11.1B Misilleme sunumu, ikinci tur — 2026-08-17

Kullanıcı ikinci bakışta üç şey daha istedi; üçü de mevcut mekanizmaların
authorlanmamış olmasından kaynaklanıyordu.

**1. Yürürken atış ayak kaydırıyordu.** Katmanlı atış sistemi zaten vardı
(`layerAttackWhenMoving`, Archer bunu kullanıyor) ama Worker sidecar'ı opt-in
etmemişti; tam gövde `OverhandThrow` bacakları yerinde çiviliyor, simülasyon
gövdeyi kaydırmaya devam ediyordu.

- [x] `worker.skeleton.json` → `layerAttackWhenMoving: true`. Eşik zaten
  `planarSpeed > walkSpeed`, yani **hem yürüyüş hem koşu** kapsanıyor; duran
  atıcı tam gövdede kalıyor (kalça geri tepmesi korunuyor).
- [x] Yumruk kasten tam gövde kalıyor (`attackMelee` katmanlanmaz) — yakın
  dövüşte bacak da işin içinde.

**2. Taş elden çıkmıyordu.** Konum zaten doğruydu — `throw-release` soketi
`rtsActorVisualFactory`'de muzzle olarak bağlı. Sorun **zamanlamaydı**:
`launchShot` taşı atış klibinin **ilk karesinde** doğuruyordu, yani el hâlâ
başın arkasında kurulmuşken taş çoktan yola çıkmış oluyordu.

- [x] Bırakma anı GLB'den ölçüldü (RightHand FK, 120 Hz): el t=0,308–0,433
  bandında tepe hızda, **z ekseninde en ileri nokta t≈0,41 s** (z=1,07), sonra
  yavaşlayıp takip hareketine geçiyor. Notify oraya kondu:
  `{ name: "throw-release", clip: "OverhandThrow", time: 0.41 }`.
- [x] `RtsApp` artık taşı `pendingThrows`'ta park ediyor ve notify geldiğinde
  **o anki soket konumundan** fırlatıyor. Hasar zaten `unitCombat`'ta çözülmüş
  olduğu için bu tamamen sunumsal; kesilen bir atış (irkilme, ölüm, yürüme emri)
  taşı düşürüyor ve 3 s sonra temizleniyor — kol hareketi tamamlanmadıysa taş da
  atılmamıştır.
- [x] Notify adı iki dosyada anlaşmak zorunda olduğu için `RTS_THROW_RELEASE_NOTIFY`
  sabitinde adlandırıldı; sidecar'daki yazım hatası sessiz bir "taş hiç atılmıyor"
  olurdu.

**3. Dövüş arasında idle'a düşüyordu.** Kök neden `ROLE_FALLBACKS`'te:
`attack: ["idle"]` — yani sürekli kanal, dövüşen birimin altına **barış idle'ını**
koyuyordu. Yakın dövüşte ise durum daha da kötüydü: Guard 1,2 birimde duruyor,
işçinin atış minimumu 1,25, dolayısıyla `isTradingBlows()` (atış bandı) **false**
dönüyor ve birim "hiçbir şey olmuyor" olarak sınıflanıyordu.

- [x] Yeni semantic rol **`combatIdle`** (`ANIMATION_SET_ROLES` + saveValidator
  allowlist). `attack` ve `attackMelee` zincirleri artık `["combatIdle", "idle"]`.
- [x] Yeni sunum girdisi **`engagedClose`**: `Unit.isEngagedAtCloseQuarters()`,
  `kickRange`'i okuyor — yani duruşun kapsadığı bant, darbelerin gerçekten indiği
  bantla aynı ve ondan sapamaz. `isTradingBlows()`'a **katılmadı**: o soru
  "silahım ateş ediyor mu" ve topçunun minimumunun içinde false kalması gerekiyor
  (K-07).
- [x] Sınıflandırmada iş ile ayaklar arasına kondu: yakındaki düşman **işi geçer**
  (dövülen inşaatçı sitesine diz çökmeye dönmez) ama **yürüyüşü geçmez** (emirle
  gönderilen işçi gider).
- [x] Zincirde `hold` kasten yok. Guard bir `hold` klibi authorluyor ("tut" emri);
  zincire koysaydık her dövüşte o duruş görünür, emir de okunmaz hale gelirdi.
  Kontrol bunu ayrıca pinliyor: dövüşen Guard kendi idle'ında kalır.
- [ ] **Klip seçimi kullanıcı onayı bekliyor (§17):** `combatIdle` şu an
  `Idle_Torch_Loop` (bir kol yukarıda — hem "taş hazır" hem "tetikte" okunabilir).
  Pakette gerçek bir dövüş duruşu klibi yok; alternatifler `Crouch_Idle_Loop`
  (çömelmiş/siperde) ve `Farming_kneeling_idle`. Dünyada bakılıp karar verilecek.
  Sözleşme (rol zinciri, `engagedClose` bandı, `hold`un zincire girmemesi) klip
  seçiminden bağımsız ve pinli, yani karar tek satırlık sidecar düzenlemesi.

### 11.2 Oyuncu/AI materyal ayrımı — uygulandı

- [x] Asset iki materyal slotu taşıyor: `m-worker-face-material`,
  `m-worker-cloth-material`.
- [x] Oyuncu Worker'ı asset varsayılanını (mavi kumaş) kullanır; düşman Worker'ı
  yalnız slot 1'i `m-worker-cloth-material-copy` (kırmızı kumaş) ile override eder.
- [x] Mavi/kırmızı base-color mevcut UV atlasını korur; normal ve ORM paylaşılır.
- [x] `Worker Faz 1` kontrolü override listesini birebir pinliyor.
- [x] **Renk ayrımı normal RTS kamera mesafesinde kabul edildi (2026-08-17):**
  seçim halkasına bakmadan mavi/kırmızı okunuyor.
- [x] `M_Worker_Cloth_AI.material.json` `name` alanı `M_Worker_Cloth_AI` oldu
  (2026-08-17); manifest zaten bu adı taşıyordu, editördeki ad çakışması bitti.

### 11.3 Turn/strafe — **kapsam dışı (karar 2026-08-18)**

Yeni pakette genel strafe veya turn klibi yoktur (§4.5). Elde yalnız taşıma
durumuna özel dört dönüş klibi var.

- [x] **Genel yön değiştirme sunumu kapsam dışı bırakıldı.** Bu asset ile mümkün
  değil; yapılması yeni klip üretimi demek, yani asset işi. Worker bugün yönünü
  simülasyonun döndürdüğü gövdeyle değiştiriyor ve locomotion kabulünde ayak
  kayması ayrıca kabul edildi (§7.2) — yani ortada düzeltilmeyi bekleyen bir
  görsel şikâyet de yok.
- [x] **Taşıma dönüş klipleri bağlanmıyor** (§10.2), dolayısıyla simülasyon
  yönelimi ile animasyon root dönüşünün üst üste binmesi diye bir durum
  doğmuyor. Bağlanmaları gündeme gelirse kanıt yükümlülüğü bu satırda duruyor:
  0,14–0,30 m root taşıması var, önce kilit kararı gerekir.

## 12. Faz 6 — Notify, VFX ve SFX

**Durum:** 🟨 **İlk dilim uygulandı (2026-08-18).** İşaretler ölçülüp authorlandı,
iki yeni efekt bağlaması eklendi, üç kontrol yazıldı. Açık: ses (ayrı plan) ve
efektlerin dünya içi okunurluk kabulü.
**Amaç:** Kabul edilmiş hareketleri küçük, bütçeli sunum efektleriyle güçlendirmek.

### 12.1 Uygulanan dilim (2026-08-18)

Notify hattının kendisi Guard Faz 6'da kurulmuştu; Worker'ın eksiği **işaretlerin
kendisiydi**. Hepsi GLB'den FK ile ölçüldü (120 Hz), hiçbiri göz kararı değil:

| İşaret | Klip | Zaman (s) | Nasıl ölçüldü |
| --- | --- | ---: | --- |
| `footstep` | `Walk_Loop` | 0,642 / 1,308 | ayak bileğinin basış penceresi başlangıcı |
| `footstep` | `Sprint_Loop` | 0,358 / 0,675 | aynı |
| `footstep` | `Farming_holding_walk` | 0,375 / 1,067 | aynı (yüklü yürüyüş de bir locomotion klibi) |
| `body-impact` | `React_Chest` | 0,092 | göğsün geri tepmesinin yarısına ulaştığı an |
| `body-impact` | `React_Head` | 0,108 | aynı |
| `chop-impact` | `TreeChopping_Loop` | 0,300 | sağ elin salınım yayının dip noktası |
| `dig-impact` | `Farming_dig_and_plant_seeds` | 1,433 / 2,933 | sağ elin toprağa indiği iki kısa geçiş |
| `throw-release` | `OverhandThrow` | 0,410 | §11.1B'de ölçülmüştü |

- [x] Ayak teması zamanları `Walk_Loop` ve `Sprint_Loop`'tan ölçüldü.
- [x] Balta teması (`TreeChopping_Loop`) ve toprak kazma
  (`Farming_dig_and_plant_seeds`) authorlandı.
- [x] İşaretler sunumsal tüketicilere bağlandı: `footstep` ve `body-impact`
  Guard'ın zaten kurduğu bağlamaları kullanıyor; iki yeni bağlama eklendi —
  `chop-impact` → `rts-fx-debris-wood`, `dig-impact` → `rts-fx-footstep-dust`.
  İkincisi kasten aynı efekti paylaşıyor: kürek de bot da aynı tozu kaldırır ve
  "kürek" demek için ikinci bir toz efekti üretmek kimsenin istemediği bir iş
  olurdu. Ad yine de ayrı, çünkü **ad sözleşmedir** ve ses planı aynı akışa
  abone olacak. **Üçü de 2026-08-18'de geri alındı — bkz. §12.4.** İşaretler
  duruyor, kalkan yalnız çizim.
- [x] Notify hiçbir ekonomi miktarını veya iş tamamlanma anını belirlemiyor —
  K-02 zaten `Muhafiz Faz 6: notify tuketicisi simulasyonu … degistiremez` ile
  pinli, tüketici tarafı değişmedi.
- [x] Uzak animasyon cadence'inde atlama/çift atma, duraklatılmış kare ve yarıda
  kesilip yeniden başlayan klip: **Guard Faz 6'da genel olarak pinli**, Worker
  ayrı bir yol kullanmıyor.
- [x] Global hız limiti ve VFX bütçesi: `chop-impact` 0,08 s, `dig-impact` 0,1 s
  global aralıkla girdi. Bütçe **paylaşımlı** olduğu için Worker'ın ayak sesleri
  Guard'ınkiyle aynı havuzdan harcıyor — kap zaten tam bunun için global.
- [x] `RTS_THROW_RELEASE_NOTIFY` `rtsNotifyEffects.ts`'e taşındı ve dışa açıldı.
  Sabitin var oluş sebebi "iki dosya aynı adı yazsın"dı ama test adı literal
  yazıyordu, yani yeniden adlandırma sessizce geçerdi; artık üç taraf da tek
  sabiti okuyor.

**Yeni kontroller (üçü de `Worker Faz 6`):**

1. *her isaret gercek bir klibin icinde ve ait oldugu rolde durur* — klip adı,
   süre sınırı, rol eşlemesi (ayak sesi yalnız locomotion klibinde ve her klipte
   **iki** tane), ve her adın ya bir efekti ya da bir runtime tüketicisi olması.
2. *temas isaretleri, klibin kendi olculen temas penceresinin icinde durur* —
   **asıl değerli olan bu.** Yarım çevrim kaymış bir ayak sesi de ateşlenir,
   throttle'lanır, çizilir — ve havadaki ayağın altında toz gösterir. Bunu
   animasyon verisinden başka hiçbir şey yakalayamaz, o yüzden karşılaştırma
   hatırlanan bir sayıya değil klibin kendi geometrisine yapılıyor: testin içine
   küçük bir FK örnekleyici kondu. Sabit pinlenmiyor — "ayak kendi hareketinin
   alt üçte birinde", "iki adım çevrimin %35–50'si kadar aralıklı", "balta
   yayının dibinde" gibi ilişkiler pinleniyor, yani yeniden zamanlama serbest.
3. *gercek Worker sidecar'i yururken ayak isaretini gercekten atar* — uçtan uca.
   Fixture klip süreleri **modelden** alınıyor, çünkü bu kontrolün yakalamak için
   var olduğu hata tam olarak şu: 1,133 s'lik bir klipte 1,308 s'ye konmuş işaret
   doğrulanır, kaydedilir ve hiç ateşlenmez.

### 12.2 Ölçüm sonucu kapsam dışı bırakılanlar

Plan bunları "authorla" diye listeliyordu; ölçüm ikisinde de authorlanacak bir an
olmadığını gösterdi. Uydurmak yerine kaydedildi:

- **Sulama (`Farming_watering`) — temas yok.** Sağ el bütün klip boyunca
  94,3–108,6 cm bandında kalıyor; hareket bir *dökme*, yani kovanın eğilmesi.
  Notify hattı tek-atımlık işaretler için; dökülen su sürekli bir emitter ister
  ve projede su efekti de yok. İkisinden biri gelirse madde burada.
- **Onarım (`Fixing_Kneeling` loop penceresi) — ayrık darbe yok.** El 0,7–4,033 s
  arasında tek bir uzun alçak yay çiziyor, tepe hızı 249 cm/s ve hiçbir yerde
  durmuyor; yani "tık" diye okunacak bir temas anı animasyonda mevcut değil.
- **Dump — konusuz.** El arabası kapsam dışı (§10.4), boşaltma olayı yok.
- **Yumruk (`Punch_Jab`/`Punch_Cross`) — efekti yok.** Guard'ın `sword-swing`
  kararının aynısı: yakın dövüşün parçacığı yoktur, hattın çalıştığını kanıtlamak
  için parıltı uydurmak sanat üretmek olurdu.

### 12.3 Faz 6'dan kalan

`worker.skeleton.json.notifies` bugün **on iki** işaret taşıyor: `throw-release`
(§11.1B), altı `footstep`, iki `body-impact`, bir `chop-impact` ve iki
`dig-impact`. Sulama, onarım ve dump ölçüm sonucu kapsam dışıdır (§12.2), yani
authorlanacak işaret kalmadı. Çizim tarafı §12.4 ile daraldı; kalan iki madde
aşağıda.

- [x] Montage bölüm sınırlarında (0,7 s ve 4,033 s) çift atma **konusuz kaldı:**
  Worker montage klibinde (`Fixing_Kneeling`) hiç işaret authorlanmadı, çünkü
  ölçüm orada ayrık bir temas bulamadı (§12.2). Biri eklenirse sınırların
  kontrolü ilk iş olur; genel kural Guard tarafında zaten pinli.
- [ ] **Ses.** Bütün işaretler ses tüketicisi için hazır ve o iş bu planın değil,
  `docs/planned/THREEAGES_AUDIO_DESIGN_AND_PRODUCTION_PLAN.md`'nin konusu.
  `rtsNotifyEffects.ts` bunu zaten böyle belgeliyor: aynı akışa abone olunacak,
  ikinci bir hat kurulmayacak.
- [x] **Efektlerin dünya içi okunurluk kabulü (kullanıcı) — cevaplandı
  2026-08-18: hayır.** Kullanıcı çalışan maçta baktı; ayak tozu RTS kamerasının
  çalışma mesafesinde hiç seçilmiyordu, odun kıymığı da kanalın maliyetine
  değmiyordu. Üç bağlama kaldırıldı (§12.4). Geriye kalan tek birim efekti
  `body-impact` — kırmızı, tam opak, dövüşün okunur yarısı.

### 12.4 Toz ve kıymık bağlamalarının kaldırılması (2026-08-18)

Kullanıcı çalışan maçta bakıp tek cümleyle söyledi: efekt görünmüyor, zor
görülenleri kaldıralım. Doğruydu ve asset'ten okunabiliyordu —
`FX_RTS_Footstep_Dust` 8 sprite, `startOpacity 0,5`, toprak üstünde bej
`#b0a48f`, 0,45–0,7 s. RTS kamerasının mesafesinde bu, ince bir efekt değil,
okuyucusu olmayan bir kare maliyeti.

Kaldırılan **üç bağlama** (`RTS_NOTIFY_EFFECTS`):

| İşaret | Eski efekt | Etkilenen birimler |
| --- | --- | --- |
| `footstep` | `rts-fx-footstep-dust` | Guard, Archer, Worker, topçu ekibi |
| `dig-impact` | `rts-fx-footstep-dust` | Worker (tarım) |
| `chop-impact` | `rts-fx-debris-wood` | Worker (oduncu) |

Kalan: `body-impact` (kırmızı, tam opak, dövüş geri bildirimi) ve topçu enkazının
üçlüsü (`wreck-blast`/`-fire`/`-smoke`). `rts-fx-debris-wood` asset'i **silinmedi**;
bina çöküşü onu `rts-content.json` üzerinden hâlâ kullanıyor.

Üç karar bunu ucuz tutuyor:

- **İşaretler yerinde kaldı.** GLB'den FK ile ölçülmüş yirmiden fazla zaman
  damgası korundu; ses planı zaten aynı akışa abone olacak ve yeniden ölçmek işin
  pahalı yarısı. `arrow-release` ve `sword-swing` bunu zaten böyle yapıyordu, yani
  yeni bir desen değil — var olanın genişlemesi.
- **"Ses bekleyen ad" artık iddia ediliyor, sadece belgelenmiyor.** Yeni
  `RTS_NOTIFY_AUDIO_ONLY` (`rtsNotifyEffects.ts`) o adları sayıyor, ve üç kontrol
  her authored işaretin ya çizildiğini, ya runtime'da okunduğunu, ya da bu
  listede olduğunu doğruluyor. Sebep: bağlama kalkınca "efekti yok" ile "adı
  yanlış yazılmış" görsel olarak aynı şeye dönüşüyordu — hattın kendi başına
  bildiremediği tek hata bu.
- **Hız limiti kontrolü sabit ada bağlı değil.** Testler `footstep`'in kapağını
  ismen sürüyordu; artık tabloda `minIntervalSeconds > 0` olan **ilk** bağlamayı
  buluyor ve onu sürüyor, yani kapağın kendisi pinli kalıyor ama hangi efektin
  taşıdığı serbest.

`npx tsc --noEmit` temiz; `--filter "Faz 6,Worker,Archer,Siege crew,Muhafiz"`
94/94 yeşil.

## 13. Faz 7 — Performans, LOD ve Nihai Teslim

**Durum:** ✅ **Kapandı (2026-08-18).** §13.1'in yedi ölçüm maddesi de
cevaplandı, §13.2 "mesh kalitesini koru, LOD açma" ile kapandı, §13.3'ün tamamı
yeşil ve kullanıcı nihai dünya içi görünümü kabul etti.
**Gerekçe (2026-08-16'da yeniden ölçüldü):** Eski paketin 60.000 üçgenlik yükü
yok. Yeni Worker 18.201 üçgen ile Guard'ın (14.990) ~1,21 katı, Archer'ın
(20.926) ~0,87'si, Siege'in (14.660) ~1,24 katıdır — yani mevcut birim ailesinin
ortasında.

| Senaryo | Worker sayısı | Yalnız Worker gövdesi üçgen |
| --- | ---: | ---: |
| Başlangıç 8+8 | 16 | ~291.000 |
| Orta 16+16 | 32 | ~582.000 |
| Yoğun 22+22 | 44 | ~801.000 |

Eski plandaki 2,64 milyon üçgenlik risk tablosu geçersizdir; LOD bu yüzden artık
öncelikli bir gereklilik değil, ölçümle karar verilecek bir kapıdır.

**Üstteki üçgen tablosu da fazla kötümser çıktı (2026-08-18).** "Worker sayısı ×
18.201" her Worker'ın çizildiğini varsayıyor; ölçümde 44 Worker kareye
**406.758** üçgen ekledi, yani tablonun yaklaşık yarısı. Sebep frustum: iki kamp
haritanın iki ucunda, kamera birindeyken diğerinin ordusu görüntü dışında.
Çizilen bir Worker'ın maliyeti tam olarak GLB'nin sayısı — 18.201 — ama sahada
aynı anda ordunun yarısı çiziliyor.

### 13.1 Ölçüm

**Durum: ✅ tamam (2026-08-18).** İki araç yazıldı, ikisi de repoda:

- `npm run perf:worker` (`tools/worker-perf-report.mjs`) — dört Worker sayısı ×
  üç sahne tarayan tarayıcı yakalaması. **0v0 satırı bir senaryo değil, ölçü
  aleti:** rapordaki her "Worker başına" sayı ona karşı alınmış farktır. Presetler
  (`public/game-data/presets/worker_perf_{00,08,16,22}.json`) bu yüzden sıfır
  stokla açıyor — kimse inşa etmiyor, satırlar arasında Worker sayısından başka
  hiçbir şey değişmiyor.
- `node tools/worker-mixer-bench.mjs` — eklem sayısı sorusunu renderer'dan
  ayırarak ölçen mixer tezgâhı. Sentetik rig, ama şekli uydurulmuş değil
  `worker.glb`'den okunmuş: 65 eklem, klip başına 198 kanal, sampler başına ~21
  keyframe.

**Donanım ve koşullar:** Intel i5-11400F (6ç/12t), NVIDIA RTX 3060
(sürücü 32.0.15.9595), 16 GB, Windows 11. Playwright Chromium **görünür**
pencerede, `--disable-gpu-vsync` ile (aksi hâlde her satır maliyeti ne olursa
olsun 60 fps yazar — monitörü ölçmüş oluruz), 1920×1080, kalite `high`, adaptif
kapalı, Vite **dev** sunucusu. Satır başına 12 s ısınma + 10 s yakalama.
Harita sanatı `ready`, Actor paketi `ready` (0 placeholder).

| Ordu | Sahne | FPS | Kare ms | P95 ms | Draw call | Üçgen | `birim sunumu` ms | `çizim` ms | yakın/uzak |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0v0 | boşta | 170,4 | 5,87 | 8,70 | 264 | 45.380 | 0,001 | 3,53 | 0/0 |
| 8v8 | boşta | 150,2 | 6,66 | 8,70 | 289 | 193.292 | 0,501 | 4,06 | 8/8 |
| 16v16 | boşta | 119,1 | 8,40 | 11,30 | 313 | 341.204 | 0,914 | 5,28 | 16/16 |
| 22v22 | boşta | **64,4** | **15,54** | **33,10** | 331 | 452.138 | 1,962 | 9,87 | 22/22 |
| 0v0 | hareket | 190,6 | 5,25 | 7,00 | 264 | 45.380 | 0,001 | 2,99 | 0/0 |
| 8v8 | hareket | 135,3 | 7,39 | 11,00 | 321 | 196.364 | 0,538 | 4,65 | 8/8 |
| 16v16 | hareket | 113,9 | 8,78 | 11,10 | 377 | 347.348 | 0,981 | 5,38 | 16/16 |
| 22v22 | hareket | 102,2 | 9,78 | 12,10 | 411 | 459.818 | 1,220 | 6,11 | 22/22 |
| 0v0 | uzak | 195,1 | 5,13 | 6,80 | 323 | 66.205 | 0,001 | 3,10 | 0/0 |
| 8v8 | uzak | 153,3 | 6,52 | 8,00 | 348 | 214.117 | 0,563 | 3,93 | 8/8 |
| 16v16 | uzak | 115,7 | 8,64 | 12,70 | 372 | 362.029 | 1,007 | 5,34 | 15/17 |
| 22v22 | uzak | 111,1 | 9,00 | 11,00 | 390 | 472.963 | 1,040 | 5,80 | **15/29** |

- [x] **8+8 / 16+16 / 22+22 için CPU kare, GPU kare, draw call, üçgen ve mixer
  maliyeti.** Yukarıdaki tablo. Worker başına (aynı sahnenin 0v0 satırına karşı):
  **+1,52 draw call**, **+9.245 üçgen**, **+0,03–0,04 ms `birim sunumu`**.
  Ordunun yarısı frustum dışında olduğu için bunlar *çizilen* Worker'da
  ~3,0 draw call ve 18.201 üçgene karşılık geliyor — yani iki materyal slotu artı
  gölge geçişi, ve gövdenin GLB'deki üçgen sayısının tam kendisi.
- [x] **65 eklemli rigin mixer maliyeti.** Tezgâh, aynı klip şekliyle 33 ve 65
  eklemi karşılaştırdı:

  | Eklem | Ordu | ms/kare | ms/birim | 33'e göre |
  | ---: | ---: | ---: | ---: | ---: |
  | 33 | 16 | 0,611 | 0,0382 | 1,00× |
  | 65 | 16 | 1,167 | 0,0729 | 1,91× |
  | 33 | 32 | 1,038 | 0,0324 | 1,00× |
  | 65 | 32 | 2,561 | 0,0800 | 2,47× |
  | 33 | 44 | 1,715 | 0,0390 | 1,00× |
  | 65 | 44 | 3,415 | 0,0776 | 1,99× |

  Planın şüphesi doğruydu: **eklem sayısı mixer maliyetine doğrusal geçiyor** ve
  iki katı rig iki katı mixer demek. Ama büyüklük küçük: 44 Worker'ın hepsi
  kameraya yakınken 3,4 ms, hepsi 45 birim halkasının dışındayken 0,85 ms.
  **İki araç birbirini doğruluyor:** 22v22 boşta satırında 22 yakın + 22 uzak var,
  tezgâhın öngördüğü 22×0,0776 + 22×0,0194 = **2,14 ms**, tarayıcının ölçtüğü
  **1,96 ms**. Ayrı ayrı yazılmış iki ölçüm aleti aynı sayıyı söylüyor.
- [x] **İki materyal slotunun draw call etkisi.** GLB'den doğrulandı: `worker.glb`
  **2 primitive / 2 materyal** taşıyor, ve bu birim ailesinde tek — Guard (14.990
  üçgen) ve Archer (20.926) birer primitive/materyal. Sahadaki karşılığı çizilen
  Worker başına ~3,0 draw call (renk geçişinde iki, gölgede bir).
- [x] **Yakın/uzak kamera ve 15 Hz throttle.** Bu, taramanın en net tek ölçümü:
  `uzak` sahnesi 22v22'de 44 birimin **29'unu** halkanın dışına itti ve
  `birim sunumu` **1,96 → 1,04 ms**'ye düştü — birim sayısı değişmeden **%47**.
  Throttle bir bütçe temennisi değil, ölçülmüş bir kazanç.
- [x] **Idle, toplu hareket ve uzak kamera sahneleri — ve bir yanlış bulgunun
  düzeltmesi.** Üstteki tablo tek koşudan alınmıştır ve ilk okunuşunda
  "22v22'de duran ordu (15,54 ms) yürüyen ordudan (9,78 ms) pahalı" diye bir
  sonuç çıkardı. **Bu sonuç yanlıştı ve tekrar ölçülünce çöktü.** Aynı üç satır
  22v22'de üç kez koşuldu:

  | Sahne | koşu 1 | koşu 2 | koşu 3 |
  | --- | ---: | ---: | ---: |
  | boşta | 12,98 | **15,54** | 10,12 |
  | hareket | **14,13** | 9,78 | 11,34 |
  | uzak | 9,19 | 9,00 | 10,20 |

  Aynı preset, aynı sahne, aynı makinede **±3 ms saçılma** var ve
  boşta ↔ hareket sıralaması koşudan koşuya **yön değiştiriyor** — yani sahneler
  arası fark, ölçümün kendi gürültüsünün altında. Sahte bulguyu ele veren şey
  bölge tablosuydu: 15,54 ms'lik satırda *her* bölge birlikte şişmişti, aralarında
  Worker'la hiçbir ilgisi olmayan `hayvan/kervan sunumu` da (0,92 → 1,90 ms).
  Aynı hayvanlar, aynı sıfır kervan. Bir alt sistem sahnedeki işçilerin durup
  yürümesini umursamıyorsa, değişen şey iş yükü değil o on saniyedir.

  **Gürültünün altında kalan ve üç koşuda da duran gerçek sonuçlar:**
  `uzak` her koşuda en ucuz *ve* en kararlı satır (9,00–10,20 ms, üç koşuda da
  **sıfır** adet 33 ms üstü kare), yakın kameralı satırlarda ise 33 ms üstü
  kareler her koşuda var (0–31 adet). Ve `birim sunumu` birim başına
  **0,044–0,075 ms** bandında sabit kalıyor: sahne değil, kaç birimin halkanın
  içinde olduğu belirliyor.

  **Metodoloji notu, bu yüzden yazılıyor:** satır başına tek 10 saniyelik
  yakalama, %20'lik bir sahne farkını koşu gürültüsünden ayırmaya yetmiyor —
  ama makul görünen bir tablo üretmeye fazlasıyla yetiyor. Araca bu yüzden
  `WORKER_PERF_REPEATS` eklendi: satır tekrarlanır ve rapor **medyanı** yazar,
  yayılım da yanında durur.
- [x] **Prop'lu / propsuz Worker.** Ölçüm gerektirmedi, çünkü cevap asset ve kodda
  kesin: `Crate.glb` **252 üçgen / 1 materyal**, `Axe.glb` **176 üçgen /
  1 materyal**, yani görünürken Worker başına **+1 draw call ve gövdesinin
  ~%1,4'ü kadar üçgen**. Görünmezken maliyeti **sıfır**: `applyRtsWorkerTools` ve
  `applyRtsCargoVisibility` `.visible`'ı kapatıyor, three.js kapalı alt ağacı
  `projectObject`'te tümüyle atlıyor — çizim de, üçgen de, `traverseVisible`
  sayımı da onu görmüyor.
- [x] **Sonuçlar tarih ve donanımla kaydedildi.** Bu bölüm. Ham çıktılar
  `test-results/worker-perf/` altında (JSON + markdown, satır başına).

**Ölçülmeyen ve neden:** "çoklu iş animasyonu" sahnesi kurulmadı. Bir preset maçı
birimlerle ve stokla açar, kurulmuş bir ekonomiyle değil; otomatik işçi ancak
alacak bir üretici ya da şantiye varken iş alır, ve sahada bina yokken boşta
kalıyor — **tahmin değil, ölçüldü: 8v8, 80 saniye boyunca `boşta idle`.** Gerçek
bir çalışan kalabalık için orta oyun kaydı authorlamak gerekirdi ve bu, sorunun
hak ettiğinden büyük bir iş: çalışan Worker ile boşta Worker arasındaki fark
klip değil (ikisi de tek mixer, tek aksiyon), **elindeki prop** — o da yukarıdaki
maddede kalabalık kurmadan cevaplanmış bir draw call sorusu.

**Bu sayıların sınırları.** Tek makine, tek GPU, Vite **dev** sunucusu (prod
bundle değil) ve vsync kapalı. Yani bunlar bir oyuncu-GPU'su kıyaslaması değil,
**bu makinede tekrarlanabilir karşılaştırma kanıtı**; satırlar birbiriyle
karşılaştırılabilir, başka bir makinenin mutlak sayılarıyla değil. Zayıf
donanımın cevabı zaten `AdaptiveQualityController`.

### 13.2 Optimizasyon karar kapısı

**Karar (2026-08-18): mevcut maliyet bütçe içinde; kaynak mesh kalitesi
korunuyor. LOD açılmıyor.**

- [x] **Mevcut maliyet bütçe içindeyse kaynak mesh kalitesini koru.** İlk beklenti
  buydu ve ölçüm onu tuttu: on iki satırın on biri 100 fps'in üstünde, en kötü
  satır (22v22 boşta) 64,4 fps ile hâlâ 60'ın üstünde. Bütçe dışına çıkan hiçbir
  satır yok, dolayısıyla sadeleştirilecek mesh de yok.
- [x] **Bütçe dışındaysa önce eklem ve cadence, sonra mesh.** Konusuz kaldı, ama
  sıralamanın doğru olduğu ölçümle görüldü: eklem sayısı gerçekten doğrusal bir
  maliyet (1,99×) ve cadence gerçekten onu dörde bölüyor (%47 ölçülen kazanç),
  oysa mesh tarafı zaten birim ailesinin ortasında. Bir gün bütçe aşılırsa
  ilk bakılacak yer bu sırayla aynı yer.
- [x] **Mesh sadeleştirme.** Yapılmadı, gerekmedi; skin ağırlığı/siluet/UV riski
  hiç alınmadı.
- [x] **Uzak Worker için gölge, cadence ve prop görünürlüğü birlikte.** Üçü de
  ölçüldü ve üçü de aynı yöne çalışıyor: gölge geçişi çizilen Worker başına
  ~1 draw call, cadence uzakta maliyeti dörde bölüyor, prop görünmezken tam sıfır.
  Uzak Worker için ayrıca yapılacak bir iş çıkmadı.

**Kararı taşıyan sayı, sahneler arası fark değil, hepsinin birden bütçede
olması.** 22v22'nin üç koşusu 9,0 ile 15,5 ms arasında geziyor; en kötüsü bile
60 fps'in üstünde. Yani karar bu saçılmaya duyarlı değil — LOD'a "belki" diyecek
bir satır olsaydı önce onu tekrar ölçmek gerekirdi, ama öyle bir satır yok.

**İzlenecek tek şey yakın kameradaki tepe kareler.** `uzak` üç koşuda da sıfır
adet 33 ms üstü kare verdi, yakın kameralı satırlar ise her koşuda birkaç tane.
Ortalama değil bu tepeler bir gün sorun olursa, bakılacak yer LOD değil o
tepelerin kaynağıdır.

### 13.3 Nihai doğrulama

- [x] **Yeni GLB için `gltf-transform validate`: hata yok** (2026-08-18, §3.1'de
  uyarılarıyla birlikte kayıtlı).
- [x] `npx tsc --noEmit` temiz geçer.
- [x] İlgili filtreli engine kontrolleri temiz geçer; sonuç **`PARTIAL`**'dır ve
  tek başına yeşil bir build değildir.
- [x] `npm run build:verify` temiz geçer.
- [x] **Ölçüm presetlerinde page error yok.** On iki satırın on birinde hiç
  konsol/page hatası yok; ilkinde (soğuk Vite dev sunucusunun ilk sayfa yüklemesi)
  tek bir isimsiz `404` göründü ve ısınmış sunucuda `worker_perf_00` ile
  `worker_perf_22` ayrı ayrı yeniden denendiğinde **hiçbir istek başarısız
  olmadı** — yani dev sunucusunun dependency optimize etme yarışı, oyunun bir
  eksiği değil. Prod tarafını `verify:dist --strict` ayrıca kapıyor.
- [x] **Player ve AI Worker regresyon üretmiyor.** Ölçüm koşuları iki tarafın
  Worker'ını da 44'e kadar sahada tuttu: iki Actor da gerçek pakete bağlandı
  (`data-rts-content-assets=ready`, 0 placeholder), seçim/emir yolu çalıştı
  (rubber band + hareket emri ölçüldü), ve `test:engine:slow`'un tamamı yeşil.
- [x] **Kullanıcı nihai dünya içi görünümü kabul etti (2026-08-18): "test ettim sorun yok".**

## 14. Sıradaki Uygulama Dilimi

Eski "ilk dilim" (Actor bağlantısı + temel roller) tamamlandı. Sıradaki dar
kapsam önerisi:

1. ~~AI Worker Actor'una eksik `carriedCrate` bileşenini ekle ve `Worker Faz 4`
   kontrolünü iki Actor'a genişlet (§10.2).~~ **Tamam (2026-08-17).**
2. ~~`carryIdle`/`carryWalk` çiftinin box/holding tutarsızlığını karara bağla.~~
   **Tamam (2026-08-17): holding çifti seçildi.**
3. ~~`Farming_holding_idle`'ın idle havuzunda mı taşıma rolünde mi kalacağını
   karara bağla.~~ **Tamam (2026-08-17): taşıma rolünde, idle havuzundan çıktı.**
4. ~~`M_Worker_Cloth_AI` materyalinin adını düzelt.~~ **Tamam (2026-08-17).**
5. ~~`npx.cmd tsc --noEmit` + `npm.cmd run test:engine -- --filter "Worker Faz"`.~~
   **Tamam (2026-08-17): tsc temiz, 6 Worker kontrolü yeşil (`PARTIAL`).**
6. ~~Yeni paketin locomotion, `Fixing_Kneeling` montage'ı ve Crate hizası için tek
   bir dünya içi kabul turu iste.~~ **Tamam (2026-08-17): 6 duraklı tur koşuldu,
   5'i kabul, 5. durak §11.1A'yı doğurdu.**

**§14 dilimi kapandı.**

**2026-08-18 dilimi de kapandı: Faz ≤5 tamamen kapatıldı.** Yapılanlar:
eşek barrel devri uygulandı (§10.2A — sonradan kaldırıldı), hasat/hayvancılık
(§9.3), el arabası
(§10.4), turn/strafe (§11.3), `LeftHand` soketi (§10.1) ve kısa tarım
alternatifleri (§9.2) kapsam dışı kararlarıyla kapatıldı, §3.1'in duplicate klip
taraması yapıldı, §3.3'ün dört root-motion maddesi karara bağlandı, §10.2/§10.3'ün
iki testi yazıldı. `npx tsc --noEmit` temiz; `npm run test:engine:slow`
**1499/1499 yeşil**.

**2026-08-18, Faz 7 dilimi: §13.1 ve §13.2 kapandı.** Ölçüm iki araçla yapıldı
(`npm run perf:worker` ve `node tools/worker-mixer-bench.mjs`), yedi ölçüm
maddesinin yedisi de cevaplandı, karar kapısı **"mesh kalitesini koru, LOD
açma"** ile kapandı. Ayrıntı §13.1/§13.2; kalan tek şey kullanıcının nihai
dünya içi kabulü (§17).

**Aktif faz: Faz 7 (§13), yalnız kabul maddesi açık.** Faz 6'dan kalan tek şey
ses ve o ayrı planın konusu.

## 15. Teslim Kapısı

Plan ancak aşağıdaki koşullar birlikte sağlandığında tamam kabul edilir:

- [x] Player ve AI Worker yeni `worker` assetini kullanıyor.
- [x] Takım okunurluğu için oyuncu/AI materyal ayrımı uygulandı.
- [x] Temel locomotion otomatik kontrolleri ve **yeni paketin** dünya içi görsel
  kabulü tamam (2026-08-17).
- [x] Nötr çalışma pozu ve tarım aktivite ayrımı gerçek gameplay state'lerinden
  besleniyor; hasat ve hayvancılık için **kapsam dışı kararı belgelendi**
  (2026-08-18, §9.3).
- [x] Prop gerektiren hiçbir klip görünmez propsuz oynatılmıyor; iki Worker
  Actor'u da Crate, Axe ve (2026-08-18) Barrel prop'unu taşıyor. Crate'in soket
  hizası dünya içinde kabul edildi (2026-08-17, §10.2); Barrel aynı soketi
  kullanıyor ve görsel kabuli §17'de.
- [x] Attack/hit/death uygulanmış; **turn/strafe eksikliği kapsam dışı kararı
  olarak belgelendi** (2026-08-18, §11.3).
- [x] **Performans ölçümü tamamlanmış; optimizasyon gerekmedi** (2026-08-18,
  §13.1/§13.2). En kötü satır 22v22 boşta: 64,4 fps. LOD açılmadı, mesh
  sadeleştirilmedi, kaynak kalitesi korundu.
- [x] Tam doğrulama temiz geçmiş (`gltf-transform validate` hatasız,
  `build:verify` yeşil — §13.3).
- [x] **Nihai kullanıcı görsel kabulü kaydedildi: 2026-08-18** (§13.3).

## 16. Uygulama Günlüğü

- 2026-08-13 — Eski `Worker.glb` (33 klip, 33 eklem, 86.782 vertex, 60.000
  üçgen) incelendi ve bu plan oluşturuldu.
- 2026-08-13 — Faz 1 ve Faz 1A: iki Actor `worker` assetine bağlandı, temel
  locomotion rolleri authorlandı, kullanıcı locomotion kabulü alındı.
- 2026-08-13 — Faz 2: nötr iş pozu bağlandı, kullanıcı görsel kabulü alındı.
- 2026-08-13 — Faz 3: `workerActivity` sunum sözleşmesi ve cultivation havuzu
  eklendi; seçimin deterministik ve salt sunumsal olduğu testlerle pinlendi.
- 2026-08-13 — Faz 4 ilk dilimi: gerçek `returning`/`unloading` yükü `carryingBox`
  ve görünür Crate ile aynı karede sunuma aktarıldı; `carry-box` soketi ve oyuncu
  Actor'unun cargo prop'u authorlandı.
- 2026-08-15 — **Asset değişimi:** eski Mixamo paketi kaldırıldı, `worker.glb`
  (51 klip, 65 eklem) bağlandı. Faz 5 rolleri (`Idle_FoldArms_Loop`, `Attack`,
  `Death`, `Fixing_Kneeling`, `OverhandThrow`, `Punch_Jab`, `Punch_Cross`,
  `React_Chest`, `React_Head`, `TreeChopping_Loop`) gerçek sunum durumlarına
  bağlandı. `Fixing_Kneeling` 0–0,7 / 0,7–4,033 / 4,033–5,267 s montage'ı;
  misilleme 1,25–6 biriminde taş, daha yakında yumruk.
- 2026-08-15 — Av düzeltmesi: temas anında tek vuruş, sonra `Fixing_Kneeling` ile
  et toplama. Balta prop'u iki Actor'da `right-hand-tool` soketinde yalnız lumber
  assignment'ta görünür. Oyuncu/AI kumaş materyali mavi/kırmızı olarak ayrıldı.
- 2026-08-16 — **Plan yeni asset'e göre yeniden yazıldı.** GLB doğrudan okunarak
  51 klip, süreleri, 65 eklem, 18.201 üçgen, 10.409 vertex, 1,847 m boy ve
  santimetre birimli track ölçeği doğrulandı; Guard/Archer/Siege ile üçgen
  karşılaştırması yapıldı. Her klibin Hips root ilerlemesi ölçülüp §3.3'e
  işlendi: `Walk_Loop` ve `Sprint_Loop` yerinde kliplerdir (eski 1,69 m / 3,01 m
  gerekçesi geçersiz), `Death` 0,485 m kilitsiz taşır, dönüş klipleri
  0,14–0,30 m taşır, `Fixing_Kneeling` 52,5 cm'lik kalça inişi `lockXYZ` ile
  pinlenmiştir. Sağım klibinin pakette olmadığı, genel strafe/turn kliplerinin
  kalktığı ve `T-Pose`'un bulunmadığı kaydedildi. Yeni bulunan boşluk: AI Worker
  Actor'unda `carriedCrate` bileşeni eksik.
- 2026-08-17 — §14'ün mekanik dilimi: AI Worker Actor'una `carriedCrate` eklendi
  (oyuncu Actor'uyla birebir aynı props), `M_Worker_Cloth_AI` materyalinin `name`
  alanı düzeltildi ve `Worker Faz 4` kontrolü iki Actor üzerinde dönen bir döngüye
  çevrildi (cargo state, `crate` mesh'i, `carry-box` soketi ve 4× ölçek pinlendi).
  `npx.cmd tsc --noEmit` temiz; `--filter "Worker Faz"` 6/6 yeşil (`PARTIAL`).
- 2026-08-17 — **Regresyon: işçiler kapsüle döndü — sidecar dosya adının harf
  durumu.** Düzeltmelerden sonra her Worker legacy kapsül gövdesine düştü. Konsolda
  ne paket hatası ne placeholder vardı, çünkü yol tamamen sessizdi:
  `createUnitPresentation` `null` dönüyor, `unitSystem.refreshPresentations`
  bunu `continue` ile geçip fallback'i bırakıyordu. Sessizlik kaldırıldı
  (`rtsActorVisualFactory` artık hangi bileşenin hangi sokete neden bağlanamadığını
  yazıyor) ve sebep bir yenilemede çıktı: sidecar yolu modelden türetiliyor
  (`worker.glb` → `worker.skeleton.json`), ama dosya diskte `Worker.skeleton.json`
  olmuştu. Windows harf durumuna bakmadan çözdüğü için bu fark görünmez; fetch
  404 dönüp loader `defaultAssetSkeleton()`'a düşüyor, yani **soketi ve rolü
  olmayan bir iskelet** — hata vermeyen, yalnızca hiçbir şey bağlamayan bir rig.
  Dosya `worker.skeleton.json`'a geri alındı. Yeni kontrol
  (`Skeletal sidecar: …harfi harfine…`) her iskeletli asset için sidecar adını
  dizin listesiyle karakter karakter karşılaştırıyor; `existsSync` bunu Windows'ta
  yakalayamaz. Hata geri konularak kontrolün kırmızıya döndüğü doğrulandı.
  Not: bu, case-sensitive bir sunucuda (CI/Linux deploy) her hâlükârda patlardı.
- 2026-08-17 — **Dünya içi kabul turu: beş bulgu, üçü kök nedene indi.**
  1. **Soket ölçek hatası (§0.4).** Crate ve balta dünyada hiç görünmüyordu.
     Sebep görünürlük mantığı değil: socket marker'ı doğrudan kemiğe ekleniyordu,
     kemik de sahne kökünün 0,01 export ölçeğini miras alıyordu — yani her prop
     authored boyutunun %1'i kadar çiziliyordu. Aynı hata editörün socket
     overlay'inde de vardı, bu yüzden soketler görsel olarak hiç authorlanamamıştı.
     Yeni `engine/render-three/skeletalSocket.ts` ölçeği iptal eden bir mount
     düğümü koyuyor ve **runtime ile editör aynı yoldan geçiyor**. Baltanın
     `position: [0, 0.45, 0]` offset'i bozuk cm uzayında ayarlandığı için (gerçek
     etkisi 4,5 mm) sıfırlandı.
  2. **Havada diz çökme (§8).** `Fixing_Kneeling` `lockXYZ` → `lockXZ`.
  3. **Katmanlı taşıma (§10.2/§10.3).** Kullanıcı üst gövdede kutu pozu, alt
     gövdede yürüyüş istedi. `LayeredClipAnimator.setUpperBodyPose` eklendi
     (bugüne dek yalnız one-shot katmanı vardı; bu tutulan bir *durum*, süresi
     olan bir *olay* değil), yeni `carryPose` rolü + Worker'a `upperBodyBone:
     "Spine"` authorlandı. Yük varken locomotion "eli boşmuş gibi" sınıflanıyor,
     böylece yüklü Worker gerçek hızıyla koşuyor; darbe yerse gövdeden irkiliyor
     ve irkilme yürüyüşe değil **yüke** geri dönüyor.
  4. Boş elli Worker'ın "elinde bir şey tutuyor" pozu artık yok (bu turda
     doğrulandı — aynı gün yapılan idle havuzu düzeltmesi tuttu).
  Yeni engine kontrolleri: prop'un rig export ölçeğinden bağımsız çizildiği ve
  yükün üst gövdede tutulup bacakların kendi yürüyüşünü sürdürdüğü pinlendi.
  `Worker Faz 5`'teki balta `position`/`scale` assert'i tuning sabitliyordu ve
  bu düzeltmede kırmızıya döndü; şekil sözleşmesine çevrildi (authored offset +
  düzgün büyütme), CLAUDE.md'nin tuning kuralı gereği.
- 2026-08-17 — **Taşıma pozu kararı (kullanıcı):** holding çiftine geçildi.
  `carryIdle` `Farming_box_idle` → `Farming_holding_idle` oldu ve aynı klip `idle`
  varyant havuzundan çıkarıldı, böylece iki açık madde tek düzenlemeyle kapandı:
  taşıyan Worker durup yürürken poz ailesi değiştirmiyor, boş elli Worker da
  taşıma pozu oynamıyor. `Worker Faz 1` kontrolü artık klip adı sabitlemek yerine
  ilişkiyi pinliyor ("idle havuzu hiçbir taşıma klibini içeremez"), `Worker Faz 4`
  selector beklentisi de sidecar'ın `carryIdle` değerinden türetiliyor.
  `Farming_box_idle` boşta; iki elle kutu pozu istenirse yedek adaydır.
  `npx.cmd tsc --noEmit` temiz; `--filter "Worker Faz"` 6/6 yeşil (`PARTIAL`).
- 2026-08-17 — **Kabul turu: 6 duraktan 5'i kabul, biri gerçek bulgu.**
  Locomotion (§7), `Fixing_Kneeling` montage'ı (§8), iki taraftaki Crate hizası
  ve katmanlı taşıma (§10.2), balta/odun kesme ve takım rengi (§11.1/§11.2)
  kullanıcı tarafından kabul edildi; dikey salınımın `lockXYZ` ile silinmesi de
  kabul edilerek `lockXZ` dönüşü kapatıldı.
  5. durak — "taş atmıyor, yumruk atmıyor" — zincir headless koşturularak ikiye
  ayrıldı (§11.1A). **Taş:** Guard melee menzili 1,2, işçinin atış minimumu 1,25;
  yani işçiyi döven Guard tanım gereği bandın içinde ve taş orada imkânsız —
  Archer'a karşı (menzil 14) işçi 6'ya kapatıp 3 taş atıyor, yani tur yanlış
  rakiple denenmişti. **Yumruk:** gameplay'de 3 iniyordu, ekranda 1 başlıyordu;
  `advanceRtsAction`'ın irkilme önceliği yumruğu hem kesiyor hem yutuyordu.
  Kullanıcı kararıyla önceliğe değil *sıklığa* dokunuldu:
  `RTS_FLINCH_REFRACTORY_SECONDS` (1,8 s) iki irkilme arasına authored bir aralık
  koyuyor. Ölçülen sonuç: yumruk 1→2, taş 2→3, irkilme 5→3. Yeni kontrol
  (`RTS irkilme araligi: …`) yalnız ilişkiyi pinliyor ve bütün fixture sürelerini
  sabitin kendisinden türetiyor, böylece yeniden tuning yeşil kalıyor.
  `npx tsc --noEmit` temiz; `--filter "irkilme,Worker Faz,Guard,Archer Faz,Siege"`
  56/56 yeşil (`PARTIAL`).
- 2026-08-17 — **Misilleme sunumu, ikinci tur (§11.1B): üç istek, üçü de
  authorlanmamış mekanizma.** (1) Yürürken atış ayak kaydırıyordu — katmanlı
  atış sistemi vardı, Worker sidecar'ı `layerAttackWhenMoving` opt-in'ini
  yapmamıştı. (2) Taş elden çıkmıyordu — konum zaten doğruydu (`throw-release`
  soketi muzzle olarak bağlı), sorun zamanlamaydı: taş klibin ilk karesinde,
  el hâlâ başın arkasındayken doğuyordu. Bırakma anı GLB'den FK ile ölçüldü
  (RightHand, 120 Hz): el t≈0,41 s'de z=1,07 ile en ileri noktada ve hâlâ tepe
  hızda; notify oraya kondu ve `RtsApp` taşı `pendingThrows`'ta park edip notify
  geldiğinde o anki soketten fırlatıyor. (3) Dövüş arasında idle'a düşüyordu —
  kök neden `ROLE_FALLBACKS`'te `attack: ["idle"]` idi, ve yakın dövüşte daha
  kötüsü: Guard 1,2'de duruyor, işçinin atış minimumu 1,25, dolayısıyla
  `isTradingBlows()` false dönüp birim "hiçbir şey olmuyor" sayılıyordu. Yeni
  `combatIdle` rolü + `engagedClose` girdisi (`kickRange`'ten okunuyor, yani
  duruşun bandı darbelerin bandıyla aynı). Zincire `hold` **konmadı**: Guard bir
  `hold` klibi authorluyor ve o "tut" emridir — her dövüşte görünseydi emir
  okunmaz olurdu; kontrol bunu ayrıca pinliyor.
  Üç yeni kontrol (`Worker Faz 5B`, `Worker Faz 5C`) sözleşmeyi tutuyor, süreler
  klibin kendisinden türetiliyor. `Muhafiz Faz 2`'nin darbe kontrolü irkilme
  aralığı yüzünden eski davranışı belgeliyordu; kapağı ifade edecek şekilde
  yeniden yazıldı (aralık içindeki darbeler bastırılır ve **geri oynatılmaz**;
  aralığın ötesindekiler eski kuralla yeniden irkiltir) — eski sözleşme
  kaybolmadı, yanına yenisi pinlendi. `npx tsc --noEmit` temiz;
  `npm run test:engine:slow` **1497/1497 yeşil**.
- 2026-08-17 — **Harf durumu regresyonu yalnız diskte düzeltilmişti, git'te
  değil.** 2026-08-17'nin kapsül olayında sidecar `Worker.skeleton.json` →
  `worker.skeleton.json` olarak geri alınmıştı, ama git index'i üç dosyayı da
  (`Worker.glb`, `Worker.materials.json`, `Worker.skeleton.json`) hâlâ büyük W
  ile takip ediyordu; Windows case-insensitive olduğu için ne `git status` ne de
  yeni eklenen sidecar kontrolü bunu görebiliyordu — kontrol **diski** okuyor,
  sorun ise **index**teydi. Manifest `assets/.../worker.glb` diyor, yani
  case-sensitive bir checkout'ta (CI runner, Linux deploy) dosyalar `Worker.glb`
  olarak iner ve Worker'ın tamamı — mesh, sidecar, materyaller — 404'e düşerdi.
  Üçü de `git mv` ile küçük harfe alındı. Aynı günün notunun "her hâlükârda
  patlardı" uyarısı bu yüzden hâlâ geçerliydi: diski düzeltmek yetmiyor.
- 2026-08-18 — **Faz ≤5 kapatıldı; eşek barrel devri uygulandı.**
  §10.2A gerçek işti ve **asıl bulgusu bir sıralama tuzağıydı**: ekonomi tick'i
  karavan fleet'inden önce koşuyor, yani işçinin barrel'ı ekonominin içinde
  hesaplansaydı bir kare eski evreyi okur ve `loading → outbound` karesinde iki
  barrel birden görünürdü — planın yasakladığı şeyin ta kendisi. Sunum geçişi bu
  yüzden ayrı bir metot (`applyCaravanLoadPresentation`) ve `caravans.update`
  **sonrasında** çağrılıyor. İkinci bulgu: `loading` evresi devir değil,
  çoğunlukla bekleme — üretici tam sevkiyat üretene kadar sürüyor. Yeni
  `Caravan.loadingActive` yalnız sayacın gerçekten işlediği kareleri işaretliyor,
  yoksa işçi eşeğin yanında dakikalarca kucağında fıçıyla beklerdi. İki taraf da
  tek karardan besleniyor (`caravanLoadBearer`), yani "iki barrel / boş kare"
  yapısal olarak imkânsız. Üçüncüsü: tek `carrying` boolean'ı iki farklı yükü
  çizemiyordu; cargo düğümlerine isteğe bağlı `rtsCargoActivity` filtresi eklendi
  (crate → `carryingBox`, barrel → `carryingLoad`) ve `rtsUnitPresentation`'ın
  değişim guard'ı da aktiviteyi kapsayacak şekilde genişletildi — yoksa sandığını
  bırakıp fıçı alan işçide guard hiç tetiklenmez, adam yanlış nesneyi taşırdı.
  Taşıyıcı işçi deterministik (en küçük id) ve pencere boyunca mandallı; kimse
  yakında değilse kimse taşımaz ve eşek yine zamanında yola çıkar.
  Kapsam dışı kararları (kullanıcı onaylı): hasat + hayvancılık (§9.3), el
  arabası (§10.4), turn/strafe (§11.3), `LeftHand` soketi (§10.1), kısa tarım
  alternatifleri (§9.2). §3.1'in duplicate klip taraması yapıldı: **51 klibin
  51'i de ayrı veri** — `Idle_Loop` ile `Idle_FoldArms_Loop` süre, kanal (198) ve
  keyframe (77) sayısında birebir aynı olduğu için şüpheliydi, sampler baytları
  farklı çıktı; kontrol artık sidecar'daki her varyant havuzunu veri düzeyinde
  karşılaştırıyor. §3.3'ün dört root-motion maddesi karara bağlandı (`Death`
  kilitsiz kalıyor: gameplay kökü zaten pinli, kalan yarım metre düşüşün
  kendisi). Yeni/genişletilen kontroller: `Worker Faz 4A` (devir + filtre + poz),
  `Worker Faz 1: varyant havuzu` (duplicate), `Worker Faz 4`'e §10.2/§10.3'ün iki
  testi. `npx tsc --noEmit` temiz; `npm run test:engine:slow` **1499/1499 yeşil**.

- 2026-08-18 — **Faz 7: ölçüm ve karar kapısı.** İki ölçüm aleti yazıldı ve
  ikisi de birbirini doğruladı (§13.1). Asıl iş enstrümanı kurmaktı: dört preset
  (`worker_perf_00/08/16/22`), ve bunlardan biri senaryo değil **ölçü aleti** —
  0v0 satırı olmadan bir kare toplamı "maç ne kadar pahalı" der, Worker hakkında
  hiçbir şey demez. Sıfır stok da aynı sebeple: stok olsaydı satırlar farklı
  dünyalar inşa eder, fark Worker'a yazılamazdı. Sonuç: **bütçe içinde, LOD yok.**
  Üç bulgu kaydedilmeye değer. (1) **Planın şüphesi doğruydu ama küçüktü:** 65
  eklem gerçekten 33'ün ~2 katı mixer demek (1,99×, doğrusal), ama 44 Worker'ın
  tamamı yakınken bile 3,4 ms. (2) **Bir bulgu ölçüldü, yazıldı ve
  sonra çöktü — ve düşüşü kaydedilmeye asıl değer olan bu.** İlk tarama
  "22v22'de duran ordu (15,54 ms) yürüyen ordudan (9,78 ms) pahalı" dedi ve
  buraya "yığılma/overdraw" açıklamasıyla yazıldı. Kullanıcı sebebini sorunca
  tekrar ölçüldü: **aynı satır üç koşuda 12,98 / 15,54 / 10,12 ms**, ve
  boşta ↔ hareket sıralaması koşudan koşuya yön değiştiriyor. Fark, ölçümün
  ±3 ms'lik kendi gürültüsüydü. Geriye dönüp bakınca ipucu ilk tabloda da vardı
  ve okunmamıştı: o satırda **her** bölge birlikte şişmişti, aralarında sahnedeki
  işçilerle hiçbir ilgisi olmayan `hayvan/kervan sunumu` da (0,92 → 1,90 ms;
  aynı hayvanlar, sıfır kervan). Bir alt sistem işçilerin durup yürümesini
  umursamıyorsa değişen şey iş yükü değil o on saniyedir. Araç düzeltildi:
  `WORKER_PERF_REPEATS` (varsayılan 3) satırı tekrarlıyor, rapor **medyanı** ve
  yayılımı birlikte yazıyor, ve tablonun üstünde "bu yayılımdan küçük bir fark
  sonuç değildir" cümlesi duruyor. (3) **15 Hz halkası
  ölçülmüş ve tekrarlanan bir kazanç:** kamerayı geri çekmek 44 birimin 29'unu
  halkanın dışına itiyor; `uzak` üç koşunun üçünde de hem en ucuz hem en kararlı
  satır (9,0–10,2 ms, **sıfır** adet 33 ms üstü kare), ve `birim sunumu` birim
  başına 0,044–0,075 ms bandında sahneden bağımsız duruyor — belirleyen, kaç
  birimin halkanın içinde olduğu.
  Yol boyunca üç şey de öğrenildi. Tarayıcı tarafında **vsync ölçümü yiyordu**:
  görünür Chromium her satırı 60 fps yazıyordu, `--disable-gpu-vsync` olmadan
  rapor monitörü ölçüyor olacaktı. **Rubber band hiçbir şey seçmiyordu**, çünkü
  bant görüntünün %5'inden başlıyordu ve orası HUD arması — canvas basışı hiç
  görmüyordu, "toplu hareket" satırları duran bir kalabalığı ölçüyordu
  (`elementFromPoint` ile bulundu). Ve **witness'ta ölçülen ama okunamayan bir
  bölge vardı**: `birim sunumu` her karede ölçülüyordu ama `perfCosts()`'un
  yedilik okuma sırasında olmadığı için yalnız ekrandaki panele bile
  gitmiyordu — snapshot artık her bölgeyi, sahne sayımını ve bir yakın/uzak
  cadence sayımını taşıyor (sayım eşiği kopyalamıyor, sunumun kendi
  `isFarFromFocus`'unu çağırıyor). Ölçümün önündeki tek gerçek engel Worker
  değildi: çalışma ağacı `data-rts-map-art="fallback"` ile açılıyordu — silinmiş
  `Mountain_Group_1.gltf` yüzünden tek bir 404 ağaçları, kayaları ve madenleri
  birlikte düşürüyordu. Kullanıcının kararıyla model yerine blockout'un kendi
  kutusu bırakıldı; ilk tarama atıldı, ikincisi harita sanatı `ready` iken
  koşuldu. `gltf-transform validate` hatasız (§3.1), `npm run build:verify`
  yeşil.

## 17. Kullanıcı Gözü Bekleyen Kabul Maddeleri

Faz ≤5 kapandı; aşağıdakiler **faz bloke etmez**, çünkü hiçbiri "kod eksik"
değil — hepsi "böyle mi görünsün" sorusu. Otomasyon kendi kapsadığı her şeyi
kapsıyor (`tsc` temiz, 1499/1499 yeşil); geriye kalan, ekrana bakmakla saniyeler
içinde cevaplanan kısım. Tek bir kısa turda hepsine bakılabilir.

1. **Taş + irkilme (§11.1A, §11.1B).** Düşman **Archer**'ı işçinin üstüne sal —
   Guard'la denenmez: Guard'ın menzili 1,2, işçinin atış minimumu 1,25, yani taş
   orada tanım gereği imkânsız. Bakılacaklar: taş elden çıkıyor mu (notify
   t=0,41 s), yürürken atış ayak kaydırıyor mu, dövülen işçi karşılık veriyor
   gibi okunuyor mu, dövüş arasında barış idle'ına düşüyor mu.
2. **`combatIdle` klip seçimi (§11.1B).** Şu an `Idle_Torch_Loop`. Alternatifler:
   `Crouch_Idle_Loop` (çömelmiş), `Farming_kneeling_idle`. Karar tek satırlık
   sidecar düzenlemesi; sözleşme klip seçiminden bağımsız ve pinli.
3. **Yeni ve tekrarlanan sunumlar.**
   (a) **Crate boyutu ve soket pozu (§10.2):** ölçek 5×, `carry-box` editörde
   yeniden pozlandı (2026-08-18). Sandık gövdeye göre doğru boyutta mı, hizası
   yürürken kayıyor mu. (Barrel devri §10.2A ile birlikte kaldırıldı; artık
   bakılacak bir fıçı yok.)
   (b) **Cultivation (§9.2):** yeni rigin tarım hareketi — klip bağlaması eski
   paketle aynı, değişen yalnız rig.
   (c) **`Death` root kayması (§3.3):** düşen işçinin gövdesi yarım metre öne
   taşınıyor. Düşüş gibi mi, kayma gibi mi okunuyor? Kayma ise düzeltme tek
   satır: sidecar'da `Death` için `lockXZ`.

4. ~~**Faz 6 efektleri (§12.3).**~~ **Cevaplandı 2026-08-18: görünmüyorlardı.**
   Ayak tozu, kürek tozu ve odun kıymığı bağlamaları kaldırıldı (§12.4);
   işaretler ses için duruyor. Geriye bakılacak tek birim efekti `body-impact`
   kaldı — dövüşte "vuruldu" okunuyor mu, o da bir sonraki tura.

5. **Nihai teslim kabulü (§13.3'ün son maddesi).** Faz 7'nin ölçümü bitti ve
   kod tarafında açık madde kalmadı; geriye planın en başından beri bekleyen tek
   soru kaldı: **kalabalık bir maçta Worker doğru görünüyor mu.** Ölçüm bu soruyu
   cevaplayamaz — 44 Worker'ın kaç milisaniye tuttuğunu söyler, nasıl durduğunu
   değil. Bakmak için hazır bir kapı var: `?rts&debug&preset=worker_perf_22&mode=free`
   iki tarafa da 22'şer Worker'la açar, ve `?debug` paneli kare maliyetini yanında
   gösterir.

---

*Günlük notu (2026-08-18, ikinci dilim) — Faz 6 işaret dilimi:* Notify hattı
Guard Faz 6'da kurulmuştu, Worker'ın eksiği işaretlerin kendisiydi. Sekiz temas
anı GLB'den FK ile ölçülüp authorlandı (ayrıntı §12.1), iki yeni efekt bağlaması
eklendi (`chop-impact` → odun kıymığı, `dig-impact` → ayak tozunu paylaşıyor
çünkü kürek de bot da aynı tozu kaldırır; ad yine de ayrı, ses ona abone
olacak). Ölçüm iki maddeyi de **kapsam dışına çıkardı**: sulamada temas yok
(el bütün klip boyunca 94–109 cm bandında, hareket bir dökme), onarımda ayrık
darbe yok (tek uzun yay, tepe hızı 249 cm/s, hiç durmuyor). Üç kontrol yazıldı;
değerli olan ikincisi — işaretin klibin *kendi ölçülen* geometrisinde durduğunu
iddia ediyor, çünkü yarım çevrim kaymış bir ayak sesi de ateşlenir, throttle'lanır
ve havadaki ayağın altında toz gösterir. Sabit pinlenmiyor, ilişki pinleniyor.
Yol boyunca iki küçük bulgu: `RTS_THROW_RELEASE_NOTIFY` "iki dosya aynı adı
yazsın" diye sabit yapılmıştı ama test adı literal yazıyordu (sabit ortak modüle
taşındı, artık üç taraf da onu okuyor); ve uçtan uca kontrolün fixture klip
süreleri modelden alınmalıydı, çünkü yakalamak için var olduğu hata tam olarak
"1,133 s'lik klipte 1,308 s'ye konmuş, hiç ateşlenmeyen işaret". `npx tsc
--noEmit` temiz; `npm run test:engine:slow` **1502/1502 yeşil**.

---

*Günlük notu (2026-08-18, üçüncü dilim) — Faz 6 öncesi iki görsel eksik:*
Kullanıcı dünyada bakıp iki şey söyledi ve ikisi de gerçekti. Birincisi kolaydı:
crate RTS kamerasında çok küçük kalıyordu, ölçek 4 → 6,4 (iki Worker Actor'unda
da). Bunu yaparken eski `assert.deepEqual(crate.props.scale, [4, 4, 4])` kırıldı
— tam olarak CLAUDE.md'nin uyardığı tuning pinlemesi — ve sözleşmeye çevrildi:
ölçek pozitif, tekdüze, ve **iki Worker'da aynı**. Sayı serbest, ayrışma yasak.

İkincisi asıl bulgu. "Eşeğe barrel yüklemesi hiç olmuyor" doğruydu ve sebebi
§10.2A'nın yazdığı hiçbir şey değildi: karar tek kaynaktan (`caravanLoadBearer`),
sıralama doğru (`applyCaravanLoadPresentation`, `caravans.update` sonrası),
filtre çalışıyor, `isCaravanLoadingAt` gerçekten bağlı. Kırık olan **uygunluk**tı:
`pickLoadBearer` adayı `WORK_RANGE` (1,25) içinde arıyordu, oysa eve dönmüş
toplayıcı ekip footprint'ten ~2,1 ötede durur — kodun kendisi bunu biliyor,
`CAMP_REACH` (2,25) zaten bu yüzden var. Tahmin etmek yerine ölçtüm: gerçekçi bir
sevkiyat döngüsünde (tampon dolunca kalkan, `loadSeconds` yüklenen eşek) fıçı
**3 pencerenin 0'ında** görünüyordu; düzeltmeden sonra 3/3.

Mevcut `Worker Faz 4A` kontrolünün bunu yakalayamamasının sebebi öğretici:
`caravanLoadBearer`'ı ve `Caravan`'ı doğrudan çağırıyor, yani *kararı* pinliyor
ama kararın sorulacağı bir işçinin var olup olmadığını hiç sormuyor. Yeni kontrol
üretim sistemini gerçekten koşturuyor ve **kapsam** iddia ediyor: her sevkiyat
penceresinde tam bir taşıyıcı, hiç iki tane değil. Mesafe yazmıyor — halka,
yaklaşma noktası veya yükleme süresi retune edilirse yine de devir görünür kalmalı.
`npx tsc --noEmit` temiz; `npm run test:engine` **1494/1494** (9 yavaş kontrol
atlandı); `--filter "Faz 8"` 12/12.

---

*Günlük notu (2026-08-18, dördüncü dilim) — barrel devri kaldırıldı:*
Kullanıcı uzağa kamp kurup bekledi ve fıçıyı yine göremedi; mekaniğin
kaldırılmasını istedi. Kaldırıldı (§10.2A). Peşine düşülmemesi doğru karar:
pencere sevkiyat başına 2 saniye, sevkiyat aralığı tam kadroda ~1 dakika, ve
yalnız merkeze 8 birimden uzak yollu üreticilerde — yani en iyi ihtimalle
sürenin %3'ü. Bu görünürlük için taşınan sözleşme yükü (iki sistemin
senkronladığı presentation state, ayrı tick sırası, cargo activity filtresi,
ikinci prop) orantısızdı.

Sökme sırasında iki eski assert daha düştü ve ikisi de aynı türdendi — tuning
pinlemesi: crate ölçeği `[4, 4, 4]` (kullanıcı editörde 5'e aldı) ve `carry-box`
soketinin `position: [0, 0.03, 0.24]`'ü (editörde yeniden pozlandı). İkisi de
ilişkiye çevrildi: ölçek pozitif/tekdüze ve **iki Worker'da aynı**; soket `Hips`
üzerinde, crate önizlemeli ve save round-trip'inden sağ çıkıyor. Sayılar serbest.

`npm run build:verify` yeşil: `tsc` temiz, `vite build` geçti, **1501/1501**
kontrol, `verify:dist --strict` temiz.
