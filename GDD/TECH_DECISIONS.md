# TECH_DECISIONS — Teknik Kararlar ve Forge Hizalaması

> **Proje:** Üç Çağ: Sınır Krallıkları
> **Belge türü:** Teknik Karar Kaydı (Forge platformuyla hizalama)
> **Sürüm:** 0.1
> **Durum:** Aktif — üretim başlamadan kilitlenecek kararların kaydı
> **Bağlı belgeler:** `GDD_MASTER_v0.2.md`, `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md`, `12_BALANCE_AND_GAME_DATA.md`, `10_CAMERA_CONTROLS_AND_UI.md`, `11_ART_ASSETS_AND_PRESENTATION.md`, kök `CLAUDE.md`

---

## 1. Dokümanın Amacı

GDD sistemleri "Forge + Codex" ortamında üretilecek diye yazılmış; ancak GDD belgeleri Forge'un **mevcut** yeteneklerini ve mimari sınırlarını (kök `CLAUDE.md`) referans almadan, çoğu sistemi sıfırdan planlıyor. Bu belge:

- GDD ile Forge platformu arasındaki teknik hizalama kararlarını tek yerde tutar,
- GDD'nin yeniden icat etmeyi planladığı, Forge'da hazır olan altyapıyı işaretler,
- master `§13.3` formatına uygun **Sapma** kayıtlarını içerir,
- üretim başlamadan kilitlenmesi gereken açık teknik kararları listeler.

Bir teknik karar GDD tasarım niyetini değiştiriyorsa, ilgili GDD belgesine kısa bir işaret düşülür ve sapma burada kaydedilir.

---

## 2. Forge Bağlamı (özet)

Kök `CLAUDE.md`'den kilit gerçekler:

- Forge, Three.js tabanlı yeniden kullanılabilir bir **oyun platformu şablonudur**; editör, runtime'ın bir modudur (`?editor`).
- Modül sınırları gerçektir: `engine/`, `editor/`, `builder/`. Oyun/proje sınırı `src/game` ve `src/project` içinde yaşar. **Oyun kodu `src/game`'de tutulur.**
- Editör (`src/editor/`) dinamik `?editor` import'u arkasında kalır; oyun build'ine dahil edilmez.
- Proje verisi yereldir: `public/project.3dgame.json`, `public/layouts/*.json`, `public/assets/*`.
- Dev-only mutasyon endpoint'leri (`/__save-layout`, `/__save-effect`, `/__import-asset`, …) `tools/saveValidator.ts` allowlist'i ile korunur. **Allowlist gotcha:** yeni `Layout*` / skeleton / effect alanları allowlist'e eklenmezse kayıtta sessizce düşer.

---

## 3. Karar Kayıtları

### TD-001 — GDD dosya konumu: `GDD/` (repo kökü)

- **Karar:** GDD belgeleri repo kökündeki `GDD/` klasöründe kalır; `docs/gdd/`'ye taşınmaz.
- **Gerekçe:** Repo zaten `docs/architecture/` ve `docs/planned/` kullanıyor; GDD ayrı bir set olarak kökte tutuluyor. Taşıma, düşük değerli mekanik bir iş ve tüm çapraz-bağlantıları yeniden kırar.
- **Etki:** master `§12` Codex kaynak örneği ve `00 §23` ağaç şeması `GDD/` gösterecek şekilde düzeltildi; `13` Faz 0 görevi buna göre yeniden ifade edildi.
- **Durum:** Kilitlendi.

### TD-002 — Oyun kodu konumu: `src/game` (Forge sınırı)

- **Karar:** RTS oyun mantığı Forge'un `src/game` (gerekirse `src/project`) sınırında yaşar. `13 §15`'teki düz `/src/core`, `/src/economy`, `/src/ai`… şeması **Forge sınırlarına yeniden eşlenir**; kök seviyesinde ayrı bir `/src/*` ağacı açılmaz.
- **Önerilen eşleme:**

  | 13 §15 modülü | Forge yerleşimi |
  |---|---|
  | `core/`, `data/`, `economy/`, `buildings/`, `territory/`, `logistics/`, `units/`, `combat/`, `ai/`, `victory/`, `telemetry/` | `src/game/<alan>/` |
  | `camera/`, `input/`, `ui/` | Mevcut Forge runtime + `src/game/ui`; editör tarafı `src/editor`'da kalır |
  | `world/map`, `world/navigation`, `world/fog` | `src/game/world/*`; sahne/asset yükleme Forge `public/` + manifest üzerinden |

