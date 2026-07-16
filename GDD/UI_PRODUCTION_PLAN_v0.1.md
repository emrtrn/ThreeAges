# ThreeAges RTS UI Üretim Planı v0.1

> **Çalışma adı:** Üç Çağ: Sınır Krallıkları  
> **Belge türü:** Uygulama odaklı UI üretim planı  
> **Sürüm:** 0.1  
> **Durum:** Uygulamaya hazır taslak  
> **Görsel referans:** [`UI_Reference.png`](./UI_Reference.png)  
> **Yetkili kapsam belgesi:** [`13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md`](./13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md)  
> **Bağlı tasarım belgeleri:** [`10_CAMERA_CONTROLS_AND_UI.md`](./10_CAMERA_CONTROLS_AND_UI.md), [`11_ART_ASSETS_AND_PRESENTATION.md`](./11_ART_ASSETS_AND_PRESENTATION.md), [`03_ECONOMY_AND_RESOURCES.md`](./03_ECONOMY_AND_RESOURCES.md), [`05_TERRITORY_LOGISTICS_AND_ROADS.md`](./05_TERRITORY_LOGISTICS_AND_ROADS.md), [`06_UNITS_AND_COMBAT.md`](./06_UNITS_AND_COMBAT.md)

---

## 1. Amaç

Bu plan, `UI_Reference.png` görselindeki güçlü klasik PC RTS kimliğini ThreeAges'ın mevcut sistemlerine uyarlayan, ölçülebilir ve dilimler halinde uygulanabilir bir üretim sırası tanımlar.

Planın hedefi:

- oyuncunun ekonomi, nüfus, çağ, seçim, üretim ve lojistik durumunu dış açıklama olmadan okuyabilmesi,
- savaş alanının büyük sabit panellerle gereksiz yere kapatılmaması,
- yalnız geçerli bağlama ait eylemlerin gösterilmesi,
- görsel referanstaki premium feodal kimliğin korunması,
- mevcut Faz 9 UI işlerinin küçük ve doğrulanabilir dilimler halinde tamamlanmasıdır.

Bu belge yeni oyun sistemi tanımlamaz. Çelişki halinde kapsam için `13_VERTICAL_SLICE_PRODUCTION_PLAN_v0.2.md`, davranış için ilgili sistem GDD'si esas alınır.

---

## 2. Kapsam

### 2.1 Bu planın kapsamı

- Masaüstü tarayıcı için 16:9 RTS HUD
- Krallık kimliği ve kaynak üst şeridi
- Bağlamsal seçim ve eylem panelleri
- İşçi inşa paleti
- Üretim yapısı ve üretim kuyruğu
- Birim ve çoklu seçim özeti
- Depo, karakol ve lojistik durumları
- Yapı/yol yerleştirme geri bildirimi
- Kritik bildirimler
- Maç başlatma, pause, zafer ve yenilgi yüzeyleri
- UI ölçekleme, erişilebilirlik ve browser smoke doğrulaması
- World-space overlay ve küçük harita navigasyonu

### 2.2 Bu planın doğrudan kapsamı dışında kalanlar

- Mobil ve gamepad arayüzü
- Tam tutorial sistemi
- Ayrıntılı kalıcı olay geçmişi
- Gelişmiş formasyon editörü
- Tam kısayol yeniden atama
- Save/load ekranları
- Fog of war görünümü
- Minimap
- Image 2 çıktısının doğrudan oyun asseti olarak kullanılması

**Kapsam kararı (2026-07-17):** ThreeAges sahneleri küçük ve ana stratejik alanlar aynı kamera akışı içinde erişilebilir olacağı için minimap üretilmeyecektir. Minimap için boş çerçeve, devre dışı ikon veya gelecekte kullanılmak üzere ayrılmış ekran alanı bırakılmayacaktır. Fog of war ayrı bir kapsam kararı olarak kalır.

---

## 3. Mevcut Durum Özeti

| Yüzey | Mevcut durum | Üretim ihtiyacı |
|---|---|---|
| Üst HUD | Dört kaynak, gelir, nüfus, çağ, boşta işçi ve lojistik uyarısı mevcut | Görsel kimlik, ikonlar, tooltip ve dar ekran davranışı |
| Bildirimler | Tekrar bastırma ve temel feed mevcut | İkon, önem hiyerarşisi, konuma gitme davranışı ve görsel polish |
| Birlik seçimi | Ordu rolü, can, stance ve karşıtlık özeti mevcut | Tek birim/çoklu seçim ayrımı, portre/ikon ve komut kartı |
| İnşa paleti | Yapılar, eğitim, yükseltme ve üretim detayları aynı panelde birikmiş | Sorumluluklara ayırma ve bağlamsal görünürlük |
| Üretim yapıları | Üretici seçme ve lojistik metni mevcut | Seçili yapı paneline taşıma ve gerçek kuyruk sunumu |
| Yol aracı | Ayrı sol-alt kontrol paneli mevcut | Ortak bağlamsal çalışma alanına bağlama |
| Maç akışı | Bazı çekirdek durumlar mevcut | Başlatma, pause, teslim, zafer ve yenilgi UI'ı |
| Minimap | Kapsam dışı | Küçük sahnelerde ekran alanı ve üretim maliyeti faydasını aşar |

