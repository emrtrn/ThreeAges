# ThreeAges — Worker Animasyon ve Aktivite Entegrasyon Planı

Oluşturulma tarihi: 2026-08-13  
Durum: **Devam ediyor — Faz 1/1A tamamlandı; Faz 2'nin otomasyonu tamam, dünya içi diz çökme geçiş kabulü bekliyor.**

## 1. Amaç

`public/assets/ThreeAges/Characters/Worker/Worker.glb` içindeki 33 animasyonu RTS
Worker biriminde aşamalı biçimde kullanmak; önce güvenli temel locomotion'ı
kurmak, ardından Worker'ın gerçek işiyle eşleşen aktivite animasyonlarını,
prop/soket bağlantılarını ve sunumsal efektleri eklemek.

Bu planın hedefi yalnızca daha çok klip oynatmak değildir. Her animasyon,
simülasyonun gerçekten ürettiği bir Worker durumunu doğru ve okunur biçimde
göstermelidir.

## 2. Değişmez Kurallar

- Birimin konumu, yönü, hızı, rotası, iş ataması, üretim miktarı, kaynak taşıması,
  hasarı ve ölüm kararı simülasyonun otoritesinde kalır.
- Animasyon, montage ve notify yalnızca gerçekleşmiş durumu gösterir; ekonomi
  tick'ini, kaynak kazancını, inşaat ilerlemesini veya saldırı sonucunu belirlemez.
- Root-motion kaynağı `Worker.skeleton.json` ve Skeletal Mesh Editor'dür. Kullanıcı
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

- [x] `Worker.glb` manifestte `worker` kimliğiyle kayıtlı.
- [x] Yeni GLB, önceki 8 klip yerine toplam 33 klip taşıyor; geometri değişmeden
  25 yeni animasyon eklenmiş.
- [x] GLB; 1 skin, 33 eklem, 1 skinned primitive, 86.782 vertex ve 60.000 triangle
  içeriyor.
- [x] Model yaklaşık 1,86 m yüksekliğinde ve standart `mixamorig:*` rig ailesini
  kullanıyor.
- [x] Birebir aynı animasyon verisi taşıyan duplicate klip bulunmadı.
- [x] `gltf-transform validate` hata vermedi.
- [x] `NODE_SKINNED_MESH_NON_ROOT` uyarısı kaydedildi; entegrasyon öncesinde
  destructive mesh değişikliği gerektiren bir doğrulama hatası yok.
- [x] GLB içinde texture yok; kalıcı görünüm dış sidecar materyalinden geliyor.
- [x] `Worker.materials.json` slot 0'ı `m-worker-material` materyaline bağlıyor.
- [x] `M_Worker.material.json`, 2048×2048 `Worker_BC.png` base-color texture'ını
  kullanıyor.

### 3.2 Mevcut runtime bağlantısı

- [x] `BP_RTS_Worker.actor.json` `worker` assetini kullanıyor.
- [x] `BP_RTS_Enemy_Worker.actor.json` `worker` assetini kullanıyor.
- [x] `Worker.skeleton.json` temel `idle`/`walk`/`run` `animationSet` rollerini authorlıyor; `animationVariants` boş kalıyor.
- [x] Mevcut RTS animasyon seçicisi `idle`, `walk`, `run`, `work`, `attack`, `hit`
  ve `death` gibi semantic rolleri destekliyor.
- [x] Mevcut Worker sunum verisi bütün ekonomik işleri tek bir `working` bayrağıyla
  bildiriyor; tarım, inşaat, hasat ve hayvancılık henüz ayırt edilmiyor.
- [x] Worker için oyuncu/AI materyal ayrımı bulunmuyor; iki taraf modelin kendi
  renklerini kullanıyor ve takım okunurluğu seçim halkasına dayanıyor.

### 3.3 Root-motion başlangıç durumu

- [x] Kullanıcı tarafından on hareket klibi için `lockXYZ` authorlandı.
- [x] Temel `Worker_walking` ve `Worker_running` klipleri kilit listesinde.
- [x] Kutu, elde taşıma ve el arabası yürüyüş klipleri kilit listesinde.
- [x] Ham glTF rig adı `mixamorig:Hips`; Three.js runtime yolunun sanitize ettiği
  `mixamorigHips` adı mevcut sidecar'da kayıtlı.