- **Gerekçe:** `CLAUDE.md` oyun kodunun `src/game`'de yaşamasını ve editörün oyun build'inden ayrı kalmasını zorunlu kılar. Düz `/src` ağacı bu sınırı bozar.
- **Durum:** Kilitlendi (alt-klasör isimleri Faz 0'da netleşir).

### TD-003 — Oyun/denge verisi konumu: `public/game-data/` (Forge static + ayrı şema doğrulaması)

- **Karar:** `12 §3` ve `13 §15`'te önerilen `/game-data/` içeriği (balance, schema, presets, maps) Forge'un statik-servis modeline uyacak şekilde **`public/game-data/`** altında tutulur. Runtime bu JSON'ları `public/` kökünden salt-okunur yükler.
- **Save-validator ilişkisi:** `tools/saveValidator.ts` allowlist'i yalnızca **dev yazma endpoint'lerini** (layout/actor/skeleton/effect) korur. Denge verisi runtime'da salt-okunur olduğu için bu allowlist'e tabi **değildir**; ancak denge verisine ayrı bir JSON Schema doğrulama adımı (13 §17 "ID ve referans doğrulaması") eklenir.
- **`project.3dgame.json` ile ilişki:** Sahne/layout ve snap ayarları Forge'un mevcut `public/project.3dgame.json` + `public/layouts/*.json` yapısında kalır. Oyun kuralları verisi (kaynak/yapı/birim/çağ/AI) ayrı `public/game-data/*` dosyalarında tutulur; ikisi karıştırılmaz.
- **Gerekçe:** Forge'un veri sözleşmesini kırmadan GDD'nin veri-odaklı ilkesini korur; salt-okunur veri için validator allowlist gotcha'sını devre dışı bırakır.
- **Durum:** Önerilen varsayılan — Faz 0'da onaylanacak.

### TD-004 — Mevcut Forge yeteneklerini yeniden kullan (sıfırdan yazma)

- **Karar:** Aşağıdaki sistemler Forge'da hazırdır ve GDD'de sıfırdan planlansa bile **yeniden kullanılır / uyarlanır**, yeniden yazılmaz:

  | GDD sıfırdan planlıyor | Forge'da mevcut, uyarlanacak |
  |---|---|
  | RTS kamera, seçim, komut (`10`, `13` Faz 1) | Viewport kamera (pan/orbit/dolly), seçim, transform gizmo, undo/redo komut yığını |
  | glTF import + asset kataloğu (`11`) | Content Browser, `engine/assets/manifest.ts`, `/__import-asset` |
  | Parçacık/VFX (`11 §87`) | `engine/vfx` particle effect sistemi (`.effect.json`, schema 2) |
  | Sahne/layout kaydetme | `public/layouts/*.json` + `/__save-layout` |

- **Sınır:** RTS kamera davranışı (sabit yön, ekran kenarı kaydırma, imlece zoom) Forge editör kamerasından farklıdır; runtime RTS kamerası `src/game` içinde, mevcut kamera altyapısı üzerine kurulur.
- **Durum:** Kilitlendi.

### TD-005 — Editör/oyun ayrımı korunur

- **Karar:** RTS runtime `/` rotasında çalışır; editör `?editor` dinamik import'u arkasında kalır. Oyun build'i editör kodunu (ve dev endpoint'leri) içermez. `13`'ün "Editör Play" akışı Forge'un mevcut layout-kaydet + runtime-sekmede-aç davranışıyla uyumludur.
- **Durum:** Kilitlendi.

---

## 4. Sapma Kayıtları (master §13.3 formatı)

### Sapma S-001 — Klasör yapısı

**GDD:** `13 §15` kök seviyesinde düz `/src/core`, `/src/economy`, `/src/ai`… ağacı öneriyor.
**Uygulama:** Kod `src/game/*` altında, Forge'un `engine/editor/builder/src/game/src/project` sınırlarına eşlenir.
**Neden:** `CLAUDE.md` oyun kodunun `src/game`'de yaşamasını zorunlu kılar; düz ağaç editör/oyun bundle ayrımını bozar.
**Karar:** GDD güncellenmeyecek (13 kavramsal kalır); eşleme **TD-002**'de tutulur.

### Sapma S-002 — Veri klasörü

**GDD:** `12 §3` / `13 §15` `/game-data/` kök klasörü öneriyor.
**Uygulama:** `public/game-data/` (Forge static-serving) + ayrı JSON Schema doğrulaması.
**Neden:** Forge proje verisini `public/`'ten yükler; runtime salt-okunur veri validator allowlist'ine tabi değildir.
**Karar:** Uygulama düzeltilecek (yol `public/game-data/`); **TD-003**'te tutulur. Onay Faz 0'da.

---

## 5. Üretime Başlamadan Kilitlenecek Açık Teknik Kararlar

`13 §111` ve `Master §9.1` ile hizalı — Faz 0'da kapatılır:

- [ ] Forge içinde birim navigasyon çözümü (navmesh mi grid pathfinding mi; `05 §67` yol grafiği ile ayrı).
- [ ] Yapı placement grid ölçüsü ve yol grid ölçüsü (`04 §22`, `05 §21`).
- [ ] Kamera: perspektif mi ortografik mi (`10 §4` başlangıç tercihi hafif perspektif).
- [ ] Placeholder asset standardı (`13 §14`, `11 §8` pivot/ölçek).
- [ ] Birim hedef yoğunluğu (aynı anda aktif birim üst sınırı; `03 §42` nüfus + performans).
- [ ] Ana test çözünürlükleri (1366×768, 1920×1080; `13 §52`).
- [ ] Minimum hedef donanım.
- [ ] `public/game-data/` veri konumu onayı (**TD-003**).

---

## 6. Revizyon Notları

### Sürüm 0.1

- Forge platformuyla hizalama için ilk teknik karar kaydı oluşturuldu.
- TD-001 … TD-005 kararları ve S-001, S-002 sapmaları kaydedildi.
- Faz 0'da kilitlenecek açık teknik kararlar listelendi.
