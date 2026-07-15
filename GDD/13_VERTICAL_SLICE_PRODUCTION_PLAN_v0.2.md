# 13 — Vertical Slice Production Plan

> **Çalışma adı:** Üç Çağ: Sınır Krallıkları  
> **Doküman türü:** Üretim Planı — Sadeleştirilmiş Vertical Slice  
> **Sürüm:** 0.2  
> **Durum:** Üretime hazır kapsam taslağı  
> **Hedef geliştirme ortamı:** Forge + VS Code + Codex  
> **Ana üretim ilkesi:** Önce oynanış kanıtı, sonra tam maç, en son sunum  
> **Yerine geçtiği belge:** `13_VERTICAL_SLICE_PRODUCTION_PLAN.md` sürüm 0.1  
> **Bağlı belgeler:**
> - `00_GAME_VISION_AND_PILLARS.md`
> - `01_CORE_GAMEPLAY_LOOP.md`
> - `02_MATCH_FLOW_AND_PROGRESSION.md`
> - `03_ECONOMY_AND_RESOURCES.md`
> - `04_BUILDINGS_AND_SETTLEMENT.md`
> - `05_TERRITORY_LOGISTICS_AND_ROADS.md`
> - `06_UNITS_AND_COMBAT.md`
> - `07_ENEMY_AI_DESIGN_v0.2.md`
> - `08_MAP_AND_WORLD_DESIGN.md`
> - `09_VICTORY_DEFEAT_AND_DIFFICULTY.md`
> - `10_CAMERA_CONTROLS_AND_UI.md`
> - `11_ART_ASSETS_AND_PRESENTATION.md`
> - `12_BALANCE_AND_GAME_DATA.md`

---

## 1. Dokümanın Amacı

Bu doküman, GDD içinde tanımlanan oyunu Forge üzerinde güvenilir biçimde üretmek için sadeleştirilmiş ve aşamalı bir çalışma planı sunar.

Önceki plan sistemleri büyük teknik katmanlar halinde tamamlamayı öneriyordu. Bu sürümde yaklaşım değiştirilmiştir.

Yeni yaklaşım:

```text
En küçük baştan sona oynanış
→ Lojistik fikrinin eğlence testi
→ Tam çekirdek maç
→ İçerik ve ilerleme genişletmesi
→ Görsel sunum ve denge
```

Bu planın temel amacı bütün GDD özelliklerini mümkün olduğunca erken üretmek değildir.

Amaç:

> Yol, karakol, dış ekonomi ve savaş arasındaki ilişkinin gerçekten eğlenceli olduğunu en düşük maliyetle kanıtlamak; yalnızca kanıtlanan sistemleri tam vertical slice kapsamına taşımaktır.

---

## 2. Revizyonun Ana Kararları

Bu sürümde aşağıdaki üretim kararları alınmıştır:

1. Teknik katmanlar yerine oynanabilir dilimler kullanılacaktır.
2. Her ana faz baştan sona tamamlanabilen bir maç veya test senaryosu üretmelidir.
3. İlk oynanış kanıtı yalnızca iki kaynak ve tek askerî zafer kullanacaktır.
4. Dört kaynak, üç çağ ve ikinci zafer türü ilk prototipin ön koşulu değildir.
5. Refah ilk vertical slice içinde sert ilerleme koşulu olmayacaktır.
6. Save/load vertical slice zorunluluğundan çıkarılmıştır.
7. Tam telemetri sistemi yerine küçük ve hedefli test kayıtları kullanılacaktır.
8. Fog of war ve minimap çekirdek maç kanıtlandıktan sonra değerlendirilecektir.
9. Süvari vertical slice kapsamından çıkarılmıştır.
10. Okçu ayrı yapı yerine Kışla yükseltmesi veya Kışla II içinde açılacaktır.
11. Tek kuşatma birimi kullanılacaktır.
12. AI, `07_ENEMY_AI_DESIGN_v0.2.md` içindeki aşamalı modele göre üretilecektir.
13. İlk AI yalnızca ekonomi kurar, bir kez genişler, tek ordu üretir ve saldırır.
14. Asset entegrasyonu sona bırakılmayacak; ancak oynanış kanıtından önce görsel polish yapılmayacaktır.
15. Her kapsam genişletmesi bir üretim kapısına bağlanacaktır.

---

# BÖLÜM A — ÜRÜN HEDEFLERİ

## 3. Üç Ayrı Ürün Hedefi

Üretim tek bir büyük vertical slice hedefi olarak ele alınmayacaktır.

Üç ayrı ürün seviyesi bulunur:

1. Oynanış Kanıtı
2. Çekirdek Maç Prototipi
3. Sunulabilir Vertical Slice

Her seviye bağımsız olarak oynanabilir ve değerlendirilebilir olmalıdır.

---

## 4. Ürün A — Oynanış Kanıtı

### 4.1 Amaç

Oyunun ana ayırt edici fikrini test etmek:

```text
Kaynak üret
→ Yol bağla
→ Karakolla alan aç
→ Dış ekonomi kur
→ Ordu üret
→ Rakibin hattını boz
→ Merkezi yok et
```

### 4.2 Zorunlu içerik

#### Harita

- Küçük blockout harita
- Oyuncu ve AI başlangıç alanı
- Bir merkezi genişleme alanı
- En az iki yaklaşım rotası
- Bir karakol adayı
- Bir dış kaynak alanı

#### Kaynaklar

- Yiyecek
- Odun
- Nüfus

#### Birimler

- İşçi
- Muhafız

#### Yapılar

- Merkez
- Ev
- Yiyecek üretim yapısı
- Oduncu Kampı
- Depo
- Kışla
- Karakol

#### Sistemler

- RTS kamera
- Tekli ve kutu seçim
- Hareket ve saldırı komutu
- Yapı yerleştirme
- İşçi atama
- Basit kaynak üretimi
- Yol bağlantısı
- Kontrol alanı
- Karakolla genişleme
- Birim üretimi
- Basit savaş
- AI-1 rakip
- Merkez yıkımına bağlı askerî zafer
- Temel debug paneli

### 4.3 Bilinçli olarak bulunmayacaklar

- Taş
- Altın
- İkinci ve üçüncü çağ
- Okçu
- Kuşatma
- Süvari
- Refah
- Fog of war
- Minimap
- Bölgesel zafer
- Save/load
- Tam ayarlar menüsü
- Tam asset paketi entegrasyonu
- Gelişmiş AI utility sistemi

### 4.4 Başarı sorusu

Oynanış Kanıtı şu soruya cevap vermelidir:

> Oyuncu, yeni bölgeye yol ve karakol kurup dış ekonomisini savunurken anlamlı ve eğlenceli kararlar veriyor mu?

Bu soruya net biçimde “evet” denmeden Ürün B kapsamına geçilmez.

---

## 5. Ürün B — Çekirdek Maç Prototipi

### 5.1 Amaç

20–30 dakika hedefinden önce, 12–20 dakikalık tam ve tekrar oynanabilir bir RTS maçı üretmek.

### 5.2 Zorunlu içerik

#### Harita

- `İki Nehir Arası` blockout sürümü
- İki başlangıç alanı
- İki ana rota
- Bir yan rota
- İki dış ekonomi alanı
- Bir merkezi yüksek değer bölgesi

#### Kaynaklar

- Yiyecek
- Odun
- Taş
- Altın
- Nüfus

#### İlerleme

- Yerleşim
- Kasaba
- İki çağ seviyesi
- Refah yalnızca bilgi göstergesi veya tamamen kapalı

#### Birimler

- İşçi
- Muhafız
- Okçu
- Kuşatma birimi

#### Yapılar

- Merkez
- Ev
- Depo
- Tarla veya yiyecek üretim yapısı
- Oduncu Kampı
- Taş Ocağı
- Altın Madeni
- Kışla
- Karakol
- Kule, kapsam uygunsa
- Kuşatma üretimi Kışla II veya tek seviyeli Atölye üzerinden

#### Sistemler

- Tam dört kaynak ekonomisi
- Yerel tampon ve global stok
- Kontrol alanı
- Yol graph’ı
- Alternatif rota desteği
- İki çağ ilerlemesi
- Dört birim sınıfı
- Askerî zafer
- AI-2 çekirdek rakip
- Temel HUD
- Maç başlatma, bitirme ve yeniden başlatma
- Hızlandırılmış test modu
- Hedefli maç telemetrisi

### 5.3 Bilinçli olarak bulunmayacaklar

- Üçüncü çağ
- Bölgesel zafer
- Süvari
- Tam fog of war
- Tam minimap
- Save/load
- Çoklu zorluk seviyesi
- Tam ses ve VFX paketi
- Gelişmiş erişilebilirlik seçenekleri

### 5.4 Başarı sorusu

> Ekonomi, genişleme, yol savunması ve savaş birlikte 12–20 dakikalık dengeli bir maç üretiyor mu?

---

## 6. Ürün C — Sunulabilir Vertical Slice

### 6.1 Amaç

Oyunun nihai vizyonunu yeterli ölçüde temsil eden, dışarıdan bir oyuncuya gösterilebilecek tek haritalık sürüm üretmek.

### 6.2 Zorunlu içerik

- `İki Nehir Arası` tamamlanmış harita
- Dört kaynak
- Üç çağ
- İşçi, Muhafız, Okçu ve Kuşatma
- Karakol ve yol tabanlı genişleme
- Yerel tampon ve alternatif lojistik rotalar
- Askerî zafer
- AI-2 veya güvenilir AI-3 rakip
- Tam temel HUD
- Oyun içi açıklamalar ve kritik bildirimler
- Quaternius asset entegrasyonu
- Temel ses, VFX ve sonuç ekranı
- Normal zorluk
- 20–30 dakikalık hedef maç

### 6.3 Koşullu içerik

Aşağıdaki özellikler yalnızca çekirdek maç kararlıysa eklenir:

- Bölgesel zafer
- Fog of war
- Minimap
- Refah göstergesi
- Kule
- Üçüncü seviye tüm bina modelleri
- Kolay ve Zor AI profilleri
- Maç istatistik ekranı

### 6.4 Kapsam dışı

- Save/load
- Süvari
- Pazar ve kaynak dönüşümü
- Tam duvar ve kapı sistemi
- Çoklu harita
- Kampanya
- Çok oyunculu
- Kahraman birimler
- Teknoloji ağacı
- Diplomasi
- Ticaret kervanları
- Procedural harita
- Hava durumu
- Gün/gece döngüsü
- Gamepad ve mobil kontrol
- Mod sistemi
- Gelişmiş veterancy veya moral

---

# BÖLÜM B — ÜRETİM KAPILARI

## 7. Kapı Sistemi

Her ürün seviyesi bir üretim kapısıyla sonlanır.

Bir sonraki aşamaya yalnızca aşağıdaki üç koşul birlikte sağlanırsa geçilir:

1. Teknik kabul kriterleri tamamlandı.
2. Oynanış testi ana soruya olumlu cevap verdi.
3. Açık blocker hata bulunmuyor.

Kapsam takvime göre değil, kanıta göre genişletilir.

---

## 8. Kapı A — Oynanış Fikri Kanıtlandı mı?

Geçiş için:

- [ ] Oyuncu iki kaynağı düzenli biçimde üretebiliyor.
- [ ] En az bir karakol kurabiliyor.
- [ ] Dış üretim yapısını yola bağlayabiliyor.
- [ ] Bağlantı kesildiğinde üretim görünür biçimde etkileniyor.
- [ ] Alternatif rota kurmak mümkün veya tasarım değeri gözlenebiliyor.
- [ ] Oyuncu ordu üretip AI merkezini yok edebiliyor.
- [ ] AI aynı maçta ekonomi kurup saldırı yapabiliyor.
- [ ] En az beş tam test maçı blocker olmadan tamamlandı.
- [ ] Yol ve karakol kararları oyuncuya gereksiz iş gibi gelmiyor.
- [ ] Test oyuncusu bağlantı durumunu açıklama olmadan anlayabiliyor.