Ana teknik borç, `RtsBuildPalette` yüzeyinin aynı anda inşa, eğitim, yükseltme, üretici seçimi ve durum açıklaması taşımasıdır. Üretim planının merkezinde bu sorumlulukların bağlama göre ayrılması bulunur.

---

## 4. Referanstan Alınacak ve Değiştirilecek Kararlar

### 4.1 Korunacak yönler

- Üstte kesintisiz stratejik bilgi şeridi
- Arma, krallık adı ve takım rengiyle güçlü oyuncu kimliği
- Stok ile gelir hızının yan yana gösterilmesi
- Çağ ve nüfusun sürekli görünür olması
- Alt bölgede seçime bağlı bilgi ve emirler
- Kritik hedeflerin dünya üzerinde isimlendirilmesi
- Takım renkli seçim halkaları ve kontrol alanları
- Koyu panel, açık metin, antik altın vurgu ve kontrollü feodal dekor
- İkon ile metnin birlikte kullanılması

### 4.2 Değiştirilecek yönler

- İnşa paleti, seçili asker paneli ve üretim kuyruğu aynı anda açık olmayacak.
- Sağ kenarda görev, olay günlüğü ve üretim kuyruğu sürekli üst üste tutulmayacak.
- Kalıcı olay günlüğü V1'de bulunmayacak; kritik bildirim feed'i korunacak.
- Standart hareket ve saldırı komutları, büyük alan işgal eden kalıcı düğmeler olmak zorunda olmayacak.
- Teknik lojistik çizgileri normal görünümde sürekli açık kalmayacak.
- Aşırı süslü ve kalın çerçeveler harita alanını daraltmayacak.
- Kaynak şeridinde yiyecek mutlaka bulunacak.
- Durum ayrımı yalnız renkle yapılmayacak; ikon, desen ve metin de kullanılacak.

---

## 5. Hedef Bilgi Mimarisi

Arayüz üç bilgi sınıfına ayrılır:

1. **Sürekli:** krallık, kaynak, nüfus, çağ, süre ve oyun hızı.
2. **Bağlamsal:** seçili birim/yapı, komutlar, inşa, üretim ve lojistik ayrıntısı.
3. **Geçici/kritik:** saldırı, bağlantı kesintisi, nüfus doluluğu, çağ ve maç sonucu bildirimleri.

