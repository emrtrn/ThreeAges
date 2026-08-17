# ThreeAges — Worker Animasyon ve Aktivite Entegrasyon Planı

Oluşturulma tarihi: 2026-08-13
Son asset güncellemesi: 2026-08-15 (yeni Worker paketi)
Son ölçüm/denetim: 2026-08-16
Durum: **Devam ediyor — Faz 1/1A/2, cultivation ve Faz 5 kod bağlantısı tamam;
dünya içi görsel kabul, hasat/hayvancılık gameplay state'i ve Faz 4'ün taşıma
dilimleri açık.**

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
- [ ] Yeni GLB için `gltf-transform validate` çalıştırılmadı; eski pakette alınan
  temiz sonuç bu dosya için geçerli değil. Faz 7 teslimi öncesinde çalıştır.
- [ ] Yeni pakette birebir aynı animasyon verisini taşıyan duplicate klip taraması
  yapılmadı (`Idle_Loop` ve `Idle_FoldArms_Loop` aynı süreyi ve aynı Hips
  ölçümlerini paylaşıyor; ikisinin gerçekten farklı olduğunu doğrula).

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

Bundan çıkan üç açık iş:

- [ ] `Walk_Loop` ve `Sprint_Loop` **zaten yerinde kliplerdir**; eski pakette
  gerekçe olan "1,69 m / 3,01 m ham ilerleme" yeni pakette yoktur. Buradaki
  `lockXYZ` artık yalnız yürüyüş/koşu dikey salınımını siliyor. Salınımın geri
  gelmesi isteniyorsa `lockXZ` yeterlidir — bu bir görsel karardır, kullanıcıya
  sorulacak.
- [ ] `Fixing_Kneeling` diz çökerken kalçayı 52,5 cm indiriyor; `lockXYZ` bu inişi
  de pinliyor. Diz çökme dünya içinde doğru görünüyor mu, yoksa `lockXZ`'ye mi
  geçmeli — görsel kabulde ayrıca bakılacak.
- [ ] `Death` klibi 0,485 m ilerliyor ve kilitli değil; ölen Worker'ın gameplay
  kökünden kayıp kaymadığını doğrula.
- [ ] Dönüş klipleri (`box_turn_*`, `holding_turn_*`) 0,14–0,30 m taşıyor. Bu
  klipler taşıma havuzuna girecekse önce kilit kararı verilmeli (§10.2).

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

`Chest_Open`, `Consume`, `Crouch_Fwd_Loop`, `Crouch_Idle_Loop`, `Idle_Torch_Loop`,
`Interact`, `Jog_Fwd_Loop`, `LayToIdle`, `PickUp_Table`, `Push_Loop`, `Roll`,
`Sitting_Enter`, `Sitting_Exit`, `Sitting_Idle_Loop`, `Sitting_Talking_Loop`.

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

**Durum:** ✅ Kullanıcı kabulü: 2026-08-13 (eski paket) — **yeni paketle
tekrarlanmadı.**

### 7.1 Kabul ortamı

- [ ] Yalnız Worker ağırlıklı tekrar kullanılabilir bir kabul preseti oluştur.
- [ ] En az 10 oyuncu ve 10 AI Worker ile gerçek Actor paketinin yüklendiğini
  doğrula.
- [ ] Placeholder/T-pose, page error ve console error bulunmadığını browser smoke
  ile doğrula.

### 7.2 Kullanıcı görsel kontrolü

- [ ] Kısa hedefte yürüyüşe başlama ve duruşa dönüşü gözle.
- [ ] Uzun hedefte koşu döngüsünü ve playback hızını gözle.
- [ ] Açık alan, dar geçit ve kalabalık varışta ayak kaymasını kontrol et
  (yeni walk/run yerinde klipler; kayma varsa neden `lockXYZ` değil playback rate).
- [ ] Keskin yön değişiminde root drift, ters yön ve modelin gameplay kökünden
  ayrılmasını kontrol et.
