# Three Ages: Kingdoms of the Frontier — Localization Architecture and Production Plan

> **Türkçe ad:** Üç Çağ: Sınır Krallıkları  
> **İngilizce ad:** Three Ages: Kingdoms of the Frontier  
> **Belge türü:** Lokalizasyon stratejisi, teknik mimari, üretim planı ve kalite kontrol kılavuzu  
> **Sürüm:** v1.0  
> **Tarih:** 8 Ağustos 2026  
> **Hedef platform:** Masaüstü web tarayıcısı  
> **Teknoloji bağlamı:** TypeScript, Three.js, Vite, Forge altyapısı  
> **Belge amacı:** Oyunun bütün kullanıcıya görünen metinlerini merkezi, sürdürülebilir ve çok dilli bir sisteme taşımak; çeviri üretimini fazlara ayırmak; yeni içerik eklendikçe lokalizasyon kalitesinin bozulmasını önlemek.

---

## 1. Belgenin amacı

Bu belge, **Üç Çağ: Sınır Krallıkları** için lokalizasyonun yalnızca bir çeviri işi olarak değil, oyunun veri, UI, kalite ve release süreçlerine bağlı bir üretim sistemi olarak ele alınmasını tanımlar.

Ana hedefler:

1. Oyuncuya görünen bütün metinleri kod ve görsellerden bağımsız hale getirmek.
2. İngilizceyi teknik kaynak ve fallback dili olarak sabitlemek.
3. Türkçeyi eşit derecede desteklenen geliştirme dili olarak korumak.
4. Yeni dillerin kontrollü dalgalar halinde eklenmesini sağlamak.
5. UI taşması, eksik karakter, hatalı placeholder ve eksik çeviri gibi problemleri release öncesi yakalamak.
6. Yeni yapı, birim, bildirim veya özellik eklendiğinde lokalizasyonun otomatik olarak üretim sürecine dahil olmasını sağlamak.
7. Codex veya geliştirici tarafından uygulanabilecek açık fazlar, görevler ve kabul kriterleri oluşturmak.

Bu belge lokalizasyon metinlerinin kendisini içermez. Çevirilerin hangi sistemle üretileceğini, nasıl saklanacağını, hangi sırayla oluşturulacağını ve nasıl doğrulanacağını tanımlar.

---

## 2. Proje kaynakları ve kapsam dayanakları

Bu plan aşağıdaki mevcut proje kararlarıyla uyumludur:

- `GPT_PROJE_BAGLAM_DOKUMANI.md`
- `THREEAGES_UI_VISUAL_ASSET_INVENTORY.md`
- `THREEAGES_UI_ART_BIBLE_AND_PROMPT_SYSTEM(1).md`

Bu belgelerden alınan temel ilkeler:

- Proje veri odaklıdır; oyun dengesi ve içerik kimlikleri kod içine gömülmemelidir.
- UI metinleri HTML/CSS tarafından çizilir.
- Metin, sayı, fiyat, tuş adı ve yüzdeler görsellere gömülmez.
- Runtime kapsamı bugün iki çağ, dört ana kaynak, dört birim rolü ve mevcut UI sistemleri üzerinden ilerler.
- Minimap, süvari, eski Koçbaşı birimi ve uygulanmamış üçüncü çağ lokalizasyon kapsamına eklenmemelidir.

### 2.1 Kaynak önceliği

Lokalize edilecek içeriğin gerçek kapsamı belirlenirken şu sıra kullanılmalıdır:

1. Çalışan runtime UI ve kod
2. `public/game-data/` altındaki güncel oyun verileri
3. Güncel proje bağlam ve kapsam belgeleri
4. Eski GDD metinleri

Eski belgede geçen fakat runtime'da bulunmayan bir metin, varsayılan olarak lokalizasyon kapsamına alınmamalıdır.

---

## 3. Ana lokalizasyon kararları

### 3.1 Teknik kaynak dil

**İngilizce (`en`) teknik source-of-truth ve fallback dilidir.**

Bunun anlamı:

- Her lokalizasyon anahtarı önce İngilizce karşılığa sahip olmalıdır.
- Bir hedef dilde anahtar eksikse sistem İngilizce karşılığa düşmelidir.
- İngilizce dosyada eksik anahtar release hatası kabul edilmelidir.
- Lokalizasyon anahtarları hiçbir zaman Türkçe veya İngilizce görünen metnin kendisinden türetilmemelidir.

Örnek:

```text
Doğru:
notification.logistics_cut.title

Yanlış:
LojistikKesildi
LogisticsCutText
"Lojistik kesildi"
```

### 3.2 Geliştirme dilleri

Geliştirme sırasında iki dil sürekli kullanılmalıdır:

- `en` — teknik kaynak/fallback
- `tr` — ana geliştirme ve doğrulama dili

Türkçe, İngilizceden türetilmiş geçici bir çeviri olarak değil, oyunun sürekli test edilen tam destekli dillerinden biri olarak ele alınmalıdır.

### 3.3 UI görsellerinde metin yasağı

Aşağıdakiler raster UI görsellerine gömülmemelidir:

- yapı ve birim adları,
- buton metinleri,
- fiyatlar,
- kaynak miktarları,
- bildirim metinleri,
- çağ adları,
- süreler,
- klavye harfleri,
- yüzdeler,
- hız değerleri.

Bu kural mevcut UI Art Bible ile uyumludur ve lokalizasyon mimarisinin zorunlu parçasıdır.

### 3.4 Stabil gameplay ID ile görünen metni ayırma

Gameplay kimlikleri değişmeden kalmalıdır:

```text
command_center
barracks
guard_placeholder
logistics_cut
attack_move
```

Oyuncunun gördüğü metin lokalizasyon katmanından alınmalıdır.

```text
command_center
→ building.command_center.name
→ "Command Center" / "Merkez" / ...
```

---

# 4. Dil stratejisi

## 4.1 Genel yaklaşım

Bütün dilleri ilk günden üretmek yerine lokalizasyon üç katmana ayrılmalıdır:

1. **Geliştirme dilleri** — sistem geliştirilirken sürekli kullanılan diller
2. **Tier 1 / Launch dilleri** — ilk ticari veya geniş oyuncu sürümünde hedeflenen diller
3. **Tier 2 ve Tier 3** — gerçek oyuncu talebi ve pazar sinyallerine göre eklenen diller

Bu yaklaşım çeviri maliyetini ve QA yükünü kontrol altında tutar.

---

## 4.2 Geliştirme aşaması

### Aşama D0

1. English — `en`
2. Turkish — `tr`

Bu iki dil lokalizasyon altyapısı tamamlandığı andan itibaren her build'de çalışmalıdır.

---

## 4.3 Tier 1 — İlk geniş lokalizasyon dalgası

Önerilen sıra:

| Sıra | Dil | Locale | Faz |
|---:|---|---|---|
| 1 | English | `en` | Kaynak / fallback |
| 2 | Turkish | `tr` | Geliştirme dili |
| 3 | Simplified Chinese | `zh-CN` | Tier 1 |
| 4 | Russian | `ru` | Tier 1 |
| 5 | Spanish — Spain | `es-ES` | Tier 1 |
| 6 | Portuguese — Brazil | `pt-BR` | Tier 1 |
| 7 | German | `de` | Tier 1 |
| 8 | French | `fr` | Tier 1 |

### Tier 1 hedefi

Toplam **8 tam destekli dil**.

Tier 1'in tamamı aynı gün üretilmek zorunda değildir. Teknik açıdan tercih edilen üretim sırası:

```text
en
→ tr
→ de
→ fr
→ es-ES
→ pt-BR
→ ru
→ zh-CN
```

Bu sıra pazar önceliğinden farklıdır. Amaç QA karmaşıklığını kademeli artırmaktır:

- önce Latin alfabeli Batı dilleri,
- sonra Cyrillic,
- son olarak CJK font ve line-break gereksinimleri.

**Pazar önceliği ile teknik uygulama sırası birbirinden ayrılmalıdır.**

---

## 4.4 Tier 2 — Global genişleme

Önerilen diller:

| Sıra | Dil | Locale |
|---:|---|---|
| 9 | Japanese | `ja` |
| 10 | Polish | `pl` |
| 11 | Korean | `ko` |
| 12 | Traditional Chinese | `zh-TW` |
| 13 | Spanish — Latin America | `es-419` |
| 14 | Italian | `it` |

Tier 2 tamamlandığında hedef:

**14 tam destekli oyun dili.**

Tier 2 yalnızca aşağıdaki koşullardan biri gerçekleştiğinde başlatılmalıdır:

- gerçek oyuncu talebi,
- wishlist veya bölgesel trafik,
- dağıtım platformu analitiği,
- topluluk talebi,
- belirli bir bölgedeki yayıncı veya pazarlama ihtiyacı.

---

## 4.5 Tier 3 — Talebe bağlı diller

Başlangıçta üretim kapsamına alınmaz:

- Ukrainian — `uk`
- Czech — `cs`
- Hungarian — `hu`
- Dutch — `nl`
- Thai — `th`
- Vietnamese — `vi`
- diğer talep temelli diller

Tier 3 için önceden çeviri üretilmez; yalnızca altyapı bu dilleri eklemeye uygun tutulur.

---

# 5. Lokalizasyon kapsamı

## 5.1 Lokalize edilecek içerikler

### Ana HUD

- kaynak adları ve tooltip'leri,
- nüfus,
- boşta işçi,
- çağ,
- maç süresiyle ilişkili etiketler,
- hız ve menü tooltip'leri.

### Yapı paleti

- kategori adları,
- yapı adları,
- yapı açıklamaları,
- maliyet açıklamaları,
- kilit nedenleri,
- geçersiz yerleştirme nedenleri,
- yol aracı durum mesajları.

### Seçim paneli

- yapı/birim adları,
- rol açıklamaları,
- durum etiketleri,
- eylem adları,
- komut adları,
- tooltip'ler,
- ilerleme açıklamaları,
- üretim ve yükseltme metinleri.

### Bildirim sistemi

- bilgi,
- uyarı,
- alarm,
- lojistik,
- saldırı,
- nüfus,
- kaynak,
- çağ,
- bölgesel zafer,
- saldırmazlık dönemi metinleri.

### Maç akışı

- başlangıç,
- pause,
- teslim ol,
- zafer,
- yenilgi,
- yeniden başlatma,
- sonuç nedeni.

### Görev / stratejik nokta paneli

