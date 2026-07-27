# ThreeAges UI Görsel Varlık Envanteri

> **Durum:** Üretim öncesi envanter  
> **Tarih:** 2026-07-26  
> **Referans:** `GDD/UI_Reference.png`  
> **Hedef:** Mevcut RTS UI dizilimini ve mekaniğini koruyarak görsel dili referansa yaklaştırmak  
> **Görsel üretim aracı:** GPT Image 2

---

## 1. Kapsam ve kaynak doğruluğu

Bu liste tarihsel GDD taslaklarından değil, öncelikle güncel çalışan runtime UI'dan çıkarılmıştır.

İncelenen ana kaynaklar:

- `src/game/rts/ui/rtsHudBar.ts`
- `src/game/rts/ui/rtsBuildPalette.ts`
- `src/game/rts/ui/rtsSelectionPanel.ts`
- `src/game/rts/ui/rtsSelectionView.ts`
- `src/game/rts/ui/rtsNotificationFeed.ts`
- `src/game/rts/ui/rtsObjectiveTracker.ts`
- `src/game/rts/ui/rtsWorldProgressOverlay.ts`
- `src/game/rts/match/rtsMatchOverlay.ts`
- `src/style.css`
- `public/game-data/balance/buildings.json`
- `public/game-data/balance/units.json`

Bu dokümandaki “zorunlu” kalemler mevcut UI'da karşılığı olan varlıklardır. “İsteğe bağlı” kalemler aynı mekaniği değiştirmeden görsel kaliteyi artırabilecek eklerdir.

### Güncel kapsam dışında

Aşağıdaki öğeler eski GDD metinlerinde geçse de mevcut vertical slice UI kapsamına dahil değildir:

- Minimap ve minimap işaretleri
- Refah göstergesi
- Kontrol grubu slotları
- Ayrı ana menü ve kapsamlı ayarlar ekranı
- Ses seviyesi ve ekran sallantısı kontrolleri
- Süvari birimi
- Tam görev checklist'i; mevcut sağ panel bölgesel zafer durumunu gösterir

Bu öğeler için şimdilik görsel üretilmemelidir.

---

## 2. Referanstan alınacak görsel dil

`UI_Reference.png` birebir kopyalanmayacak; aşağıdaki ortak dil korunacaktır:

- Çok koyu, sıcak siyah-kahverengi panel yüzeyleri
- Eskitilmiş altın/bronz ince çerçeveler
- Köşelerde kontrollü orta çağ süslemesi
- Parşömen yerine koyu ahşap, dövme metal ve deri hissi
- Krem renkli okunaklı metin, altın başlık ve seçili durum vurgusu
- Tehlikede kızıl/turuncu; olumlu durumda yeşil; oyuncuda mavi; düşmanda kırmızı vurgu
- İkonlarda üç çeyrek perspektif, elle boyanmış stilize gerçekçilik
- Arka planı şeffaf, güçlü siluetli, küçük ölçekte okunabilen görseller
- Panel ve ikonlarda aynı ışık yönü: üst-sol sıcak ışık, alt-sağ yumuşak gölge
- Fazla parlak mobil oyun görünümünden kaçınan, tarihî ve ciddi ton

### Üretim kuralları

- Görsellerin içine metin, sayı, fiyat, tuş adı veya ilerleme yüzdesi gömülmemelidir.
- Dinamik metin ve durum renkleri HTML/CSS tarafından çizilmeye devam etmelidir.
- Panel çerçeveleri tek çözünürlüğe kilitlenmemeli; köşe, kenar ve merkez parçalarıyla 9-slice uyumlu hazırlanmalıdır.
- İkonların çevresine kalıcı slot çerçevesi çizilmemelidir. İkon ve slot iki ayrı varlık olmalıdır.
- Takım rengi portreye kalıcı biçimde gömülmemeli; mümkünse nötr art üzerinde küçük mavi/kırmızı UI vurgusu sonradan uygulanmalıdır.
- Kaynak dosyası şeffaf PNG olmalıdır. Runtime için daha sonra optimize PNG/WebP türevi üretilebilir.
- İkon ana üretimi en az `512×512`; runtime türevi `256×256` önerilir.
- Seçim paneli için ayrı portre ana üretimi gerekmez. Kare yapı/birim ikonu, geniş dikey çerçevede büyütülüp hafif kırpılarak kullanılır.

---

## 3. Mevcut ekran yerleşimi