- [ ] Idle havuzunun (`Idle_FoldArms_Loop`, `Farming_holding_idle`, `Idle_Loop`)
  tekrarında sıçrama veya her karede restart olmadığını doğrula.
- [ ] Yürüyüş/koşu dikey salınımının silinmiş olması (§3.3) kabul edilebilir mi,
  karar ver.
- [x] Eski paket locomotion kabulü kaydedildi: 2026-08-13 (`çalışıyor, devam et`).

**Çıkış kapısı:** Yeni paketin locomotion'ı kullanıcı tarafından kabul edilmeden
sonraki fazların görsel kapıları kapanmış sayılmaz.

## 8. Faz 2 — Güvenli Nötr Çalışma Sunumu

**Durum:** ✅ Sözleşme tamam — nötr poz klibi yeni pakette `Fixing_Kneeling`
montage'ıyla değiştirildi (2026-08-15).

- [x] Genel `work` fallback'i tek ve stabil bir klibe bağlı.
- [x] İnşaat ve onarım artık ayakta nötr idle'a değil, `Fixing_Kneeling`
  montage'ına gider (K-04); bu, eski "diz çökme yanıltıcı" kararının bilinçli
  revizyonudur — yeni klip alet kullanan bir onarım pozudur.
- [x] `working` false olduğunda idle'a güvenli dönüş otomasyonla doğrulandı.
- [x] İşe yürürken `work` klibinin locomotion'dan önce başlamadığı test edildi.
- [x] İş bittiği veya Worker serbest bırakıldığı karede pozun temizlendiği inşaat,
  maden ve ekonomi çıkış testleriyle doğrulandı.
- [x] Kullanıcı görsel kabulü (eski klip): 2026-08-13.
- [x] **Havada diz çökme düzeltildi (2026-08-17).** Kullanıcı dünyada Worker'ın
  zeminin üstünde asılı diz çöktüğünü gördü; sebebi §3.3'ün önceden işaret ettiği
  şeydi: `lockXYZ` klibin 52,5 cm'lik kalça inişini de pinliyordu, yani gövde
  çömelirken kalça ayakta kalıyordu. `Fixing_Kneeling` artık `lockXZ` — yatay
  kayma hâlâ kilitli, dikey iniş oynuyor. Görsel kabul yine de bekliyor.
- [ ] Montage'ın enter → loop → exit geçişi dünya içinde kabul edilmedi.
- [ ] `Farming_kneeling_idle` boşta duruyor; `Fixing_Kneeling` kabul görmezse
  yedek nötr poz adayıdır.

## 9. Faz 3 — İşe Göre Aktivite Sözleşmesi ve Animasyonlar

**Durum:** 🟨 Aktivite sözleşmesi ve cultivation tamam; hasat ve hayvancılık
gameplay state'i yok.

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
- [ ] Yeni paketin cultivation kliplerinin dünya içi kabulü tekrarlanmadı.
- [ ] Kısa alternatifler (`Farm_PlantSeed` 2,833 s, `Farm_Watering` 3,867 s) uzun
  klipler yerine daha okunur mu, kullanıcıyla karşılaştır.

### 9.3 Hasat ve hayvancılık — asset değişimiyle yeniden yazıldı

Yeni pakette **sağım klibi yoktur**; eski `Worker_cow_milking` gitti. Buna karşılık
`workHarvest` ve `workLivestock` rolleri runtime'da hazır ve `Farm_Harvest`,
`Farming_pick_fruit_*`, `Farming_pull_plant_*` klipleri assette duruyor.

- [ ] Ürün hasadı için gerçek bir gameplay ataması tasarla (hangi bina, hangi
  kaynak, hangi Worker döngüsü). Bu olmadan `workHarvest` bağlanmaz.
- [ ] Hasat ataması doğduğunda `Farm_Harvest`'i ana klip, `Farming_pick_fruit_1/2/3`
  ve `Farming_pull_plant_1/2`'yi deterministik varyant havuzu yap.