### 5.1 Hedef masaüstü yerleşim

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Krallık │ Yiyecek │ Odun │ Taş │ Altın │ Nüfus │ Çağ │ Süre │ Hız / Menü │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                        O Y U N   H A R İ T A S I                           │
│                                                                            │
│  [koşullu dünya göstergeleri]                  [kritik bildirimler / görev] │
│                                                                            │
│                                                                            │
│  [sol-alt harita görünür kalır]                                             │
│                    ┌─────────────────────────────────────────┬─────────────┐ │
│                    │ Seçim özeti + bağlamsal eylem alanı     │ Hızlı komut│ │
└────────────────────┴─────────────────────────────────────────┴─────────────┴─┘
```

Alt alan tek bir **bağlamsal çalışma alanıdır**. İçeriği seçime ve aktif input context'e göre değişir; birbirinden bağımsız üç büyük panel gibi davranmaz.

### 5.2 Ekran alanı bütçesi

1366×768 ve 1920×1080 için hedefler:

- Üst şerit ekran yüksekliğinin `%10`undan kısa olmalı.
- Açık alt çalışma alanı ekran yüksekliğinin en fazla `%28`ini kullanmalı.
- Açık sağ yardımcı yüzey ekran genişliğinin en fazla `%24`ünü kullanmalı.
- Sağ yardımcı yüzey ekranın tam yüksekliğini kaplamamalı.
- Ekranın merkezindeki en az `%40 genişlik × %45 yükseklik` alan sabit UI tarafından kapatılmamalı.
- Panel açılıp kapanırken harita raycast alanı ve kamera kontrolleri yanlışlıkla tetiklenmemeli.
- Hiçbir metin, buton veya panel yatay taşma üretmemeli.

---

## 6. Bileşen Gereksinimleri

### 6.1 Üst HUD şeridi

Soldan sağa önerilen sıra:

1. Krallık arması, kısa krallık adı ve takım rengi
2. Yiyecek
3. Odun
4. Taş
5. Altın
6. Nüfus
7. Boşta işçi
8. Çağ / yükseltme geri sayımı
9. Maç süresi
10. Oyun hızı, pause ve menü

Kaynak hücresi:

- okunabilir kaynak ikonu,
- mevcut stok,
- doğru adlandırılmış dakika hızı,
- kritik/boşta durum rengi,
- ayrıntılı tooltip

içermelidir.

#### Gelir semantiği kararı

Üst şeritteki `+X/dk` değeri, oyuncunun krallık cüzdanına ulaşan **net teslim hızını** göstermelidir. Mevcut hesap bunun yerine brüt üretimi gösteriyorsa değer `Üretim/dk` diye açıkça etiketlenmeli veya veri sözleşmesi net teslim hızına dönüştürülmelidir.

Kaynak tooltip'i, veri mevcut olduğu ölçüde şunları ayırmalıdır:

- mevcut krallık stoku,
- brüt üretim,
- net teslim,
- yerel tamponlarda bekleyen miktar,
- engel varsa bağlantı/kontrol/depo nedeni.

UI hiçbir zaman yerel tamponda biriken kaynağı krallık kasasına ulaşmış gibi göstermemelidir.

### 6.2 Bağlamsal alt çalışma alanı

Panel aşağıdaki durumlardan yalnızca birini birincil içerik olarak gösterir:

| Durum | Birincil içerik | İkincil eylemler |
|---|---|---|
| Seçim yok | Kısa kontrol ipuçları veya kapalı panel | İnşa menüsünü aç |
| İşçi seçili | İşçi özeti, görev ve durum | İnşa kategorileri, dur, yeniden görevlendir |
| Tek asker seçili | Portre/ikon, can, rol, stance | Saldırı-hareket, dur, pozisyonu koru |
| Çoklu asker seçili | Tür başına adet ve grup canı | Ortak komutlar ve tür filtresi |
| Üretim yapısı seçili | Can, seviye, çalışanlar, yerel stok, bağlantı | Üretim kuyruğu, işçi atama, yükseltme |
| Askerî yapı seçili | Can, seviye, rally point | Birim eğitimi, kuyruk, yükseltme |
| Depo seçili | Kapasite, yol ağı ve işgal durumu | İşçi atama, yükseltme |
| Karakol seçili | Can, kontrol alanı ve bağlantı | Yükseltme, savunma durumu |
| Yapı yerleştirme | Yapı kartı, maliyet, gereksinim | Döndür, yerleştir, iptal |
| Yol yerleştirme | Rota, toplam maliyet ve geçerlilik | Nokta ekle, tamamla, iptal |

### 6.3 İnşa paleti

- Yalnız işçi seçiliyken veya oyuncu açıkça inşa modunu çağırdığında görünür.
- Kategoriler: `Ekonomi`, `Lojistik`, `Askerî`, `Savunma`.
- Her kart: ikon, ad, maliyet, çağ gereksinimi ve kısayol içerir.
- Kilitli yapı gizlenmez; nedeni tooltip ve disabled durumda açıklanır.
- Yetersiz kaynak, kontrol dışı, çakışma ve kaynak düğümü eksikliği birbirinden ayrılır.
- Sağ tık aktif yerleştirmeyi iptal eder.
- Panel, üretim binası seçme veya global yapı listesi görevlerini taşımaz.

### 6.4 Seçili birim paneli

- Rol ve karşıtlık metni doğrudan balance verisinden türetilmeye devam eder.
- Can ve can oranı birlikte gösterilir.
- Stance durumu hem metin hem ikonla gösterilir.
- Komut düğmelerinde kısayol harfi görünür.
- Hareket ve bağlamsal saldırı için sağ tık ana yöntem olarak kalır.
- Büyük portre zorunlu değildir; üretim V1'inde tutarlı rol ikonları yeterlidir.

### 6.5 Seçili yapı ve üretim kuyruğu

- Üretim kuyruğu global sağ panelde sürekli görünmez.
- Kuyruk yalnız ilgili üretim veya askerî yapı seçildiğinde açılır.
- Her kuyruk öğesi ikon, ad, kalan süre ve iptal eylemi içerir.
- Nüfus veya kaynak engeli doğrudan kuyruk öğesinde açıklanır.
- Üretim binasında `Yerel tampon`, `Teslim durumu` ve kesin lojistik nedeni aynı bilgi grubunda bulunur.
- Aynı bilginin üst şerit, bildirim feed'i ve yapı panelinde üç tam metin olarak tekrarından kaçınılır.

### 6.6 Bildirimler ve görev alanı

- Bildirim önemleri: `bilgi`, `önemli`, `kritik`.
- Aynı anahtara sahip aktif durum yeni satır yığmaz.
- Kritik bildirim, varsa ilgili dünya konumuna ve kısa süreli world-space pingine bağlanabilir.
- Normal durumda en fazla dört aktif bildirim görünür.
- Kalıcı lojistik durumu üst şeritte kompakt ikon/metin olarak kalabilir; feed aynı durumun yalnız yükselişini bildirir.
- Görev paneli ancak görev verisi gerçekten mevcutsa gösterilir.
- V1'de sürekli açık olay günlüğü bulunmaz.

### 6.7 World-space UI ve overlay'ler

Normal görünüm temiz kalır.

- Seçim halkası: seçili nesnelerde
- Can çubuğu: seçili, hasarlı veya savaşan nesnelerde
- Hareket yolu: emir verildiğinde kısa süreli
- Kontrol alanı: yapı yerleştirme, karakol seçimi veya lojistik görünümünde
- Yol ağı: lojistik görünümünde
- Ana/yedek rota: seçili üretim yapısı için lojistik görünümünde
- Stratejik nokta adı: uygun zoom seviyesinde
- Uzak göstergeler: zoom/mesafe eşiklerine göre sadeleşir veya gizlenir

### 6.8 Minimap Olmadan Navigasyon

Minimap kullanılmayacaktır. Oyuncunun haritadaki önemli olaya ulaşması şu araçlarla sağlanır:

- kritik bildirime tıklayarak kamerayı olay konumuna götürme,
- kısa süreli world-space yön/ping göstergesi,
- stratejik nokta ve köprülerin dünyada okunabilir isimleri,
- kontrol grupları ve kamera konumu kısayolları,
- saldırı geldiğinde ekran kenarı yön göstergesi,
- küçük sahneye uygun kamera zoom ve hareket sınırları.

Sol-alt alan başka bir kalıcı panelle doldurulmaz. Seçim olmadığında ve bağlamsal çalışma alanı kapalıyken mümkün olan en geniş harita görünümü korunur.

---

## 7. Görsel Dil

### 7.1 Tema

Hedef stil: **premium, okunabilir, kontrollü feodal RTS**.

- Koyu kömür/siyah yarı saydam panel yüzeyleri
- Antik altın ince kenarlık ve odak vurguları
- Oyuncu takım rengi olarak kraliyet mavisi
- Kritik durumda sıcak turuncu/kırmızı
- Ana metinde kırık beyaz
- İkincil metinde soluk adaçayı/gri
- Çok hafif taş veya ahşap dokusu
- Köşe ve çerçevede sınırlı hanedan süslemesi

Referanstaki ağır altın çerçeveler inceltilir. Dekor, bilgi alanı veya tıklama hedefiyle yarışmamalıdır.

### 7.2 Tipografi

- Panel başlıklarında kontrollü tarihî serif kullanılabilir.
- Sayılar, açıklamalar ve butonlarda yüksek okunabilirlikli sade font kullanılmalıdır.
- Sayısal hücrelerde tabular rakam kullanılmalıdır.
- Ana oynanış metni 1366×768 çözünürlükte `12px` altına düşmemelidir.
- Kritik sayı ve stok değerleri ikincil metinden belirgin büyük olmalıdır.
- Türkçe karakterler bütün UI fontlarında doğrulanmalıdır.

### 7.3 İkon dili

- Basit siluet
- Ortak kamera ve ışık yönü
- Küçük boyutta ayırt edilebilir dış hat
- Aynı kategori içinde ortak çerçeve
- Durumu yalnız renk değil, biçimle de anlatma

Zorunlu ilk ikon seti:

- dört kaynak ve nüfus,
- boşta işçi ve çağ,
- birim rolleri,
- bina kategorileri,
- hareket/saldırı/dur/pozisyonu koru,
- bağlantısız/kontrol dışı/yerel stok dolu/işçi yok,
- saldırı altında ve nüfus dolu,
- pause, hız ve ayarlar.

Image 2 ile üretilen tam ekran görsel bir kompozisyon ve stil referansıdır. Panel, ikon veya yazılar doğrudan ekran görüntüsünden kesilip üretim asseti yapılmamalıdır.

---

## 8. Teknik UI İlkeleri

### 8.1 Sunum ve oyun kuralı ayrımı

- UI, maliyet, karşıtlık, kilit veya lojistik sonucu hesaplamaz.
- UI yalnız `RtsApp` veya ilgili domain sisteminden gelen snapshot/state'i sunar.
- Gösterilen yapı ve birim isimleri ortak label verisinden gelir.
- DOM güncellemeleri mevcut diff/signature yaklaşımını korur.
- Her kare bütün oyun nesnelerini tarayan yeni UI kodu eklenmez.

### 8.2 Önerilen UI state modeli

Tek seferde büyük bir state-store yeniden yazımı yapılmaz. Önce mevcut push tabanlı verileri bir sunum snapshot'ında birleştiren ince bir adaptör eklenir.

```ts
type RtsUiContext =
  | { kind: "none" }
  | { kind: "worker"; unitIds: readonly number[] }
  | { kind: "army"; unitIds: readonly number[] }
  | { kind: "economy-building"; structureId: number }
  | { kind: "military-building"; structureId: number }
  | { kind: "depot"; structureId: number }
  | { kind: "outpost"; structureId: number }
  | { kind: "building-placement"; buildingId: string }
  | { kind: "road-placement" };
