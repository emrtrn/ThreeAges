# ThreeAges — Okçu Animasyon ve Materyal Entegrasyon Planı

Oluşturulma tarihi: 2026-08-12  
Durum: **Uygulanıyor — Faz 1 Actor bağlantısı, locomotion verisi ve dar otomasyon
tamamlandı. Dünya içi locomotion görsel kabulü bekleniyor.**

## 1. Amaç

`public/assets/ThreeAges/Characters/Archer/Archer.glb` içindeki 40 animasyonu RTS
Okçu biriminde aşamalı ve güvenli biçimde kullanmak; önce temel locomotion'ı
kurmak, ardından oyuncu/düşman için Imagegen ile mavi ve kırmızı base-color
dokuları üretmek ve son olarak menzilli saldırı sunumunu zenginleştirmek.

Bu çalışmada aşağıdaki kurallar değişmez:

- Konum, hız, hedef, menzil, hasar ve `1.6 s` saldırı cooldown'u simülasyonun
  otoritesinde kalır.
- Animasyon ve notify yalnızca gerçekleşmiş oyun durumlarını gösterir; hasar veya
  atış zamanını belirlemez.
- Root-motion ayarlarının kaynağı `Archer.skeleton.json` ve Skeletal Mesh
  Editor'dür; GLB yeniden yazılmaz.
- Animasyon varyasyonu `Math.random()` kullanmaz; birim kimliği ve olay sayacına
  dayalı deterministik seçim kullanır.
- Otomatik test ile dünya içi görsel kabul ayrı kapılardır. Görsel kabul kullanıcı
  gözlemi olmadan kapatılmaz.

## 2. Kanıtlı Başlangıç Noktası

### 2.1 Asset

- [x] `Archer.glb` manifestte `archer` kimliğiyle kayıtlı.
- [x] GLB doğrulamasında hata yok.
- [x] Asset 40 animasyon, 70 kemik, tek skin, tek skinned primitive ve tek
  materyal içeriyor.
- [x] Rig, Guard ile aynı `mixamorig:*` ailesini kullanıyor.
- [x] Yay ve ok için `mixamorig:Left_arch1`, `mixamorig:Left_arch2` ve
  `mixamorig:arrow` kemikleri mevcut.
- [x] `Archer_BC.png` ve `Archer_N.png` 1024×1024.
- [x] `M_Archer.material.json` ve `Archer.materials.json` mevcut;
  slot `0` → `m-archer-material` atanmış.

### 2.2 Root motion

- [x] Root-motion satırları kullanıcı tarafından Skeletal Mesh Editor üzerinden
  authorlandı ve `Archer.skeleton.json` içine kaydedildi.
- [x] İleri/geri/yan walk ve run klipleri in-place kullanım için kilitlendi.
- [x] Aim-walk klipleri in-place kullanım için kilitlendi.
- [x] Dodge ve dive kliplerinin gelecekteki gameplay-driven hareket kullanımı
  için `driveMotion` seçimi kaydedildi.
- [ ] Faz 1 browser kabulünde authorlanan kilitlerin world-position sürüklenmesi
  üretmediği doğrulanacak; gerekirse düzeltme yalnızca Skeletal Mesh Editor'den
  yapılacak.

### 2.3 Sabit istisna

- [x] `Archer_standing_turn_90_right`,
  `Archer_standing_run_right` ile tamamen duplike kabul edildi.
- [x] Bu klip hiçbir semantic role, varyant, notify veya teste bağlanmayacak.
- [x] Dosya GLB'den silinmeyecek; yalnızca runtime authoring tarafından göz ardı
  edilecek.

### 2.4 Bağlantı durumu

- [x] `BP_RTS_Archer.actor.json` `archer` assetini kullanıyor.
- [x] `BP_RTS_Enemy_Archer.actor.json` `archer` assetini kullanıyor.
- [x] `Archer.skeleton.json` Faz 1 locomotion `animationSet` ve
  `animationVariants` verisini taşıyor; `notifies` ve `montages` sonraki fazlar
  için boş kalıyor.
- [ ] Oyuncu/düşman için ayrı mavi ve kırmızı Archer base-color dokuları yok.

## 3. Sabit Kararlar

### K-01 — Uygulama sırası

Fazlar aşağıdaki sırayla ilerler:

1. Temel Actor bağlantısı ve locomotion,
2. Locomotion görsel kabulü,
3. Imagegen ile mavi/kırmızı base-color dokuları ve takım materyalleri,
4. Temel ranged attack,
5. Hit/death,
6. Zengin ranged döngüsü, notify/VFX/SFX ve ileri animasyonlar.

Locomotion kabul edilmeden takım texture üretimine geçilmez. Böylece asset'in
ölçek, yön, rig veya kayma sorunu doku üretimiyle karışmaz.

### K-02 — Sidecar otoritesi

Klip rolleri, varyantlar, root-motion, socket, montage ve notify verileri
`Archer.skeleton.json` içinde tutulur. `Archer.glb` yeniden export veya destructive
edit edilmez.

Yeni semantic role gerekirse aynı dilimde şu yüzeyler birlikte ele alınır:

1. `src/scene/assetSkeletonLoader.ts`,
2. `tools/saveValidator.ts`,
3. `src/game/rts/units/rtsUnitAnimation.ts`,
4. ilgili engine testleri.

### K-03 — Takım renkleri texture üzerinden okunur

Faz 2 tamamlandığında oyuncu/düşman ayrımı tüm modeli boyayan `materialTint`
yerine iki ayrı base-color texture üzerinden yapılır. Ten, saç, deri, metal, yay,
ok ve UV yerleşimi korunur; yalnızca takım kimliğini taşıyan kumaş bölgeler
mavi/kırmızıya dönüştürülür.

### K-04 — Her klip otomatik kullanılmaz

`block`, `dodge`, `dive`, `fall`, `equip`, `disarm`, melee ve directional aim
klipleri yalnızca karşılık gelen gerçek state/event mevcutsa bağlanır. Animasyon
adı tek başına gameplay gerçeği sayılmaz.

## 4. Faz 1 — Actor Bağlantısı ve Temel Locomotion

**Durum:** 🟨 Kod ve otomasyon tamamlandı — dünya içi görsel kabul bekleniyor  
**Amaç:** Yeni Archer assetini oyuncu ve AI Okçularına bağlamak; idle, ileri ve
geri locomotion'ı simülasyon hareketiyle uyumlu çalıştırmak.

### 4.1 Actor bağlantısı

- [x] `BP_RTS_Archer.actor.json` içindeki skeletal mesh `assetId` değerini
  `archer` yap.
- [x] `BP_RTS_Enemy_Archer.actor.json` içindeki skeletal mesh `assetId` değerini
  `archer` yap.
- [x] Faz 2 tamamlanana kadar mevcut yeşil/turuncu `materialTint` ayrımını geçici
  olarak koru.
- [x] `selectionRadius: 0.39` gameplay sözleşmesini değiştirme.
- [ ] Actor yönü, zemin oturuşu ve ölçeğini Guard ile aynı sahnede karşılaştır.

### 4.2 Birincil semantic roller

| RTS rolü | Klip | Süre | Durum |
| --- | --- | ---: | --- |
| `idle` | `Archer_standing_idle` | 5.10 s | ✅ |
| `walk` | `Archer_standing_walk_forward` | 1.20 s | ✅ |
| `run` | `Archer_standing_run_forward` | 0.87 s | ✅ |
| `walkBack` | `Archer_standing_walk_back` | 1.47 s | ✅ |
| `runBack` | `Archer_standing_run_back` | 0.67 s | ✅ |

- [x] Yukarıdaki beş rolü `animationSet` içine ekle.
- [x] `Archer_standing_idle_examine` ve `Archer_standing_idle_looking` kliplerini
  deterministik `idle` varyantları olarak ekle.
- [x] `Archer_unurmed_idle` yazımındaki ve görünümündeki silahsız duruşu temel
  idle havuzuna ekleme.
- [ ] Locomotion oynatma hızının Okçu `moveSpeed: 6.2` ile ayak kayması
  üretmediğini doğrula.
- [x] Geri locomotion kliplerini yalnızca gerçek geri çekilme semantic rollerinde
  kullan; ileri varyant havuzuna koyma.

### 4.3 Otomasyon

- [x] Actor validation testlerinde iki Archer Actor'ının `archer` assetini
  kullandığını pinle.
- [x] Archer sidecar'ındaki tüm locomotion rol ve varyantlarının GLB'de gerçekten
  bulunduğunu test et.
