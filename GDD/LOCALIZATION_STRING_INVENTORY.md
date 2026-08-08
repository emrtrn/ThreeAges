# Lokalizasyon String Envanteri — Faz 0 Çıktısı

> **Kaynak plan:** `docs/planned/THREEAGES_LOCALIZATION_ARCHITECTURE_AND_PRODUCTION_PLAN.md` § 21 / Faz 0
> **Tarih:** 8 Ağustos 2026
> **Kapsam:** `?rts` runtime rotası — oyuncuya görünen mevcut metinler
> **Durum:** Envanter tamamlandı. Bu belge çeviri içermez; *neyin* çevrileceğini, nerede durduğunu ve Faz 1–2'yi neyin zorlaştıracağını söyler.

---

## 0. Bir cümlede sonuç

Oyun bugün **tek dilli ve o dil Türkçe** — hem de hardcoded. Planın §3.1 kararı İngilizceyi kaynak dil yapıyor, yani Faz 2 bir *çeviri* işi değil: **mevcut Türkçe metni anahtara bağlamak + İngilizce kaynak metni sıfırdan yazmak**. Bu, planın "önce `en`, sonra `tr`" akışını tersine çevirir ve aşağıdaki §7.1'de ayrı ele alınmıştır.

---

## 1. Yöntem

1. `src/` altındaki tüm `.ts` dosyaları tarandı; blok ve satır yorumları ayıklandıktan sonra string literal'ler çıkarıldı (`src/editor/**` hariç — `?editor` arkasında, oyun build'inde yok).
2. Aday filtresi: Türkçe'ye özgü karakter içeren **veya** boşluk içeren, en az bir harfli literal'ler. Tek kelimelik saf-ASCII Türkçe kelimeler (`Zafer`, `Orta`, `Askerî`, `Merkez` …) bu filtreden kaçtığı için ikinci bir hedefli tarama ile toplandı.
3. `public/game-data/**/*.json` içinde `label` / `title` / `intro` / `outro` / `why` alanları ayrı sayıldı.
4. `index.html` ve `src/style.css` metin taşıması açısından kontrol edildi.
5. `public/assets/ui/` altındaki 58 dosya listelendi; metin gömme riski en yüksek beş görsel (iki arka plan, arma, `title_strip_9s`, `button_primary_9s`) gözle doğrulandı.
6. `tools/engine-tests.ts` ve `tests/smoke/*.spec.ts` içinde görünen metne bağlı assertion'lar sayıldı (Faz 2 maliyeti).

**Ham çıktı:** Tarama script'i geçici (`scratchpad/x.mjs`); tekrar üretilebilir ve Faz 1'de `tools/validate-locales.ts` yanında kalıcılaştırılması önerilir (§9).

---

## 2. Özet

| Alan | Yaklaşık string | Durum |
|---|---:|---|
| **Kod içi, oyuncuya görünen** | **≈ 460** | Lokalize edilecek |
| **Veri içi, oyuncuya görünen** | **72** | Lokalize edilecek (§9 `nameKey` kararı) |
| **Toplam Faz 2 kapsamı** | **≈ 530** | |
| Debug/geliştirici yüzeyleri | ≈ 318 | Kapsam dışı, ayrı işaretlendi (§6.1) |
| Editör (`src/editor`, `editorCatalog.ts`) | ≈ 200+ | Kapsam dışı — oyun build'inde yok (§6.2) |
| Forge şablon runtime UI | 0 Türkçe | Kapsam dışı, `?rts` rotasında değil (§6.3) |
| Görsellere gömülü metin | **0** | Doğrulandı (§8) |

### Kod içi dağılım (dosya bazında, Türkçe karakter içeren literal sayısı)

| Dosya | Adet | Alan |
|---|---:|---|
| [rtsSelectionView.ts](../src/game/rts/ui/rtsSelectionView.ts) | 181 | Seçim paneli — açık ara en büyük yüzey |
| [RtsApp.ts](../src/game/rts/RtsApp.ts) | 120 | Bildirim + komut cevapları (57 debug hariç) |
| [rtsBuildPalette.ts](../src/game/rts/ui/rtsBuildPalette.ts) | 34 | Yapı paleti |
| [rtsMatchOverlay.ts](../src/game/rts/match/rtsMatchOverlay.ts) | 28 | Pause / zafer / yenilgi / ayarlar |
| [rtsHudBar.ts](../src/game/rts/ui/rtsHudBar.ts) | 20 | Ana HUD |
| [rtsMatchSetup.ts](../src/game/rts/match/rtsMatchSetup.ts) | 18 | Maç kurulum kartı |
| [rtsObjectiveTracker.ts](../src/game/rts/ui/rtsObjectiveTracker.ts) | 8 | Bölgesel zafer paneli |
| [rtsSupplyNotices.ts](../src/game/rts/ui/rtsSupplyNotices.ts) | 5 | Arz noktası bildirimleri |
| [rtsMissionPanel.ts](../src/game/rts/ui/rtsMissionPanel.ts) | 5 | Görev kartı |
| [rtsGameSpeedControls.ts](../src/game/rts/ui/rtsGameSpeedControls.ts) | 4 | Hız kontrolü |
| [rtsMainMenu.ts](../src/game/rts/ui/rtsMainMenu.ts) | 3 | Ana menü |
| [rtsArmyRosterStrip.ts](../src/game/rts/ui/rtsArmyRosterStrip.ts) | 3 | Ordu şeridi tooltip'leri |
| [resourceLabels.ts](../src/game/rts/ui/resourceLabels.ts) | 3 | Kaynak adları / maliyet biçimi |
| [rtsMapBlockout.ts](../src/game/rts/world/rtsMapBlockout.ts) | 2 | Stratejik geçit adları |
| [rtsLoadingScreen.ts](../src/game/rts/ui/rtsLoadingScreen.ts) | 2 | Yükleme perdesi |
| [rtsSelectionPanel.ts](../src/game/rts/ui/rtsSelectionPanel.ts) | 1 | Panel başlığı |