```

Bağlamsal panel görünürlüğünün tek otoritesi bu context olmalıdır. Her alt panel kendi başına “şu anda görünmeli miyim?” kararı vermemelidir.

### 8.3 Input güvenliği

- `.ui-interactive` yüzeyleri pointer event'i tüketir.
- UI tıklaması dünya raycast'i veya sağ tık komutu üretmez.
- Modal açıkken kamera ve dünya komutları doğru input context ile sınırlandırılır.
- Placement iptali panel düğmesi, `Escape` ve sağ tık davranışlarında aynı domain eylemine gider.

---

## 9. Üretim Dilimleri

Her dilim tek başına oynanabilir kalmalı ve doğrulandıktan sonra Faz 9 checklist'i güncellenmelidir.

### UI-0 — Baseline ve veri sözleşmesi

Amaç: Görsel değişiklikten önce mevcut davranışın ve ölçülerin kanıtını oluşturmak.

- [ ] 1366×768 ve 1920×1080 mevcut UI ekran görüntülerini al.
- [ ] Panel bounding box ve taşma ölçümlerini kaydet.
- [ ] Kaynak `+X/dk` değerinin brüt üretim mi net teslim mi olduğunu kod üzerinden doğrula.
- [ ] Mevcut seçim türlerini ve yapı type/id eşlemesini çıkar.
- [ ] Mevcut UI smoke testlerini baseline olarak çalıştır.

Çıkış kriteri: Tasarım değişikliğinin ölçülebileceği güncel ekran ve veri sözleşmesi vardır.

### UI-1 — Tema tokenları ve üst HUD polish

Amaç: Referanstaki feodal kimliği, harita alanını büyütmeden mevcut üst şeride taşımak.

- [ ] Renk, kenarlık, gölge, boşluk ve tipografi tokenlarını tanımla.
- [ ] Krallık kimliği hücresini data mevcutsa ekle; hard-coded krallık adı kullanma.
- [ ] Kaynak ikonlarını ve doğru hız semantiğini ekle.
- [ ] Çağ, nüfus, boşta işçi, süre ve hız kontrollerini ortak hizaya al.
- [ ] Lojistik uyarısını kompakt durum gösterimine dönüştür.
- [ ] Dar çözünürlükte ikincil gelir metnini tooltip'e taşıyabilen breakpoint ekle.

Muhtemel dosyalar:

- `src/game/rts/ui/rtsHudBar.ts`
- `src/game/rts/ui/resourceLabels.ts`
- `src/game/rts/ui/rtsGameSpeedControls.ts`
- `src/style.css`
- ilgili data adapter

Çıkış kriteri: Üst şerit tek satır kalır, dört kaynak görünür ve iki hedef çözünürlükte `%10` yükseklik bütçesini aşmaz.

### UI-2 — Bağlamsal çalışma alanı ve panel router

Amaç: Aynı anda açık, birbiriyle yarışan panelleri tek bağlamsal yüzey altında toplamak.

- [ ] `RtsUiContext` veya eşdeğer ayrıştırılmış context modelini ekle.
- [ ] Seçim ve placement durumunu tek panel router'a bağla.
- [ ] Alt çalışma alanı shell'ini oluştur.
- [ ] Panel açma/kapatma ve context geçişlerini tanımla.
- [ ] `RtsBuildPalette` içindeki üretim, yükseltme ve eğitim sorumluluklarını ayırmaya başla.
- [ ] Geçersiz context kombinasyonlarını engine testiyle engelle.

Muhtemel dosyalar:

- `src/game/rts/ui/rtsContextPanel.ts` — yeni
- `src/game/rts/ui/rtsUiContext.ts` — yeni
- `src/game/rts/ui/rtsBuildPalette.ts`
- `src/game/rts/RtsApp.ts`
- `src/style.css`

Çıkış kriteri: Asker seçiliyken inşa paleti ve global üretim listesi açık değildir; inşa modundayken yalnız ilgili yerleştirme araçları görünür.

### UI-3 — Seçim panelleri

Amaç: Faz 9'daki işçi, yapı ve birim paneli maddelerini gerçek seçim verisine bağlamak.

- [ ] İşçi paneli
- [ ] Tek birim paneli
- [ ] Çoklu birlik paneli
- [ ] Üretim yapısı paneli
- [ ] Askerî yapı paneli
- [ ] Depo paneli
- [ ] Karakol paneli
- [ ] Ortak can, seviye, rol ve durum bileşenleri
- [ ] Balance verisinden rol/karşıtlık açıklaması

Muhtemel dosyalar:

- `src/game/rts/ui/rtsSelectionPanel.ts`
- `src/game/rts/ui/rtsProductionPanel.ts` — yeni
- `src/game/rts/ui/rtsStructurePanel.ts` — yeni veya ortak renderer
- `src/game/rts/RtsApp.ts`

Çıkış kriteri: Her desteklenen seçim türü yalnız kendisi için gerekli bilgileri ve eylemleri gösterir; bir yapı çalışmıyorsa kesin neden panelde okunur.

### UI-4 — İnşa, yol ve üretim araçları

Amaç: Eylemleri kategori, maliyet, kilit ve yerleştirme nedeni ile anlaşılır kılmak.

- [ ] İnşa kategorileri
- [ ] İkonlu yapı kartları
- [ ] Maliyet ve çağ kilidi
- [ ] Yerleştirme nedeni
- [ ] Yol rota ve toplam maliyet önizlemesi
- [ ] Karakol kontrol alanı önizlemesi
- [ ] Üretim kuyruğu ve iptal eylemi
- [ ] Rally point eylemi
- [ ] Sağ tık / Escape iptal tutarlılığı

Muhtemel dosyalar:

- `src/game/rts/ui/rtsBuildPalette.ts`
- `src/game/rts/ui/rtsRoadControls.ts`
- `src/game/rts/ui/rtsProductionQueue.ts` — yeni
- placement/road snapshot adaptörleri
- `src/style.css`

Çıkış kriteri: İlk kez oynayan bir kullanıcı dış açıklama olmadan yapı ve yol yerleştirebilir; geçersizliğin nedeni aynı yüzeyde görünür.

### UI-5 — Bildirim ve yardımcı sağ yüzey

Amaç: Kritik olayları görünür tutarken kalıcı ekran kalabalığını engellemek.

- [ ] Bildirim ikonları
- [ ] Önem hiyerarşisi ve görsel varyantlar
- [ ] İlgili dünya konumuna gitme/ping davranışı, veri varsa
- [ ] Üst HUD lojistik durumu ile feed tekrarını azalt
- [ ] Görev verisi varsa daraltılabilir görev kartı
- [ ] Olay günlüğünü V1 dışında tut
- [ ] Maksimum görünür satır ve timeout davranışlarını smoke ile doğrula

Muhtemel dosyalar:

- `src/game/rts/ui/rtsNotificationFeed.ts`
- `src/game/rts/ui/rtsNotifications.ts`
- `src/game/rts/ui/rtsObjectivePanel.ts` — yalnız görev sistemi varsa
- `src/style.css`

Çıkış kriteri: Kritik bildirim fark edilir, benzer bildirim spam oluşturmaz ve açık yardımcı yüzey kritik harita merkezini kapatmaz.

### UI-6 — Maç akışı ve minimal ayarlar

Amaç: Faz 9 maç başlangıcı ve bitişini eksiksiz kullanıcı akışına dönüştürmek.

- [ ] Basit başlatma ekranı
- [ ] Pause yüzeyi
- [ ] Yeniden başlat
- [ ] Teslim ol ve onay
- [ ] Zafer ekranı
- [ ] Yenilgi ekranı
- [ ] Ana ses seviyesi
- [ ] Kamera hızı
- [ ] Kamera yumuşatma
- [ ] Ekran sallantısı

Çıkış kriteri: Maç başlatma, pause, bitirme ve yeniden başlatma sırasında input context ve UI state temiz biçimde sıfırlanır.

### UI-7 — World-space overlay ve minimapsiz navigasyon

Amaç: Teknik bilgiyi normal görünümü kirletmeden gerektiği anda göstermek.

- [ ] Seçim/can/hasar gösterge görünürlük kuralları
- [ ] Kontrol alanı bağlamsal görünürlüğü
- [ ] Lojistik overlay aç/kapat
- [ ] Ana/yedek rota dili
- [ ] Mesafe/zoom sadeleştirmesi
- [ ] Bildirime tıklayarak olay konumuna gitme
- [ ] Kritik olaylar için kısa süreli world-space veya ekran kenarı pingi
- [ ] Stratejik nokta isimlerinin zoom/mesafe görünürlük kuralları

Çıkış kriteri: Normal görünüm temizdir; lojistik problemi `L` görünümünde neden ve rota düzeyinde okunur. Oyuncu kritik bir bildirimin konumuna minimap olmadan hızlıca ulaşabilir ve UI'da boş veya sahte minimap yüzeyi bulunmaz.

### UI-8 — Erişilebilirlik, performans ve son polish

Amaç: Görsel hedefi üretim kalitesine taşımak.

- [ ] 1366×768 ve 1920×1080 responsive doğrulama
- [ ] Türkçe karakter ve font fallback doğrulaması
- [ ] Klavye focus görünürlüğü
- [ ] Minimum tıklama hedefi kontrolü
- [ ] Renk dışı takım/durum ayrımı
- [ ] UI sesleri ve sessiz kullanım karşılıkları
- [ ] DOM update ve frame-time kontrolü
- [ ] Arayüz ölçeği ayarı için teknik fizibilite
- [ ] Görsel regression ekran görüntüleri

Çıkış kriteri: Faz 9 kabul kriterleri ve bu belgedeki ölçülebilir UI bütçeleri birlikte sağlanır.

---

## 10. Doğrulama Kapısı

Her TypeScript UI diliminde:

```powershell
npx.cmd tsc --noEmit
npm.cmd run test:engine
npm.cmd run build:verify
```

Browser-facing her anlamlı değişiklikte hedefli Playwright smoke çalıştırılır. Mevcut başlangıç noktası:

```powershell
npx.cmd playwright test tests/smoke/rts-building-placement.spec.ts
```

Smoke kapsamı en az şunları doğrulamalıdır:

- 1366×768 ve 1920×1080 yerleşim
- yatay/dikey taşma olmaması
- üst şerit yükseklik bütçesi
- context değişiminde doğru panel görünürlüğü
- UI tıklamasının dünya komutu üretmemesi
- sağ tık ve Escape iptali
- bildirim tekrar bastırma
- placement neden metni
- yapı seçimi ve üretim kuyruğu
- pause/zafer/yenilgi input context'i

Otomatik testler yerleşim ve davranış regresyonunu kanıtlar. Son okunabilirlik ve “dış açıklama olmadan kullanılabiliyor” kabulü hedefli browser smoke veya manuel oyuncu doğrulamasıyla kapatılır.

---

## 11. Definition of Done

UI üretimi aşağıdaki koşulların tamamı sağlandığında tamamlanmış sayılır:

- [ ] Dört kaynak, nüfus, çağ, süre ve boşta işçi tek bakışta okunuyor.
- [ ] Kaynak hızı oyuncuya yanlış ekonomik sonuç anlatmıyor.
- [ ] Seçim türleri doğru bağlamsal paneli açıyor.
- [ ] Bir yapı çalışmıyorsa kesin neden gösteriliyor.
- [ ] İnşa ve yol araçları dış açıklama olmadan kullanılabiliyor.
- [ ] Aynı anda açık paneller birbirinin görevini tekrar etmiyor.
- [ ] Kritik bildirimler görünür ve spam oluşturmuyor.
- [ ] Arayüz kritik harita alanlarını aşırı kapatmıyor.
- [ ] 1366×768 ve 1920×1080 kullanılabilir.
- [ ] Takım ve durum ayrımı yalnız renge bağlı değil.
- [ ] UI tıklamaları dünya komutu üretmiyor.
- [ ] Maç başlatma, pause, bitirme ve yeniden başlatma güvenilir.
- [ ] TypeScript, engine testleri, hedefli browser smoke ve build doğrulaması geçiyor.
- [ ] İlgili Faz 9 checklist satırları yalnız doğrulama kanıtıyla güncelleniyor.

---

## 12. Riskler ve Önlemler

| Risk | Önlem |
|---|---|
| Referanstaki bütün panellerin aynı anda kopyalanması | Tek bağlamsal çalışma alanı ve context router |
| Görsel polish sırasında oyun kurallarının UI'a taşınması | Snapshot/presentation ayrımı ve data-backed etiketler |
| Gelir değerinin lojistik gerçeğiyle çelişmesi | Brüt üretim/net teslim sözleşmesini UI-0'da doğrulama |
| Alt panelin 1366×768'de haritayı kapatması | Yükseklik bütçesi ve iki çözünürlüklü bounding-box smoke |
| Sağ panelin yeni bir kalıcı yığına dönüşmesi | Görev veriye bağlı, olay günlüğü V1 dışında, bildirim sınırı dört |
| Dekorun okunabilirliği düşürmesi | İnce çerçeve, kontrollü doku, çift font sistemi |
| Image 2 metninin hatalı yazılması | Üretim görselini konsept olarak kullanma; gerçek UI metnini HTML/CSS ile kurma |
| Minimap olmadan kritik olayın yerini bulamama | Tıklanabilir bildirim, world-space/kenar pingi ve stratejik nokta etiketleri |

---

## 13. Image 2 İçin Referans Görselli Prompt

### 13.1 Kullanım

1. `UI_Reference.png` dosyasını görsel referans olarak yükle.
2. Aşağıdaki promptu tek parça halinde kullan.
3. Hedef oranı `16:9`, tercihen `1920×1080` seç.
4. Çıktıyı doğrudan UI asseti değil; kompozisyon, oran, renk ve stil hedefi olarak değerlendir.

### 13.2 Ana prompt

```text
Create a polished 16:9 full-screen gameplay UI concept for a desktop medieval real-time strategy game titled “Üç Çağ: Sınır Krallıkları”. Use the uploaded reference image as the primary visual and compositional reference: preserve its premium classic PC RTS feeling, top-down medieval battlefield, heraldic identity, dark framed panels, antique gold accents, royal blue player color, readable resource bar, unit selection language, and subtle world-space territory markings. Do not copy it literally. Redesign it as a cleaner, more production-feasible and less crowded interface.

