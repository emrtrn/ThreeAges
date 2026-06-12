# Ev Ustası — Balance Parameters

> Durum: taslak (iskelet — systems-balancer dolduracak) | Versiyon: 0.0 | Tarih: 2026-06-12 | Bağımlı: 03-economy.md

Bu dosya Ev Ustası'nın **tüm sayısal değerlerinin tek doğruluk kaynağıdır**. GDD bölümleri yalnız formül biçimlerini tanımlar ve buraya referans verir; buradaki her değer Node.js simülasyonu + playtest ile doğrulanmadan `onaylı` sayılmaz. Aşağıdaki öneri değerler ilk tahmindir, **systems-balancer doğrulayacak** etiketi hepsinde geçerlidir.

## Doldurulacak parametre grupları

### FTUE / başlangıç
- Başlangıç coins bakiyesi (öneri: 0 — ilk para ilk teslimden; FTUE işi bunu taşıyacak şekilde kısa).
- "Starter Set" içeriği (oda temel eşya listelerinin tamamını kapsamalı — M7 softlock kuralı).
- FTUE işi: kir sayısı (öneri: 2 leke + 1 çöp), tepsi eşya sayısı (öneri: 3) — hedef: ilk sürtme < 5 sn, ilk teslim < 3 dk.

### İş puanı (M5 ağırlıkları)
- w_c (Cleanliness), w_f (Comfort), w_s (StyleMatch), w_r (ColorMatch), w_q (Quirk), w_h (HiddenWish), w_x (Clutter) — bağlayıcı biçim: eksiler toplamı artıların ölçeğinden küçük (03-economy §2).
- StyleMatch tekrar katsayısı (aynı etiketli N. eşyanın azalan katkısı — öneri: geometrik azalma).
- Clutter yumuşak tavanı (oda boyutuna göre eşya adedi) + "The Minimalist" ağırlık çarpanı.
- Yıldız eşikleri (puan% → 1★/2★/3★; öneri: ilk mahallede cömert, rank'le sıkılaşan eğri).
- 3★'ın yalnız "Starter Set" ile erişilebilirliği — **simülasyonla kanıtlanacak** (M7 kuralı).

### Ödeme ve ekonomi (M6, M7)
- tabanÖdeme(iş) kademeleri (mahalle/oda boyutuna göre), bonusEğrisi(puan%) biçimi ve katsayıları, tipKatsayısı (3★).
- "Redecorate" tekrarKısıntısı (öneri: 0.25–0.4 aralığında aranacak).
- Katalog: tabanFiyat kuşakları, kademeÇarpanı, setİndirimi; hedef: bir iş ödemesi ≈ rank kuşağında 1–2 kalem.
- Alet upgrade fiyat basamakları + etki büyüklükleri ("Big Sponge" yarıçap çarpanı vb.).
- Milestone ödül endeksi k + "güncel ortalama iş ödemesi" tanımı.

### Temizlik pacing'i (M2)
- Kir decal'i sürtme bütçesi (mesafe/süre) + cömert bitiş eşiği (decal son yüzdesi tek süpürmede — 06 §4; öneri: son %10).
- Oda başına kir/çöp adedi kademeleri (hedef: iş süresi 2–4 dk bandı).

### İlerleme (M8)
- "Design Rank" eşikleri (toplam ★) ve eşik başına açılan içerik sırası (kategori/arketip/mahalle — 04-content ile eşli).
- Mahalle kapıları (toplam ★).

### "Job Board" (M1)
- Board kart sayısı (öneri: 3), üretim kuralları ("mevcut katalogla 3★ alınabilir en az 1 iş" garantisi), arketip × oda havuz kuralları.
- Erken işlerde "Hidden Wish" keşif kolaylığı eğrisi (00-overview keşif oranı ölçütünü besler).

### Yerleştirme (M4 — tech-architect ile ortak)
- Grid hücre boyutu, mıknatıs snap eşiği, oda başına eşya üst sınırı (performans + clutter kesişimi).

### Rewarded (07)
- R4 görünme koşulları (oda boyutu eşiği), R5 cooldown'u, R1 kiralama kapsamı (set başına eşya adedi).

## Bağlayıcı notlar

- (07-monetization) Kir/oda boyutu hiçbir parametrede "reklam izleme baskısı" hedefiyle ayarlanamaz; R4 küçük odalarda hiç görünmez.
- (M5) Puan oda durumundan deterministik hesaplanır; hiçbir parametre olay-geçmişi bonusu tanımlayamaz (farm kapısı açılmaz).
- (M7) Hiçbir iş, "Starter Set" dışı eşyayı asgari koşul yapamaz.