- [x] Temel yürüyüşün ham root ilerlemesi yaklaşık 1,69 m, koşunun yaklaşık
  3,01 m; RTS'de bu ilerleme gameplay hareketiyle çift uygulanmamalı.
- [ ] Dönüş kliplerinin root translation/rotation davranışını dünya içinde ayrıca
  doğrula; doğrulanmadan turn havuzuna ekleme.

## 4. Animasyon Kataloğu ve Hedef Kullanımlar

| Grup | Klipler | Hedef kullanım | Başlangıç kararı |
| --- | --- | --- | --- |
| Temel | `Worker_idle_natural`, `Worker_walking`, `Worker_running` | Stand, normal hareket | Faz 1 |
| Yön/dönüş | `Worker_left_strafe`, `Worker_left_strafe_walking`, `Worker_right_turn`, `Worker_right_turn_90` | Yön değiştirme sunumu | Faz 6 backlog kapısı |
| Tarım | `Worker_dig_and_plant_seeds`, `Worker_plant_a_plant`, `Worker_plant_tree`, `Worker_watering`, `Worker_pull_plant_1/2` | Ekim, dikim, sulama ve söküm | Faz 3 |
| Hasat | `Worker_pick_fruit_1/2/3` | Meyve/ürün toplama | Faz 3 |
| Hayvancılık | `Worker_cow_milking` | Süt üretimi/hayvan işi | Faz 3 |
| Nötr iş pozu | `Worker_kneeling_idle` | Spesifik klip bulunmayan yerde güvenli fallback | Faz 2 |
| Elde taşıma | `Worker_holding_idle`, `Worker_holding_turn_left/right`, `Worker_holding_walk` | Görünür yük taşıma | Faz 4; prop zorunlu |
| Kutu | `Worker_box_idle`, `Worker_box_turn_left/right`, `Worker_box_walk_arc` | Depo/market lojistiği | Faz 4; Crate prop zorunlu |
| El arabası | `Worker_wheelbarrow_idle`, `Worker_wheelbarrow_walk_1/2`, `Worker_wheelbarrow_walk_turn_left/right`, `Worker_wheelbarrow_dump` | Yük taşıma/boşaltma | Faz 4; yeni prop zorunlu |
| Referans | `T-Pose` | Editor/rig kontrolü | Runtime havuzuna girmez |

Assette Worker'a özgü attack, hit veya death klibi bulunmuyor. Bu eksik roller
başka kliplerle yanıltıcı biçimde doldurulmayacak.

## 5. Sabit Tasarım Kararları

### K-01 — Uygulama sırası

Fazlar aşağıdaki sırada ilerler:

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
socket, montage ve notify verileri `Worker.skeleton.json` içinde tutulur. Ancak
"hangi işi yapıyor" bilgisi sidecar'da tahmin edilmez; gerçek Worker atama
sisteminden sunuma aktarılır.

### K-03 — İş çeşitliliği kare başına rastgele seçilmez

Bir Worker aynı işin ortasında her döngüde ilgisiz başka bir harekete geçmez.
Varyant seçimi birim kimliği, aktivite türü ve iş başlangıç/iş çevrimi sayacıyla
deterministik yapılır. Aktivite değişmeden seçimin kararlı kalması tercih edilir.

### K-04 — İnşaat için yanlış araç hareketi kullanılmaz

Assette çekiç veya belirgin yapı onarım klibi yok. Tarım klipleri inşaat/onarım
rolüne yalnız isim zenginliği uğruna bağlanmaz. Faz 2'de nötr diz çökme fallback'i
kullanılır; gerçek inşaat klibi veya uygun prop bulunursa ayrıca authorlanır.

### K-05 — Prop görünürlüğü ve animasyon birlikte değişir

