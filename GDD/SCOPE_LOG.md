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
