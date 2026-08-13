# ThreeAges — Okçu Animasyon ve Materyal Entegrasyon Planı

Oluşturulma tarihi: 2026-08-12  
Durum: **Uygulanıyor — Faz 1 geri çekilme görsel yeniden kabulü açık. Faz 2
materyal görünümü, Faz 3 atış, Faz 4 layered hit ve Faz 5 gerçek ok çıkışı
kullanıcı tarafından kabul edildi; Faz 5 recovery/reload görsel kabulü açık.**

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
- [x] Oyuncu/düşman için ayrı mavi ve kırmızı Archer base-color dokuları mevcut.

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
- [x] Actor yönü, zemin oturuşu ve ölçeğini Guard ile aynı sahnede karşılaştır.

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
- [x] Locomotion oynatma hızının Okçu `moveSpeed: 6.2` ile ayak kayması
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

- [x] Aynı anda en az 10 oyuncu ve 10 düşman Okçu oluştur.
- [x] Kısa hedef, uzak hedef, açık alan ve dar geçitte walk/run gözle.
- [ ] `T` geri çekilme emrinde walkBack/runBack yönünü gözle.
- [x] Dururken idle varyantlarının birimler arasında çeşitlilik gösterdiğini,
  aynı birimde restart sonrası değişmediğini doğrula.
- [x] Modelin gameplay kökünden ayrılmadığını ve başlangıç noktasına sıçramadığını
  doğrula.
- [ ] Ayak kayması, T-pose, ters yön, zemin altına girme veya her karede klip
  restart gözlenmediğinde kullanıcı kabulünü tarihli olarak kaydet.

**Faz 1 çıkış kapısı:** Locomotion kullanıcı tarafından kabul edilmeden Faz 2
texture üretimi başlamaz.

## 5. Faz 2 — Imagegen Takım Dokuları ve Materyaller

**Durum:** 🟨 Doku/materyal authoring'i ve AI bağlantısı tamamlandı — görsel kabul bekleniyor
**Amaç:** Guard ile aynı yöntemle oyuncu için mavi, AI için kırmızı base-color
texture üretmek ve tam-model tint ihtiyacını kaldırmak.

### 5.1 Imagegen üretim sözleşmesi

- [ ] Kaynak referans olarak mevcut `Archer_BC.png` dosyasını kullan.
- [x] `ArcherBlue_BC.png` üretildi; takım kumaşları mavi olacak şekilde authorlandı.
- [x] `ArcherRed_BC.png` üretildi; aynı takım bölgeleri kırmızı olacak şekilde authorlandı.
- [x] Çıktılar tam `1024×1024` PNG olarak kaydedildi.
- [ ] Ten, yüz, saç, deri, metal, yay, ok, dikiş, gölge ve alpha sınırlarının
  konumunu değiştirme.
- [ ] Mavi/kırmızı görsellerin birbirinden yalnızca takım rengi bakımından
  ayrıldığını karşılaştır.
- [ ] UV adaları arasında generative taşma, seam, yeni çizgi, yüz bozulması veya
  eksik parça varsa çıktıyı reddet ve yeniden üret.

### 5.2 Manifest ve materyal bağlantısı

- [x] Mavi texture'ı manifestte `archerblue-bc` olarak kaydet.
- [x] Kırmızı texture'ı manifestte `archerred-bc` olarak kaydet.
- [x] `M_Archer.material.json` base-color kaynağını `archerblue-bc` yap.
- [x] `M_ArcherAI.material.json` oluştur ve base-color kaynağını
  `archerred-bc` yap.
- [x] Her iki materyalde aynı `archer-n`, roughness ve diğer yüzey ayarlarını
  kullan.
- [x] Oyuncu Actor'ına `materialSlot: "m-archer-material"` ata.
- [x] Düşman Actor'ına `materialSlot: "m-archer-material-copy"` ata.
- [x] Oyuncu Actor'dan kalan `materialTint` değerini kaldır.
- [x] Düşman Actor'dan geçici `materialTint` değerini kaldır.
- [x] `Archer.materials.json` slot 0 varsayılanının oyuncu materyali olarak
  kaldığını doğrula.

