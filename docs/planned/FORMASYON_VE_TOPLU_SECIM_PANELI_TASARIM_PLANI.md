# Üç Çağ: Sınır Krallıkları — Formasyon ve Toplu Seçim Paneli Tasarım Planı

> **Belge türü:** Oynanış + UI + teknik uygulama planı  
> **Sürüm:** v1.0  
> **Tarih:** 10 Ağustos 2026  
> **Kapsam:** Askerî çoklu seçim paneli, formasyon seçimi ve formasyona göre grup hedef dağılımı  
> **İlgili proje kaynakları:** `GPT_PROJE_BAGLAM_DOKUMANI.md`, `THREEAGES_UI_VISUAL_ASSET_INVENTORY.md`, `THREEAGES_UI_ART_BIBLE_AND_PROMPT_SYSTEM(1).md`

---

## 1. Amaç

Mevcut seçim paneli tekli ve çoklu seçim durumlarını zaten anlaşılır biçimde ayırmaktadır:

- Tek bir birim seçildiğinde ayrıntılı birim bilgisi gösterilir.
- Aynı türden birden fazla birim seçildiğinde tek portre ve adet gösterilir.
- Farklı askerî türler birlikte seçildiğinde ilgili portreler yan yana gösterilir ve her türün adedi yazılır.

Çoklu seçim durumlarında panelin sağ tarafında önemli miktarda boş alan kalmaktadır. Bu alanın, oyunun küçük ölçekli ve okunabilir savaş yapısına uygun bir **Formasyon** modülü için kullanılması hedeflenmektedir.

Yeni sistemin amacı yalnızca görsel çeşitlilik yaratmak değildir. Oyuncuya ordusunun cephe genişliği, derinliği, koruma düzeni ve menzilli birlik yerleşimi üzerinde doğrudan fakat kolay anlaşılır bir kontrol vermelidir.

---

## 2. Tasarım ilkeleri

### 2.1 Formasyonlar ayrı bir mikro yönetim sistemi olmamalıdır

Oyuncu her askerin yerini tek tek ayarlamak zorunda kalmamalıdır. Bir formasyon seçildikten sonra mevcut grup hareket sistemi, hedef noktalarını otomatik olarak ilgili düzene göre dağıtmalıdır.

### 2.2 V1'de doğrudan stat bonusu verilmemelidir

İlk sürümde formasyonların etkisi esas olarak **gerçek geometriden** doğmalıdır.

Örnekler:

- Hat geniş bir cephe oluşturur.
- Kol dar geçitlerde daha iyi yerleşir.
- Kare, dayanıklı birlikleri dışarı ve kırılgan birlikleri içeri yerleştirir.
- Hilal iki kanadı öne çıkarır.
- Dağınık düzen birimler arasındaki mesafeyi artırır.

`+%15 savunma`, `+%10 hasar` gibi doğrudan bonuslar ilk uygulamaya dahil edilmemelidir. Böyle bir katman ancak sistem gerçek savaşlarda yeterince test edildikten sonra değerlendirilmelidir.

### 2.3 Mevcut hareket sistemi korunmalıdır

`Serbest` formasyonu mevcut grup hedef dağılımının aynısı olmalıdır. Böylece yeni özellik kapatılabilir bir ek davranış olur ve mevcut oynanış geriye dönük olarak bozulmaz.

### 2.4 Formasyon savaş sırasında katı bir kilit olmamalıdır

Birimler saldırı sırasında formasyon slotuna bağlı kalmamalıdır. Yakın dövüş birimleri hedefe yaklaşabilmeli, Okçular ateş pozisyonu bulabilmeli ve Topçu uygun menzili koruyabilmelidir.

Formasyon sistemi temel olarak:

- hareket hedefinin dağılımını,
- başlangıç savaş yerleşimini,
- grubun hedef noktaya varış düzenini

belirlemelidir.

---

## 3. Kapsam kararı

### V1'e dahil

- Hat
- Kol
- Kama
- Hilal
- Kare
- Dağınık
- Serbest
- Rol bazlı birim slot dağılımı
- Çoklu asker seçiminde Formasyon UI'ı
- Move ve Attack-Move komutlarında formasyon hedef noktaları
- Engel ve geçersiz slotlar için fallback sistemi
- Seçilen formasyonun UI üzerinde aktif gösterilmesi

### V1 dışında