- [ ] Hayvancılık: mevcut `livestock` state'i hayvan sakinleştirme/sürmedir ve
  Ağıl geliri penned hayvanlardan Worker olmadan üretilir. Sağım klibi olmadığı
  için `workLivestock` **bağlanmayacak**; sakinleştirme `work` fallback'inde kalır.
- [ ] Sağım gerçekten istenirse bu yeni bir asset işidir (klip üretimi + inek
  hizası), plan işi değildir. Karar kullanıcıya ait.
- [ ] Uygun klip yokken hiçbir rolü yanıltıcı klip ile doldurma; nötr fallback korunur.

### 9.4 Deterministik çeşitlilik

- [x] Cultivation klipleri sürekli loop olduğu için ayrı sunumsal sequence sayacı
  gerekmedi; seçici birim kimliği + semantic rolle sabit seçim yapar.
- [x] Aynı Worker ve aynı aktivitede seçimin kararlı olduğu test edildi.
- [x] Farklı Worker seed'lerinin havuzda çeşitlilik gösterdiği doğrulandı.
- [x] Aktivite değişmeden her loop'ta ilgisiz klibe sıçrama olmadığı test edildi.
- [x] Yeniden oluşturulan presentation aynı salt-okunur snapshot'tan aynı seçimi
  üretir ve `workerActivity`/`working` gameplay state'ine yazmaz.

**Çıkış kapısı:** Tarım kabul edildi. Hasat için gameplay state'i tasarlanmadan,
hayvancılık için de sağım klibi olmadığı açıkça kabul edilmeden Faz 3 kapanmaz.

## 10. Faz 4 — Prop, Soket ve Taşıma Animasyonları

**Durum:** 🟨 Crate taşıma iki Actor'da da bağlı ve taşıma poz ailesi karara
bağlandı (2026-08-17); soket hizasının görsel kabulü, eşek barrel devri ve el
arabası açık.

### 10.1 Soket sözleşmesi

- [x] `right-hand-tool` (`RightHand`) ve `throw-release` (`RightHand`) soketleri
  authorlandı; balta ve taş bunları kullanıyor.
- [x] İki elle tutulan Crate için gövde-stabil `carry-box` soketi `Hips` üzerinde,
  `position: [0, 0.03, 0.24]` ile authorlandı.
- [ ] Sol el kemiğini (`LeftHand`) ve tek elle bağlanacak prop ihtiyacını
  Skeletal Mesh Editor'de değerlendir.
- [ ] Prop'un zemin, gövde ve ellerle kesişmediğini idle/walk/turn kliplerinde
  ayrı ayrı doğrula.

### 10.2 Kutu taşıma

- [x] `Crate.gltf` pivotu tabanda, ham boyut ~9×17×9 cm; Actor'da 4× ölçekle
  authorlandı.
- [x] `carryIdle` = `Farming_holding_idle`, `carryWalk` = `Farming_holding_walk`;
  görünürlük Crate ile aynı `loaded` state'inden besleniyor.
- [x] **AI Worker'da Crate eklendi (2026-08-17).** `BP_RTS_Enemy_Worker.actor.json`
  artık oyuncu Actor'undaki `carriedCrate` bileşenini birebir taşıyor (`crate`,
  4× ölçek, `rtsCargoVisibility: "loaded"`, `carry-box` soketi); `Worker Faz 4`
  kontrolü iki Actor'u birden pinliyor.