- [x] Duplike `turn_90_right` klibinin hiçbir runtime havuzuna girmediğini test et.
- [x] Animasyonun birim konumu, hızı, emri veya statlarını değiştirmediğini koru.
- [x] `npx.cmd tsc --noEmit` çalıştır.
- [x] `npm.cmd run test:engine -- --filter "Skeletal animasyon,Archer"` veya
  eklenen kontrol etiketine karşılık gelen dar filtreyi çalıştır.

### 4.4 Dünya içi görsel kabul

Otomatik hazırlık:

- [x] `archer_locomotion_acceptance` presetiyle yalnız 10 oyuncu ve 10 düşman
  Okçu içeren, sis kapalı ve normal hızlı tekrar kullanılabilir kabul rotası oluştur.
- [x] Chromium smoke ile rotanın gerçek Actor paketi, sıfır placeholder ve
  page/console error olmadan 10+10 Okçu açtığını doğrula.

- [ ] Aynı anda en az 10 oyuncu ve 10 düşman Okçu oluştur.
- [ ] Kısa hedef, uzak hedef, açık alan ve dar geçitte walk/run gözle.
- [ ] `T` geri çekilme emrinde walkBack/runBack yönünü gözle.
- [ ] Dururken idle varyantlarının birimler arasında çeşitlilik gösterdiğini,
  aynı birimde restart sonrası değişmediğini doğrula.
- [ ] Modelin gameplay kökünden ayrılmadığını ve başlangıç noktasına sıçramadığını
  doğrula.
- [ ] Ayak kayması, T-pose, ters yön, zemin altına girme veya her karede klip
  restart gözlenmediğinde kullanıcı kabulünü tarihli olarak kaydet.

**Faz 1 çıkış kapısı:** Locomotion kullanıcı tarafından kabul edilmeden Faz 2
texture üretimi başlamaz.

## 5. Faz 2 — Imagegen Takım Dokuları ve Materyaller

**Durum:** ⬜ Faz 1 kabulünü bekliyor  
**Amaç:** Guard ile aynı yöntemle oyuncu için mavi, AI için kırmızı base-color
texture üretmek ve tam-model tint ihtiyacını kaldırmak.

### 5.1 Imagegen üretim sözleşmesi

- [ ] Kaynak referans olarak mevcut `Archer_BC.png` dosyasını kullan.
- [ ] `Archer_Blue_BC.png` üret: takım kumaşları mavi; diğer yüzeyler korunmuş.
- [ ] `Archer_Red_BC.png` üret: aynı bölgeler kırmızı; diğer yüzeyler korunmuş.
- [ ] Çıktıları tam `1024×1024`, PNG ve kaynakla aynı UV atlas yerleşiminde tut.
- [ ] Ten, yüz, saç, deri, metal, yay, ok, dikiş, gölge ve alpha sınırlarının
  konumunu değiştirme.
- [ ] Mavi/kırmızı görsellerin birbirinden yalnızca takım rengi bakımından
  ayrıldığını karşılaştır.
- [ ] UV adaları arasında generative taşma, seam, yeni çizgi, yüz bozulması veya
  eksik parça varsa çıktıyı reddet ve yeniden üret.

### 5.2 Manifest ve materyal bağlantısı

- [ ] Mavi texture'ı manifestte `archer-blue-bc` olarak kaydet.
- [ ] Kırmızı texture'ı manifestte `archer-red-bc` olarak kaydet.
- [ ] `M_Archer.material.json` base-color kaynağını `archer-blue-bc` yap.
- [ ] `M_Archer_AI.material.json` oluştur ve base-color kaynağını
  `archer-red-bc` yap.
- [ ] Her iki materyalde aynı `archer-n`, roughness ve diğer yüzey ayarlarını
  kullan.
- [ ] Oyuncu Actor'ına `materialSlot: "m-archer-material"` ata.
- [ ] Düşman Actor'ına `materialSlot: "m-archer-ai-material"` ata.
- [ ] Texture tabanlı takım ayrımı kabul edilince iki Actor'dan da
  `materialTint` kaldır.
- [ ] `Archer.materials.json` slot 0 varsayılanının oyuncu materyali olarak
  kaldığını doğrula.

### 5.3 Görsel kabul

- [ ] Skeletal Mesh Editor'de mavi ve kırmızı materyali aynı idle/walk/run
  klipleri üzerinde ayrı ayrı aç.