Başarısızsa yapılacaklar:

- Kaynak sayısı artırılmaz.
- Yeni birim eklenmez.
- Fog veya minimap geliştirilmez.
- Yol ve karakol döngüsü yeniden tasarlanır.

---

## 9. Kapı B — Çekirdek Maç Çalışıyor mu?

Geçiş için:

- [ ] Dört kaynak farklı kararlar üretiyor.
- [ ] İki çağ arasında anlamlı fırsat maliyeti var.
- [ ] Oyuncu ve AI en az bir kez genişliyor.
- [ ] Muhafız, Okçu ve Kuşatma net rollere sahip.
- [ ] Askerî zafer çoğu maçta 12–25 dakika içinde gerçekleşiyor.
- [ ] AI ekonomik kilitlenmeden temel düzeyde çıkabiliyor.
- [ ] AI geçerli yapılar ve yollar kuruyor.
- [ ] Köprü ve dar rotalarda kalıcı grup sıkışması oluşmuyor.
- [ ] En az 15 tam maç tamamlandı.
- [ ] Maçların en az %80’i teknik hata olmadan bitiyor.

Başarısızsa:

- Üçüncü çağ eklenmez.
- Bölgesel zafer eklenmez.
- Görsel polish sınırlandırılır.
- Sorunlu sistem sadeleştirilir veya kapsamdan çıkarılır.

---

## 10. Kapı C — Sunuma Hazır mı?

Release Candidate öncesi:

- [ ] 20–30 dakikalık hedef maç düzenli oluşuyor.
- [ ] Üç çağ görsel ve mekanik olarak ayrılıyor.
- [ ] AI en az Normal profilde geçerli rakip sunuyor.
- [ ] Bir maç baştan sona açıklama gerektirmeden oynanabiliyor.
- [ ] Kritik durumların nedenleri UI üzerinden okunuyor.
- [ ] Harita ana ve yan rotalarda güvenilir çalışıyor.
- [ ] 30 tam maç testinin en az %90’ı blocker olmadan bitiyor.
- [ ] Minimum hedef donanımda performans kabul edilebilir.
- [ ] Kapsam dışı özellikler yanlışlıkla yarım biçimde build’e eklenmemiş.

---

# BÖLÜM C — ÜRETİM YÖNTEMİ

## 11. Ana Üretim Döngüsü

Her görev ve faz şu döngüyü kullanmalıdır:

```text
Küçük veri modeli
→ En küçük çalışan uygulama
→ Debug görünümü
→ Otomatik doğrulama
→ Oynanabilir senaryo
→ Test raporu
→ Kabul veya geri dönüş
```

Bir sistem yalnızca kodu çalıştığı için tamamlanmış sayılmaz.

Sistem:

- maç içinde kullanılmalı,
- oyuncuya geri bildirim vermeli,
- hata durumlarını açıklamalı,
- test senaryosunda doğrulanmalı,
- kapsam dışı özelliklere bağımlı olmamalıdır.

---

## 12. Her Faz Oynanabilir Kalmalıdır

Her ana faz sonunda aşağıdaki eylemler hâlâ mümkün olmalıdır:

- Oyunu başlatmak
- Oyuncu birimlerini kontrol etmek
- Ekonomi kurmak
- Yapı inşa etmek
- En az bir düşman hedefiyle savaşmak
- Maçı kazanmak veya test senaryosunu tamamlamak

Bir faz mevcut oynanabilir build’i uzun süre bozuyorsa görev fazla büyüktür.

---

## 13. Feature Flag Kullanımı

Tamamlanmamış sistemler ana build’i bozmamalıdır.

Önerilen feature flag’ler:

```text
feature.age3
feature.regionalVictory
feature.fogOfWar
feature.minimap
feature.prosperity
feature.tower
feature.advancedAI
feature.finalAssets
```

Kurallar:

- Flag kapalıyken sistem runtime maliyeti oluşturmamalı.
- Flag durumu debug panelinde görünmeli.
- Test presetleri flag kombinasyonlarını belirlemeli.
- Yarım sistem varsayılan vertical slice presetine eklenmemeli.

---

## 14. Kodlama İlkeleri

- TypeScript strict mode kullanılmalı.
- Oyun sayıları JSON içinde tutulmalı.
- Kod içinde birim veya bina kimliğine özel denge değeri yazılmamalı.
- Sistemler tek bir büyük `GameManager` içinde toplanmamalı.
- Event sistemi kontrollü kullanılmalı; kritik akışlar izlenebilir olmalı.
- Runtime hata mesajları oyuncu mesajlarından ayrılmalı.
- Debug araçları özelliklerle birlikte üretilmeli.
- Serbest genel amaçlı çözümler yerine tek haritaya uygun güvenilir çözümler tercih edilmeli.
- Erken optimizasyon yerine ölçüm kullanılmalı.
- Görsel asset eksikliği placeholder ile oynanışı durdurmamalı.

---

## 15. Önerilen Klasör Yapısı

```text
/src/
├── core/
│   ├── events/
│   ├── state/
│   ├── time/
│   ├── config/
│   └── debug/
├── data/
│   ├── loaders/
│   ├── schemas/
│   ├── validators/
│   └── generated/
├── camera/
├── input/
├── world/
│   ├── map/
│   ├── navigation/
│   ├── regions/
│   └── fog/
├── economy/
├── buildings/
├── territory/
├── logistics/
├── units/
├── combat/
├── ai/
│   ├── director/
│   ├── army/
│   ├── unit/
│   ├── planners/
│   └── debug/
├── ui/
├── victory/
├── telemetry/
└── tests/

/game-data/
├── schema/
├── balance/
├── maps/
├── presets/
└── versions/

/assets/
├── placeholders/
├── buildings/
├── units/
├── environment/
├── roads/
├── vfx/
└── ui/

/docs/
├── gdd/
├── technical/
├── test-reports/
└── decisions/
```

---

# BÖLÜM D — FAZ 0: ÜRETİM TEMELİ

## 16. Amaç

Projeyi hızlı prototip üretimine hazır hale getirmek.

Bu faz görsel veya genel altyapı projesine dönüşmemelidir.

---

## 17. Görevler

### Dokümantasyon

