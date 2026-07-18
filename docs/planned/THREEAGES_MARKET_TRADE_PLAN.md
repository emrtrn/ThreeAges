# ThreeAges Market ve Arz-Talep Ticaret Sistemi - Analiz Raporu

Olusturulma tarihi: 2026-07-18
Durum: Analiz - uygulama baslamadi
Kapsam: Yeni `market` binasi; altin karsiligi yiyecek/odun/tas alim-satimi;
AoE tarzi arz-talep fiyatlandirmasi (alim fiyati yukseltir, satim dusurur).

## 1. Ozet ve Oneri

Mekanik oyuna **uyuyor ve gercek bir darbogazi cozuyor**. Onerilen v1:

- Yeni `market` binasi (sanat hazir, gameplay tarafi sifirdan).
- **Altin numeraire (olcu birimi)**: yiyecek/odun/tas altina karsi alinip satilir.
  Altinin kendi fiyati yoktur; "altin degersizlesti" ifadesi modelde *diger tum
  fiyatlarin yukselmesi* olarak temsil edilir. Bu, kullanicinin tarif ettigi
  davranisin ta kendisidir ve ayri bir altin fiyati tutmaya gerek birakmaz.
- Sabit **100 birimlik lot** ticareti (AoE2 gibi), 6 buton: 3 al / 3 sat.
- Her kaynak icin bir **fiyat endeksi**; alim endeksi yukseltir, satim dusurur.
- **Komisyon (spread)** ile anlik al-sat her zaman zarar ettirir - bu olmadan
  sistem sonsuz para basar (bkz. §4.3, arbitraj invaryanti).
- Market **seviyeleri komisyonu dusurur** (Lv1 %15 -> Lv2 %12 -> Lv3 %9), boylece
  mevcut per-bina seviye sistemi markete dogal bir anlam kazandirir.

## 2. Mevcut Durum - Bulgular

### 2.1 Sanat tamamen hazir (is yuku sifir)

Arsivde 6 model var ve **hepsi manifest'e kayitli**:

```text
Market_FirstAge_Level1/2/3.gltf
Market_SecondAge_Level1/2/3.gltf
```

Isimlendirme mevcut `{TabanAd}_{AgeAilesi}_Level{n}.gltf` sablonuna birebir uyuyor,
yani `rtsBuildingArt.ts` icinde **tek satirlik** bir ekleme yeterli:

```ts
market: { kind: "aged", basename: (f, l) => `Market_${f}_Level${l}` },
```

Cag atlama (FirstAge -> SecondAge) ve per-bina seviye gorsel yenilemesi bedavaya
gelir - Faz 0-4'te kurulan mekanizma marketi de otomatik kapsar.

### 2.2 Altin ekonomisi gercekten dar

| | Deger |
| --- | --- |
| Altin kaynagi | Yalniz `gold_mine`, `requiresResourceNode: true` |
| Tavan uretim | 3 isci x 3/dk = **9 altin/dk** |
| Altin giderleri | Kusatma birimi 60, Kasaba Cagi 150 |
| Baslangic stogu | food 500, wood 500, **stone 0, gold 0** |

Bu bir teori degil, olculmus bir darbogaz: Faz 3 dogrulamasi sirasinda oyunda
bina seviyesi yukseltilemedi, cunku **her Lv2 maliyeti tas iceriyor ve acilis
stogunda tas yok**; tasa ulasmak ocak + depo + yol zinciri gerektiriyor. Market,
elde bolca bulunan odun/yiyecegi tas ve altina cevirerek bu acilisi acar.

### 2.3 Entegrasyon noktalari temiz

- `structureDetail()` (RtsApp) zaten bina tipine gore dallanan bir dispatch -
  `market` dali mevcut desene oturur.
- `SelectionAction` sistemi 6 al/sat butonunu tasiyabilir; buton metni, maliyeti
  ve reddedilme gerekcesi `test:engine` altinda tutulabilir.
- `RtsBuildPalette` kategorileri **elle yazili**; market'e bilincli bir kategori
  verilmezse "Diger"e duser (kaybolmaz ama editoryal bir karar atlanmis olur).
- Balance verisi `validateGameData.ts` uzerinden okunuyor; **`tools/saveValidator.ts`
  bu isten etkilenmez** (o allowlist layout/skeleton/effect kayitlari icindir).

### 2.4 Dikkat: cuzdanin gelir istatistigi kirlenir

`ResourceWallet.credit()` her artisi `incomeSamples`'a yaziyor ve bu dogrudan
HUD'daki `+X/dk` gelir gostergesini besliyor. Ticaretle alinan 100 odun `credit`
ile yazilirsa **HUD odun uretimini uretilmemis odunla sisirir** - oyuncuya yalan
soyleyen bir sayac olur. Cozum: `ResourceChangeKind`'a `"trade"` eklemek ve
ticaret akisini `incomeSamples`'a yazmayan ayri bir yoldan gecirmek.