- [ ] Ten ve metalin takım rengiyle boyanmadığını doğrula.
- [ ] Oyun kamerasının yakın, normal ve uzak seviyelerinde iki orduyu ayırt et.
- [ ] Gölge, normal map yönü, seam ve aşırı doygunluk kontrolü yap.
- [ ] En az 20+20 Okçu ile materyal paylaşımı ve draw-call davranışını smoke et.
- [ ] Kullanıcı mavi/kırmızı texture görünümünü kabul ettiğinde tarihi kaydet.

## 6. Faz 3 — Temel Menzilli Saldırı Sunumu

**Durum:** ⬜ Faz 2 sonrasında  
**Amaç:** Her gerçek `attackCount` artışında tek bir okun bırakıldığını okunur
biçimde göstermek; hasar/cooldown davranışını değiştirmemek.

### 6.1 İlk güvenli dilim

- [ ] `attack` için ilk aday olarak `Archer_standing_aim_recoil` (`0.70 s`)
  klibini Skeletal Mesh Editor'de oyun kamerasına yakın açıyla önizle.
- [ ] Klip tek başına okun bırakma hareketi olarak okunuyorsa `attack` rolüne ata.
- [ ] Saldırının yalnızca gerçek `attackCount` artışında bir kez başlamasını
  doğrula.
- [ ] Yeni atış önceki action bitmeden gelirse yeni olayın klibi baştan
  başlattığını doğrula.
- [ ] Klip sırasında world-position drift varsa root-motion düzeltmesini yalnızca
  Skeletal Mesh Editor üzerinden yap.
- [ ] Animasyon süresinin `attackCooldown: 1.6`, hasar, hedef veya projectile
  üretimini değiştirmediğini test et.

### 6.2 Nişan duruşu tasarım kapısı

- [ ] `Archer_standing_aim_overdraw` (`3.73 s`) klibini loop/hold uygunluğu için
  görsel olarak incele.
- [ ] Uygunsa, hedef menzildeyken shot action'ları arasında kullanılan sürekli
  `aim` semantic rolünü tasarla.
- [ ] `aim` yeni rol olacaksa loader, save validator, selector ve testleri aynı
  dilimde güncelle.
- [ ] `aim` yalnızca mevcut `attacking/target-in-range` gerçeğini okusun; hedef
  edinme veya cooldown üzerinde etkisi olmasın.

### 6.3 Görsel kabul

- [ ] Tek Okçu ile en az üç ardışık atış izle.
- [ ] On Okçu volley halinde aynı hedefe ateş ederken klip restart ve cadence'i
  gözle.
- [ ] Hedef değişimi, hedef ölümü ve menzil dışına çıkışta idle/aim geçişini
  gözle.
- [ ] Projectile'ın karakter yönüyle tutarlı çıktığını doğrula.
- [ ] Okçu ateş ederken modelin hedefe baktığını doğrula.

## 7. Faz 4 — Hasar Tepkisi ve Ölüm

**Durum:** ⬜ Faz 3 sonrasında

### 7.1 Hit

- [ ] `hit` birincili olarak
  `Archer_standing_react_small_from_front` (`1.27 s`) kullan.
- [ ] `Archer_standing_react_small_from_headshot` klibini ilk dilimde genel
  varyant olarak bağlama; oyunda headshot olayı yokken yanlış anlam üretip
  üretmediğini görsel tasarım kapısında değerlendir.
- [ ] Hareket hâlinde tam-gövde flinch ayak kaydırıyorsa Guard'daki gibi
  `upperBodyBone` katmanlamasını `mixamorig:Spine` üzerinden etkinleştir.
- [ ] Hit yalnızca gerçek `impactCount` artışında oynasın.
- [ ] Önceliği `death > hit > attack > continuous pose/locomotion` olarak koru.

### 7.2 Death

- [ ] `death` birincili olarak `Archer_standing_death_backward` (`3.07 s`) kullan.
- [ ] `Archer_standing_death_forward` (`3.17 s`) klibini deterministik death
  varyantı olarak ekle.
- [ ] Death tam gövde oynasın; üst-gövde katmanına alınmasın.
- [ ] Ölüm klibinin sonuna kadar oynadığını, son karede donduğunu ve mevcut ceset
  penceresi sonunda kaybolduğunu doğrula.
- [ ] Death animasyonu despawn'ın gameplay sorgularını geciktirmesin; ölü birim
  hedeflenebilir/komut alabilir hâle gelmesin.

### 7.3 Kabul

- [ ] Duran, yürüyen ve koşan Okçuya Guard, Archer, kule ve yırtıcı kaynaklı
  hasar uygula.