| Bölge | Mevcut bileşen | Yaklaşık çalışma ölçüsü | İçerik |
|---|---|---:|---|
| Üst tam genişlik | Ana HUD | `yükseklik 58 px` | Krallık, 4 kaynak, çağ, süre, nüfus, boş işçi, hız, menü |
| Üst orta | Bildirim akışı | `340 px` genişlik | En fazla 4 bilgi/uyarı/alarm bildirimi |
| Üst sağ | Görev/hedef paneli | `230 px` genişlik | Stratejik noktalar ve iki tarafın zafer sayaçları |
| Alt sol | Yapı kurma paleti | `520×220 px` | 4 kategori sekmesi, yapı kartları, yol araçları, durum mesajı |
| Alt orta | Seçim paneli | `620×220 px` | Portre, sağlık, birlik slotları, detay, ilerleme ve eylemler |
| Ekran merkezi | Maç modalı | İçeriğe göre | Başlangıç, duraklatma, zafer ve yenilgi |
| Dünya üstü | Projeksiyon katmanı | Dinamik | İnşaat/üretim/sağlık çubukları |
| Dünya zemini | Three.js göstergeleri | Dinamik | Seçim, takım, hedef, komut, yerleştirme ve stratejik nokta halkaları |

---

## 4. Ortak UI kaplama seti

Bu set, tüm panellerin aynı aileye ait görünmesini sağlayacak temel üretim paketidir.

| ID | Görsel | Kullanım | Gerekli durum/varyant | Önerilen ana çıktı |
|---|---|---|---|---:|
| `UI-SKIN-001` | Üst HUD arka yüzeyi | Tam genişlik üst bar | Normal | `2048×128`, yatay döşenebilir |
| `UI-SKIN-002` | Genel panel 9-slice seti | İnşa, seçim, görev, bildirim | Normal | `512×512` kaynak set |
| `UI-SKIN-003` | Büyük alt panel köşe süsleri | İnşa ve seçim panelleri | Sol/sağ ayna uyumlu | `256×256`, şeffaf |
| `UI-SKIN-004` | Modal kart çerçevesi | Başlat, pause, sonuç | Normal, zafer, yenilgi tonu | `1024×768`, 9-slice |
| `UI-SKIN-005` | Panel başlık şeridi | “Yapı Kur”, “Görevler” vb. | Normal, açık/kapalı | `1024×96`, yatay döşenebilir |
| `UI-SKIN-006` | İnce ayraç | HUD hücreleri ve panel bölümleri | Yatay, dikey | `256×32` ve `32×256` |
| `UI-SKIN-007` | Birincil buton yüzeyi | Ana ve seçili eylemler | Normal, hover, basılı, disabled | `256×96`, 9-slice |
| `UI-SKIN-008` | İkincil buton yüzeyi | Hız, menü, ikincil eylem | Normal, hover, basılı, disabled | `256×96`, 9-slice |
| `UI-SKIN-009` | Tehlikeli buton yüzeyi | Teslim/yıkım onayı | Normal, hover, basılı, disabled | `256×96`, 9-slice |
| `UI-SKIN-010` | Kategori sekmesi | Ekonomi, Lojistik, Yerleşim, Askerî | Normal, hover, seçili, disabled | `256×80`, 9-slice |
| `UI-SKIN-011` | Büyük kart/thumbnail slotu | Yapı ve yol seçim kartları | Normal, hover, seçili, kilitli, yetersiz kaynak | `256×256` |
| `UI-SKIN-012` | Küçük birlik slotu | Çoklu seçim tür özeti | Normal, seçili, disabled, boş | `128×128` |
| `UI-SKIN-013` | Portre çerçevesi | Birim/yapı seçim portresi | Normal, dost, düşman/tehlike | `384×512`, şeffaf çerçeve |
| `UI-SKIN-014` | Komut kartı/chip | Saldırı-Hareket, Dur vb. | Normal, hover, aktif, disabled | `256×192`, 9-slice |
| `UI-SKIN-015` | Klavye tuş kapağı | F, H, G, X ve diğer kısayollar | Normal, basılı | `96×96` |
| `UI-SKIN-016` | Tooltip çerçevesi | Ret/kilit nedeni ve açıklama | Normal, kritik | `512×256`, 9-slice |
| `UI-SKIN-017` | Bildirim kartı | Üst orta mesajlar | Bilgi, uyarı, alarm | `768×160`, 9-slice |
| `UI-SKIN-018` | Kritik HUD uyarı şeridi | Lojistik kesintisi | Alarm | `1024×96`, 9-slice |
| `UI-SKIN-019` | Sayaç rozeti | Seçim `×N`, bildirim tekrar `×N` | Normal, kritik | `128×128` |
| `UI-SKIN-020` | Scrollbar seti | Seçim eylem ve detay taşması | Track, thumb, hover | `64×256` |
| `UI-SKIN-021` | Slider seti | Kamera hızı ve yumuşatma | Track, fill, knob, disabled | `512×96` |
| `UI-SKIN-022` | Checkbox/toggle kutusu | İleride aynı görev panel dili için | Boş, işaretli, disabled | `128×128`; mevcutta opsiyonel |