Show an active battlefield beside a winding river with two named bridges, forest, rocky terrain, roads, a blue player settlement in the lower-left region, a red enemy fortress in the upper-right region, a few resource deposits, a blue infantry group selected near the central bridge, and restrained territorial control circles. Keep the map as the hero: it must remain clearly visible and occupy most of the screen.

UI composition:

- A single thin top HUD bar, no taller than about 8 percent of the screen.
- At the far left of the top bar, show a compact blue-and-gold heraldic crest and the Turkish kingdom name “Kuzey Krallığı”.
- Show all four resources with distinct readable icons and values: “Yiyecek 620 +20/dk”, “Odun 540 +24/dk”, “Taş 420 +18/dk”, “Altın 680 +26/dk”.
- Show “Nüfus 48/70”, “Çağ II — Kasaba Çağı”, and “Süre 08:47”.
- Place compact pause, speed, settings, and menu controls at the far right.
- Use tabular, stable numbers and clear hierarchy between labels, stock values, and per-minute income.

- Do not include a minimap, minimap frame, radar, tactical map, empty placeholder, or minimap button anywhere in the interface. The game uses compact maps, so keep the bottom-left area open and return that space to the live battlefield view.
- Across the bottom center and bottom-right, use one unified contextual command workspace, not several competing panels.
- The current selection is a group of blue spearmen. Show a medium-size illustrated spearman portrait or role icon, the label “Mızrakçı”, group count “6”, health “120 / 120”, a concise role line “Yakın Dövüş Piyade”, stance “Pozisyonu Koru”, and a small group composition row.
- Show only relevant military commands in the same unified workspace: “Saldırı-Hareket [F]”, “Dur [X]”, “Pozisyonu Koru [H]”, and “Serbest [G]”. Use icons plus Turkish labels.
- Do not show the construction palette while military units are selected.
- Do not show a global production queue while military units are selected.