- Kalkan Duvarı gibi ayrı savaş modu / stat bonusu veren formasyonlar
- Sağ/sol kademe gibi ileri formasyonlar
- Formasyon içinde hız bonusu veya zırh bonusu
- Formasyonu hareket boyunca katı biçimde koruyan rigid grup navigasyonu
- Fare sürükleyerek formasyon açısını elle belirleme
- Dünya üzerinde sürekli formasyon hayaleti
- Askerî 10'luk / 100'lük / 1000'lik teşkilatlanma sistemi

> **Not:** “10'luk sistem” bir savaş alanı formasyonu değil, askerî teşkilatlanma modelidir. Bu özellik bu belgede ele alınmamaktadır.

---

# 4. Seçim paneli davranışları

## 4.1 Tek asker seçimi

Mevcut ayrıntılı görünüm korunmalıdır.

Gösterilecekler:

- Büyük portre
- Birim adı
- Can
- Rol / güçlü ve zayıf yönler
- Mevcut durum
- Mevcut komut
- Komut kısayolları

### Formasyon alanı

**Nihai öneri:** Tek asker seçiminde Formasyon modülü tamamen gösterilmemelidir.

Mockup çalışmasında pasif formasyon butonları gösterilmiş olsa da gerçek runtime için bağlamsal UI daha temiz olacaktır. Formasyon yalnızca en az iki askerî birim seçildiğinde açılmalıdır.

Bu sayede tekli seçim ekranı gereksiz pasif butonlarla kalabalıklaşmaz.

---

## 4.2 Aynı türden çoklu seçim

Örnek: `10 Muhafız`

Panel iki ana bölgeye ayrılır.

### Sol bölüm — Birlik Özeti

- Muhafız portresi
- `×10`
- Muhafız
- Birlik Özeti
- `10 Muhafız`
- `Yakın Dövüş`
- `Dayanıklılık: Yüksek`
- `Hareket: Orta`

İstenirse tek cümlelik rol açıklaması gösterilebilir:

> Kalkan ve zırhlarıyla ön saflarda düşmana karşı dirençli birliklerdir.

### Sağ bölüm — Formasyon

Yedi formasyon butonu gösterilir.

Aktif formasyon altın/bronz vurgu ile belirtilir.

Alt bilgi:

`Aktif Formasyon: Hat`

---

## 4.3 Karışık askerî seçim

Örnek:

- 10 Muhafız
- 10 Okçu
- 2 Topçu

### Sol bölüm

Mevcut sistem korunur:

- Muhafız portresi `×10`
- Okçu portresi `×10`
- Topçu portresi `×2`

Portreler seçili birlik türünün hızlı okunmasını sağlamaya devam eder.

### Sağ bölüm

Formasyon alanı gösterilir.

Ek olarak küçük bir özet satırı bulunabilir:

```text
SEÇİLİ ORDU
Toplam: 22
10 Muhafız • 10 Okçu • 2 Topçu
```

Bu bilgi zorunlu değildir; alan sıkışırsa yalnızca `Toplam: 22` yeterlidir.

---

## 4.4 İşçiler ve askerler birlikte seçilirse

Formasyon yalnızca askerî birimlere uygulanmalıdır.

Örnek:

```text
8 Muhafız
5 Okçu
3 İşçi
```

Formasyon hesaplamasına yalnız:

```text
8 Muhafız + 5 Okçu
```

dahil edilir.

İşçiler mevcut grup hareket mantığıyla komutu uygular.

Formasyon modülü, seçili asker sayısı en az `2` ise aktif kalır.

---

## 4.5 Yapı veya yalnız işçi seçimi

Formasyon modülü gösterilmez.

Mevcut seçim paneli davranışı aynen korunur.

---

# 5. Formasyon listesi

## 5.1 Hat — `line`

**Minimum asker:** 2  
**UI etiketi:** Hat

```text
● ● ● ● ● ● ● ●
```

### Amaç

Geniş cephe oluşturmak.

### Rol dağılımı

Karışık orduda:

```text
G G G G G G
  A A A A
    T T
```

- Muhafız önde
- Okçu ikinci hatta
- Topçu en geride

### Kullanım

- Standart açık alan savaşı
- Geniş cephe
- Menzilli birimleri ön hat arkasında tutma

---

## 5.2 Kol — `column`

**Minimum asker:** 2  
**UI etiketi:** Kol  
**Tooltip:** Kol / Sütun Düzeni

```text
● ●
● ●
● ●
● ●
```

### Amaç

Dar ve derin bir düzen oluşturmak.

### Kullanım

- Köprü
- Yol
- Dar geçit
- Bina araları

### Davranış

Varsayılan genişlik iki birim olmalıdır.