- [x] **Kullanıcı kararı (2026-08-17), iki adımda:** önce holding çiftine geçildi
  (`Farming_box_walk` klibi olmadığı için kutu idle'ı ↔ elde yürüyüş sıçraması
  kabul edilmemişti). Ardından kullanıcı dünyada bakıp asıl çözümü istedi:
  **katmanlı blend.** Artık `carryPose` = `Farming_box_idle` yalnız üst gövdede
  tutuluyor, bacaklar normal `walk`/`run`/`idle` oynuyor. Poz sıçraması sorunu
  ortadan kalktı, çünkü ortada tek bir taşıma klibi kalmadı: gövde yükü tutuyor,
  bacaklar birimin gerçek hızıyla yürüyor. Holding çifti katmansız yedek olarak
  duruyor (üst gövde kemiği veya `carryPose` authorlamayan asset'ler için).
- [ ] Crate'in `carry-box` hizasının gerçek kliplerde görsel kabulü.
- [ ] Kutu işi bittiğinde prop'un kaybolması ile animasyon dönüşünün aynı karede
  gerçekleştiğini test et.
- [ ] `Farming_box_turn_left/right` ve `Farming_holding_turn_left/right`
  bağlanacaksa önce root kilidi kararı (§3.3): bu klipler 0,14–0,30 m taşıyor.

### 10.2A Eşek barrel yükleme — kabul edilen yön

- [x] Uzak ekonomi üreticilerinin yol üstü eşek karavanıyla, yakın üreticilerin
  doğrudan merkeze taşındığı doğrulandı.
- [x] Eşek Actor'unda `loaded` durumunda iki barrel pannier prop'u bulunduğu ve
  `outbound`/`unloading` evrelerinde göründüğü doğrulandı.
- [ ] Üreticiye atanmış Worker'ın yalnız `loading` evresinde barrel göstermesini
  authorla; kaynak miktarı veya karavan rotası bu sunumdan etkilenmez.
- [ ] Devir anında tek presentation state ile Worker barrel'ını gizle ve eşeğin
  pannier'larını görünür yap; çift barrel veya boş kare olmadığını otomasyonla test et.
- [ ] Worker, eşek ve hedef deposu için yaklaşma/ayrılma noktalarını belirle;
  mevcut karavan varış-kapılı lojistik sözleşmesini bozma.

### 10.3 Genel elde taşıma

- [x] `Farming_holding_walk` `carryWalk` rolünde kullanılıyor.
- [x] **Kullanıcı kararı (2026-08-17): `Farming_holding_idle` taşıma rolüne ait.**
  `idle` varyant havuzundan çıkarıldı; boş elli Worker artık "elinde bir şey
  tutuyor" pozunu oynayamaz. Havuz `Idle_FoldArms_Loop` + `Idle_Loop` olarak kaldı.
  `Worker Faz 1` kontrolü bunu ilişki olarak pinliyor: idle havuzu hiçbir taşıma
  klibini içeremez (klip adı sabitlemeden).
- [ ] Yük yokken holding kliplerinin seçilemediğini test et.
- [ ] Yükü depoya bırakma sırasında prop görünürlüğü ve idle dönüşünü doğrula.

### 10.4 El arabası

Yeni pakette üç klip var: `Farming_wheelbarrow_idle` (1,433 s),
`Farming_wheelbarrow_walk` (1,000 s, `lockXYZ` ile kilitli ama role bağlı değil),
`Farming_wheelbarrow_dump` (6,267 s). Eski plandaki `walk_1/2` ve dönüş klipleri
**yok**; tek yürüyüş klibi var.

- [ ] Uygun wheelbarrow assetini üret veya projeye ekle; prop olmadan klipleri
  bağlama.
- [ ] Teker pivotu, el tutuşu ve zemin yüksekliğini authorla.
- [ ] `wheelbarrow` activity'sinin hangi gerçek lojistik işine karşılık geldiğini
  belirle; bugün bu activity üretilmiyor.
- [ ] Tek yürüyüş klibiyle dönüşlerin oyun yönelimine bindiğini doğrula (dönüş
  klibi yok, çift dönüş riski de yok).
- [ ] `Farming_wheelbarrow_dump` klibini yalnız gerçek boşaltma olayı sırasında
  sunumsal one-shot olarak oynat.
- [ ] Boşaltma animasyonu kaynak transferini başlatmaz veya geciktirmez.

## 11. Faz 5 — Savaş Rolleri ve Takım Okunurluğu

**Durum:** 🟨 Kod, materyal ayrımı ve hedefli otomasyon tamam; dünya içi görsel
kabul bekliyor.

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
- [ ] Montage zaman pencereleri, Worker kalabalığı, taş elden çıkışı ve punch
  temaslarının dünya içi görsel kabulü.
- [ ] `Death` klibinin 0,485 m'lik kilitsiz root ilerlemesini gözle (§3.3).
- [ ] `throw-release` soketi authorlandı ama taşın gerçekten bu soketten çıkıp
  çıkmadığı dünya içinde doğrulanmadı.

### 11.2 Oyuncu/AI materyal ayrımı — uygulandı

- [x] Asset iki materyal slotu taşıyor: `m-worker-face-material`,
  `m-worker-cloth-material`.
- [x] Oyuncu Worker'ı asset varsayılanını (mavi kumaş) kullanır; düşman Worker'ı
  yalnız slot 1'i `m-worker-cloth-material-copy` (kırmızı kumaş) ile override eder.
- [x] Mavi/kırmızı base-color mevcut UV atlasını korur; normal ve ORM paylaşılır.
- [x] `Worker Faz 1` kontrolü override listesini birebir pinliyor.
- [ ] Renk ayrımının normal RTS kamera mesafesinde yeterli okunduğunu kullanıcıyla
  doğrula; seçim halkasına ek olarak ayırt edici mi?
- [x] `M_Worker_Cloth_AI.material.json` `name` alanı `M_Worker_Cloth_AI` oldu
  (2026-08-17); manifest zaten bu adı taşıyordu, editördeki ad çakışması bitti.

### 11.3 Turn/strafe backlog'u — daraltıldı

Yeni pakette genel strafe veya turn klibi yoktur (§4.5). Elde yalnız taşıma
durumuna özel dört dönüş klibi var, onlar da §10.2'ye ait.

- [ ] Genel yön değiştirme sunumu bu asset ile mümkün değil; ya kapsam dışı
  bırakılır ya da yeni klip üretimi gerekir. Kararı kaydet.
- [ ] Taşıma dönüş klipleri bağlanırsa simülasyon yönelimiyle animasyon root
  dönüşünün üst üste binmediğini kanıtla.

## 12. Faz 6 — Notify, VFX ve SFX

**Durum:** ⬜ İlgili iş kliplerinin görsel kabulünü bekliyor
**Amaç:** Kabul edilmiş hareketleri küçük, bütçeli sunum efektleriyle güçlendirmek.

`worker.skeleton.json.notifies` bugün boştur; bu fazın tamamı açıktır.

- [ ] Ayak teması notify zamanlarını `Walk_Loop` ve `Sprint_Loop` kliplerinden ölç.
- [ ] Toprak kazma (`Farming_dig_and_plant_seeds`), sulama (`Farming_watering`),
  balta teması (`TreeChopping_Loop`), onarım teması (`Fixing_Kneeling` loop
  penceresi), taş bırakma (`OverhandThrow`) ve varsa dump için yalnız görünür
  temas anlarını authorla.
- [ ] Notify'ları toz, küçük debris, su parçacığı ve ses tetikleme gibi sunumsal
  tüketicilere bağla.
- [ ] Notify hiçbir ekonomi miktarını veya iş tamamlanma anını belirlemez.
- [ ] Uzak animasyon cadence'inde notify atlama/çift atma olmadığını test et.
- [ ] Montage bölüm sınırlarında (0,7 s ve 4,033 s) notify'ın çift atmadığını test et.
- [ ] Global hız limiti ve ayrı VFX bütçesiyle kalabalık Worker grubunu koru.
- [ ] Pause/resume, crossfade ve kesilen kliplerde kuyruk işaretlerinin yanlış
  zamanda atılmadığını test et.
- [ ] Her efekt için normal/uzak kamera okunurluğunu kullanıcıya göster.

## 13. Faz 7 — Performans, LOD ve Nihai Teslim

**Durum:** ⬜ Önceki fazları bekliyor
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

### 13.1 Ölçüm

- [ ] 8+8, 16+16 ve 22+22 Worker için CPU frame, GPU frame, draw call, triangle
  ve animation mixer maliyetini ölç.
- [ ] 65 eklemli rigin (eski 33 eklemin ~2 katı) mixer maliyetine etkisini ayrı
  ölç; bu paketin asıl yeni maliyeti üçgen değil eklem sayısıdır.
- [ ] İki materyal slotunun (face + cloth) draw call'a etkisini ölç; her Worker
  artık en az iki çizim.
- [ ] Yakın/uzak kamera ve 15 Hz uzak animasyon throttle davranışını ayrı ölç.
- [ ] Idle, toplu hareket ve çoklu iş animasyonu sahnelerini karşılaştır.
- [ ] Prop'lu (crate/axe) ve propsuz Worker maliyetini karşılaştır.
- [ ] Ölçüm sonuçlarını bu belgeye tarih ve donanım bilgisiyle kaydet.

### 13.2 Optimizasyon karar kapısı

- [ ] Mevcut maliyet bütçe içindeyse kaynak mesh kalitesini koru (ilk beklenti bu).
- [ ] Bütçe dışındaysa önce eklem sayısı ve animasyon cadence'ini, sonra mesh'i
  değerlendir.
- [ ] Mesh sadeleştirme gerekirse skin ağırlıklarını, silueti, UV'yi ve
  animasyonları bozmadığını doğrula.
- [ ] Uzak Worker için gölge, animation cadence ve prop görünürlüğü maliyetlerini
  birlikte değerlendir.

### 13.3 Nihai doğrulama

- [ ] Yeni GLB için `gltf-transform validate` temiz geçer (§3.1).
- [ ] `npx.cmd tsc --noEmit` temiz geçer.
- [ ] İlgili filtreli engine kontrolleri temiz geçer; filtreli sonucun `PARTIAL`
  olduğu raporda açıkça belirtilir.
- [ ] Geniş değişiklik ve teslim öncesinde `npm.cmd run build:verify` temiz geçer.
- [ ] Worker kabul presetinde page/console error yoktur.
- [ ] Player ve AI Worker; hareket, çalışma, prop, ölüm fallback'i ve seçim
  davranışında regresyon üretmez.
- [ ] Kullanıcı nihai dünya içi görünümü kabul eder.

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
6. Yeni paketin locomotion, `Fixing_Kneeling` montage'ı ve Crate hizası için tek
   bir dünya içi kabul turu iste — **artık iki taraftaki Crate de bu turda
   bakılacak.**

**§14 dilimi kapandı; geriye yalnız 6. maddedeki tek dünya içi kabul turu kaldı.**

Bu dilimde hasat state'i, el arabası, notify veya LOD işi yapılmaz.

## 15. Teslim Kapısı

Plan ancak aşağıdaki koşullar birlikte sağlandığında tamam kabul edilir:

- [x] Player ve AI Worker yeni `worker` assetini kullanıyor.
- [x] Takım okunurluğu için oyuncu/AI materyal ayrımı uygulandı.
- [ ] Temel locomotion otomatik kontrolleri ve **yeni paketin** dünya içi görsel
  kabulü tamam.
- [ ] Nötr çalışma pozu ve tarım aktivite ayrımı gerçek gameplay state'lerinden
  besleniyor; hasat ve hayvancılık için ya state uygulanmış ya da kapsam dışı
  kararı belgelenmiş.
- [x] Prop gerektiren hiçbir klip görünmez propsuz oynatılmıyor; iki Worker
  Actor'u da Crate ve Axe prop'unu taşıyor (2026-08-17). Crate'in soket hizası
  ayrıca görsel kabul bekliyor (§10.2).
- [ ] Attack/hit/death uygulanmış; turn/strafe eksikliği açık backlog kararı
  olarak belgelenmiş.
- [ ] Performans ölçümü tamamlanmış ve gerekiyorsa optimizasyon uygulanmış.
- [ ] Tam doğrulama temiz geçmiş.
- [ ] Nihai kullanıcı görsel kabulü tarihli olarak kaydedilmiş.

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