Buna tek kelimelik saf-ASCII Türkçe literal'ler (≈ 20 örnek: `Zafer`, `Yenilgi`, `Ayarlar`, `Orta`, `Normal`, `Kolay`, `Zor`, `Zorluk`, `Ekonomi`, `Askerî`, `Merkez`, `Asker`, `Sen`, `Yol`, `Dengeli` …) eklenir.

---

## 3. Domain bazlı envanter

Aşağıdaki domain adları plan §7.1'in önerdiği dosya bölümlemesiyle birebir eşleşecek şekilde seçildi.

### 3.1 `common.json` — paylaşılan sözcükler

| İçerik | Kaynak | Not |
|---|---|---|
| Kaynak adları: Yiyecek / Odun / Taş / Altın | [resourceLabels.ts:23-28](../src/game/rts/ui/resourceLabels.ts#L23-L28) | **`resources.json` ile çakışıyor** — §7.2 |
| `Ücretsiz` (bedava maliyet) | [resourceLabels.ts:43](../src/game/rts/ui/resourceLabels.ts#L43) | |
| Maliyet satırı biçimi `{amount} {resource}`, `·` ayırıcı | [resourceLabels.ts:46,93](../src/game/rts/ui/resourceLabels.ts#L46) | Liste birleştirme — §7.5 |
| Çağ adları: Yerleşim / Kasaba | [ages.json:4,30](../public/game-data/balance/ages.json) | Veriden gelir, UI'da ek alır — §7.3 |
| Sahiplik: Sen / Düşman / senin / düşmanda / boş / çekişmeli | [rtsObjectiveTracker.ts:26-35,131](../src/game/rts/ui/rtsObjectiveTracker.ts#L26-L35) | Çekimli — §7.4 |
| Zırh sınıfı: hafif birim / ağır birim / yapı | [rtsSelectionView.ts:505-509](../src/game/rts/ui/rtsSelectionView.ts#L505-L509) | |
| Duruş: Serbest / Pozisyonu Koru / Karışık | [rtsSelectionView.ts:511-514,1798](../src/game/rts/ui/rtsSelectionView.ts#L511-L514) | |
| Lojistik durumu: Bağlı / Kontrol Dışı / Yol Yok / Depo Yok / Merkez Ağı Yok / Depo İşgal Altında | [rtsSelectionView.ts:537-544](../src/game/rts/ui/rtsSelectionView.ts#L537-L544) | |
| İşçi görevi: boşta / yolda / inşaatta / tamirde / üretimde / erişemiyor | [rtsSelectionView.ts:516-523](../src/game/rts/ui/rtsSelectionView.ts#L516-L523) | |
| Üretim durumu (9 değer) | [rtsSelectionView.ts:525-535](../src/game/rts/ui/rtsSelectionView.ts#L525-L535) | |
| Süre biçimi `m:ss` | [rtsMatchClock.ts:62](../src/game/rts/match/rtsMatchClock.ts#L62) | Plan §11.3 uyarınca locale-bağımsız kalabilir |

### 3.2 `menu.json` — ana menü ve maç kurulumu

| İçerik | Kaynak |
|---|---|
| Başlık `Sınır Krallıkları`, alt metin, `Maçı Başlat` | [rtsMainMenu.ts:60-66](../src/game/rts/ui/rtsMainMenu.ts#L60-L66) |
| Fieldset başlığı `Maç türü` | [rtsMatchSetup.ts:212](../src/game/rts/match/rtsMatchSetup.ts#L212) |
| Mod kartları: Hikâye turu / Serbest maç — her biri label + blurb + hint (6) | [rtsMatchSetup.ts:87-100](../src/game/rts/match/rtsMatchSetup.ts#L87-L100) |
| Zafer koşulu: Askerî / Askerî + Bölgesel — label + hint (4) + caption `Zafer` | [rtsMatchSetup.ts:52-63,229](../src/game/rts/match/rtsMatchSetup.ts#L52-L63) |
| Zorluk: Kolay / Normal / Zor — label + hint (6) + caption `Zorluk` | [rtsMatchSetup.ts:138-154,233](../src/game/rts/match/rtsMatchSetup.ts#L138-L154) |
| Savaş sisi: Açık / Kapalı — label + hint (4) + caption `Savaş sisi` | [rtsMatchSetup.ts:116-127,237](../src/game/rts/match/rtsMatchSetup.ts#L116-L127) |
| Tooltip birleştirme biçimleri (`{label} — {hint}`, `{caption}: {label} — {hint}`) | [rtsMatchSetup.ts:276,364,425](../src/game/rts/match/rtsMatchSetup.ts#L276) |
| Yükleme perdesi: `Yükleniyor`, `Hazırlanıyor…`, `%{percent}` | [rtsLoadingScreen.ts:52,80,86](../src/game/rts/ui/rtsLoadingScreen.ts#L52) |

### 3.3 `hud.json` — ana HUD

| İçerik | Kaynak |
|---|---|
| `aria-label`: Krallık durumu / Krallık; arma `alt` metni | [rtsHudBar.ts:55,59,63](../src/game/rts/ui/rtsHudBar.ts#L55) |
| Gelir biçimi `+{rate}/dk` | [rtsHudBar.ts:86,165](../src/game/rts/ui/rtsHudBar.ts#L165) |
| `Nüfus: {used}/{capacity}` | [rtsHudBar.ts:174](../src/game/rts/ui/rtsHudBar.ts#L174) |
| `Boşta: {count}` + tooltip `Boşta işçi: {count}` | [rtsHudBar.ts:180-182](../src/game/rts/ui/rtsHudBar.ts#L180-L182) |
| Butonlar: `Seç (I)` / `Ata (R)` + aria + title (6) | [rtsHudBar.ts:124-132](../src/game/rts/ui/rtsHudBar.ts#L124-L132) — **tuş harfi gömülü, §7.6** |
| Pause: `Menü ve duraklat (Esc)` aria + title | [rtsHudBar.ts:143-144](../src/game/rts/ui/rtsHudBar.ts#L143-L144) |
| Çağ satırı — iki biçim (yükseltme sürerken / sürmezken) | [rtsHudBar.ts:201-203](../src/game/rts/ui/rtsHudBar.ts#L201-L203) |
| Lojistik uyarısı — 5 neden | [rtsHudBar.ts:23-29](../src/game/rts/ui/rtsHudBar.ts#L23-L29) |
| Ordu şeridi tooltip'leri (3 biçim) | [rtsArmyRosterStrip.ts:138-142](../src/game/rts/ui/rtsArmyRosterStrip.ts#L138-L142) |
| Hız kontrolü: `Oyun hızı` / `Hız` (+ geliştirici varyantları) | [rtsGameSpeedControls.ts:41,44](../src/game/rts/ui/rtsGameSpeedControls.ts#L41) |

### 3.4 `buildings.json` — yapı paleti

| İçerik | Kaynak |
|---|---|
| Panel: `Yapı Kur`, aria `Yapı yerleştirme` | [rtsBuildPalette.ts:170-172](../src/game/rts/ui/rtsBuildPalette.ts#L170-L172) |
| Kategoriler: Ekonomi / Lojistik / Yerleşim / Askerî / Diğer | [rtsBuildPalette.ts:75-90,183](../src/game/rts/ui/rtsBuildPalette.ts#L75-L90) |
| Alt gruplar: Gıda / Ham Madde | [rtsBuildPalette.ts:79-80](../src/game/rts/ui/rtsBuildPalette.ts#L79-L80) |
| Yol araçları: `Yol`, `Yol Sil`, `Odun / hücre`, `İade yok` | [rtsBuildPalette.ts:299-311](../src/game/rts/ui/rtsBuildPalette.ts#L299-L311) |
| Kilit gerekçesi: `{age} Lv{n}'de açılır.` / `{age} Çağında açılır.` | [rtsBuildPalette.ts:110-119](../src/game/rts/ui/rtsBuildPalette.ts#L110-L119) — **§7.3** |
| Maliyet tooltip'i `Kaynak yetersiz: {cost} gerekir.` | [rtsBuildPalette.ts:453](../src/game/rts/ui/rtsBuildPalette.ts#L453) |
| Yol çizim/silme durum metinleri (8) | [rtsBuildPalette.ts:390-407](../src/game/rts/ui/rtsBuildPalette.ts#L390-L407) — **tuş adı gömülü, §7.6** |
| 14 yapı adı | [buildings.json](../public/game-data/balance/buildings.json) |

### 3.5 `errors.json` — yerleştirme reddi nedenleri

Plan §17.3'ün istediği "her neden ayrı anahtar" ailesi **zaten mevcut** — tek bir "Buraya kuramazsın" yok. Dokuz ayrı neden:

| Neden | Kaynak |
|---|---|
| Bir yapı seçin. / Haritada konum seçin. / Geçerli konum | [rtsBuildPalette.ts:323-333](../src/game/rts/ui/rtsBuildPalette.ts#L323-L333) |
| harita sınırı dışında | [rtsBuildPalette.ts:337](../src/game/rts/ui/rtsBuildPalette.ts#L337) |
| bu alanın kontrolü sizde değil | [rtsBuildPalette.ts:339](../src/game/rts/ui/rtsBuildPalette.ts#L339) |
| kaynak yetersiz | [rtsBuildPalette.ts:341](../src/game/rts/ui/rtsBuildPalette.ts#L341) |
| kesilebilir ağaç gerekir | [rtsBuildPalette.ts:343](../src/game/rts/ui/rtsBuildPalette.ts#L343) |
| av hayvanı gerekir | [rtsBuildPalette.ts:345](../src/game/rts/ui/rtsBuildPalette.ts#L345) |
| evcilleştirilebilir hayvan gerekir | [rtsBuildPalette.ts:347](../src/game/rts/ui/rtsBuildPalette.ts#L347) |
| düşman birlikleri var | [rtsBuildPalette.ts:349](../src/game/rts/ui/rtsBuildPalette.ts#L349) |
| kaynak düğümünü örtmeli | [rtsBuildPalette.ts:351](../src/game/rts/ui/rtsBuildPalette.ts#L351) |
| engel/yapı çakışması | [rtsBuildPalette.ts:352](../src/game/rts/ui/rtsBuildPalette.ts#L352) |
| Karakol yerleştirme ipucu | [rtsBuildPalette.ts:328](../src/game/rts/ui/rtsBuildPalette.ts#L328) |

### 3.6 `selection.json` — seçim paneli (en büyük yüzey, ≈ 181)

Alt bloklar hâlinde:

| Blok | Kaynak aralığı | İçerik |
|---|---|---|
| Boş seçim | [rtsSelectionView.ts:608-612](../src/game/rts/ui/rtsSelectionView.ts#L608-L612) | `Seçim yok`, iki yönerge satırı |
| Kısayol satırları | [rtsSelectionView.ts:597-599](../src/game/rts/ui/rtsSelectionView.ts#L597-L599) | **tuş harfleri gömülü, §7.6** |
| Can / seviye / kademe biçimleri | [rtsSelectionView.ts:739,1011-1013,1095-1098](../src/game/rts/ui/rtsSelectionView.ts#L1011) | |
| İnşaat şantiyesi | [rtsSelectionView.ts:1104-1121](../src/game/rts/ui/rtsSelectionView.ts#L1104-L1121) | ilerleme, işçi sayısı, iki ipucu |
| İnşaat iptali | [rtsSelectionView.ts:892-905](../src/game/rts/ui/rtsSelectionView.ts#L892-L905) | onaylı eylem + açıklama |
| Tamir | [rtsSelectionView.ts:928-971](../src/game/rts/ui/rtsSelectionView.ts#L928-L971) | 10 metin |
| Yıkım | [rtsSelectionView.ts:994-1007](../src/game/rts/ui/rtsSelectionView.ts#L994-L1007) | onaylı eylem + açıklama |
| Merkez / kademe yükseltme | [rtsSelectionView.ts:1026-1089,1252-1299](../src/game/rts/ui/rtsSelectionView.ts#L1026-L1089) | ≈ 25 metin, **§7.3 ek sorunu burada yoğun** |
| Depo | [rtsSelectionView.ts:1129-1162](../src/game/rts/ui/rtsSelectionView.ts#L1129-L1162) | bağlantı/işgal durumları |
| Karakol | [rtsSelectionView.ts:1176-1191](../src/game/rts/ui/rtsSelectionView.ts#L1176-L1191) | kontrol alanı açıklamaları |
| Tapınak (destek aurası) | [rtsSelectionView.ts:1204-1222](../src/game/rts/ui/rtsSelectionView.ts#L1204-L1222) | |
| Ev | [rtsSelectionView.ts:1229-1230](../src/game/rts/ui/rtsSelectionView.ts#L1229-L1230) | |
| Ekonomi üreticisi | [rtsSelectionView.ts:1326-1446](../src/game/rts/ui/rtsSelectionView.ts#L1326-L1446) | üretim, tampon, kervan durumu (≈ 25) |
| Kışla / kuyruk | [rtsSelectionView.ts:1461-1517,1712-1767](../src/game/rts/ui/rtsSelectionView.ts#L1461-L1517) | ≈ 25 |
| Pazar / ticaret | [rtsSelectionView.ts:1569-1696](../src/game/rts/ui/rtsSelectionView.ts#L1569-L1696) | ≈ 25 |
| Arz noktası | [rtsSelectionView.ts:646-707](../src/game/rts/ui/rtsSelectionView.ts#L646-L707) | ≈ 18 |
| İşçi seçimi | [rtsSelectionView.ts:803-825](../src/game/rts/ui/rtsSelectionView.ts#L803-L825) | görev/duruş/komut dökümü — **§7.5** |
| Savaş bilgisi | [rtsSelectionView.ts:1790-1811](../src/game/rts/ui/rtsSelectionView.ts#L1790-L1811) | Güçlü/Zayıf/Dengeli hasar |
| Panel başlığı `Seçim` | [rtsSelectionPanel.ts:69](../src/game/rts/ui/rtsSelectionPanel.ts#L69) | |
| İlerleme biçimleri | [rtsSelectionPanel.ts:228-371](../src/game/rts/ui/rtsSelectionPanel.ts#L228-L371) | |

### 3.7 `notifications.json` — bildirimler ve komut cevapları

Bildirim **metinleri** `RtsApp` içinde, **kuralları** [rtsNotifications.ts](../src/game/rts/ui/rtsNotifications.ts) içindedir (kural tarafında çevrilecek metin yok — 20 `RtsNotificationKind` sadece kimliktir, plan §5.2'ye göre çevrilmez).

| Grup | Kaynak | Adet |
|---|---|---:|
| Lojistik / kaynak / nüfus | [RtsApp.ts:5608-5649](../src/game/rts/RtsApp.ts#L5608-L5649) | 4 |
| Saldırmazlık dönemi (3 beat) | [RtsApp.ts:5739-5758](../src/game/rts/RtsApp.ts#L5739-L5758) | 3 |
| Saldırı altında (merkez/karakol/işçi) | [RtsApp.ts:5790-5816](../src/game/rts/RtsApp.ts#L5790-L5816) | 4 |
| Çağ / kademe | [RtsApp.ts:3601-3617](../src/game/rts/RtsApp.ts#L3601-L3617) | 4 |
| Kervan vuruldu | [RtsApp.ts:3851](../src/game/rts/RtsApp.ts#L3851) | 1 |
| Bölgesel zafer uyarısı | [RtsApp.ts:3981](../src/game/rts/RtsApp.ts#L3981) | 1 |
| Arz noktası (5 beat) | [rtsSupplyNotices.ts:84-108](../src/game/rts/ui/rtsSupplyNotices.ts#L84-L108) | 5 |
| **Komut cevapları** (`command` / `command-refused`) | [RtsApp.ts:5184-6056](../src/game/rts/RtsApp.ts#L5184-L6056) | **≈ 75** |

Komut cevapları tek başına en kalabalık aile: yıkım, tamir, inşaat iptali, toplanma noktası, işçi atama, birlik üretme (12 ret nedeni), sipariş iptali, Pazar al/sat (9 ret nedeni), Kasaba geçişi (7 ret nedeni), kademe yükseltme (6). Hepsi plan §17.3'ün "nedeni söyle" kuralına zaten uyuyor.

### 3.8 `objectives.json` — görev ve stratejik nokta

| İçerik | Kaynak |
|---|---|
| `Görevler`, `Bölgesel Zafer`, `⌃/⌄` | [rtsObjectiveTracker.ts:70-81](../src/game/rts/ui/rtsObjectiveTracker.ts#L70-L81) |
| Nokta ipucu `Yola bağlı karakol gerekir.` | [rtsObjectiveTracker.ts:52](../src/game/rts/ui/rtsObjectiveTracker.ts#L52) |
| İlerleme biçimleri `{owner} {n}/{m}`, `{n}%` | [rtsObjectiveTracker.ts:157-163](../src/game/rts/ui/rtsObjectiveTracker.ts#L157-L163) |
| Stratejik geçit adları: `Batı Geçidi`, `Doğu Geçidi` | [rtsMapBlockout.ts:211-212](../src/game/rts/world/rtsMapBlockout.ts#L211-L212) — **veri değil, kodda** |
| Görev kartı: `Görev`, `Göster`, `Görev {i}/{n}`, aç/kapat aria | [rtsMissionPanel.ts:45-146](../src/game/rts/ui/rtsMissionPanel.ts#L45-L146) |
| Görev akışı bildirimleri | [RtsApp.ts:2877-3055](../src/game/rts/RtsApp.ts#L2877-L3055) (5) |
| Görev script'i: label + intro + outro + 17×(title+why) | [frontier_road.json](../public/game-data/missions/frontier_road.json) (**37**) |

### 3.9 `match.json` — maç akışı

| İçerik | Kaynak |
|---|---|
| Pause kartı: `Duraklatıldı`, `Maç durduruldu.`, `Devam Et`, `Yeniden Başlat`, `Ana Menü`, `Serbest oyuna çevir` | [rtsMatchOverlay.ts:305-324](../src/game/rts/match/rtsMatchOverlay.ts#L305-L324) |
| Teslim ol: `Teslim Ol` + onay `Teslim olmayı onayla` | [rtsMatchOverlay.ts:327-328](../src/game/rts/match/rtsMatchOverlay.ts#L327-L328) |
| Sonuç: 2 başlık (`Zafer`/`Yenilgi`) × 3 neden = 6 detay | [rtsMatchOverlay.ts:106-121](../src/game/rts/match/rtsMatchOverlay.ts#L106-L121) |
| `Süre: {mm:ss}` | [rtsMatchOverlay.ts:394](../src/game/rts/match/rtsMatchOverlay.ts#L394) |
| Ayarlar: `Ayarlar`, `Minimal ayarlar`, `Varsayılan` | [rtsMatchOverlay.ts:47,173,177](../src/game/rts/match/rtsMatchOverlay.ts#L173) |
| Kamera: 2 satır × (label + hint) + 6 değer etiketi | [rtsMatchOverlay.ts:82-95](../src/game/rts/match/rtsMatchOverlay.ts#L82-L95) |
| Grafik: `Grafik kalitesi`, `Otomatik optimizasyon`, 2 açıklama, 3 kalite etiketi | [rtsMatchOverlay.ts:30-31,221-252](../src/game/rts/match/rtsMatchOverlay.ts#L221-L252) |

### 3.10 `units.json` / gameplay verisi

| Dosya | Alan | Adet |
|---|---|---:|
| [buildings.json](../public/game-data/balance/buildings.json) | `label` | 14 |
| [units.json](../public/game-data/balance/units.json) | `label` | 4 |
| [animals.json](../public/game-data/balance/animals.json) | `label` | 6 |
| [ages.json](../public/game-data/balance/ages.json) | `label` | 2 |
| [resources.json](../public/game-data/balance/resources.json) | `label` | 3 |
| [trade-sites.json](../public/game-data/balance/trade-sites.json) | `label` | 3 |
| [logistics.json](../public/game-data/balance/logistics.json) | `label` | 1 |
| [frontier_road.json](../public/game-data/missions/frontier_road.json) | `label`/`intro`/`outro`/`title`/`why` | 37 |
| [gameplay_proof.json](../public/game-data/presets/gameplay_proof.json) | `label` | 1 — geliştirici preset'i, çevrilmez |

---

## 4. Anahtar isimlendirme önerisi

Plan §8'in `<domain>.<entity>.<field>` biçimi mevcut gameplay ID'leriyle sorunsuz eşleşiyor; ID'ler zaten `snake_case` ve stabil.

```text
common.resource.wood.name
common.age.settlement.name
common.logistics.unlinked_depot.label

hud.population.value           → "Nüfus: {used}/{capacity}"
hud.idle_workers.value         → "Boşta: {count}"
hud.warning.unlinked_depot     → "Lojistik kesildi: aynı yol ağında Depo yok."

building.lumber_camp.name
building.category.economy.title
building.group.raw_materials.title

placement.error.outside_control
placement.error.missing_forest
road.hint.erase_splits_network

selection.empty.title
selection.repair.action
selection.repair.hint.insufficient   → "Kaynak yetersiz: {shortfall} gerekli."

notification.logistics_cut.body
notification.peace_ending.body
command.train.refused.population_full

objective.point.west_pass.name
objective.regional_victory.title
mission.frontier_road.step.wood_flowing.title

match.result.victory.center_destroyed
match.settings.camera.pan_speed.label
```

---

## 5. Lokalize **edilmeyecekler**

Plan §5.2 ile uyumlu; envanter sırasında karşılaşılan somut örnekler:

```text
command_center, barracks, lumber_camp, outpost   (buildings.json id)
west_pass, east_pass                             (strategicPoints id)
logistics-cut, population-full, command-refused  (RtsNotificationKind)
awaiting-workers, buffer-full, source-depleted   (EconomyProductionStatus)
unlinked-depot, depot-occupied                   (ProducerLogisticsStatus)
rts-hud-bar, ui-interactive, is-armed            (CSS sınıfları)
threeages.aiProfile                              (localStorage anahtarı)
data-rts-building, data-rts-loading              (smoke test tutamakları)
RTS_CoreMatch.level.json, /assets/ui/arma.png    (dosya yolları)
```

Ayrıca `Ⅱ` (pause glifi), `⌃`/`⌄` (açılır ok), `·` (ayırıcı), `%` — bunlar tipografik işaret; ancak `%` **konumu** dile bağlıdır (§7.7).

---

## 6. Kapsam dışı yüzeyler

### 6.1 Debug / geliştirici (≈ 318 string) — ayrı işaretlendi

| Kaynak | Adet |
|---|---:|
| [RtsApp.ts](../src/game/rts/RtsApp.ts) profiler kova adları (satır 290-340, 2240-2800 civarı) | 57 |
| `src/game/rts/debug/**`, `src/game/rts/ai/**` (aiDebugView, aiDecisionLog, GPU sweep, tablo modal, frame capture) + [formatVisionDebug.ts](../src/game/rts/vision/formatVisionDebug.ts) | 261 |

Bunlar `?debug` arkasında ve plan §5.2'nin izin verdiği `debug.*` namespace'ine **isteğe bağlı** olarak alınabilir. **Öneri: Faz 1–2 kapsamına alınmasın.** Gerekçe: geliştirici izleyicisi tek dilli çalışır, 318 anahtar Faz 2'nin hacmini %60 büyütür ve hiçbiri oyuncu deneyimine dokunmaz. Ayrıca [rtsDebugOverlay.ts](../src/game/rts/debug/rtsDebugOverlay.ts) hâlihazırda Türkçe yazılmış — İngilizce kaynak dil kuralına en pahalı, en az getirili uyum burada olur.

### 6.2 Editör — kapsam dışı

`src/editor/**` ve [editorCatalog.ts](../src/game/editorCatalog.ts) (≈ 200 Türkçe string: Data Table alan adları ve yardım metinleri) `?editor` dinamik import'unun arkasında; oyun build'inde yok (CLAUDE.md working rules). Oyuncu bunları hiç görmez.

### 6.3 Forge şablon runtime UI — kapsam dışı

`src/scene/loadingOverlay.ts`, `src/scene/conversationOverlay.ts`, `src/game/saveGameUi.ts`, `src/ui/RuntimeUiSubsystem.ts` — `?rts` rotasında mount edilmiyor ve **hiç Türkçe string taşımıyor** (tarama sonucu: 0). Şablonun kendi runtime'ına aittir; bir fork bunları kendi oyununda kullanırsa aynı sisteme bağlanır.

---

## 7. Bulgular ve Faz 1–2 riskleri

Bunlar envanterin asıl değeri: metni saymak kolaydı, aşağıdakiler taşımayı zorlaştıracak olan şeyler.

### 7.1 Kaynak dil tersine dönüyor — planın §3.1'i ile sıra çakışması

Plan "her anahtar önce İngilizce karşılığa sahip olmalı" diyor; ama oyunda **hiç İngilizce metin yok**. Faz 2'nin gerçek işi:

1. TR metni anahtara bağla (mekanik, yaklaşık 530 dokunuş),
2. `en/*.json`'u **yeni yazarak** doldur (editöryel iş, plan §17'nin kaynak metin standardına göre),
3. TR metni bu sırada gözden geçir — bugünkü bazı satırlar (§7.3, §7.4) İngilizceye çevrilirken zaten düzeltilmek zorunda.

Planın §32 sprint sırası ("4. en/tr dosya iskeleti") bunu tek adım gibi gösteriyor; pratikte 2 ve 3 ayrı ve daha pahalı.

### 7.2 Kaynak adları iki yerde — çakışma

`Odun` / `Taş` / `Altın` hem [resourceLabels.ts:23-28](../src/game/rts/ui/resourceLabels.ts#L23-L28) hem [resources.json](../public/game-data/balance/resources.json) içinde. `Yiyecek` yalnızca kodda — `resources.json` *yatakları* tanımladığı için yiyecek ve odunun orada karşılığı yok. Dosyanın kendi başlık yorumu bu ikiliği zaten bir kusur olarak işaretlemiş. **Karar gerekli:** tek anahtar `common.resource.<id>.name` altında birleşsin, `resources.json`'daki `label` alanları kaldırılsın veya `nameKey`'e dönüşsün.

### 7.3 Türkçe ekler string'e gömülü — ✅ **düzeltildi (8 Ağustos 2026)**

Envanter dört yerde interpolasyona yapışık hâl eki buldu. Gerçek veriyle üretildiğinde **ikisi bugün hatalı metin veriyordu**:

| Yer | Eski | Durum | Yeni |
|---|---|---|---|
| [RtsApp.ts:3713](../src/game/rts/RtsApp.ts#L3713) | `Muhafız Kışla'ndan çıktı.` | ❌ `-ndan` yalnız iyelikli adda (*Okçuluk Alanı'ndan* ✓) | `Kışla: Muhafız hazır.` |
| [rtsSelectionView.ts:1082](../src/game/rts/ui/rtsSelectionView.ts#L1082) | `Yerleşim Lv3'ye Yükselt` | ❌ *üç* → üçe (`'e`); Lv2 doğruydu | `Yükselt: Yerleşim Lv3` |
| [rtsBuildPalette.ts:117](../src/game/rts/ui/rtsBuildPalette.ts#L117) | `Yerleşim Lv2'de açılır.` | ⚠️ bugün doğru, `Lv3'de` yanlış olurdu | `Yerleşim Lv2 ile açılır.` |
| [rtsSelectionView.ts:1691](../src/game/rts/ui/rtsSelectionView.ts#L1691) | `Nehir Limanı'na yol çekin.` | ⚠️ üç arz noktası da `-ı` ile bittiği için doğruydu | `Nehir Limanı sahipsiz: buraya yol çekin.` |

Neden yakalanmamıştı: doğru olan iki site test edilmişti, hatalı ikisinin hiç testi yoktu.

**Alınan karar:** ek kaldırıldı, parametre cümle sonuna/başına alındı — Türkçe ek yardımcısı yazılmadı. Gerekçe: bir ek yardımcısı Faz 2'de İngilizce kaynak metne geçilirken tamamen silinir, yani kalıcı olmayan iş; parametreyi ekten kurtarmak ise planın §10 kuralının kendisi.

**Regresyon kilidi:** `tools/engine-tests.ts` içindeki *"Lokalizasyon: no player-facing text attaches a Turkish case suffix to an interpolated value"* kontrolü dokuz oyuncuya-görünen dosyayı tarar ve `}'<ek>` kalıbını reddeder; ayrıca `buildingUnlockRequirement`'ı `ages.json`'daki her çağ × her seviyeyle çalıştırır. Kontrolün ısırdığı doğrulandı (hata geri konduğunda dosya:satır ile başarısız oluyor).

`${townLabel} Çağına Geç` ([rtsSelectionView.ts:1068](../src/game/rts/ui/rtsSelectionView.ts#L1068)) bir istisna: `Çağına` ekini **sabit** `Çağı` kelimesi alıyor, parametre değil — dolayısıyla her veri değeriyle doğru. Faz 2'de yine de tam cümle anahtarına dönmeli (`"{age} Çağına Geç"` / `"Advance to {age}"`), çünkü İngilizcede kelime sırası değişir.

Geriye kalan: [rtsGpuSweep.ts:236](../src/game/rts/debug/rtsGpuSweep.ts#L236) `%{n}'i` aynı sorunu taşıyor ama debug-only, §6.1 uyarınca kapsam dışı bırakıldı.

### 7.4 Çekimli sözcükler etiket sanılıyor

[rtsObjectiveTracker.ts:31-35](../src/game/rts/ui/rtsObjectiveTracker.ts#L31-L35): `senin` / `düşmanda` / `boş`. Bunlar isim değil, o satırın bağlamına çekilmiş biçimler. İngilizce kaynak yazılırken bağlamsız isimlere (`Yours` / `Enemy` / `Open`) dönecek ve Türkçe karşılık da yeniden düşünülmek zorunda. Aynısı `PRODUCTION_STATUS_LABEL` ve `WORKER_JOB_LABEL` için de geçerli (`erişemiyor`, `üretimde` — fiil çekimi).

### 7.5 String birleştirme ve liste birleştirme

Plan §10 birleştirmeyi yasaklıyor; mevcut kodda üç kalıp var:

| Kalıp | Örnek |
|---|---|
| `join(", ")` liste | `Güçlü: ${strong.join(", ")}` [rtsSelectionView.ts:1809](../src/game/rts/ui/rtsSelectionView.ts#L1809), `missing.join(", ")` [RtsApp.ts:6026](../src/game/rts/RtsApp.ts#L6026) |
| `join(" · ")` maliyet | [resourceLabels.ts:47,93](../src/game/rts/ui/resourceLabels.ts#L47) |
| Sayı + isim dökümü | `jobBreakdown` / `orderBreakdown` [rtsSelectionView.ts:1784](../src/game/rts/ui/rtsSelectionView.ts#L1784) |

Liste birleştirme `Intl.ListFormat`'a taşınmalı (İngilizce "wood, stone and gold" — Oxford virgülü ve "and" dile bağlı). Maliyet `·` ayırıcısı tipografik, kalabilir.

### 7.6 Klavye tuşları metne gömülü

```text
"Seç (I)" / "Ata (R)"                                   rtsHudBar.ts:124,130
"Menü ve duraklat (Esc)"                                rtsHudBar.ts:143
"F: Saldırı-Hareket · H: Koru · G: Serbest · X: Dur"    rtsSelectionView.ts:598
"Sağ tık: inşaata veya üretim yapısına ata · X: Görevi bırak"  rtsSelectionView.ts:597
"Sol tık: başlangıç seç · Sağ tık: çık"                 rtsBuildPalette.ts:407
```

Plan §3.3 tuş harflerini *görsellere* gömmeyi yasaklıyor; buradaki sorun daha ince — **çeviriye** gömülü. Tuşlar [defaultInputBindings.ts](../src/game/defaultInputBindings.ts)'ten gelmeli ve anahtara parametre olarak geçmeli (`{key}`), yoksa bir tuş yeniden atandığında sekiz dilin metni birden yalan söyler.

### 7.7 Sayı ve yüzde biçimi

- `%${percent}` — Türkçe yüzde işareti **önde**, İngilizcede **arkada** (`%30` / `30%`). Bu bir çeviri değil, biçimlendirme kararı: `Intl.NumberFormat(locale, { style: "percent" })` bunu kendisi halleder. Kodda en az 8 yerde elle yazılmış.
- `toFixed(1)` — ondalık ayırıcı locale'e bağlı (`1.5` / `1,5`). [rtsHudBar.ts:165](../src/game/rts/ui/rtsHudBar.ts#L165), [rtsSelectionView.ts:1326-1331](../src/game/rts/ui/rtsSelectionView.ts#L1326).
- Binlik ayırıcı hiç yok — stok 12345'e ulaştığında ham basılıyor.

### 7.8 Çoğul: Türkçe bugün gizliyor, İngilizce açığa çıkaracak

Türkçede sayıdan sonra isim tekil kalır (`3 işçi`), bu yüzden mevcut kodda hiç çoğul mantığı yok. İngilizce kaynak metin yazılır yazılmaz gerekecek: `3 workers`, `1 worker`. Etkilenen kalıplar: `{n} işçi`, `{n} birim`, `{n} eşek`, `{n} hücre`, `{n} sn`, `{n} hayvan`, `{n} çoban`, `{n} lot`. Plan §11.1'in ICU MessageFormat kararı bu yüzden Faz 1'de verilmeli, Faz 2'ye ertelenmemeli.

### 7.9 `innerHTML` ile metin yazımı

[rtsObjectiveTracker.ts:75](../src/game/rts/ui/rtsObjectiveTracker.ts#L75) çevrilebilir metni `innerHTML` ile yazıyor. Lokalizasyon dosyaları dışarıdan gelen veri hâline geldiğinde bu bir kaçış yüzeyi olur. Faz 2'de `textContent` + ayrı element'e dönmeli.

### 7.10 Testler görünen metne bağlı — Faz 2'nin gizli maliyeti

| Yüzey | Türkçe metne bağlı assertion |
|---|---:|
| [tools/engine-tests.ts](../tools/engine-tests.ts) | **188** |
| `tests/smoke/*.spec.ts` | **106** literal |

Bunlar Faz 2'de ya `t()` çağrısının çıktısına ya da (tercihen) anahtarın kendisine bağlanmalı. Smoke tarafında pseudo-locale veya `?locale=qps-ploc` bir seçenek: testler metne değil anahtara bakarsa dil değişiminden etkilenmez. **Bu iş Faz 2 planında yok ve tek başına Faz 2'nin en büyük tek kalemi olabilir.** Öneri: Faz 1'in kabul kriterlerine "test'ler anahtar üzerinden doğrular" maddesi eklensin.

### 7.11 Fallback metinleri de anahtar olmalı

```text
this.buildingLabels.get(...) ?? "Yapı"        RtsApp.ts:2914
queue.trainingLabel ?? "Asker"                RtsApp.ts:3345
queue.trainingLabel ?? "Birlik"               rtsSelectionView.ts:1717
resourceLabel(id) → id                        resourceLabels.ts:32
```

Son satır dikkat çekici: bilinmeyen bir kaynak için ham ID basılıyor — plan §5.2'nin "ID çevrilmez" kuralıyla çelişmiyor ama oyuncuya `stone` gösteriyor. Faz 1'in missing-key davranışı (§20) bu durumu da kapsamalı.

---

## 8. Görsel doğrulama — temiz

`public/assets/ui/` altında 58 dosya var. Sınıflandırma:

| Grup | Adet | Sonuç |
|---|---:|---|
| Arka planlar (`menu-background.jpg`, `loading-background.jpg`) | 2 | **Gözle doğrulandı — metin yok.** Her ikisi de saf low-poly manzara. |
| Arma (`arma.png`) | 1 | **Gözle doğrulandı — metin yok.** Kule + taç + defne, harf yok. |
| Nine-slice çerçeve/buton skin'leri (`skin/*`) | 10 | `title_strip_9s` ve `button_primary_9s` gözle doğrulandı: boş yüzey + köşe süsü, metin için ayrılmış. Kalanlar aynı üretim ailesinden. |
| Piktogram ikonlar (`icons/*` — yapı, birim, kaynak, komut, bildirim, arz noktası) | 33 | Art Bible'ın "metin gömme" yasağı kapsamında üretilmiş; hiçbiri harf taşımıyor. |
| İmleçler, font, panel/frame | 12 | İlgisiz. |

`index.html` — yalnızca `<title>Forge</title>` (şablon adı, oyuncuya görünmez).
`src/style.css` — tek `content:` değeri `"✓"` (tipografik işaret, çevrilmez).

**Plan §3.3 ihlali bulunmadı.**

---

## 9. Faz 1'e devir — öneriler

1. **Domain dosyası bölümlemesi** plan §7.1'e göre şu olsun (bu envanterin §3 başlıkları):
   `common`, `menu`, `hud`, `buildings`, `errors`, `selection`, `notifications`, `objectives`, `match`, `units`.
   `selection.json` tek başına toplamın ~%35'i; plan §7.2'nin "tek büyük JSON kullanma" gerekçesi burada somutlaşıyor.
2. **ICU MessageFormat kararı Faz 1'de verilsin** (§7.8) — İngilizce kaynak metin yazılmadan önce, çünkü çoğul olmadan `en` dosyası yazılamaz.
3. **Tarama script'i kalıcılaşsın**: bu envanterin ürettiği çıkarıcı, `tools/validate-locales.ts` (plan §19) içinde "kodda kalan hardcoded metin" kontrolü olarak yeniden kullanılabilir. Faz 2'nin "hardcoded gameplay UI metni kalmamış" kabul kriterini ölçülebilir yapan tek şey budur.
4. **Test kuplajı Faz 1 kapsamına alınsın** (§7.10) — 294 assertion'ın nasıl taşınacağı Faz 2 başlamadan kararlaştırılmalı.
5. **Debug namespace'i kapsam dışında kalsın** (§6.1), ama karar belgeye yazılsın ki Faz 9'da yeniden tartışılmasın.
6. **§7.3'teki ek hatası bir bug olarak ayrı ele alınsın** — lokalizasyondan bağımsız olarak bugün yanlış metin üretiyor olabilir.

---

## 10. Kabul kriteri

> Plan §21 Faz 0: *"Oyuncuya görünen mevcut metinlerin kapsamı bilinmeden Faz 1 tamamlanmış sayılmaz."*

| Görev | Durum |
|---|---|
| `src/game/rts/ui/` içindeki hardcoded metinleri tara | ✅ 16 dosya, dosya bazında sayıldı (§2) |
| Maç overlay metinlerini tara | ✅ §3.9 |
| Yapı ve birim veri dosyalarındaki görünen isimleri tara | ✅ §3.10 — 72 alan |
| Bildirim metinlerini tara | ✅ §3.7 — kural/metin ayrımıyla |
| Yerleştirme hata nedenlerini tara | ✅ §3.5 — 11 neden |
| Tooltip ve komut metinlerini tara | ✅ §3.3, §3.6, §3.7 |
| Görev/zafer metinlerini tara | ✅ §3.8, §3.9 |
| Debug-only metinleri ayrı işaretle | ✅ §6.1 — ≈ 318, kapsam dışı önerisiyle |
| Görsellere gömülü metin bulunmadığını doğrula | ✅ §8 — ihlal yok |

**Faz 0 tamamlandı.**