- [ ] Hareket hâlindeki hit sırasında ayak kayması olmadığını doğrula.
- [ ] En az 10 ölümde iki death varyantının görüldüğünü doğrula.
- [ ] Hızlandırılmış simülasyonda death klibinin kesilmediğini doğrula.
- [ ] Kullanıcı hit/death görünümünü kabul ettiğinde tarihi kaydet.

## 8. Faz 5 — Zengin Atış Döngüsü, Socket ve Notify

**Durum:** ⬜ Tasarım ve görsel kabul kapısı

### 8.1 Atış döngüsü

- [ ] `aim_recoil` sonrasında `Archer_standing_draw_arrow` (`1.00 s`) oynatan
  sunumsal recovery/reload dizisini tasarla.
- [ ] Toplam yaklaşık `1.70 s` authored sürenin `1.60 s` gameplay cooldown'uyla
  nasıl uzlaştırılacağını belirle: hafif playback ölçeği veya yeni atışta güvenli
  kesme.
- [ ] Reload animasyonu hiçbir durumda bir sonraki gerçek atışı geciktirmesin.
- [ ] `equip_bow` ve `disarm_bow` yalnızca gerçek silah hazırlama state'i
  tasarlanırsa bu döngüye girsin.

### 8.2 Ok çıkış noktası

- [ ] `mixamorig:arrow` ve yay kemiklerini Skeletal Mesh Editor'de doğrula.
- [ ] Mevcut Actor socket/runtime hattının skinned bone socket'i destekleyip
  desteklemediğini ölç.
- [ ] Gerekirse gameplay'den bağımsız, yalnızca sunumun projectile başlangıç
  noktasını raporlayan bone/socket köprüsü ekle.
- [ ] Projectile başlangıcını sabit `1.25` yükseklik yerine yay/ok kemiğinin world
  konumundan çiz; hasarın uygulandığı anı değiştirme.
- [ ] Yakın ve uzak hedeflerde okun elden/yaydan çıktığını gözle.

### 8.3 Notify, VFX ve gelecekteki ses

- [ ] Walk/run kliplerinin ayak temas zamanlarını ölç ve `footstep` notify'ları
  authorla.
- [ ] `aim_recoil` üzerindeki gerçek bırakma anını ölç ve `arrow-release` notify'ı
  authorla.
- [ ] Hit klibi için uygun `body-impact` anını ölç.
- [ ] Footstep/body-impact mevcut RTS notify VFX bütçesini kullansın.
- [ ] `arrow-release` bugün tüketicisiz kalacaksa bunu açıkça belgele; gelecekteki
  ses planı aynı notify'ı kullanabilsin.
- [ ] Notify'lar gameplay hasarı, cooldown veya projectile kararı yazmasın.
- [ ] Kalabalık volley sırasında global efekt bütçesini aşmadığını test et.

## 9. Faz 6 — İleri Animasyon Backlog'u

Bu maddeler temel Archer teslim kapısının zorunlu parçası değildir.

### 9.1 Directional aim locomotion

- [ ] Dört `aim_walk_*` klibini ancak sunum gerçek local hareket yönünü taşıyınca
  kullan.
- [ ] İleri/geri/sol/sağ seçimini world yönünden değil, birimin local velocity
  bileşenlerinden üret.
- [ ] Aim-walk üst gövde ve alt gövde ayrımını, tam klip ile layered yaklaşım
  arasında görsel olarak karşılaştır.

### 9.2 Turn

- [ ] `turn_90_left` için gerçek dönüş state/event ihtiyacını değerlendir.
- [ ] Geçerli bir sağ dönüş klibi olmadığı ve `turn_90_right` duplike olduğu için
  tek yönlü turn sistemini otomatik olarak devreye alma.
- [ ] Sağ dönüş gerekirse sol klibin güvenli mirror seçeneğini ayrı teknik spike
  olarak değerlendir.

### 9.3 Dodge, dive ve fall

- [ ] `driveMotion` authorlanan dodge/dive kliplerini yalnızca gerçek dodge
  gameplay action'ı tasarlanırsa bağla.
- [ ] Animasyon kök hareketini collision/navigation otoritesiyle uzlaştırmadan
  dekoratif dodge oynatma.
- [ ] Fall/land kliplerini yalnızca RTS birimleri için gerçek airborne/fall state'i
  eklenirse kullan.

### 9.4 Block ve melee