Çok büyük gruplarda üç birime kadar genişleyebilir.

---

## 5.3 Kama — `wedge`

**Minimum asker:** 3  
**UI etiketi:** Kama

```text
      ●
    ● ●
  ● ● ●
● ● ● ●
```

### Amaç

Merkezi öne çıkaran hücum düzeni.

### Rol dağılımı

- Muhafızlar ön uç ve ilk sıralar
- Okçular geride
- Topçu en geride ve merkeze yakın

### Kullanım

- İleri hareket
- Saldırı-Hareket
- Dar bir düşman hattına baskı

---

## 5.4 Hilal — `crescent`

**Minimum asker:** 6  
**UI etiketi:** Hilal

```text
● ●             ● ●
  ●           ●
    ●       ●
      ● ● ●
```

### Amaç

Kanatları öne çıkaran içbükey düzen.

### Rol dağılımı

- Muhafızlar kanatlarda ve ön kavis üzerinde
- Okçular merkez iç bölümünde
- Topçu merkezin gerisinde

### Kullanım

- Geniş açık alan
- Düşmanı orta bölgeye alan bir başlangıç yerleşimi
- Kanat baskısı

### Önemli not

V1'de bu düzen otomatik kuşatma veya kanat AI'ı üretmez. Yalnızca başlangıç geometrisini sağlar.

---

## 5.5 Kare — `square`

**Minimum asker:** 8  
**UI etiketi:** Kare

```text
G G G G G
G A A A G
G A T A G
G A A A G
G G G G G
```

### Amaç

Kırılgan birlikleri merkezde koruyan kompakt savunma düzeni.

### Rol dağılımı önceliği

Dış halka:

1. Muhafız
2. Sağlığı yüksek diğer askerler
3. Okçu

İç alan:

1. Topçu
2. Okçu
3. Kalan birlikler

### Kullanım

- Topçu koruması
- Çok yönlü tehdit
- Savunma amaçlı bekleme pozisyonu

---

## 5.6 Dağınık — `loose`

**Minimum asker:** 2  
**UI etiketi:** Dağınık

```text
●       ●
    ●
        ●      ●
 ●
       ●
```

### Amaç

Birimler arasındaki mesafeyi artırmak.

### Kullanım

- Okçu grupları
- Sıkışmayı azaltma
- Daha geniş alan kaplama

### Teknik davranış

Tam rastgele dağılım kullanılmamalıdır.

Dağılım:

- deterministik,
- kontrollü,
- her komutta aşırı değişmeyen

bir jitter sistemiyle oluşturulmalıdır.

---

## 5.7 Serbest — `free` (KALDIRILDI — 12 Ağustos 2026)

Bu seçenek yeni formasyon sisteminin **geri uyumluluk modu** olarak tasarlanmıştı:
hiçbir formasyon slotu uygulanmaz, mevcut grup hareket sistemi aynen kullanılırdı.

Faz 2–5 ile altı geometrik formasyonun tamamı sahaya çıktığı için geri uyumluluk
modunun gerekçesi ortadan kalktı ve `free` hem `RtsFormationId`'den hem de panelden
kaldırıldı. Yerine geçen kararlar:

- **Varsayılan artık `line` (Hat)** — `DEFAULT_RTS_FORMATION`. En geniş ve en az
  sürprizli düzen olduğu için Serbest'in yerini o aldı.
- **Panel altı kart gösterir** (Hat, Kol, Kama, Hilal, Kare, Dağınık). Kartlar
  aradaki 6px boşluk korunarak genişletildi; dar ekranda 4+3 yerine 3+3 iki sıra.
- **Eski dağınık dağıtım kaybolmadı**, yalnızca oyuncunun seçebildiği bir mod
  olmaktan çıktı: işçiler, ikiden az savaşçı içeren seçimler ve hiçbir formasyon
  slotunun ulaşılabilir olmadığı fallback yolu hâlâ `legacyFormationOffsets`
  kullanır (`groupOrders.ts`).
- **Saldırı-Hareket (F) de aktif formasyonu kullanır** — "formasyonsuz" bir cevap
  kalmadığı için sabit bir varsayılana düşmek oyuncunun seçimini sessizce bozardı.

`Serbest` adı oyunda yalnızca **duruş** (G) etiketi olarak yaşamaya devam eder;
§ 7'deki isim çakışması sorunu böylece kendiliğinden çözülmüştür.

---

# 6. Formasyon ikonları

Formasyon ikonları için yeni raster görsel üretmek zorunlu değildir.