### 5.3 Görsel kabul

- [x] Skeletal Mesh Editor'de mavi ve kırmızı materyali aynı idle/walk/run
  klipleri üzerinde ayrı ayrı aç.
- [x] Ten ve metalin takım rengiyle boyanmadığını doğrula.
- [x] Oyun kamerasının yakın, normal ve uzak seviyelerinde iki orduyu ayırt et.
- [x] Gölge, normal map yönü, seam ve aşırı doygunluk kontrolü yap.
- [x] En az 20+20 Okçu ile materyal paylaşımı ve draw-call davranışını smoke et.
- [x] Kullanıcı mavi/kırmızı texture görünümünü kabul ettiğinde tarihi kaydet.

## 6. Faz 3 — Temel Menzilli Saldırı Sunumu

**Durum:** ✅ Kullanıcı kabulü tamamlandı
**Amaç:** Her gerçek `attackCount` artışında tek bir okun bırakıldığını okunur
biçimde göstermek; hasar/cooldown davranışını değiştirmemek.

### 6.1 İlk güvenli dilim

- [x] `attack` için ilk aday olarak `Archer_standing_aim_recoil` klibini seç.
  Güncel GLB denetimindeki gerçek süresi `0.733 s`; Skeletal Mesh Editor'de oyun
  kamerasına yakın açıyla görsel önizleme açık kabul maddesidir.
- [x] Klipi `attack` semantic rolüne ata; olay-senkron görsel okunabilirliği
  kullanıcı kabulünde doğrulanacak.
- [x] Saldırının yalnızca gerçek `attackCount` artışında bir kez başlamasını
  otomasyonla doğrula.
- [x] Yeni atış önceki action bitmeden gelirse yeni olayın klibi baştan
  başlattığını otomasyonla doğrula.
- [ ] Klip sırasında world-position drift varsa root-motion düzeltmesini yalnızca
  Skeletal Mesh Editor üzerinden yap.
- [x] Animasyon süresinin `attackCooldown: 1.6`, hasar, hedef veya projectile
  üretimini değiştirmediğini otomasyonla test et.

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

`archer_locomotion_acceptance` yalnızca boot/Actor ve locomotion kontrolü içindir:
mevcut AI `peaceSeconds: 600` penceresi kendiliğinden volley başlatmaz. Bu kabul
için oyuncu birliğine açık bir saldırı veya attack-move emri ver; alternatif
olarak ileride eklenecek yakın-temas kabul senaryosunu kullan.

- [x] Tek Okçu ile en az üç ardışık atış izle.
- [x] On Okçu volley halinde aynı hedefe ateş ederken klip restart ve cadence'i
  gözle.
- [x] Hedef değişimi, hedef ölümü ve menzil dışına çıkışta idle/aim geçişini
  gözle.
- [x] Projectile'ın karakter yönüyle tutarlı çıktığını doğrula.
- [x] Okçu ateş ederken modelin hedefe baktığını doğrula.

## 7. Faz 4 — Hasar Tepkisi ve Ölüm

**Durum:** ✅ Kullanıcı kabulü tamamlandı

### 7.1 Hit

- [x] `hit` birincili olarak
  `Archer_standing_react_small_from_front` kullan. GLB denetimindeki gerçek
  süresi `1.789 s`.
- [ ] `Archer_standing_react_small_from_headshot` klibini ilk dilimde genel
  varyant olarak bağlama; oyunda headshot olayı yokken yanlış anlam üretip
  üretmediğini görsel tasarım kapısında değerlendir.
- [x] Hareket hâlinde tam-gövde flinch ayak kaydırdığı için Guard'daki gibi
  `upperBodyBone: "mixamorigSpine"` katmanlamasını etkinleştir. Hit yalnızca
  bel üstünü oynatır; death tam gövde kalır.
- [x] Hit yalnızca gerçek `impactCount` artışında oynasın.
- [x] Önceliği `death > hit > attack > continuous pose/locomotion` olarak koru.

### 7.2 Death

- [x] `death` birincili olarak `Archer_standing_death_backward` kullan. GLB
  denetimindeki gerçek süresi `3.878 s`.