- stratejik nokta adları,
- sahiplik durumları,
- bölgesel zafer metinleri,
- sayaç durumları.

### Ayarlar ve sistem mesajları

- kamera ayarları,
- ileride eklenen genel kullanıcı ayarları,
- hata ve fallback mesajları.

---

## 5.2 Lokalize edilmeyecek içerikler

Aşağıdakiler gameplay veya teknik kimliktir ve çevrilmez:

```text
command_center
guard_placeholder
core_match
regionalVictory
fogOfWar
RTS_CoreMatch.level.json
```

Ayrıca:

- dosya isimleri,
- JSON ID'leri,
- debug-only teknik değişken adları,
- telemetry event ID'leri,
- CSS class adları,
- TypeScript enum/internal sabitleri

lokalize edilmez.

Debug panelindeki kullanıcı testi için anlamlı açıklamalar gerektiğinde ayrı bir `debug.*` namespace kullanılabilir; teknik anahtarların kendisi değiştirilmez.

---

# 6. Teknik mimari

## 6.1 Önerilen yüksek seviye akış

```text
Gameplay / UI
      ↓
Localization Key
      ↓
LocalizationService
      ↓
Active Locale Dictionary
      ↓
Fallback Locale (en)
      ↓
Formatter / Plural / Number / Date
      ↓
Rendered UI Text
```

UI katmanı mümkün olduğunca doğrudan dil dosyasını okumamalıdır.

Tek giriş noktası bir lokalizasyon servisi olmalıdır.

---

## 6.2 Önerilen kod bileşenleri

Önerilen klasör:

```text
src/game/localization/
  LocalizationService.ts
  LocalizationTypes.ts
  LocalizationLoader.ts
  LocalizationFormatter.ts
  LocalizationDebug.ts
  localeRegistry.ts
```

### `LocalizationService`

Sorumlulukları:

- aktif dili tutmak,
- anahtar çözmek,
- fallback uygulamak,
- parametre geçirmek,
- dil değişikliğini yayınlamak,
- eksik anahtarları raporlamak.

Örnek API yönü:

```ts
t("building.barracks.name")
t("notification.population_full.body", { current, capacity })
setLocale("tr")
getLocale()
```

Bu yalnız mimari yönü gösterir; kesin API implementasyon sırasında belirlenmelidir.

---

## 6.3 Locale registry

Desteklenen diller kod içine dağınık olarak yazılmamalıdır.

Tek registry önerilir:

```text
localeRegistry
  en
  tr
  de
  fr
  es-ES
  pt-BR
  ru
  zh-CN
  ...
```

Her locale için metadata tutulabilir:

- locale code,
- native display name,
- fallback,
- font family,
- text direction,
- release tier,
- enabled/disabled durumu.

Örnek mantıksal kayıt:

```text
code: zh-CN
name: 简体中文
fallback: en
tier: 1
fontGroup: cjk
direction: ltr
```

---

# 7. Lokalizasyon dosya yapısı

## 7.1 Önerilen konum

Projenin mevcut veri odaklı yapısına uyum için:

```text
public/game-data/locales/
```

önerilir.

### Önerilen yapı

```text
public/game-data/locales/
  en/
    common.json
    hud.json
    buildings.json
    units.json
    commands.json
    notifications.json
    objectives.json
    match.json
    errors.json
  tr/
    common.json
    hud.json
    buildings.json
    units.json
    commands.json
    notifications.json
    objectives.json
    match.json
    errors.json
  de/
  fr/
  ...
```

---

## 7.2 Neden tek büyük JSON kullanılmamalı?

Tek dosya ilk etapta kolay görünür fakat proje büyüdükçe:

- merge conflict artar,
- çeviri kapsamı takip edilemez,
- belirli sistemin eksikleri zor bulunur,
- AI veya insan çeviri görevini küçük paketlere bölmek zorlaşır.

Domain bazlı dosya yapısı tercih edilmelidir.

---

# 8. Anahtar isimlendirme standardı

## 8.1 Genel biçim

```text
<domain>.<entity>.<field>
```

Örnek:

```text
building.barracks.name
building.barracks.description
unit.guard.name
unit.guard.role
command.attack_move.name
notification.logistics_cut.title
notification.logistics_cut.body
```

---

## 8.2 İsimlendirme kuralları

- lowercase kullanılmalı,
- snake_case segment kullanılabilir,
- görünen metin anahtar içine yazılmamalı,
- gameplay ID ile mümkün olduğunca paralel olmalı,
- key yeniden adlandırma gereksiz yere yapılmamalı.

### Doğru

```text
building.command_center.name
building.archery_range.description
state.road_disconnected
match.result.victory
```

### Kaçınılacak

```text
building.firstBuildingName
ui.text47
victoryTextNew
barracks_button_label_final
```

---

# 9. Gameplay verisi ile lokalizasyon ilişkisi

Gameplay JSON dosyalarında doğrudan kullanıcıya gösterilen metin taşımak yerine localization key referansı tercih edilmelidir.

Örnek yön:

```json
{
  "id": "barracks",
  "nameKey": "building.barracks.name",
  "descriptionKey": "building.barracks.description"
}
```

Alternatif olarak ID'den deterministik key üretilebilir:

```text
barracks
→ building.barracks.name
```

Ancak açıklama, tooltip ve özel metinler için açık key alanları daha güvenlidir.

### Karar

İlk migrasyonda:

- gameplay ID korunmalı,
- `nameKey` ve gerektiğinde `descriptionKey` yaklaşımı kullanılmalı,
- UI katmanı doğrudan `building.name` string'i okumamalıdır.

---

# 10. Parametreli metinler

String birleştirme lokalizasyon için kullanılmamalıdır.

### Yanlış

```text
"Need " + amount + " wood"
```

### Doğru kavram

```text
resource.need_wood
params: { amount }
```

İngilizce:

```text
Requires {amount} wood
```

Türkçe:

```text
{amount} odun gerekli
```

Böylece dilin kelime sırası özgür kalır.

---

# 11. Çoğul, sayı ve biçimlendirme

## 11.1 Çoğul sistemi

İngilizce için yalnız `one/other` yeterli görünse de Rusça ve bazı başka diller daha fazla plural category kullanır.

Bu nedenle çoğul mantığı elle `amount === 1` şeklinde kodlanmamalıdır.

### Önerilen temel

Tarayıcının `Intl` API ailesi kullanılmalıdır:

- `Intl.PluralRules`
- `Intl.NumberFormat`
- gerektiğinde `Intl.DateTimeFormat`

Parametreli ve çoğullu mesajların güvenilir yönetimi için ICU MessageFormat uyumlu bir çözüm tercih edilmelidir.

### Mimari tercih

Kendi özel çoğul parser'ımızı yazmak yerine, proje boyutu uygunsa yerleşik ve test edilmiş bir ICU MessageFormat implementasyonu kullanılmalıdır.

Kesin kütüphane uygulama fazında dependency bütçesiyle birlikte seçilmelidir.

---

## 11.2 Sayılar

UI'da ham JavaScript sayı string'i kullanılmamalıdır.

Örnek:

```text
12345
```

locale bazında:

```text
12,345
12.345
12 345
```

biçimlerine dönüşebilir.

Kaynak, nüfus ve fiyat gösterimlerinde `Intl.NumberFormat` üzerinden ortak formatter kullanılmalıdır.

---

## 11.3 Süreler

Maç süresi gibi gameplay açısından kompakt değerler (`12:45`) locale bağımsız bırakılabilir.

Ancak metin içinde geçen süre ifadeleri lokalize edilmelidir:

```text
{seconds} seconds remaining
```

---

# 12. Dil seçimi ve fallback

## 12.1 Başlangıç locale çözümleme sırası

Önerilen sıra:

```text
1. Oyuncunun oyun içinde kaydettiği dil tercihi
2. Tarayıcı locale bilgisi
3. Desteklenen en yakın locale eşleşmesi
4. English fallback
```

Örnek:

```text
browser: pt-PT
oyun: pt-BR mevcut
```

Bu durumda otomatik eşleme kuralları bilinçli tanımlanmalıdır; bütün benzer locale'ler körlemesine birbirine eşlenmemelidir.

---

## 12.2 Fallback zinciri

Basit ve tahmin edilebilir tutulmalıdır:

```text
active locale
→ en
→ visible missing-key marker (debug only)
```

Örnek:

```text
tr eksik
→ en kullan
```

`zh-TW → zh-CN → en` gibi karmaşık dil zincirleri ancak bilinçli ürün kararıyla eklenmelidir. Traditional ve Simplified Chinese otomatik olarak eşdeğer kabul edilmemelidir.

---

# 13. Runtime dil değişimi

Dil değiştirildiğinde sayfa yenilemesi zorunlu olmamalıdır.

Beklenen davranış:

```text
setLocale(locale)
→ gerekli locale bundle yüklenir
→ aktif locale değişir
→ localeChanged olayı yayınlanır
→ açık UI bileşenleri yeniden render edilir
```

### Yeniden render edilmesi gereken başlıca alanlar

- HUD,
- seçim paneli,
- yapı paleti,
- tooltip,
- görev paneli,
- bildirimler,
- modal ekranlar.

Dünya üzerindeki dinamik label'lar varsa onlar da aynı event'e bağlanmalıdır.

---

# 14. Font ve karakter kapsamı

## 14.1 Font grupları

En az iki font ailesi grubu planlanmalıdır:

### Latin + Cyrillic

Desteklemeli:

- English,
- Turkish,
- German,
- French,
- Spanish,
- Portuguese,
- Polish,
- Russian,
- Italian.

Türkçe karakterler özellikle doğrulanmalıdır:

```text
Ç Ğ İ Ö Ş Ü
ç ğ ı i ö ş ü
```

### CJK

Desteklemeli:

- Simplified Chinese,
- Traditional Chinese,
- Japanese,
- Korean.

Tek font bütün CJK dillerini estetik olarak iyi karşılamayabilir. Font family locale registry üzerinden değiştirilebilir olmalıdır.

---

## 14.2 Font lisansı

Release'e girecek fontların:

- web embedding izni,
- ticari kullanım izni,
- gerekli glyph kapsamı

doğrulanmalıdır.

Font dosyalarının ağırlığı web build performansına dahil edilmelidir.

---

# 15. UI tasarım kuralları

## 15.1 Metin genişlemesi bütçesi

İngilizce referans metne göre UI mümkün olduğunca yaklaşık `%30–40` genişleme payı bırakmalıdır.

Özellikle:

- German,
- French,
- Russian

uzun UI metinleri üretebilir.

### Kural

Sabit piksel genişlikli buton + tek satır + kırpma, mümkün olduğunca kaçınılmalıdır.

Tercih sırası:

1. esnek genişlik,
2. kontrollü wrapping,
3. daha kısa resmi çeviri,
4. ancak son çare olarak küçük font azaltımı.

---

## 15.2 UI içine metin sığdırmak için çeviri anlamı bozulmamalı

Çevirmen sırf butona sığdırmak için oyun mekanik anlamını değiştirmemelidir.

UI problemi önce layout problemi olarak değerlendirilmelidir.

---

## 15.3 CJK satır kırılması

Latin dilleri için yazılmış whitespace tabanlı line-break varsayımları CJK dillerinde yeterli olmayabilir.

CJK test turunda:

- tooltip wrapping,
- notification wrapping,
- başlık taşması,
- satır yüksekliği

ayrı kontrol edilmelidir.

---

# 16. Terminoloji sistemi

## 16.1 Terminoloji sözlüğü zorunludur

Oyunun tasarım kimliğini taşıyan terimler serbest çeviriye bırakılmamalıdır.

Başlangıç sözlüğüne en az şunlar alınmalıdır:

- Command Center / Merkez
- Outpost / Karakol
- Depot / Depo
- Control Area / Kontrol Alanı
- Local Buffer / Yerel Tampon
- Global Stock / Global Stok
- External Economy / Dış Ekonomi
- Road Network / Yol Ağı
- Attack-Move / Saldırı-Hareket
- Hold Position / Pozisyonu Koru
- Regional Victory / Bölgesel Zafer
- Settlement Age / Yerleşim Çağı
- Town Age / Kasaba Çağı
- Worker / İşçi
- Guard / Muhafız
- Archer / Okçu
- Artillery / Topçu

### Dosya önerisi

```text
GDD/LOCALIZATION_GLOSSARY.md
```

veya lokalizasyon planının yanındaki ayrı bir kaynak belge.

**Durum:** yazıldı (Faz 2, 19 Ağustos 2026). `GDD/LOCALIZATION_GLOSSARY.md`
§16.1'in listesini yayınlanmış `en`/`tr` çiftleriyle karşılıyor; ayrıca
cümle içinde geçen kavramları (Kontrol Alanı, Yerel Tampon, Global Stok,
Dış Ekonomi, Yol Ağı) ve çevirmen notlarını taşıyor. Tek doğruluk kaynağı
`public/game-data/locales/`; bir terim orada değişirse sözlük aynı commit'te
değişir.

---

## 16.2 Her terim için kayıt

Önerilen alanlar:

```text
Gameplay ID:
English source term:
Turkish approved term:
Definition:
Context:
Do not use:
Notes for translators:
```

Bu sözlük ileride diğer dillere çeviri yapılırken temel bağlam belgesi olur.

---

# 17. Kaynak metin yazım standardı

Çeviri kalitesi kaynak İngilizce metnin kalitesine bağlıdır.

## 17.1 UI etiketleri

- kısa,
- tek anlamlı,
- gereksiz noktalamasız,
- aynı eylem her yerde aynı adla.

## 17.2 Tooltip

Önerilen yapı:

```text
Ne yapar?
Gerekirse neden kullanılır?
Önemli sınırlama nedir?
```

Uzun lore metniyle gameplay açıklaması karıştırılmamalıdır.

## 17.3 Hata / ret nedenleri

Sistem yalnız sonucu değil nedeni göstermelidir.

Örnek aile:

```text
placement.error.outside_control
placement.error.insufficient_resources
placement.error.requires_forest
placement.error.resource_node_required
placement.error.blocked
```

Bir genel `Cannot build here` metniyle bütün nedenler kapatılmamalıdır.

---

# 18. Çeviri üretim yöntemi

## 18.1 Çeviri paketi

Her çeviri turunda çevirmenin veya AI sisteminin önüne yalnız ham JSON verilmemelidir.

Paket şunları içermelidir:

1. kaynak İngilizce metin,
2. localization key,
3. gameplay bağlamı,
4. terminoloji sözlüğü,
5. karakter veya UI uzunluk notu,
6. placeholder açıklamaları.

---

## 18.2 AI kullanımı

AI ilk çeviri için kullanılabilir ancak aşağıdakiler otomatik kabul edilmemelidir:

- ana oyun terminolojisi,
- komut adları,
- hata nedenleri,
- zafer/yenilgi metinleri,
- parametreli ve çoğullu mesajlar.

AI üretiminden sonra en az:

- terminoloji kontrolü,
- placeholder kontrolü,
- UI kontrolü

yapılmalıdır.

---

# 19. Teknik doğrulama araçları

Lokalizasyon için küçük bir doğrulama script'i oluşturulmalıdır.

Önerilen konum:

```text
tools/validate-locales.ts
```

## 19.1 Kontrol etmesi gerekenler

- `en` içindeki tüm anahtarların geçerli olması,
- her hedef dilde eksik key listesi,
- fazladan / orphan key listesi,
- placeholder adlarının eşleşmesi,
- JSON parse hataları,
- desteklenmeyen locale klasörleri,
- duplicate veya yanlış namespace,
- boş string,
- istemeden kaynak İngilizceyle aynı bırakılmış şüpheli metinler.

### Release davranışı

`en` eksik key:

**hard fail**

Tier 1 dil eksik key:

**release build'de hard fail veya açık waiver gerektirir**

Tier 2 geliştirme aşaması:

**warning kabul edilebilir**

---

# 20. Debug modu

Geliştirme sırasında lokalizasyon problemlerini görünür kılmak için debug mod önerilir.

Örnek özellikler:

### Missing key modu

```text
⟦missing:key.path⟧
```

### Key display modu

UI gerçek metin yerine key'i gösterir:

```text
building.barracks.name
```

Bu mod hardcoded metinleri bulmak için çok değerlidir.

### Pseudo-localization modu

Gerçek yeni dil oluşturmadan UI taşması test edilir.

Örnek:

```text
Barracks
→ [!! Bààrrààcks Exx !!]
```

Amaç:

- metni `%30–40` uzatmak,
- Latin karakter varyasyonları eklemek,
- sabit genişlikli UI hatalarını ortaya çıkarmak.

Pseudo-locale önerisi:

```text
qps-ploc
```

Bu kullanıcıya sunulmaz; yalnız development/debug içindir.

---

# 21. Fazlara ayrılmış çalışma planı

# Faz 0 — Lokalizasyon envanteri

## Amaç

Oyuncuya görünen bütün mevcut stringlerin bulunması ve sınıflandırılması.

## Görevler

- [x] `src/game/rts/ui/` içindeki hardcoded metinleri tara
- [x] maç overlay metinlerini tara
- [x] yapı ve birim veri dosyalarındaki görünen isimleri tara
- [x] bildirim metinlerini tara
- [x] yerleştirme hata nedenlerini tara
- [x] tooltip ve komut metinlerini tara
- [x] görev/zafer metinlerini tara
- [x] debug-only metinleri ayrı işaretle
- [x] görsellere yanlışlıkla gömülmüş metin bulunmadığını doğrula

## Çıktı

```text
GDD/LOCALIZATION_STRING_INVENTORY.md
```

veya makine tarafından üretilen CSV/JSON envanteri.

## Kabul kriteri

Oyuncuya görünen mevcut metinlerin kapsamı bilinmeden Faz 1 tamamlanmış sayılmaz.

## Durum: tamamlandı (8 Ağustos 2026)

Envanter `GDD/LOCALIZATION_STRING_INVENTORY.md` içinde. Kapsam: **≈ 530 oyuncuya
görünen string** (≈ 460 kod, 72 veri), 16 UI dosyası + `RtsApp` + 8 veri dosyası.
Debug (≈ 318) ve editör (≈ 200) yüzeyleri ayrı işaretlendi ve kapsam dışı
önerildi. Görsellere gömülü metin bulunmadı.

Faz 1'e taşınan kararlar — ayrıntısı envanterin §7 ve §9'unda:

- Oyunun mevcut tek dili Türkçe; bu planın §3.1'i gereği `en` dosyaları **sıfırdan
  yazılacak**, yani Faz 2 "TR'yi anahtarla" + "EN kaynak metni yaz" olarak iki iş.
- ICU/plural kararı Faz 1'de verilmeli: Türkçe çoğulu gizliyor, İngilizce kaynak
  metin yazılır yazılmaz gerekecek.