Önerilen çözüm:

- SVG
- CSS
- küçük procedural dot diagram

kullanılmasıdır.

Her ikon formasyonu 6–12 adet küçük yuvarlak nokta ile anlatabilir.

Avantajları:

- Çok küçük ölçekte okunabilirlik
- Kolay renk değiştirme
- Hover / selected / disabled durumlarının CSS ile uygulanabilmesi
- Yeni art asset ihtiyacının oluşmaması
- Responsive ölçeklenme

### Görsel durumlar

**Normal**  
Krem / soluk bronz noktalar.

**Hover**  
Bir miktar daha parlak bronz.

**Selected**  
Altın kenar + daha açık noktalar.

**Disabled**  
Düşük kontrast ve düşük opaklık.

---

# 7. Panel yerleşimi

Mevcut seçim panelinin yaklaşık çalışma alanı korunmalıdır.

Önerilen masaüstü yerleşimi:

```text
┌───────────────────────────────────────────────────────────┐
│ SEÇİM / BİRLİK ÖZETİ       │          FORMASYON          │
│                             │                             │
│ [Portre] [Portre] [Portre]  │ Hat Kol Kama Hilal Kare ...│
│                             │                             │
│                             │ Aktif Formasyon: Hat        │
└───────────────────────────────────────────────────────────┘
```

### Bölüm oranı

Yaklaşık:

```text
Sol: 45–50%
Sağ: 50–55%
```

Karışık askerî seçimde portreler mümkün olduğunca mevcut boyutlarını korumalıdır.

### Responsive davranış

Dar çalışma alanında formasyon butonları:

```text
Hat   Kol   Kama
Hilal Kare  Dağ.
```

şeklinde iki satırlı düzene geçer. (Serbest kaldırıldıktan sonra altı kart `3 + 3`
olarak eşit bölünüyor; özgün plandaki `4 + 3` düzeni artık geçerli değil — bkz. § 5.7.)

---

# 8. Aktif formasyon davranışı

## 8.1 Varsayılan değer

Yeni sistem ilk eklendiğinde varsayılan `Serbest` idi; böylece mevcut oyun
davranışı değişmiyordu.

Serbest kaldırıldıktan sonra (§ 5.7) varsayılan **`Hat`**tır.

## 8.2 Formasyon seçildiğinde

Bir formasyon butonuna basmak **anında hareket komutu üretmemelidir**.

Yalnızca aktif formasyon modu değişmelidir.

Örnek:

```text
Aktif Formasyon: Hilal
```

Bir sonraki Move veya Attack-Move komutu bu düzeni kullanır.

## 8.3 Seçim değiştiğinde

V1 için en basit ve öngörülebilir çözüm:

- Oyuncunun son seçtiği formasyon global kullanıcı tercihi olarak tutulur.
- Yeni bir asker grubu seçildiğinde aynı mod aktif kalır.
- Oyuncu isterse tekrar `Serbest` seçer.

Birimler üzerinde kalıcı ve karmaşık grup kimliği tutulmamalıdır.

---

# 9. Formasyon yönü

Oyuncudan ayrı bir yön seçmesi istenmemelidir.

Formasyonun ileri yönü şu şekilde hesaplanır:

```text
seçili grubun merkezi
        ↓
verilen hareket hedefi
```

Bu iki nokta arasındaki vektör formasyonun `forward` yönüdür.

### Yerel koordinat sistemi

```text
forward = normalize(target - centroid)
right   = perpendicular(forward)
```

Formasyon şablonundaki yerel `(x, z)` offsetleri bu eksenlere göre döndürülür.

---

# 10. Rol bazlı yerleşim

Formasyonun önemli kısmı yalnızca şekil değil, **hangi rolün hangi slotu aldığıdır**.

## Rol öncelikleri

### Muhafız

Tercih:

- ön
- dış halka
- kanat

### Okçu

Tercih:

- ikinci sıra
- iç bölüm
- Muhafız arkasındaki slotlar

### Topçu

Tercih:

- en arka
- merkez
- Kare formasyonunda iç çekirdek

### İşçi

Formasyon sisteminin dışında.

---

# 11. Hedef slot üretimi

Önerilen akış:

```text
1. Seçili askerleri al
2. Grup centroid'ini hesapla
3. Komut hedefinden forward yönünü bul
4. Aktif formasyon için ideal yerel slotları üret
5. Slotları world-space koordinatına döndür
6. Geçerli navigasyon hücrelerine projekte et
7. Rollere göre slotları sınıflandır
8. Birimleri uygun slotlara eşleştir
9. Mevcut hareket/pathfinding sistemine hedefleri gönder
```