## 3. Neden Bu Mekanik Degerli

- **Acilis kilidini acar**: tas/altin dugumu bulamayan ya da kaybeden oyuncu
  oyun disi kalmaz; fazla odununu donusturur.
- **Karar uretir**: "simdi mi satayim, fiyat toparlansin mi?" AoE'de marketi
  ilginc yapan sey budur.
- **Mevcut seviye sistemine anlam katar**: komisyon dususu, seviye atlamanin
  somut ve olculebilir bir kazanimidir (Faz 3'te eklenen kazanim satirinda
  dogrudan gosterilebilir).
- **Kaybi cezalandirir**: kontrol alani disinda kalan market ticaret yapamaz.

## 4. Fiyat Modeli

### 4.1 Durum

Ticarete acik her kaynak (`food`, `wood`, `stone`) icin tek bir sayi:

```text
priceIndex[r]  // 1.0'da baslar, [indexMin, indexMax] araliginda kirpilir
```

Altin numeraire oldugu icin `priceIndex[gold]` yoktur.

### 4.2 Islemler (lot = 100 birim)

```text
alisFiyati(r)  = round(basePrice[r] * priceIndex[r] * (1 + commission))
satisFiyati(r) = round(basePrice[r] * priceIndex[r] * (1 - commission))

AL(r):  altin -= alisFiyati(r);  r += 100;  priceIndex[r] += step
SAT(r): r -= 100;  altin += satisFiyati(r); priceIndex[r] -= step
```

`commission` market seviyesinden gelir; `basePrice`, `step`, `indexMin/Max`
balance verisinden.

Onerilen baslangic degerleri:

| Parametre | Deger |
| --- | --- |
| `basePrice` (her kaynak) | 100 altin / 100 birim |
| `step` | 0.02 |
| `indexMin / indexMax` | 0.30 / 4.00 |
| `commission` | Lv1 %15, Lv2 %12, Lv3 %9 |

### 4.3 Arbitraj invaryanti (kritik)

Komisyon yeterince buyuk olmazsa al-sat dongusu **bedava altin uretir**. Anlik
gidis-donusun her zaman zarar etmesi icin gereken kosul:

```text
Al sonra sat:  kar = base * [ step*(1 - c) - 2*i*c ]
Sat sonra al:  kar = base * [ step*(1 + c) - 2*i*c ]
```

Ikisinin de negatif olmasi icin **en kotu durumda** (`i = indexMin`):

```text
step * (1 + c)  <  2 * indexMin * c
```

Onerilen degerlerle: `0.02 * 1.15 = 0.023` < `2 * 0.30 * 0.15 = 0.090` ✅
(yaklasik 4x guvenlik payi). Bu esitsizlik **bir engine testi olarak yazilmali**;
balance degerleri degistiginde sessizce bozulmamali.

### 4.4 Kullanicinin tarif ettigi davranis

> "surekli altin verip odun aliyorsam altinin degeri duser odunun degeri artar"

Model bunu birebir verir: her odun alimi `priceIndex[wood] += 0.02`. 10 lot
odun alan oyuncu endeksi 1.0 -> 1.20'ye tasir; odunun altin cinsinden fiyati
%20 artar, yani ayni altin daha az odun alir - "altin degersizlesti" ifadesinin
numeraire modelindeki tam karsiligi.

## 5. Kilit Kararlar

- **KR-M1 - Altin numeraire.** Yalniz 3 kaynak ticarete acilir; altin fiyat
  tutmaz. Alternatif (her cifte ayri kur) hem UI'yi hem modeli 3 katina cikarir.
- **KR-M2 - Fiyatlar krallik basina (v1).** AoE2'de fiyatlar tum oyuncular
  arasinda **ortaktir**. v1'de AI ticaret yapmayacagi icin ortak fiyatin pratik
  farki yok; krallik basina tutmak deterministik ve izole. Fiyat tablosu
  `Kingdom` sahipliginde tutulursa, ileride ortak fiyata gecmek sahiplik
  degisikligi kadar kalir.
- **KR-M3 - Sabit 100'luk lot.** Kaydirmali miktar secici UI'yi buyutur; AoE2
  de sabit lot kullanir. (Shift ile 5x lot sonraki faza birakilabilir.)
- **KR-M4 - Lojistik degil, kontrol sarti.** Market yol/depo agina baglanmaz -
  ticaret global stok uzerinde soyut bir islemdir. Ancak **kontrol alani disinda
  kalan market ticaret yapamaz** (Kisla ile ayni kural), boylece kusatma anlamli.
