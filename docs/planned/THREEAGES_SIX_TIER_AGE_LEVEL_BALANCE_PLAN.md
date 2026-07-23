# ThreeAges Altı Kademe Çağ ve Yapı Dengesi Planı

Durum: Yerine geçildi - bina-türü bazlı modelin tarihsel planı
Tarih: 2026-07-18  
Kapsam: Yerleşim Lv1-3 ve Kasaba Lv1-3 ile altı anlamlı yapı kademesi. Bu
belge denge hedefini tanımlar; oyun değerlerini henüz değiştirmez.

> 2026-07-23 kararı: Bu belgedeki bina-türü bazlı Lv araştırması yeni oyun
> tasarımı değildir. Yerine, tüm yapıların seviyesini Merkezden yöneten
> [Merkez Odaklı Altı Seviye İlerleme Planı](THREEAGES_CENTER_LED_PROGRESSION_PLAN.md)
> geçmiştir. Bu belge altı-tier denge değerleri ve önceki uygulama bağlamı için
> korunur.

## 1. Karar ve kural

| Kısa ad | Kademe |
|---|---|
| Y1 / Y2 / Y3 | Yerleşim Lv1 / Lv2 / Lv3 |
| K1 / K2 / K3 | Kasaba Lv1 / Lv2 / Lv3 |

Ana kural: Her yapıda K1, Y3'ten belirgin biçimde güçlü olacaktır. Çağ atlama
sonrasında seviye Lv1'e dönse de oyuncunun ekonomi, savunma veya üretim gücü
gerilemeyecek. K1, çağ yatırımının karşılığı olan yeni tabandır; K2 ve K3 ise
aynı çağın ek araştırmalarıdır.

Seviye araştırması owner + yapı türü bazında kalır: aynı türden tamamlanmış
yapılar birlikte ilerler. Çağ atlandığında araştırma Lv1'e döner, fakat yeni
çağın Lv1 tam değerleri uygulanır.

## 2. Önerilen altı kademe değerleri

`can`, azami sağlıktır. `işçi x hız / tampon`, sırasıyla işçi kapasitesi, işçi
başına dakikalık üretim ve yerel tampon kapasitesidir.

### Konut, savunma, ticaret ve askerî üretim

| Yapı / avantaj | Y1 | Y2 | Y3 | K1 | K2 | K3 |
|---|---:|---:|---:|---:|---:|---:|
| Ev: nüfus | 5 | 8 | 11 | 14 | 17 | 20 |
| Ev: can | 300 | 450 | 600 | 750 | 900 | 1050 |
| Depo: can | 500 | 750 | 1050 | 1300 | 1600 | 1900 |
| Karakol: can | 700 | 1000 | 1350 | 1700 | 2100 | 2550 |
| Karakol: tekil / yol bağlı yarıçap | 16 / 20 | 20 / 24 | 24 / 28 | 28 / 32 | 32 / 36 | 36 / 40 |
| Karakol: ok hasarı | 10 | 11 | 12 | 14 | 16 | 18 |
| Pazar: can | 500 | 750 | 1000 | 1250 | 1500 | 1800 |
| Pazar: komisyon | %15 | %12 | %9 | %8 | %7 | %6 |
| Kışla: can | 650 | 900 | 1200 | 1500 | 1850 | 2250 |
| Kışla: sıra kapasitesi | 5 | 10 | 15 | 20 | 25 | 30 |

Depo için ilk dilimde yalnız can artışı önerilir. Mevcut lojistik sistemi bağlı
üretici tamponunu anında global stoğa aktarır ve aktarımı tek bir Depoya
bağlamaz. Bu nedenle doğrulanabilir bir Depo aktarım hızı/capacity alanı henüz
yoktur; ayrı lojistik tasarımı olmadan sahte avantaj eklenmeyecektir.

Kışla sıra eğrisi mevcut 5/10/20 yerine altı kademe 5/10/15/20/25/30 olur.
Koçbaşı Kasaba + Kışla K2 şartında kalır. Böylece Kasaba girişinde Okçu açılır,
kuşatma ise ikinci çağın orta kademe yatırımı olur.