Not: Buton durumları birbirinden bağımsız tam resimler olarak da üretilebilir; ancak en sağlam uygulama tek nötr temel, ayrı hover parlaması ve CSS renk modülasyonudur.

---

## 5. Barlar, dolumlar ve durum göstergeleri

Bu öğelerin genişliği dinamik kalmalıdır. GPT Image 2 yalnızca track, uç kapak ve dolum dokusunu üretmelidir.

| ID | Görsel | Kullanım | Varyant |
|---|---|---|---|
| `UI-BAR-001` | İnce sağlık track'i | Seçim paneli | Koyu metal |
| `UI-BAR-002` | Sağlık dolumu | Seçim paneli ve dünya barı | Yeşil, sarı, kırmızı eşik |
| `UI-BAR-003` | Altın ilerleme track'i | Çağ/seviye/inşaat/üretim | Koyu metal |
| `UI-BAR-004` | Altın ilerleme dolumu | Çağ/seviye/inşaat/üretim | Normal, tamamlanma parlaması |
| `UI-BAR-005` | Oyuncu zafer dolumu | Sağ görev paneli | Mavi |
| `UI-BAR-006` | Düşman zafer dolumu | Sağ görev paneli | Kırmızı |
| `UI-BAR-007` | Donmuş/gerileyen sayaç overlay'i | Bölgesel zafer | Stalled, decaying |
| `UI-BAR-008` | Dünya üstü bar çerçevesi | Yapı ve birim üstü göstergeler | Normal, sağlık |

---

## 6. Üst HUD ikonları

### 6.1 Kaynak ikonları — zorunlu 4 adet

| ID | İçerik | Mevcut veri kimliği |
|---|---|---|
| `UI-RES-FOOD` | Yiyecek; ekmek, et veya mahsul yığını | `food` |
| `UI-RES-WOOD` | Odun/kütük yığını | `wood` |
| `UI-RES-STONE` | Kesme taş/kaya yığını | `stone` |
| `UI-RES-GOLD` | Altın sikke/külçe yığını | `gold` |

İkonlar `21×21 px` civarında gösterildiği için tek nesne, temiz dış hat ve sınırlı iç detay kullanılmalıdır.

### 6.2 Krallık ve sistem ikonları

| ID | Görsel | Mevcut kullanım |
|---|---|---|
| `UI-SYS-CREST-PLAYER` | Oyuncu krallık arması | Üst sol kimlik alanı |
| `UI-SYS-POPULATION` | Nüfus/kişi grubu | Nüfus değeri |
| `UI-SYS-AGE-SETTLEMENT` | Yerleşim/Kasaba öncesi çağ simgesi | Çağ göstergesi |
| `UI-SYS-AGE-TOWN` | Kasaba Çağı simgesi | Çağ göstergesi |
| `UI-SYS-IDLE-WORKER` | Boşta işçi | Boş işçi değeri ve seçim eylemi |
| `UI-SYS-ASSIGN-WORKER` | İşe gönder/iş ata | HUD işçi eylemi |
| `UI-SYS-TIME` | Kum saati veya güneş saati | Maç süresi |
| `UI-SYS-MENU` | Orta çağ temalı menü plakası | Sağ üst menü |
| `UI-SYS-PAUSE` | Duraklatma | Referansla uyumlu yardımcı simge |
| `UI-SYS-SPEED` | Oyun hızı/ileri sarım | 1×, 2×, 4×, 8× grubu için opsiyonel |
| `UI-SYS-CHEVRON-UP` | Panel açık | Görev paneli |
| `UI-SYS-CHEVRON-DOWN` | Panel kapalı | Görev paneli |

Hız rakamları görsele gömülmemelidir; `1×/2×/4×/8×` HTML metni olarak kalmalıdır.

---

## 7. Yapı kartı ve seçim görseli listesi

Her yapı için tek bir **kare kart ikonu** gerekir: palet ve seçim paneli aynı kaynağı kullanır. Seçim paneli ikonu geniş dikey çerçevede büyütür ve hafif kırpar; ayrı portre türevi üretilmez.