---

# 12. Birim-slot eşleştirmesi

Amaç gereksiz çapraz hareketleri azaltmaktır.

### V1 için önerilen yöntem

Önce rol grupları oluşturulur:

```text
guards[]
archers[]
artillery[]
```

Her rol içinde:

- birimin mevcut sağ/sol konumu,
- slotun sağ/sol konumu

kullanılarak sıralama yapılabilir.

Sonra en yakın mantıklı slotlar atanır.

Bu yöntem 25–40 birimlik hedef ölçek için yeterlidir.

### Alternatif

Gerekirse daha sonra minimum-cost veya Hungarian assignment kullanılabilir.

V1 için zorunlu değildir.

---

# 13. Birim aralığı

Tek sabit piksel veya dünya birimi değeri yerine birim footprint'i dikkate alınmalıdır.

Öneri:

```text
spacing = max(unitDiameter) + formationGap
```

Başlangıç değerleri oyun içinde test edilmelidir.

### Göreceli aralık

| Formasyon | Aralık |
|---|---:|
| Hat | 1.0× |
| Kol | 0.9× |
| Kama | 1.0× |
| Hilal | 1.05× |
| Kare | 0.9× |
| Dağınık | 1.6–2.0× |
| Serbest | Mevcut sistem |

Bu değerler denge verisi veya formasyon config dosyasından ayarlanabilir olmalıdır.

---

# 14. Engel ve dar alan davranışı

Formasyon sistemi açık arazide güzel görünürken köprü, bina arası veya engellerde kırılmamalıdır.

Her ideal slot için:

1. Slot nav-grid üzerinde kontrol edilir.
2. Geçersizse yakın geçerli hücre aranır.
3. Slot başka bir formasyon slotuyla çakışıyorsa alternatif aranır.
4. Yeterli slot bulunamıyorsa formasyon sıkıştırılır.
5. Hâlâ geçersizse kalan birimler mevcut serbest hedef dağılımına düşer.

### Önerilen fallback sırası

```text
Ideal formasyon
→ %90 spacing
→ %80 spacing
→ yakın geçerli slot
→ Serbest fallback
```

Bir geçitte bütün grubun tek bir ulaşılamaz formasyon noktası yüzünden durması kabul edilmemelidir.

---

# 15. Komutlarla ilişki

## Move

Formasyon uygulanır.

## Attack-Move

Formasyon hedef dağılımı uygulanır.

Düşmanla temas edildiğinde birimler mevcut savaş AI davranışlarını kullanmak için slotlarından ayrılabilir.

## Direct Attack

V1'de formasyon zorlanmamalıdır.

Doğrudan saldırı mevcut combat hedefleme sistemini kullanmalıdır.

## Hold Position

Yeni formasyon oluşturmaz.

Birim bulunduğu konumu korur.

## Stop

Yeni formasyon oluşturmaz.

## Serbest komutu

Mevcut asker AI durumuyla karıştırılmamalıdır.

UI'da gerekirse formasyon `Serbest` ile birim davranış komutu `Serbest` görsel olarak farklı alanlarda gösterilmelidir.

---

# 16. Önemli isim çakışması

> **Çözüldü (12 Ağustos 2026):** `free` formasyonu kaldırıldığı için (§ 5.7)
> `Serbest` artık yalnızca duruş etiketidir. Aşağıdaki bölüm, çakışmanın nasıl
> düşünüldüğünü kayıt altında tutmak için duruyor.

Mevcut oyunda `G: Serbest` şeklinde bir asker davranış komutu bulunmaktadır.

Yeni formasyonlardan biri de `Serbest` olarak adlandırılmaktadır.

Bu iki kavram teknik olarak ayrılmalıdır.

Önerilen kod isimleri:

```text
Combat stance:
FREE
HOLD
STOP
...

Formation:
FREE_FORMATION
LINE
COLUMN
WEDGE
CRESCENT
SQUARE
LOOSE
```

UI'da aynı kelime kullanılabilir fakat iki alanın amacı açık olmalıdır.

Gerekirse formasyon etiketi:

`Düzensiz`

veya

`Formasyonsuz`

olarak da test edilebilir.

İlk tercih mevcut mockup ile uyum için `Serbest`tir.

---

# 17. Veri modeli

Formasyon tanımları kod içine dağılmamalıdır.

Önerilen dosya:

```text
public/game-data/balance/formations.json
```