- On the right side, show one compact, partially collapsible objective card titled “Görevler” with only two short objectives: “Köprü A kontrolünü ele geçir.” and “Merkez kavşağı güvenceye al.”
- Beneath it, allow at most two compact high-priority notifications, such as “Karakol saldırı altında” and “Yol bağlantısı kesildi”. Do not include a permanently open event log.
- Ensure the right-side UI does not run from top to bottom and does not hide a large part of the battlefield.

World-space information:

- Label the bridges “Köprü A” and “Köprü B”.
- Show a short dashed blue movement path only for the selected group.
- Show blue selection rings with a secondary shape cue, not color alone.
- Show subtle blue, red, and neutral control-radius markings only around relevant strategic structures.
- Keep logistics lines and technical overlays hidden in this normal gameplay view.

Visual direction:

- Premium but restrained medieval fantasy RTS interface.
- Dark charcoal and near-black semi-opaque panels, fine antique-gold borders, royal-blue faction accents, warm off-white primary text, muted sage secondary text, and orange-red critical warnings.
- Very subtle wood or stone texture, limited heraldic corner decoration, fine engraved details, but no thick baroque frames.
- Historical serif font feeling for titles only; highly readable modern type for numbers, body text, and buttons.
- Simple bold silhouette icons with consistent lighting and perspective.
- Strong spacing, alignment, grouping, and clean visual hierarchy.
- Every Turkish label must be correctly spelled and readable; avoid gibberish, pseudo-text, random letters, distorted numbers, duplicated labels, or clipped text.
- The interface should look implementable with HTML/CSS over a Three.js game, not like a painted decorative border.
- Navigation must remain understandable without a minimap: use readable bridge labels, one subtle world-space alert ping, and clickable-looking critical notifications instead of a radar panel.

