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

- [ ] `LocalizationService` oluştur
- [ ] locale registry oluştur
- [ ] locale loader oluştur
- [ ] `en` fallback uygula
- [ ] locale preference saklama mekanizması ekle
- [ ] browser locale detection ekle
- [ ] runtime `setLocale()` akışını kur
- [ ] `localeChanged` event'i ekle
- [ ] missing-key debug davranışını ekle
- [ ] `Intl.NumberFormat` ortak formatter ekle
- [ ] plural/message format yaklaşımını belirle

## Kabul kriterleri

- [ ] `en` ve `tr` arasında sayfa yenilemeden geçiş yapılabiliyor
- [ ] eksik `tr` key'i `en` değerine düşüyor
- [ ] eksik `en` key'i debug'da açıkça görünüyor
- [ ] locale tercihi yeniden açılışta korunuyor
- [ ] TypeScript kontrolü geçiyor

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

- [ ] `en` domain JSON dosyalarını doldur
- [ ] `tr` domain JSON dosyalarını doldur
- [ ] hardcoded UI stringlerini kaldır
- [ ] gameplay data → localization key bağlantısını kur
- [ ] string concatenation kullanan mesajları parametreli sisteme taşı
- [ ] tekrar eden metinleri tek anahtarda birleştir
- [ ] terminoloji sözlüğünü oluştur

## Kabul kriterleri

- [ ] oyun İngilizce baştan sona oynanabiliyor
- [ ] oyun Türkçe baştan sona oynanabiliyor
- [ ] oyuncuya görünen hardcoded gameplay UI metni kalmamış
- [ ] missing key = 0
- [ ] placeholder mismatch = 0

---

# Faz 3 — Pseudo-localization ve UI dayanıklılığı

## Amaç

Yeni gerçek diller eklenmeden önce layout problemlerini ortaya çıkarmak.

## Görevler

- [ ] pseudo-locale oluştur
- [ ] metinleri yaklaşık `%30–40` uzat
- [ ] bütün ana UI ekranlarını test et
- [ ] buton overflow'larını düzelt
- [ ] tooltip wrapping'i doğrula
- [ ] bildirim kartlarını doğrula
- [ ] seçim paneli taşmalarını doğrula
- [ ] 1366×768 minimum çalışma çözünürlüğünü test et
- [ ] responsive breakpoint'leri test et

## Kabul kriteri

Pseudo-localization ile temel UI'da kritik clipping veya okunamaz taşma bulunmamalıdır.

---

# Faz 4 — Tier 1 Batı dilleri

## Hedef diller

1. German — `de`
2. French — `fr`
3. Spanish — `es-ES`
4. Portuguese — Brazil — `pt-BR`

## Amaç

Latin alfabeli genişleme dillerini eklemek ve üretim hattını doğrulamak.

## Her dil için checklist

- [ ] locale registry kaydı
- [ ] çeviri dosyaları
- [ ] glossary kontrolü
- [ ] placeholder validator
- [ ] number formatting
- [ ] font glyph testi
- [ ] HUD testi
- [ ] build palette testi
- [ ] selection panel testi
- [ ] notifications testi
- [ ] match modal testi
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

Lokalizasyon altyapısı tamamlanmış sayılmak için:

- [ ] bütün oyuncu metinleri localization key üzerinden geliyor
- [ ] English teknik source/fallback olarak çalışıyor
- [ ] Turkish tam geliştirme dili olarak çalışıyor
- [ ] runtime locale switch çalışıyor
- [ ] locale preference saklanıyor
- [ ] browser locale detection çalışıyor
- [ ] missing key sistemi bulunuyor
- [ ] parametreli mesaj sistemi bulunuyor
- [ ] plural sistem locale-aware
- [ ] number formatting locale-aware
- [ ] font registry locale-aware
- [ ] pseudo-localization bulunuyor
- [ ] locale validator bulunuyor
- [ ] CI/build localization gate bulunuyor
- [ ] terminoloji sözlüğü bulunuyor
- [ ] yeni feature localization prosedürü tanımlı

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