- [ ] `standing_block`, melee kick ve melee punch kliplerini ranged attack
  varyantı olarak kullanma.
- [ ] Yakın mesafe savunması veya melee fallback mekaniği tasarlanırsa ayrı combat
  kararı ve kabul kriterleriyle ele al.

## 10. Doğrulama Matrisi

Her TypeScript diliminden sonra varsayılan hızlı doğrulama:

```powershell
npx.cmd tsc --noEmit
npm.cmd run test:engine -- --filter "Skeletal animasyon,Archer"
```

Filtreli test `PARTIAL` sonuçtur; tam yeşil build sayılmaz.

Browser-facing her fazda:

- [ ] `?editor` Skeletal Mesh Editor önizlemesinde console/page error yok.
- [ ] RTS runtime'da oyuncu ve düşman Actor'ları doğru asset/materyali kullanıyor.
- [ ] Normal oyun kamerasında ölçek, yön, team readability ve geçişler kabul
  edildi.
- [ ] 20 ve 40 gerçek Archer instance ile animasyon/frame bütçesi ölçüldü.
- [ ] Kullanıcı kabulü plan günlüğüne tarihli kaydedildi.

Geniş runtime/schema değişikliği veya commit öncesinde:

```powershell
npm.cmd run build:verify
```

## 11. Teslim Kapısı

Plan ancak aşağıdaki maddeler birlikte tamamlandığında kapatılır:

- [ ] Faz 1 locomotion kodu, otomasyonu ve kullanıcı görsel kabulü tamamlandı.
- [ ] Faz 2 mavi/kırmızı Imagegen dokuları ve takım materyalleri kabul edildi.
- [ ] Faz 3 ranged attack, gerçek `attackCount` ile senkron ve görsel olarak kabul
  edildi.
- [ ] Faz 4 hit/death akışı gerçek olaylara bağlı ve görsel olarak kabul edildi.
- [ ] Faz 5 için ya zengin atış döngüsü/socket/notify tamamlandı ya da açık
  maddeler ayrı backlog'a taşındı.
- [ ] Duplike `turn_90_right` hiçbir runtime sözleşmesine girmedi.
- [ ] Root-motion authoring ile simülasyon konumu arasında drift yok.
- [ ] Oyuncu/düşman takım ayrımı texture üzerinden okunuyor; geçici full-model
  tint kaldırıldı.
- [ ] `npm.cmd run build:verify` temiz geçti.

## 12. Uygulama Günlüğü

- 2026-08-12 — `Archer.glb` incelendi: 40 animasyon, 70 kemik, tek skinned
  primitive, tek materyal; manifest/material/texture hazırlığı doğrulandı.
- 2026-08-12 — Root-motion satırları kullanıcı tarafından Skeletal Mesh Editor
  üzerinden authorlandı. Duplike `Archer_standing_turn_90_right` klibinin runtime
  tarafından göz ardı edilmesine karar verildi.
- 2026-08-12 — Bu kontrol listesi oluşturuldu. İlk uygulama dilimi Faz 1 Actor
  bağlantısı ve locomotion olarak sabitlendi; Imagegen takım dokuları Faz 1
  görsel kabulünün arkasına yerleştirildi.
- 2026-08-12 — Faz 1 kod/otomasyon dilimi tamamlandı: oyuncu ve düşman Actor'ları
  `archer` assetine bağlandı; ileri/geri locomotion rolleri ile iki deterministik
  idle varyantı authorlandı. Geçici takım tintleri ve `selectionRadius: 0.39`
  korundu. `npx.cmd tsc --noEmit` geçti; dar engine filtresinde 22 kontrol geçti,
  1414 kontrol filtre nedeniyle atlandı (`PARTIAL`). Dünya içi görsel kabul ve
  buna bağlı Faz 2 kapısı açık bırakıldı.
- 2026-08-12 — Faz 1 görsel kabul hazırlığı eklendi: ana `gameplay_proof`
  açılışına dokunmadan `archer_locomotion_acceptance` preseti iki tarafa yalnız
  10'ar Okçu verecek şekilde oluşturuldu. Dar engine filtresi 23 kontrolle geçti
  (`PARTIAL`); Chromium smoke 1/1 geçti ve gerçek Actor paketi, sıfır placeholder,
  10+10 Okçu ile page/console error olmadığını doğruladı. Nihai locomotion görünümü
  kullanıcı kabulünü bekliyor.