Final quality target: a believable production UI keyframe for a modern indie PC RTS, combining the atmosphere and strategic clarity of the uploaded reference with approximately 25 percent less permanent screen coverage, clearer contextual behavior, better typography, and a substantially cleaner center battlefield view.
```

### 13.3 Kaçınılacak sonuçlar

Prompt yeniden düzenlenirse şu kısıtlar korunmalıdır:

- asker seçiliyken inşa paleti gösterme,
- aynı anda üç büyük alt panel açma,
- sağ kenarı tam yükseklikte panellerle kapatma,
- yiyecek kaynağını unutma,
- kalıcı olay günlüğü ekleme,
- büyük mobil oyun düğmeleri kullanma,
- aşırı barok ve kalın çerçeve kullanma,
- okunamayan sahte UI metni üretme,
- teknik lojistik overlay'i normal görünümde sürekli açık tutma,
- harita merkezini bildirim veya panelle kapatma.
- minimap, radar, tactical map veya boş minimap çerçevesi ekleme.

### 13.4 Mevcut Görselden Minimap Kaldırma Promptu

Mevcut Image 2 çıktısını düzenlemek için:

```text
Edit the uploaded image while preserving its current composition, medieval RTS art direction, top resource bar, right-side objectives and alerts, selected spearman group, bridge labels, and unified bottom command panel exactly as they are.