Kutu, yük ve el arabası için animasyon seçimi ile prop görünürlüğü aynı
presentation state'inden beslenir. Animasyon değişip prop bir kare geriden gelmez;
uzak animasyon throttle'ı prop görünürlüğünü geciktirmez.

## 6. Faz 1 — Actor Bağlantısı ve Temel Locomotion

**Durum:** ✅ Tamamlandı — kullanıcı dünya içi locomotion kabulü: 2026-08-13.
**Amaç:** Yeni Worker modelini iki takımın Actor'ına bağlamak ve yalnız kanıtlı
idle/walk/run kliplerini çalıştırmak.

### 6.1 Actor ve materyal bağlantısı

- [x] `BP_RTS_Worker.actor.json` içindeki skeletal mesh `assetId` değerini
  `worker` yap.
- [x] `BP_RTS_Enemy_Worker.actor.json` içindeki skeletal mesh `assetId` değerini
  `worker` yap.
- [x] Asset sidecar varsayılanı `m-worker-material` olarak doğrulandı; iki Actor için
  ayrı `materialSlot` override'ı gerekmedi.
- [x] `selectionRadius: 0.43` gameplay sözleşmesi korundu.
- [x] Model yönü, ölçeği ve zemin oturuşu dünya içi locomotion kabulünde doğrulandı.

### 6.2 Birincil semantic roller

| RTS rolü | Klip | Süre | Durum |
| --- | --- | ---: | --- |
| `idle` | `Worker_idle_natural` | 8,37 s | ✅ |
| `walk` | `Worker_walking` | 1,07 s | ✅ |
| `run` | `Worker_running` | 0,73 s | ✅ |

- [x] Üç temel rolü `Worker.skeleton.json.animationSet` içine ekle.
- [x] Bu fazda kutu, holding, wheelbarrow, strafe veya turn kliplerini genel
  locomotion varyantlarına ekleme.
- [x] `Worker_walking` ve `Worker_running` root-motion ayarlarını değiştirme.
- [x] Worker `moveSpeed: 6` ile walk/run eşiklerini ve playback rate'i test et.
- [x] Animasyonun birim konumu, rotası veya varış kararını değiştirmediğini pinle.

### 6.3 Otomasyon

- [x] İki Worker Actor'ının `worker` assetini kullandığını test et.
- [x] Sidecar'daki her temel rolün GLB'de gerçekten bulunduğunu test et.
- [x] `T-Pose` klibinin hiçbir runtime rolüne girmediğini test et.
- [x] `Worker.skeleton.json` normalize/save beklentilerini güncelle.
- [x] `npx.cmd tsc --noEmit` çalıştır.
- [x] `npm.cmd run test:engine -- --filter "Worker Faz 1"`
  eklenen kontrol etiketine karşılık gelen dar filtreyi çalıştır.

## 7. Faz 1A — Locomotion Dünya İçi Görsel Kabulü

**Durum:** ✅ Kullanıcı kabulü tamamlandı — 2026-08-13.
**Amaç:** Temel model bağlantısını iş animasyonlarıyla karıştırmadan kabul etmek.

### 7.1 Kabul ortamı

- [ ] Yalnız Worker ağırlıklı tekrar kullanılabilir bir kabul preseti oluştur.
- [ ] En az 10 oyuncu ve 10 AI Worker ile gerçek Actor paketinin yüklendiğini
  doğrula.
- [ ] Placeholder/T-pose, page error ve console error bulunmadığını browser smoke
  ile doğrula.

### 7.2 Kullanıcı görsel kontrolü

- [ ] Kısa hedefte yürüyüşe başlama ve duruşa dönüşü gözle.
- [ ] Uzun hedefte koşu döngüsünü ve playback hızını gözle.
- [ ] Açık alan, dar geçit ve kalabalık varışta ayak kaymasını kontrol et.
- [ ] Keskin yön değişiminde root drift, ters yön ve modelin gameplay kökünden
  ayrılmasını kontrol et.
- [ ] Idle klibinin tekrarında sıçrama veya her karede restart olmadığını doğrula.
- [ ] Modelin zemin altına girmediğini ve seçim halkasına doğru oturduğunu doğrula.
- [x] Kullanıcı locomotion kabulü kaydedildi: 2026-08-13 (`çalışıyor, devam et`).