- **KR-M5 - Cag kapisi yok.** KR-04 ile tutarli: market Yerlesim caginda da
  kurulabilir; zaten en cok orada gerekli.
- **KR-M6 - AI v1'de ticaret yapmaz.** Regresyon riski sifir. v2'de AI'nin
  mevcut `incomeTargetsPerMinute` acigini (`stone: 10`, `gold: 6`) kapatmak icin
  `AiTradeManager` eklenebilir - `AiUpgradeManager`'in "reddedilme cevabina gore
  davran" desenini aynen izleyerek.

## 6. Dosya Bazli Degisiklikler

| Dosya | Degisiklik |
| --- | --- |
| `public/game-data/balance/buildings.json` | Yeni `market` girisi: cost, footprint, maxHealth, `levels` (Lv2/Lv3 + komisyon), yeni `market` blogu (basePrices, lotSize, step, indexMin/Max, commission) |
| `src/game/data/gameDataTypes.ts` | `MarketBalance` tipi + `market?: MarketBalance`; `BuildingLevelBalance`'a `tradeCommission?` |
| `src/game/data/validateGameData.ts` | `market` blogu icin dogrulama (mevcut `economy` blogu deseni) + arbitraj invaryanti kontrolu |
| `src/game/rts/structures/rtsBuildingArt.ts` | Tek satir: `market` -> `Market_{family}_Level{n}` |
| **YENI** `src/game/rts/economy/marketTradeSystem.ts` | Saf fiyat durumu + `buy`/`sell` + `snapshot`; Three.js bagimsiz, dogrudan test edilebilir |
| `src/game/rts/economy/resourceWallet.ts` | `"trade"` degisim turu; ticaret girisi `incomeSamples`'a yazmaz (§2.4) |
| `src/game/rts/ui/rtsSelectionView.ts` | `MarketDetailView` + 6 al/sat aksiyonu + fiyat/endeks satirlari |
| `src/game/rts/RtsApp.ts` | Sistemi bagla, `structureDetail` market dali, aksiyon handler'lari + mesajlar |
| `src/game/rts/ui/rtsBuildPalette.ts` | Market'i bilincli bir kategoriye koy ("Ekonomi" ya da yeni "Ticaret") |
| `tools/engine-tests.ts` | Fiyat merdiveni, kirpma, yuvarlama, **arbitraj invaryanti**, panel metinleri |

`tools/saveValidator.ts` **etkilenmez** (§2.3).

## 7. Onerilen Fazlar

- **Faz M0 - Veri sozlesmesi ve saf model. - TAMAMLANDI**
  - [x] `MarketBalance` tipi (`gameDataTypes.ts`) + `market?: MarketBalance`.
  - [x] `validateMarketBalance` (`validateGameData.ts`): sekil dogrulamasi,
        `gold` numeraire yasagi, ve **arbitraj invaryanti**.
  - [x] `src/game/rts/economy/marketPricing.ts` - saf fiyat cekirdegi
        (`MarketPrices`). Cuzdan/yapi/Three.js bagimsiz. Alis yukari, satis
        asagi yuvarlanir; yuvarlama her zaman kasanin lehine, boylece
        yuvarlamadan dogan arbitraj da kapali.
  - [x] Testler: fiyat merdiveni, kaynak izolasyonu, kirpma (taban/tavan),
        numeraire reddi, reset, ve invaryantin **iki yonde tum bant boyunca**
        yurutulmesi + validator'in kotu ayarlari reddettigi.
  - [x] `npm run build:verify` yesil (1032 check).

  > **Kapsam duzeltmesi:** Bu faz baslangicta `buildings.json`'a `market` girisi
  > eklemeyi de kapsiyordu ve "oyunda hicbir sey degismez" deniyordu. Bu yanlisti:
  > `RtsBuildPalette` kategorize edilmemis her bina id'sini otomatik olarak
  > "Diger" grubuna dusuruyor, yani tek basina balance girisi **oyuncuya sanatsiz
  > ve panelsiz, kurulabilir bir market** gosterirdi - plan §13'un reddettigi
  > "yarim sistem". Bu yuzden balance girisi M1'e tasindi; M0 saf sozlesme +
  > model olarak kaldi ve gercekten gorunur bir degisiklik uretmiyor.