Örnek yapı:

```json
{
  "defaultFormation": "free",
  "formations": {
    "line": {
      "minUnits": 2,
      "spacingMultiplier": 1.0,
      "roleAware": true
    },
    "column": {
      "minUnits": 2,
      "spacingMultiplier": 0.9,
      "roleAware": true
    },
    "wedge": {
      "minUnits": 3,
      "spacingMultiplier": 1.0,
      "roleAware": true
    },
    "crescent": {
      "minUnits": 6,
      "spacingMultiplier": 1.05,
      "roleAware": true
    },
    "square": {
      "minUnits": 8,
      "spacingMultiplier": 0.9,
      "roleAware": true
    },
    "loose": {
      "minUnits": 2,
      "spacingMultiplier": 1.8,
      "roleAware": false
    }
  }
}
```

Kesin değerler oynanış testleriyle belirlenmelidir.

---

# 18. Önerilen teknik modüller

Mevcut proje yapısına göre örnek ayrım:

```text
src/game/rts/units/formations/
  rtsFormationTypes.ts
  rtsFormationConfig.ts
  rtsFormationGenerator.ts
  rtsFormationAssignment.ts
  rtsFormationValidation.ts
```

UI tarafı:

```text
src/game/rts/ui/
  rtsSelectionPanel.ts
  rtsSelectionView.ts
  rtsFormationControls.ts
```

Bu dosya adları öneridir; mevcut proje yapısına en az müdahaleyle uyarlanmalıdır.

---

# 19. Önerilen TypeScript tipi

```ts
export type RtsFormationId =
  | 'free'
  | 'line'
  | 'column'
  | 'wedge'
  | 'crescent'
  | 'square'
  | 'loose';
```

Formasyon motoru UI'a bağımlı olmamalıdır.

```text
UI
 ↓
Formation selection state
 ↓
Formation generator
 ↓
Unit target positions
 ↓
Existing group movement system
```

---

# 20. UI etkileşimi

Formasyon butonu:

- Sol tık ile seçilir.
- Seçildiğinde selected durumu alır.
- Bir formasyon için yeterli asker yoksa disabled olur.
- Tooltip minimum asker sayısını açıklar.

Örnek:

```text
Hilal
Kanatları öne çıkaran geniş düzen.
En az 6 asker gerekir.
```

### Klavye kısayolları

V1'de ek kısayol önerilmez.

Mevcut `F / H / G / X` komut alanı zaten kullanılmaktadır. Formasyon sistemi önce mouse üzerinden test edilmelidir.

Daha sonra gerekirse sayı tuşları veya modifier kombinasyonları değerlendirilebilir.

---

# 21. Formasyon önizleme ikonları

Her formasyon butonunda küçük dot diagram kullanılmalıdır.

Örnek:

```text
Hat       ● ● ● ● ●
Kol       ● ●
          ● ●
          ● ●

Kama        ●
          ● ● ●
        ● ● ● ● ●

Hilal     ●       ●
           ●     ●
            ● ● ●

Kare      ● ● ● ●
          ●     ●
          ●     ●
          ● ● ● ●

Dağınık   ●   ●
             ●
          ●      ●
```

Bu görsellerin ana amacı tarihsel doğruluk değil, formasyon geometrisinin oyuncuya tek bakışta anlatılmasıdır.

---

# 22. Aşamalı uygulama planı

## Faz 1 — UI ve state