- [x] `Archer_standing_death_forward` klibini deterministik death
  varyantı olarak ekle.
- [x] Death tam gövde oynasın; üst-gövde katmanına alınmasın.
- [x] Ölüm klibinin sonuna kadar oynadığını, son karede donduğunu ve mevcut ceset
  penceresi sonunda kaybolduğunu doğrula.
- [x] Death animasyonu despawn'ın gameplay sorgularını geciktirmesin; ölü birim
  hedeflenebilir/komut alabilir hâle gelmesin.

### 7.3 Kabul

- [x] Duran, yürüyen ve koşan Okçuya Guard, Archer, kule ve yırtıcı kaynaklı
  hasar uygula.
- [x] Hareket hâlindeki hit sırasında ayak kayması olmadığını doğrula.
- [x] En az 10 ölümde iki death varyantının görüldüğünü doğrula.
- [x] Hızlandırılmış simülasyonda death klibinin kesilmediğini doğrula.
- [x] Kullanıcı hit/death görünümünü kabul ettiğinde tarihi kaydet.

## 8. Faz 5 — Zengin Atış Döngüsü, Socket ve Notify

**Durum:** 🟨 Recovery/reload ve notify görsel kabul kapısı

### 8.1 Atış döngüsü

- [x] `aim_recoil` sonrasında `Archer_standing_draw_arrow` (`1.033 s`) oynatan
  sunumsal recovery/reload dizisini `attackRecovery` semantic rolüyle tasarla.
- [x] Güncel `0.733 + 1.033 = 1.766 s` authored süreyi `1.60 s` gameplay
  cooldown'uyla güvenli kesme yoluyla uzlaştır: yeni gerçek atış recovery'yi
  anında kesip yeniden `aim_recoil` başlatır.
- [x] Reload animasyonu hiçbir durumda bir sonraki gerçek atışı geciktirmesin.
- [ ] `equip_bow` ve `disarm_bow` yalnızca gerçek silah hazırlama state'i
  tasarlanırsa bu döngüye girsin.

### 8.2 Ok çıkış noktası

- [x] `Archer_Arrow.glb` ayrık statik mesh'ini ve güncel Archer rig'inde kalan
  `mixamorigRightHand` kemiğini GLB denetiminde doğrula. Ayırma işlemi eski
  `mixamorig:arrow` kemiğini rig'den kaldırmıştır.
- [x] Mevcut Actor socket/runtime hattının skinned bone socket'i desteklemediğini
  ölç: socket'ler yalnızca editor önizlemesiyle sınırlıydı.
- [x] Gameplay'den bağımsız, yalnızca sunumun gerçek ok mesh'i başlangıç noktasını
  raporlayan bone/socket köprüsü ekle.
- [x] Generic küre tracer yerine gerçek ok mesh'ini `arrow-release` socket'inin
  world konumundan çiz; hasarın uygulandığı anı değiştirme.
- [x] Archer'ın gerçek ok olmayan generic küre tracer'ını kaldır; gerçek ok mesh'i
  hazır olana kadar atışın uçuş VFX'i görünmesin.
- [x] Yakın ve uzak hedeflerde okun elden/yaydan çıktığını gözle.

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
- [x] Faz 2 mavi/kırmızı Imagegen dokuları ve takım materyalleri kabul edildi.
- [x] Faz 3 ranged attack, gerçek `attackCount` ile senkron ve görsel olarak kabul
  edildi.
- [x] Faz 4 hit/death akışı gerçek olaylara bağlı ve görsel olarak kabul edildi.
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
- 2026-08-12 — Kullanıcı 10+10 sahnede yön/ölçek/zemin, ileri walk/run, idle
  çeşitliliği ve root-position davranışının çalıştığını; ancak `T` geri çekilmede
  Okçunun geri yürümek yerine dönüp ileri gittiğini bildirdi. Kök neden
  `CommandSystem.armRetreat()` ve `issueRetreatAt()` içindeki Guard-only rol
  filtresiydi; Archer geri çekilme kapsamına alındı. Regresyon testi Guard ve
  Archer'ın geri hedefe hareket ederken mevcut yönünü koruduğunu, worker/siege'in
  kapsama girmediğini pinliyor. `npx.cmd tsc --noEmit` geçti; retreat/Archer/
  Skeletal animasyon filtresinde 25 kontrol geçti (`PARTIAL`) ve Chromium kabul
  smoke'u 1/1 geçti. `T` davranışının görsel yeniden kabulü açık.
