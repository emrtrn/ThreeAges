# SCOPE_LOG — Kapsam Kararları ve Kesinti Kaydı

> **Proje:** Üç Çağ: Sınır Krallıkları
> **Belge türü:** Kapsam kaydı (scope decisions + cuts)
> **Sürüm:** 0.1
> **Durum:** Aktif — üretim boyunca güncellenir
> **Bağlı belgeler:** `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md`, `GDD_MASTER_v0.2.md`, `TECH_DECISIONS.md`

---

## 1. Dokümanın Amacı

Bu belge üretim sırasında alınan **kapsam** kararlarını (bir özelliği dahil
etme, erteleme, kesme) ve gerekçelerini tek yerde tutar. Teknik hizalama
kararları `TECH_DECISIONS.md`'de; tasarım kilit kararları `GDD_MASTER_v0.2.md
§7`'de kalır. Buradaki her giriş bir üretim kapısı (`13 §7–10`) veya scope-cut
sırası (`GDD_MASTER §8.4`) ile ilişkilidir.

Format:

```markdown
### SL-XXX — [Başlık] (YYYY-MM-DD)
- **Karar:** [Ne yapıldı]
- **Kapsam etkisi:** [Dahil / Ertelendi / Kesildi]
- **Gerekçe:** [Neden]
- **İlgili:** [Kapı / faz / belge]
```

---

## 2. Kapsam Kayıtları

### SL-001 — Oyun/denge verisi konumu `public/game-data/` (2026-07-15)

- **Karar:** Preset, sürüm ve (ileride) balance verisi `public/game-data/`
  altında salt-okunur JSON olarak tutulur. `TD-003` bu kararla **Kilitlendi**.
- **Kapsam etkisi:** Dahil (Faz 0 temeli).
- **Gerekçe:** Forge statik-servis modeliyle uyumlu; runtime salt-okunur yükler;
  dev save-validator allowlist'ine tabi olmaz (`TECH_DECISIONS §3 TD-003`).
- **İlgili:** Faz 0 (§17 Veri), `TECH_DECISIONS.md TD-003`.

### SL-002 — Faz 0 açık teknik kararlar için geçici varsayılan (2026-07-15)

- **Karar:** `TECH_DECISIONS §5`'teki açık teknik kararlar (kamera projeksiyonu,
  yapı/yol grid ölçüsü, pathfinding yöntemi, placeholder asset standardı, test
  çözünürlükleri, birim hedef yoğunluğu, minimum donanım) Faz 0'da **geçici
  varsayılanlarla** kaydedildi; ilgili faz geldiğinde teyit edilecek.
- **Kapsam etkisi:** Ertelendi (kesin karar ilgili faza).
- **Gerekçe:** Faz 0'ı kesin-karar tartışmalarıyla bloklamamak; "iki günü aşan
  altyapı projesine dönüşmeme" kabul kriteri (`13 §19`).
- **İlgili:** `TECH_DECISIONS.md §5`, `13 §9` karar kapıları.

### SL-003 — Starter-content demo asset temizliği (2026-07-15)

- **Karar:** Forge şablonundan gelen, Üç Çağ RTS için gereksiz demo asset'leri
  (`starter-content/` altında Dialogue, Localization, AI test range/boss demo,
  Actors, Levels/Land+MeshPaint, Script, bazı Props/George) depodan silindi;
  `public/assets/manifest.json` buna göre güncellendi (`check:assets` PASS).
  `tools/engine-tests.ts` içinde bu silinen demo dosyalarını doğrulayan 4 check
  (starter dialogue / localization / conversation / Boss Phase StateTree)
  kaldırıldı — ilgili parser/normalizer'lar inline-fixture testleriyle
  kapsanmaya devam ediyor.
- **Kapsam etkisi:** Kesildi (şablon demo içeriği; motor özellikleri kalır).
- **Gerekçe:** Şablon demo verisi projeye ait değil; testlerin silinen dosyalara
  bağımlılığı CI gate'ini (`test:engine`) kırıyordu. Motor kapsamı korunur.
- **İlgili:** Faz 0 (§17 Test), `tools/engine-tests.ts`, `build:verify` gate.

### SL-004 — AI Koçbaşı'nı dış yatak ekonomisine bağlı bıraktık (2026-07-16)

- **Karar:** Faz 8 "AI yapı hedefleri için kuşatma kullanıyor" kabul kriteri
  **açık bırakıldı**. §53 oranı Koçbaşı istiyor, AI onu üretmeye çalışıyor ve
  Kışla II engeli Faz 8'de kalktı — ama bu harita Koçbaşı'nı finanse edemiyor:
  iki güvenli yatak 300 taş / 200 altın veriyor, Kasaba çağı (150 taş) ve
  Kışla II (80 taş) sonrası tek bir 100 taşlık Koçbaşı için ~70 taş kalıyor.
- **Kapsam etkisi:** Ertelendi (Faz 8 → harita ekonomisi kararı).
- **Gerekçe:** Bu bir AI açığı değil, harita yazım açığı. GDD 08 §15 "ikinci ve
  üçüncü çağ için dış kaynak zorunlu" diyor — yani Koçbaşı zaten *dış* yatak
  ekonomisini şart koşuyor. Ancak `RTS_BLOCKOUT_MAP`'in iki dış yatağı da
  (`external_stone`, `external_gold`, z = 16) oyuncunun yarısında; AI'ın erişimi
  yok. Aynı §15 "Oyuncu ve AI kaynak erişim süreleri ölçülür, büyük fark
  olmamalıdır" diyor, dolayısıyla mevcut yerleşim kendi tasarım kuralını
  çiğniyor. Düzeltmek Faz 6 kaynak yerleşimine dokunmayı ve bir tasarım kararı
  vermeyi gerektiriyor (yataklar aynalansın mı, yoksa iki üssün ortasına mı
  taşınsın?) — Faz 8'in AI kapsamında tek taraflı alınacak bir karar değil.
- **İlgili:** `13 §48/§49` (Ordu), `08 §15`, `public/game-data/balance/resources.json`.

### SL-005 — AI üs anchor'larına ikinci aday slot eklenmedi (2026-07-16)

- **Karar:** Faz 8 "Birden fazla aday yapı alanı" görevi **mekanizma tarafında**
  tamamlandı (`AiBuildManager` bir yapının bütün adaylarını sırayla dener ve
  reddedileni §43 kara listesine alır), fakat haritaya ekonomi yapıları için
  ikinci aday slot **eklenmedi**; yalnız Ev'in altı adayı var.
- **Kapsam etkisi:** Kısıtlandı (harita kapasitesine bağlı).
- **Gerekçe:** Düşman üssünün 18 birimlik başlangıç kontrol yarıçapı Merkez
  (8×8), dört üretici (6×6), Depo, Kışla (8×8), altı Ev ve yol hattıyla dolu;
  ikinci bir 6×6 slot geometrik olarak sığmıyor. Ev slotlarından birini feda
  etmek nüfus tavanını 45'e düşürüyor ve §55 nüfus kilidi riskini geri getiriyor.
- **İlgili:** `13 §48` (Yapı ve genişleme), `src/game/rts/world/rtsMapBlockout.ts`.

### SL-006 — Minimap küçük sahne ölçeği nedeniyle kapsamdan çıkarıldı (2026-07-17)

- **Karar:** Minimap hiçbir ürün fazında üretilmeyecek; UI'da boş çerçeve,
  devre dışı ikon veya geleceğe ayrılmış alan bırakılmayacak. Navigasyon,
  tıklanabilir kritik bildirimler, world-space/ekran kenarı pingleri, stratejik
  nokta etiketleri ve kamera/kontrol grubu kısayollarıyla sağlanacak.
- **Kapsam etkisi:** Kesildi (Ürün A/B/C ve Faz 11 koşullu sistemlerinden).
- **Gerekçe:** ThreeAges sahneleri kamera ile yönetilebilecek kadar küçük olacak;
  minimap'in ekran alanı, bilgi tekrarı, fog senkronizasyonu, çizim ve test
  maliyeti sağladığı navigasyon faydasını aşar.
- **İlgili:** `13 §60`, `UI_PRODUCTION_PLAN_v0.1.md §6.8/§13`,
  `10_CAMERA_CONTROLS_AND_UI.md` kapsam hizalaması.

### SL-007 — Çağ ve bina seviyesi ayrıldı; üçüncü çağ sanat kaynağına bağlandı (2026-07-18)

- **Karar:** İlerleme tek eksenden (çağ = bina seviyesi) **iki bağımsız eksene**
  çevrildi: çağ sanat ailesini (`FirstAge`/`SecondAge`) ve yeni yapı/birlik
  açılımını belirler; bina seviyesi (Lv1–3) çağın *içinde*, **bina instance'ı
  başına** yükseltilir ve çağ kapısı yoktur. Çağ atlayınca sahibin tüm yapıları
  yeni çağın Lv1 modeline geçer ve seviyeleri sıfırlanır. **Üçüncü çağ
  (Krallık) ertelendi:** arşivde `ThirdAge` bina modeli yok.
- **Kapsam etkisi:** Dahil (iki çağ × üç seviye, uygulandı) / **Ertelendi**
  (üçüncü çağ — sanat kaynağı kararına bağlı).
- **Gerekçe:** Eski model SecondAge ve Level3 modellerini hiç kullanmıyordu:
  çağ atlama `structure.level`'ı 1'den 2'ye çekiyor, arşivdeki iki çağ ailesinin
  ve üçüncü seviyenin tamamı ölü kalıyordu. Ayrıştırma hem bu varlıkları oyuna
  sokuyor hem de seviye yükseltmesini çağ beklemeden anlamlı bir karar haline
  getiriyor (`KR-04`). Üçüncü çağ **kod değil sanat** bloklu — çağ→aile eşlemesi
  veriden çözüldüğü için (`rtsBuildingArt.ts`) bağlama işi küçüktür; eksik olan
  modellerin kendisidir. Oyunun adı "Üç Çağ" olduğu için bu kalıcı bir kesinti
  değil, sanat kararına bağlı bir ertelemedir.
- **Yan etki ve çözümü (kapandı):** Seviye kapısı kalkınca `Kışla Lv2`
  gerektiren Okçu ve Koçbaşı, Yerleşim çağında da açılabilir hale geldi —
  birim açılımı çağ temposundan koptu. Kapatıldı: birim verisine **ayrı bir çağ
  kapısı** eklendi (`UnitBalanceStats.productionBuildingId` + `requiredAge` +
  `requiredBuildingLevel`), yapılara da opsiyonel `requiredAge`. Okçu ayrıca
  Kışla'dan çıkarılıp kendi binasına taşındı (`archery_range` — Okçuluk Alanı,
  yalnız Kasaba çağı), yani `13 §2` maddesi 10'un "Okçu ayrı yapı yerine Kışla
  II içinde" kapsam kararı geri alındı. Böylece hem yapı hem birim tarafında
  kapı **çağ + seviye çifti**dir. Tablo: `02 §30.1`.
- **İlgili:** `docs/planned/THREEAGES_AGE_AND_LEVEL_PROGRESSION_PLAN.md`,
  `02 §24/§25/§30`, `04 §31`, `11 §7/§10/§83`, `12 §26/§29/§38`,
  `13 §42/§53/§55/§64`.

### SL-008 — Kuşatma birimi koçbaşı yerine menzilli topçu (2026-07-25)

- **Karar:** `06 §110`'daki "koçbaşı mı, mancınık mı" açık sorusu **topçu**
  lehine kapatıldı. `siege_placeholder` artık menzilli (`attackType: "ranged"`,
  menzil 15) ve gülleyi lob ederek atıyor; kimliği (yapıya 2.50, birime 0.35) ve
  kapısı (Kasaba + Kışla Lv2, 3 nüfus) değişmedi.
- **Kapsam etkisi:** Dahil (aynı birim yuvası, aynı veri sözleşmesi; melee →
  ranged bir denge + sunum değişikliği).
- **Gerekçe:** Koçbaşı kuşatmayı bir *yürüme* problemine çeviriyordu: duvara
  temas etmek zorunda olduğu için Karakol'un 12 menzilli okları bedava cevap
  oluyor, oyuncunun tek kararı "koru ve yürü" kalıyordu. 15 menzilli topçu
  savunmanın dışından ateş ederek kararı **konumlandırmaya** taşıyor; savunanın
  cevabı da netleşiyor — topu bulup üzerine gitmek. Menzil ilişkisi (topçu >
  en uzun bina savunması) `test:engine` içinde sözleşme olarak korunuyor.
- **Yan etki ve çözümü:** (1) Hedef tercihi rol bazlı oldu — topçu menzilindeki
  yapıyı askere yeğler (`engagementSystem`), diğer roller eskisi gibi askeri
  yeğler. (2) Ateş pozisyonu 15 birim uzakta geometrik seçildiği için ağaç/kaya
  üstüne düşebiliyor; `planAttack` artık reddedilen halkayı yakınlaştırarak
  (0.9 → 0.6 → 0.35 menzil payı) tekrar deniyor, yoksa top hiç ateş etmeden
  duruyordu. (3) Sunum: `cannonballSystem` (lob + toz patlaması) ve tekerlekli
  top silueti; `structureAttackVfx: "cannonball"` her hedefte geçerlidir.
- **İlgili:** `06 §9.1/§110`, `02 §30.1`, `04 §3.3`, `12 §33`,
  `public/game-data/balance/units.json`, `src/game/rts/combat/cannonballSystem.ts`.

### SL-009 — Topçu'nun seviye kapısı kaldırıldı: Kasaba Lv2 → Lv1 (2026-07-25)

- **Karar:** `siege_placeholder.requiredSettlementLevel` 2'den 1'e çekildi.
  Topçu artık Okçuluk Alanı gibi **Kasaba Çağı'na geçildiği anda** üretilebilir;
  üretim yapısı (Kışla), maliyeti, nüfusu ve kimliği değişmedi.
- **Kapsam etkisi:** Dahil (tek veri alanı; kapı makinesi olduğu gibi duruyor).
- **Gerekçe:** Kasaba'ya geçiş her krallığın merkez seviyesini Lv1'e sıfırlıyor
  (`02 §30`), dolayısıyla "Kasaba + Lv2" çağın *üstüne* ikinci bir yükseltme
  dayatıyordu: çağ rozetini yeni almış oyuncu Kışla panelinde hâlâ kilitli bir
  Topçu görüyor, "Kasaba Çağındayım ama Kasaba birimimi üretemiyorum" çelişkisi
  doğuyordu. Okçuluk Alanı çağla birlikte açılırken kuşatmanın bir üst basamakta
  beklemesi için tasarım gerekçesi yoktu — Kasaba'nın vaadi tam kadrosudur.
- **Yan etki ve çözümü:** (1) `siege_test` preset'i artık Kasaba Lv1'de açılıyor;
  senaryo hâlâ kapının öbür tarafında başlıyor, sadece kapı bir basamak aşağıda.
  (2) `AiUpgradeManager` sevkiyattaki hiçbir birim için gerekmiyor artık; kod
  duruyor çünkü kapı verinin (`requiredSettlementLevel`), bir retune birimi
  yeniden Lv1'in üstüne koyabilir. (3) Seviye ekseni kaldırılmadı — Kışla Lv2/Lv3
  hâlâ kuyruk kapasitesi veriyor, sadece yeni birlik türü açmıyor (`04 §3.3`).
- **İlgili:** `02 §30.1`, `04 §3.3`, `GDD_MASTER §9.3`,
  `public/game-data/balance/units.json`,
  `public/game-data/presets/siege_test.json`, `tools/engine-tests.ts`.

### SL-010 — Karakol Kasaba Çağı'nda okunu bırakıp Topçu'nun topunu alıyor (2026-08-07)

- **Karar:** Karakol'un savunma silahı artık çağa bağlı: Yerleşim'de ok
  (2 ok/yaylım, 1.6 sn), Kasaba'da **Topçu birliğinin topu** — aynı hasar (34),
  aynı çarpan tablosu (hafif 4 / ağır 4 / yapı 2.5), aynı atış aralığı (5.5 sn),
  tek gülle. Bunun için `defense` bloğu progression tier'ında **tamamen**
  geçersiz kılınabilir hale geldi (`attackVfx`, `impactEffect`, `attackCooldown`,
  `arrowsPerVolley`, `damageMultipliers`); önceden yalnızca `attackDamage`
  tier'a taşınabiliyordu.
- **Kapsam etkisi:** Dahil (mevcut kule yuvası, mevcut gülle sunumu; yeni sistem
  yok — veri sözleşmesinin genişlemesi + tek sunum dalı).
- **Gerekçe:** Kasaba kulesi 18 hasar × 1.2 çarpanla bir birliği öldürmek için
  4-5 el ateş ediyordu; oyuncunun gördüğü şey alevler içinde yürümeye devam eden
  bir asker oluyordu — kule "vuruyor ama işe yaramıyor" diye okunuyordu. Topçu
  zaten **bilerek** birliklere karşı etkili kılınmıştı (`12 §33`); Kasaba
  kulesine aynı silahı vermek hem sunumu (lob + patlama) hem de "bir el = bir
  ceset" okumasını tek kararla getiriyor. Kuleye ok ile top arasında ayrı bir
  denge ekseni açmak yerine silah **paylaşılıyor**, böylece top yeniden
  ayarlandığında kule de onunla birlikte hareket ediyor — bu ilişki
  `test:engine` içinde sözleşme olarak korunuyor.
- **Yan etki ve çözümü:** (1) Gülle bir uçuş süresine sahip olduğu için kulenin
  hasarı da beklemek zorunda; `StructureDefenseSystem` artık `unitCombat` ile
  aynı sözleşmeyi kullanıyor (sunum katmanı uçuş süresini döner, hasar top
  düşünce iner). Kendi kuyruğunu tutuyor çünkü birimlerin `PendingImpactQueue`'su
  `CombatHit` üretiyor ve onun saldıranı `Unit` — binayı oraya sokmak misilleme
  kurallarını sessizce değiştirirdi. (2) `PlacedStructure.defenseAttackDamage`
  (tek sayı) yerine `PlacedStructure.defense` (tüm blok) tutuluyor; silah
  değişimi bir sayı değişimi değil. (3) Tier ladder'ı hasarın artmasını
  şart koştuğu için Kasaba Lv2/Lv3 topu 38/42'ye çıkıyor — taban top (Lv1)
  Topçu ile birebir aynı. (4) Topçu birliğinin kendisi (180 can, ağır)
  tek el ile ölmeyen tek gövde; kasıtlı, aksi halde top-top karşılaşmasını
  ilk ateş eden kazanırdı. (5) `unit balance` kontrolündeki "siege exists to
  break buildings" iddiası (en yüksek çarpan sütunu = yapı) verinin bugünkü
  tasarımıyla çelişiyordu ve `main`'de zaten kırmızıydı; Topçu'nun yumuşak
  sütunu olmadığı için iddia iki gerçek ilişkiye çevrildi (yapıya karşı
  *gerekli* olmak + Okçu'nun en iyi sütununu her sınıfta geçmek).
- **İlgili:** `12 §33`, `06 §9.1`, `public/game-data/balance/buildings.json`,
  `src/game/rts/combat/structureDefenseSystem.ts`,
  `src/game/rts/combat/cannonballSystem.ts`,
  `src/game/data/validateGameData.ts`, `tools/engine-tests.ts`.

---

## 3. Referans — Scope-Cut Sırası

Takvim/teknik risk oluşursa özellikler `GDD_MASTER_v0.2.md §8.4` sırasıyla
ertelenir (Save/load → Süvari → Kolay/Zor AI → Bölgesel zafer → Fog →
Refah mekaniği → Okçu ayrı binası → Yol II → Kule → Gelişmiş telemetri →
Gelişmiş VFX → Kontrol grupları). Kesilmemesi gereken Ürün A çekirdeği aynı
bölümde listelidir.

---

## 4. Revizyon Notları

### Sürüm 0.1 (2026-07-15)

- Belge oluşturuldu (Faz 0 §17 "SCOPE_LOG.md oluştur").
- SL-001 … SL-003 kayıtları eklendi.

### Sürüm 0.2 (2026-07-16)

- Faz 8 (AI-2) kapsam kararları: SL-004 (Koçbaşı ↔ dış yatak ekonomisi) ve
  SL-005 (üs anchor kapasitesi) eklendi.

### Sürüm 0.3 (2026-07-17)

- SL-006 ile minimap küçük sahne ölçeği nedeniyle bütün ürün kapsamından
  çıkarıldı; minimapsiz navigasyon yüzeyleri UI planına bağlandı.

### Sürüm 0.4 (2026-07-18)

- SL-007 ile çağ/seviye ayrıştırması kayda geçirildi ve üçüncü çağ ThirdAge
  sanat kararına bağlandı. GDD 02, 04, 11, 12 ve 13 buna göre güncellendi.
- SL-007'nin yan etkisi (birim kapısının çağdan kopması) ayrı çağ kapısı ve
  Okçuluk Alanı ile kapatıldı; `02 §30.1` ve `04 §8.2` eklendi.

### Sürüm 0.5 (2026-07-25)

- SL-008 ile kuşatma birimi koçbaşından menzilli topçuya çevrildi; `06 §9.1`
  yeniden yazıldı, `06 §110` ve `GDD_MASTER §9.3` açık soruları kapatıldı.
- SL-009 ile Topçu'nun seviye kapısı kaldırıldı (Kasaba Lv2 → Lv1); Kasaba
  kadrosunun tamamı artık çağ geçişiyle birlikte açılıyor. `02 §30.1` ve
  `04 §3.3` buna göre güncellendi.