- [x] `RtsFormationId` tanımla
- [x] Aktif formasyon state'i ekle
- [x] Çoklu asker seçiminde Formasyon UI'ını göster
- [x] Yedi formasyon ikonunu oluştur (12 Ağustos 2026'da altıya indi — § 5.7)
- [x] Selected / hover / disabled durumlarını ekle
- [x] Minimum asker sayılarını uygula
- [x] ~~`Serbest` varsayılanını koru~~ → varsayılan `Hat` (§ 5.7)

### Kabul kriteri

Henüz hareket davranışı değişmese bile UI doğru seçim durumunu göstermeli ve formasyon state'i güvenilir biçimde değişmelidir.

> **Kabul (10 Ağustos 2026):** Görsel browser kontrolü kullanıcı tarafından tamamlandı. State ve minimum asker kuralları ayrıca `tsc` ve engine testleriyle doğrulandı.

> **UI takip notu (10 Ağustos 2026):** Çoklu seçimde her birim türü büyük portre kartıyla gösterilir. Bir veya iki türde temel panel genişliği korunur; üç ve dört türde sol portre sütunu, kartları kaydırmadan sığdıracak kadar genişler. Panelin sol kenarı aynı konumda kalır; ek alan yalnız sağa büyür, formasyon sütunu ise iki-portre seçimindeki piksel genişliğinde korunur. Aktif formasyon kartın kendi vurgusundan anlaşıldığı için tekrarlayan `Aktif Formasyon` satırı gösterilmez. Formasyon kartı masaüstünde tekli seçim portresiyle aynı yüksekliktedir, kartlar yukarı yaslıdır ve `Formasyon` başlığı kartların altında gösterilir.

---

## Faz 2 — Temel geometrik formasyonlar

İlk olarak yalnız:

- [x] Hat
- [x] Kol
- [x] ~~Serbest~~ (kaldırıldı — § 5.7)

uygulanmalıdır.

### Neden

Bu üçü:

- slot üretimini,
- yön rotasyonunu,
- spacing sistemini,
- nav-grid validasyonunu

kanıtlamak için yeterlidir.

### Kabul kriteri

10 Muhafız açık arazide Hat ve Kol düzenine güvenilir biçimde hareket edebilmelidir.

> **Kabul (10 Ağustos 2026):** 10 Muhafız ile Hat ve Kol açık arazide görsel olarak doğrulandı.

---

## Faz 3 — Rol bazlı karışık ordu

Test kompozisyonu:

```text
10 Muhafız
10 Okçu
2 Topçu
```

- [x] Muhafız ön slotlara
- [x] Okçu arka / orta slotlara
- [x] Topçu arka merkez slotlara

atanmalıdır.

### Kabul kriteri

Hat formasyonunda Topçu ön sıraya geçmemeli ve Okçular Muhafızların büyük bölümünün önüne yerleşmemelidir.

> **Kabul (10 Ağustos 2026):** Hat ve Kol formasyonlarında rol dağılımı görsel olarak doğrulandı.

---

## Faz 4 — Gelişmiş geometriler

- [x] Kama
- [x] Hilal
- [x] Kare
- [x] Dağınık

### Kabul kriteri

Her formasyon yalnız ikonunda değil, dünya üzerinde de ilk bakışta ayırt edilebilir olmalıdır.

> **Uygulama notu (10 Ağustos 2026):** Kama, Hilal, Kare ve Dağınık için deterministik Move-slot üretimi eklendi. Kare dış halkayı Muhafızlara, iç çekirdeği Topçuya önceliklendirir; Dağınık 1.9× spacing kullanır. Dünya üzerindeki görsel kabul bekliyor.

> **Kabul (10 Ağustos 2026):** Kama, Hilal, Kare ve Dağınık dünya üzerinde görsel olarak doğrulandı.

---

## Faz 5 — Engel ve fallback

- [x] Köprü testi
- [x] Dar yol testi
- [x] Bina arası testi
- [x] Kayalık engel testi
- [x] Ulaşılamaz slot fallback'i
- [x] Sıkıştırılmış spacing fallback'i

> **Uygulama notu (10 Ağustos 2026):** Formasyon Move emri sırasıyla 1.0×, 0.9× ve 0.8× spacing ile denenir. Hâlâ geçersiz slot kalırsa yalnız o slot yakın yürünebilir hücreye projekte edilir; bu da başarısızsa grup Serbest dağıtıma döner. Dar geçit ve yakın-slot fallback’i engine testleriyle doğrulandı. Köprü dünya kabulü bekliyor.

> **Kabul (10 Ağustos 2026):** Bina arası ve kayalık yanındaki Hat, Kol ve Kare Move emirleri dünya üzerinde kullanıcı tarafından doğrulandı. Birimler takılmadan hedefe ilerledi; formasyon ve fallback davranışı kabul edildi.

> **Kabul (10 Ağustos 2026):** Köprü geçişi dünya üzerinde kullanıcı tarafından doğrulandı. Grup kalıcı yığılma veya takılma olmadan köprüyü geçti; Faz 5 tamamlandı.

---

## Faz 6 — Attack-Move entegrasyonu

- [ ] Formasyonlu Attack-Move
- [ ] Düşman temasında formasyonun serbest savaş davranışına izin vermesi
- [ ] Savaş sonrası takılma olmaması

---

# 23. Test matrisi

## Birim sayıları

- [ ] 2
- [ ] 3
- [ ] 5
- [ ] 10
- [ ] 20
- [ ] 40

## Kompozisyonlar

- [ ] Yalnız Muhafız
- [ ] Yalnız Okçu
- [ ] Yalnız Topçu
- [ ] Muhafız + Okçu
- [ ] Muhafız + Topçu
- [ ] Muhafız + Okçu + Topçu
- [ ] Asker + İşçi

## Ortamlar

- [ ] Açık arazi
- [ ] Yol
- [ ] Köprü
- [ ] Bina arası
- [ ] Kayalık engel çevresi
- [ ] Harita kenarı

## Komutlar

- [ ] Move
- [ ] Attack-Move
- [ ] Direct Attack
- [ ] Hold
- [ ] Stop
- [ ] Hızlı art arda hedef değiştirme

---

# 24. Teknik kabul kriterleri

- [ ] ~~Formasyon sistemi mevcut `Serbest` grup hareketini bozmuyor.~~ Serbest
      kaldırıldı (§ 5.7); yerine geçen kriter: eski dağınık dağıtım işçilerde,
      ikiden az savaşçılı seçimlerde ve fallback yolunda hâlâ aynı çalışıyor.
- [ ] Formasyon seçmek kendi başına hareket komutu üretmiyor.
- [ ] 25–40 birimlik gruplarda belirgin frame hitch oluşmuyor.
- [ ] Ulaşılamaz tek slot bütün grubu kilitlemiyor.
- [ ] Aynı noktaya birden fazla birlik hedeflenmiyor.
- [ ] Topçu rol bazlı formasyonlarda ön sıraya yerleştirilmiyor.
- [ ] İşçiler formasyon slotlarına dahil edilmiyor.
- [ ] Formasyon combat AI'ını rigid biçimde kilitlemiyor.
- [ ] Attack-Move sırasında birimler hedef edinmeye devam ediyor.
- [ ] Selection değişimi formasyon state'inde hata üretmiyor.
- [ ] Disabled formasyon seçilemiyor.
- [ ] Responsive UI `1366×768` çözünürlükte kullanılabilir kalıyor.

---

# 25. Browser ve proje doğrulaması

TypeScript değişikliklerinden sonra:

```bash
npx tsc --noEmit
```

Engine/runtime değişikliği varsa tercih edilen tam kontrol:

```bash
npx tsc --noEmit
npm run test:engine
npm run build:verify
```

UI ve dünya hareket davranışı değiştiği için Playwright veya gerçek browser smoke testi de yapılmalıdır.

Özellikle aşağıdakiler ekran görüntüsü veya video ile gözle doğrulanmalıdır:

- Formasyon ikonlarının okunabilirliği
- Mixed-selection panel yerleşimi
- Hat / Kol / Kama / Hilal / Kare'nin görsel ayrışması
- Topçu konumu
- Dar geçit fallback'i

---

# 26. Önerilen ilk oynanabilir dikey dilim

İlk Codex görevi bütün sistemi tek seferde yapmamalıdır.

En küçük oynanabilir sürüm:

```text
1. Çoklu asker seçiminde Formasyon UI'ı
2. Serbest / Hat / Kol
3. Move komutunda slot üretimi
4. 10 Muhafız testi
5. Açık alan + dar geçit testi
```

Bu dilim güvenilir çalıştıktan sonra:

```text
rol bazlı dağılım
→ Kama
→ Hilal
→ Kare
→ Dağınık
→ Attack-Move
```

şeklinde genişletilmelidir.

---

# 27. Nihai tasarım kararı

Formasyon sistemi mevcut seçim panelini değiştirmek yerine **mevcut mantığı tamamlamalıdır**.

Korunacak ana yapı:

```text
Tek birim
→ ayrıntılı bilgi

Aynı tür çoklu seçim
→ tek portre + adet + kısa birlik özeti + formasyon

Karışık askerî seçim
→ tür portreleri + adetler + formasyon
```

Bu yaklaşım mevcut UI'ın en güçlü tarafını korur: oyuncu seçim türünü portrelerden hemen okuyabilir.

Yeni Formasyon alanı ise bugün boş kalan sağ bölgeyi gerçek bir oynanış kararına dönüştürür.

V1 için önerilen yedi formasyon:

```text
Hat
Kol
Kama
Hilal
Kare
Dağınık
Serbest
```

Formasyonlar ilk aşamada stat bonusu vermemeli; avantaj ve dezavantajları sahadaki gerçek yerleşimden doğmalıdır.

Oyunun küçük ölçekli, 25–40 birimlik çatışma hedefi düşünüldüğünde bu sistem yeterince görünür bir taktik katman yaratırken mikro yönetim yükünü kontrollü tutacaktır.