- 2026-08-13 — Kullanıcının authorladığı `ArcherBlue_BC.png`,
  `ArcherRed_BC.png`, `M_Archer.material.json` ve `M_ArcherAI.material.json`
  varlıkları incelendi. AI materyali manifestte `m-archer-material-copy` kimliğiyle
  `archerred-bc` dokusuna çözülüyor. Yalnız `BP_RTS_Enemy_Archer.actor.json`
  bu slota bağlandı ve eski turuncu full-model tint kaldırıldı; oyuncu Actor'ı ve
  oyuncu materyali değiştirilmedi. `npx.cmd tsc --noEmit` geçti; Archer/material
  slot filtresinde 12 kontrol geçti (`PARTIAL`). Browser doğrulaması aktif diğer
  oturum nedeniyle çalıştırılmadı; materyal görsel kabulü açık.
- 2026-08-13 — Faz 2 durum denetimi: iki doku da 1024×1024 PNG olarak doğrulandı.
  Oyuncu Actor `m-archer-material` (mavi), düşman Actor
  `m-archer-material-copy` (kırmızı) slotuna bağlı; iki Actor'da da geçici
  `materialTint` yok. Texture atlasının yüzey ayrıntılarını, seam'lerini ve oyun
  kamerasındaki takım okunabilirliğini kapsayan görsel kabul maddeleri açık
  bırakıldı.
- 2026-08-13 — `archer_locomotion_acceptance` Chromium smoke yeniden çalıştı:
  10 oyuncu + 10 düşman Okçu gerçek Actor paketiyle açıldı, placeholder sayısı
  sıfırdı ve page/console error görülmedi (1/1 geçti). Bu teknik smoke, Faz 2
  görünüm kabulünün yerine geçmez.
- 2026-08-13 — Kullanıcı Faz 2 mavi/kırmızı materyal görünümünü kabul etti.
  Faz 2 görsel kabul maddeleri ve teslim kapısı bu kabul ile kapatıldı.
- 2026-08-13 — Faz 3 ilk güvenli dilim: `Archer_standing_aim_recoil`, GLB
  denetiminde ölçülen `1.140 s` süresiyle `attack` semantic rolüne bağlandı.
  Sunum yalnızca gerçek `attackCount` artışını okur; damage, cooldown, hedef ve
  projectile üretiminde değişiklik yapılmadı. Dünya içi atış görünümü kabulü
  açık bırakıldı.
- 2026-08-13 — `aim_recoil` klibinin `mixamorig:Hips` translation kanalında
  anlamlı authored hareket görüldü. RTS simülasyon konumunu korumak için mevcut
  sidecar root-motion authoring dilinde `lockXYZ` / `mixamorigHips` ayarı eklendi;
  dünya içi drift kabulü yine görsel doğrulama gerektirir.
- 2026-08-13 — Faz 3 ilk dilim doğrulandı: `npx.cmd tsc --noEmit` geçti;
  `Skeletal animasyon,Archer` filtresinde 24 kontrol geçti (`PARTIAL`) ve
  10+10 Archer Chromium boot smoke'u 1/1 geçti. Atış klibinin okunabilirliği,
  gerçek volley cadence'i, hedef dönüşü ve drift için dünya içi kullanıcı kabulü
  açık bırakıldı.
- 2026-08-13 — Faz 3 görsel QA keşfi: `archer_locomotion_acceptance` gerçek
  atış kabulü için tek başına uygun değil. Başlangıçta `peaceSeconds: 600` AI
  saldırısını engelliyor; ayrıca oyuncu birimlerinin çoğu başlangıç inşaat
  paleti altında kalıyor. Route boot/asset smoke olarak tutuldu; atış kabulü
  kullanıcı komutuyla veya ayrı yakın-temas senaryosuyla yapılacak.
