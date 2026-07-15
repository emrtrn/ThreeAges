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

---

## 3. Referans — Scope-Cut Sırası

Takvim/teknik risk oluşursa özellikler `GDD_MASTER_v0.2.md §8.4` sırasıyla
ertelenir (Save/load → Süvari → Kolay/Zor AI → Bölgesel zafer → Fog/minimap →
Refah mekaniği → Okçu ayrı binası → Yol II → Kule → Gelişmiş telemetri →
Gelişmiş VFX → Kontrol grupları). Kesilmemesi gereken Ürün A çekirdeği aynı
bölümde listelidir.

---

## 4. Revizyon Notları

### Sürüm 0.1 (2026-07-15)

- Belge oluşturuldu (Faz 0 §17 "SCOPE_LOG.md oluştur").
- SL-001 … SL-003 kayıtları eklendi.