- Türkçe ekler string'e gömülü (`${targetLabel}'ye Yükselt`) — taşınamaz ve bugün
  de hatalı olabilir; ayrı bir düzeltme kalemi.
- Tuş harfleri çeviri metnine gömülü (`Seç (I)`, `F: Saldırı-Hareket …`);
  `defaultInputBindings` üzerinden parametre olmalı.
- `resourceLabels.ts` ile `resources.json` kaynak adlarını çift tutuyor.
- **294 test assertion'ı** (188 `engine-tests`, 106 smoke literal) görünen Türkçe
  metne bağlı; Faz 2'nin en büyük tek kalemi olabilir ve mevcut Faz 2 görev
  listesinde yok.

---

# Faz 1 — Temel teknik altyapı

## Amaç

Dil yükleme, lookup, fallback ve runtime değiştirme sistemini kurmak.

## Görevler

- [x] `LocalizationService` oluştur
- [x] locale registry oluştur
- [x] locale loader oluştur
- [x] `en` fallback uygula
- [x] locale preference saklama mekanizması ekle
- [x] browser locale detection ekle
- [x] runtime `setLocale()` akışını kur
- [x] `localeChanged` event'i ekle
- [x] missing-key debug davranışını ekle
- [x] `Intl.NumberFormat` ortak formatter ekle
- [x] plural/message format yaklaşımını belirle

## Kabul kriterleri

- [x] `en` ve `tr` arasında sayfa yenilemeden geçiş yapılabiliyor
- [x] eksik `tr` key'i `en` değerine düşüyor
- [x] eksik `en` key'i debug'da açıkça görünüyor
- [x] locale tercihi yeniden açılışta korunuyor
- [x] TypeScript kontrolü geçiyor

## Durum: tamamlandı (19 Ağustos 2026)

**Kod** — `src/game/localization/`: `LocalizationTypes.ts`, `localeRegistry.ts`,
`LocalizationFormatter.ts`, `LocalizationLoader.ts`, `LocalizationDebug.ts`,
`LocalizationService.ts`, artı `bootLocalization.ts`. Yedinci dosya bilinçli:
`window` / `navigator` / `localStorage` ne varsa orada toplandı, §33'ün altı
dosyası saf ve node'da test edilebilir kaldı.

**Veri** — `public/game-data/locales/{en,tr}/`: envanter §9.1'in on domain
dosyası. `common.json` çekirdek anahtarlarla (kaynak adları, çağ adları, bir
çoğul örneği) dolduruldu; kalan dokuzu Faz 2'nin yazacağı boş `{}`.

**Boot** — `src/main.ts` → `bootFoundation()`. Locale bundle preset fetch'iyle
paralel iner ve boot'un sonunda beklenir; menü de UI olduğu için metin ilk
çizimden önce hazır olmak zorunda.

**Test** — `tools/engine-tests.ts` içinde yedi yeni kontrol
(`Lokalizasyon Faz 1: …`). Hiçbiri bir çeviriyi alıntılamıyor: yapı, eşlik ve
türetme doğrulanıyor, cümle değil (CLAUDE.md'nin "tuning'i değil sözleşmeyi
doğrula" kuralı).

### Faz 1'de verilen kararlar

1. **ICU MessageFormat: repo içi alt küme** (`LocalizationFormatter.ts`, ~470
   satır), `intl-messageformat` bağımlılığı yerine. `Intl.PluralRules` /
   `NumberFormat` / `ListFormat` üstünde `{ad}`, `{n, number[, integer|percent]}`,
   `{n, plural, =0/one/few/other {…}}` (`#` ve `offset:` dâhil),
   `{x, select, …}` ve ICU kesme işareti kuralı destekleniyor. Desteklenmeyen
   söz dizimi **sessizce geçilmiyor, parse hatası veriyor** — sekiz dilde yarım
   cümle basmaktansa yazıldığı yerde patlaması tercih edildi. Gerekçe: sıfır
   runtime bağımlılığı + reponun kendi validator'ları/test koşucusu yazma
   kültürü. Karşılığı: iç içe mesajlarda ince hata riski, karşılığında da
   `test:engine` kapsamı.
2. **Test kuplajı: testler anahtara bakar** (envanter §7.10, öneri 4).
   `service.setDisplayMode("keys")` ve `?loc-debug=keys` her lookup'ı kendi
   anahtarına çeviriyor; `?locale=qps-ploc` picker'ın hiç göstermediği
   pseudo-locale'e URL'den erişiyor. 294 assertion'ın taşınması Faz 2'nin işi,
   ama taşınacağı hedef artık var.
3. **Dosya biçimi: düz tam anahtar.** `common.json` içinde
   `"building.lumber_camp.name": "…"` — iç içe JSON değil. Domain dosyası bir
   *teslimat birimi*, namespace değil: `errors.json` hem `placement.error.*`
   hem `road.hint.*` taşıyor. Bir anahtarın iki domain dosyasında geçmesi hata
   (son yazan kazanmıyor), çünkü dosyaları bölmenin amacı iki çevirmenin
   birbirini ezmemesi.
4. **Tarayıcı eşlemesi kör değil** (§12.1). Dil alt etiketi yalnız *kodu o dil
   olan* locale'e düşer: `de-AT → de` ✓, ama `pt-PT → pt-BR` ✗ ve
   `zh-Hant → zh-CN` ✗. Genel `pt` yine `pt-BR`'ye gider, çünkü `pt-BR` onu
   registry'de açıkça talep ediyor. Talep etmeyen hiçbir etiket eşleşmez.
5. **Eksik anahtar dev ve release'de farklı.** Dev'de `⟦missing:key⟧`,
   release'de ham anahtar: oyuncuya `⟦missing:…⟧` gösterilmez, geliştiricinin
   ise kaçırması mümkün olmamalı. Her iki durumda da `missingKeys()` topluyor ve
   çağrı asla exception atmıyor.
6. **Tier 1/2 locale'leri registry'de kayıtlı ama `enabled: false`.** Fallback
   zinciri, font grubu ve tarayıcı talebi bir kere kararlaştırılıp gözden
   geçirilebilsin diye; §33 gereği klasörleri **açılmadı**.

### Faz 2'ye devredilenler

- `tools/validate-locales.ts` (§19). Bugünkü karşılığı engine-test'teki
  "shipped locale folders match the registry and the source keys" kontrolü:
  klasör/anahtar/placeholder eşliğini tutuyor ama ayrı bir araç değil.
- Envanter §7.10'un 294 assertion'ı — hedef karar verildi, taşıma yapılmadı.
- `resourceLabels.ts` ↔ `resources.json` kaynak adı ikiliği (envanter §7.2):
  tek anahtar `common.resource.<id>.name` altında birleşecek.
- Klavye harflerinin `{key}` parametresine çıkarılması (envanter §7.6).
- `rtsObjectiveTracker.ts`'deki `innerHTML` → `textContent` (envanter §7.9).

Not: pseudo-locale altyapısı (`qps-ploc`, üretilen bundle, `%35` uzatma) Faz
1'de yazıldı; **Faz 3 tamamlandı** — UI, pseudo-locale ile gezildi ve bulunan
taşmalar düzeltildi (kullanıcı görsel kabulü: OK).

---

# Faz 2 — English / Turkish migrasyonu

## Amaç

Mevcut bütün kullanıcıya görünen metni lokalizasyon sistemine taşımak.

## Önerilen migrasyon sırası

1. Maç modalı
2. Ana HUD
3. Bildirimler
4. Yapı paleti
5. Seçim paneli
6. Komutlar
7. Görev/stratejik panel
8. Tooltip ve hata nedenleri
9. Gameplay veri isimleri ve açıklamaları

## Görevler

- [x] `en` domain JSON dosyalarını doldur
- [x] `tr` domain JSON dosyalarını doldur
- [x] hardcoded UI stringlerini kaldır
- [x] gameplay data → localization key bağlantısını kur
- [x] string concatenation kullanan mesajları parametreli sisteme taşı
- [x] tekrar eden metinleri tek anahtarda birleştir
- [x] terminoloji sözlüğünü oluştur (`GDD/LOCALIZATION_GLOSSARY.md`)

## Kabul kriterleri

- [x] oyun İngilizce baştan sona oynanabiliyor — her iki dil de eksiksiz
      yüklenip çözülüyor; **bir maçı baştan sona oynayarak görsel kabul
      kullanıcıya ait** (CLAUDE.md), otomatik kapılar aşağıda
- [x] oyun Türkçe baştan sona oynanabiliyor — aynı not
- [x] oyuncuya görünen hardcoded gameplay UI metni kalmamış — `src/game/rts`
      taraması yalnız debug yüzeylerinde Türkçe dize buluyor
- [x] missing key = 0 — kodun ve veri dosyalarının adlandırdığı her anahtar
      `en` ve `tr` içinde tanımlı (iki engine kontrolü)
- [x] placeholder mismatch = 0 — Faz 1'in locale parity kontrolü

## Durum: tamamlandı (19 Ağustos 2026)

Doğrulama: `npm run build:verify` yeşil (`verify:imports` PASS · `tsc` temiz ·
`vite build` · `test:engine` 1514/1514 · `verify:dist --strict` PASS) ·
`rts-mission-panel` ve `rts-regional-victory` smoke'ları Chromium'da yeşil.

### Dokuz kalemin tamamı kapandı

| # | Yüzey | Nerede |
| --- | --- | --- |
| 1 | Maç modalı | `match.json` |
| 2 | Ana HUD | `hud.json` |
| 3 | Bildirimler | `notifications.json` |
| 4 | Yapı paleti | `buildings.json` |
| 5 | Seçim paneli | `selection.json` |
| 6 | Komut cevapları | `notifications.json` (`command.*`) |
| 7 | Görev rehberi | `objectives.json` |
| 8 | Yerleştirme + yol hata nedenleri | `errors.json` |
| 9 | Gameplay veri isimleri ve açıklamaları | aşağıda |

Sırada olmayıp yine de bu fazda taşınan yüzeyler: `rtsMainMenu`,
`rtsMatchSetup`, `rtsLoadingScreen`, `rtsGameSpeedControls`,
`rtsArmyRosterStrip`, `rtsObjectiveTracker`, `rtsMissionPanel`,
`rtsSupplyNotices`, `rtsSelectionPanel` çerçevesi, formasyon kataloğu
(`rtsFormationTypes.ts`) ve stratejik nokta isimleri.

### 9. kalem: veri dosyaları artık metin değil anahtar taşıyor

`label` → `nameKey`, Plan §9'un kararı birebir:
`buildings.json`, `units.json`, `animals.json`, `trade-sites.json`,
`ages.json`, `logistics.json` (kervan) ve `missions/frontier_road.json`
(`nameKey` / `introKey` / `introFogKey` / `outroKey`, adım başına
`titleKey` / `whyKey` — 46 dize `objectives.json`'a taşındı, İngilizcesi
sıfırdan yazıldı).

`resources.json`'un `label`'ı **taşınmadı, silindi**: Faz 1'in devrettiği
"`resourceLabels.ts` ↔ `resources.json` çift kaydı" tek anahtar
`common.resource.<id>.name` altında birleşti ve `resourceLabels.ts` artık
yalnız *sıra* ile maliyet biçimlendiricilerini tutuyor.

Stratejik nokta isimleri türetiliyor (`objective.point.<pointId>.name`),
aktörden okunmuyor: `BP_RTS_StrategicPoint`'in `label` değişkeni kaldırıldı,
iki seviye dosyasındaki override'lar da. Bir işaretçinin yazılacak cümlesi
yok; ikinci bir alan yalnız aynı gerçeğin ikinci evi olurdu.

### Bu fazda kurulan üç sözleşme

1. **`requireLocalizationKey` (`validateGameData.ts`).** `nameKey` alanı
   küçük harfli, noktalı ve en az iki parçalı olmak zorunda. `"nameKey":
   "Merkez"` yüklenirdi ve HUD'da bir ekran ötede `⟦missing:Merkez⟧` basardı;
   artık hangi dosya ve alan olduğunu söyleyerek load'da patlıyor.
2. **`Lokalizasyon Faz 2: gameplay data names its text by key, and every key
   resolves`** (`tools/engine-tests.ts`). Sekiz veri dosyasının her
   `nameKey`'ini, misyonun bütün anahtarlarını ve haritanın türetilmiş geçit
   anahtarlarını hem `en` hem `tr` içinde arıyor; `resources.json`'a bir
   `label` geri gelirse de kırmızıya döner.