- [x] GDD dosyalarının `GDD/` (repo kökü) konumunu ve çapraz-bağlantıları doğrula. (Not: belgeler `docs/gdd/`'ye taşınmaz; repo `docs/architecture/` ve `GDD/` ayrımını korur.)
- [x] `GDD_MASTER.md` bağlantılarını güncelle.
- [x] Yeni AI belgesini ana kaynak olarak işaretle. (`GDD_MASTER §4.8`)
- [x] Bu planı sürüm 0.2 olarak ana üretim planı yap. (`GDD_MASTER §14, §15`)
- [x] `TECH_DECISIONS.md` oluşturuldu (`GDD/TECH_DECISIONS.md`).
- [x] `SCOPE_LOG.md` oluştur. (`GDD/SCOPE_LOG.md`)

### Proje temeli

- [x] TypeScript strict mode’u doğrula. (`tsconfig.json` strict + noUncheckedIndexedAccess vb.)
- [x] Build, lint ve test komutlarını doğrula. (`npm run build` / `test:engine` / `build:verify`; lint görevini `tsc --noEmit` üstlenir.)
- [x] Runtime hata yakalama ekle. (`src/game/core/errorHandler.ts`)
- [x] Basit log kategorileri oluştur. (`src/game/core/logger.ts`)
- [x] Debug ve release config’lerini ayır. (`src/game/core/runtimeConfig.ts`)
- [x] Feature flag sistemini kur. (`src/game/core/featureFlags.ts`)

### Veri

- [x] Temel JSON loader oluştur. (`src/game/data/gameDataLoader.ts`)
- [x] ID ve referans doğrulaması ekle. (`src/game/data/validateGameData.ts`)
- [x] `gameplay_proof` presetini oluştur. (`public/game-data/presets/gameplay_proof.json`)
- [x] `debug_fast` presetini oluştur. (`public/game-data/presets/debug_fast.json`)
- [x] Build sürümü ve balance sürümü tanımla. (`public/game-data/version.json`)

### Test

- [x] Tek komutla çalışan test akışı oluştur. (`npm run test:engine`)
- [x] Basit smoke test sahnesi ekle. (`test:engine` preset smoke check'leri + mevcut `npm run smoke:browser`)
- [x] Hatalı JSON için başarısız test ekle. (`test:engine`: bilinmeyen flag / id uyuşmazlığı / eksik alan → `throw`)

---

## 18. Teslimatlar

- Hatasız boş build
- Veri loader
- Feature flag sistemi
- Debug log paneli
- Gameplay Proof preseti
- Güncel üretim belgeleri

---

## 19. Kabul Kriterleri

- [x] Proje tek komutla build oluyor. (`npm run build`; tam gate `npm run build:verify`)
- [x] Hatalı veri açık hata veriyor. (`validateGameData` alan-düzeyi `GameDataError` fırlatır; `test:engine` kanıtlar)
- [x] Feature flag’ler runtime’da okunabiliyor. (`runtimeConfig` + dev'de `window.__forge.config`; `?flags=` override)
- [x] Debug preset oyun hızını artırabiliyor. (`debug_fast.gameSpeed = 3`, `runtimeConfig` okur; uygulama Faz 1 döngüsünde)
- [x] GDD ve üretim belgeleri proje içinden erişilebilir. (`GDD/` repo kökünde)
- [x] Bu faz iki günden uzun bir genel altyapı çalışmasına dönüşmüyor. (minimal iskele; ~10 dosya)

---

# BÖLÜM E — FAZ 1: OYNANABİLİR OMURGA

## 20. Amaç

Boş test sahnesinde oyuncunun kamera, seçim, hareket ve basit saldırı ile bir hedefi yok edebildiği ilk uçtan uca oynanış üretmek.

---

## 21. Görevler

### Kamera

- [x] Üstten eğimli RTS kamera ekle. (`src/game/rts/camera/rtsCameraController.ts`)
- [x] WASD hareketi ekle. (`src/game/rts/input/rtsInput.ts` → kamera pan)
- [x] Fare tekerleği zoom ekle. (yumuşatmalı + clamp; `rtsCameraController`)
- [x] Kamera sınırları ekle. (`rtsCameraConfig.bounds` odak kırpma)
- [x] Pencere odağı kaybında input sıfırla. (`RtsInput` blur/visibility → reset)
- [x] Ekran kenarı kaydırmayı opsiyonel flag altında ekle. (`rtsCameraConfig.edgeScroll`, varsayılan kapalı)

### Seçim ve komut

- [x] Tekli seçim ekle. (raycast; `src/game/rts/selection/selectionSystem.ts`)
- [x] Kutu seçimi ekle. (ekran-projeksiyonlu marquee; `selectionSystem` + `marqueeOverlay`)
- [x] Seçim halkası ekle. (`Unit.setSelected` halka görünürlüğü)
- [x] Sağ tık hareket ekle. (`src/game/rts/commands/commandSystem.ts` + formasyon dağıtımı)
- [x] Sağ tık saldırı ekle. (düşman raycast'i → takip eden hedef emri + kırmızı hedef halkası)
- [x] Dur komutu ekle. (`X`; seçili birimlerin hareketi ve saldırı hedefi anında temizlenir)
- [x] Dünya komut işareti ekle. (`src/game/rts/commands/commandMarker.ts`; sönümlenen halka)

### Test birimi

- [x] Muhafız placeholder oluştur. (`src/game/rts/units/unit.ts`; kapsül + takım rengi)
- [x] Sağlık bileşeni ekle. (`HealthComponent`: maksimum/mevcut/oran, sınırlandırılmış hasar ve iyileşme; ölüm sonraki dilimde)
- [x] Sahiplik ekle. (`Unit.owner`: `player` / `enemy`; seçim filtresi)
- [x] Basit pathfinding ekle. (`RtsNavigation`: cached grid rota + waypoint takibi; yapı engelleri Faz 2’de bağlanacak)
- [x] Basit yakın dövüş saldırısı ekle. (`MeleeAttackComponent`: JSON hasar/menzil/bekleme; `updateUnitCombat` hedef menzildeyken saldırıyı çözüyor)
- [x] Ölüm ve seçimden çıkarma davranışı ekle. (`updateUnitDeaths`: anında seçim/hedef temizliği, kısa yenilme pozu ve kalıcı cesetsiz despawn)

### Maç omurgası

- [x] Oyuncu ve düşman merkez placeholder’ı ekle. (`CommandCenterSystem`: sahiplikli iki takım merkezi, Faz 1 test sahnesinde karşılıklı konumlar)
- [x] Merkez sağlık sistemi ekle. (`CommandCenter.health`: birimlerle ortak sınırlı sağlık sözleşmesi; Faz 1 geçici dayanıklılığı 300)
- [x] Düşman merkezi yok edilince zafer oluştur. (`RtsMatchState`: düşman merkezinin sağlık sıfırını tek yönlü `victory` sonucuna çevirir; UI sonraki maddede)
- [x] Yeniden başlat butonu ekle. (`RtsMatchOverlay`: zafer panelindeki düğme birimleri, merkezleri, seçimi ve maç sonucunu temiz başlangıca döndürür)

### Debug

- [x] Birim durumunu göster. (`?rts&debug`: sahiplik, can ve aktif emir)
- [x] Path durumunu göster. (`?rts&debug`: kalan waypoint sayısı)
- [x] Hasar logu göster. (`?rts&debug`: son altı vuruş)
- [x] Maç durumunu göster. (`?rts&debug`: sonuç ve iki merkezin canı)

---

## 22. Oynanabilir Senaryo

```text
Oyunu başlat
→ 5 Muhafız seç
→ Düşman merkeze hareket et
→ Savunma birimleriyle savaş
→ Merkezi yok et
→ Zafer ekranını gör
→ Maçı yeniden başlat
```

---

## 23. Kabul Kriterleri

- [x] Kamera güvenilir çalışıyor. (manuel tarayıcı doğrulaması)
- [x] UI tıklaması dünya komutu üretmiyor. (manuel tarayıcı doğrulaması)
- [x] 20 birim kutu ile seçilebiliyor. (manuel tarayıcı doğrulaması)
- [x] Birimler hedefe ulaşabiliyor. (manuel tarayıcı doğrulaması)
- [x] Yakın dövüş saldırısı tutarlı çalışıyor. (manuel tarayıcı doğrulaması)
- [x] Düşman merkez yıkımı maçı bitiriyor. (manuel tarayıcı doğrulaması)
- [x] Yeniden başlatma sahneyi temiz duruma getiriyor. (manuel tarayıcı doğrulaması)
- [x] Düşük kare hızında input takılı kalmıyor. (manuel tarayıcı doğrulaması)

---

# BÖLÜM F — FAZ 2: KÜÇÜK HARİTA VE YAPI KURMA

## 24. Amaç

Oyuncunun işçiyle temel yapılar kurabildiği ve küçük blockout haritada hareket edebildiği ilk yerleşim döngüsünü oluşturmak.

---

## 25. Görevler

### Harita blockout

- [x] Oyuncu başlangıç alanını oluştur. (`RTS_BLOCKOUT_MAP.playerStart`; mavi başlangıç alanı placeholder’ı)
- [x] AI başlangıç alanını oluştur. (`RTS_BLOCKOUT_MAP.enemyStart`; kırmızı başlangıç alanı placeholder’ı)
- [x] Merkezi genişleme alanı oluştur. (`RTS_BLOCKOUT_MAP.centralExpansion`; merkezi alan işaretçisi)
- [x] İki farklı yaklaşım rotası oluştur. (merkez kaya sırtının doğu ve batı flankları; engine testi karşı başlangıçlar arasında rota kanıtlar)
- [x] Bir dış kaynak alanı oluştur. (`RTS_BLOCKOUT_MAP.externalResource`; yeşil placeholder alanı)
- [x] Harita sınırlarını doğal engel placeholder’larıyla kapat. (`createBoundaryPlaceholders`; navigasyon sınırı mevcut dünya limitleriyle korunur)

### Navigasyon

- [x] Piyade navigasyonunu oluştur. (`RtsNavigation`, artık blockout’un statik sırt engelini kullanır ve iki flank rotası test edilir)
- [ ] Yapı placement grid’i oluştur.
- [ ] Geçit minimum genişliğini test et.
- [ ] Yapı oluşunca navigasyon güncellemesini test et.

### İşçi

- [x] İşçi placeholder oluştur. (`worker_placeholder`; başlangıçta beş oyuncu işçisi)
- [x] İşçi hareketi ekle. (mevcut grid navigasyonu ile foundation’ın erişilebilir kenarına gider)
- [x] İnşa görevi ekle. (`WorkerConstructionSystem`; yeni foundation’a en yakın boş işçi otomatik atanır)
- [x] Idle, Moving, Building durumlarını ekle. (işçi atama state’i; `?rts&debug` içinde okunur)
- [x] Boşta işçi göstergesi ekle. (yapı paletinde anlık boş işçi sayısı)

### Yapı verisi

- [x] Merkez tanımı (`buildings.json: command_center`; önceden yerleştirilmiş merkez)
- [x] Ev tanımı (`buildings.json: house`)
- [x] Depo tanımı (`buildings.json: depot`)
- [x] Kışla tanımı (`buildings.json: barracks`)
- [x] Basit footprint verisi (JSON `footprint.width/depth`; 2 birimlik gridde doğrulanır)
- [x] Maliyet ve inşa süresi (`cost` ve `constructionSeconds`; placement anında kaynak rezervasyonu aktiftir)

### Yerleştirme

- [x] Ghost önizleme ekle. (`BuildingPlacementSystem`; geçerli/engelli konum için yeşil/kırmızı preview)
- [x] Grid snap ekle. (`RTS_PLACEMENT_GRID_SIZE = 2`)
- [x] Çakışma kontrolü ekle. (harita sırtı, merkez ve mevcut foundation footprintleri)
- [x] Geçersiz yerleştirme nedeni göster. (yapı paletinde harita sınırı veya çakışma nedeni)
- [x] Kaynak rezervasyonu ekle. (`ResourceWallet`; maliyet atomik olarak ayrılır, yetersiz kaynakta placement reddedilir)
- [x] İnşa iptali ve iade ekle. (yeni temel için `Son İnşaatı İptal`; rezervasyon bir kez tam iade edilir)

### İnşaat

- [x] ConstructionComponent oluştur. (süre-sınırlı ilerleme ve tek-seferlik tamamlanma)
- [x] Bir işçiyle inşaat ekle. (en yakın boş işçi; çoklu işçi sonraki kapsam)
- [x] İnşa ilerleme göstergesi ekle. (foundation yanında dünya-uzayı progress bar)
- [x] İnşa tamamlanınca işlev aç. (tamamlanan Kışla, JSON’daki `trainingSeconds` ile tek Muhafız kuyruğu açar ve güvenli nav çıkışında doğurur; Depo işlevi Faz 3 kapsamındadır)
- [x] İşçi erişemiyorsa hata durumu üret. (ayrı `boşta işçi yok` / `işçi erişemiyor` oyuncu mesajları)

---

## 26. Oynanabilir Senaryo

```text
İşçiyi seç
→ Ev yerleştir
→ İnşaatı tamamla
→ Kışla kur
→ Muhafız üret
→ Düşman hedefini yok et
```

---

## 27. Kabul Kriterleri

- [x] İşçi geçerli yapıyı inşa ediyor. (`test:engine` worker construction senaryosu)
- [x] Geçersiz konum açıkça gösteriliyor. (palette, harita-sınırı / çakışma / kaynak nedenleri)
- [x] Kaynak yetersizse yapı kurulamıyor. (`ResourceWallet` atomik rezervasyon testi)
- [x] İptal edilen inşaat doğru iade yapıyor. (tek-seferlik tam iade testi)
- [x] Yapı navigasyonu kalıcı biçimde bozmuyor. (placement sonrası rota sapma testi)
- [x] Muhafız Kışla’dan güvenli noktada çıkıyor. (`BarracksProductionSystem` navigable-exit testi)
- [x] Oynanabilir omurga faz sonunda hâlâ tamamlanabiliyor. (Faz 2 Playwright smoke + engine testleri)

---

# BÖLÜM G — FAZ 3: İKİ KAYNAKLI EKONOMİ

## 28. Amaç

Yiyecek ve odun ile çalışan küçük ama tam ekonomi döngüsü oluşturmak.

---

## 29. Görevler

### Ekonomi altyapısı

- [x] ResourceWallet oluştur. (`src/game/rts/economy/resourceWallet.ts`; kaynak bakiyeleri ve match-reset sahipliği)
- [x] Kaynak değişim event’leri ekle. (`subscribe`; gelir, rezervasyon, iade ve reset mutasyonlarını yayınlar)
- [x] Negatif stok engeli ekle. (negatif/sonsuz başlangıç veya kredi değerleri `RangeError`; rezervasyon atomik ve negatif bakiyeye izin vermez)
- [x] Kaynak rezervasyon API’si oluştur. (`reserve`/`refund`; iptal edilen inşaat maliyeti yalnız bir kez iade edilir)
- [x] Kaynak/dakika ölçümünü ekle. (60 saniyelik kayan pencere; debug overlay kaynak başına geliri gösterir)

### Üretim yapıları

- [x] Yiyecek yapısı oluştur. (`farm`; JSON maliyet, 3 işçi kapasitesi, 7 yiyecek/dk ve 40 yerel tampon)
- [x] Oduncu Kampı oluştur. (`lumber_camp`; JSON maliyet, 3 işçi kapasitesi, 6 odun/dk ve 40 yerel tampon)
- [x] İşçi atama ekle. (tamamlanan üretim yapıları erişebilen en yakın boş işçileri V1 otomatik atar; seçili-yapı üzerinden manuel yeniden atama paneli HUD diliminde)
- [x] İşçi kapasitesi ekle. (veri tanımındaki T1 kapasitesi üretici başına uygulanır)
- [x] Üretim döngüsü ekle. (`EconomyProductionSystem`; yalnız çalışma noktasına ulaşan işçiler kaynak üretir)
- [x] Yerel tampon ekle. (yapı başına bağımsız, veri tanımlı tampon; henüz global stoka aktarılmaz)
- [x] Tampon dolunca üretimi durdur. (üretim `buffer-full` durumunda kapasitede sabitlenir)

### İşçi üretimi ve nüfus

- [x] Merkezden işçi üretimi ekle. (`WorkerProductionSystem`; Merkez tekli kuyruğu güvenli çıkışta işçi doğurur)
- [x] İşçi maliyeti ekle. (`worker_placeholder.cost = 50 yiyecek`; kuyrukta ayrılır, iptalde iade edilir)
- [x] Nüfus kullanımı ekle. (işçi ve Muhafız JSON `populationCost` değeriyle kuyrukta kapasite ayırır)
- [x] Ev nüfus kapasitesi ekle. (`house.populationCapacity = 5`; tamamlanmış Evler yerleşim üst sınırına eklenir)
- [x] Nüfus doluyken üretimi engelle. (kuyruk reddedilir ve oyuncuya `önce Ev kurun` mesajı gösterilir)

### HUD

- [x] Yiyecek göstergesi (yapı paletinde canlı global stok)
- [x] Odun göstergesi (yapı paletinde canlı global stok)
- [x] Nüfus göstergesi (mevcut + kuyruk rezervasyonu / tamamlanmış Ev kapasitesi)
- [x] Gelir hızı (tamponu dolmamış yapılardaki çalışan işçilerin gerçek anlık üretimi, kaynak/dk olarak gösterilir)
- [x] Boşta işçi (inşaat veya üretim yapısına atanmamış işçilerin anlık sayısı)
- [x] Seçili üretim yapısı paneli (tamamlanmış üretim yapıları listeden seçilir; işçi, üretim hızı, tampon ve durum gösterilir)

### Debug

- [x] Üretim tick’lerini göster. (`?rts&debug`: yapı başına son tick çıktısı)
- [x] Yerel tamponu göster. (`?rts&debug`: mevcut/kapasite)
- [x] Atanmış işçileri göster. (`?rts&debug`: atanmış, çalışan ve kapasite)
- [x] Kaynak harcama logu göster. (`ResourceWallet` rezervasyon/iade olayları debug akışında)

---

## 30. Oynanabilir Senaryo

```text
Başlangıç işçilerini ata
→ Yiyecek ve odun üret
→ Ev kur
→ Yeni işçi üret
→ Kışla kur
→ Muhafız üret
→ Düşman hedefini yok et
```

---

## 31. Kabul Kriterleri

- [x] Ekonomi JSON verisiyle dengelenebiliyor. (bina üretim/kapasite/tampon ve birim maliyet/nüfus değerleri doğrulanır)
- [x] İşçiler üretim yapısında çalışıyor. (`test:engine`: üç işçi çalışma noktasında 21 yiyecek/dk üretir)
- [x] Tampon dolunca üretim duruyor. (`test:engine`: 40 birimde sabitlenir, gelir 0/dk olur)
- [x] Nüfus sınırı doğru çalışıyor. (`test:engine`: 20 taban limit, Ev +5, kuyruk rezervasyonu ve reddetme)
- [x] Kaynak göstergeleri doğru güncelleniyor. (hedefli Playwright: stok, nüfus, gelir hızı ve kaynak hareket logu)
- [x] 10 dakikalık ekonomi testi hata vermiyor. (`test:engine`: 600 simülasyon saniyesi, tampon tavanı korunur)
- [x] Oyuncu ekonomik kilide açıklamasız düşmüyor. (yetersiz kaynak, nüfus dolu ve üretim çıkışı engeli için görünür mesajlar)

---

# BÖLÜM H — FAZ 4: KARAKOL, YOL VE LOJİSTİK KANITI

## 32. Amaç

Oyunun ana ayırt edici sistemini doğrulamak.

Bu faz, Ürün A’nın en kritik bölümüdür.

---

## 33. Görevler

### Kontrol alanı

- [x] Merkez kontrol alanı oluştur. (`TerritoryControlSystem`, Merkez başına 18 dünya birimi yarıçap)
- [x] Grid hücrelerinde sahiplik tut. (2 birimlik placement gridinde `player` / `enemy` / `neutral`)
- [x] Yapı placement kontrol alanına bağla. (yapı footprint’inin tüm hücreleri oyuncuya ait olmalı)
- [x] Kontrol overlay’i ekle. (hafif mavi/kırmızı takım alanı zemin overlay’i)
- [x] Düşman alanına normal yapı kurmayı engelle. (`outside-control` yerleştirme nedeni ve UI açıklaması)

### Karakol

- [ ] Karakol yapı tanımı oluştur.
- [ ] Kontrol alanı dışında sınırlı placement desteği ekle.
- [ ] Tamamlanınca küçük kontrol alanı aç.
- [ ] Yol bağlantısı kurulunca tam alan aç.
- [ ] Karakol yıkılınca alanı kapat.
- [ ] Bağlı yapıların `Kontrol Dışı` durumunu ekle.

### Yol

- [ ] Hücre tabanlı yol graph’ı oluştur.
- [ ] Başlangıç ve bitiş ile rota önizleme ekle.
- [ ] Düz ve dönüş segmentlerini oluştur.
- [ ] Yol maliyetini hesapla.
- [ ] Yol bağlantısını runtime’da güncelle.
- [ ] Yol debug görünümü ekle.

### Lojistik

- [ ] Depoyu graph düğümü yap.
- [ ] Üretim yapısını graph’a bağla.
- [ ] Bağlı tamponu global stoğa aktar.
- [ ] Bağlantı kesilince aktarımı durdur.
- [ ] Yerel tampon dolunca üretimi durdur.
- [ ] Alternatif rota varsa bağlantıyı koru.

### Savaş bağlantısı

- [ ] Karakol yıkımının lojistiği kesmesini doğrula.
- [ ] Depo yıkımının dış ekonomiyi etkilemesini doğrula.
- [ ] Opsiyonel lojistik düğüm işgali prototipi oluştur.
- [ ] Bağlantı kesintisi uyarısı ekle.

### UI

- [ ] Bağlı / Bağlantısız durumu
- [ ] Kontrol Dışı durumu
- [ ] Yerel tampon durumu
- [ ] Lojistik overlay
- [ ] Bağlantı nedeni tooltip’i

---

## 34. Oynanabilir Senaryo

```text
Merkez ekonomisini kur
→ Harita sınırına karakol kur
→ Karakolu yolla merkeze bağla
→ Açılan alana dış üretim yapısı kur
→ Depo ile bağlantı oluştur
→ Düşman karakola veya depoya saldırır
→ Bağlantı kesilir
→ Oyuncu hattı savunur veya alternatif rota kurar
→ Ordu üretip düşman merkezini yok eder
```

---

## 35. Kabul Kriterleri

- [ ] Karakol olmadan dış bölgeye normal yapı kurulamıyor.
- [ ] Karakol küçük alanı hemen açıyor.
- [ ] Tam alan yol bağlantısıyla aktif oluyor.
- [ ] Bağlantılı yapı üretimi global stoğa aktarılıyor.
- [ ] Bağlantı kesintisi 30–90 saniye içinde üretimi etkiliyor.
- [ ] Alternatif rota gerçek yedeklilik sağlıyor.
- [ ] Oyuncu bağlantı sorununu tek bakışta anlayabiliyor.
- [ ] Graph güncellemesi performans sorunu oluşturmuyor.
- [ ] Karakol kaybı binaları anında yok etmiyor.
- [ ] Beş tam test maçı blocker olmadan bitiyor.

---

## 36. Faz Sonu Oynanış Değerlendirmesi

Test oyuncularına şu sorular sorulmalıdır:

1. Neden karakol kurduğunuzu anladınız mı?
2. Yol kurmak anlamlı karar mıydı, yoksa zorunlu iş mi?
3. Bağlantı koptuğunda ne olduğunu anladınız mı?
4. Alternatif rota kurmak değerli göründü mü?
5. Düşmanın karakol veya depoya saldırması ilginç hedef oluşturdu mu?
6. Dış kaynak alanı yeterli risk ve ödül sundu mu?

Olumsuz sonuçta içerik eklemek yerine sistem sadeleştirilir.

---

# BÖLÜM I — FAZ 5: AI-1 OYNANIŞ KANITI RAKİBİ

## 37. Amaç

Oyuncuyla aynı küçük ekonomik döngüyü kullanan, bir kez genişleyen, ordu üreten ve saldıran ilk gerçek rakibi oluşturmak.

Ana kaynak: `07_ENEMY_AI_DESIGN_v0.2.md`

---

## 38. Görevler

### AI temel yapı

- [ ] `KingdomDirector` oluştur.
- [ ] `ArmyManager` oluştur.
- [ ] Birim AI komut yürütmesini bağla.
- [ ] AI blackboard oluştur.
- [ ] Karar logu ekle.
- [ ] AI hızlandırılmış test modu ekle.

### Açılış

- [ ] Başlangıç işçi dağılımı
- [ ] İlk ev
- [ ] İlk yiyecek ve odun yapısı
- [ ] İlk Kışla
- [ ] Minimum savunma gücü

### Ekonomi

- [ ] Yiyecek ve odun gelir hedefleri
- [ ] Nüfus kilidi önleme
- [ ] İşçi üretimi
- [ ] Yapı kuyruğu
- [ ] Kaynak yetersizliğinde bekleme ve yeniden değerlendirme

### Genişleme

- [ ] Harita verisinden tek aday genişleme alanı oku.
- [ ] Karakol kur.
- [ ] Hazır veya sınırlı rota ile yol bağla.
- [ ] Dış üretim yapısı kur.
- [ ] Yerleştirme başarısızlığında fallback kullan.

### Ordu

- [ ] Tek saha ordusu oluştur.
- [ ] Minimum savunma grubu tut.
- [ ] Belirli güç eşiğinde saldır.
- [ ] Hedef olarak dış ekonomi veya merkez seç.
- [ ] Ağır kayıpta üsse dön.

### Zafer

- [ ] Oyuncu merkezini hedefleyebilme
- [ ] Kendi merkezini savunma
- [ ] Maç bittikten sonra karar üretmeyi durdurma

---

## 39. Kabul Kriterleri

- [ ] AI beş ardışık maçta açılışını tamamlıyor.
- [ ] AI nüfus sınırında kalıcı kilitlenmiyor.
- [ ] AI en az bir kez karakol kuruyor.
- [ ] AI karakolu yola bağlayabiliyor.
- [ ] AI en az bir saldırı gerçekleştiriyor.
- [ ] AI merkezi saldırı altında savunmaya dönüyor.
- [ ] AI geçersiz yapı konumunda sonsuz döngüye girmiyor.
- [ ] AI normal oyunda gizli kaynak bonusu kullanmıyor.
- [ ] AI karar nedeni debug panelinde görülebiliyor.
- [ ] Oyuncu veya AI maçı kazanabiliyor.

---

## 40. Ürün A Çıkışı

Bu faz sonunda Ürün A tamamlanır.

Kapı A değerlendirmesi yapılır.

Kapı A geçilmezse:

- Yeni kaynak eklenmez.
- Yeni çağ eklenmez.
- Okçu ve kuşatma eklenmez.
- Yol, karakol, ekonomi veya AI sadeleştirilir.

---

# BÖLÜM J — FAZ 6: TAM EKONOMİ VE İKİ ÇAĞ

## 41. Amaç

Çekirdek maç için taş, altın ve Kasaba çağını eklemek.

---

## 42. Görevler

### Kaynaklar

- [ ] Taş kaynağı verisi
- [ ] Altın kaynağı verisi
- [ ] Taş Ocağı
- [ ] Altın Madeni
- [ ] Kaynak düğümü tükenmesi
- [ ] Güvenli ve dış kaynak kapasite farkları

### Çağ sistemi

- [ ] Yerleşim ve Kasaba durumları
- [ ] Çağ maliyeti
- [ ] Çağ yükseltme süresi
- [ ] Yükseltme sırasında merkezin davranışı
- [ ] Açılan yapı ve birlikler
- [ ] Çağ bildirimi

### Yapı yükseltmeleri

- [ ] Merkez T1 → T2
- [ ] Ev T1 → T2
- [ ] Depo T1 → T2, kapsam uygunsa
- [ ] Kışla T1 → T2
- [ ] Karakol T1 → T2, kapsam uygunsa
- [ ] Placeholder model değişimi

### Refah kararı

Vertical slice’ın bu aşamasında Refah:

- çağ atlama koşulu olmayacaktır,
- istenirse hesaplanan bir debug veya bilgi metriği olacaktır,
- üretimi bloke etmeyecektir.

Görevler:

- [ ] Refah feature flag’i oluştur.
- [ ] Basit hesap formülü ekle, yalnız gerekli görülürse.
- [ ] Sert kilit olarak kullanılmadığını test et.

### Denge

- [ ] İki çağ için `core_match` presetini oluştur.
- [ ] İlk çağ hedef süresini belirle.
- [ ] İlk askerî temas hedefini belirle.
- [ ] Kaynak darboğaz raporu oluştur.

---

## 43. Kabul Kriterleri

- [ ] Dört kaynak farklı kullanım alanına sahip.
- [ ] Oyuncu yalnız güvenli kaynaklarla bütün maçı bitiremiyor.
- [ ] Kasabaya geçiş gerçek fırsat maliyeti oluşturuyor.
- [ ] Çağ atlama sırasında oyuncu savunmasız kalabiliyor.
- [ ] AI Kasaba çağına ulaşabiliyor.
- [ ] Kaynak düğümü tükenmesi yeni genişlemeyi teşvik ediyor.
- [ ] Refah oyuncuyu bekleten görünmez kilit oluşturmuyor.

---

# BÖLÜM K — FAZ 7: ÇEKİRDEK SAVAŞ KADROSU

## 44. Amaç

Muhafız, Okçu ve Kuşatma arasında okunabilir bir karşıtlık sistemi oluşturmak.

---

## 45. Görevler

### Birim verisi

- [ ] Muhafız verisini tamamla.
- [ ] Okçu verisi oluştur.
- [ ] Kuşatma birimi verisi oluştur.
- [ ] Nüfus maliyetleri ekle.
- [ ] Hedef sınıfları ekle.
- [ ] Hareket ve saldırı verilerini JSON’a taşı.

### Üretim

- [ ] Okçuyu Kışla II içinde aç.
- [ ] Kuşatma üretimini tek seviyeli Atölye veya Kışla II içinde çöz.
- [ ] Üretim kuyruğu ekle.
- [ ] Rally point ekle.
- [ ] Bağlantısı kesilen askerî yapının davranışını uygula.

### Komutlar

- [ ] Saldırı-Hareket
- [ ] Pozisyonu Koru
- [ ] Geri çekilme için normal hareket kullanımı
- [ ] Hedef ve komut göstergeleri

### Savaş

- [ ] Yakın dövüş slot sistemi veya basit yaklaşma düzeni
- [ ] Menzilli saldırı ve mermi
- [ ] Yapı hasar sınıfı
- [ ] Kuşatma yapı bonusu
- [ ] Hedef kaybı ve yeniden hedefleme
- [ ] Kovalama mesafesi
- [ ] Dost ateşi olmaması

### Grup hareketi

- [ ] Küçük grup hedef dağıtımı
- [ ] Dar geçit testi
- [ ] Köprü testi
- [ ] Büyük kuşatma agent testi
- [ ] Tıkanma timeout ve fallback

### UI

- [ ] Birim rol açıklaması
- [ ] Güçlü ve zayıf hedef göstergesi
- [ ] Grup özeti
- [ ] Sağlık çubukları

---

## 46. Kabul Kriterleri

- [ ] Muhafız ön hat rolü taşıyor.
- [ ] Okçu korunduğunda etkili, yakalandığında zayıf.
- [ ] Kuşatma yapılara karşı gerekli ve birimlere karşı zayıf.
- [ ] Tek birim türü her durumda en iyi seçim değil.
- [ ] 25–40 birimlik çatışma kabul edilebilir performansta.
- [ ] Köprüde kalıcı sıkışma oluşmuyor.
- [ ] Oyuncu birim rollerini görsel ve UI üzerinden anlayabiliyor.

---

# BÖLÜM L — FAZ 8: AI-2 ÇEKİRDEK MAÇ RAKİBİ

## 47. Amaç

Dört kaynak, iki çağ ve üç askerî sınıfla tam maç oynayabilen AI üretmek.

---

## 48. Görevler

### Stratejik niyetler

AI yalnızca şu ana niyetleri kullanır:

- Economy
- AgeUp
- Expand
- Defend
- Attack

Görevler:

- [ ] Niyet puanlarını veri tabanlı hale getir.
- [ ] Minimum plan süresi ekle.
- [ ] Plan değiştirme eşiği ekle.
- [ ] Acil savunma kesmesini ekle.

### Ekonomi

- [ ] Dört kaynak için hedef gelirler
- [ ] Çağ hazırlığı işçi dağılımı
- [ ] Kaynak darboğazı tespiti
- [ ] Kritik yapı yeniden kurma
- [ ] İşçi kaybı sonrası toparlanma

### Yapı ve genişleme

- [ ] Birden fazla aday yapı alanı
- [ ] En fazla iki genişleme planı
- [ ] Karakol ve depo yeniden kurma
- [ ] Yol rota fallback’i
- [ ] Bağlantı kesintisi onarımı

### Ordu

- [ ] Muhafız / Okçu / Kuşatma oranı
- [ ] Tek ana saha ordusu
- [ ] Küçük üs savunma rezervi
- [ ] Dış ekonomi hedefleme
- [ ] Merkez saldırısı
- [ ] Kayıp eşiğinde geri çekilme

### Bilgi

Çekirdek Maç Prototipi aşamasında AI:

- tam fog kullanmak zorunda değildir,
- ancak oyuncunun gizli kaynak stoğunu okuyamaz,
- görünür veya keşfedilmiş hedef listesi kullanmalıdır,
- son bilinen hedef bilgisi için basit zaman aşımı kullanabilir.

### Debug

- [ ] Aktif niyet
- [ ] Niyet puanları
- [ ] Kaynak hedefleri
- [ ] Aktif yapı planı
- [ ] Ordu gücü
- [ ] Seçilen saldırı hedefi
- [ ] Geri çekilme nedeni
- [ ] Son on karar

---

## 49. Kabul Kriterleri

- [ ] AI dört kaynaklı ekonomi kuruyor.
- [ ] AI Kasaba çağına ulaşıyor.
- [ ] AI en az bir dış ekonomi açıyor.
- [ ] AI karışık ordu üretiyor.
- [ ] AI yapı hedefleri için kuşatma kullanıyor.
- [ ] AI merkez saldırısına bütün ordusunu gereksiz yere kaybetmiyor.
- [ ] AI ağır kayıp sonrası yeniden ekonomi kurabiliyor.
- [ ] AI 10 hızlandırılmış maçın en az 8’ini tamamlıyor.
- [ ] AI karar değiştirme döngüsüne girmiyor.
- [ ] AI’ın davranış nedeni debug panelinden izlenebiliyor.

---

# BÖLÜM M — FAZ 9: ÇEKİRDEK MAÇ UI VE AKIŞI

## 50. Amaç

Oyuncunun dış açıklama olmadan temel maçı yönetebilmesini sağlamak.

---

## 51. Görevler

### Ana HUD

- [ ] Dört kaynak
- [ ] Gelir hızları
- [ ] Nüfus
- [ ] Çağ seviyesi
- [ ] Boşta işçi
- [ ] Kritik bağlantı uyarısı

### Seçim panelleri

- [ ] İşçi paneli
- [ ] Üretim yapısı paneli
- [ ] Depo paneli
- [ ] Karakol paneli
- [ ] Askerî yapı paneli
- [ ] Birim paneli

### Yapı ve yol araçları

- [ ] Yapı kategorileri
- [ ] Maliyet ve kilit durumu
- [ ] Yerleştirme nedeni
- [ ] Yol rota ve maliyet önizlemesi
- [ ] Karakol kontrol alanı önizlemesi

### Bildirimler

- [ ] Nüfus dolu
- [ ] Kaynak tükendi
- [ ] Bağlantı kesildi
- [ ] Karakol saldırı altında
- [ ] Merkez saldırı altında
- [ ] Çağ yükseltmesi tamamlandı
- [ ] AI çağ atladı

### Maç akışı

- [ ] Ana menü yerine basit başlatma ekranı
- [ ] Pause
- [ ] Yeniden başlat
- [ ] Teslim ol
- [ ] Zafer ekranı
- [ ] Yenilgi ekranı

### Minimal ayarlar

- [ ] Ana ses seviyesi
- [ ] Kamera hızı
- [ ] Kamera yumuşatma
- [ ] Ekran sallantısı

---

## 52. Kabul Kriterleri

- [ ] UI haritanın kritik alanlarını aşırı kapatmıyor.
- [ ] Bir yapı çalışmadığında nedeni gösteriliyor.
- [ ] Aynı uyarı sürekli spam oluşturmuyor.
- [ ] Oyuncu yol ve karakol araçlarını dış açıklama olmadan kullanabiliyor.
- [ ] Maç başlatma, bitirme ve yeniden başlatma güvenilir.
- [ ] 1366×768 ve 1920×1080 çözünürlükleri kullanılabilir.

---

## 53. Ürün B Çıkışı

Faz 9 sonunda Ürün B tamamlanır.

Kapı B değerlendirmesi yapılır.

Kapı B geçilmeden:

- üçüncü çağ,
- bölgesel zafer,
- fog,
- minimap,
- final asset polish

ana üretim hattına alınmaz.

---

# BÖLÜM N — FAZ 10: ÜÇÜNCÜ ÇAĞ VE MAÇI BİTİRME

## 54. Amaç

Üçüncü çağın yalnızca güç artışı değil, maçı sonlandırma aşaması olmasını sağlamak.

---

## 55. Görevler

### Krallık çağı

- [ ] Krallık çağ gereksinimleri
- [ ] Merkez T3
- [ ] Nüfus üst sınırı artışı
- [ ] Üst seviye üretim değerleri
- [ ] Kuşatma erişimi, daha önce açılmadıysa
- [ ] Karakol T3 veya dayanıklılık yükseltmesi, yalnız gerekliyse

### Maç sonlandırma baskısı

- [ ] Krallık çağında ordu üretim temposu
- [ ] Merkeze karşı kuşatma gereksinimi
- [ ] AI Finish Game davranışı
- [ ] Uzayan maç uyarısı ve denge ölçümü
- [ ] Güvenli kaynakların geç oyunda yetersiz kalması

### Refah

Refah bu fazda yeniden değerlendirilir.

Seçenekler:

1. Yalnızca yerleşim sağlığı göstergesi
2. Bazı küçük bonusların kaynağı
3. Krallık çağının yumuşak gereksinimi

Varsayılan karar:

> Refah, Krallık çağını tek başına bloke etmeyecektir.

- [ ] Test sonucu olmadan sert kilit ekleme.
- [ ] Refah nedenlerini UI’da göster, aktifse.

---

## 56. Kabul Kriterleri

- [ ] Krallık çağı maçı gereksiz yere uzatmıyor.
- [ ] Üçüncü çağdan sonra zafer baskısı belirgin artıyor.
- [ ] Krallık yalnızca daha yüksek sayılar sunmuyor.
- [ ] AI Krallık çağına ulaşıp maçı bitirmeye çalışıyor.
- [ ] Hedef maçların çoğu 20–30 dakika içinde bitiyor.

---

# BÖLÜM O — FAZ 11: KOŞULLU STRATEJİK SİSTEMLER

## 57. Amaç

Çekirdek maç kararlıysa oyunun vizyonunu güçlendiren ek sistemleri kontrollü biçimde eklemek.

Bu fazdaki her alt sistem bağımsız scope kararıdır.

---

## 58. Bölgesel Zafer — Koşullu

### Ekleme koşulları

- Askerî zafer güvenilir çalışıyor.
- Harita merkezi yeterince çatışma üretmiyor veya ikinci oyun tarzına ihtiyaç var.
- AI hedef savunma davranışı kararlı.

### Görevler

- [ ] İki stratejik nokta ekle.
- [ ] Ele geçirme durumu ekle.
- [ ] Dost kontrol alanı veya aktif karakol bağlantısı koşulu ekle.
- [ ] Zafer sayacı ekle.
- [ ] Sayaç durma ve gerileme davranışı ekle.
- [ ] AI Contest Objective davranışı ekle.
- [ ] UI geri sayım ve harita göstergesi ekle.

### Kabul kriterleri

- [ ] Bölgesel zafer merkez savunmasına kapanmayı azaltıyor.
- [ ] Sayaç sürpriz yenilgi yaratmıyor.
- [ ] AI sayacı durdurmak için tepki veriyor.
- [ ] İkinci zafer türü askerî zaferi gereksiz hale getirmiyor.

Başarısızsa sistem feature flag arkasında kapatılır.

---

## 59. Fog of War — Koşullu

### Ekleme koşulları

- Birim görünürlüğü ve keşif gerçekten karar üretiyor.
- Performans bütçesi uygun.
- AI bilgi modeli temel olarak hazır.

### Görevler

- [ ] Görüş alanı sistemi
- [ ] Keşfedilmiş alan
- [ ] Şu anda görünür alan
- [ ] Son bilinen yapı bilgisi
- [ ] AI görüş kuralları
- [ ] Görüş debug overlay’i

### Kabul kriterleri

- [ ] Fog oyuncuyu gerekli bilgiden tamamen mahrum bırakmıyor.
- [ ] AI görünmeyen birimlerin gerçek konumunu bilmiyor.
- [ ] Görüş güncellemesi performans sorunu oluşturmuyor.

---

## 60. Minimap — Koşullu

### Ekleme koşulları

- Harita kamera ile yönetilemeyecek kadar büyük.
- Stratejik uyarılara hızlı erişim gerekli.
- Fog sistemi varsa bilgi modeli hazır.

### Görevler

- [ ] Harita temsili
- [ ] Kamera çerçevesi
- [ ] Dost ve düşman göstergeleri
- [ ] Stratejik noktalar
- [ ] Uyarı pingleri
- [ ] Tıklayarak kamera taşıma

Minimap gerekli değilse yalnızca uyarıya tıklayarak kamera odaklama kullanılabilir.

---

# BÖLÜM P — FAZ 12: ASSET ENTEGRASYONU VE SUNUM

## 61. Amaç

Kanıtlanmış oynanış sistemlerini Quaternius assetleriyle sunulabilir hale getirmek.

---

## 62. Asset Envanteri

- [ ] Paket içindeki bina modellerini listele.
- [ ] Birim modellerini ve animasyonlarını listele.
- [ ] Üç çağ için kullanılabilecek bina eşleşmelerini belirle.
- [ ] Eksik model rollerini belirle.
- [ ] Kullanılmayacak assetleri işaretle.
- [ ] Lisans bilgisini proje belgelerine ekle.

---

## 63. Teknik Hazırlık

- [ ] Ölçek standardı
- [ ] Pivot standardı
- [ ] İleri yön standardı
- [ ] Collider standardı
- [ ] Bina giriş anchor’ları
- [ ] Takım rengi materyali
- [ ] Animasyon adlandırma standardı
- [ ] Model yükleme fallback’i

---

## 64. Bina Entegrasyonu

Öncelik sırası:

1. Merkez
2. Karakol
3. Depo
4. Kaynak yapıları
5. Kışla
6. Ev
7. Kuşatma üretim yapısı
8. Kule, aktifse

Görevler:

- [ ] T1 modelleri
- [ ] T2 modelleri
- [ ] T3 ana modelleri
- [ ] Takım renkleri
- [ ] Seçim ve sağlık göstergeleri
- [ ] İnşaat placeholder geçişi
- [ ] Hasar efekti
- [ ] Yıkım geçişi

Her yapının üç özel modeli bulunmak zorunda değildir. Gerekirse:

- prop ekleme,
- ölçek ve malzeme varyantı,
- modüler birleştirme

kullanılır.

---

## 65. Birim Entegrasyonu

- [ ] İşçi modeli ve iş animasyonu
- [ ] Muhafız modeli
- [ ] Okçu modeli
- [ ] Kuşatma modeli
- [ ] Idle
- [ ] Walk / Run
- [ ] Attack
- [ ] Death
- [ ] Build ve Repair, işçi için
- [ ] Takım rengi
- [ ] Animasyon-hasar zaman eşlemesi

---

## 66. Dünya ve Yol

- [ ] Yol segment modelleri
- [ ] Köprü ve geçit görselleri
- [ ] Kaynak düğümleri
- [ ] Orman ve kayalık sınırlar
- [ ] Stratejik nokta görselleri, aktifse
- [ ] Lojistik overlay ile zemin kontrastı
- [ ] Okunabilir dekor yoğunluğu

---

## 67. VFX ve Ses

Minimum kapsam:

- [ ] Seçim ve komut işareti
- [ ] İnşaat tozu
- [ ] Vuruş efekti
- [ ] Mermi izi
- [ ] Yapı hasar dumanı
- [ ] Merkez yıkım efekti
- [ ] UI tıklama sesi
- [ ] İnşa tamamlama sesi
- [ ] Saldırı uyarısı
- [ ] Zafer ve yenilgi sesi
- [ ] Basit ortam veya müzik loop’u

---

## 68. Kabul Kriterleri

- [ ] Birimler uzak kamera seviyesinde ayırt ediliyor.
- [ ] Bina çağları görsel olarak okunuyor.
- [ ] Takım renkleri belirgin fakat modeli kaplamıyor.
- [ ] Yol ve kontrol overlay’leri assetlerle birlikte okunuyor.
- [ ] Animasyon geçişleri komut tepkisini geciktirmiyor.
- [ ] Eksik asset oyun akışını bozmuyor.
- [ ] Görsel kalite performans hedefini aşmıyor.

---

# BÖLÜM Q — FAZ 13: DENGE VE TEST

## 69. Amaç

Sayıları tek tek güzelleştirmek yerine maç temposunu ve karar kalitesini dengelemek.

---

## 70. Denge Öncelik Sırası

1. Maçın bitip bitmediği
2. Maç süresi
3. Çağ süreleri
4. İlk askerî temas zamanı
5. Ekonomik büyüme
6. Genişleme zamanı
7. Ordu üretim temposu
8. Yapı dayanıklılığı
9. Birim karşıtlıkları
10. Ayrıntılı maliyet ayarları

---

## 71. Minimum Telemetri

Tam analitik altyapı zorunlu değildir.

Her maç için şu değerler kaydedilir:

- Build sürümü
- Balance sürümü
- Maç süresi
- Kazanan taraf
- Zafer türü
- İlk karakol zamanı
- İlk askerî temas zamanı
- Kasaba çağı zamanı
- Krallık çağı zamanı
- İlk büyük çatışma zamanı
- Üretilen toplam işçi
- Üretilen birim türleri
- Kaybedilen karakol sayısı
- Lojistik kesinti süresi
- Oyuncu ve AI kaynak gelirleri
- AI aktif niyet süreleri
- Teknik hata ve stuck sayıları

Yerel JSON veya test raporu yeterlidir.

---

## 72. Test Presetleri

```text
gameplay_proof
core_match
vertical_slice
debug_fast
economy_test
logistics_test
combat_test
ai_test
late_game_test
```

Her preset:

- feature flag’leri,
- başlangıç kaynaklarını,
- oyun hızını,
- harita durumunu,
- AI profilini

belirlemelidir.

---

## 73. Oynanış Test Grupları

### İç test

- Sistem doğrulama
- Edge case
- Debug araçları
- Hızlandırılmış AI maçları

### Kontrollü test

- Oyunun nasıl oynandığını bilen geliştirici dışı testçi
- Ana döngü anlaşılabilirliği
- UI nedenlerinin okunabilirliği
- Maç süresi

### Kör test

- GDD açıklaması verilmeyen oyuncu
- İlk ekonomi kararı
- Karakol ve yol anlayışı
- Zafer hedefi anlayışı
- Birim rol anlayışı

---

## 74. Hedef Metrikler

| Ölçü | Hedef |
|---|---:|
| Oynanış Kanıtı maç süresi | 8–15 dk |
| Çekirdek Maç süresi | 12–20 dk |
| Final ideal maç | 20–30 dk |
| İlk askerî temas | 5–9 dk |
| İlk karakol | 5–9 dk |
| Kasaba geçişi | 7–12 dk |
| Krallık geçişi | 17–23 dk |
| Blocker olmadan biten RC maçları | %90+ |
| 40 dakikayı aşan final maç | <%20 |
| Kalıcı birim sıkışması | 0 |
| AI yapı planı sonsuz döngüsü | 0 |

Bu değerler hipotezdir ve testle değişebilir.

---

## 75. Denge Değişiklik Süreci

Her değişiklik:

```text
Problem
→ Ölçüm
→ Hipotez
→ Tek veya sınırlı değişken değişikliği
→ Yeni build
→ Tekrar test
→ Sonuç kaydı
```

Kaçınılacaklar:

- Aynı anda birçok değeri değiştirmek
- Bir test sonucuna göre kalıcı karar almak
- AI hatasını kaynak bonusuyla gizlemek
- Maç süresini yalnız üretim hızını artırarak çözmek
- UI sorununu oyuncu hatası olarak değerlendirmek

---

# BÖLÜM R — FAZ 14: POLISH VE RELEASE CANDIDATE

## 76. Amaç

Yeni özellik eklemeden mevcut vertical slice’ı kararlı, okunabilir ve sunulabilir hale getirmek.

---

## 77. Oynanış Polish

- [ ] Komut tepkilerini iyileştir.
- [ ] Birim çıkış sıkışmalarını çöz.
- [ ] Yapı yerleştirme hissini iyileştir.
- [ ] Yol çizim tıklama sayısını azalt.
- [ ] Bağlantı ve kontrol geri bildirimini netleştir.
- [ ] Kritik bildirimleri önceliklendir.
- [ ] Maç başlangıcındaki boş bekleme süresini azalt.
- [ ] Geç oyunda bitirme baskısını artır.

---

## 78. Görsel Polish

- [ ] Seçim halkaları
- [ ] Sağlık çubukları
- [ ] Takım renkleri
- [ ] Yol birleşimleri
- [ ] Kontrol sınırı görünümü
- [ ] Lojistik overlay
- [ ] Kaynak okunabilirliği
- [ ] Kamera yakın ve uzak LOD testi
- [ ] Gereksiz dekor azaltma

---

## 79. Stabilite

- [ ] Uzun süreli maç testi
- [ ] Pause / resume testi
- [ ] Sekme odağı kaybı testi
- [ ] Yeniden başlatma testi
- [ ] Kaynak tükenmesi edge case
- [ ] Son işçi kaybı
- [ ] Karakol yıkımı sırasında yol güncellemesi
- [ ] Aynı anda çoklu yapı yıkımı
- [ ] Maç biterken aktif AI görevleri
- [ ] Düşük FPS testi
- [ ] Farklı ekran çözünürlükleri

---

## 80. Release Candidate Kabul Kriterleri

- [ ] Tek harita baştan sona oynanabiliyor.
- [ ] Oyuncu dört kaynak kullanabiliyor.
- [ ] Oyuncu üç çağdan geçebiliyor.
- [ ] Karakol ve yol ile genişleme zorunlu ve anlaşılır.
- [ ] Dış ekonomi savunulabilir ve saldırılabilir.
- [ ] Dört birim rolü çalışıyor.
- [ ] AI ekonomi kuruyor, genişliyor, savunuyor ve saldırıyor.
- [ ] Askerî zafer güvenilir çalışıyor.
- [ ] Bölgesel zafer yalnız kabul edildiyse güvenilir çalışıyor.
- [ ] Maçların en az %90’ı blocker olmadan tamamlanıyor.
- [ ] Hedef maç süresi çoğunlukla 20–30 dakika.
- [ ] Yarım veya kapalı özellik UI’da görünmüyor.
- [ ] GDD sapmaları belgelenmiş.
- [ ] Balance ve build sürümü kaydedilmiş.

---

# BÖLÜM S — CODEX ÇALIŞMA YÖNTEMİ

## 81. Görev Boyutu

Codex’e şu tür görev verilmemelidir:

> “Ekonomi sistemini tamamen yap.”

Bunun yerine:

> “ResourceWallet bileşenini, JSON veri tanımını, negatif stok doğrulamasını ve birim testlerini oluştur.”

Her görev:

- tek bir net hedef,
- sınırlı dosya kapsamı,
- görünür kabul kriteri,
- test komutu,
- kapsam dışı maddeler

içermelidir.

---

## 82. Önerilen Görev Şablonu

```markdown
# Görev

Tek cümlelik hedef.

## Kaynak Belgeler

- İlgili GDD bölümü
- Teknik karar belgesi
- İlgili veri şeması

## Mevcut Durum

- Çalışan sistemler
- Kullanılacak mevcut bileşenler
- Bilinen sınırlamalar

## Kapsam

- Yapılacak maddeler

## Kapsam Dışı

- Bu görevde yapılmayacak maddeler

## Teknik Gereksinimler

- Veri yapısı
- API sınırı
- Event veya state davranışı
- Hata yönetimi

## Kabul Kriterleri

- Gözlenebilir sonuçlar

## Testler

- Otomatik testler
- Manuel test adımları

## Teslimat

- Değişen dosyalar
- Kısa teknik not
- Bilinen sınırlar
```

---

## 83. Her Codex Görevinde Zorunlu Talepler

- [ ] Var olan mimariyi önce incele.
- [ ] Benzer bileşenleri yeniden kullan.
- [ ] Yeni global singleton oluşturma.
- [ ] Denge sayılarını kod içine gömme.
- [ ] Public API’leri belgelemeyi unutma.
- [ ] Error ve fallback durumlarını ele al.
- [ ] Test ekle veya mevcut testi güncelle.
- [ ] Debug görünümünü unutma.
- [ ] İlgisiz refactor yapma.
- [ ] Kapsam dışı özellik ekleme.
- [ ] Değişen GDD kararını raporla.

---

## 84. Commit Boyutu

İdeal commit:

- tek davranış değişikliği,
- testleriyle birlikte,
- geri alınabilir,
- başka büyük sistemin yarım uygulamasını içermeyen

bir paket olmalıdır.

Örnek iyi commitler:

- `feat: add local production buffer`
- `feat: connect production buildings to logistics graph`
- `test: add outpost disconnect recovery scenario`
- `fix: prevent AI build retry loop`

Kaçınılacak commit:

- `feat: implement economy buildings roads AI UI and save`

---

# BÖLÜM T — BAĞIMLILIK VE KRİTİK YOL

## 85. Kritik Yol

```text
Build ve veri temeli
→ Kamera ve seçim
→ Hareket ve savaş omurgası
→ İşçi ve yapı kurma
→ İki kaynak ekonomisi
→ Karakol ve yol
→ AI-1
→ Oynanış Kanıtı Kapısı
→ Dört kaynak ve iki çağ
→ Okçu ve kuşatma
→ AI-2
→ Çekirdek Maç Kapısı
→ Üçüncü çağ
→ Asset entegrasyonu
→ Denge ve RC
```

Koşullu sistemler kritik yol üzerinde değildir:

- Bölgesel zafer
- Fog of war
- Minimap
- Refah
- Kule
- Kolay ve Zor AI

---

## 86. Sistem Bağımlılıkları

### Ekonomi

Bağımlıdır:

- veri loader,
- işçi görevleri,
- yapı sistemi,
- HUD.

### Lojistik

Bağımlıdır:

- yol graph’ı,
- kontrol alanı,
- üretim tamponu,
- depo düğümleri.

### Savaş

Bağımlıdır:

- seçim ve komut,
- navigasyon,
- sağlık ve hasar,
- birim üretimi.

### AI-1

Bağımlıdır:

- iki kaynak ekonomisi,
- yapı placement,
- karakol ve yol,
- savaş omurgası.

### AI-2

Bağımlıdır:

- dört kaynak,
- çağ sistemi,
- tam birim kadrosu,
- çekirdek maç akışı.

### Asset polish

Bağımlıdır:

- model rolleri kilitlenmiş oynanış,
- footprint ve giriş anchor’ları,
- animasyon olayları.

---

# BÖLÜM U — RİSK YÖNETİMİ

## 87. Risk 1 — Oynanış Kanıtı Yerine Altyapı Projesi

Belirti:

- haftalar geçmesine rağmen tam maç oynanamıyor,
- genel amaçlı framework sürekli genişliyor,
- debug araçları oynanıştan daha fazla zaman alıyor.

Önlem:

- her fazın oynanabilir senaryosu zorunlu,
- genel sistem yerine tek haritaya uygun çözüm,
- iki günlük görev sınırı,
- feature flag,
- Kapı A’dan önce yeni içerik yasağı.

---

## 88. Risk 2 — AI Kapsamı Yeniden Büyür

Belirti:

- çoklu ordu,
- karmaşık taktikler,
- genel amaçlı serbest yol planlama,
- çok sayıda stratejik durum.

Önlem:

- üç AI katmanı,
- beş ana niyet,
- tek saha ordusu,
- hazır harita adayları,
- AI-1 ve AI-2 ayrı kapsam,
- gelişmiş AI kritik yol dışında.

---

## 89. Risk 3 — Yol Sistemi Yalnızca Zorunlu Tıklamaya Dönüşür

Belirti:

- oyuncu her zaman en kısa yolu otomatik çiziyor,
- düşman yollarla etkileşmiyor,
- alternatif rota gerekmiyor,
- bağlantı durumu okunmuyor.

Önlem:

- yol maliyeti,
- en az bir riskli kısa rota,
- güvenli uzun rota,
- karakol ve depo hedefleri,
- alternatif bağlantı testi,
- lojistik düğüm işgali prototipi,
- Kapı A oyuncu testi.

---

## 90. Risk 4 — Pathfinding ve Köprü Sıkışması

Önlem:

- harita blockout aşamasında genişlik testi,
- kuşatma için ayrı agent ölçüsü,
- küçük grup hedef dağıtımı,
- tıkanma timeout,
- fallback hedef noktaları,
- dekor collider’larını sınırlandırma.

---

## 91. Risk 5 — Üç Çağ İçeriği Asset Yükünü Büyütür

Önlem:

- her bina için üç benzersiz model zorunlu değil,
- malzeme ve prop varyantları,
- yalnız ana binalarda güçlü seviye farkı,
- süvari çıkarıldı,
- ayrı okçu binası çıkarıldı,
- tek kuşatma birimi.

---

## 92. Risk 6 — UI Aşırı Kalabalık Olur

Önlem:

- sürekli, seçime bağlı ve kritik bilgi ayrımı,
- Refah koşullu,
- büyük sabit panellerden kaçınma,
- aynı uyarıyı gruplayarak gösterme,
- minimap’i yalnız gerekliyse ekleme.

---

## 93. Risk 7 — Maç Süresi Uzar

Önlem:

- güvenli kaynakları sınırlama,
- Kasaba aşamasını ana çatışma dönemi yapma,
- Krallık çağını bitirici hale getirme,
- AI Finish Game davranışı,
- kuşatmayı erişilebilir tutma,
- bölgesel zaferi yalnız çıkmaz varsa ekleme.

---

## 94. Scope Cut Sırası

Takvim veya kalite baskısı oluşursa şu sırayla kesilir:

1. Minimap
2. Fog of war
3. Bölgesel zafer
4. Refah
5. Kule
6. Kolay ve Zor zorluk profilleri
7. T3 yan yapı modelleri
8. Gelişmiş maç istatistikleri
9. Ekran kenarı kamera kaydırma
10. Kontrol grupları
11. Ayrıntılı VFX
12. Ayrıntılı ses varyasyonları

Kesilmemesi gereken çekirdek:

- kamera ve seçim,
- işçi ve yapı kurma,
- dört kaynak final ekonomi,
- yol ve karakol,
- kontrol alanı,
- yerel tampon,
- Muhafız, Okçu ve Kuşatma,
- güvenilir AI rakip,
- askerî zafer,
- okunabilir HUD.

---

# BÖLÜM V — TEST STRATEJİSİ

## 95. Test Katmanları

### Birim testleri

- Veri doğrulama
- Kaynak harcama
- Nüfus kapasitesi
- Hasar hesabı
- Utility veya niyet puanı
- Graph bağlantısı

### Sistem testleri

- Üretim tamponu
- Yol bağlantısı
- Karakol alanı
- Yapı inşası
- Çağ atlama
- Birim üretimi
- AI yapı planı

### Sahne testleri

- Köprü hareketi
- Karakol kesintisi
- Alternatif rota
- Büyük çatışma
- Merkez saldırısı
- Kaynak tükenmesi

### Tam maç testleri

- Gameplay Proof
- Core Match
- Final Vertical Slice
- AI vs AI hızlandırılmış maç
- Düşük FPS maçı

---

## 96. Faz Test Raporu Şablonu

```markdown
# Faz Test Raporu

## Build

## Balance Sürümü

## Test Edilen Özellikler

## Oynanabilir Senaryo

## Otomatik Test Sonucu

## Manuel Test Sonucu

## Performans

## Bulunan Hatalar

## Blocker Hatalar

## Bilinen Sınırlar

## GDD Sapmaları

## Oynanış Bulguları

## Faz Kabul Durumu

- Kabul
- Şartlı Kabul
- Reddedildi
```

---

## 97. Blocker Hata Tanımı

Aşağıdakiler blocker kabul edilir:

- Maç başlatılamıyor veya bitirilemiyor.
- Ana ekonomi kalıcı biçimde kilitleniyor.
- Karakol veya yol graph’ı bozuluyor.
- Birimler zorunlu rotaya ulaşamıyor.
- AI sonsuz karar veya yapı döngüsüne giriyor.
- Kaynaklar negatif oluyor.
- Yapı yıkımı save gerektirmeden sahne durumunu bozuyor.
- UI oyuncunun devam etmesini engelliyor.
- Yeniden başlatma eski state bırakıyor.
- Ana build’de sık tekrarlanan crash oluşuyor.

---

# BÖLÜM W — MILESTONE’LAR

## 98. Milestone 1 — Combat Spine

İçerik:

- Kamera
- Seçim
- Hareket
- Basit savaş
- Merkez yıkımı
- Zafer ve restart

Çıkış:

- 2–5 dakikalık basit savaş senaryosu

---

## 99. Milestone 2 — Settlement Loop

İçerik:

- İşçi
- Yapı placement
- İnşaat
- İki kaynak
- Nüfus
- Kışla ve birim üretimi

Çıkış:

- Ekonomi kurup asker üretilebilen senaryo

---

## 100. Milestone 3 — Logistics Proof

İçerik:

- Kontrol alanı
- Karakol
- Yol graph’ı
- Yerel tampon
- Depo bağlantısı
- Bağlantı kesintisi

Çıkış:

- Oyunun ayırt edici döngüsünü gösteren tam senaryo

---

## 101. Milestone 4 — Gameplay Proof AI Match

İçerik:

- AI-1
- İki kaynak ekonomisi
- Tek genişleme
- Tek saha ordusu
- Askerî zafer

Çıkış:

- Ürün A
- Kapı A kararı

---

## 102. Milestone 5 — Core Match

İçerik:

- Dört kaynak
- İki çağ
- Muhafız, Okçu, Kuşatma
- AI-2
- Temel HUD
- 12–20 dakikalık maç

Çıkış:

- Ürün B
- Kapı B kararı

---

## 103. Milestone 6 — Full Progression

İçerik:

- Üçüncü çağ
- Geç oyun bitirme baskısı
- Final yapı ve birim dengesi
- Koşullu stratejik sistem kararları

Çıkış:

- 20–30 dakikalık tam maç

---

## 104. Milestone 7 — Presentation Candidate

İçerik:

- Final harita
- Asset entegrasyonu
- Temel VFX ve ses
- Bildirimler
- Sonuç ekranı

Çıkış:

- Dış test yapılabilir build

---

## 105. Milestone 8 — Release Candidate

İçerik:

- Denge
- Stabilite
- Performans
- Bug fixing
- Belgeler

Çıkış:

- Ürün C

---

# BÖLÜM X — DEFINITION OF DONE

## 106. Özellik Definition of Done

Bir özellik tamamlanmıştır yalnızca:

- [ ] GDD veya teknik karar kaynağı belli.
- [ ] Kapsam ve kapsam dışı maddeler tanımlı.
- [ ] Veri koddan ayrılmış.
- [ ] Normal akış çalışıyor.
- [ ] En az temel hata akışı ele alınmış.
- [ ] Oyuncu geri bildirimi var.
- [ ] Debug görünümü veya logu var.
- [ ] Otomatik veya sistem testi var.
- [ ] Oynanabilir senaryoda kullanıldı.
- [ ] Feature flag davranışı doğru.
- [ ] Bilinen sınırlar belgelendi.
- [ ] İlgili test raporu güncellendi.

---

## 107. Vertical Slice Definition of Done

Vertical slice tamamlanmıştır yalnızca:

- [ ] Tek harita tamamlanmış.
- [ ] Tek AI rakip çalışıyor.
- [ ] Dört kaynak kullanılıyor.
- [ ] Üç çağ oynanıyor.
- [ ] Yol ve karakol genişlemenin merkezinde.
- [ ] Yerel tampon ve bağlantı kesintisi çalışıyor.
- [ ] İşçi, Muhafız, Okçu ve Kuşatma çalışıyor.
- [ ] Askerî zafer güvenilir.
- [ ] İkinci zafer yalnız kabul edilmişse çalışıyor.
- [ ] UI temel nedenleri açıklıyor.
- [ ] Maç başlatma ve yeniden başlatma güvenilir.
- [ ] AI kaynak, yapı, genişleme, savunma ve saldırı yapıyor.
- [ ] 30 tam maç test edilmiş.
- [ ] Maçların en az %90’ı blocker olmadan tamamlanmış.
- [ ] Hedef performans kabul edilmiş.
- [ ] Build ve balance sürümü kayıtlı.
- [ ] GDD sapmaları belgelenmiş.
- [ ] Kapsam dışı sistemler build’de yarım görünmüyor.

---

# BÖLÜM Y — ANA ÜRETİM CHECKLIST’İ

## 108. Ürün A — Oynanış Kanıtı

### Temel

- [x] Build ve test altyapısı (`build:verify`, `test:engine`, hedefli Playwright smoke)
- [x] Veri loader (`gameDataLoader` + JSON doğrulama)
- [x] Feature flag (`runtimeConfig` / `featureFlags`)
- [x] Debug paneli (`?rts&debug`: maç, ekonomi ve kaynak hareketleri)

### Kontrol

- [x] Kamera (üstten eğimli RTS kamera, WASD ve zoom)
- [x] Tekli seçim (birim raycast seçimi)
- [x] Kutu seçimi (marquee)
- [x] Hareket (sağ tık + grid navigasyonu)
- [x] Saldırı (sağ tık hedef emri + yakın dövüş)
- [x] Dur (`X` ile seçili birimleri durdur)

### Harita

- [x] Küçük blockout (`RTS_BLOCKOUT_MAP`)
- [x] İki rota (merkez sırtının doğu/batı flankları)
- [x] Dış kaynak alanı (`externalResource` placeholder alanı)
- [x] Nav testi (iki flank, yapı engeli ve güvenli çıkış engine testleri)

### Yerleşim

- [x] İşçi (inşa, üretim ve boşta durumları)
- [x] Yapı placement (ghost, snap, çakışma ve maliyet kontrolü)
- [x] İnşaat (işçi ataması, ilerleme ve iptal/iade)
- [x] Merkez (sahiplik, sağlık, zafer hedefi ve işçi üretimi)
- [x] Ev (yerleştirme ve +5 nüfus kapasitesi)
- [x] Depo (yerleştirilebilir yapı tanımı; graph düğümü rolü Faz 4)
- [x] Kışla (yerleştirme, inşa ve Muhafız üretimi)

### Ekonomi

- [x] Yiyecek (Tarla, işçi üretimi ve yerel tampon)
- [x] Odun (Oduncu Kampı, işçi üretimi ve yerel tampon)
- [x] İşçi üretimi (Merkez kuyruğu, 50 yiyecek maliyeti)
- [x] Nüfus (20 taban kapasite, Ev +5, kuyruk rezervasyonu)
- [x] Yerel tampon (yapı başına kapasite, dolunca üretim durur)

### Lojistik

- [ ] Kontrol alanı
- [ ] Karakol
- [ ] Yol graph’ı
- [ ] Depo bağlantısı
- [ ] Bağlantı kesintisi
- [ ] Alternatif rota

### Savaş ve AI

- [x] Muhafız (Kışla kuyruğu, maliyet/nüfus ve güvenli çıkış)
- [x] Merkez yıkımı (düşman merkezinin yıkımı zaferi tetikler)
- [ ] AI-1
- [ ] Zafer ve yenilgi
- [x] Restart (maç sahipli state, birimler, merkezler ve rezervasyonlar sıfırlanır)

### Kapı

- [ ] Beş tam maç
- [ ] Oyuncu testi
- [ ] Kapı A kararı

---

## 109. Ürün B — Çekirdek Maç

### Ekonomi

- [ ] Taş
- [ ] Altın
- [ ] Kaynak tükenmesi
- [ ] Dört kaynak HUD

### İlerleme

- [ ] Yerleşim
- [ ] Kasaba
- [ ] Merkez T2
- [ ] Kışla T2

### Savaş

- [ ] Okçu
- [ ] Kuşatma
- [ ] Saldırı-Hareket
- [ ] Pozisyonu Koru
- [ ] Grup hareketi

### AI

- [ ] Beş ana niyet
- [ ] Dört kaynak ekonomisi
- [ ] Çağ atlama
- [ ] Karışık ordu
- [ ] Geri çekilme
- [ ] Toparlanma

### UI ve maç

- [ ] Temel HUD
- [ ] Bildirimler
- [ ] Pause
- [ ] Teslim ol
- [ ] Sonuç ekranı

### Kapı

- [ ] 15 tam maç
- [ ] %80 teknik tamamlama
- [ ] Kapı B kararı

---

## 110. Ürün C — Sunulabilir Vertical Slice

### İlerleme

- [ ] Krallık çağı
- [ ] Merkez T3
- [ ] Geç oyun bitirme baskısı

### Koşullu

- [ ] Bölgesel zafer kararı
- [ ] Fog kararı
- [ ] Minimap kararı
- [ ] Refah kararı

### Sunum

- [ ] Asset envanteri
- [ ] Bina modelleri
- [ ] Birim modelleri
- [ ] Animasyonlar
- [ ] Takım renkleri
- [ ] Yol ve dünya
- [ ] VFX
- [ ] Ses

### Denge ve QA

- [ ] 30 tam maç
- [ ] %90 blocker olmayan maç
- [ ] 20–30 dakika hedefi
- [ ] Performans testi
- [ ] Kör oyuncu testi
- [ ] RC kabulü

---

# BÖLÜM Z — AÇIK ÜRETİM KARARLARI

## 111. Üretime Başlamadan Kilitlenecekler

- [ ] Forge içindeki navigasyon çözümü
- [ ] Yapı placement grid ölçüsü
- [ ] Yol grid ölçüsü
- [ ] Kamera perspektif veya ortografik kararı
- [ ] Placeholder asset standardı
- [ ] Birim hedef yoğunluğu
- [ ] Ana test çözünürlükleri
- [ ] Minimum hedef donanım

---

## 112. Kapı A Sonrası Kararlar

- [ ] Yol saldırılabilir mi, yoksa düğüm ve yapı üzerinden mi kesilecek?
- [ ] Alternatif rota oyuncuya yeterli değer sunuyor mu?
- [ ] Dış üretim için ayrı depo zorunlu mu?
- [ ] Karakol bağlantısızken ne kadar alan açmalı?
- [ ] Bağlantı kesintisi üretimi ne kadar sürede durdurmalı?

---

## 113. Kapı B Sonrası Kararlar

- [ ] Bölgesel zafer gerekli mi?
- [ ] Fog of war gerçekten oynanış değerine sahip mi?
- [ ] Minimap gerekli mi?
- [ ] Refah hangi rolde kalmalı?
- [ ] Kule çekirdek savaşa katkı sağlıyor mu?
- [ ] Krallık çağında hangi yeni karar açılmalı?

---

## 114. Varsayılan Tavsiye Edilen Kararlar

Üretim başlangıcında aksi kanıtlanana kadar:

- Kamera sabit yönlü, hafif perspektifli.
- İki kaynaklı Oynanış Kanıtı kullanılır.
- Karakol küçük alanı hemen, tam alanı yol bağlantısıyla açar.
- Yol segmentleri doğrudan saldırılamaz.
- Karakol ve depo lojistik kesinti hedefidir.
- Lojistik düğüm işgali yalnız prototip olarak test edilir.
- İşçiler fiziksel kaynak taşımaz.
- Yerel tampon + soyut yol aktarımı kullanılır.
- AI hazır harita adaylarını ve rota koridorlarını kullanır.
- Tek saha ordusu kullanılır.
- Okçu Kışla II içinde açılır.
- Süvari kapsam dışıdır.
- Refah sert çağ kilidi değildir.
- Askerî zafer zorunlu, bölgesel zafer koşulludur.
- Save/load kapsam dışıdır.
- Fog ve minimap koşulludur.

---

## 115. Revizyon Notları

### Sürüm 0.2

- Teknik katman odaklı üretim modeli kaldırıldı.
- Baştan sona oynanabilir dilimler getirildi.
- Oynanış Kanıtı, Çekirdek Maç ve Sunulabilir Vertical Slice ayrıldı.
- İlk kapsam iki kaynak, tek askerî birim ve tek zafer yoluna indirildi.
- AI üretimi AI-1 ve AI-2 aşamalarına bağlandı.
- Save/load zorunlu vertical slice kapsamından çıkarıldı.
- Fog, minimap, Refah ve bölgesel zafer koşullu hale getirildi.
- Süvari kapsamdan çıkarıldı.
- Okçu yapısı Kışla yükseltmesiyle birleştirildi.
- Her faz için oynanabilir senaryo ve üretim kapısı eklendi.
- Scope-cut sırası çekirdek oynanışı koruyacak biçimde güncellendi.

### Sürüm 0.1

- Teknik katmanlara göre 16 fazlı ilk üretim planı.
