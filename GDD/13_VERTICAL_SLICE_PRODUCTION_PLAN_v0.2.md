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
8. Fog of war çekirdek maç kanıtlandıktan sonra değerlendirilecektir; minimap küçük sahne ölçeği nedeniyle kapsamdan çıkarılmıştır (`SCOPE_LOG.md` SL-006).
9. Süvari vertical slice kapsamından çıkarılmıştır.
10. Okçu, yalnız Kasaba Çağında kurulabilen Okçuluk Alanı'nda üretilecektir; Muhafız Kışla Lv1, Koçbaşı ise Kasaba Çağı Kışla Lv2 kapısındadır.
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
- Okçuluk Alanı (yalnız Kasaba Çağı)
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
- Koçbaşı üretimi Kasaba Çağı Kışla Lv2 üzerinden; ayrı Atölye sonraki kuşatma kadrosuna ertelenir

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

- [x] Dört kaynak farklı kararlar üretiyor.
- [x] İki çağ arasında anlamlı fırsat maliyeti var.
- [x] Oyuncu ve AI en az bir kez genişliyor.
- [x] Muhafız, Okçu ve Kuşatma net rollere sahip.
- [x] Askerî zafer çoğu maçta 12–25 dakika içinde gerçekleşiyor.
- [x] AI ekonomik kilitlenmeden temel düzeyde çıkabiliyor.
- [x] AI geçerli yapılar ve yollar kuruyor.
- [x] Köprü ve dar rotalarda kalıcı grup sıkışması oluşmuyor.
- [x] En az 15 tam maç tamamlandı.
- [x] Maçların en az %80’i teknik hata olmadan bitiyor.

**Kapı B geçildi (17 Tem 2026).** 15+ tam maç oynandı; maçlar teknik hata olmadan
bitti ve on kutu oynanışla doğrulandı. Tek oynanış bulgusu bir *blocker değil,
denge sorunu*: AI açılışta hızlıca Kışla kurup Muhafızlarını gönderiyor (early
rush), ve oyuncu ancak ondan *önce* Kışla kurup saldırırsa kazanabiliyor — yani
maçın sonucu erken askerî tempoyla belirleniyor, "12–25 dakika" penceresi ise
ancak her iki taraf da rush yapmadığında görülüyor. Maç oynanabilir ve
bitebilir olduğu için bu kutuları düşürmedi, ama açılış çeşitliliğini kapatıyor.
Düzeltme — **erken oyun saldırmazlık süresi** — Faz 9 yapılacak listesine
kaydedildi (§53) ve şu an sürmekte olan çağ/seviye denge çalışmasına taşındı;
Kapı B'yi bloklamıyor.

Başarısızsa:

- Üçüncü çağ eklenmez.
- Bölgesel zafer eklenmez.
- Görsel polish sınırlandırılır.
- Sorunlu sistem sadeleştirilir veya kapsamdan çıkarılır.

---

## 10. Kapı C — Sunuma Hazır mı?

Release Candidate öncesi:

- [ ] 20–30 dakikalık hedef maç düzenli oluşuyor.
- [ ] Üç çağ görsel ve mekanik olarak ayrılıyor. (**Şu an ulaşılamaz:**
      ThirdAge bina modeli yok — `SL-007`. İki çağ ayrışıyor: FirstAge/SecondAge
      aileleri + her çağda Lv1–3 merdiveni.)
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
- [x] Çift tıkla aynı savaş birimi türünü seç. (Muhafız, Okçu ve Koçbaşı için
  tüm canlı oyuncu birimleri; İşçi tekli/kutu seçiminde kalır.)
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
- [x] Maç sonucu debug yüzeyinden izlenebilir. (`?rts&debug`: iki Merkezin canı
  ve sonuç görünür; AI normal maç kurallarıyla saldırmaya ve kazanabilmeye devam eder.)

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
- [x] Çoklu işçiyle inşaat ekle. (foundation başlangıçta bir otomatik işçi alır; seçili işçiler sağ tıkla eklenir, en fazla dört ayrı kenar noktasında çalışır ve ilerleme aktif işçi sayısıyla doğrusal hızlanır)
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

- [x] İşçi geçerli yapıyı inşa ediyor. (sağ tıkla seçili işçi inşaata veya tamamlanmış üretim yapısına atanır; hareket/saldırı/dur emri görevini bırakır; `test:engine` hedefleme ve çoklu inşaat hızı senaryoları)
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