### Ekonomi yapıları

| Yapı / avantaj | Y1 | Y2 | Y3 | K1 | K2 | K3 |
|---|---:|---:|---:|---:|---:|---:|
| Tarla: can | 300 | 400 | 520 | 650 | 800 | 960 |
| Tarla: işçi x hız / tampon | 3x7/40 | 3x8/50 | 4x9/60 | 4x10/80 | 5x11/100 | 5x12/120 |
| Oduncu Kampı: can | 300 | 400 | 520 | 650 | 800 | 960 |
| Oduncu Kampı: işçi x hız / tampon | 3x6/40 | 3x7/50 | 4x8/60 | 4x9/80 | 5x10/100 | 5x11/120 |
| Oduncu Kampı: taşıma kapasitesi | 10 | 12 | 14 | 16 | 18 | 20 |
| Taş Ocağı: can | 450 | 600 | 780 | 1000 | 1250 | 1500 |
| Taş Ocağı: işçi x hız / tampon | 3x5/40 | 3x6/50 | 4x7/60 | 4x8/80 | 5x9/100 | 5x10/120 |
| Altın Madeni: can | 450 | 600 | 780 | 1000 | 1250 | 1500 |
| Altın Madeni: işçi x hız / tampon | 3x3/40 | 3x4/50 | 4x5/60 | 4x6/80 | 5x7/100 | 5x8/120 |

Oduncu Kampının ağaç arama yarıçapı 200'de kalır; bunu büyütmek harita ölçeği
ve hedef seçme davranışını değiştirir. Ekonomi avantajı hız, işçi sayısı, tampon
ve taşıma kapasitesi ile verilir.

### Çağa bağlı yapı ve Merkez

| Sistem | Y1 | Y2 | Y3 | K1 | K2 | K3 |
|---|---:|---:|---:|---:|---:|---:|
| Okçuluk Alanı | yok | yok | yok | 600 can, sıra 20, Okçu | 850 can, sıra 25 | 1100 can, sıra 30 |
| Merkez: can | 300 | 400 | 500 | 650 | 800 | 1000 |
| Merkez: kontrol yarıçapı | 28 | 28 | 28 | 32 | 32 | 32 |
| Merkez: işçi eğitimi | 25 sn | 25 sn | 25 sn | 9 sn | 9 sn | 9 sn |
| Merkez: işçi sıra kapasitesi | 5 | 7 | 9 | 12 | 16 | 20 |

Merkez, çağın ana eşiği olmaya devam eder fakat diğer yapılarla aynı owner + yapı
türü araştırma sözleşmesinde Lv1-Lv3 ilerler. Kasaba geçişi yeni bir Lv1 tabanı
uygular; Merkez K1'de 650 can ve 12 işçi sırası ile Y3'ün üstündedir. Kontrol
yarıçapı ve işçi eğitim süresi çağ kazanımlarıdır; in-age seviye araştırması
yalnızca Merkez'in canını, işçi sırasını ve model seviyesini ilerletir.

## 3. Veri ve runtime tasarımı

Bugünkü `BuildingLevelBalance` çağdan bağımsız Lv2/Lv3 adımlarını ve sınırlı
bonusları taşır. Altı gerçek kademe için her yapı açık bir çağ x seviye matrisi
taşımalıdır:

```ts
progression: {
  settlement: [/* Lv1, Lv2, Lv3 tam değerleri */],
  town: [/* Lv1, Lv2, Lv3 tam değerleri */],
}
```

Her kayıt mutlak değer taşır: `maxHealth`, opsiyonel `populationCapacity`,
`territory`, `tradeCommission`, `economy` override'ı ve `defense` override'ı.
Lv1'in maliyeti yoktur; Lv2/Lv3 bir önceki kademe için maliyet ve süre taşır.
Bu sayede K1 > Y3 kuralı veriden doğrudan okunur.