| ID | Runtime veri kimliği | Yapı | Kart thumbnail | Seçim portresi | Not |
|---|---|---|---:|---:|---|
| `UI-BLD-COMMAND-CENTER` | `command_center` | Merkez | Evet | Evet | Palet dışında; seçim ve ilerleme panelinde kullanılır |
| `UI-BLD-HOUSE` | `house` | Ev | Evet | Evet | Yerleşim kategorisi |
| `UI-BLD-DEPOT` | `depot` | Depo | Evet | Evet | Lojistik ve stok görünümü |
| `UI-BLD-OUTPOST` | `outpost` | Karakol | Evet | Evet | Kontrol alanı ve saldırı bildirimi |
| `UI-BLD-FARM` | `farm` | Tarla | Evet | Evet | Yiyecek üreticisi |
| `UI-BLD-LUMBER-CAMP` | `lumber_camp` | Oduncu Kampı | Evet | Evet | Odun üreticisi |
| `UI-BLD-QUARRY` | `quarry` | Taş Ocağı | Evet | Evet | Taş üreticisi |
| `UI-BLD-GOLD-MINE` | `gold_mine` | Altın Madeni | Evet | Evet | Altın üreticisi |
| `UI-BLD-MARKET` | `market` | Pazar | Evet | Evet | Al/sat eylemleri |
| `UI-BLD-BARRACKS` | `barracks` | Kışla | Evet | Evet | Muhafız/kuşatma üretimi |
| `UI-BLD-ARCHERY-RANGE` | `archery_range` | Okçuluk Alanı | Evet | Evet | Kasaba Çağı kilidi; okçu üretimi |
| `UI-BLD-ROAD` | `road` | Yol | Evet | Hayır | Lojistik paleti aracı |
| `UI-BLD-ROAD-ERASE` | `road-erase` | Yol Sil | Evet | Hayır | İade yok uyarısı taşıyan araç |
| `UI-BLD-TEMPLE-SOON` | Placeholder | Tapınak — Yakında | Evet | Hayır | Mevcut palet placeholder'ı; kilitli görünür |

### Yapı kartı durum overlay'leri

- Normal/üretilebilir
- Hover
- Seçili araç
- Kaynak yetersiz
- Çağ/seviye kilitli
- “Yakında”/tamamen disabled
- Yerleştirme modu aktif
- Geçerli konum
- Geçersiz konum

Kilit, yetersiz kaynak ve geçersiz konum için ana yapı görselini yeniden üretmek yerine ayrı küçük overlay simgeleri kullanılmalıdır.

---

## 8. Birim thumbnail ve seçim görseli listesi

Mevcut runtime'da dört birim rolü vardır. Aynı kare ikon; çoklu seçim slotu, üretim seçeneği ve seçim panelinin büyütülmüş/kırpılmış görseli için kullanılır.

| ID | Runtime veri kimliği | Birim | Kare thumbnail | Seçim portresi | Küçük slot ikonu |
|---|---|---|---:|---:|---:|
| `UI-UNIT-WORKER` | `worker_placeholder` | İşçi | Evet | Evet | Evet |
| `UI-UNIT-GUARD` | `guard_placeholder` | Muhafız | Evet | Evet | Evet |
| `UI-UNIT-ARCHER` | `archer_placeholder` | Okçu | Evet | Evet | Evet |
| `UI-UNIT-SIEGE` | `siege_placeholder` | Topçu/kuşatma birimi | Evet | Evet | Evet |

### Birim görsel ilkeleri

- Her rol silahı veya aleti sayesinde `24 px` ölçekte ayırt edilebilmelidir.
- Oyuncu/düşman için ayrı portre üretmek gerekmez; temel art nötr kalabilir.
- İşçi: balta/çekiç veya üretim aleti.
- Muhafız: kalkan ve yakın dövüş silahı.
- Okçu: yay ve sadak.
- Topçu: ağır kuşatma silueti/ekipmanı.

---

## 9. Komut ve eylem ikonları

### 9.1 Seçili ordu komutları — zorunlu

| ID | Komut | Güncel kısayol |
|---|---|---|
| `UI-CMD-ATTACK-MOVE` | Saldırı-Hareket | `F` |
| `UI-CMD-HOLD` | Pozisyonu Koru | `H` |
| `UI-CMD-FREE` | Serbest | `G` |
| `UI-CMD-STOP` | Dur | `X` |

### 9.2 Seçime bağlı eylemler — zorunlu ikon ailesi

Mevcut butonlar bugün metin ağırlıklıdır; görsel stile geçildiğinde aşağıdaki ikonlar aynı eylemleri temsil edecektir.