**Çıkış kapısı:** Locomotion kullanıcı tarafından kabul edilmeden Faz 2 başlamaz.

## 8. Faz 2 — Güvenli Nötr Çalışma Sunumu

**Durum:** ⬜ Uygulama ve otomasyon tamamlandı; dünya içi diz çökme geçiş kabulü bekliyor.
**Amaç:** İşe özel state sözleşmesi kurulana kadar Worker'ın bütün iş noktalarında
statik durması yerine güvenli ve yanıltıcı olmayan bir çalışma pozu göstermek.

- [ ] `Worker_kneeling_idle` klibini Skeletal Mesh Editor'de loop ve geçiş
  davranışı açısından incele.
- [ ] Ani ayakta→diz çökmüş snap kabul edilemezse basit loop rolü yerine montage
  veya ek geçiş animasyonu gereksinimini kaydet.
- [x] `Worker_kneeling_idle`, tek ve stabil nötr `work` fallback'i olarak bağlandı;
  dünya içi görsel kabul hâlâ açık.
- [ ] İnşaat, onarım, çiftlik, maden, odun ve hayvan işlerinde aynı fallback'in
  anlam bozmadığını ayrı ayrı gözle.
- [x] `working` false olduğunda idle'a güvenli biçimde döndüğünü otomasyonla doğrula.
- [x] İşe yürürken `work` klibinin locomotion'dan önce başlamadığını otomasyonla test et.
- [x] İş bittiği veya Worker serbest bırakıldığı karede pozun temizlendiğini inşaat,
  maden ve ekonomi çıkış testleriyle doğrula.
- [x] Hedefli engine testlerini ve TypeScript kontrolünü çalıştır.
- [ ] Dünya içi görsel kabulü tarihli kaydet.

## 9. Faz 3 — İşe Göre Aktivite Sözleşmesi ve Animasyonlar

**Durum:** ⬜ Faz 2'yi bekliyor  
**Amaç:** Tek `working` bayrağını bozmadan, gerçek iş kaynağından gelen sunumsal
bir aktivite kimliğiyle doğru animasyon ailesini seçmek.

### 9.1 Aktivite veri sözleşmesi

- [ ] `RtsPresentationUpdate` için gameplay kararlarından türetilen, yalnız okunur
  bir `workerActivity`/`workKind` sözleşmesi tasarla.
- [ ] En küçük yeterli kategori kümesini belirle; ilk adaylar:
  `generic`, `construction`, `repair`, `cultivation`, `harvest`, `livestock`,
  `carryingBox`, `carryingLoad`, `wheelbarrow`.
- [ ] `Unit` içinde bu durumun yalnız sunum amaçlı olduğunu açıkça belgele.
- [ ] `WorkerConstructionSystem`, `EconomyProductionSystem` ve `PastureSystem`
  yalnız sahip oldukları gerçek atama bilgisini bildirir; renderer bina/resource
  kimliğinden iş tahmini yapmaz.
- [ ] Player emri, iş değişimi, bina yıkımı, kaynak tükenmesi ve Worker ölümü dahil
  bütün çıkış yollarında aktiviteyi temizle.
- [ ] Yeni sidecar rolü gerekiyorsa loader, validator ve test fixture'larını aynı
  dilimde güncelle.

### 9.2 Tarım ve hasat eşlemeleri

- [ ] `cultivation` için ana klibi görsel incelemeyle seç:
  `Worker_dig_and_plant_seeds`, `Worker_plant_a_plant` veya `Worker_watering`.
- [ ] Uygun tarım kliplerini deterministik varyant havuzuna ekle.
- [ ] `harvest` için `Worker_pick_fruit_1/2/3` varyantlarını incele ve bağla.
- [ ] `Worker_pull_plant_1/2` kliplerini yalnız söküm/hasat anlamı doğruysa kullan.
- [ ] Uzun 4,5–9,3 saniyelik kliplerin iş süresi değiştiğinde kesilme davranışını
  doğrula.