- **Faz M1 - Bina ve gorsel. - TAMAMLANDI**
  - [x] `buildings.json`: `market` girisi ("Pazar", 8x8, 150 odun, 50 sn, 500 HP),
        Lv2/Lv3 adimlari ve M0'da tanimlanan `market` ticaret blogu (§4.2'nin
        onerilen degerleri). Komisyonun seviyeye gore dusmesi M3'e ait.
  - [x] `rtsBuildingArt.ts`: tek satir `market` -> `Market_{family}_Level{n}`.
        Cag ailesi ve seviye gorseli mevcut mekanizmadan bedavaya geliyor.
  - [x] `rtsBuildPalette.ts`: "Ekonomi" kategorisi. Ayri bir "Ticaret" basligi
        tek binalik bir liste olurdu; oyuncunun sordugu soru ("madenle
        ulasamadigim tas/altin lazim") uretici binalarinkiyle ayni.
  - [x] Testler: market'in her iki cag ailesinde ve 3 seviyede cozumlenmesi,
        balance girisinin sekli, ve **balance'taki her binanin bir sanat
        cozumleyicisi oldugu** invaryanti (unutulan satiri yakalar).
  - [x] `npm run build:verify` yesil (1033 check).

  > Bu fazdan sonra market kurulabilir ama secildiginde yalnizca genel
  > ("passive") panel gosterir - ticaret butonlari M2'de geliyor.
- **Faz M2 - Ticaret UI'si. - TAMAMLANDI**
  - [x] `marketTradeSystem.ts`: `MarketPrices`'i maca baglayan katman. KR-M2
        (krallik basina fiyat tablosu) ve KR-M4 (kontrol alani sarti, Kisla ile
        ayni predicate) burada. Hicbir yerde `market` id'si yazmiyor - bir bina
        `market` blogu tanimladigi icin ticaret yapar.
  - [x] `resourceWallet.exchange()` + `"trade"` degisim turu: atomik takas,
        `incomeSamples`'a **yazmaz**. §2.4'un cozumu; ticaretle alinan kaynak
        HUD'daki uretim sayacini sismiyor.
  - [x] `MarketDetailView` + `describeMarket`: her kaynak icin al/sat fiyati ve
        endeks (×1.20), lot/komisyon satiri, 6 buton (altina gore isaretli:
        `-138 Altin` / `+102 Altin`), taban/tavan isareti.
  - [x] `RtsApp`: sistem baglandi, `structureDetail` dali **veriye gore**
        (`stats.market`), aksiyon handler'lari ve reddedilme mesajlari, mac
        sifirlamasinda fiyat resetlemesi.
  - [x] Testler (`test:engine`, 1038 check): kapi sirasi (pazar yok -> kusatma
        altinda -> parasiz), reddedilen islemin ne stogu ne fiyati oynatmasi,
        krallik izolasyonu, ve §2.4 - alinan kaynagin gelir sayacina girmemesi
        ama gercek uretimin girmesi. Panel metinleri ayri bir check.

  > **Acik nokta - tarayici dogrulamasi yapilamadi.** Bu faz icin bir Playwright
  > smoke testi yazildi (pazar kur, sec, sat, altin/endeks degisimini gozle) ama
  > **yerlestirme akisi su an main'de bozuk**: ekranin hicbir noktasi "Gecerli
  > konum" vermiyor ve mevcut `Barracks panel gates` smoke testi de ayni sekilde
  > cokuyor (degisikliklerim stash'lenmis haliyle de). Test suite'e kirmizi bir
  > test birakmamak icin geri alindi; yerlestirme duzelince geri konmali.
- **Faz M3 - Seviye entegrasyonu.** Komisyon Lv2/Lv3'te duser; Faz 3'te eklenen
  kazanim satiri bunu gosterir.
- **Faz M4 - AI ve kapanis.** `AiTradeManager` (opsiyonel), `build:verify`,
  oyun ici dogrulama.

## 8. Riskler ve Acik Noktalar

- **Arbitraj**: en buyuk risk. §4.3 invaryanti test edilmezse bir balance
  ayari sessizce sonsuz altin uretebilir.
- **Gelir sayaci kirlenmesi**: §2.4 cozulmezse HUD yaniltir.
- **Fiyat kaymasinin kalicligi**: endeks maca yayilir ve geri donmez. Zamanla
  yavasca 1.0'a donen bir "mean reversion" eklenmeli mi? AoE2'de yoktur;
  eklenmesi tavsiye edilmez (oyuncunun piyasayi bozma karari kalici olmali),
  ama macin uzunluguna gore degerlendirilebilir - **acik soru**.
- **Denge**: 100 altin/100 kaynak taban kuru, `gold_mine`'i (9 altin/dk)
  degersizlestirebilir. Taban fiyat ve komisyon, altin madenini hala tercih
  edilebilir birakacak sekilde ayarlanmali - **oyun ici olcum gerektirir**.
- **AI dezavantaji**: oyuncu ticaret yapip AI yapmazsa AI geri kalir. v1'de
  kabul edilebilir; v2'de KR-M6 ile kapatilir.