3. **Görev kartı ölçüsü artık locale dosyalarından okunuyor.** `title` ≤ 40,
   `why` ≤ 110 — betikten değil, **her yayınlanan dilden**. İngilizcede sığıp
   Türkçede taşan bir kart yine taşan karttır; §15.1'in genişleme bütçesi
   tam olarak bu ölçüm.

### Simülasyon metin taşımıyor

Anahtarı üretim/ekonomi sistemleri taşıyor, cümleyi UI kuruyor:
`BarracksQueueSnapshot.trainingNameKey` / `pendingNameKeys`,
`CancelledUnitOrder.nameKey`, `UnitProductionEvent.unitNameKey`,
`ProducerSnapshot.structureNameKey`, `TradeSiteSnapshot.nameKey`,
`MarketSupplyLine.siteNameKey`, `MissionDirector.introKey` … Bir sistem
bitmiş cümle tutsaydı, kuyruğa girildiği andaki dili tutardı ve maç
içindeki dil değişimi onu orada bırakırdı.

Aynı gerekçeyle `RtsApp.buildingLabels` önbelleği `localeChanged` ile
boşaltılıyor (Plan §13), ve sıralamadaki `localeCompare(…, "tr")`
çağrıları `localizedCompare` oldu — aktif locale'in `intlLocale`'i ile.

### Test kuplajı: probe bundle

`tools/engine-tests.ts` her anahtarı kendi adını ve parametrelerini basan
sentetik bir kalıba çeviriyor (`selection.repair.hint health=80 seconds=4`).
Bu fazda maliyet satırları için `probeResourceName` / `probeCostEntry` /
`probeCostLine` yardımcıları eklendi: bir maliyet artık iç içe iki kalıp
(`common.cost.entry amount=50 resource=common.resource.food.name`) ve
beklenen değer aynı id'lerden kuruluyor — yani hangi kaynak, ne kadar
doğrulanıyor; kelimeler değil.

Sıralama testlerinde iki beklenen sıra değişti (rol içi ayrım artık anahtara
göre): pinlenen şey *ayrımın kendisi*, hangi Türkçe kelimenin öne geçtiği
değil.

### Smoke süiti `tr-TR`'ye sabitlendi

`playwright.config.ts` → `use.locale: "tr-TR"`. Oyun dili
`navigator.languages`'tan çözüyor (§12.1); sabitlenmemiş Chromium `en-US`
açıyordu ve `tests/smoke` içindeki bütün metin iddiaları — hepsi Türkçe —
kaynak İngilizce dizeleri okuyordu. Sabitlemek aynı zamanda süiti CI
imajının diline değil, seçilmiş tek bir dile bağlıyor.

### Devredilenler

- `tools/validate-locales.ts` (§19) hâlâ ayrı bir araç değil; karşılığı
  engine-test'teki iki lokalizasyon kontrolü.
- Smoke iddialarının `?loc-debug=keys` ile anahtara taşınması — engine
  testlerinde verilen Faz 1 kararının smoke karşılığı. Bugün `tr-TR` pini
  aynı işi daha ucuza görüyor, ama süiti Türkçe kelimelere bağlı bırakıyor.
- Debug yüzeyleri (`aiDebugView`, `formatVisionDebug`, `rtsSimulationWitness`,
  perf bölge adları) kasten Türkçe kaldı — envanter §6.1 kapsam dışı saydı.
  Gerekirse §5.2'nin `debug.*` namespace'i var.

---

# §27 ara işi — Dil seçici UI

**Durum:** tamamlandı (19 Ağustos 2026).

Doğrulama: `npm run build:verify` yeşil (`verify:imports` PASS · `tsc` temiz ·
`vite build` · `test:engine` 1515/1515 · `verify:dist --strict` PASS) ve dil
değişimi çalışan oyunda kullanıcı tarafından onaylandı — bu fazın asıl kabulü
oydu, çünkü buradaki soru "kod doğru mu" değil, "ekranda dil dönüyor mu"ydu.

Faz 1 dili reload'suz değiştirebilen bir servis kurdu, Faz 2 bütün metni onun
arkasına taşıdı — ama ekranda `setLocale`'i çağıran hiçbir şey yoktu. Dil
yalnız `?locale=`, kayıtlı tercih ve `navigator.languages`'tan çözülüyordu, yani
oyuncunun dili değiştirme yolu yoktu. Bu iş o eksik kontrolü koyuyor.

## Ne eklendi

- `src/game/rts/ui/rtsLanguageSelect.ts` — tek bileşen, iki yere monte:
  ana menü kartının altına (maça girmeden önce) ve duraklat kartının ayarlar
  bloğuna (maç içinde, teslim olmadan). Satırlar registry'nin `nativeName`'i,
  hiçbir zaman çevrilmiyor: kendi dilini arayan oyuncu kendi yazacağı kelimeyi
  tarar. `qps-ploc` listede yok (§20) — aktifken devre dışı bir satırla itiraf
  ediliyor, sessizce başka bir dil gösterilmiyor.
- Ambient yazma ucu: `availableLocales()` / `activeLocale()` / `changeLocale()`
  (`LocalizationService.ts`), `t()` ile aynı şekilde.
- `common.language.label` / `common.language.hint` (en + tr).

## §13'ün ikinci yarısı: açık ekranların yeniden metinlenmesi

Picker, nadir ve geliştirici-özel bir olayı iki tıklık bir kontrole çevirdi — ve
HUD'un yarısı eski dilde kalıyordu. HUD'un çoğu her kare snapshot'tan yazdığı
için bedava düzeliyor; düzelmeyen, **constructor'da bir kez yazılan** metin.

`ui/rtsStaticText.ts` bunu duraklat kartının zaten kullandığı işaretleme
numarasından çıkardı (`markStaticText` / `markStaticTitle` / `markStaticAria` +
`refreshStaticText`). `retranslate()` kazanan yüzeyler: yapı paleti (başlık,
sekmeler, grup başlıkları, kart adları, fiyatlar, kilit ipuçları), seçim paneli,
görev takipçisi, misyon kartı, hız kontrolleri — hepsi `RtsApp`'in mevcut
`onLocaleChanged` aboneliğinden sürülüyor. Hiçbiri yeniden kurulmuyor: açık
kategori, seçili birim ve armed yapı dil değişiminden sağ çıkıyor.

## Olay-tetikli itmenin bıraktığı iz

Panellerin çoğu her kare (`selectionPanel.setSelection`) ya da her tick
(`syncHudBar`) itiliyor, yani dil değişimini kendiliğinden yakalıyor. Yapı
paleti öyle değil: `syncPlacementUi` / `syncRoadUi` yalnız **yerleştirme
olduğunda** çağrılıyor. Sonuç, kullanıcının bildirdiği hata — "Bir yapı seç"
satırı dil değişiminden sonra oyuncu bir araç kuşanana ya da iptal edene kadar
eski dilde kalıyordu, yani palet rastgele bir anda dil değiştiriyormuş gibi
görünüyordu.

Düzeltme paletin içinde: son itilen `BuildingPlacementState` /
`RoadPlacementState` ve hangisinin durum satırını en son yazdığı tutuluyor,
`retranslate()` **yalnız onu** yeniden oynatıyor (ikisini sabit sırayla
oynatmak, yaşayan bir yol ipucunu gizler ya da yerleştirmenin üstüne yol
istemi basardı). Aksiyon mesajı da (`setActionMessage`) artık cümleyi değil
**cümleyi üreten çağrıyı** alıyor: "Kasaba çağı gerekli" gibi bir ret, kendisini
temizleyecek bir sonraki eylemi beklemeden yeni dilde geri geliyor.

## Faz 2'den kaçan tek dize

`rtsSelectionPanel.ts` içindeki `formationTitle.textContent = "Formasyon"`.
Faz 2'nin tarayıcısı **anahtar biçimli literal** arıyor, Türkçe cümle değil; bu
satırda hiç `t(...)` çağrısı olmadığı için görünmezdi. Artık
`selection.formation.title`. Bu, "bir dil seçici olmadan lokalizasyonun bitip
bitmediğini bilemezsiniz" tezinin somut kanıtı.

## Test

`Lokalizasyon §27: the language picker offers only shipped locales, and its
choice sticks` (`tools/engine-tests.ts`): picker'ın listesi registry'nin
`enabled` kümesi, her satırın boş olmayan `nativeName`/`intlLocale`'i var,
`qps-ploc` asla listede değil, kaynak dil her zaman listede (her anahtarı tanımlayan
tek dile dönüş yolu kapanamaz), iki satır aynı kelimeyi okuyamaz — ve seçim
kalıcı: `changeLocale` yazdığını bir sonraki boot'un `resolveInitialLocale`'i
okuyor, gönderilmemiş bir kayıtlı locale ise yok sayılıyor.

Smoke: `rts-building-placement.spec.ts` ayar satırlarını artık indeksle değil
sahip oldukları slider ile buluyor — blok bir satır kazandı ve indeks, kırılan
bir satır için değil, yer değiştiren bir satır için kırmızıya dönerdi.

---

# Faz 3 — Pseudo-localization ve UI dayanıklılığı

**Durum:** tamamlandı (19 Ağustos 2026); kod, browser QA ve kullanıcı görsel kabulü: **OK**.

Doğrulama: `npx tsc --noEmit` temiz, `npm run test:engine` yeşil (1507/1507,
9 slow atlandı). Kabul kriterinin kalan yarısı bir test değil, bir bakış —
aşağıdaki "Kullanıcının yürüyeceği tur"a bakın.

## Amaç

Yeni gerçek diller eklenmeden önce layout problemlerini ortaya çıkarmak.

## Başlarken: hazır olan ne, iş nerede başlıyor

Bu fazın ilk iki kalemi **altyapı olarak zaten duruyor** — Faz 1 yazdı, Faz 3
onları kullandı, yeniden yazmadı:

- `qps-ploc`, `LocalizationDebug.ts` içinde tanımlı ve registry'de `enabled:
  false` (§20: dil seçicide asla görünmez).
- Bundle **kaynak locale'den türetiliyor** (`createPseudoBundle`,
  `LocalizationLoader.ts`), diskteki bir dosyadan değil: bir anahtar eklendiği
  anda pseudo karşılığı da var, yani bayat bir pseudo-locale yanlış layout'u
  test edemez.
- Uzatma `%35`, plan aralığının (`%30–40`) ortası.

Yani Faz 3'ün işi altyapı değil, **`?locale=qps-ploc` ile açıp UI'yi gezmek ve
taşanları düzeltmek**. Dil seçici (§27) bu turu ucuzlattı: pseudo'ya URL'den
girip, bir taşmayı gördükten sonra reload'suz Türkçe/İngilizce'ye dönüp
karşılaştırabilirsiniz.

İki nokta baştan biliniyordu:

- **Ölçüsü olan tek yüzey görev kartıydı.** Faz 2 `title ≤ 40` / `why ≤ 110`
  sınırlarını yayınlanan her dilden okuyan bir engine-test'e bağladı. Geri kalan
  panellerin böyle bir bütçesi yoktu; §15.1 istiyor, kimse ölçmüyordu. Bu faz
  dört yuvaya bütçe koydu (aşağıda).
- **Görsel kabul kullanıcının.** Taşma "kod doğru mu" sorusu değil; CLAUDE.md'nin
  kuralı gereği bu tur için Playwright screenshot-diff süiti kurulmadı,
  ekrana bakılacak.

## Yedi taşma, ve neden ekrana bakmadan bulunabildiler

Faz 3'ün taraması CSS okunarak yapıldı, çünkü aranan şey bir *görüntü* değil bir
*yapı*: metin taşıyan bir kutunun sabit bir genişliği/yüksekliği var mı, ve
taştığında ne oluyor. Bu soruyu kaynak cevaplıyor. Bulunan yedi yerin ortak
özelliği, taşmanın **sessiz** olması — hiçbiri bozuk görünmüyor, hepsi eksik
görünüyor.

RTS UI'sinin çoğu zaten dayanıklıydı (`text-overflow: ellipsis`,
`-webkit-line-clamp`, `minmax(0, 1fr)`, kaydırılan konteynerler). Düzeltilenler:

1. **`.rts-hud-resource-label`** — kaynak adı 136px'lik sabit bir sütunda, ve HUD
   şeridi sabit yükseklikte. Uzun bir ad satır kırıyor, `.rts-hud-resource`'un
   `overflow: hidden`'ı ikinci satırı **harfin ortasından kesiyordu**. Artık tek
   satır + ellipsis.
2. **`.rts-hud-status`** — `flex-shrink: 0` idi. Şerit `nowrap` olduğu için bu
   blok kısalmayı reddettiğinde kendisi taşmıyor, **arkasındaki
   `.rts-hud-utility-controls`'u ekranın dışına itiyordu** — yani duraklat
   düğmesini. 1366px'te "Population: 12/20" şeridin en geniş düzyazısı,
   dolayısıyla uzun bir dilin emileceği yer burası. Artık `flex: 0 1 auto` +
   `min-width: 0` + `overflow: hidden`.
3. **`.rts-objective-bar`** — sütunlar `58px 1fr 34px` idi. Grid öğeleri
   varsayılan `min-width: auto` taşır, yani "Sen 2/3"ten uzun bir etiket
   kırpılmıyor, **çubuğun üstüne çiziliyordu**. Artık
   `minmax(0, max-content) minmax(36px, 1fr) 34px` + etikette ellipsis.
4. **`.rts-build-status`** — `max-height: 1.35em`, yani tam olarak bir satır. Bu
   satırın taşıdığı en uzun dizeler tam cümle ("Geçersiz konum: Taş Ocağı veya
   Altın Madeni uygun kaynak düğümünü örtmeli."); satır kıran bir dil ikinci
   satırı **tamamen kaybediyordu** — ret gösteriliyor, ama çaresini söyleyen
   yarısı yok. Artık iki satır; `min-height` durağan düzeni koruyor.
5. **`.rts-build-choice-label`** — kart `aspect-ratio: 1` + `overflow: hidden`,
   etiket alta hizalı. Dördüncü satıra taşan bir ad kartı büyütmüyor, **kartın
   üstünden çıkıp scrim'in bittiği yerde çıplak illüstrasyonun üzerine
   yazıyordu**. Üç satırda kapatıldı; hizalama `align-content: safe end` ile
   korundu, böylece kırpma ilk satırı değil sonuncuyu alıyor.
6. **`.rts-selection-action-tray .rts-selection-action`** — sabit 156×50px
   kartlar (pazar grid'i bu ölçüye bağlı), `overflow` yoktu: uzun bir fiil
   düğmenin kendi kenarlığını aşıp **altındaki kartın üzerine** basıyordu. Artık
   kırpılıyor, etiket iki satırda kelepçeleniyor, tam metin `title`'da duruyor.
7. **`.rts-match-toggle-state`** — `nowrap`, ama kırpma yok: kartın üçte birlik
   sütununda uzun bir durum kelimesi kendini kısaltmak yerine **anahtarı kendi
   sütunundan itiyordu**.

## Faz 2'den kaçan dört dize daha

§27'nin bulduğu `"Formasyon"` yalnız değilmiş. Faz 2'nin tarayıcısı **anahtar
biçimli literal** arıyor, dolayısıyla `t(...)` içermeyen çıplak bir Türkçe kelime
onun için görünmez:

- `rtsArmyRosterStrip.ts` — şeridin `aria-label`'ı `"Ordu"` → `hud.roster.aria`.
- `rtsNotificationFeed.ts` — canlı bölgenin `aria-label`'ı `"Bildirimler"` →
  `notification.feed.aria`.
- `rtsSelectionPanel.ts` — can çubuğunun `aria-label`'ı `"Can"` →
  `selection.health.aria`.
- `rtsHudBar.ts` — gelir hücresinin tohum değeri `"+0.0/dk"`, yani ilk itmeye
  kadar İngilizce HUD'da duran Türkçe bir oran. Artık aynı desenden
  (`hud.resource.income`) üretiliyor.

İlk üçü `markStaticAria` ile işaretlendi (bir kez yazılan metin), ve şerit ile
bildirim akışı `retranslate()` kazandı — `RtsApp`'in `onLocaleChanged`
aboneliğinden sürülüyorlar.

## §13'ün üçüncü kaçağı: HUD kaynak adları

Daha büyüğü: `.rts-hud-resource-label`'ın metni constructor'da bir kez yazılıyor
ve `resourceCells` yalnız `{amount, income}` tutuyordu — yani **dil
değiştikten sonra "Yiyecek / Odun / Taş / Altın" eski dilde kalıyordu**, HUD'un
geri kalanı çevrilmiş haldeyken. Etiket artık hücreyle birlikte saklanıyor ve
`RtsHudBar.applyStaticText()` içinde yeniden çözülüyor; şeridin kendi
`onLocaleChanged` aboneliği zaten vardı, eksik olan tek şey bu döngüydü.

## Ölçü: `Lokalizasyon Faz 3` engine-test'i

"§15.1 istiyor, kimse ölçmüyor" kalemi kapandı. `tools/engine-tests.ts` içindeki
`UI_TEXT_SLOTS` tablosu, **genişliği CSS'te sabit** dört yuvayı ve her birinin
tuttuğu metni tarif ediyor:

| yuva | genişlik | bütçe |
| --- | --- | --- |
| `.rts-hud-resource-label` | `136 − 26 − 8` px, tek satır, uppercase | ~14 karakter |
| `.rts-build-tab` | `(544 − 48 − 12) / 4 − 10` px, tek satır | ~18 karakter |
| `.rts-selection-formation-label` | `(372 − 30) / 6 − 2` px, tek satır | ~10 karakter |
| `.rts-build-status` | `544 − 48` px, iki satır | ~150 karakter |

Bütçe **yazılmıyor, türetiliyor**: aritmetik CSS'in kendisi, karakter sayısı
`widthPx × lines / (fontPx × AVG_GLYPH_EM)`'den çıkıyor. Bir sütun genişliği
değişirse düzenlenecek şey gerçekten değişen piksel sayısı; bütçe onu takip
ediyor. Hiçbir ifade sabitlenmiyor — yalnız ifadenin ne kadar yeri olduğu.
`AVG_GLYPH_EM` bilerek geniş tarafta (`0.55`): sığan bir etiket için kırmızıya
dönen bir kapı okunmaz, düzenlenip atılır.

Kapının çalıştığı denendi: `"Crescent"` → `"Halbmondformation"` yapıldığında test
dosyayı, anahtarı, karakter sayısını ve yuvanın aritmetiğini adıyla söyleyerek
düştü.

Aynı check pseudo-locale'in **sınırlı** kaldığını da tutuyor: `qps-ploc`'un
yukarıdaki bütçeleri aşması normal (`%35` + `[!! … !!]` çerçevesi zaten amaç),
ama sınırsız büyüseydi bulduğu taşma hiçbir gerçek dilin yaşamayacağı bir taşma
olurdu — yani hiçbir şey kanıtlamazdı.

## Kullanıcının yürüyeceği tur

Kabul kriterinin kalan yarısı. Tarayıcıyı **1366×768**'e getirin ve
`http://127.0.0.1:5173/?locale=qps-ploc` ile açın. Her metin
`[!! Àççèñţèð ẍẍẍ !!]` biçiminde, yani hepsi ~%35 uzun.

1. **Ana menü** — başlık, mod kartları, üç ayar sütunu, alttaki dil seçici. Savaş
   sisi anahtarının durum kelimesi kendi sütununda kalıyor mu.
2. **Maça girin, HUD şeridi** — dört kaynak adı tek satırda ellipsis'le bitiyor
   mu, sağ uçtaki duraklat düğmesi ekranda mı.
3. **Yapı paleti** — dört sekme, kart adları (üç satırda kapanmalı,
   illüstrasyonun üstüne taşmamalı), bir yapı kuşanın: durum satırı iki satıra
   çıkabiliyor mu, bir ret mesajı (kaynak yetersizken) tam okunuyor mu.