- [ ] İş animasyonu kaynak miktarı veya üretim tick'iyle senkron olmasa da gameplay
  sonucunu değiştirmediğini test et.

### 9.3 Hayvancılık

- [ ] `Worker_cow_milking` klibini gerçek süt/hayvan üretimi state'iyle eşleştir.
- [ ] İneğin/Worker'ın göreli konum ve yönünü kabul sahnesinde authorla.
- [ ] Hayvan yoksa veya iş iptal edilmişse sağma animasyonunun başlamadığını test et.
- [ ] Taming/shepherding için sağma klibini yeniden kullanma; uygun klip yoksa nötr
  fallback'i koru.

### 9.4 Deterministik çeşitlilik

- [ ] Aktivite başlangıcı veya tamamlanan iş çevrimi için sunumsal sequence sayacı
  gerekip gerekmediğine karar ver.
- [ ] Aynı Worker ve aynı aktivitede seçimin kararlı olduğunu test et.
- [ ] Farklı Worker'ların uygun klip havuzunda çeşitlilik gösterebildiğini test et.
- [ ] Aktivite değişmeden her loop'ta ilgisiz klibe sıçrama olmadığını test et.
- [ ] Save/load veya replay sonrasında sunum seçiminin gameplay state'ini
  değiştirmediğini doğrula.

**Çıkış kapısı:** Tarım, hasat ve hayvancılık için en az birer doğru dünya içi
aktivite kabul edilmeden Faz 4 tamamlanmış sayılmaz.

## 10. Faz 4 — Prop, Soket ve Taşıma Animasyonları

**Durum:** ⬜ Faz 3'ü bekliyor  
**Amaç:** Görünmez nesne taşıma hatası üretmeden kutu, genel yük ve el arabası
animasyonlarını oyuna kazandırmak.

### 10.1 Soket sözleşmesi

- [ ] Sol ve sağ el kemiklerini Skeletal Mesh Editor'de doğrula.
- [ ] Tek elle bağlanacak prop için el soketi, iki elle taşınacak prop için stabil
  el/gövde sahipliği tasarla.
- [ ] Soket adı ve transformlarını `Worker.skeleton.json` içinde authorla.
- [ ] Prop'un zemin, gövde ve ellerle kesişmediğini idle/walk/turn kliplerinde
  ayrı ayrı doğrula.

### 10.2 Kutu taşıma

- [ ] Mevcut `Crate.gltf` assetinin ölçek ve pivot uygunluğunu incele.
- [ ] `Worker_box_idle` ve `Worker_box_walk_arc` kliplerini Crate görünürlüğüyle
  aynı state'e bağla.
- [ ] `Worker_box_turn_left/right` kliplerinin root davranışını doğrula.
- [ ] Kutu işi bittiğinde prop'un kaybolması ile animasyon dönüşünün aynı karede
  gerçekleştiğini test et.

### 10.3 Genel elde taşıma

- [ ] `Worker_holding_idle` ve `Worker_holding_walk` için taşınacak gerçek yük
  türünü belirle.
- [ ] Yük yokken holding kliplerinin seçilemediğini test et.
- [ ] Yükü depoya bırakma sırasında prop görünürlüğü ve idle dönüşünü doğrula.

### 10.4 El arabası

- [ ] Uygun wheelbarrow assetini üret veya projeye ekle; prop olmadan klipleri
  bağlama.
- [ ] Teker pivotu, el tutuşu ve zemin yüksekliğini authorla.
- [ ] `walk_1/2` kliplerini deterministik ve görsel olarak anlamlı kullan.
- [ ] Dönüş kliplerinde oyun yönelimiyle çift dönüş oluşmadığını doğrula.
- [ ] `Worker_wheelbarrow_dump` klibini yalnız gerçek boşaltma olayı sırasında
  sunumsal one-shot olarak oynat.
- [ ] Boşaltma animasyonu kaynak transferini başlatmaz veya geciktirmez.

## 11. Faz 5 — Eksik Roller ve Takım Okunurluğu Karar Kapısı

**Durum:** ⬜ Faz 4'ü bekliyor