Migration/fallback rule: `progression` is the complete, validated balance
source for the six tiers. During Faz 1 it is intentionally data-only; existing
`levels` entries remain the live research cost/timer and effect source until
Faz 2 changes every consumer to resolve and apply one active progression tier.
This prevents a partial runtime migration from mixing old values and new ones.

Gerekli runtime dilimleri:

1. Validator, her çağ için tam Lv1-Lv3 matrisi; katı artış; Pazar arbitrajı ve
   ekonomi pozitiflik kurallarını doğrular.
2. `StructureUpgradeSystem`, aktif çağın sonraki kademe kaydını okur; çağ
   tamamlanınca K1'in değerlerini tüm ilgili tamamlanmış yapılara uygular.
3. Tek bir `applyProgressionTier(...)` yolu nüfus, ekonomi, savunma, ticaret,
   askerî sıra ve görünümü eşzamanlı günceller.
4. `EconomyProductionSystem` aktif ekonomi override'ını; `StructureDefenseSystem`
   aktif Karakol savunmasını; askerî üretim aktif sıra kapasitesini kullanır.

## 4. UX ve çağ geçişi

- Panel başlığı `Ev · Kasaba Lv1` biçiminde çağ ve seviyeyi birlikte gösterir.
- Çağ düğmesi, hedef K1 farkını gösterir: örneğin `Ev: +11 -> +14 nüfus`.
- Çağ tamamlanma bildirimi "Lv1'e döndü" yerine yeni güç artışını açıklar.
- Hayalet ve yarı-opak şantiye, aktif çağın araştırılmış seviyesini gösterir.
- Çağ geçişi sürerken yeni yapı seviye araştırmaları kapalı kalır.
- Devam eden bir yapı araştırmasının çağ başlarken iade edilmesi mi, yoksa
  tamamlanıp çağ geçişinde K1'e taşınması mı gerektiği onay bekleyen karardır.

## 5. Uygulama fazları

### Faz 0 - Denge kararı

- [ ] Bu belgedeki değerleri, Koçbaşı K2 kapısını ve Depo sınırını onayla.
- [ ] Çağ geçişi sırasında sürmekte olan yapı araştırması politikasını seç.

### Faz 1 - Veri sözleşmesi

- [x] Çağ x seviye şemasını, tiplerini ve validator kurallarını ekle.
- [x] Tüm yapıların altı kademe değerini `buildings.json` içine taşı.
- [x] Eski kayıtlar için açık migration/fallback kuralı yaz.

### Faz 2 - Simulation

- [x] Aktif tier çözümleyicisini ve `applyProgressionTier(...)` yolunu kur.
- [x] Nüfus, ekonomi, Karakol savunması, Pazar ve askerî sıra etkilerini bağla.
- [x] Y3 -> K1 geçişinin atomik olarak güç artışı verdiğini doğrula.

### Faz 3 - UI, görsel ve AI

- [x] Çağ + seviye başlıkları ve hedef kademe kazançlarını göster.
- [x] Hayalet, şantiye ve bitmiş modelin aktif tier ile eşleştiğini doğrula.
- [x] AI'nin K1 ekonomik artışını kullanmasını ve Koçbaşı için K2'ye yatırım
  yapmasını sağla.

### Faz 4 - Doğrulama ve denge testi

- [x] Her yapı için Y1..K3 veri/runtime tablosunu test ile sabitle.
- [x] Ev Y3 -> K1 geçişinin 11 -> 14 nüfus verdiğini doğrula.
- [x] Çoklu aynı yapı, sonradan tamamlanan yapı ve çağ geçişi senaryolarını test et.
- [ ] En az beş gerçek maçta nüfus tıkanması, kaynak akışı ve Koçbaşı zamanlamasını ölç.

## 6. Başarı ölçütleri

1. K1 hiçbir yapı için Y3'ten zayıf değildir.
2. Çağ atlama görünür güç kaybı değil, yeni üretim ve daha yüksek taban değer anıdır.
3. Her kademe anlamlı bir karar yaratır; yalnız can veren Depo istisnası açıktır.
4. AI ve oyuncu aynı progression verisini kullanır.