| ID | Eylem | Kullanım |
|---|---|---|
| `UI-CMD-RALLY` | Toplanma Noktası | Askerî yapı |
| `UI-CMD-RESCUE` | Sıkışan birimi kurtar | Birim seçimi |
| `UI-CMD-TRAIN-WORKER` | İşçi üret | Merkez |
| `UI-CMD-TRAIN-UNIT` | Birlik üret | Kışla/Okçuluk Alanı; birim thumbnail'iyle birlikte |
| `UI-CMD-AGE-UP` | Kasaba Çağına geç | Merkez |
| `UI-CMD-LEVEL-UP` | Seviye yükselt | Merkez |
| `UI-CMD-CANCEL-CONSTRUCTION` | İnşaatı iptal et | Şantiye |
| `UI-CMD-DEMOLISH` | Yapıyı yık | Tamamlanmış yapı |
| `UI-CMD-CONFIRM-DANGER` | Yıkım/teslim onayı | İkinci onay durumu |
| `UI-CMD-TRADE-BUY` | Satın al | Pazar |
| `UI-CMD-TRADE-SELL` | Sat | Pazar |
| `UI-CMD-SELECT-IDLE` | Boştaki işçileri seç | Üst HUD |
| `UI-CMD-ASSIGN-IDLE` | Boştaki işçiyi işe gönder | Üst HUD |

### 9.3 Dünya komut geri bildirimi

| ID | İşaret | Mevcut renk anlamı |
|---|---|---|
| `UI-PING-MOVE` | Hareket hedefi | Açık mavi/yeşil |
| `UI-PING-ATTACK` | Saldırı hedefi | Kırmızı |
| `UI-PING-ASSIGN` | İşçi görevlendirme/onarım | Yeşil |
| `UI-PING-ATTACK-MOVE` | Saldırı-Hareket hedefi | Turuncu |
| `UI-PING-INVALID` | Geçersiz komut | Kırmızı yasak işareti |

Bu pingler bugün Three.js halkalarıdır. Tema güçlendirilmek istenirse yalnızca şeffaf decal/sprite merkez motifi üretilebilir; ölçek ve fade animasyonu kodda kalmalıdır.

---

## 10. Bildirim ve durum ikonları

Bildirim kartı üç sunum seviyesine sahiptir: **bilgi**, **uyarı**, **alarm**. Aynı ikon renk değiştirebilir; her seviye için ayrı resim üretmek zorunlu değildir.

| ID | Runtime bildirimi | Önerilen motif | Seviye |
|---|---|---|---|
| `UI-NOTIF-POPULATION-FULL` | Nüfus dolu | Dolu ev/insan grubu | Uyarı |
| `UI-NOTIF-RESOURCE-DEPLETED` | Kaynak tükendi | Boş maden/sepet | Uyarı |
| `UI-NOTIF-LOGISTICS-CUT` | Lojistik kesildi | Kopmuş zincir/yol | Alarm |
| `UI-NOTIF-LOGISTICS-RESTORED` | Lojistik düzeldi | Birleşmiş zincir/onay | Bilgi |
| `UI-NOTIF-OUTPOST-ATTACK` | Karakol saldırı altında | Alevli kule/kılıç | Alarm |
| `UI-NOTIF-CENTER-ATTACK` | Merkez saldırı altında | Kale ve çapraz kılıç | Alarm |
| `UI-NOTIF-AGE-UP` | Oyuncu çağ atladı | Yükselen sancak/yıldız | Bilgi |
| `UI-NOTIF-ENEMY-AGE-UP` | Düşman çağ atladı | Kırmızı sancak/yıldız | Uyarı |
| `UI-NOTIF-REGIONAL-VICTORY` | Bölgesel zafer sayacı kritik | Stratejik bayrak | Alarm |
| `UI-NOTIF-PEACE-ACTIVE` | Saldırmazlık dönemi aktif | El sıkışma/güvercin | Bilgi |
| `UI-NOTIF-PEACE-ENDING` | Saldırmazlık bitiyor | Çatlayan antlaşma | Alarm |
| `UI-NOTIF-PEACE-ENDED` | Saldırmazlık bitti | Çapraz kılıç | Uyarı |

Ek küçük durum overlay'leri:

- `UI-STATE-LOCKED` — çağ/seviye kilidi
- `UI-STATE-UNAFFORDABLE` — kaynak yetersiz
- `UI-STATE-CONTROL-OUTSIDE` — kontrol dışı
- `UI-STATE-ROAD-DISCONNECTED` — yol bağlantısı yok
- `UI-STATE-DEPOT-OCCUPIED` — depo işgal altında
- `UI-STATE-STOCK-FULL` — stok dolu
- `UI-STATE-CONTESTED` — çekişmeli stratejik nokta
- `UI-STATE-COMING-SOON` — henüz kullanılamaz
- `UI-STATE-CHECK` — tamamlandı/bağlandı
- `UI-STATE-WARNING` — genel dikkat
- `UI-STATE-DANGER` — genel kritik

---

## 11. Görev ve bölgesel zafer paneli

Mevcut sağ panelin görsel parçaları:

- Açılır/kapanır “Görevler” başlık şeridi
- Yukarı/aşağı chevron
- “Bölgesel Zafer” alt başlığı
- Her stratejik nokta için ad ve durum satırı
- Durumlar: oyuncuda, düşmanda, nötr, çekişmeli
- Oyuncu bölgesel zafer barı
- Düşman bölgesel zafer barı
- Kalan süre alanı
- Sayaç durumları: ilerliyor, durmuş, geriliyor

Gerekli ek ikon/işaretler:

| ID | Görsel |
|---|---|
| `UI-OBJ-POINT-NEUTRAL` | Nötr stratejik nokta |
| `UI-OBJ-POINT-PLAYER` | Oyuncunun tuttuğu stratejik nokta |
| `UI-OBJ-POINT-ENEMY` | Düşmanın tuttuğu stratejik nokta |
| `UI-OBJ-POINT-CONTESTED` | Çekişmeli stratejik nokta |
| `UI-OBJ-VICTORY-PLAYER` | Oyuncu bölgesel zafer rozeti |
| `UI-OBJ-VICTORY-ENEMY` | Düşman bölgesel zafer rozeti |

Oyuncu/düşman/nötr/çekişmeli için dört ayrı çizim yerine tek bayrak/obelisk motifi ve dört renk/durum overlay'i tercih edilebilir.

---

## 12. Seçim paneli slot ve içerik listesi

Mevcut seçim panelinin üretilecek veya kaplanacak tüm parçaları:

- Panel ana çerçevesi
- Portre çerçevesi
- Büyük ikon görseli (aynı kare kaynak, dikey çerçevede kırpılır)
- Seçim adedi rozeti (`×N`)
- Başlık
- Özet/rol satırı
- Sağlık track ve dolumu
- Çoklu seçim tür slotları
- Slot içi birim ikonu
- Slot içi adet rozeti
- Değişken detay satırları
- Tooltip yüzeyi
- Çağ/seviye/inşaat/üretim ilerleme track'i
- İlerleme dolumu
- Kalan süre alanı
- Eylem butonları
- Eylem maliyeti alanı
- Disabled ve ret nedeni durumu
- Ordu komut kartları
- Komut ikonu
- Klavye tuş kapağı
- Alt ipucu satırı
- İç scroll yüzeyi

Ordu komutları, sağdaki sabit ikiye iki komut güvertesinde yer alır: her kart
büyük ikon, kısa Türkçe ad ve tuş kapağı taşır. Bu alan ilk aşamada salt-okunur
gösterimdir; gelecekte komut butonları aynı ölçü ve konumda etkileşimli olur.
Birlik seçiminde tekrar eden alt tuş ipucu gösterilmez.

### Seçim paneli içerik modları

Bir görsel kontrol turunda aşağıdaki modların tamamı test edilmelidir:

1. Tek işçi
2. Çoklu işçi
3. Tek asker
4. Karışık ordu
5. Şantiye
6. Kaynak üretim yapısı
7. Depo
8. Karakol
9. Kışla
10. Okçuluk Alanı
11. Merkez
12. Pazar
13. Ev/pasif yapı
14. Çağ veya seviye yükseltmesi sürüyor
15. Yapı yıkım onayı
16. İnşaat iptal onayı
17. Kilitli/disabled üretim eylemi

Mevcut sistem yalnızca seçilen türleri gösterir; referanstaki sabit sayıda boş birlik slotu mekaniği şu an yoktur. Boş slot görseli ortak skin setinde hazırlanabilir fakat sabit slot sayısı UI'a eklenmemelidir.

---

## 13. İnşa paleti slot listesi

### Sekmeler

- Ekonomi
- Lojistik
- Yerleşim
- Askerî
- Veri içinde yeni ve kategorisiz yapı olursa “Diğer”

### Sekme durumları

- Normal
- Hover/focus
- Seçili
- Disabled

### Kart içeriği

- Thumbnail
- Yapı/araç adı
- Kaynak maliyeti
- Kilit veya durum overlay'i

### Palet durum ve mesaj alanları

- “Bir yapı seçin”
- Haritada konum seçimi
- Geçerli yerleştirme
- Harita dışı
- Kontrol alanı dışı
- Kaynak yetersiz
- Orman gerekli
- Düşman işgali
- Kaynak düğümü gerekli
- Engel/yapı çakışması
- Yol başlangıç ve rota önizleme
- Yol hücre sayısı ve odun maliyeti
- Yol silme
- Ağın ikiye bölünme uyarısı
- İşlem başarı/hata mesajı

Bu metinler görsele gömülmeyecek; yalnızca normal, olumlu, uyarı ve hata mesaj şeritleri üretilecektir.

---