### 11.1 Attack, hit ve death

- [ ] Worker'ın avlanma/misilleme davranışı için uygun attack klibi bulunmadığını
  açık backlog olarak koru.
- [ ] Tarım klibini sahte saldırı klibi olarak kullanma.
- [ ] Hit/death asseti eklenene kadar mevcut fallback/procedural ölüm sunumunun
  davranışını doğrula.
- [ ] Yeni klip sağlanırsa gerçek `attackCount`, `impactCount` ve death state'ine
  Guard/Archer ile aynı olay-sonrası sunum ilkesiyle bağla.

### 11.2 Oyuncu/AI materyal ayrımı — isteğe bağlı

- [ ] Seçim halkasının normal RTS mesafesinde Worker takımını ayırmak için yeterli
  olup olmadığını kullanıcıyla değerlendir.
- [ ] Yetersizse mevcut UV atlasını koruyan mavi/kırmızı Worker base-color texture
  planı hazırla.
- [ ] Oyuncu ve AI materyallerini Actor `materialSlot` üzerinden ayır; asset
  varsayılanını değiştirerek iki tarafı birden boyama.
- [ ] Materyal değişikliğini locomotion ve iş animasyonu kabulünden ayrı bir görsel
  kapı olarak yürüt.

### 11.3 Turn/strafe backlog'u

- [ ] Mevcut local velocity ve facing verisinin Worker dönüş klipleri için yeterli
  olup olmadığını incele.
- [ ] Simülasyon yönelimiyle animasyon root dönüşünün üst üste binmediğini kanıtla.
- [ ] Yalnız gerçek bir yön state'i varsa strafe/turn semantic rolü ekle.
- [ ] Gerekli state yoksa klipleri kullanılabilir asset içeriği olarak tut, genel
  varyant havuzuna ekleme.

## 12. Faz 6 — Notify, VFX ve SFX

**Durum:** ⬜ İlgili iş kliplerinin görsel kabulünü bekliyor  
**Amaç:** Kabul edilmiş hareketleri küçük, bütçeli sunum efektleriyle güçlendirmek.

- [ ] Ayak teması notify zamanlarını walk/run kliplerinden ölç.
- [ ] Toprak kazma, dikim, meyve toplama, sulama, sağma ve wheelbarrow dump için
  yalnız görünür temas anlarını authorla.
- [ ] Notify'ları toz, küçük debris, su parçacığı ve ses tetikleme gibi sunumsal
  tüketicilere bağla.
- [ ] Notify hiçbir ekonomi miktarını veya iş tamamlanma anını belirlemez.
- [ ] Uzak animasyon cadence'inde notify atlama/çift atma olmadığını test et.
- [ ] Global hız limiti ve ayrı VFX bütçesiyle kalabalık Worker grubunu koru.
- [ ] Pause/resume, crossfade ve kesilen kliplerde kuyruk işaretlerinin yanlış
  zamanda atılmadığını test et.
- [ ] Her efekt için normal/uzak kamera okunurluğunu kullanıcıya göster.

## 13. Faz 7 — Performans, LOD ve Nihai Teslim

**Durum:** ⬜ Önceki fazları bekliyor  
**Gerekçe:** Worker 60.000 triangle ile mevcut Guard'dan yaklaşık 4 kat, Archer'dan
yaklaşık 2,9 kat daha ağır. Başlangıçtaki 8+8 Worker yaklaşık 960.000 triangle;
iki tarafta 22'şer Worker senaryosu yalnız Worker gövdelerinde yaklaşık 2,64
milyon triangle üretir.

### 13.1 Ölçüm

- [ ] 8+8, 16+16 ve 22+22 Worker için CPU frame, GPU frame, draw call, triangle
  ve animation mixer maliyetini ölç.
- [ ] Yakın/uzak kamera ve 15 Hz uzak animasyon throttle davranışını ayrı ölç.
- [ ] Idle, toplu hareket ve çoklu iş animasyonu sahnelerini karşılaştır.
- [ ] Prop'lu ve propsuz Worker maliyetini karşılaştır.
- [ ] Ölçüm sonuçlarını bu belgeye tarih ve donanım bilgisiyle kaydet.