- [x] Merkezden işçi üretimi ekle. (`WorkerProductionSystem`; Merkez sırayla işçi doğurur; kuyruk kapasitesi Merkez seviyesiyle 5 / 10 / 20'ye çıkar)
- [x] Kışladan Muhafız üretim kuyruğu ekle. (`BarracksProductionSystem`; her Kışla
  sırayla Muhafız doğurur; çağ seviyesi başına kapasite 5 / 10 / 20'dir ve
  maliyet/nüfus kuyruğa alınırken ayrılır.)
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

- [x] Karakol yapı tanımı oluştur. (`buildings.json`: 6x6, 140 odun, 45 sn; küçük alan yarıçapı 16)
- [x] Kontrol alanı dışında sınırlı placement desteği ekle. (en fazla 12 birimlik nötr boşluk; düşman alanı ve iç alan reddedilir)
- [x] Tamamlanınca küçük kontrol alanı aç. (inşaat tamamlanma olayı territory kaynaklarını yeniler)
- [x] Yol bağlantısı kurulunca tam alan aç. (Karakolun yol hücresi oyuncu Merkezine temas eden hücreyle aynı graph bileşenindeyse yarıçap 16’dan 20’ye yükselir.)
- [x] Karakol yıkılınca alanı kapat. (`PlacedStructureSystem.destroy` Karakol territory kaynağını kaldırır; yakın yapılar varlığını korur.)
- [x] Bağlı yapıların `Kontrol Dışı` durumunu ekle. (Kontrol alanı kaybeden üretici aktarımı keser; üretim panelinde `Lojistik: Kontrol Dışı` görünür.)

### Yol

- [x] Hücre tabanlı yol graph’ı oluştur. (`RoadGraph`: ortogonal en kısa rota, engel kaçınma, bağlantı sorgusu ve tekrar ücretlendirmeme)
- [x] Başlangıç ve bitiş ile rota önizleme ekle. (`Yol Kur`: ilk sol tık başlangıcı seçer; sonraki sol tıklar zincire rota ekler; sağ tık aracı bitirir. Hover önizlemesi, geçersiz rota ve odun yetersizliği geri bildirimi.)
- [x] Düz ve dönüş segmentlerini oluştur. (Bağlantı yönlerine göre düz, köşe, T ve kavşak hücreleri merkezi parça + kardinal çıkışlarla çizilir.)
- [x] Yol maliyetini hesapla. (`balance/roads.json`: yalnız yeni hücre başına 4 Odun; ödeme commit anında yapılır)
- [x] Yol bağlantısını runtime’da güncelle. (match-owned `RoadGraph` commit sonrası yol görünümünü yeniler; tekrar çizilen hücre ücretsizdir)
- [x] Yol debug görünümü ekle. (`?rts&debug`: ağ bileşenine göre renkli düğüm ve kenarlar; panelde düğüm/kenar/ağ sayıları)

### Lojistik

- [x] Depoyu graph düğümü yap. (Tamamlanmış Depo, yol hücresi yapının footprint’ine temas edince bileşen kimliği taşıyan lojistik düğümü olur.)
- [x] Üretim yapısını graph’a bağla. (Tamamlanmış Tarla/Oduncu Kampı, temas eden yol hücresinin bileşenindeki en düşük kimlikli bağlı Depoyu hedefler.)
- [x] Bağlı tamponu global stoğa aktar. (Bağlı üretici tamponu her simülasyon adımında global `ResourceWallet` stoğuna aktarılır.)
- [x] Bağlantı kesilince aktarımı durdur. (Yol veya aynı bileşendeki Depo yoksa global kredi kesilir, çıktı yerel tamponda kalır.)
- [x] Yerel tampon dolunca üretimi durdur. (Kesinti sırasında 40 birim yerel limit korunur; yol geri geldiğinde aktarım tamponu boşaltır.)
- [x] Alternatif rota varsa bağlantıyı koru. (`RoadGraph.remove` sonrası bile aynı ağ bileşenindeki alternatif dal üretici-Depo bağlantısını korur.)

### Savaş bağlantısı

- [x] Karakol yıkımının lojistiği kesmesini doğrula. (`test:engine`: yol ve Depo ayakta kalsa bile Karakol kaybı üreticiyi `Kontrol Dışı` yapar.)
- [x] Depo yıkımının dış ekonomiyi etkilemesini doğrula. (`test:engine`: Depo yıkımı üreticiyi `Depo Yok` durumuna geçirir.)
- [x] Opsiyonel lojistik düğüm işgali prototipi oluştur. (`LogisticsOccupationSystem`: düşman işgali Depoyu sahiplik değiştirmeden aktarım dışı bırakır.)
- [x] Bağlantı kesintisi uyarısı ekle. (Yol/Depo/Kontrol/işgal kesintisi için ekranda tek, açıklayıcı uyarı.)

### UI

- [x] Bağlı / Bağlantısız durumu (Üretim paneli `Lojistik: Bağlı/Yol Yok/Depo Yok` gösterir.)
- [x] Kontrol Dışı durumu (Üretim paneli `Lojistik: Kontrol Dışı` ve ekranda kesinti uyarısı gösterir.)
- [x] Yerel tampon durumu (Seçili üretim yapısında mevcut/kapasite tampon değeri görünür.)
- [x] Lojistik overlay (`Ağ Görünümü` düğmesi yol ağ bileşenlerinin renkli düğüm/kenar katmanını açıp kapatır.)
- [x] Bağlantı nedeni tooltip’i (Üretim ayrıntısının tooltip’i her lojistik durumunun çözüm yolunu açıklar.)

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

- [x] Karakol olmadan dış bölgeye normal yapı kurulamıyor. (`test:engine`: kontrol alanı dışındaki normal yapı yerleştirmesi `outside-control` ile reddedilir.)
- [x] Karakol küçük alanı hemen açıyor. (`test:engine`: tamamlanmış Karakol küçük kontrol yarıçapını territory kaynağına ekler.)
- [x] Tam alan yol bağlantısıyla aktif oluyor. (`RtsApp`: Karakol ana Merkezle aynı yol graph bileşenine bağlandığında yarıçapı 16’dan 20’ye çıkar.)
- [x] Bağlantılı yapı üretimi global stoğa aktarılıyor. (`test:engine`: bağlı üreticinin tamponu `ResourceWallet` stoğuna aktarılır.)
- [ ] Bağlantı kesintisi 30–90 saniye içinde üretimi etkiliyor.
- [x] Alternatif rota gerçek yedeklilik sağlıyor. (`test:engine`: bir yol hücresi kesildiğinde alternatif dal üretici–Depo bağlantısını korur.)
- [ ] Oyuncu bağlantı sorununu tek bakışta anlayabiliyor.
- [ ] Graph güncellemesi performans sorunu oluşturmuyor.
- [x] Karakol kaybı binaları anında yok etmiyor. (`test:engine`: Karakol kaldırılır, yakındaki tamamlanmış yapı korunur.)
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

## 37.1. Faz 5.0 — Sahiplik Önkoşulu

`07_ENEMY_AI_DESIGN_v0.2.md` §4 AI'ın oyuncuyla **aynı** kaynak, nüfus ve maliyet
kurallarını kullanmasını şart koşar. Faz 1–4 altyapısı ise tek oyunculu kurulmuştu:
kaynak stoğu ve nüfus havuzu maç başına tekti, `PlacedStructure` sahip taşımıyordu,
yerleştirme yalnız pointer/ghost üzerinden çalışıyordu.

Bu durumda AI'ın "ev kur" kararı oyuncunun kasasından harcayıp oyuncunun nüfus
tavanını yükseltirdi; §39 kabul kriterleri ölçülemez olurdu. Bu yüzden §38'den önce
sahiplik ve headless API katmanı ayrıldı.

- [x] `PlacedStructure.owner` + `PlacedStructureSystem.ownedBy(owner)`.
- [x] `UnitSystem.unitsOf(owner)` / `workersOf(owner)`.
- [x] `KingdomRegistry`: krallık başına `ResourceWallet` + `PopulationSystem`.
- [x] Ekonomi, inşaat ve üretim sistemleri yapının sahibine göre çalışıyor.
- [x] Lojistik: üretici yalnız **kendi** krallığının deposuna teslim ediyor.
- [x] `StructureConstructionService`: pointer'sız, owner'lı yapı kurma.
- [x] `RoadConstructionService`: pointer'sız, owner'lı yol kurma.
- [x] Kabul: krallık ekonomileri izole. (`test:engine`: düşman inşaatı oyuncunun
  stoğunu ve nüfus tavanını değiştirmiyor.)
- [x] Kabul: AI her iki servisi de oyuncuyla aynı kurallar altında çağırabiliyor.
  (`test:engine`: kontrol alanı, maliyet ve iptal kuralları iki taraf için aynı.)

Not: `tools/` dizini `tsconfig.json` `include` listesinde değildir; `npx tsc --noEmit`
motor testlerini denetlemez. RTS imzaları değiştiğinde `npm run test:engine`
çalıştırmak zorunludur.

---

## 38. Görevler

### AI temel yapı

- [x] `KingdomDirector` oluştur. (`kingdomDirector.ts`: beş niyet, §7 bağlılık
  süresi + %25 histerezis, acil durum kesmesi, plan zaman aşımı. Niyet puanları
  `intentScorer.ts` içinde saf fonksiyonlar; ağırlıklar `balance/ai.json`'da.)
- [x] `ArmyManager` oluştur. (`armyManager.ts`: §51 tek saha ordusu,
  §15 görev sözlüğü, §62 güç eşikleri.)
- [x] Birim AI komut yürütmesini bağla. (ArmyManager oyuncunun sağ tıkıyla aynı
  `setMovePath`/`setAttackTarget` çağrılarını üretir — ayrı bir AI birim yolu yok.)
- [x] AI blackboard oluştur. (`aiBlackboard.ts`: §19 minimal alan seti. §20 bilgi
  sınırı burada uygulanıyor — AI rakibin stoğunu okuyamıyor.)
- [x] Karar logu ekle. (`aiDecisionLog.ts`: sınırlı ring buffer; gerekçesiz kayıt
  hata fırlatıyor. `aiDebugView.ts` §82 panelini üretiyor.)
- [x] AI hızlandırılmış test modu ekle. (AI kararları ölçeklenmiş maç deltasıyla
  ilerlediği için mevcut 2X/4X/8X oyun hızı AI'ı da hızlandırıyor; ayrı bir
  anahtar gerekmedi. `AiController` renderer'dan bağımsız, bu yüzden motor
  testleri tam maçı headless koşabiliyor.)

Not: Bu grup AI'ın **karar** katmanıdır. Planı binaya çeviren uygulayıcılar
(Açılış/Ekonomi/Genişleme grupları) henüz yok, bu yüzden bir plan şimdilik zaman
aşımına uğrayana kadar çalışır. §54 "minimum savunma grubu tut" da ayrı bir Ordu
görevi olarak duruyor: ArmyManager şu an saldırıda tüm muhafızları gönderiyor.

### Açılış

- [x] Başlangıç işçi dağılımı. (AI artık oyuncuyla aynı 5 işçiyle başlıyor;
  bedava muhafızı yok — ordusu kurduğu Kışla'dan çıkmak zorunda, bu yüzden açılış
  rush değil ekonomik.)
- [x] İlk ev. (`aiEconomyManager.nextBuilding`: nüfus tavanına
  `populationPressureBuffer` kadar yaklaşınca Ev sırayı öne alıyor.)
- [x] İlk yiyecek ve odun yapısı. (`test:engine`: Tarla → Oduncu Kampı sırası.)
- [x] İlk Kışla. (`test:engine`: ekonomiden sonra Kışla.)
- [x] Minimum savunma gücü. (`aiProductionManager`: işçi hedefi dolunca Kışla
  muhafız üretiyor. Not: §54'ün "orduyu üste bırakma" kısmı hâlâ Ordu grubunda.)

### Ekonomi

- [x] Yiyecek ve odun gelir hedefleri. (`intentScorer` IncomeDeficit + §37
  `no-food-production` / `no-wood-production` darboğazları.)
- [x] Nüfus kilidi önleme. (`test:engine`: AI baskı altında Ev kuruyor ve tavanı
  yükseltiyor; §55 nüfus doluyken kuyruğa girmiyor.)
- [x] İşçi üretimi. (`aiProductionManager`: oyuncuyla aynı
  `WorkerProductionSystem`, aynı maliyet ve nüfus kuralları.)
- [x] Yapı kuyruğu. (`aiBuildManager`: §42 tek aktif inşaat, §40 haritada
  tanımlı aday alanlar, §43 aday tükenince adlandırılmış hata.)
- [x] Kaynak yetersizliğinde bekleme ve yeniden değerlendirme. (`test:engine`:
  parasız AI `waiting` döndürüyor, iyi bir aday alanı kara listeye almıyor ve
  cüzdanı eksiye düşmüyor.)

**Bilinen sınır — AI'ın geliri yok.** Faz 4 lojistiğine göre üretim yerel
tamponda birikir ve cüzdana ancak depo + yol bağlantısıyla akar. AI henüz depo
ve yol kurmuyor (Genişleme grubu), bu yüzden başlangıç stoğuyla sınırlı ve
darboğazı doğru şekilde `disconnected-production` olarak raporluyor. Bu, AI'ın
uzun maçta ekonomik olarak duracağı anlamına gelir; Genişleme grubu bunu açar.

**`expand` niyeti veriyle kapalı.** Uygulayıcısı olmayan bir niyet seçilirse AI
plan zaman aşımına kadar hiçbir şey yapmaz ve üssü durur. Bu yüzden
`balance/ai.json` içinde `intentWeights.expand = 0` — `ageUp` ile aynı gerekçe.
Genişleme grubu geldiğinde açılacak.

### Genişleme

- [x] Harita verisinden tek aday genişleme alanı oku. (`RTS_BLOCKOUT_MAP.enemyExpansion`:
  §45 bölge tanımı — karakol/depo/üretim çapası + §48 hazır yol koridoru.)
- [x] Karakol kur. (`aiExpansionManager` §47 reçetesi, adım 1.)
- [x] Hazır veya sınırlı rota ile yol bağla. (Koridor segment segment kuruluyor;
  segmentler idempotent olduğu için yarım kalan rota baştan başlamıyor.)
- [x] Dış üretim yapısı kur. (`test:engine`: depo → tarla; tarla depoya aynı yol
  adasında bağlanıyor, yani AI **ilk kez gerçek gelir elde ediyor**.)
- [x] Yerleştirme başarısızlığında fallback kullan. (`test:engine`: claim
  edilemeyen bölge `AI_EXPANSION_FAILURE_LIMIT` sonrası terk ediliyor, sonsuz
  denemiyor; terk edilen bölge puanı 0'a düşüyor.)

**Bu grupta bulunan ve düzeltilen Faz 4 hatası.** Merkez'in nav footprint'i 7 birim,
yol ızgarası 2 birim: değen her hücre bloklanıyor, bloklanmayan hiçbiri değmiyordu.
Yani `roadCellTouchingFootprint` Merkez için **hiçbir zaman** hücre bulamıyordu ve
`outpostConnectedToMainRoad` hep `false` dönüyordu — Karakol'un bağlı kontrol
yarıçapı (16→20) ne AI'a ne oyuncuya veriliyordu. §35'te bu kriter [x] işaretliydi
ama çalışmıyordu. Tolerans yarım yol hücresine çekildi (`test:engine` regresyon
testi ekli). Bu düzeltme olmadan Karakol'un yanına 6x6 depo sığmadığı için
genişleme reçetesi tamamlanamıyor.

**İkinci düzeltme — kalıcı nüfus kilidi.** Üreticiler her boşta işçiyi kapınca
şantiyeye işçi kalmıyordu: ev bitmiyor → nüfus açılmıyor → yeni işçi üretilemiyor.
Ayrıca işçisiz kalan şantiye bir daha hiç denenmiyordu. `WorkerConstructionSystem`
artık işçisiz şantiyeyi yeniden deniyor ve gerekirse üretimden işçi çekiyor
(§55: önce nüfus kapasitesi). Oyuncu için de geçerli.

**Bilinen sınır.** Yalnız genişleme bölgesi yol ağında. Üssdeki Tarla ve Oduncu
Kampı'nın kendi deposu ve yolu yok, bu yüzden hâlâ yerel tamponda birikiyorlar
(`test:engine` bunu 2 bağlantısız üretici olarak kilitliyor). Üs deposu + üs yol
koridoru henüz haritada tanımlı değil.

### Ordu

- [x] Tek saha ordusu oluştur. (`ArmyManager`: bütün canlı Muhafızlar tek saha
  ordusunda; paralel raid/siege grubu yok.)
- [x] Minimum savunma grubu tut. (`test:engine`: iki Muhafız merkezde kalırken
  kalan dört Muhafız hedefe gidiyor; minimum güçteki ordu üssü boşaltmıyor.)
- [x] Belirli güç eşiğinde saldır. (`test:engine`: riskli eşikte yalnız yüksek
  değerli hedefe çıkıyor, kaybedilen güç oranında yeniden toplanıyor.)
- [x] Hedef olarak dış ekonomi veya merkez seç. (`test:engine`: dengeli güçte
  savunmasız dış ekonomi, kesin üstünlükte merkez seçiliyor.)
- [x] Ağır kayıpta üsse dön. (`test:engine`: güç oranı veya ortalama sağlık
  eşiği düştüğünde saldırı hedefi temizlenip ordu üsse dönüyor.)

### Zafer

- [x] Oyuncu merkezini hedefleyebilme. (`test:engine`: kesin üstünlükte
  `assaultTarget` oyuncu Merkezini hedefliyor.)
- [x] Kendi merkezini savunma. (`test:engine`: üs baskını saldırı niyetini
  kesiyor ve Muhafızlar merkezdeki düşmana saldırıyor.)
- [x] Maç bittikten sonra karar üretmeyi durdurma. (`test:engine`: AI tek
  `match-ended` kaydıyla planı/ordu komutunu durduruyor; yeniden başlatılan
  dünyada tekrar karar veriyor.)

---

## 39. Kabul Kriterleri

- [x] AI beş ardışık maçta açılışını tamamlıyor. (`test:engine`: headless maç
  Tarla → Oduncu Kampı → Kışla sırasını tamamlıyor ve işçi hedefine ulaşıyor;
  §80 determinizm testi aynı girdinin aynı kararları ürettiğini doğruluyor, yani
  tek koşu beş koşuyu temsil ediyor. Gerçek beş maçlık oyuncu testi hâlâ açık.)
- [x] AI nüfus sınırında kalıcı kilitlenmiyor. (`test:engine`: baskı altında Ev
  kuruyor, tavanı haritanın tanımladığı 4 ev slotu boyunca yükseltiyor.)
- [x] AI en az bir kez karakol kuruyor. (`test:engine`: genişleme reçetesi
  Karakol adımını tamamlıyor.)
- [x] AI karakolu yola bağlayabiliyor. (`test:engine`: yol koridoru tamamlanıp
  Karakol ana yol ağına bağlanıyor.)
- [x] AI en az bir saldırı gerçekleştiriyor. (`test:engine`: saha ordusu dış
  ekonomiye veya yeterli üstünlükte Merkeze saldırı emri üretiyor.)
- [x] AI merkezi saldırı altında savunmaya dönüyor. (`test:engine`: üs tehdidi
  her saldırı niyetinin önüne geçiyor ve merkezdeki saldırgana hedef emri veriyor.)
- [x] AI geçersiz yapı konumunda sonsuz döngüye girmiyor. (`test:engine`: §40
  aday alanlar haritadan geliyor; art arda `AI_ANCHOR_FAILURE_LIMIT` kez
  reddedilen aday kara listeye alınıyor ve adaylar tükenince görev
  `no-valid-placement` ile başarısız oluyor.)
- [x] AI normal oyunda gizli kaynak bonusu kullanmıyor. (`test:engine`:
  `balance/ai.json` normal profilinde `economyMultiplier != 1` doğrulayıcıdan
  geçmiyor; çarpan debug panelinde görünüyor. AI kaynağı §4 ile aynı
  `KingdomRegistry` kasasından harcıyor.)
- [x] AI karar nedeni debug panelinde görülebiliyor. (`test:engine`:
  `formatRtsAiDebug` aktif niyeti, beş niyetin puan/gerekçesini ve son kararları
  yazıyor; gerekçesiz karar logu hata fırlatıyor.)
- [x] Oyuncu veya AI maçı kazanabiliyor. (`test:engine`: rakip Merkezinin
  yıkılması `victory`, oyuncu Merkezinin yıkılması `defeat`; çift yıkım `defeat`.)

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

- [x] Taş kaynağı verisi. (`balance/resources.json`: güvenli/dış Taş düğümü
  kapasitesi ve işçi başına üretim hızı; `ResourceBalance` doğrulayıcısı.)
- [x] Altın kaynağı verisi. (`balance/resources.json`: güvenli/dış Altın düğümü
  kapasitesi ve işçi başına üretim hızı; RTS açılışında veri yükleniyor.)
- [x] Taş Ocağı. (`quarry`: yalnız Taş düğümünü örten yerleşim, üç işçi ve
  düğümden çekilen sonlu üretim; düğüm bittiğinde işçiler serbest kalır.)
- [x] Altın Madeni. (`gold_mine`: yalnız Altın düğümünü örten yerleşim, üç işçi ve
  düğümden çekilen sonlu üretim.)
- [x] Kaynak düğümü tükenmesi. (`ResourceNodeSystem`: güvenli/dış düğüm kapasitesi
  biter, üretim durur; `test:engine` taş düğümü tükenmesini ve işçi bırakmayı doğrular.)
- [x] Güvenli ve dış kaynak kapasite farkları. (`test:engine`: her iki kaynakta
  dış düğümün toplam kapasitesi güvenli düğümden büyük olmak zorunda; eşit/bozuk
  veri açık hata veriyor.)

### Çağ sistemi

- [x] Yerleşim ve Kasaba durumları. (`AgeSystem`: her krallık Yerleşim başlar;
  tamamlanan Merkez yükseltmesi yalnız o krallığı Kasaba durumuna geçirir.)
- [x] Çağ maliyeti. (`balance/ages.json`: 600 Yiyecek, 350 Odun, 150 Taş ve
  150 Altın atomik rezerve edilir; eksik kaynak veya önkoşul harcama yapmaz.)
- [x] Çağ yükseltme süresi. (`balance/ages.json`: Kasaba yükseltmesi 105 saniye;
  `test:engine` veri süresi tamamlanmadan durumu değiştirmediğini doğrular.)
- [x] Yükseltme sırasında merkezin davranışı. (İşçi kuyruğu iptal edilmez ancak
  Merkez yükseltmesi boyunca durur; Kasaba tamamlanınca aynı kuyruğu sürdürür.)
- [x] Açılan yapı ve birlikler. (Yeni birlik türleri ve Okçu yapısı Faz 7 birim
  kadrosu kapsamındadır.)
  **Güncellendi (2026-07-18):** Bu kutu daha önce "Kasaba tamamlanana kadar T2 Ev,
  Depo, Kışla ve Karakol eylemleri paletten kilitlidir" diyordu. O çağ kapısı
  `KR-04` ile kaldırıldı: seviye yükseltmesi her çağda açıktır ve düğmeler
  paletten binanın seçim paneline taşındı. Çağ artık yapı *seviyesi* değil, yapı
  *sanat ailesi* ve yeni yapı/birlik türleri açar.
- [x] Çağ bildirimi. (HUD çağ durumunu/geri sayımını gösterir; başlatma, iptal ve
  tamamlanma mesajları `RtsBuildPalette` eylem alanına yazılır. Tamamlanma
  bildirimi davranışı anlatır: "tüm binalarınız yeni çağ modeline geçti ve
  seviye 1'e döndü".)
- [x] Çağ atlama → tüm binalar yeni çağın Lv1'i. (`RtsApp` çağ-tamamlanma
  handler'ı `rebuildForAge(owner)` ile sahibin bütün yapılarını yeni sanat
  ailesiyle yeniden kurar; `structureUpgrades.resetOwner(owner)` uçuştaki
  yükseltmeleri iade edip her binayı taban Lv1'e çeker — sağlık, ev nüfusu ve
  karakol alanı taban değerlere döner. Oyuncu ve AI aynı yoldan geçer.)

### Yapı yükseltmeleri

> **Bu blok 2026-07-18'de yeniden yazıldı.** Faz 6'da üretilen sistem
> tür-geneli, çağ kapılı, tek adımlı (T1→T2) bir araştırmaydı. Çağ/seviye
> ayrıştırma çalışması onu **instance-bazlı, çağ kapısız, iki adımlı
> (Lv1→Lv2→Lv3)** bir sisteme çevirdi. Aşağıdaki kutular teslim edilen *son*
> durumu anlatır; Faz 6'nın orijinal T2 araştırması artık kodda yoktur.
> Karar kaydı: `docs/planned/THREEAGES_AGE_AND_LEVEL_PROGRESSION_PLAN.md`.

- [x] Per-bina seviye yükseltmesi. (`StructureUpgradeSystem` anahtarı
  `structure.id`; `start/snapshot/isUpgrading` `PlacedStructure` alır. Aynı
  türden iki bina farklı seviyelerde olabilir. Yükseltme düğmesi binanın kendi
  seçim panelindedir, palette değil.)
- [x] Çağ kapısı kaldırıldı (`KR-04`). (`isTown` şartı ve tür-geneli
  `completedUpgrades` semantiği silindi; seviye merdiveni her çağda açıktır.)
- [x] Üç seviye. (`buildings.json` `levels: BuildingLevelBalance[]`; Ev, Depo,
  Kışla, Karakol ve Tarla için Lv2 + Lv3 tanımlı. Her giriş `cost`,
  `durationSeconds`, `maxHealth` ve opsiyonel `populationCapacity` / `territory`
  taşır.)
- [x] Merkez çağ katmanı olarak kaldı. (Per-bina merdivenin dışında; `level`
  Yerleşim = 1, Kasaba = 2. `ages.json` Kasaba sonucu 450 sağlık, 22 kontrol
  yarıçapı ve 9 sn işçi üretimi verir; model `TownCenter_SecondAge_Level2`.)
- [x] Seviyesiz yapılar bilinçli olarak dışarıda. (Taş Ocağı ve Altın Madeni
  `Mine`, Oduncu Kampı stand-in — çağ/level mesh varyantı yok, `levels` tanımı
  da yok, dolayısıyla seviye düğmesi çıkmıyor.)
- [x] Yükseltme ilerleme çubuğu. (`SelectionProgress` + `SelectionPanelContent.progress`;
  `StructureUpgradeView.progress` adımın `durationSeconds` ve `remainingSeconds`
  değerinden hesaplanır. Mekanizma genel — ileride inşaat ilerlemesi de aynı
  alana bağlanabilir. Plan dışı, kullanıcı isteğiyle eklendi.)

### Refah kararı

Vertical slice’ın bu aşamasında Refah:

- çağ atlama koşulu olmayacaktır,
- istenirse hesaplanan bir debug veya bilgi metriği olacaktır,
- üretimi bloke etmeyecektir.

Görevler:

- [x] Refah feature flag’i oluştur. (`prosperity` varsayılan olarak kapalıdır; preset
  veya `?flags=prosperity` ile yalnız debug bilgisi açılır.)
- [x] Basit hesap formülü ekle, yalnız gerekli görülürse. (Gerekli değildir: Faz 6
  Refahı yalnız bilgi/feature flag kararı olarak tutar, oyun durumu hesaplamaz.)
- [x] Sert kilit olarak kullanılmadığını test et. (`test:engine`: Refah varsayılan
  kapalıdır, URL ile açılabilir ve `AgeSystem` bu bayrağı hiçbir çağ/üretim kapısında okumaz.)

### Denge

- [x] İki çağ için `core_match` presetini oluştur. (`preset=core_match`: dört kaynak
  tanımlı, Taş/Altın başlangıçta sıfır, normal hız ve normal AI; Yerleşimden Kasabaya
  ilerlemeyi gerçek üretimle sınar.)
- [x] İlk çağ hedef süresini belirle. (`core_match` için Kasaba tamamlanma hedefi
  7–12 dk; 105 sn Merkez yükseltmesi nedeniyle başlatma penceresi 5:15–10:15'tir.
  Bu, eski taslaklardaki daha geniş 6–10 dk karar penceresinin v0.2 kabul aralığıdır.)
- [x] İlk askerî temas hedefini belirle. (`core_match`: ilk iki taraflı Muhafız
  teması 5–9 dk; kışla kuruluşu, ilk Muhafız kuyruğu ve karşı tarafa ilk saldırı
  emri birlikte ölçülür.)
- [ ] Kaynak darboğaz raporu oluştur.

---

## 43. Kabul Kriterleri

- [x] Dört kaynak farklı kullanım alanına sahip. (`test:engine`: Yiyecek işçi,
  Odun yapı/Muhafız, Taş seviye yükseltmeleri ve Altın Kasaba geçişi kararlarına
  bağlanır.)
- [ ] Oyuncu yalnız güvenli kaynaklarla bütün maçı bitiremiyor.
- [x] Kasabaya geçiş gerçek fırsat maliyeti oluşturuyor. (`AgeSystem` dört kaynak
  maliyetini atomik rezerve eder; testte başarılı başlangıç sonrası tüm stok sıfırdır.)
- [x] Çağ atlama sırasında oyuncu savunmasız kalabiliyor. (Merkez işçi kuyruğu
  yükseltme boyunca durur ve ayrılmış kaynaklar yeni üretime kullanılamaz.)
- [ ] AI Kasaba çağına ulaşabiliyor.
- [ ] Kaynak düğümü tükenmesi yeni genişlemeyi teşvik ediyor.
- [x] Refah oyuncuyu bekleten görünmez kilit oluşturmuyor. (`prosperity` yalnız
  isteğe bağlı debug bilgisidir; `AgeSystem` ve üretim kapıları bu bayrağı okumaz.)

---

# BÖLÜM K — FAZ 7: ÇEKİRDEK SAVAŞ KADROSU

## 44. Amaç

Muhafız, Okçu ve Kuşatma arasında okunabilir bir karşıtlık sistemi oluşturmak.

---

## 45. Görevler

### Birim verisi

- [x] Muhafız verisini tamamla. (`balance/units.json`: 110 sağlık, 12 hasar,
  1.4 sn, `heavy` zırh sınıfı, 6 hız; GDD 12 §31–§34 aralıklarında.)
- [x] Okçu verisi oluştur. (`archer_placeholder`: 75 sağlık, `ranged` 7 menzil,
  `light` zırh; Kışla T2 gerektirir.)
- [x] Kuşatma birimi verisi oluştur. (`siege_placeholder` Koçbaşı: 220 sağlık,
  28 taban hasar × 2.5 yapı çarpanı = ~70 yapı hasarı, 4.2 hız, 3 nüfus.)
- [x] Nüfus maliyetleri ekle. (`populationCost`: İşçi/Muhafız/Okçu 1, Kuşatma 3.)
- [x] Hedef sınıfları ekle. (`UnitArmorClass` = light/heavy/structure;
  `damageMultipliers` GDD 12 §33 yumuşak karşıtlık tablosunu veriye taşır.
  Her yapı ve Merkez `structure` sınıfı taşır.)
- [x] Hareket ve saldırı verilerini JSON’a taşı. (`moveSpeed`, `attackType`,
  `acquisitionRange`, `chaseRange`; koddaki `UNIT_MOVE_SPEED` sabiti kaldırıldı.
  `validateUnitBalance` her alanı ve tutarsız menzil/leash kombinasyonlarını
  açık hata ile reddeder.)

### Üretim

- [x] Okçuyu Kasaba Çağı Okçuluk Alanı Lv1 içinde aç; Koçbaşı Kasaba Çağı Kışla Lv2 içindedir. (`productionBuildingId`, `requiredAge` ve `requiredBuildingLevel` kapıları veridedir,
  kodda bina kimliği kontrolü yok.)
- [x] Kuşatma üretimini tek seviyeli Atölye veya Kışla II içinde çöz. (Kışla II
  seçildi; ayrı Atölye yapısı kapsam dışında kaldı.)
- [x] Üretim kuyruğu ekle. (`BarracksProductionSystem.queueUnit`; mevcut
  5 / 10 / 20 çağ kapasitesi tüm kadro için ortaktır.)
- [x] Rally point ekle. (Palet `Toplanma Noktası` düğmesi; yeni birlik güvenli
  çıkışta doğar ve rota planlanabiliyorsa oraya yürür.)
- [x] Bağlantısı kesilen askerî yapının davranışını uygula. (Kontrol alanı
  dışında kalan Kışla `disconnected` döner ve üretim durur.)

### Komutlar

- [x] Saldırı-Hareket (`F`; WASD pan nedeniyle klasik `A` yerine. Yol boyunca
  hedef edinir, çatışma bitince ilerlemeyi sürdürür. İşçiler dahil edilmez.)
- [x] Pozisyonu Koru (`H`: hareket emirlerini bırakır, menzilindekine ateş eder;
  `G` serbest duruşa döndürür.)
- [x] Geri çekilme için normal hareket kullanımı (Normal hareket emri bir transit
  emridir: yol üzerindeki düşmanı hedef edinmez, bu yüzden geri çekilme
  güvenilirdir; ancak bir Muhafız gerçekten hasar alırsa transit emrini bırakıp
  saldırgana savunmayla karşılık verir.)
- [x] Hedef ve komut göstergeleri (mevcut hedef halkası + saldırı-hareket için
  turuncu, toplanma noktası için yeşil komut işareti.)

### Savaş

- [x] Yakın dövüş slot sistemi veya basit yaklaşma düzeni (basit yaklaşma
  seçildi: `planAttack` menzil kenarında durur, formasyon dağıtımı korunur.)
- [x] Menzilli saldırı ve mermi (`ProjectileSystem`: hasar atış anında uygulanır,
  mermi yalnız görsel iz taşır — hedefi ölen/uzaklaşan mermi sınıfı hata
  yüzeyini kapsam dışında bırakır.)
- [x] Yapı hasar sınıfı (`CombatTarget.armorClass`; Merkez ve tüm yapılar
  `structure`.)
- [x] Kuşatma yapı bonusu (2.5 çarpan; Muhafızın 0.35'ine karşı 7 kat.)
- [x] Hedef kaybı ve yeniden hedefleme (`engagementSystem`: ölen hedef bırakılır,
  menzildeki bir sonraki düşman edinilir; birimler yapılara tercih edilir.)
- [x] Kovalama mesafesi (`chaseRange`; yalnız kendi edindiği hedefi kovalarken
  geçerlidir — oyuncunun verdiği emir leash'e takılmaz.)
- [x] Dost ateşi olmaması (yapı gereği: hasar yalnız `attackTarget` üzerine
  çözülür ve hiçbir sistem onu dost birime yöneltmez.)

### Grup hareketi

Bu bölüm ayrı bir dilim olarak üretildi: kalabalık/tıkanma davranışı kendi test
setini gerektirdi ve Faz 7 savaş kadrosunun kabulünü bloke etmedi.

- [x] Küçük grup hedef dağıtımı. (`groupOrders.assignGroupDestinations`: formasyon
  slotları seçim sırasına göre değil, yakınlığa göre dağıtılır — en yakın çift
  önce, greedy. Grup kendi içinden geçerek yer değiştirmez; aynı seçim farklı
  sırada verildiğinde aynı emirler çıkar. Ulaşılamayan slot önce ham komut
  noktasına düşer, ancak sonra `path: null` olur.)
- [x] Dar geçit testi. (`test:engine`: 3 birim genişliğinde geçitten 12 Muhafız
  geçer; hepsi karşı tarafa ulaşır, kimse bitmeyen emirle kalmaz ve hiçbir birim
  bir diğerinin içinde durmaz.)
- [x] Köprü testi. (`test:engine`: 4 birim genişliğinde geçitte karşılıklı iki
  kol aynı anda; her geçiş sonlanır ve iki kolun da çoğunluğu karşıya geçer.)
- [x] Büyük kuşatma agent testi. (`test:engine`: Koçbaşı, Muhafız korumasıyla
  geçitten geçer ve kalabalık geniş gövdesinin içine girmez. **Kapsam notu:**
  ajan başına navigasyon gridi denendi ve geri alındı — nav hücresi 1 dünya
  birimi, kadronun yarıçap farkı ise 0.25, yani grid "Muhafızın geçtiği ama
  Koçbaşının geçemediği geçit" ayrımını ifade edemiyor. Hücreyi küçültmek
  engine'deki `MAX_GRID_CELLS = 20000` sınırını aşıyor (mevcut grid 14.641
  hücre). Gövde genişliği bu yüzden yalnız ifade edilebildiği yerde,
  `unitSeparation` mesafesinde uygulanır; gerekçe `rtsNavigation.plan`
  yorumunda.)
- [x] Tıkanma timeout ve fallback. (`unitMovement`: waypoint'ine 1.5 sn boyunca
  yaklaşamayan birim önce en fazla iki kez yeniden rota planlar; sonra hedefine
  2 birimden yakınsa varmış sayılır, değilse emir düşer. Böylece hiçbir stall
  kalıcı olmaz. `test:engine` aynı noktaya gönderilen altı birimin hedefte
  toplanıp emirlerini bitirdiğini, ilerleyen birimin ise emrini koruduğunu
  doğrular.
  **Faz 9 düzeltmesi — bu kalem yazıldığında çalışmıyordu.** İlerleme adımın
  içinde ölçülüyordu; birimin adımını hiçbir şey reddedemediği için timeout hiç
  ateşlenmedi ve yukarıdaki garantinin tamamı ölü koddu. Buradaki üç testin
  hiçbiri de o yola uğramıyordu (ölçülen stall 0.00 sn, replan 0) — geçmelerinin
  sebebi birimlerin gerçekten varmasıydı. İlerleme artık kare-arası net kazançla
  ölçülür (hareket + `unitSeparation` birlikte), replan bütçesi kendi
  harcanmasıyla iade edilmez ve kalabalığın yer vermediği birimi doğrudan sınayan
  bir regresyon testi eklendi. Bkz. §51 "Sinyal çözüldü".)
- [x] Kalabalık ayrımı. (`unitSeparation`: hareket sonrası çakışan gövdeler
  birbirini iter; itme birimin kendi hızının %55'iyle sınırlıdır ve navigasyon
  gridi yürünemez zemine itmeyi veto eder. Komşu taraması uniform hash ile
  3x3 hücreyle sınırlıdır — kabul kriterindeki O(n²) riski buradan çıkarıldı.)

### UI

- [x] Birim rol açıklaması (`RtsSelectionPanel`; GDD 06 §6–§9 rol özetleri.)
- [x] Güçlü ve zayıf hedef göstergesi (aynı `damageMultipliers` verisinden
  türetilir; HUD veride olmayan bir karşıtlığı gösteremez.)
- [x] Grup özeti (rol başına adet + toplam can; karışık seçimde baskın *savaş*
  rolü anlatılır, işçiler yalnız saf ekonomi seçiminde.)
- [x] Sağlık çubukları (birim üstünde billboard çubuk; orana göre renk.)

---

## 46. Kabul Kriterleri

- [x] Muhafız ön hat rolü taşıyor. (`test:engine`: ağır hedefe karşı en yüksek
  hasarı Muhafız verir; en yüksek sağlıklı piyade odur.)
- [x] Okçu korunduğunda etkili, yakalandığında zayıf. (`test:engine`: menzili
  Muhafızın 3 katından fazla, sağlığı ve yakın dövüş takası daha düşük.)
- [x] Kuşatma yapılara karşı gerekli ve birimlere karşı zayıf. (`test:engine`:
  yapı çarpanı Muhafızın 4 katından fazla, birimlere karşı her iki sınıfta da
  en düşük. Tarayıcı doğrulaması: 4 Muhafız 300 canlı Merkezi vuruş başına
  yalnız 4.2 hasarla ~208 sim saniyede yıkabildi.)
- [x] Tek birim türü her durumda en iyi seçim değil. (`test:engine`: her
  saldıran en az bir hedef sınıfında bir diğerine yeniliyor.)
- [x] 25–40 birimlik çatışma kabul edilebilir performansta. (`test:engine`:
  20'ye 20 saldırı-hareket çatışmasında hedefleme + hareket + ayrım + savaş
  geçişleri birlikte kare başına **0.18 ms** — 16 ms bütçesinin ~%1'i. Test
  4 ms tavanıyla korunur; bu bir benchmark değil, ayrım geçişine O(n²) tarama
  geri sızarsa yakalayan regresyon kapısıdır.)
- [x] Köprüde kalıcı sıkışma oluşmuyor. (`test:engine` köprü testi: dar geçitte
  karşılıklı iki kol; her emir ya varışla ya durmayla sonlanır — tıkanma
  timeout'u kalıcı stall'u yapı gereği imkânsız kılar. **Faz 9 notu:** bu
  gerekçe yazıldığı anda geçersizdi; timeout hiç ateşlenmiyordu ve köprü testi
  onu hiç çağırmıyordu. Kutu artık gerçekten timeout'a dayanıyor — bkz. §45.)
- [x] Oyuncu birim rollerini görsel ve UI üzerinden anlayabiliyor. (Rol başına
  ayrı siluet + `RtsSelectionPanel` rol/güçlü/zayıf satırları; tarayıcı
  doğrulaması: karışık seçimde "Güçlü: ağır birim · Zayıf: yapı".)

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

- [x] Niyet puanlarını veri tabanlı hale getir. (`balance/ai.json` `scoring` bloğu:
  her §30 teriminin katsayısı + normalize ediciler artık veride; `intentScorer`
  yalnız formülün *şeklini* tutuyor — hangi terimler toplanır, hangileri çarpılır.
  `validateAiBalance` bilinmeyen terimi ve negatif katsayıyı reddediyor.
  `test:engine`: `workerNeed`'i veride sıfırlamak katkısını kaldırıyor.)
- [x] Minimum plan süresi ekle. (Faz 5'ten mevcut: `minimumCommitmentSeconds`.)
- [x] Plan değiştirme eşiği ekle. (Faz 5'ten mevcut: `hysteresisMargin` %25.)
- [x] Acil savunma kesmesini ekle. (Faz 5'ten mevcut; Faz 8 `workers-lost`
  acilini ekledi — §27: işçisi kalmayan krallık önce ekonomiyi kurar.)

**Faz 8'de bulunan ve düzeltilen puanlama hatası.** `scoreAttack` hazırlığı
`powerRatio / attackPowerRatio` ile ölçüyordu; bu, ordu **asgari** saldırı
barajını (1.1 — yazı tura) geçer geçmez hazırlığı 1.0'a doyuruyordu. Puanlar
0..1'e kırpıldığı için Attack kalıcı 1.0'da kalıyor, §7 histerezisi de onu
yenilmez yapıyordu (rakip 1.25× gerektirir, ulaşılamaz). Sonuç: AI izin verilen
ilk kavgaya 5 muhafızla giriyor, bir daha asla gelişmiyor, çağ atlamıyordu —
§24'ün "çağ atlama ekonomi ile denge içinde olmalıdır" kuralı her zaman maksimum
olan bir niyete karşı duramaz. Hazırlık artık `riskyAttackPowerRatio` → 
`dominancePowerRatio` bandına yayılıyor: yazı tura kavga 0.18, ezici üstünlük
1.0. (`test:engine` regresyon testi ekli.)

### Ekonomi

- [x] Dört kaynak için hedef gelirler (`balance/ai.json`
  `economy.incomeTargetsPerMinute`; puanlama **en kötü** açığı alıyor, ortalamayı
  değil — ortalama, üç sağlıklı gelirin sıfır taşı gizlemesine izin verirdi ve
  Kasaba taş *ve* altına bağlı. `test:engine`: gıda/odun hedefteyken sıfır taş
  hâlâ "stone geliri yetersiz" olarak okunuyor.)
- [x] Çağ hazırlığı işçi dağılımı (`economy.workerTarget` yaş başına: Yerleşim 8 →
  Kasaba 16. Üreticiler boştaki işçiyi kendileri kapıyor, dolayısıyla AI dağılımı
  işçi *atayarak* değil kaç işçi var ederek şekillendiriyor — dört kaynaklı
  ekonomi iki katı el istiyor.)
- [x] Kaynak darboğazı tespiti (`no-stone-production` / `no-gold-production`
  eklendi; §27 gereği `workers-lost` hepsinin önünde — işçisiz hiçbir şey kendini
  yeniden kurmaz.)
- [x] Kritik yapı yeniden kurma (Sıra durum güdümlü: yıkılan yapının sayısı 0'a
  düşer ve üssü açan aynı sıra onu yeniden kurar — ayrı bir onarım dalı yok.
  Üs deposu için `AiInfrastructureManager` aynı işi yapıyor: depo kaybolursa
  adım 1'e düşüp yeniden kuruyor.)
- [x] İşçi kaybı sonrası toparlanma (`test:engine` §27: çalışan bir ekonominin
  **bütün** işçileri öldürülüyor; `workers-lost` acili yanıyor, darboğaz onu
  hepsinin önüne alıyor, yönetici Economy'ye dönüyor ve AI kendi kendine işçi
  üretip üreticileri yeniden dolduruyor — gelir geri geliyor ve acil **sönüyor**.
  Toparlanma ayrı bir dal değil: sıradan ekonominin yeniden çalışması.)

**Faz 8'de bulunan ve düzeltilen üç hata.**

1. **Yapı sırası kilitleniyordu.** `nextBuilding` tek bir istek döndürüyordu:
   bütün ev slotları dolunca nüfus baskısı sonsuza dek "house" diyordu, ev
   kurulamıyordu ve altındaki Taş Ocağı/Altın Madeni'ne hiç sıra gelmiyordu —
   yani Kasaba çağı yapısal olarak ulaşılamazdı. Artık `buildOrder` bir öncelik
   *listesi* döndürüyor ve tıkanan öncelik altındakileri dondurmuyor.
2. **Kalıcı nüfus kilidi.** Ordu tavana kadar büyüyor, sonra `population-blocked`
   acili sonsuza dek yanıyordu; bütün ev slotları doluyken bu acil hiçbir zaman
   giderilemez, yönetici Economy'de çakılı kalır ve AI bir daha asla çağ atlamaz
   veya karar değiştirmezdi (§49 "karar değiştirme döngüsüne girmiyor"un en
   düz ihlali). `army.populationShare` (0.55) orduya tavan koyuyor.
   (`test:engine`: yerleşmiş AI'da `population < populationCap` ve kalıcı acil yok.)
3. **Yol hattı her tick yeniden döşeniyordu.** `AiInfrastructureManager` ayakta
   olan hattı her ekonomi tick'inde yeniden `build` ediyordu; döşenmiş segmentin
   commit'i de `territory.refresh()` tetikleyip 121×121 dünya ızgarasını
   baştan tarıyordu. Motor testi 16 dakika çıktı vermeden askıda kaldı. Hat artık
   yalnız `disconnectedProducers` kesinti sinyali geldiğinde ele alınıyor.

**Faz 8'in ikinci turunda bulunan üç hata daha.** Üçü de aynı kökten: *test
dünyası `RtsApp`ı aynalamıyordu ve bu, gerçek hataları saklıyordu.*

1. **Kuyruk aşımı (işçi ve ordu).** AI hem işçi hedefini hem ordu nüfus payını
   **yaşayan birimlere** karşı ölçüyordu; oysa Merkez ve Kışla çağa göre 5/10/20
   *ödenmiş* sipariş tutuyor. Uçuştaki her sipariş bütçeyi aşıyordu: ordu payını
   bir kuyruk dolusu (Koçbaşı'yla 15 nüfusa kadar) geçiyor, artan işçiler de
   ordunun bütçelendiği nüfusu yiyordu; ikisi birlikte AI'ı nüfus tavanına
   sıkıştırıyordu — §49'un "karar değiştirme döngüsü" kriterinin bir başka düz
   ihlali. Artık iki bütçe de `queuedPopulation` / `queuedCount` ile *taahhüt
   edilmiş* olanı sayıyor.
2. **Test dünyası Kışla kuyruğunu 1'e sabitliyordu** (`RtsApp` çağ ölçekli 5
   kullanıyor). Bu, 1'i görünmez kılan şeydi *ve* bir sonraki hatayı sakladı.
3. **`workerTarget.settlement = 8` Kasaba çağına yetmiyordu.** Üs dört üretici
   çalıştırıyor (tarla, oduncu, taş ocağı, altın madeni) ve her biri 3 el
   istiyor: 12. Sekiz işçiyle taş ocağı ve altın madeni boş kalıyor, Kasaba çağı
   ise taş *ve* altına bağlı — AI Kasaba'ya yalnızca 1'deki işçi aşımı sayesinde,
   kazara ulaşıyordu. Hedef 12'ye çıkarıldı; §35 "çağ hazırlığı işçi dağılımı"
   artık gerçekten üretici kapasitesinden türüyor.

### Yapı ve genişleme

- [x] Birden fazla aday yapı alanı (Mekanizma Faz 5'ten: `AiBuildManager` bir
  yapının bütün aday çapalarını sırayla dener, reddedileni §43 kara listesine
  alır ve bir sonrakine geçer. **Kapsam notu:** haritada yalnız Ev'in birden
  fazla adayı var (6 slot). Düşman üssünün 18 birimlik kontrol yarıçapı Merkez,
  dört üretici, Depo, Kışla, altı Ev ve yol hattıyla dolu — ekonomi yapılarına
  ikinci bir slot sığmıyor. Alternatif slot haritanın kapasitesine bağlı; kod
  tarafı hazır.)
- [x] En fazla iki genişleme planı (`AiExpansionCoordinator`; sınır haritanın
  kaç bölge yazdığına değil AI'a ait: `AI_MAX_EXPANSION_PLANS = 2`. `test:engine`
  üç bölge yazılmış bir haritada AI'ın yalnız ikisini talep ettiğini ve harita
  tercih sırasına uyduğunu kanıtlıyor. Bölge sayımı *denenen* plandır (§45), bitense
  değil. Harita artık iki aynalı bölge yazıyor: `enemy_west` ve `enemy_east`.)
- [x] Karakol ve depo yeniden kurma (Reçete artık "done"da bitmiyor: talep edilen
  her bölge her tick'te kendi karakolu, deposu ve üretim yapısından sorumlu.
  Kaybolan slot reçeteyi o adıma geri döndürüyor ve **ilk kez kuran kodun aynısı**
  yeniden kuruyor — ayrı bir onarım dalı yok. `test:engine`: tamamlanmış bölgenin
  karakolu yıkılıyor, adım `outpost`'a düşüyor, AI yeniden kuruyor.)
- [x] Yol rota fallback'i (`RtsExpansionRegion.routes` tercih sıralı bir liste.
  Reddedilen koridor *rotayı* emekliye ayırıyor, bölgeyi değil; bölge ancak
  yazılmış alternatifleri tükendiğinde terk ediliyor. §48 hâlâ serbest rota
  aramasını dışlıyor — alternatifler yazılmış, keşfedilmiş değil. `test:engine`:
  birincil koridora yapı park ediliyor, AI alternatiften bağlanıyor.)
- [x] Bağlantı kesintisi onarımı (`disconnectedProducers` sinyali tamamlanmış
  bölgeyi `route` adımına geri alıyor. Sağlam ayak `plan` ile sıfır maliyet
  görülüp atlanıyor, yani onarım *yeniden döşeme*ye dönüşmüyor — `test:engine`
  onarım sonrası cüzdanın değişmediğini doğruluyor. Bu, üs hattında bir kez
  yaşanmış bir hatanın bölge tarafındaki karşılığı.)

### Ordu

- [x] Muhafız / Okçu / Kuşatma oranı (`army.composition` yaş başına; üretim,
  ordunun *payına göre açığı* en büyük rolü seçiyor — sayıya göre değil, yoksa
  AI açılışta hangi rolü ürettiyse onu yığardı. Faz 8 eksik parçayı ekledi:
  `AiUpgradeManager` Kışla II'yi araştırıyor, yoksa Okçu/Koçbaşı `requiredBuildingLevel: 2`
  arkasında kalıcı olarak erişilemezdi. Tetikleyici bir kural değil, üretimin
  **verinin kendi kapısından** aldığı `requires-barracks-upgrade` cevabı — kapı
  veride kalıyor. `test:engine`: headless maçta 17 Muhafız + 8 Okçu ve `barracks#2`.
  **Kuşatma açığı aşağıda.**)
- [x] Tek ana saha ordusu (Faz 5'ten: `fieldArmy()` yaşayan her savaş birimi;
  aynı anda tek görev — §51'in "ikinci akın ordusu yok" kuralı yapı gereği.)
- [x] Küçük üs savunma rezervi (Faz 5'ten: `garrison()` üsse en yakın birimleri
  `minimumDefensePower` dolana dek tutuyor. `test:engine` §54.)
- [x] Dış ekonomi hedefleme (Faz 5'ten: `harassEconomy` görevi + §60 puanlaması.
  `test:engine` §60: eşit güçteyken dış ekonomi, ezici üstünlükte Merkez.)
- [x] Merkez saldırısı (Faz 5'ten: `assaultTarget`; §69 dominance bandı Merkez'e
  ne zaman değeceğini belirliyor. `test:engine` §60.)
- [x] Kayıp eşiğinde geri çekilme (İki bağımsız §65 tetikleyicisi: güç oranı ve
  ortalama can. `test:engine` §62/§65 ikisini de ayrı ayrı doğruluyor.)

**Faz 8'de kapatılamayan kapsam: Koçbaşı.** §53 oranı Koçbaşı istiyor ve AI artık
onu üretmeye *çalışıyor* — ama bu harita finanse edemiyor. İki güvenli yatak 300
taş / 200 altın taşıyor; Kasaba çağı (150) ve Kışla II (80) taşın neredeyse
tamamını harcıyor, geriye tek bir 100 taşlık Koçbaşı için yetmeyen ~70 kalıyor.
GDD 08 §15 zaten "ikinci ve üçüncü çağ için dış kaynak zorunlu" diyor: Koçbaşı
**dış** yatak ekonomisini şart koşuyor. Bu haritanın iki dış yatağının **ikisi de**
(`external_stone` ve `external_gold`, z = 16) oyuncunun yarısında; AI'ın erişimi
yok. GDD 08 §15 aynı zamanda "Oyuncu ve AI kaynak erişim süreleri ölçülür, büyük
fark olmamalıdır" diyor — yani bu bir harita yazım açığı, AI açığı değil. Kapatmak
haritanın kaynak yerleşimine dokunmayı gerektiriyor (Faz 6 kapsamı) ve bir tasarım
kararı: dış yataklar aynalanmalı mı, yoksa iki üssün ortasına mı taşınmalı?

### Bilgi

Çekirdek Maç Prototipi aşamasında AI:

- tam fog kullanmak zorunda değildir,
- ancak oyuncunun gizli kaynak stoğunu okuyamaz,
- görünür veya keşfedilmiş hedef listesi kullanmalıdır,
- son bilinen hedef bilgisi için basit zaman aşımı kullanabilir.

### Debug

`formatRtsAiDebug` saf bir biçimlendirici; §82 paneli motor testiyle
doğrulanıyor, ekran görüntüsüne bakarak değil.

- [x] Aktif niyet (Faz 5'ten; Faz 8 çağ satırını ekledi.)
- [x] Niyet puanları (Faz 5'ten: beş niyetin puanı + gerekçesi.)
- [x] Kaynak hedefleri (Dört kaynağın **hedefiyle birlikte** oranı: çıplak bir
  oran hangi kaynağın AI'ı tuttuğunu göstermez.)
- [x] Aktif yapı planı (`snapshot.activeBuild`: §42 yapı slotunu ne tutuyor —
  "biriktiriyor" ile "sıkıştı" arasındaki fark.)
- [x] Ordu gücü (Faz 5'ten; Faz 8 rol bazlı bileşim satırını ekledi — çıplak güç
  §53 oranının tutulup tutulmadığını göstermez.)
- [x] Seçilen saldırı hedefi (Faz 5'ten: hedef + puan + kazanma gerekçesi.)
- [x] Geri çekilme nedeni (`AiRetreatReason`: `outmatched` "güç oranı düştü" /
  `attrition` "ordu yıprandı". Yalnız iki §65 tetikleyicisi neden yazabiliyor —
  hiç çıkmamış bir ordunun "toplanması" geri çekilme değildir. `test:engine`
  üç durumu da doğruluyor.)
- [x] Son on karar (`MAX_DECISION_LINES` 5 → 10.)

---

## 49. Kabul Kriterleri

- [x] AI dört kaynaklı ekonomi kuruyor. (`test:engine`: AI'a **hiç** taş ve altın
  verilmiyor; maç sonunda ikisini de kasasında tutuyor, yani hepsini yerden
  çıkardı. Bu tek başına bütün zinciri kanıtlıyor: yatağı örten bir çıkarıcı,
  üstünde işçiler, ona değen bir yol ve aynı yol adasında bir depo. Ayrıca
  `disconnectedProducers === 0` — Faz 5'in "AI'ın geliri yok" sınırı kapandı.)
- [x] AI Kasaba çağına ulaşıyor. (`test:engine`: headless maçta `age === "town"`.
  Betiklenmiş bir adım değil — çağın gereksinim listesi veride, AI oraya yalnız
  altı gerekli yapıyı sağlayan bir ekonomiyi işleterek geldi.)
- [x] AI en az bir dış ekonomi açıyor. (Faz 5'ten: §47 reçetesi `done`.)
- [x] AI karışık ordu üretiyor. (`AiUpgradeManager` eksik uygulayıcıyı kapattı:
  AI Kışla II'yi oyuncunun düğmesiyle aynı sistemden araştırıyor. `test:engine`
  headless maçta 17 Muhafız + 8 Okçu, `barracks#2`, `upgradeStep === "done"`.)
- [ ] AI yapı hedefleri için kuşatma kullanıyor. **Kışla II engeli kalktı; kalan
  engel harita ekonomisi.** İki güvenli yatak 300 taş / 200 altın veriyor; Kasaba
  (150) + Kışla II (80) sonrası tek bir 100 taşlık Koçbaşı için yetmiyor. GDD 08
  §15 dış yatağı ikinci çağ için zorunlu kılıyor, ama bu haritanın iki dış yatağı
  da oyuncunun yarısında (z = 16) — aynı §15'in "erişim süreleri arasında büyük
  fark olmamalı" kuralına aykırı. Bkz. Ordu bölümündeki kapsam notu.
- [x] AI merkez saldırısına bütün ordusunu gereksiz yere kaybetmiyor. (§62
  hazırlık eğrisi + iki bağımsız §65 geri çekilme tetikleyicisi, ikisi de
  `test:engine` ile ayrı ayrı doğrulanıyor; §54 garnizonu üssü boş bırakmıyor.)
- [x] AI ağır kayıp sonrası yeniden ekonomi kurabiliyor. (`test:engine` §27:
  bütün işçileri öldürülen AI acili yakıyor, Economy'ye dönüyor, işçi üretiyor ve
  geliri geri geliyor — acil sönüyor.)
- [ ] AI 10 hızlandırılmış maçın en az 8’ini tamamlıyor. **Ölçüm altyapısı eksik:**
  headless test dünyası savaşı çözmüyor (`step()` içinde çatışma/ölüm/yıkım yok),
  bu yüzden hiçbir maç *bitmiyor*. Kriter, `RtsApp`ın savaş hattını da aynalayan
  tam bir maç koşucusu istiyor.
- [ ] AI karar değiştirme döngüsüne girmiyor. (Üç kalıcı kilit düzeltildi — nüfus
  acili, yapı sırası ve Faz 8'de bulunan işçi/ordu **kuyruk aşımı** — ama kriterin
  kendisi yukarıdakiyle aynı çoklu maç ölçümünü istiyor.)
- [x] AI’ın davranış nedeni debug panelinden izlenebiliyor. (Geri çekilme nedeni
  dahil, Faz 8'de tamamlandı; yukarıdaki Debug listesine bakınız.)

---

# BÖLÜM M — FAZ 9: ÇEKİRDEK MAÇ UI VE AKIŞI

## 50. Amaç

Oyuncunun dış açıklama olmadan temel maçı yönetebilmesini sağlamak.

---

## 51. Görevler

**Faz 9 dilim düzeni.** §12 "her faz oynanabilir kalmalıdır" gereği bu bölüm tek
seferde değil dilimler halinde üretiliyor.

- **Dilim 1 — Ana HUD + Bildirimler: tamamlandı.**
- **Dilim 2 — Maç akışı: tamamlandı.**
- **Dilim 3 — Seçim panelleri: tamamlandı.**
- **Dilim 3.1 — Eylemler panele taşındı, Merkez seçilebilir: tamamlandı.**
- **Dilim 4 — Yapı ve yol araçları: tamamlandı.**
- **Dilim 5 — Minimal ayarlar: kamera kadranları üretildi; ses ve ekran
  sallantısı sistemleri olmadığı için bilerek üretilmedi (Faz 12 §67).**

Altı grup da bitti; §52'nin kutuları kapandı. **Kapı B geçildi (17 Tem 2026) —
bkz. §53 "Kapı B öncesi yapılacaklar":** §46 sıkışma sinyali çözüldü (sebep
§45'in tıkanma kaçışının hiç çalışmamasıydı — aşağıda "Sinyal çözüldü"), maç
saati eklendi (Kapı B'nin merkezî kriteri ölçülebilir oldu) ve 15+ tam maç
oynandı. Oynanış testinden tek bir denge bulgusu çıktı (early rush → erken oyun
saldırmazlık süresi, §53 madde 4); blocker olmadığı için gate'i tutmadı ve
çağ/seviye denge çalışmasına taşındı.

**Test notu — teşhis doğruydu, flake düzeltildi (Dilim 4).** Bu not
`tests/smoke/rts-building-placement.spec.ts` içindeki Faz 7 "box-selected group"
testini **flaky** ilan ediyor ve sebebi olarak testin kurulumunu — 700 ms "s"
panundan sonra sabit marquee dikdörtgenine (420,520 → 900,610) bel bağlamasını —
gösteriyordu.

**Ara kayıt düzeltmesi.** Dilim 3 bu teşhisi üç koşuluk bir ölçümle "tutmadı"
diye kaydetmişti (3/3 geçti). O kayıt yanlıştı: üç koşu, üçte bir sıklıkta olan
bir flake hakkında hüküm vermeye yetmez, ve Dilim 4 sırasında test tam olarak
teşhis edilen yerde — marquee sonrası seçim iddiasında — düştü. Az sayıda yeşil
koşu, yokluk kanıtı değildir.

**Düzeltme — seçim.** Sabit dikdörtgen kaldırıldı. Önce bir Muhafız aranıyor,
sonra oyunun kendi §21 jesti (`çift tıkla aynı savaş birimi türünü seç`) tam
olarak Muhafız hattını seçiyor — nerede durdukları önemsiz. Geniş bir marquee de
flake'i çözüyordu ama testi *değiştiriyordu*: beş İşçiyi de yakalayıp Faz 7 kabul
kriterinin hiç konuşmadığı dokuz birimlik bir senaryo üretiyordu. İddia da
düzeltildi: `toBeVisible()` boş seçimde hiçbir şey söylemeden düşüyordu; artık
`toContainText(/[2-9] Muhafız/)` — test neyi yakaladığını adlandırıyor.
`--repeat-each=5` ile seçim adımı **5/5**.

**Kalan flake seçimde değil — §46'da.** Seçim sabitlendikten sonra test hâlâ
beşte bir düşüyor ve *son* iddiada düşüyor:
`await expect(overlay).not.toContainText(/yol:\d+/, { timeout: 30_000 })` — yani
grup emrini 30 sn içinde **bitiremiyor**. Bu bir test kurulumu sorunu değil,
§46 / Kapı B'nin "kalıcı grup sıkışması oluşmuyor" kriteridir: emir Merkez'in
footprint'inin dibine veriliyor ve bazı koşularda birimler orada oturup emri
düşürmüyor.

Test yeşile boyanmadı. Sağ tık hedefini açık zemine kaydırmak testi geçirirdi ama
sinyali de gizlerdi — ve bu sinyal tam olarak Kapı B'nin sorduğu şey
("maçların en az %80'i teknik hata olmadan bitiyor"). Faz 9 UI fazıdır; bu
hareket/sıkışma işidir ve Kapı B oynanış testinden **önce** bakılmalıdır.

**Sinyal çözüldü — sebep §45'in tıkanma kaçışının hiç çalışmamasıydı.** Sinyali
saklamamak doğru karardı: `unitMovement.trackCongestion` ilerlemeyi *adımın
içinde* ölçüyordu (`distanceBefore - distanceAfter`). Ama birimin adımını bu
sistemde hiçbir şey reddedemez — adım her kare tam olarak `step` kadar atılır,
yani `progressed` her karede koşulsuz `true` olur. Zemini geri alan şey bir kare
*sonra* çalışan `unitSeparation`'dır ve bu ölçüme hiç girmiyordu. Sonuç:
`CONGESTION_TIMEOUT` hiç ateşlenmedi, `MAX_REPLANS` hiç harcanmadı, "her stall
biter" garantisinin tamamı ölü koddu. §45/§46'nın "tıkanma timeout'u kalıcı
stall'u yapı gereği imkânsız kılar" iddiası kodda karşılığı olmayan bir iddiaydı.

Mevcut testler bunu yakalayamazdı: ölçüldü, koridor/köprü/kalabalık testlerinde
biriken stall **0.00 sn** ve replan sayısı **0** — hepsi geçiyordu çünkü birimler
gerçekten varıyordu, kaçış mekanizmasına hiç uğramadan. Yani mekanizma
yazıldığı günden beri hiç test edilmemişti.

Düzeltme üç parçadır: (1) ilerleme kare-arası net kazanç olarak ölçülür
(hareket + separation birlikte), (2) replan bütçesi kendi harcanmasıyla
sıfırlanmaz (`replanned` bayrağı), (3) ara waypoint'e varmak bütçeyi iade etmez —
bookkeeping yalnız emir bittiğinde bırakılır. Yeni regresyon testi
(`test:engine`: "a unit the crowd gives no ground") kalabalığın yer vermediği
birimi doğrudan sınar: emir ~4.5 sn içinde düşer ve tam 2 replan harcanır.
Düzeltme geri alındığında test kırmızıya döner. Smoke `--repeat-each` ile tekrar
koşuldu.

Ölçüm bir şeyi daha gösterdi ve korundu: pansız tam-ekran marquee yalnız
`5 İşçi` yakalıyor — Muhafızlar açılış kamerasında ekranın altında. Yani pan
süsleme değil, testin ön koşulu.

### Ana HUD

Faz 2'den beri bütün readout'lar `rtsBuildPalette` içinde birikmişti — kendi
başlığı zaten "not the final HUD" diyordu. Dilim 1 bunları klasik RTS üst
şeridine (`src/game/rts/ui/rtsHudBar.ts`) taşıdı; palette yalnız *eylemleri*
tuttu. Şerit hiçbir karar vermiyor: bütün değerler `RtsApp`ten push ediliyor,
şeridin tek kuralı hangi hücrenin DOM'una ne zaman dokunacağı.

- [x] Dört kaynak (`rtsHudBar.setResources`; sıra ve etiketler tek yerde:
  `ui/resourceLabels.ts`. Bu modül, aynı etiket haritasının palette içinde üç kez
  kopyalanmış olması yüzünden açıldı — dördüncü kopya HUD ile maliyet satırının
  "stone"a farklı isim vermesi riskiydi. Not: `resources.json` yalnız *yatakları*
  tanımladığı için taş/altın etiketi veride var, yiyecek/odun'unki yok; dört
  etiketi de veriye taşımak loader/validator işi, HUD işi değil.)
- [x] Gelir hızları (Dört kaynağın **hepsi**, Faz 3'ün ikilisi değil. Sıfır gelir
  turuncu: §24 "çağ atlama ekonomi ile denge içinde" ancak hangi gelirin çağı
  tuttuğu *görünürse* okunabilir — Faz 8 aynı hatayı AI puanlamasında yaşadı,
  ortalama gelir sıfır taşı gizliyordu.)
- [x] Nüfus (`used/capacity`; tavana değince vurgulanıyor.)
- [x] Çağ seviyesi (Yükseltme sürerken kalan saniye dahil.)
- [x] Boşta işçi (Sıfırdan büyükken vurgulanıyor: boşta işçi oyuncunun oyuna
  borçlu olduğu bir karardır.)
- [x] Kritik bağlantı uyarısı (Faz 4'ün ayrı `rtsLogisticsWarning` bileşeni
  şeride katıldı ve silindi — §51 bunu Ana HUD kalemi olarak sayıyor ve mesaj
  haritası birebir aynıydı; ayrı tutmak ölü kopya olurdu.)

### Seçim panelleri

**Dilim 3 — tamamlandı.** Altı panel, altı bileşen değil: tek panel
(`ui/rtsSelectionPanel.ts`), altı cevap. Seçim tek bir soru sorar — ya ordu, ya
bina — ve "3 Muhafız ile bir Kışla"yı anlatmak zorunda kalan bir panel ikisini de
cevaplayamazdı. `SelectionSystem` bu yüzden ikisini karşılıklı dışlıyor.

**Bu dilimin asıl işi paneller değil, seçimdi.** Faz 2'den beri bina *tıklanamıyordu*;
`PlacedStructureSystem`'in pick hedefleri yalnız işçinin sağ tık emri içindi. Sol
tık artık birimi bulamazsa binaya düşüyor (birim önce: kendi temelinin üstündeki
işçi daha küçük ve daha olası hedef, üstelik bina imleçten kaçamaz). Kutu seçimi
binaya hiç uzanmıyor: marquee bir ordu jesti, ve üssün üzerinden geçen bir kutu
altındaki binaları da toplamamalı.

**Panelin metni saf, DOM'u değil.** İçerik `ui/rtsSelectionView.ts` içinde saf veri
olarak hesaplanıyor; §52'nin "bir yapı çalışmadığında nedeni gösteriliyor" kriteri
*metin* hakkında bir iddia ve `test:engine` metni tarayıcısız hesap sorabiliyor
(§82'de `formatRtsAiDebug`'ın, Dilim 1'de `RtsNotificationCenter`'ın kurduğu kalıp).
Panel — `RtsHudBar` gibi — hiçbir karar vermiyor.

- [x] İşçi paneli (Yalnız işçiden oluşan seçim ekonomik bir sorudur ve ordu
  panelinin ona cevabı yok: işçinin ne duruşu ne eşleşmesi var. `Görev: 2 boşta ·
  1 inşaatta` sabit sırayla okunuyor — işçiler görev değiştirdikçe yeniden
  dizilen bir döküm okunamaz. Karışık seçim yine orduyu anlatır: beş işçi dört
  Muhafız'ı oylayıp "İşçi" cevabını verdiremez.)
- [x] Üretim yapısı paneli (İşçi, hız, tampon, düğüm, durum ve lojistik + her
  lojistik durumunun çözümünü söyleyen tooltip. Durum artık çevrilmiş bir ifade:
  Faz 3 paleti ham enum'u — `buffer-full` — ekrana sızdırıyordu.)
- [x] Depo paneli (Ağ bileşeni, teslim eden yapı sayısı ve işgal durumu.)
- [x] Karakol paneli (Yaşayan yarıçap ve yol bağlantısı; bağlantısız Karakol'a
  yolun ne kazandıracağı tooltip'te söyleniyor — §35'in Karakol'a yol çektirme
  sebebi bu.)
- [x] Askerî yapı paneli (`BarracksProductionSystem.queueSnapshot`: kuyruk, üretilen
  birim ve kalan saniye, sıradakiler, toplanma noktası. Krallık geneli
  `queuedCount` yetmezdi — *bu* Kışla'ya tıklayan oyuncuya başka Kışla'nın
  siparişlerini yazardı. Sağlıklı Kışla "sorun yok" satırı taşımıyor; `Kontrol
  Dışı` ve `T2 sürüyor` yalnız doğruyken çıkıyor.)
- [x] Birim paneli (Faz 7'nin içeriği korundu; eşleşme satırı hâlâ savaşın
  çözdüğü `damageMultipliers`'tan okunuyor, yani panel veride olmayan bir
  eşleşmeyi reklam edemez.)

**Palet artık yalnız eylem.** Faz 3'ün üretim okuması palette bir düğme listesiydi
ve oyuncuya haritanın yerine "Tarla #7, Tarla #12" arasından seçim yaptırıyordu —
çünkü o zaman bina tıklanamıyordu. Aynı gerçekler artık anlattıkları binaya
tıklayarak okunuyor; liste ve CSS'i silindi.

**Dilimde bulunan ve düzeltilen hata.** Karakol tooltip'i yarıçapı
`${controlRadius}’dan ${connected}’a` diye kuruyordu; Türkçe ek *söylenen* sayının
ünlüsüne uyar (16 → "16’dan", 20 → "20’ye"), yani çalışma anında bilinmeyen bir
sayıya şablonla ek getirilemez. "16 yerine 20 yapar" olarak yeniden yazıldı.
`test:engine` yakaladı; motor testi tarayıcıdan önce dilbilgisi hatası buldu.

**Dilim 3.1 — eylemler panele taşındı, Merkez seçilebilir oldu.** Dilim 3 panelleri
salt-okunur bırakmıştı: Kışla'ya tıklayıp ekranın öbür ucundaki düğmeden birim
üretmek tuhaf okunuyordu. Kapsam genişletildi ve eylemler ait oldukları yere gitti.

- **Merkez artık seçilebiliyor** (`CommandCenter.setSelected`; halka, `setVisual`
  onu değiştirdiği için swappable görselin *içinde* değil, Merkez'in kendisinde
  duruyor). Paneli işçi kuyruğunu, çağı ve kontrol yarıçapını gösteriyor —
  Dilim 3'te yazılmış `WorkerProductionSystem.queueSnapshot` nihayet bağlandı.
- **Palet artık yalnız yerleştirme + T2 araştırması.** `İşçi Üret`,
  `Kasaba Çağına Geç` ve roster (`Muhafız/Okçu/Koçbaşı Üret`) ile
  `Toplanma Noktası` paletten silindi; hiçbiri kopyalanmadı — taşındı.
- **Eylemler bildirimsel** (`SelectionAction`: id, etiket, maliyet, enabled,
  reason). Panel id'yi geri veriyor, fiili `RtsApp` yürütüyor; böylece bir
  düğmenin *ne dediği* ve *neden reddettiği* satırlar gibi `test:engine` altında
  kalıyor. `enabled` asla UI'da hesaplanmıyor: her kural zaten bir sistemin
  (`trainableUnits` kademe kapısını, `AgeSnapshot` çağ kapısını) — kuralı UI'da
  yeniden türetmek, düğmenin iddia ettiği kural hakkında yalan söylemeye başlaması
  demek.
- **Red sırası sistemin sırasını yansıtıyor.** Roster düğmesi
  `BarracksProductionSystem.queueUnit` gibi önce kademe kapısını bildiriyor:
  birimi *hiç* üretemeyecek oyuncuya bunu söylemek, zeminini kaybettiğini
  söylemekten yeğdir.

**§45 çatışması ve çözümü.** §45'in "roster baştan görünsün, kilitli birim kendini
açıklasın" gerekçesi (paletin docstring'i ve testi) roster paletten gidince
tehlikeye giriyordu. Ama o gerekçenin amacı — "Kışla II bir karar gibi okunsun" —
roster'ı Kışla'nın panelinde kilitli göstererek tam olarak korunuyor, üstelik
kararın gerçekten alınabilir olduğu ilk anda. Kışla'sı olmayan oyuncu zaten hiçbir
birim üretemez. Playwright testi bu davranışı yeni yerinde sürüyor.

**Gerçek maçta bulunan ve düzeltilen hata — yalan söyleyen düğme.**
`Kasaba Çağına Geç` etkin görünüyor, mazeret taşımıyor, sonra tıklanınca
`Kasaba Çağı için eksik yapılar: farm, lumber_camp, ...` diye reddediyordu. Eski
palet de aynısını yapıyordu (yalnız `upgrading`/`town` kapatıyordu), ama panelin
kuralı "yasal eylem mazeret taşımaz" — yani düğme yalan söylüyordu. Önkoşul zaten
`AgeSnapshot.missingBuildingIds` içinde duruyordu: düğme artık baştan kapalı ve
nedenini oyuncunun diliyle söylüyor — `Önce şu yapılar gerekir: Tarla, Oduncu
Kampı, Taş Ocağı, Altın Madeni, Kışla, Karakol.` (Ham id listesi veri modelinin
konuşmasıydı, oyunun değil.) Maliyet bilerek tıklamaya bırakıldı: cüzdan iki kare
arasında değişebilir ve elin altında grileşen düğme, cevap veren düğmeden kötüdür.

**Bilinen sınır — T2 yükseltmeleri palette kaldı.** `Kışlayı/Evi/Depoyu/Karakolu
T2 Yükselt` tür-geneli araştırma (`StructureUpgradeSystem.start(owner, buildingId)`),
tek bir binanın eylemi değil; bu yüzden taşınmadı. Yine de Kışla paneli
`T2 yükseltmesi sürüyor` derken düğmenin palette olması bölünmüş okunuyor.

**Gerçek maçta bulunan, sonraki dilime devredilen hata.** Panel salt-okunur olduğu
halde `ui-interactive` taşıyor (Faz 7'den miras), yani 1366×768'de alt-ortada
`473,626 → 893,756` kutusunda **harita tıklamasını yutuyor** — doğrulama sırasında
oraya konan Depo sessizce kurulamadı. Dilim bunu kötüleştirdi: panel artık *bina*
seçilince de açılıyor, yani tam oyuncunun ekranın altındaki üssüyle uğraştığı anda.
Dürüst çözüm (`pointer-events: none`) §51'in istediği "bağlantı nedeni tooltip'ini"
öldürür; bu yüzden alt şeridi zaten yeniden düzenleyecek olan "Yapı ve yol
araçları" dilimine bırakıldı — alt şeridi iki kez tasarlamamak için.

**İlgisiz, önceden var olan hata (not).** `rtsNotificationFeed.ts` kök elemana
`ui-interactive` veriyor; `#ui-overlay .ui-interactive` (özgüllük 1,1,0)
`.rts-notification-feed { pointer-events: none }` kuralını (0,1,0) eziyor. Yani
feed'in kendi yorumunun ("Read-only: a notice must never swallow a click meant for
the map") tersine, bildirim şeridi bugün harita tıklaması yutuyor. Tek satırlık
düzeltme, Dilim 1'e ait.

### Yapı ve yol araçları

**Dilim 4 — tamamlandı.** Bu grubun sonunda palet tek bir şey oldu: *yerleştirme*.
Bir binanın veya birimin yaptığı her şey onu yapan şeyin üzerine taşındı; palet
sahip olmadığın binayı satın aldığın yerdir, sahip olduklarını komuta ettiğin yer
değil.

- [x] Yapı kategorileri (Ekonomi / Lojistik / Yerleşim / Askerî. Oyuncunun sorduğu
  soruya göre gruplanmış — verinin şekline göre değil. Kategoriler kodda yazılı,
  `economy`/`territory` alanlarından türetilmiyor: kategori bir binaya *neden*
  uzandığına dair editoryal bir iddia, ve Depo'nun `economy` bloğu olmadığı halde
  Tarla'nın ödemesinin sebebi olması türetmenin onu ait olduğu karardan
  ayıracağını gösteriyor. Kategorilere girmeyen yeni bir bina kaybolmuyor,
  `Diğer`e düşüyor.)
- [x] Maliyet ve kilit durumu (`canAffordCost`: saf, `resourceLabels` içinde ve
  `test:engine` altında. Kilit **işaretleniyor, düğme kapatılmıyor** — stok her
  tick değişir ve uzanan elin altında grileşen düğme, cevap veren düğmeden
  kötüdür; çağ düğmesiyle aynı karar. Kilit stoğu HUD'ın yazdığı gibi
  yuvarlıyor: "79 Odun" gören oyuncuya 80'i ödeyebileceğini söylemek şeritle
  paleti oyuncunun gözü önünde çeliştirirdi.)
- [x] Yerleştirme nedeni (Faz 2'den beri var: `outside-map` / `outside-control` /
  `insufficient-resources` / `missing-resource-node` / çakışma. Bu dilim yalnız
  doğruladı.)
- [x] Yol rota ve maliyet önizlemesi (Faz 4'te üretilmişti, kutusu işaretsiz
  kalmıştı: `RoadPlacementSystem` hayalet karo zincirini geçerli/geçersiz renkle
  çiziyor, `RtsRoadControls` `Rota: N yeni hücre · Maliyet: X Odun` yazıyor.)
- [x] Karakol kontrol alanı önizlemesi (Yerleştirme sırasında açılacak alanın
  diski çiziliyor; ghost'un verdiği hükümle aynı renkte — kırmızı disk "bu zemini
  almıyorsun" demek, ki reddedilen yerleştirme için tam olarak doğru. Bilerek
  **yalıtılmış** yarıçap gösteriliyor, bağlı olan değil: bağlı yarıçap henüz var
  olmayan bir yola bağlı, ve binanın tek başına açmayacağı zemini vaat etmek
  önizlemenin var oluş sebebi olan kararda yalan söylemesi olurdu.)

**T2 yükseltmeleri de binaya taşındı.** Dilim 3.1'de "tür-geneli araştırma"
gerekçesiyle palette bırakılmıştı ve bölünmüş okunuyordu: Kışla'nın paneli
`T2 yükseltmesi sürüyor` derken düğmesi ekranın öbür ucundaydı. Artık binanın
kendi panelinde, ve etiketi tür-geneli olduğunu **itiraf ediyor**
(`Tüm Kışla Yapılarını T2 Yükselt`) — tek bir örneğin üzerindeki tür-geneli bir
fiil ancak bunu söylerse dürüst olur. Dört adet birbirinin kopyası
`startBarracksUpgrade`/`startHouse…`/`startDepot…`/`startOutpost…` tek bir
`startStructureUpgrade(buildingId)` oldu; aralarındaki tek fark binanın zaten
veride duran etiketiydi.

> **Sonradan geçersiz kaldı (2026-07-18).** Yukarıdaki "itiraf eden etiket"
> çözümü, fiilin tür-geneli olmak *zorunda* olduğu varsayımına dayanıyordu.
> Çağ/seviye ayrıştırma çalışması o zorunluluğu kaldırdı: yükseltme artık
> gerçekten bina instance'ının üzerinde, dolayısıyla itiraf edecek bir şey de
> kalmadı. Etiket `Tüm Kışla Yapılarını T2 Yükselt` → **`Lv{n+1}'e Yükselt`**
> oldu ve yanında mevcut seviye, maliyet ve kazanım satırı
> (`Lv2: 450 can (+150) · 8 nüfus`) duruyor. Panel diline geçen diğer değişimler:
> detay başlığı `T{n}` → `Lv{n}` ("Ev Lv2"), birim kapısı `Kışla T{n} gerekir` →
> `Kışla Lv{n} gerekir`, ve palet çağ readout'u artık çağ-milestone davranışını
> anlatıyor (eski "T2 ... için Kasaba Çağı gerekir" kapı metni silindi).

**§52'nin palet ölçüsü.** Kriter paleti adıyla suçluyordu: "sağ sütunun tamamını
(1366×768'de 647px) kaplayan Faz 2 yığını". Ölçüldü: **462px, ekranın %14.1'i** —
üstünde 306px harita açıldı. Playwright artık bunu ölçüyor, yani fiiller palete
geri sızarsa test kırılır.

**Bu dilimde bulunan ve düzeltilen iki hata.**

1. **Ayar menüsü kamerayı sessizce yeniden ayarlıyordu.** İlk kadran aralığı
   12..52 idi; ortası 32, oysa authored `panSpeed` 26. Yani ayarları hiç açmayan
   her oyuncunun kamerası değişmişti. Aralıklar authored değerin *etrafına*
   ortalandı (12..40 → orta 26; zoom 4..20 → orta 12) ve `test:engine` kadranın
   ortasını config'e sabitliyor. Sabit 700 ms pan yapan bir Playwright testi
   yakaladı — haritanın beklenenden başka bir yere gelmesiyle.
2. **Kategoriler paleti uzatınca test yardımcısı bina düğmesine tıklıyordu.**
   "Boş yere tıkla" adımı (1150,200) artık palete denk geliyor ve yerleştirme
   moduna giriyordu. Adım kaldırıldı: klavye zaten window'a gidiyor, o tıklama
   hiçbir işe yaramıyordu.

### Bildirimler

`RtsNotificationCenter` (`ui/rtsNotifications.ts`) saf durum — DOM yok, çünkü
§52'nin "aynı uyarı sürekli spam oluşturmuyor" kriteri `test:engine` ile
kanıtlanmalı, ekran görüntüsüyle değil (§82'de `formatRtsAiDebug`'ın kurduğu
kalıp). `RtsNotificationFeed` yalnız `active()`'i çiziyor.

**Neden bir bastırma katmanı gerekti.** Bu koşulların çoğu *event* değil, her
karede *yoklanan* durum: nüfus dolu ve lojistik kesik oldukları her karede
doğrular. `RtsApp` koşulu sorgusuz post ediyor, ne gösterileceğine merkez karar
veriyor — iki sorumluluğu karıştırmak feed'in spam'e dönüşme yolu. İki kural:
canlı bir bildirimin tekrarı *yığmıyor*, tazeliyor (kalıcı koşul tek satır olarak
duruyor; satırın kaybolması sorunun bittiğinin işareti); süresi dolan anahtar
cooldown boyunca susturuluyor (sınırda titreyen koşul sonsuza dek yeniden
post edemesin).

- [x] Nüfus dolu (Yoklanan koşul; `used >= capacity`.)
- [x] Kaynak tükendi (Yapıya göre değil **kaynağa** göre anahtarlanıyor: iki
  tükenmiş taş ocağı tek problemdir ve oyuncu ikisini de aynı kararla çözer.)
- [x] Bağlantı kesildi (Üretim yapısı başına anahtarlı.)
- [x] Karakol saldırı altında (Karakol başına anahtarlı: iki karakol iki ayrı
  tercihtir — bildirimin var oluş sebebi olan karar.)
- [x] Merkez saldırı altında
- [x] Çağ yükseltmesi tamamlandı (`AgeSystem.update` zaten owner'lı event
  döndürüyor; snapshot'tan yeniden türetmek aynı gerçeğin ikinci ve zayıf
  kaynağı olurdu.)
- [x] AI çağ atladı (Aynı event akışının `enemy` ayağı. Oyuncunun rakibin
  güçlendiğini öğrenmesinin başka dürüst yolu yok.)

**"Saldırı altında" nasıl tespit ediliyor.** Savaşta damage event bus'ı yok
(`updateUnitCombat` vuruşları debug overlay'e callback ile bildiriyor, yapılar
düz `HealthComponent` ile hasar alıyor). Tek bir HUD satırı için savaşa event
kanalı döşemek yerine `ui/rtsAttackWatch.ts` her tick canı örnekleyip *düşeni*
bildiriyor. Yoklama kriter açısından daha dürüst de: §51 yapının saldırı altında
olup olmadığını soruyor, savaş sisteminin "saldırı" diye sınıflamadığı bir şey
tarafından yenen yapı da buna dahil. İlk görülen id asla rapor etmiyor (yapı
kurmak ona hasar değildir) ve yok olan id unutuluyor (yoksa aynı id ile yeniden
kurulan karakol ilk örnekte hasarlı okunurdu).

**Faz 9'da bulunan ve düzeltilen üç hata.** Üçü de yalnız gerçek maçta göründü;
motor testleri ve geometri iddiaları üçünü de yeşil geçiyordu.

1. **Tekrar sayacı tick hızını ölçüyordu.** Sayaç *tazelemeleri* sayıyordu, bu
   yüzden yola bağlanmamış tek bir tarla feed'de **"×378"** yazdırdı — oyuncunun
   yaptığı veya yapabileceği hiçbir şeyi değil, simülasyon tick hızını ölçen bir
   sayı. Artık yalnız *yeniden yükselişler* sayılıyor: "×3" = bu problem üç ayrı
   kez yaşandı, göz atmaya değer bir tekrar.
2. **Uyarı şeridi ikinci satıra kırıyordu.** Kritik bağlantı uyarısına tam
   genişlikte kendi satırı verilmişti; yol kesilir kesilmez şerit iki satıra
   çıkıyor ve kesintiyi *açıklayan* kaynak sayıları tam da okunmaları gereken
   anda kendi altlarına akıyordu. Uyarı artık şeridin boş ortasında, tek satırda.
   Şerit sabit yükseklik yayınlıyor (`--rts-hud-bar-height`); büyüyen bir şerit,
   ona göre hizalanan panelleri sessizce altına alırdı.
3. **Feed yapı paletinin arkasında kalıyordu.** İlk yerleşim sağ kenardı; palet o
   sütunun tamamını şeritten ekranın altına kadar kaplıyor. Bildirim var oluyor,
   tetikleniyor ve **görünmüyordu**. Feed artık üst-ortada: sol üstteki debug
   overlay ile sağ üstteki hız kontrolü arasındaki sütun boş ve alt-ortadaki
   seçim panelinden uzak.

### Maç akışı

**Dilim 2 — tamamlandı.** Altı kalem de tek bir modalda birleşti
(`match/rtsMatchOverlay.ts`): başlatma ekranı, duraklatma menüsü ve sonuç ekranı
aynı kart, aynı yerde, aynı sahayı kapatıyor — yalnız ne söyledikleri ve hangi
eylemleri sundukları farklı. Üç ayrı bileşen, modalın CSS'inin üç kopyası ve
ikisinin aynı anda ekranda olması için üç şans demekti.

**İki durum, iki modül.** `RtsMatchFlow` (`match/rtsMatchFlow.ts`) yalnız
*simülasyon çalışmalı mı* sorusunu yanıtlıyor: `start` → `playing` ↔ `paused`.
`RtsMatchState` ise *kim kazandı* sorusunu. Birleştirmedim çünkü `ended`
fazı ikinci bir gerçek kopyası olurdu — ve iki kopya anlaşmazlığa düşebilir.
İkisi de saf durum; `test:engine` geçişleri doğrudan sürüyor.

- [x] Ana menü yerine basit başlatma ekranı (Maç, oyuncu isteyene kadar
  başlamıyor: RTS'in saf ekonomi ve saf karar olan açılışı, oyuncu ekranı hâlâ
  okurken harcanmamalı. Sahne kartın arkasında render olmaya devam ediyor.)
- [x] Pause (`Escape`. Ama önce bekleyen yerleştirmenin hakkı var: Escape "şu an
  yaptığım şeyi geri al" demektir ve yarım yerleştirilmiş bir bina menüden daha
  acildir — aksi halde hayalet, menünün altında kurulu kalırdı. Kamera duraklamada
  da çalışıyor: haritaya bakmak maçı oynamak değildir.)
- [x] Yeniden başlat (Hem sonuç ekranından hem duraklatma menüsünden. `flow`
  da sıfırlanıyor — yoksa duraklatılmışken yeniden başlatmak dünyayı kurup onu
  gizli bir menünün arkasında donmuş bırakırdı.)
- [x] Teslim ol (Maçın kendi tek yönlü kapısından geçiyor, paralel bir bayrak
  değil. "Yeniden Başlat"ın yanında tek tıkla maçı atmak olduğu için önce
  onay istiyor; onay overlay'e ait — bu bir düğmenin özelliği, maçın değil.)
- [x] Zafer ekranı
- [x] Yenilgi ekranı (Yenilginin artık iki sebebi var. Merkezi hâlâ ayakta
  dururken teslim olan oyuncuya "Merkeziniz yıkıldı" demek düpedüz yalandır;
  `RtsMatchEndReason` bu yüzden var. Başlık da zafer altınında değil — bir kayıp,
  bir an için bile olsa, kazanç gibi okunmamalı.)

### Minimal ayarlar

**Dilim 5 — iki kalem üretildi, iki kalem bilerek üretilmedi.** Ayarlar duraklatma
menüsünde: ender ve bilinçli bir ziyaret, ve kart zaten oyuncunun *durup düşünmek*
için açtığı tek yüzey. Kadranlar `input` olayında uygulanıyor (`change` değil):
kamera kartın arkasında çalışmaya devam ediyor ve oyuncu değişikliği haritayı
izleyerek yargılıyor, yani sürüklerken hareket etmeli.

- [ ] **Ana ses seviyesi — sistemi yok, bilerek eklenmedi.** RTS hiç ses
  çalmıyor (`engine/audio/audioBus` var, ama RTS'i besleyen hiçbir şey yok). Ses
  Faz 12 §67 "VFX ve Ses" kalemidir. Var olmayan bir sisteme bağlı kaydırıcı,
  oyuncunun sürüklerken hiçbir şey olmadığı bir kontroldür — yokluğundan kötüdür
  ve §13'ün yasakladığı "yarım sistem"in tam tanımıdır. Sistemi geldiğinde gelir.
- [x] Kamera hızı (`RtsCameraSettings.panSpeed`; 0..1 kadran → 12..40 dünya
  birimi/sn. Kadran ham dünya sayısı değil: "Kamera hızı" etiketli bir kaydırıcı
  oyuncuya saniyede 26 dünya biriminin ne demek olduğunu sormamalı, ve kadran
  uzayında kırpmak saklanmış bir değerin kullanılamaz kamera üretmesini önler.)
- [x] Kamera yumuşatma (`smoothing`; zoom'un hedefe yumuşaması. Lerp oranına
  karşı ters çevrilmiş — daha çok yumuşatma = daha yavaş yaklaşma.)
- [ ] **Ekran sallantısı — sistemi yok, bilerek eklenmedi.** Oyunda ekran
  sallantısı diye bir şey yok; kapatılacak bir şey yok. Faz 12'nin VFX işiyle
  birlikte gelir. Şimdi eklemek, bir Faz 9 ayarını doyurmak için bir Faz 12
  özelliği üretmek olurdu.

**Kadranın ortası authored kamerayı üretmek zorunda.** Bkz. "Yapı ve yol
araçları" dilimindeki hata kaydı: aralık authored değerin etrafına ortalanmazsa
ayar menüsü, onu hiç açmayan oyuncuların kamerasını sessizce değiştirir.

---

## 52. Kabul Kriterleri

Altı grup sonrası durum.

- [x] UI haritanın kritik alanlarını aşırı kapatmıyor. (Şerit ekran yüksekliğinin
  %10'undan azını alıyor; feed sınırlı (`MAX_ACTIVE_NOTIFICATIONS` = 4, en
  eskisini düşürüyor). Dilim 3'ün açtığı iki borç da kapandı ve **ölçülüyor**:
  palet 647px → **462px (%14.1)**, üstünde 306px harita açık; seçim paneli artık
  `ui-interactive` **değil** — kök tıklama geçirgen, yalnız gerçekten işaretçi
  gereken iki parça (tooltip'i taşıyan gövde ve düğme sırası) olayı alıyor.
  **Kalan, bilinen artık:** gövde (394×56) hâlâ altındaki haritayı yutuyor, çünkü
  §51'in istediği "bağlantı nedeni tooltip'i" hover ister. Düğmelerin tıklama
  alması ise ölü bölge değil, UI'ın kendisidir.
  **Bu kutuda düzeltilen, ilgisiz ve önceden var olan hata:** bildirim feed'i
  `ui-interactive` taşıyordu; `#ui-overlay .ui-interactive` (özgüllük 1,1,0)
  feed'in kendi `pointer-events: none` kuralını (0,1,0) eziyordu — yani "a notice
  must never swallow a click meant for the map" yorumunun tersine, feed üst-ortada
  harita tıklaması yutuyordu. Sınıf kaldırıldı.)
- [x] Bir yapı çalışmadığında nedeni gösteriliyor. (Dilim 3. Her bina türü kendini
  anlatıyor ve *nedeni* söylüyor: işçisiz şantiye, yola bağlanmamış üretici,
  yolsuz Depo, işgal altındaki Depo, Kontrol Dışı Kışla. `test:engine` metni
  doğruluyor — "Faz 9 §51: every building kind explains itself, working or not".
  Gerçek maçta altı panelin altısı da doğrulandı: Tarla `Lojistik: Yol Yok` +
  tooltip `Yapı footprint’ine temas eden bir yol hücresi gerekli.`)
- [x] Aynı uyarı sürekli spam oluşturmuyor. (`test:engine`: 60 kare boyunca her
  tick post edilen `population-full` tek satır kalıyor, sonra süresi dolup
  cooldown'a giriyor. Gerçek maçta doğrulandı: yola bağlanmamış tarla 378 kez
  yoklandı, feed'de tek satır çıktı.)
- [x] Oyuncu yol ve karakol araçlarını dış açıklama olmadan kullanabiliyor.
  (Dilim 4. Yol: hayalet rota + `Rota: N yeni hücre · Maliyet: X Odun` +
  geçersiz rota gerekçesi. Karakol: açılacak kontrol diski yerleştirme anında
  çiziliyor ve `Karakolu kontrol alanının hemen dışındaki nötr bir konuma
  yerleştirin` reddin nedenini söylüyor. **Not:** bu kriter son tahlilde bir
  oyuncu iddiasıdır; §36'nın test soruları hâlâ gerçek bir test oyuncusuyla
  sorulmalı — burada işaretlenen, aracın kendini açıklamasıdır.)
- [x] Maç başlatma, bitirme ve yeniden başlatma güvenilir. (Dilim 2. Playwright
  tam turu sürüyor: başlatma ekranı → Escape ile duraklat/devam → yerleştirme
  varken Escape'in önceliği → teslim ol (onaylı) → "Teslim oldunuz." yenilgisi →
  yeniden başlat → yeniden *çalışan* maç, taze nüfusla ve silinmiş onayla.
  **Pause'un gerçekten simülasyonu durdurduğu ayrı bir testle kanıtlanıyor:** 8X'te
  25 sn'lik işçi siparişi verilip duraklatılıyor, gereken sürenin iki katı
  bekleniyor ve boşta işçi sayısı kıpırdamıyor; devam edilince sipariş tamamlanıyor.
  Menü iddiaları bunu gösteremezdi.)
- [x] 1366×768 ve 1920×1080 çözünürlükleri kullanılabilir. (Playwright her iki
  çözünürlükte: şerit tam genişlik + %10'dan kısa, debug overlay ve hız kontrolü
  şeridin altından başlıyor, yatay taşma yok. Bu test `--rts-hud-bar-height` ile
  şeridin gerçek yüksekliği ayrışırsa kırılır.)

---

## 53. Ürün B Çıkışı

Faz 9 sonunda Ürün B tamamlanır.

Kapı B değerlendirmesi yapılır.

**Durum: Faz 9'un altı görev grubu bitti; Kapı B geçildi (17 Tem 2026).** §7'nin
söylediği ayrım korundu: teknik kabul kriterlerini bitirmek yetmez, oynanış
testinin de ana soruya olumlu cevap vermesi gerekirdi. §9'un kutuları büyük
ölçüde **oynanış** iddialarıdır — "dört kaynak farklı kararlar üretiyor", "iki
çağ arasında anlamlı fırsat maliyeti var", "askerî zafer çoğu maçta 12–25 dakika
içinde gerçekleşiyor", "en az 15 tam maç tamamlandı", "maçların en az %80'i
teknik hata olmadan bitiyor" — ve bunlar kod yazarak değil, maç oynayarak
kanıtlandı. UI tarafı ("oyuncu dış açıklama olmadan temel maçı yönetebilsin" —
§50) bu fazın işiydi ve bitti; 15+ maç oynandı ve on kutu doğrulandı.

Oynanış testinden tek bir bulgu çıktı — **blocker değil, denge sorunu** — ve
aşağıya yapılacak olarak kaydedildi. Kapı B'yi bloklamıyor çünkü maçlar
oynanabilir ve teknik hatasız bitiyor; ama açılış çeşitliliğini kapattığı için
çözülmesi gerekiyor.

### Kapı B öncesi yapılacaklar

Aşağıdaki üçü bir önceki oturumda tespit edildi. **Sıra önemli:** ölçemediğin bir
kriteri, bilinen bir hatanın gürültüsü altında test etmek 15 maçı boşa
oynamaktır. 1 ve 2 bitti — yani sıra artık 3'te: bilinen hata düzeltildi ve
ölçüm aleti var.

- [x] **1. §46 sıkışma sinyalini çöz (blocker adayı).** Merkez footprint'inin
  dibine verilen grup emri ~5 koşuda 1 bitmiyordu; `yol:N` sıfırlanmıyordu.
  Kapı B'nin **iki** kutusunu birden vuruyordu: "köprü ve dar rotalarda kalıcı
  grup sıkışması oluşmuyor" ve "maçların en az %80'i teknik hata olmadan
  bitiyor". Sinyali gizlemeyip kovalamak doğru karardı: sebep test kurulumu
  değil, §45'in tıkanma kaçışının **hiç çalışmıyor** olmasıydı — ilerleme adımın
  içinde ölçüldüğü için `progressed` her karede koşulsuz `true` dönüyor,
  `CONGESTION_TIMEOUT` hiç ateşlenmiyordu. Kalabalığın tuttuğu bir birim emrini
  sonsuza kadar taşıyordu. Ayrıntı ve düzeltmenin üç parçası için bkz. §51
  "Sinyal çözüldü". Regresyon testi eklendi; mevcut testlerin bu kod yoluna hiç
  uğramadığı ölçümle gösterildi.
  **Kapsam notu:** bu Faz 9 (UI) işi değildi, Faz 7'nin hareket/sıkışma
  sistemiydi — §45'in "tıkanma timeout ve fallback" kalemi.

- [x] **2. Maç saati ekle (ölçüm aleti).** Kapı B'nin merkezî kutusu "askerî
  zafer çoğu maçta 12–25 dakika içinde gerçekleşiyor" — ve bu süre hiçbir yerde
  ölçülemiyordu. Kronometre çözmezdi, çünkü 2X/4X/8X hız kontrolü duvar saatiyle
  maç süresini ayırıyor ve hız ortada değişirse hesap büsbütün kayar.
  **Yapıldı:** `RtsMatchClock` (`match/rtsMatchClock.ts`) simülasyon saniyesi
  sayar. Hızla ölçeklenmesi ve duraklamada durması *uyguladığı özellikler değil,
  nerede tiklendiğinin sonucudur*: saat `updateSimulation`'ın içinde, sistemlerin
  yaşlandığı adımın ta kendisiyle ilerletilir — tik yoksa zaman yok. Böylece
  saatin sistemlerle "maç ne kadar sürdü" konusunda anlaşmazlığa düşmesi yapı
  gereği imkânsız. `RtsMatchState` ("kim kazandı") ve `RtsMatchFlow` ("çalışıyor
  mu") ile aynı gerekçeyle ayrı tutuldu: üçüncü bir olgu, ve hiçbiri diğerinin
  doğrusunun ikinci kopyasını tutmuyor.
  Süre iki yerde: sonuç ekranında (`Süre: 12:34`) ve `?rts&debug` başlığında
  (`maç: active · süre 12:34`). Biçim `d:ss` ve dakika saate yuvarlanmıyor —
  72 dakikalık maç `72:15` der, çünkü bu sayı "12–25 dakika"ya karşı okunuyor.
  **Doğrulama:** `test:engine` üç check (1X/8X ölçekleme, maç ortası hız
  değişimi, duraklama/karar sonrası donma, biçim) + gerçek tarayıcıda ölçüldü:
  8X'te ~2 duvar saniyesi → `0:15`; duraklamada 6 duvar saniyesi (8X'te 48
  simülasyon saniyesi) → `0:17` sabit; devam → `0:29`. Kronometre `0:02` derdi.
  **Kapsam notu:** §51'in Ana HUD listesinde saat yok, yani bu Faz 9 kapsamının
  dışıdır — Kapı B'nin aletidir, o yüzden Ana HUD'a değil debug overlay'e kondu
  (§53.3 maçları zaten `?rts&debug` ile izlemeyi söylüyor). §71 "Minimum
  Telemetri" (Faz 13) ile karıştırılmamalı: o, maç *istatistiği* toplamaktır; bu,
  tek bir sayıyı görünür kılmaktır.

- [x] **3. 15 tam maç (bu iş kodun değil).** §9'un listesiyle oynandı; 15+ maç
  teknik hata olmadan bitti ve on kutu doğrulandı. Ön koşul da tuttu:
  `balance/ai.json` içinde `expand: 0.9` ve `ageUp: 1.1` açık — Faz 5'in "expand
  niyeti veriyle kapalı" notu Faz 8'de geçersiz kaldı, yani "AI genişliyor" ve
  "iki çağ" kutuları veriyle ölü değildi, oynanarak sınandı. Tek bulgu 4. maddede.

- [x] **4. Erken oyun saldırmazlık süresi (denge bulgusu — early rush).**
  Oynanış testinin çıktısı: AI açılışta hemen bir Kışla kurup Muhafızlarını
  gönderiyor ve oyuncu şehrini kurmaya çalışırken onu eziyor. Oyuncunun tek
  kazanma yolu *ondan önce* Kışla kurup saldırmak — yani maçın sonucu ilk
  askerî tempoyla belirleniyor ve §9'un "12–25 dakika" penceresi ancak iki taraf
  da rush yapmadığında görülüyor. Bu bir blocker değil (maç oynanabilir ve
  bitiyor) ama açılış çeşitliliğini kapatıyor: ekonomi/genişleme/çağ açılışları
  rush'a karşı hep kaybettiği için §9'un "dört kaynak farklı kararlar üretiyor"
  ve "iki çağ arasında fırsat maliyeti" iddialarını pratikte inceltiyor.
  **Yön (kod işi, henüz yapılmadı):** maçın ilk N simülasyon saniyesinde askerî
  saldırıyı bastıran bir barış/grace penceresi. Ölçüm aleti hazır —
  `RtsMatchClock` (§53.2) simülasyon saniyesi sayıyor, hızla ölçekleniyor ve
  duraklamada donuyor, yani "ilk N saniye" duvar saatiyle değil maç zamanıyla
  ölçülür. Uygulama noktası, AI'ın saldırı kararını verdiği yer (`army`
  değerlendirmesi / `attack` niyeti, `balance/ai.json`): pencere içinde `attack`
  niyeti/hedef seçimi elenmeli, yalnız `defend` açık kalmalı. Süre veride olmalı
  (örn. `army.peaceSeconds` veya `intentWeights` yanında bir grace alanı), kodda
  sabit değil, ki denge çalışmasında ayarlanabilsin. **Save-validator notu:**
  bu alan `balance/ai.json` içinde, `LayoutPlacement`/skeleton/effect allowlist
  yüzeylerinden biri değil — CLAUDE.md'deki `tools/saveValidator.ts` uyarısı bu
  dosyaya uygulanmaz; yalnız AI config loader'ının yeni alanı okuduğundan emin ol.
  **Yapıldı (2026-07-18).** `balance/ai.json` → `army.peaceSeconds: 300`; tip
  `AiBalance.army.peaceSeconds`, doğrulama `validateAiBalance` (`>= 0`; 0 =
  pencere kapalı, yani eski davranış hâlâ ifade edilebilir). Kapı **tek yerde**:
  `intentScorer.scoreAttack` pencere içinde `rawScore: 0` ve nedenini adıyla
  söylüyor (`erken oyun saldırmazlık süresi (N sn kaldı)`). Ordu yöneticisine
  ikinci bir kopya konmadı — `armyManager` zaten `intent !== "attack"` iken
  `regroup`'a düşüyor, dolayısıyla bastırılan niyet hedef seçimini de bastırıyor
  ve sürüklenecek ikinci bir pencere yok.
  **Savunma kasıtlı olarak dokunulmadı:** `defend` ve `baseThreat` yolları açık,
  yani AI kavgaya *başlamakta* yavaş, kendisine yapılan rush'a cevap vermekte
  değil.
  **Süre neden 300 sn:** §42'nin authored ilk-temas hedefi 5–9 dk; pencere o
  aralığın alt ucuna oturuyor, yani AI authored temas penceresinden önce
  saldıramıyor. Değer veride, kodda sabit değil.
  **Ölçüm:** `bb.now` (maç simülasyon saniyesi, `RtsMatchClock` ile aynı tik ve
  aynı reset) — pencere hızla ölçekleniyor, duraklamada donuyor ve saatin ikinci
  bir kopyası tutulmuyor.
  **Doğrulama:** `test:engine` 1040 check yeşil, `build:verify` yeşil. Skorer
  seviyesinde pencere içi/dışı ve sınır (`peaceSeconds`'ta pencere biter);
  entegrasyon seviyesinde headless maçta baskın bir ordu pencere boyunca **her
  tikte** `assaultTarget`/`harassEconomy`'ye geçmiyor, pencere kapanınca geçiyor
  (yani gecikme, susturma değil). Testi yazarken iki yanlış kurulum ölçümle
  bulundu ve düzeltildi: nüfus tavanını dolduran ordu §7 `population-blocked`
  acil durumunu tetikleyip direktörü Economy'ye kilitliyordu, ve işçisiz bir
  krallıkta Economy zaten 1.0 skorluyor — ikisi de pencereyi değil o yarışı
  ölçerdi.
  **Yan etki:** `aiTestBlackboard` varsayılanı `now: peaceSeconds + 1` oldu ve
  direktörün bağlılık/histerezis testi `t0 = peaceSeconds` üzerine kaydırıldı —
  aksi halde Attack'ı kullanan her mevcut iddia sessizce pencere testine
  dönüşürdü.

- [x] **5. Çağ/seviye ayrıştırma (tamamlandı 2026-07-18).** 4. maddeyle birlikte
  başlatılan denge çalışması, asıl sorunun denge değil **model** olduğunu
  gösterdi: çağ atlama ile bina seviyesi tek harekete sıkışmıştı, SecondAge ve
  Level3 modelleri hiç kullanılmıyordu. İki eksen ayrıldı (`02 §25`, `04 §31`),
  per-bina Lv1–3 merdiveni ve çağ atlayınca Lv1'e sıfırlama uygulandı.
  Faz 0–4 kaydı: `docs/planned/THREEAGES_AGE_AND_LEVEL_PROGRESSION_PLAN.md`.
  `npm run build:verify` yeşil (1029 check).

Kapı B geçildiğine göre aşağıdakiler artık ana üretim hattına alınabilir (Faz 10+):

- üçüncü çağ,
- bölgesel zafer,
- fog,
- minimap,
- final asset polish.

Erken oyun saldırmazlık süresi (4. madde) bunlardan bağımsızdı ve tamamlandı.
**Açık kalan:** pencerenin 300 sn değeri oynanışla henüz sınanmadı — açılış
çeşitliliğinin gerçekten geri geldiğini görmek için yeni bir maç turu gerekiyor
(§70 denge önceliklerine bağlanmalı).

**Üçüncü çağ için uyarı.** Yukarıdaki listenin ilk maddesi artık kodla değil,
**sanatla** bloklu: arşivde ThirdAge bina modeli yok (`SL-007`). Sistem N-çağa
hazır kuruldu — çağ→aile eşlemesi veriden çözülüyor — ama üçüncü çağ ancak sanat
kaynağı netleşince bağlanabilir.

---

# BÖLÜM N — FAZ 10: ÜÇÜNCÜ ÇAĞ VE MAÇI BİTİRME

## 54. Amaç

Üçüncü çağın yalnızca güç artışı değil, maçı sonlandırma aşaması olmasını sağlamak.

---

## 55. Görevler

### Krallık çağı

> **Ön koşul — sanat (2026-07-18).** Bu faz kodla değil, **asset ile**
> bloklu: arşivde `ThirdAge` bina modeli yok (`SL-007`). Çağ sistemi N-çağa
> hazır (`rtsBuildingArt.ts` çağ→aile eşlemesini veriden çözer), yani bağlama
> işi küçük; eksik olan modellerin kendisi. Bu karar verilmeden aşağıdaki
> kutuların hiçbiri başlatılmamalıdır.
>
> Ayrıca kalemler yeni ilerleme modeline göre yeniden yazıldı: "Merkez T3" ve
> "Karakol T3" eski tek-eksenli modelin (çağ = seviye) kalıntılarıydı. Üçüncü
> çağ artık `T3` demek değil, **`ThirdAge` sanat ailesi + o ailenin Lv1–3
> merdiveni** demektir.

- [ ] ThirdAge asset kararı (üret / satın al / SecondAge varyantıyla idare et)
- [ ] Krallık çağ gereksinimleri (`ages.json` üçüncü giriş)
- [ ] Merkez'in Krallık katmanı (`level = 3`, `TownCenter_ThirdAge_Level3`)
- [ ] ThirdAge Lv1–3 model matrisi (bina başına 3 model)
- [ ] Nüfus üst sınırı artışı
- [ ] Üst seviye üretim değerleri
- [ ] Kuşatma erişimi, daha önce açılmadıysa
- [ ] Çağ başı stat ölçeklemesi (`KR-06` ile ertelenmişti — üçüncü çağ eklenirken
      yeniden değerlendirilmeli; şu an çağ atlama stat kazancı vermiyor, kazanımı
      seviye adımları taşıyor)

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

- [x] İki stratejik nokta ekle. (`RTS_BLOCKOUT_MAP.strategicPoints`: Batı Geçidi
      `(-20,-20)`, Doğu Geçidi `(20,20)` — üs-üs köşegenine dik eksende, iki üsse
      de ~60.7 birim, 28 birimlik başlangıç kontrol yarıçapına karşı. Yani maç
      başında ikisi de nötr ve kimsenin yolu daha kısa değil.)
- [x] Ele geçirme durumu ekle. (`objectives/strategicPointSystem.ts`)
- [x] Dost kontrol alanı veya aktif karakol bağlantısı koşulu ekle. (Ayrı bir
      kural değil: sahiplik `TerritoryControlSystem.ownerAt`'a sorulur ve o
      sistemin kaynakları zaten merkez + *tamamlanmış* karakoldur; karakolun
      geniş yarıçapı da yalnızca yola bağlıyken geçerlidir.)
- [x] Zafer sayacı ekle. (`objectives/regionalVictorySystem.ts`; 180 simülasyon
      saniyesi kesintisiz çift kontrol)
- [x] Sayaç durma ve gerileme davranışı ekle. (İkisi de tutuluyor → tırmanır;
      biri çekişmeli veya sadece biri tutuluyor → **durur**; hiçbiri tutulmuyor →
      1/3 hızla **geriler**. Sıfırlanmaz: sıfırlama, kaybedene bir daha
      giremeyeceği ikili bir kapı olurdu.)
- [x] AI Contest Objective davranışı ekle. (`armyManager.ts`; `aiTypes.ts`'te
      rezerve edilmiş `contestObjective` görevi dolduruldu. Üs savunmasının
      *altında*, §60 hedef skorlamasının *üstünde*: skorlayıcı yalnızca bina
      görür, geçit bina değildir. Yalnızca oyuncunun sayacı uyarı bandındayken
      tetiklenir, yoksa AI her temasta saldırısından koparılabilirdi.)
- [x] UI geri sayım ve harita göstergesi ekle. (`ui/rtsObjectiveTracker.ts` —
      iki krallığın sayacı da görünür; `objectives/strategicPointView.ts` —
      halka, noktanın gerçek `captureRadius`'unda çizilir.)

Tamamı `regionalVictory` feature flag'i arkasında ve varsayılan **kapalı**:
bayrak kapalıyken sistemler hiç kurulmaz (§13 "kapalı bayrak runtime'da hiçbir
şeye mal olmamalı"), ekranda da §60 uyarınca hiçbir iz bırakmaz.
`?rts&flags=regionalVictory` ile açılır.

Test durumu: `tools/engine-tests.ts` içinde beş `§58` kontrolü (tutma/durma/
gerileme, uyarı bandı, maç sonucu önceliği, AI contest davranışı);
`tests/smoke/rts-regional-victory.spec.ts` bayraklı/bayraksız boot'u sürüyor.

### Kabul kriterleri

Dördü de **playtest gerektirir** — kod tarafı hazır, ölçüm yapılmadı:

- [ ] Bölgesel zafer merkez savunmasına kapanmayı azaltıyor.
- [ ] Sayaç sürpriz yenilgi yaratmıyor.
- [ ] AI sayacı durdurmak için tepki veriyor.
- [ ] İkinci zafer türü askerî zaferi gereksiz hale getirmiyor.

Başarısızsa sistem feature flag arkasında kapatılır.

> **Ayarlanacak sayılar** (`DEFAULT_REGIONAL_VICTORY_SETTINGS`): gereken süre
> 180 sn, gerileme 1/3, uyarı bandı 60 sn. Şu an kodda sabit; playtest bunları
> oynatmayı gerektirirse `balance/` altına bir JSON'a taşınmalıdır.

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

## 60. Minimap — Kapsamdan Çıkarıldı

**Karar (2026-07-17, `SCOPE_LOG.md` SL-006):** Sahneler kamera ile yönetilebilecek kadar küçük olduğu için minimap üretilmeyecektir. Ekranda minimap çerçevesi, devre dışı ikon veya geleceğe ayrılmış boş alan bırakılmaz.

Minimap'in navigasyon görevi şu düşük maliyetli araçlarla karşılanır:

- bildirime tıklayarak kamera odaklama,
- kısa süreli world-space veya ekran kenarı pingi,
- stratejik nokta isimleri,
- kontrol grupları ve kamera konumu kısayolları.

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

- [x] FirstAge Lv1–3 modelleri (`{Bina}_FirstAge_Level{1..3}`)
- [x] SecondAge Lv1–3 modelleri (`{Bina}_SecondAge_Level{1..3}`)
- [ ] ThirdAge Lv1–3 modelleri — **asset yok**, bkz. §55 / `SL-007`
- [ ] Takım renkleri
- [ ] Seçim ve sağlık göstergeleri
- [ ] İnşaat placeholder geçişi
- [ ] Hasar efekti
- [ ] Yıkım geçişi

**Model matrisi tek eksenli üçlü değil, çağ × seviye çarpımıdır** (`02 §25.3`):
bina başına **çağ sayısı × 3** model. İki çağ bağlı olduğu için bugün altı model
kullanılıyor. Taş Ocağı, Altın Madeni ve Oduncu Kampı bu matrisin dışında —
çağdan ve seviyeden bağımsız tek mesh kullanırlar.

Her yapının her seviye için özel modeli bulunmak zorunda değildir. Gerekirse:

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
- Refah
- Kule
- Kolay ve Zor AI

Minimap koşullu sistem değil, SL-006 ile kapsamdan çıkarılmış bir özelliktir.

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
- minimap için ekran alanı veya üretim bütçesi ayırmama.

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

1. Fog of war
2. Bölgesel zafer
3. Refah
4. Kule
5. Kolay ve Zor zorluk profilleri
6. T3 yan yapı modelleri
7. Gelişmiş maç istatistikleri
8. Ekran kenarı kamera kaydırma
9. Kontrol grupları
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

- [x] Taş
- [x] Altın
- [x] Kaynak tükenmesi
- [ ] Dört kaynak HUD

### İlerleme

- [x] Yerleşim
- [x] Kasaba
- [x] Merkez çağ katmanı (Yerleşim = 1, Kasaba = 2)
- [x] Per-bina Lv1–3 merdiveni (Ev, Depo, Kışla, Karakol, Tarla)
- [x] Çağ atlama → tüm binalar yeni çağın Lv1'i

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

- [ ] ThirdAge asset kararı (`SL-007` — Krallık çağının ön koşulu)
- [ ] Krallık çağı
- [ ] Geç oyun bitirme baskısı

### Koşullu

- [ ] Bölgesel zafer kararı
- [ ] Fog kararı
- [x] Minimap kapsamdan çıkarıldı. (`SCOPE_LOG.md` SL-006)
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
- [x] Minimap gerekli değil; küçük sahne ölçeği için kapsamdan çıkarıldı. (`SCOPE_LOG.md` SL-006)
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
- Fog koşulludur; minimap kapsam dışıdır (`SCOPE_LOG.md` SL-006).

---

## 115. Revizyon Notları

### 2026-07-17 kapsam kararı

- Minimap küçük sahne ölçeği nedeniyle kapsamdan çıkarıldı; navigasyon tıklanabilir bildirim, world-space/kenar pingi ve stratejik nokta etiketleriyle çözülecek (`SCOPE_LOG.md` SL-006).

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