## 14. Maç akışı ve modal ekran varlıkları

Tek modal sistemi dört kullanım taşır:

| Mod | İçerik | Görsel ton |
|---|---|---|
| Başlangıç | Oyun adı, kısa amaç, “Maçı Başlat” | Nötr/altın |
| Duraklatma | Devam, yeniden başlat, teslim | Nötr |
| Zafer | Sonuç nedeni, maç süresi, yeniden başlat | Altın/mavi |
| Yenilgi | Sonuç nedeni, maç süresi, yeniden başlat | Kızıl |

Gerekli varlıklar:

- Koyu tam ekran scrim/vignette
- Ortak modal çerçevesi
- Zafer başlık rozeti
- Yenilgi başlık rozeti
- Birincil, ikincil ve tehlikeli buton kaplamaları
- Ayarlar bölüm ayıracı
- Kamera hızı slider seti
- Kamera yumuşatma slider seti
- Focus/klavye seçim vurgusu

Opsiyonel tam ekran illüstrasyon üretilmemelidir; mevcut akış harita görüntüsünü modalın arkasında tutar.

---

## 15. Dünya üstü ve zemin UI göstergeleri

Bu öğeler UI envanterinin parçasıdır ancak çoğu GPT Image 2 çıktısı olmamalıdır.

| Gösterge | Mevcut teknik yapı | Görsel üretim kararı |
|---|---|---|
| Seçim kutusu/marquee | DOM rectangle | CSS kaplama; raster gerekmez |
| Birim seçim halkası | Three.js ring geometry | Shader/renk; opsiyonel rune decal |
| Yapı seçim halkası | Three.js ring geometry | Shader/renk; opsiyonel rune decal |
| Oyuncu/düşman takım halkası | Three.js ring geometry | Shader/renk; raster gerekmez |
| Saldırı hedefi halkası | Three.js ring geometry | Shader + animasyon |
| Komut ping halkası | Three.js ring geometry | Opsiyonel merkez sprite |
| Birim dünya sağlık barı | Three.js billboard geometry | Track/fill dokusu kullanılabilir |
| Yapı dünya sağlık barı | DOM projected bar | Ortak bar skin'i |
| İnşaat/üretim ilerleme barı | DOM projected bar | Ortak altın bar skin'i |
| Stratejik nokta halkası | Three.js ring geometry | Renk/shader; opsiyonel bayrak motifi |
| Yerleştirme ghost modeli | Three.js model | Raster UI değildir |
| Yerleştirme footprint çerçevesi | Three.js line loop | Shader/renk |
| Karakol kontrol yarıçapı | Three.js ring geometry | Shader/renk |
| Yol rota önizlemesi | Three.js dünya geometrisi | Raster UI değildir |
| Bölge kontrol overlay'i | Three.js plane grid | Shader/renk |
| Fog of war | Three.js dünya görünümü | Raster UI skin değildir |

### Renk durumları

- Oyuncu/dost: mavi
- Düşman/tehlike: kırmızı
- Geçerli/atanmış/onarım: yeşil
- Saldırı-Hareket/uyarı: turuncu
- Nötr: soluk altın/gri
- Geçersiz: doygun kırmızı
- Çekişmeli: altın nabız veya çift halka

---

## 16. İmleç seti

Mevcut mekanikler tarayıcı imleciyle çalışabilir; tema tamamlanırken aşağıdaki set üretilebilir. İlk görsel üretim grubunda zorunlu değildir.

| ID | İmleç |
|---|---|
| `UI-CURSOR-DEFAULT` | Varsayılan ok |
| `UI-CURSOR-SELECT` | Seçim |
| `UI-CURSOR-MOVE` | Hareket |
| `UI-CURSOR-ATTACK` | Saldırı |
| `UI-CURSOR-ATTACK-MOVE` | Saldırı-Hareket |
| `UI-CURSOR-BUILD-VALID` | Geçerli yapı yerleştirme |
| `UI-CURSOR-BUILD-INVALID` | Geçersiz yapı yerleştirme |
| `UI-CURSOR-ROAD` | Yol çizme |
| `UI-CURSOR-ROAD-ERASE` | Yol silme |
| `UI-CURSOR-DISABLED` | Yasak/geçersiz eylem |

Önerilen kaynak: `128×128`; runtime hotspot ayarlı `32×32` ve `64×64` türevleri.

---

## 17. Üretim sayısı özeti

Bu sayı varyantların nasıl paketlendiğine göre değişebilir. İlk planlama için:

| Grup | Ana görsel sayısı |
|---|---:|
| Ortak skin ve frame ailesi | 22 |
| Dinamik bar ailesi | 8 |
| Kaynak ikonları | 4 |
| Krallık/sistem ikonları | 12 |
| Yapı/yol/tapınak ana thumbnail artları | 14 |
| Yapı seçim portreleri | 0 (mevcut kare ikonlar kullanılır) |
| Birim ana thumbnail artları | 4 |
| Birim seçim portreleri | 0 (mevcut kare ikonlar kullanılır) |
| Komut/eylem ikonları | 17 |
| Bildirim ikonları | 12 |
| Durum overlay ikonları | 11 |
| Görev/stratejik nokta ikonları | 6 |
| Dünya komut ping motifleri | 5 |
| İmleçler — ikinci öncelik | 10 |

**Ham toplam:** 140 ana veya türev çıktı.

Bu sayı, aynı yüksek çözünürlüklü entity artının hem thumbnail hem portre için kullanılması ve durumların CSS ile renklendirilmesi halinde yaklaşık **95–110 benzersiz ana üretime** düşebilir.

---

## 18. Önerilen üretim sırası

### Paket 1 — Görsel dil testi

- Genel panel frame'i
- Üst HUD yüzeyi
- Birincil/ikincil buton
- Büyük ve küçük slot
- Portre çerçevesi
- 4 kaynak ikonu
- 1 yapı örneği: Merkez
- 1 birim örneği: Muhafız
- 1 komut örneği: Saldırı-Hareket
- 1 bildirim örneği: Lojistik kesildi

Bu paket oyun içine alınıp okunabilirlik ve tema onayı yapılmadan tüm ikon setine geçilmemelidir.

### Paket 2 — Ana HUD ve bildirimler

- Tüm kaynak/sistem ikonları
- Bildirim kartları
- Bildirim ve durum ikonları
- Görev paneli skin'i ve stratejik nokta ikonları

### Paket 3 — İnşa paleti

- Tüm yapı ve araç thumbnail'leri
- Sekme, kart, kilit ve yetersiz kaynak durumları

### Paket 4 — Seçim paneli

- Yeni birim/yapı portresi gerekmez; mevcut kare ikonların seçim çerçevesindeki kırpımı doğrulanır
- Birlik slotları
- Komut ve eylem ikonları
- Bar ve ilerleme setleri

### Paket 5 — Maç modalı ve dünya geri bildirimi

- Başlat/pause/zafer/yenilgi modal varyantları
- Slider
- Ping merkez motifleri
- İmleç seti

---

## 19. Dosya adlandırma önerisi

```text
public/assets/ui/
  skin/
    panel_generic_9s.png
    hud_top_tile.png
    button_primary.png
    button_secondary.png
    slot_build.png
    slot_unit.png
    portrait_frame.png
  icons/
    resources/
      resource_food.png
    buildings/
      building_command_center.png
    units/
      unit_guard.png
    commands/
      command_attack_move.png
    notifications/
      notification_logistics_cut.png
    states/
      state_locked.png
  cursors/
    cursor_attack.png
```

Dosya adları İngilizce, küçük harfli `snake_case` olmalı; UI metni Türkçe ve kod/veri tarafından çizilmelidir.

---

## 20. Her görsel için kabul kontrolü

- [ ] Referansın koyu orta çağ temasına uyuyor
- [ ] Diğer UI varlıklarıyla aynı ışık ve materyal dilini kullanıyor
- [ ] Şeffaf kenarlarda beyaz halo yok
- [ ] Küçük gösterim ölçüsünde siluet okunuyor
- [ ] Görselin içine metin/sayı gömülmemiş
- [ ] Slot ve ikon birbirinden bağımsız
- [ ] Normal, hover, seçili ve disabled durumları ayırt edilebilir
- [ ] Renk tek başına bilgi taşımıyor; biçim veya simge de değişiyor
- [ ] 1366×768 çalışma alanında panel süsleri içeriği boğmuyor
- [ ] 1700/1400 px responsive kırılımlarında HUD okunabilir kalıyor
- [ ] PNG kaynak ve optimize runtime türevi arşivlenmiş
- [ ] Dosya adı veri kimliğiyle eşleşiyor
- [ ] Mevcut UI mekaniğine yeni, yetkisiz bir slot veya buton eklemiyor

---

## 21. İlk üretim öncesi net karar

İlk GPT Image 2 çalışması **Paket 1 — Görsel dil testi** olmalıdır. Özellikle panel frame'i, Merkez thumbnail'i, Muhafız portresi ve dört kaynak ikonu birlikte üretildiğinde; metal, ahşap, altın yoğunluğu, kontur kalınlığı ve küçük ölçekte okunabilirlik tek turda değerlendirilebilir. Bu onaydan sonra aynı prompt omurgası kalan varlıklara uygulanmalıdır.