### 13.2 Optimizasyon karar kapısı

- [ ] Mevcut maliyet bütçe içindeyse kaynak mesh kalitesini koru.
- [ ] Bütçe dışındaysa kaynak GLB'yi silmeden optimize edilmiş runtime türevi veya
  LOD yaklaşımını değerlendir.
- [ ] Mesh sadeleştirmenin skin ağırlıklarını, silueti, UV'yi ve animasyonları
  bozmadığını doğrula.
- [ ] Uzak Worker için gölge, animation cadence ve prop görünürlüğü maliyetlerini
  birlikte değerlendir.
- [ ] Optimizasyon öncesi/sonrası aynı kabul rotasında görsel karşılaştırma yap.

### 13.3 Nihai doğrulama

- [ ] `npx.cmd tsc --noEmit` temiz geçer.
- [ ] İlgili filtreli engine kontrolleri temiz geçer; filtreli sonucun `PARTIAL`
  olduğu raporda açıkça belirtilir.
- [ ] Geniş değişiklik ve teslim öncesinde `npm.cmd run build:verify` temiz geçer.
- [ ] Worker kabul presetinde page/console error yoktur.
- [ ] Player ve AI Worker; hareket, çalışma, prop, ölüm fallback'i ve seçim
  davranışında regresyon üretmez.
- [ ] Kullanıcı nihai dünya içi görünümü kabul eder.

## 14. Önerilen İlk Uygulama Dilimi

İlk uygulama oturumunda yalnız şu dar kapsam alınır:

1. Oyuncu ve AI Worker Actor'larını `worker` assetine bağlamak.
2. `idle`, `walk` ve `run` rollerini sidecar'a eklemek.
3. Kullanıcı-authored root-motion ayarlarını aynen korumak.
4. Actor/sidecar clip testlerini eklemek.
5. TypeScript ve hedefli engine testini çalıştırmak.
6. Worker locomotion kabul presetini hazırlayıp dünya içi kullanıcı kabuline
   sunmak.

Bu dilimde iş animasyonu, prop, yeni materyal, attack/hit/death, notify veya LOD
uygulanmaz. Böylece model bağlantısı ve locomotion sorunu varsa kök neden başka
sunum sistemleriyle karışmaz.

## 15. Teslim Kapısı

Plan ancak aşağıdaki koşullar birlikte sağlandığında tamam kabul edilir:

- [ ] Player ve AI Worker yeni `worker` assetini kullanıyor.
- [ ] Temel locomotion otomatik kontrolleri ve dünya içi görsel kabul tamam.
- [ ] En az nötr çalışma pozu ve tarım/hasat/hayvancılık aktivite ayrımı gerçek
  gameplay state'lerinden besleniyor.
- [ ] Prop gerektiren hiçbir klip görünmez propsuz oynatılmıyor.
- [ ] Attack/hit/death ve turn/strafe eksikleri uygulanmış veya açık backlog kararı
  olarak belgelenmiş.
- [ ] Performans ölçümü tamamlanmış ve gerekiyorsa optimizasyon uygulanmış.
- [ ] Tam doğrulama temiz geçmiş.
- [ ] Nihai kullanıcı görsel kabulü tarihli olarak kaydedilmiş.

## 16. Uygulama Günlüğü

- 2026-08-13 — `Worker.glb` salt-okuma incelendi. 33 animasyon, 33 eklem,
  86.782 vertex ve 60.000 triangle doğrulandı; GLB validation hatasız geçti.
- 2026-08-13 — Yeni dosyanın önceki 8 klibe 25 yeni animasyon eklediği ve mesh
  geometrisini değiştirmediği doğrulandı.
- 2026-08-13 — Mevcut Actor bağlantıları, boş semantic set, kullanıcı-authored
  root-motion verisi, materyal sidecar'ı, prop eksikleri ve performans riski
  kaydedildi.
- 2026-08-13 — Bu plan oluşturuldu; henüz runtime veya asset dosyası değiştirilmedi.