Remove the minimap and its entire decorative frame from the bottom-left corner. Do not replace it with another panel, radar, tactical map, icon, button, ornament, or empty dark rectangle. Reconstruct the newly exposed bottom-left area as a natural continuation of the existing live battlefield: extend the blue settlement terrain, roads, grass, rocks, trees, and environmental lighting seamlessly into that space. The reconstructed area must match the same camera angle, scale, painterly realism, color grading, and detail density as the rest of the map.

Keep the unified selected-unit command panel at its current size and position. Do not widen it into the freed space and do not add new UI elements. The purpose of this edit is to return the full bottom-left region to the playable world view because the game uses compact maps and does not need a minimap.

Preserve the exact 16:9 canvas dimensions and keep all Turkish labels correctly spelled and readable. Do not alter resource values, notification text, unit count, command hotkeys, faction crest, or the positions of Köprü A and Köprü B.
```

---

## 14. Önerilen İlk Uygulama Sırası

İlk kodlama oturumu için en küçük güvenli sıra:

1. UI-0 baseline ve gelir semantiği doğrulaması
2. UI-2 context modelinin yalnız `none / worker / army / building-placement` durumları
3. Mevcut `RtsSelectionPanel` ve `RtsBuildPalette` görünürlüğünü bu modele bağlama
4. İki çözünürlükte hedefli Playwright smoke
5. Sonuç doğrulandıktan sonra Faz 9 seçim paneli checklist'ine kanıt notu ekleme

Bu sıra, görsel polish başlamadan önce referanstaki en önemli UX problemini — aynı anda yarışan panelleri — çözer.