4. **Yol modu** — yol ipucu satırı (üç satır bütçesi var).
5. **Seçim paneli** — bir birim, bir grup (formasyon kartları), bir üretim yapısı
   (chip'ler + ilerleme çubuğu), Merkez (ayrık komut tepsisi: 156×50px kartlar),
   Pazar (2×3 komut grid'i).
6. **Bildirim kartları** — bir yapı bitirin ya da bir yolu kesin.
7. **Görev takipçisi / misyon kartı** — sağ üst; ilerleme çubuğunun etiketi
   çubuğun üstüne binmiyor mu.
8. **Duraklat kartı** — ayarlar satırları ve dil seçici. Buradan reload'suz
   `Türkçe`'ye dönün: HUD kaynak adları, palet sekmeleri, seçim paneli ve açık
   olan kategori aynı anda dönmeli.
9. Sonra tarayıcıyı daraltıp `1180px` ve `840px` breakpoint'lerini geçin — şerit
   sırasıyla kaynak etiketlerini gizliyor, sonra iki satıra geçiyor.

## Görevler

- [x] pseudo-locale oluştur — Faz 1 (`PSEUDO_LOCALE`, `qps-ploc`)
- [x] metinleri yaklaşık `%30–40` uzat — Faz 1 (`pseudoLocalize`, `%35`)
- [x] buton overflow'larını düzelt — komut tepsisi, yapı kartı, palet sekmesi
- [x] bildirim kartlarını doğrula — grid'i zaten `minmax(0, 1fr)`, kart dikey
      büyüyor; düzeltilen tek şey `aria-label`'ı oldu
- [x] seçim paneli taşmalarını doğrula — başlık/chip/formasyon/kart etiketleri
      zaten kelepçeliydi; açık olan tek yer ayrık komut tepsisiydi
- [x] 1366×768 minimum çalışma çözünürlüğünü test et — `.rts-hud-status`'un
      duraklat düğmesini ittiği yer burasıydı; yuva bütçeleri de bu genişlikten
      ölçüldü
- [x] bütün ana UI ekranlarını gez — kullanıcı görsel kabulü: OK
- [x] tooltip wrapping'i doğrula — kullanıcı görsel kabulü: OK
- [x] responsive breakpoint'leri gez — `qps-ploc` ile `1180px` ve `840px`
      browser turu; 840px bildirim/görev kartı çakışması düzeltildi ve smoke
      testi yatay taşma olmadığını doğruluyor

## Kabul kriteri

Pseudo-localization ile temel UI'da kritik clipping veya okunamaz taşma
bulunmamalıdır.

## Devredilenler

- 19 Ağustos 2026 otomatik pseudo-locale turu, `840px`te merkezdeki bildirim
  akışının görev kartının altına girdiğini buldu. `src/style.css`, bu breakpoint'te
  akışı sol kolona alıyor; `tests/smoke/rts-localization-pseudo.spec.ts` hem
  kutuların çakışmadığını hem yatay sayfa taşması olmadığını doğruluyor. Aynı tur,
  üç satırda kısaltılan yapı kartlarının `title` tooltip'i olmadığını da buldu;
  kartlar ve seçim komutları artık tam, aktif locale metnini tooltip'te tutuyor.
  Bu otomatik/browser kanıtı, kullanıcı tarafından verilen ana UI turu ve
  tarayıcının yerel tooltip balonu görsel kabulüyle tamamlandı: OK.
- Turda bulunan her taşma buraya, düzeltmesiyle birlikte yazılacak.
- `.rts-selection-body`'nin iki satırlık grid'i
  (`grid-template-rows: repeat(2, max-content)`) hâlâ dört satırlık bir bütçe:
  pseudo'da satırlar kırıldığında kırpılır. Kasıtlı olarak dokunulmadı — panel
  yüksekliği `rts-building-placement.spec.ts`'in tıklama noktasını türettiği
  ölçü, ve düzeltmesi `describeSelection`'ın satır sayısını azaltmak, CSS değil.
  Turda okunaksız çıkarsa orada ele alınacak.
- `[data-rts-action-layout="single"]` yıkım düğmesi 20px'lik bir satırda
  `overflow: visible` ile duruyor. Bilerek bırakıldı (kısa tek kelime), ama uzun
  bir dilde panel çerçevesinin dışına yazabilir.

---

# Faz 4 — Tier 1 Batı dilleri

## Hedef diller

1. German — `de`
2. French — `fr`
3. Spanish — `es-ES`
4. Portuguese — Brazil — `pt-BR`

## Amaç

Latin alfabeli genişleme dillerini eklemek ve üretim hattını doğrulamak.

**Durum (20 Ağustos 2026):** Almanca (`de`) tamamlandı ve seçilebilir. On
domainin tamamı (`common`, `menu`, `buildings`, `units`, `match`, `hud`,
`errors`, `notifications`, `objectives`, `selection`) İngilizce kaynak
anahtar/placeholder eşliğiyle yüklendi; `localeRegistry.ts` içindeki `de`
`enabled: true` oldu. `build:verify` yeşil (1517 engine check) ve Chromium
smoke, menüdeki `Deutsch` seçimini, Türkçe ↔ Almanca canlı değişimi ve maç içi
ayarlar seçicisini doğruluyor. **Kullanıcı görsel kabulü: OK** — seçim paneli
ve bildirim akışı dahil ana UI turu kabul edildi; bu, otomatik kanıttan ayrı
kayıttır.

Fransızca (`fr`) tamamlandı ve seçilebilir. On domainin tamamı kaynak
anahtar/placeholder eşliğiyle doğrulandı (624/624); `localeRegistry.ts`
içindeki `fr` `enabled: true` oldu. Chromium smoke, menüdeki `Français`
seçimini ve maç içi ayarlar seçicisini doğruluyor. **Kullanıcı görsel kabulü:
OK**; full-match smoke ayrı bir otomasyon kapısı olarak açıktır.

İspanyolca — İspanya (`es-ES`) tamamlandı ve seçilebilir. On domainin tamamı
kaynak anahtar/placeholder eşliğiyle doğrulandı (624/624); `localeRegistry.ts`
içindeki `es-ES` `enabled: true` oldu. Chromium smoke, menüdeki
`Español (España)` seçimini, İspanyolca maç başlangıcını ve maç içi ayarlar
seçicisini doğruluyor. Kullanıcı görsel kabulü ile full-match smoke, teknik
otomasyon kanıtından ayrı açık kapılardır.

## Her dil için checklist

- [x] locale registry kaydı
- [x] çeviri dosyaları
- [x] glossary kontrolü
- [x] placeholder validator
- [x] number formatting
- [x] font glyph testi
- [x] HUD testi
- [x] build palette testi
- [x] selection panel testi — kullanıcı görsel kabulü
- [x] notifications testi — kullanıcı görsel kabulü
- [x] match modal testi
- [ ] full-match smoke testi

---

# Faz 5 — Russian

## Amaç

Cyrillic ve daha karmaşık çoğul kurallarını doğrulamak.

## Özel kontroller

- [ ] Cyrillic glyph kapsamı
- [ ] Russian plural categories
- [ ] uzun metin UI testi
- [ ] uppercase/lowercase davranışı
- [ ] font weight okunabilirliği
- [ ] sayı formatı

## Kabul kriteri

Rusça, İngilizce fallback'e görünür şekilde düşmeden tam maç boyunca kullanılabilmelidir.

---

# Faz 6 — Simplified Chinese

## Amaç

İlk CJK dilini ekleyerek font ve layout hattını doğrulamak.

## Özel kontroller

- [ ] CJK web font yükleme
- [ ] font bundle boyutu
- [ ] line-height
- [ ] line-break
- [ ] tooltip wrapping
- [ ] bildirim kartı
- [ ] küçük HUD font okunabilirliği
- [ ] UI ile font görsel uyumu

## Kabul kriteri

`zh-CN` tüm Tier 1 kapsamını fallback kullanmadan tamamlamalıdır.

---

# Faz 7 — Tier 1 release gate

## Hedef

Toplam sekiz dil:

```text
en
tr
zh-CN
ru
es-ES
pt-BR
de
fr
```

## Release checklist

- [ ] bütün Tier 1 locale dosyaları parse oluyor
- [ ] missing key = 0
- [ ] placeholder mismatch = 0
- [ ] unsupported glyph = 0
- [ ] kritik UI overflow = 0
- [ ] locale switch testi geçiyor
- [ ] saved locale preference testi geçiyor
- [ ] full match başlangıç → sonuç ekranı testi tamam
- [ ] victory/defeat ekranları test edildi
- [ ] locale validator CI/build gate'e bağlı

---

# Faz 8 — Tier 2 genişleme

Önerilen sıra:

1. Japanese — `ja`
2. Polish — `pl`
3. Korean — `ko`
4. Traditional Chinese — `zh-TW`
5. Spanish — Latin America — `es-419`
6. Italian — `it`

Her dil Tier 1 ile aynı teknik kalite kapılarından geçmelidir.

---

# Faz 9 — Sürekli lokalizasyon bakımı

Lokalizasyon tek seferlik tamamlanan iş değildir.

Her yeni gameplay özelliği şu akışı izlemelidir:

```text
Yeni özellik
→ localization key tanımları
→ English source text
→ Turkish text
→ glossary kontrolü
→ Tier 1 translation
→ validator
→ UI QA
→ feature release
```

Yeni bir özellik İngilizce ve Türkçe localization key'leri olmadan tamamlanmış kabul edilmemelidir.

Tier 1 dillerin güncellenmesi feature release stratejisine göre aynı PR içinde veya kontrollü lokalizasyon batch'i olarak yapılabilir.

---

# 22. Dil bazlı QA matrisi

| Dil grubu | Ana risk | Zorunlu test |
|---|---|---|
| English | Kaynak metin kalitesi | Terminoloji ve source review |
| Turkish | `İ/ı`, ekler, kelime sırası | Glyph + UI + terminoloji |
| German | Uzun birleşik kelimeler | Overflow ve buton genişliği |
| French | Metin genişlemesi | Tooltip ve button layout |
| Spanish | Metin genişlemesi | HUD ve açıklamalar |
| pt-BR | Locale ve terim farkları | Sayı + terminoloji |
| Russian | Cyrillic + plural | Font + plural + overflow |
| zh-CN | CJK glyph + line break | Font + wrapping |
| Japanese | Font + yoğun bilgi | Font + line-height |
| Korean | Font + satır yüksekliği | Glyph + wrapping |
| zh-TW | Ayrı terminoloji | Font + glossary |
| Polish | Diacritics + plural | Glyph + plural + overflow |

---

# 23. Test senaryoları

Her desteklenen dil en az aşağıdaki ekranlarda doğrulanmalıdır:

1. Başlangıç modalı
2. Ana HUD
3. Yapı paleti
4. Geçersiz yapı yerleştirme
5. Tek işçi seçimi
6. Karışık ordu seçimi
7. Merkez seçimi
8. Üretim veya yükseltme sürerken seçim paneli
9. Lojistik kesildi bildirimi
10. Nüfus dolu bildirimi
11. Karakol saldırı bildirimi
12. Görev / bölgesel zafer paneli
13. Pause ekranı
14. Zafer ekranı
15. Yenilgi ekranı

### Full-match QA

En az bir kez:

```text
başlangıç
→ ekonomi kur
→ yapı kur
→ birlik üret
→ çağ atla
→ lojistik kesintisi gör
→ saldırı bildirimi gör
→ zafer veya yenilgi
```

akışı ilgili locale ile tamamlanmalıdır.

---

# 24. Otomasyon ve build gate önerisi

Mevcut proje test kapılarına lokalizasyon doğrulaması eklenmelidir.

Önerilen sıra:

```bash
npx tsc --noEmit
npm run test:locales
npm run test:engine
npm run build:verify
```

Önerilen script:

```text
npm run test:locales
```

şunları çalıştırmalıdır:

- locale schema doğrulama,
- key parity,
- placeholder parity,
- JSON parse,
- Tier 1 completeness.

Playwright smoke testlerine en az:

- `en`,
- `tr`,
- `de`,
- `ru`,
- `zh-CN`

örnek locale rotaları eklenmesi faydalıdır.

Bütün dilleri her commit'te tam browser testinden geçirmek zorunlu değildir; validator her commit'te, tam locale matrisi release veya nightly koşusunda çalışabilir.

---

# 25. Lokalizasyon veri sürümleme

Locale dosyaları oyun koduyla aynı source control içinde tutulmalıdır.

Her büyük çeviri dalgasında değişiklikler izlenebilir olmalıdır.

Önerilen changelog:

```text
GDD/LOCALIZATION_CHANGELOG.md
```

Kayıt örneği:

```text
2026-08-XX
- Added de Tier 1 translation
- Revised "Outpost" terminology
- Fixed logistics notification placeholder
- Added missing Barracks upgrade tooltip
```

---

# 26. Çeviri kabul statüleri

Her locale veya domain aşağıdaki durumlardan birine sahip olabilir:

```text
not_started
machine_draft
reviewed
ui_tested
approved
```

Release destekli dil için minimum:

```text
reviewed + ui_tested
```

olmalıdır.

`machine_draft` durumundaki dil mağazada tam destekli olarak ilan edilmemelidir.

---

# 27. Dil seçimi UI'sı

İlk teknik lokalizasyon fazında basit bir dil seçici yeterlidir.

Kurallar:

- dil adı kendi dilinde gösterilir,
- oyuncunun mevcut dilinden bağımsız anlaşılabilir olmalıdır.

Örnek:

```text
English
Türkçe
Deutsch
Français
Español
Português (Brasil)
Русский
简体中文
```

Bayraklar dil seçimi için ana gösterge olarak kullanılmamalıdır; tek dil birden fazla ülkeyi temsil edebilir.

---

# 28. Erişilebilirlik ve lokalizasyon

Lokalizasyon UI'yı yalnız görsel olarak değil erişilebilirlik açısından da etkiler.

Kontrol edilmesi gerekenler:

- tooltip ve aria-label gibi erişilebilir metinler de localization key kullanmalı,
- yalnız ikonla verilen kritik komutlarda lokalize tooltip bulunmalı,
- renk tek başına durum anlamı taşımamalı,
- locale değiştiğinde erişilebilir isimler de güncellenmeli.

---

# 29. Kapsam koruma kuralları

Lokalizasyon süreci yeni gameplay kapsamı icat etmemelidir.

Şimdilik çevrilmemelidir:

- üçüncü çağın uygulanmamış içerikleri,
- minimap sistemleri,
- süvari,
- eski Koçbaşı referansları,
- runtime'da bulunmayan UI slotları,
- yapılmamış tam görev checklist'i.

Üçüncü çağ ileride gerçekten üretime girdiğinde yeni localization domain/key'leri normal feature pipeline'ı üzerinden eklenir.

---

# 30. Definition of Done — Lokalizasyon sistemi

Lokalizasyon altyapısı tamamlanmış sayılmak için (durum: 19 Ağustos 2026,
Faz 0–2 + §27 sonrası):

- [x] bütün oyuncu metinleri localization key üzerinden geliyor
- [x] English teknik source/fallback olarak çalışıyor
- [x] Turkish tam geliştirme dili olarak çalışıyor
- [x] runtime locale switch çalışıyor
- [x] locale preference saklanıyor
- [x] browser locale detection çalışıyor
- [x] missing key sistemi bulunuyor
- [x] parametreli mesaj sistemi bulunuyor
- [x] plural sistem locale-aware
- [x] number formatting locale-aware
- [ ] font registry locale-aware
- [x] pseudo-localization bulunuyor
- [ ] locale validator bulunuyor
- [x] CI/build localization gate bulunuyor
- [x] terminoloji sözlüğü bulunuyor
- [ ] yeni feature localization prosedürü tanımlı

Açık kalan dördünün neden açık olduğu:

- **font registry locale-aware** — `LocaleDescriptor.fontGroup` tanımlı ama
  hiçbir yerde *okunmuyor*: `latin` / `cyrillic` / `cjk` ayrımı bugün yalnız bir
  kayıt. Gerçek işi Faz 5 (Russian) ve Faz 6 (Simplified Chinese) getirecek —
  §14 zaten oraya bağlı, çünkü yüklenecek font olmadan gruplamanın karşılığı yok.
- **locale validator** — §19'un `tools/validate-locales.ts`'i hâlâ ayrı bir araç
  değil. Karşılığı `tools/engine-tests.ts` içindeki iki kontrol (klasör/anahtar/
  placeholder eşliği + veri dosyalarının `nameKey`'leri); yaptığı işi yapıyor,
  ama tek başına çalıştırılabilir bir çevirmen aracı değil.
- **CI/build gate** işaretli, çünkü o iki kontrol `build:verify` ve CI'nın
  koştuğu süitin içinde — eksik anahtar `main`'e giremiyor.
- **yeni feature prosedürü** — bu belge fazları tanımlıyor, "yeni bir yapı/birim
  eklerken lokalizasyon adımları şunlar" diyen bir bölümü yok. Faz 9'un (sürekli
  bakım) yazacağı şey.
- **"bütün oyuncu metinleri"** işaretli ama kapsam §6.1'in çizdiği yerde:
  debug yüzeyleri (`aiDebugView`, `formatVisionDebug`, `rtsSimulationWitness`,
  perf bölge adları) kasten Türkçe. Ayrıca §27 turu Faz 2'nin taramasından kaçan
  bir dize buldu (`"Formasyon"`) — tarayıcı anahtar biçimli literal arıyor,
  Türkçe cümle değil, yani bu sınıf hata sessiz kalabiliyor.

---

# 31. Definition of Done — Yeni bir dil

Bir dil “destekleniyor” kabul edilmeden önce:

- [ ] locale registry kaydı var
- [ ] bütün Tier kapsamı çevrilmiş
- [ ] missing key = 0
- [ ] placeholder mismatch = 0
- [ ] boş string = 0
- [ ] font glyph sorunu = 0
- [ ] sayı biçimi test edilmiş
- [ ] plural test edilmiş
- [ ] HUD test edilmiş
- [ ] yapı paleti test edilmiş
- [ ] seçim paneli test edilmiş
- [ ] bildirimler test edilmiş
- [ ] modal ekranlar test edilmiş
- [ ] en az bir full-match smoke testi yapılmış
- [ ] glossary review tamamlanmış
- [ ] locale statüsü `approved`

---

# 32. İlk uygulama sprinti

İlk gerçek geliştirme işi yalnızca **Faz 0–2** olmalıdır.

### Sprint hedefi

Oyunun İngilizce ve Türkçe arasında tamamen localization sistemi üzerinden geçiş yapabilmesi.

### Önerilen sıra

```text
1. String inventory
2. LocalizationService
3. Locale registry
4. en/tr dosya iskeleti
5. Match modal migration
6. HUD migration
7. Notifications migration
8. Build palette migration
9. Selection panel migration
10. Gameplay data nameKey migration
11. Validator
12. Pseudo-locale
```

Tier 1 çevirileri bu temel sistem gerçek oyun içinde doğrulanmadan başlatılmamalıdır.

---

# 33. Önerilen proje dosyaları

Plan tamamlandığında aşağıdaki yapı hedeflenebilir:

```text
src/game/localization/
  LocalizationService.ts
  LocalizationLoader.ts
  LocalizationFormatter.ts
  LocalizationTypes.ts
  LocalizationDebug.ts
  localeRegistry.ts

public/game-data/locales/
  en/
  tr/
  de/
  fr/
  es-ES/
  pt-BR/
  ru/
  zh-CN/

GDD/
  THREEAGES_LOCALIZATION_ARCHITECTURE_AND_PRODUCTION_PLAN.md
  LOCALIZATION_GLOSSARY.md
  LOCALIZATION_STRING_INVENTORY.md
  LOCALIZATION_CHANGELOG.md

tools/
  validate-locales.ts
```

Tier 2 locale klasörleri gerçek üretim başlamadan boş placeholder olarak oluşturulmamalıdır.

---

# 34. Son karar özeti

**Üç Çağ: Sınır Krallıkları** için önerilen lokalizasyon yaklaşımı:

### Teknik temel

```text
English = source of truth + fallback
Turkish = full development language
Stable gameplay IDs ≠ visible text
All visible text → localization keys
```

### Dil planı

**Geliştirme:**

```text
EN + TR
```

**Tier 1 / ilk geniş sürüm:**

```text
EN
TR
ZH-CN
RU
ES-ES
PT-BR
DE
FR
```

Toplam: **8 dil**

**Tier 2:**

```text
JA
PL
KO
ZH-TW
ES-419
IT
```

Toplam Tier 1 + Tier 2: **14 dil**

### Üretim sırası

```text
Envanter
→ Teknik altyapı
→ EN/TR migrasyonu
→ Pseudo-localization
→ DE/FR/ES/PT-BR
→ RU
→ ZH-CN
→ Tier 1 release gate
→ Tier 2 talebe göre
```

### Temel kalite ilkesi

> Bir dilin JSON dosyasının bulunması, o dilin desteklendiği anlamına gelmez. Bir dil ancak terminoloji kontrolü, teknik validator, UI testi ve oyun içi smoke test tamamlandıktan sonra desteklenen dil olarak ilan edilir.

Bu yaklaşım başlangıçtaki geliştirme yükünü sınırlı tutarken, oyunun ileride 14 veya daha fazla dile genişlemesini mimari değişiklik gerektirmeden mümkün kılar.