- 2026-08-13 — Kullanıcı Faz 3 temel atış sunumunun çalıştığını kabul etti;
  Faz 3 kabul ve teslim kapısı kapatıldı. Faz 4 hit/death ilk dilimine geçildi.
- 2026-08-13 — Faz 4 hit/death ilk dilimi: `impactCount` için
  `Archer_standing_react_small_from_front`, death için backward birincili ve
  forward deterministik varyantı authorlandı. Üç klibin de Hips translation'ı
  `lockXYZ` ile sidecar'da kilitlendi. `npx.cmd tsc --noEmit` geçti; `Skeletal
  animasyon,Archer` filtresinde 24 kontrol (`PARTIAL`) ve 10+10 Archer Chromium
  boot smoke'u 1/1 geçti. Hit/death dünya içi görsel kabulü açık.
- 2026-08-13 — Kullanıcı hareket hâlinde hit'in ayak sürüklettiğini bildirdi.
  Kök neden Archer sidecar'ında `upperBodyBone` olmamasıydı; hit tam gövde
  oynuyordu. `mixamorigSpine` katmanı açıldı: hareket alt gövdede sürer, hit
  yalnızca bel üstünde oynar, death tam gövde kalır.
- 2026-08-13 — Kullanıcı layered hit/death görünümünü kabul etti; Faz 4 kabul ve
  teslim kapısı kapatıldı. Faz 5 ölçümünde sidecar socket'lerinin runtime
  tüketicisi olmadığı görüldü. `arrow-release` / `mixamorigarrow` için generic,
  yalnızca sunumsal bir socket köprüsü eklendi: tracer mevcut gerçek atıştan sonra
  bu world konumundan çıkar; hasar, cooldown ve hedef kararlarını değiştirmez.
  `npx.cmd tsc --noEmit` geçti; `Skeletal animasyon,Archer` filtresinde 24
  kontrol geçti (`PARTIAL`) ve 10+10 Archer Chromium boot smoke'u 1/1 geçti.
  Yakın/uzak hedefte okun yaydan çıkışının dünya içi görsel kabulü açık.
- 2026-08-13 — Kullanıcı generic küre tracer'ını gerçek ok olarak kabul etmedi.
  Archer'ın uçuş VFX'i kaldırıldı; `arrow-release` sidecar authoring verisi gerçek
  ok mesh'i geldiğinde kullanılmak üzere korunuyor. Hasar ve cooldown akışı
  değişmedi.
- 2026-08-13 — Kullanıcı `Archer_Arrow.glb` ayrık asset'ini ekledi ve manifestte
  `arrow` staticMesh'i olarak kaydetti. Ayırma eski `mixamorig:arrow` kemiğini
  rig'den çıkardığı için `arrow-release`, mevcut `mixamorigRightHand` kemiğine
  yeniden authorlandı. RTS prop hattı gerçek mesh'i bir kez yükler; her ranged
  gerçek atışta socket world konumundan bir kopya çıkar ve uçuş yönüne döner.
  Hasar/cooldown/hedef kararları değişmedi. `npx.cmd tsc --noEmit` geçti; Archer,
  Skeletal animasyon ve ranged filtrelerinde 25 kontrol geçti (`PARTIAL`). Dünya
  içi yakın/uzak atış görsel kabulü açık.
- 2026-08-13 — Kullanıcı gerçek okun çıkışını kabul etti. Archer GLB ayrıştırma
  sonrası `aim_recoil` süresi `0.733 s`, `draw_arrow` süresi `1.033 s` olarak
  yeniden ölçüldü; eski `1.140 s` ölçümü önceki GLB sürümüne aitti. Generic
  `attackRecovery` semantic rolü eklendi: attack bittiğinde draw-arrow başlar,
  ancak yeni `attackCount` artışı onu keser ve hiçbir gameplay cooldown'u
  bekletmez. Her iki klibin Hips translation'ı `lockXYZ` ile sabittir.
  `npx.cmd tsc --noEmit` geçti; `Skeletal animasyon,Archer` filtresinde 24
  kontrol geçti (`PARTIAL`). Recovery/reload dünya içi görsel kabulü açık.
