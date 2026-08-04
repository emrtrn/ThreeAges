# ThreeAges RTS - Pazar Arzi ve Ticaret Noktalari Plani

Olusturulma tarihi: 2026-08-04
Durum: **Faz S0 acik.** Dokuz karar da onerileriyle birlikte §4'te duruyor;
hicbiri kilitlenmedi. Kod yazilmadan once kullanicinin onlari kilitlemesi
beklenir.

Bu plan **wildlife V-serisinin bir parcasi degildir** (V5 "yapilmayacak" olarak
kapanmisti). Pazar cizgisinin devamidir: kodda `Faz M1..M6` diye anilan pazar
plani bitti, bu dosya **Faz S0..S6** ile onun ustune biner. Fazlarin S harfi
"Stok / Supply" icindir.

**V4 bagimliligi kalkti (§3.4).** Bu planin govdesi `CaravanSystem`'e biner;
`THREEAGES_RTS_V4_DONKEY_LOGISTICS_PLAN.md` Faz 3-4 **tamamlandi** (Faz 5 kod
olarak bitti, gorsel kabul bekliyor). Geriye bir bekleme degil, bir
genellestirme kaldi: `CaravanSystem` bugun yalniz uretici hattini taniyor ve
ikinci bir hat turu icin `CaravanLane` soyutlamasina alinmasi gerekiyor.

## 1. Hedef

Bugun pazarda "100 odun al" dugmesine basmak, **yoktan mal yaratir**. Tek sinir
altin ve depo tavanidir; malin nereden geldigi sorusunun oyunda bir cevabi
yoktur. Satis tarafi durustur (cuzdandan cikar), alis tarafi degildir.

Hedeflenen cumle:

> **Pazarda ne varsa o kadar alinir. Pazarda olan sey, birinin oraya
> tasidigidir.**

Kazanc uc katmanlidir:

1. **Ekonomik** - alis artik bir arz zincirine baglidir; sinirsiz altin sinirsiz
   mal demek degildir.
2. **Mekansal** - nehir kenarindaki liman ve tas sahasi haritada **gidilecek
   yerler** olur; pazarin nereye kuruldugu bir karar haline gelir.
3. **Taktik** - arz yolu kesilebilir. Rakibin limani ile pazari arasindaki yolu
   vurmak, ilk kez onun **alis dugmesini karartir**.

## 2. Basari Tanimi

Asagidaki akisin calismasi hedeflenir:

1. Oyuncu pazarini kurar. Pazar panelinde **her uc alis dugmesi de kapalidir**
   ve nedeni yazar: "Pazarda stok yok".
2. Oyuncu haritadaki **limana** yol ceker. Yol limanin rihtimina degdigi anda
   liman o kralligin arz kaynagi olur.
3. Limandan yuk esekleri cikar, **yol hucreleri uzerinde** pazara yurur ve
   yuklerini **pazar stoguna** bosaltir (cuzdana degil).
4. Stok `lotSize`'a ulastigi anda alis dugmesi **acilir**. Bir lot alinir; stok
   `lotSize` kadar duser ve fiyat endeksi bugunku gibi yukari kayar.
5. Ayni sey **bagimsiz oduncu kampi** icin odunda, **tas sahasi** icin taste
   olur. Uc kaynak, uc ayri arz noktasi turu, uc ayri yol karari.
6. Arz noktalari **insa edilmez, yikilmaz, isci istemez**. Yalnizca yolla
   baglanir ya da baglanmaz.
7. Arz yolunun bir hucresi dusman tarafindan yok edilirse rota kopar; esekler
   eve doner, stok yerinde kalir ama **dolmaz**. Yol onarilinca akis kendiliginden
   devam eder.
8. Satis tarafi **hicbir sey degismez**: satis cuzdandan cikar ve altin getirir.
9. AI ayni kurala tabidir ve kendi arz noktasi kendi yol iskeletiyle bagli
   oldugu icin ekonomisi kesilmez, yalnizca gecikir.

## 3. Mevcut Durum - Olculen Baslangic Noktasi

### 3.1 `buy()` bugun gercekten para basiyor - degistirilecek tek cumle burada

`marketTradeSystem.ts:126-142`. Alis suradaki dort sarti gecince olur: kaynak
ticarete acik, pazar bagli, depo tavani yeter, cuzdanda altin var. **Malin
kendisi hicbir yerden dusulmez.** `wallet.exchange` yalnizca altini alip kaynagi
yazar.

Satis (`:145-161`) ise tam tersi: `wallet.exchange(resourceId, lotSize, ...)`
cuzdandan gercekten dusurur. Yani asimetri koddaki tek bir satirda, ve bu planin
degistirdigi cumle tam olarak odur.

`MarketTradeResult` (`:40-47`) yedi sebebi ayri ayri adlandiriyor. Yeni bir
sebep eklemek (`out-of-stock`) bu tasarimin zaten davet ettigi sey.

### 3.2 Pazar bir bina, ama henuz bir **yer** degil

`MarketTradeSystem` sahiplik basina calisir (KR-M2): fiyat tablosu kralliga
aittir, `commissionFor` **kralligin en iyi** pazarini kullanir ve panel hangi
binadan acilirsa acilsin ayni orani gosterir. Tek mekansal kural
`isStructureConnected` (KR-M4): kontrol alani disindaki pazar ticaret yapamaz.

Bu, KARAR 1'in gerekcesidir. Stogu bina basina tutmak, ayni panelin yarisini
kralliga yarisini binaya baglar; oyuncu hangi sayinin neye ait oldugunu
okuyamaz.

### 3.3 Liman bugun yalnizca dekor - ve iki tane var

`RTS_GameplayProof.level.json` icinde:

| assetId | Konum | Not |
| --- | --- | --- |
| `port-secondage-level3` | `(4.61, 0.14, 17.91)`, rot 120, scale 3 | Nehir kenarindaki liman - planin konusu |
| `dock-firstage` | `(-3.24, -0.49, -4.36)`, rot -55, scale 8/8/10 | **Dekor degil** - asagiya bak |

Ikisi de `instances` altinda **statik mesh**tir. Hicbir RTS sistemi onlari
gormez: `adaptRtsLevel` yalnizca `BP_RTS_*` **Actor** isimlerini tanir
(`rtsLevelAdapter.ts:127-200`), ve orada liman yoktur. Yani limani oynanisa
sokmak, mesh'i tasimak degil, **yanina bir marker Actor koymaktir**.

**Duzeltme - `dock-firstage` bir iskele degil, koprudur.** Level'in tek
`blockingVolumes` girdisi `(-3.38, -0.35, -4.29)`, `size [4, 1, 12]`, rot -55,
`navigationRole: "walkable"`. Ayni nokta, ayni aci, ayni olcek: bu mesh'in
altinda **yuruyus guvertesi** var. Yani `dock-firstage` nehrin orta gecidini
kaplayan gecittir (§3.7) ve **oynanisin parcasidir**. Bu plan ona dokunmaz ama
"dekor, kapsam disi" diye gecistirilemez: uzerine arz noktasi authorlamak, ayni
anda haritanin merkez gecidini kapatmak demektir.

Manifest yedi liman varyanti tasiyor (`port-firstage-level1..3`,
`port-secondage-level1..3`, `dock-firstage`), yani cag/seviye gorseli ileride
bedavaya gelir.

### 3.4 Zincirin tamami hazir - is bir bagimlilik degil, bir genellestirme

**2026-08-04 guncellemesi.** Bu bolum once "V4 yazilmadi, S3 bekler" diyordu; V4
o sirada ilerledi ve **artik dogru degil**. Olculen guncel durum:

| Parca | Durum | Nerede |
| --- | --- | --- |
| Yol uzerinde deterministik rota | **Hazir** | `RoadGraph.route(from, to)` (`roadGraph.ts:190`) |
| Uretici -> hedef baglanti durumu | **Hazir** | `ProductionLogisticsSystem.snapshots()` |
| Yol uzerinde yuruyen kervan | **Hazir** | `logistics/caravanSystem.ts`, V4 Faz 3 |
| Varista teslim | **Hazir** | `logisticsTransferSystem.ts`, V4 Faz 4 |
| Kervanin vurulmasi / yol kesme | **Kod hazir**, gorsel kabul bekliyor | V4 Faz 5 |

Yani S3'un onunde **bekleyecek bir sey kalmadi**. Yerine gecen sey daha kucuk ve
daha somut bir is: `CaravanSystem` bugun **yalnizca uretici hattini** taniyor.

- `update()` dogrudan `this.links.snapshots()` uzerinde yuruyor
  (`caravanSystem.ts:230`), yani kervan kaynagi tek bir sisteme cakili.
- Kimlik `caravan:${link.structureId}:${index}` (`:242`) ve `CaravanArrival`
  `producerStructureId: number` tasiyor (`:35`). **Arz noktasi bir
  `PlacedStructure` degildir** - `ResourceNodeSystem` gibi **string** id'lidir,
  yani sayisal yapi id'si yoktur.
- Filo boyutu `balance.spawnPerProducer` ile **global** (`:241`); §6.1 ise arz
  noktasi basina `caravanCount` istiyor.
- Hedef `destinationFor()` ile depo-ya-da-merkez olarak sabit (`:285-294`);
  pazar bu listede yok.

Sonuc, §5.1'in kuralini degistirmiyor ama **netlestiriyor**: ikinci bir kervan
sistemi yazilmaz, `CaravanSystem` bir **hat (lane)** soyutlamasi uzerine alinir:

```ts
interface CaravanLane {
  readonly id: string;          // "producer:12" | "supply:river_port"
  readonly owner: UnitOwner;
  readonly source: RoadCell;
  readonly destination: RoadCell;
  readonly caravanCount: number;
}
```

`ProductionLogisticsSystem` ve `MarketSupplySystem` birer **hat saglayicisi**
olur; durum makinesi, olum penceresi, `beginReturnHome` (KARAR 5) ve rota
onbellegi tek kopya kalir. `CaravanArrival.producerStructureId` yerini
`laneId`'ye birakir ve `LogisticsTransferSystem` cagrisini ondan cozer.

Bu bir V4 duzeltmesi degil, V4'un **ikinci musterisinin** dogal bedeli - ve
yalniz bir musteri varken yazilmamasi dogru olandi.

### 3.5 Uretici -> depo iskeleti birebir sablon

`ProductionLogisticsSystem.snapshots()` (`productionLogisticsSystem.ts:31-93`)
her uretici icin uc seyi cozer: footprint'e degen `roadCell`, o hucrenin
`componentId`'si, ve ayni bilesende duran hedefin id'si. Alti durum uretir
(`:9`), her biri panelde ayri bir cumle.

Arz noktasi icin gereken sorgu **birebir aynidir**, yalnizca hedef degisir:
depo yerine **pazar**. `roadCellTouchingFootprint` arz noktasinin rihtim
olcusuyle cagrilir, gerisi kopyadir. Yani yeni sistem bir yeniden tasarim degil,
ayni desenin ikinci ornegidir.

`depotByComponent` haritasindaki `owner:componentId` anahtari da aynen
gerekir - bir kralligin arz noktasi baska bir kralligin pazarina yuruyemez.

### 3.6 Uc kaynak, uc arz noktasi - ve odun en cok talep edilen

`market.basePrice` bugun **uc** kaynak fiyatliyor: `food: 10`, `wood: 10`,
`stone: 20` (`buildings.json`). Ucu de stoga baglanir ve her birinin kendi arz
noktasi turu olur:

| Kaynak | Arz noktasi | Haritadaki karsiligi |
| --- | --- | --- |
| `food` | Nehir limani | `port-secondage-level3` (§3.3) |
| `wood` | **Bagimsiz oduncu kampi** | Yeni; koru kenarina authorlanir |
| `stone` | Tas sahasi | Yeni |

Odun, oyuncunun **en cok aldigi** kaynaktir ve bunun sebebi veride duruyor: yol
hucre basina 4 odun (`roads.json`), ve bu planin kendisi kralligi 120-180 odunluk
yollar cekmeye zorluyor. Yani odun arzi zincirin **kendi maliyetini** finanse
eden halkadir; disarida birakilirsa oyuncu tam da en cok ihtiyac duydugu anda
pazardan cevap alamaz.

Oduncu kampi arz noktasinin `perMinute` degeri bir tuzak tasiyor: sahip olunan
`lumber_camp` uc isciyle **120 odun/dk** uretir (`buildings.json`), yani oyundaki
en hizli ureticidir. Arz noktasi ona yaklasirsa "koru kesmeye gerek yok" denir.
Ama karsilastirma yaniltici: arz noktasinin ciktisi **cuzdana degil pazar
stoguna** gider, yani hala altin odenerek alinir. Arz noktasi gelir degil,
**alma hakki** uretir. §6.1 orani buna gore koyar.

Yine de hangi kaynagin stok istedigi **veriden** okunmalidir, koddan degil
(KARAR 8): sablon ucunu de stoklu gonderir, ama bir fork birini disarida
birakabilir ve bunu yaparken hicbir kod degismez.

### 3.7 Kritik bulgu - nehir bir kiyi degil, **iki kralligi ayiran duvardir**

Once olculen ham veri. Yol maliyeti ortogonaldir (`cellSize: 2`,
`woodCostPerCell: 4`):

| Nereden | Limana (4.61, 17.91) ortogonal mesafe | Hucre | Odun |
| --- | --- | --- | --- |
| Oyuncu merkezi (-38, 38) | 62.70 | ~32 | ~128 |
| Dusman merkezi (38, -38) | 89.30 | ~45 | ~180 |

Ama asil mesele mesafe degil. Level'in 33 adet `BP_RTS_NavigationBlocker`
Actor'u ("River Blocker 1..40", her biri 10x10x5) `(-66.5, -64.9)`'dan
`(66.3, 65.6)`'ya uzanan bir zincir cizer. Egim ~0.98: **nehir x = z kosegeni
uzerindedir ve bastan basa gecilmez bir duvardir.**

Iki merkez bu duvarin **karsit yakalarindadir**: oyuncu icin `z - x = +76`,
dusman icin `-76`. Liman ise `z - x = +13.3` ile **oyuncunun yakasindadir**.

Numaralandirmadaki uc bosluk gecitleri verir (olculdu, elle authorlanmis, bu
yuzden yalnizca yaklasik simetrik):

| Eksik id | Gecit merkezi | Genislik |
| --- | --- | --- |
| 8-10 | ~(-45.8, -33.2) | ~16.7 |
| 19-20 | ~(-3.5, -4.2) | ~15.1 - **`dock-firstage` koprusu burada** (§3.3) |
| 31-33 | ~(41.6, 35.6) | ~19.8 |

**Onceki oneri bu yuzden yanlisti.** Kosegen ortogonal olarak esit uzaklikta
olan noktalar kumesidir - ama ayni kosegen **nehrin kendisidir**. `(11.26, 11.26)`
noktasi River Blocker 24'un `(3..13, 10.2..20.2)` kutusunun **icindedir**. Oraya
arz noktasi konamaz; orasi bir yer degil, bir duvardir.

Dogru cozum haritanin kendi konvansiyonudur: sigir suruleri, kurt inleri ve
stratejik noktalar hepsi **merkeze gore nokta-simetrik ciftler** halinde
authorlanmistir. Arz noktalari da oyle olur - her tur icin bir cift, biri her
yakada:

| Tur | Oyuncu yakasi | Dusman yakasi (nokta-simetrik) |
| --- | --- | --- |
| Liman | `(4.61, 17.91)` - mevcut mesh | `(-4.61, -17.91)` |
| Oduncu kampi | author edilecek | negatifi |
| Tas sahasi | author edilecek | negatifi |

`(-4.61, -17.91)` olculdu: en yakin uc blocker'in (16, 17, 18) hicbirinin
kutusuna girmiyor, yani su kenarinda ama karada.

Bu, KARAR 4'un (munhasirlik) on kosuludur: paylasilan bir kaynakta asimetri
gecikmedir, munhasir bir kaynakta **maci belirler**. Ciftler halinde
authorlandiginda her krallik dogal olarak kendi ucunu tutar, ve rakibinkini
almak **nehri gecmeyi** gerektirir - yani uc gecidin birinden. Ekonomik hedef
boylece haritanin zaten var olan askeri darbogazina baglanir; yeni bir
mekanik icat edilmez.

**Acik soru (KARAR 4 ile birlikte kilitlenir):** uc cift = alti arz noktasi mi,
yoksa daha az sayida ve daha cok tartisilan bir kume mi? Alti nokta her tarafa
kendi ucunu verir ve kavga yalnizca baskindan cikar; uc gecide konan uc **ortak**
nokta ise her lotu tartismali kilar ama ekonomiyi askeri darbogaza fazla
baglayabilir. Olculen veri ikisini de destekliyor; secim kullanicinin.

### 3.8 Olculen debi - naif ayarla bir lot ~4 dakika surer

`logistics.json`: `carryCapacity: 30`, `moveSpeed: 2.2`, `loadSeconds: 2`,
`spawnPerProducer: 1`. `market.lotSize: 100`.

Mevcut limandan oyuncu merkezine (62.7 birim, §3.7) tek esekle:

- Tek yon: 62.7 / 2.2 = **28.5 sn**
- Gidis-donus + iki duraklama: 57 + 4 = **61 sn**
- Debi: 30 birim / 61 sn = **~29.5 birim/dk**
- Bir lot (100 birim): **~3.4 dakika**

Uc kaynak icin ayni anda: uc ayri hat, uc ayri filo. Tek esekli ayarla oyuncu
dakikada ~0.3 lot alabilir - yani pazar pratikte kapalidir.

Bu, "sinirsiz alim" ile "pratikte hic alim yok" arasinda ikincisine cok yakin
duruyor. Sonuc bir tasarim hatasi degil, bir **ayar** sorusudur ve plan buna
kendi tunable'ini vermelidir (§6): arz noktasi kendi `caravanCount`'unu ve kendi
uretim hizini tasir. Dort esekle ayni lot ~50 saniyeye iner.

Iki knob birbirine bagli ve bu bilincli: `perMinute` filonun tasiyabileceginin
uzerine cikarsa tampon surekli dolu kalir ve ilan edilen hiz bir yalan olur.
Cevap yeni bir kural degil, V4 §3.8'in zaten ogrettigi sey: tampon dolunca
uretim `buffer-full`'a duser ve panel bunu soyler. Oyuncu bunu "ikinci esek ekle
ya da pazari yaklastir" diye okur - ureticide ne okuyorsa.

Not: V4'un `carryCapacity <= localBufferCapacity` kurali arz noktasi icin de
gecerlidir - tampon 30'un altina inerse esek her seferinde tamponu bosaltir ve
"tampon dolu" baskisi kaybolur.

### 3.9 AI zaten pazardan aliyor - ve stok gelince ne olacagi belli

`AiTradeManager` (`aiTradeManager.ts`) Cag 2 maliyetini kapatmak icin alim/satim
yapar. `execute()` (`:128-153`) `traded` disindaki her sonucu bir **duruma**
cevirir; `out-of-stock` eklendiginde kod degismeden `saving`'e duser, yani
**AI kirilmaz**.

Ama AI'nin bir arz yolu kurmayi ogrenmesi de gerekmez ve ogrenmemelidir (V4
KARAR 2-A'nin ayni gerekcesi). Ucuz ve durust cevap **harita authoring**'dir:
dusmanin arz noktasi, `enemyBaseRoute` / `enemyExpansions` iskeletine bagli
sekilde author edilir. Sifir AI kodu, tam parite. KARAR 9 budur.

### 3.10 Kapasite ve isgal kancalari hazir, degismiyor

- `ResourceCapacitySystem.availableFor` alis tarafinda zaten cagriliyor
  (`marketTradeSystem.ts:134`) ve `storage-full` uretiyor. **Pazar stogu cuzdan
  degildir**, yani depo tavani ona uygulanmaz; mal ancak cuzdana girdigi anda
  tavana takilir. Hicbir degisiklik gerekmez.
- `LogisticsOccupationSystem` (`logisticsOccupationSystem.ts:16`) bir dugumu
  sahipligini almadan kullanilamaz kilar. Arz noktasi munhasir olacaksa
  (KARAR 4-A) bu desen **birebir** yeniden kullanilir; yeni bir sahiplik kavrami
  icat edilmez.

### 3.11 Altin zaten alinamiyor - ve bu dogru

`validateMarketBalance` (`validateGameData.ts:1093-1095`) `basePrice.gold`
girdisini **acikca reddeder**: altin numeraire'dir, kendisiyle fiyatlanamaz.
Yani "altin al" dugmesi zaten yok; altin yalnizca **satisin karsiligi** olarak
girer.

Sonuc: bu mekanikte altin icin yapilacak **hicbir sey yoktur**. Kullanicinin
sorusuna cevap §4 KARAR 5'te.

## 4. Tasarim Kararlari (Faz S0 - **ACIK**)

Dokuz soru, dokuz oneri. Hicbiri kilitlenmedi.

### KARAR 1 - Stok kralliga mi, binaya mi ait? -> **A onerilir**

- **A - Krallik basina tek stok havuzu. ONERILEN.** Fiyat tablosu (KR-M2) ve
  komisyon (`commissionFor`) zaten krallik basina; stok da oyle olursa panel
  bastan sona tek olcekte konusur. Bir pazar yikilinca stok kaybolmaz, yalnizca
  ikmal durur.
- **B - Pazar binasi basina stok.** Kusatilan pazarin stogunu kaybetmek daha
  zengin, ama ayni panel yari-krallik yari-bina olur ve oyuncu hangi sayinin
  neye ait oldugunu okuyamaz (§3.2).

### KARAR 2 - Arz noktasi tukenir mi? -> **A onerilir**

- **A - Yenilenebilir, hiz sinirli. ONERILEN.** Nehir baliklanir, saha kazilir;
  sinir **debi**dir, miktar degil. Planin butun gerilimi buradan gelir.
- **B - Sonlu (`resourceNode` gibi).** Tukenince arz noktasi olur ve pazarin
  alis tarafi kalici olarak kapanir - "tek seferlik ganimet"e geri donus.

Veri yine de `capacity`'yi **istege bagli** tasimalidir, boylece bir fork sonlu
saha authorlayabilir. Sablon `null` (yenilenebilir) gonderir.

### KARAR 3 - Arz noktasi isci ister mi? -> **A onerilir**

- **A - Hayir. ONERILEN.** Limanin kendi balikcilari, sahanin kendi kazicilari
  vardir. Nufus saymaz, isci atanmaz. Karar tek bir seydir: **yolu cekmek**.
- **B - Isci atanir.** O zaman arz noktasi sadece "uzaktaki bir tarla"dir; pazar
  hicbir sey eklemez ve nufus tavanina yeni bir musteri gelir.

### KARAR 4 - Ayni arz noktasini iki krallik birden kullanabilir mi? -> **A onerilir, §3.7 kosuluyla**

- **A - Munhasir. ONERILEN.** Yolu ilk degdiren krallik noktayi tutar; rota
  koptugu anda (`route()` `null`) nokta serbest kalir. Rakipten almanin yolu
  **onun yolunu kesmektir** - V4 Faz 5 bunu zaten mumkun kiliyor. Yeni savas
  kodu gerekmez, `LogisticsOccupationSystem` deseni birebir kullanilir.
- **B - Paylasimli.** Her krallik kendi yolunu ceker, ikisi de alir. Guvenli ama
  arz noktasi bir **hedef** olmaktan cikar.

**A'nin on kosulu §3.7'dir.** Munhasir bir kaynak asimetrik duramaz - ve nehir
iki kralligi ayirdigi icin bugunku tek liman, tanimi geregi asimetriktir.

### KARAR 5 - Altin icin ne yapilacak? -> **Hicbir sey (bu planda)**

Kullanicinin sordugu sey. Cevap uc parcali:

1. **Alis tarafi zaten yok.** Altin numeraire'dir; `validateMarketBalance` onu
   fiyatlamayi reddeder (§3.11). "100 altin al" dugmesi hic olmadi.
2. **Satis tarafi zaten durust.** Sattigin altin cuzdandan cikar, madenden
   gelir, maden sonludur (`resources.json`: safe 300 / external 600).
3. **Asil eksik olan sey bu plan degil.** Altini bir **lojistik** meselesi yapmak
   isteniyorsa dogru mekanik AoE2'nin ticaret arabasidir: tarafsiz bir ticaret
   sehrine giden kervan, **kat ettigi mesafeyle orantili altin** getirir.
   Uzaklik odul olur, yol kesme altini keser. Bu, bu planin **dogal devamidir**
   ve ayni `CaravanSystem`'e biner - ama ayri bir plandir, kapsam disi.

### KARAR 6 - Pazar yikilinca / kopunca stok ne olur? -> **A onerilir**

- **A - Stok kralliga ait, durur. ONERILEN.** (KARAR 1-A'nin dogal sonucu.)
  Kopan sey **ikmal**dir, stok degil.
- **B - Stok kaybolur.** KARAR 1-B secilirse zorunlu olur.

### KARAR 7 - Satilan mal alinabilir stoga eklenir mi? -> **A onerilir**

- **A - Hayir. ONERILEN.** Satis, mali oyunun disina cikarir. B secilirse bir
  krallik **hicbir yol cekmeden** kendi stogunu doldurabilir - yani planin
  kaldirdigi seyin ta kendisi geri gelir. (Kar edilemez; `assertNoArbitrage`
  bunu zaten garanti eder. Sorun kar degil, **arz zincirinin atlanmasi**dir.)
- **B - Evet, satilan mal stoga girer.**

### KARAR 8 - Hangi kaynak stok ister? -> **Ucu de; mekanizma veriden. ONERILEN**

`MarketBalance`'a `stocked: readonly string[]` eklenir. Icindeki her id
`basePrice`'ta bulunmak zorundadir (validator). Sablon
**`["food", "wood", "stone"]`** gonderir - `basePrice`'in tamami.

Odun disarida birakilamaz: pazarin en cok talep edilen kalemi odur ve bu planin
kendisi kralligi 120-180 odunluk yollara zorlar (§3.6). Stoksuz birakilan odun,
"sinirsiz alim" sorununu tam da en cok hissedildigi yerde ayakta birakirdi.

Alan yine de **liste** olarak durur, `boolean` olarak degil: bir fork bir
kaynagi disarida birakmak isterse tek satir veri degistirir, hicbir kod
degismez. Bos liste de gecerlidir ve bugunku davranisi verir - yani plan tek
satirla geri alinabilir.

### KARAR 9 - AI paritesi nasil saglanir? -> **A onerilir**

- **A - Harita authoring. ONERILEN.** Dusmanin arz noktasi, mevcut
  `enemyBaseRoute` / `enemyExpansions` iskeletiyle bagli sekilde authorlanir.
  Sifir AI kodu, tam parite (§3.9).
- **B - AI'ya arz yolu kurma kurali yazilir.** `aiEconomyManager`'a yeni bir
  intent, yeni bir yol planlayicisi ve yeni bir debug satiri - kapsami iki
  katina cikarir.

### Kapsam disi (bu plana sizmayacaklar)

- Altin ticaret kervani / tarafsiz ticaret sehri (KARAR 5'in 3. maddesi)
- Dorduncu bir kaynak ya da yeni bir kaynak turu - uc kaynak, uc arz noktasi
- Arz noktasinin cag/seviye gorsel yukseltmesi (`port-*-level1..3` manifestte
  hazir, ama bu plan tur basina tek gorsel kullanir)
- Deniz birimleri, gemi, kayik - **hicbiri**
- `dock-firstage` koprusu (§3.3): oldugu gibi kalir, uzerine hicbir sey
  authorlanmaz
- Yeni nehir gecidi acmak / mevcut gecitleri degistirmek
- Arz noktasinin yikilabilir/onarilabilir olmasi
- Kervan escort emri, yagma (V4 kapsam disi listesinden devralinir)

## 5. Dokunulacak Dosyalar

### 5.1 Kod

| Dosya | Is |
| --- | --- |
| `src/game/rts/economy/tradeSiteSystem.ts` | **Yeni.** Arz noktasi durumu: uretim tamponu, sahiplik (munhasirsa), `snapshots()`. `ResourceNodeSystem`'in kardesi - render bagimliligi yok |
| `src/game/rts/economy/marketSupplySystem.ts` | **Yeni.** Arz noktasi -> pazar baglanti durumu. `ProductionLogisticsSystem`'in birebir ikizi (§3.5), hedefi depo degil pazar |
| `src/game/rts/economy/marketStock.ts` | **Yeni.** Krallik basina kaynak stogu: `credit`, `withdraw`, `amount`. Saf, test edilebilir cekirdek |
| `src/game/rts/economy/marketTradeSystem.ts` | `buy()` stoktan duser; yeni `out-of-stock` sonucu; `snapshotFor` stogu tasir. **Satis tarafi degismez** |
| `src/game/rts/logistics/caravanSystem.ts` | **Var (V4 Faz 3).** `CaravanLane` soyutlamasina alinir (§3.4): hat saglayicisi disaridan gelir, `laneId` string olur, filo boyutu hat basina okunur. Yeni sistem **degil**, ayni sistemin ikinci musterisi |
| `src/game/rts/economy/logisticsTransferSystem.ts` | **Var (V4 Faz 4).** Varisi `laneId` uzerinden cozer; uretici hatti icin davranis birebir korunur |
| `src/game/rts/world/rtsMapBlockout.ts` | `RtsTradeSiteDefinition` + `tradeSites` alani |
| `src/game/rts/world/rtsLevelAdapter.ts` | `BP_RTS_TradeSite` marker'inin okunmasi (`resourceId`, `siteId`, rihtim olcusu) |
| `src/game/rts/RtsApp.ts` | Sistem kurulumu, update sirasi, pazar paneline stok besleme, arz noktasi gorselinin mount'u |
| `src/game/rts/ui/rtsSelectionView.ts` | `MarketDetailView`'a stok satiri; alis dugmesinin stok yuzunden kapanmasi ve **nedeninin yazilmasi** |
| `src/game/rts/ai/aiTradeManager.ts` | Beklenen degisiklik **yok** (§3.9); yalnizca dogrulanir |
| `src/game/data/gameDataTypes.ts` | `MarketBalance.stocked`; `TradeSiteBalance` |
| `src/game/data/validateGameData.ts` | `stocked` girdilerinin `basePrice`'ta bulunmasi; `validateTradeSiteBalance` |
| `tools/engine-tests.ts` | §8'deki sozlesme testleri |

### 5.2 Veri ve varlik

| Dosya | Is |
| --- | --- |
| `public/game-data/balance/trade-sites.json` | **Yeni.** Uc arz noktasi turu (liman / oduncu kampi / tas sahasi): uretim hizi, tampon, kervan sayisi (§6) |
| `public/game-data/balance/buildings.json` | `market.stocked` - S1'de `[]`, S3'te `["food", "wood", "stone"]` |
| `public/assets/ThreeAges/Actors/Markers/BP_RTS_TradeSite.actor.json` | **Yeni.** `BP_RTS_ResourceNode` deseni |
| `public/assets/ThreeAges/Levels/RTS_GameplayProof.level.json` | Uc turun marker'lari, §3.7'nin secilen cozumune gore (cift halinde ise alti adet) |
| `public/assets/manifest.json` | Yalniz yeni marker Actor girdisi (liman mesh'leri zaten kayitli) |

### 5.3 Allowlist notu

Bu plan CLAUDE.md'nin **birinci allowlist yuzeyine** dokunur: yeni marker
Actor'unun Level'da tasidigi alanlar `LayoutPlacement` uzerinden gitmez, Actor
degisken override'i olarak gider - yani `BP_RTS_ResourceNode` bugun nasil
kaydediliyorsa aynen oyle. **`tools/saveValidator.ts` degismez.**

Kural: **arz noktasi verisi Level'a yazilmaz.** Level yalnizca *nerede* ve
*hangi kaynak* soyler; hiz/tampon/kervan sayisi `balance/trade-sites.json`'a
gider. Bu, allowlist isini tamamen disarida birakir.

## 6. Balans Verisi (oneri)

### 6.1 `trade-sites.json`

```jsonc
{
  "river_port": {
    "label": "Nehir Limani",
    "resourceId": "food",
    "perMinute": 60,
    "bufferCapacity": 120,
    "caravanCount": 4,
    "dock": { "width": 8, "depth": 8 }
  },
  "timber_camp": {
    "label": "Bagimsiz Oduncu Kampi",
    "resourceId": "wood",
    "perMinute": 80,
    "bufferCapacity": 120,
    "caravanCount": 4,
    "dock": { "width": 8, "depth": 8 }
  },
  "stone_pit": {
    "label": "Tas Sahasi",
    "resourceId": "stone",
    "perMinute": 40,
    "bufferCapacity": 120,
    "caravanCount": 4,
    "dock": { "width": 8, "depth": 8 }
  }
}
```

| Alan | Deger | Gerekce |
| --- | --- | --- |
| `perMinute` | 60 / 80 / 40 | Siralama talebi izler (§3.6): odun en cok alinan, tas en pahali (`basePrice` 20, digerlerinin iki kati - ayni altin daha az birim tas alir, o yuzden daha yavas dolmasi yeterlidir). Odunun 80'i, sahip olunan `lumber_camp`'in 120/dk'sinin **altinda** kalir; arz noktasi koru kesmenin yerini almaz, korusu tukenmis ya da henuz kamp kuramamis kralligin cikis kapisi olur |
| `bufferCapacity` | 120 | `carryCapacity` (30) x `caravanCount` (4) - butun kervan filosu ayni anda yuklenebilir, ve V4'un `carryCapacity <= bufferCapacity` kurali saglanir |
| `caravanCount` | 4 | §3.8'in olcusu: 4 esek bir lotu ~50 saniyeye indirir. Tek esekle ~3.4 dakika, ki bu "pratikte hic" demektir |
| `dock` | 8x8 | Pazarin footprint'i ile ayni; yolun degecegi kenar yeterince genis |
| `capacity` | (yok) | KARAR 2-A: yenilenebilir. Istege bagli alan olarak semada durur |

Uc tur de ayni `bufferCapacity`/`caravanCount`'u tasiyor; ayrisan tek sey hizdir.
Bu kasitli - ilk ayarda tek degisken birakmak, kabul macinda hangi knob'un
yanlis oldugunu okunabilir kilar.

Butun bu degerler **ayardir**, sozlesme degil. Testler §8'de yalnizca sekli ve
iliskiyi pinler.

### 6.2 `buildings.json` - `market.stocked`

```jsonc
"market": {
  "market": {
    "lotSize": 100,
    "basePrice": { "food": 10, "wood": 10, "stone": 20 },
    "stocked": ["food", "wood", "stone"],
    ...
  }
}
```

`basePrice` **degismez**. `stocked` yalnizca hangi kaynagin alisinin bir arz
zinciri istedigini soyler (KARAR 8) ve bu sablonda `basePrice`'in tamamini
kapsar - yani uc alis dugmesinin ucu de stoga baglidir.

### 6.3 `resources.json`'a dokunulmuyor

Arz noktasi yeni bir kaynak turu getirmez; var olan kaynagi baska bir yoldan
tasir. Hicbir kaynak profili degismez.

### 6.4 `logistics.json`'a dokunulmuyor

Ayni yuk esegi, ayni hiz, ayni kapasite. Filo buyuklugu arz noktasinin kendi
`caravanCount`'undadir, cunku bu bir **lojistik hatti** ozelligidir, hayvanin
degil.

## 7. Fazlar ve Checklist

### Faz S0 - Karar kilidi

- [ ] KARAR 1 (stok kimin) kilitlendi.
- [ ] KARAR 2 (tukenir mi) kilitlendi.
- [ ] KARAR 3 (isci) kilitlendi.
- [ ] KARAR 4 (munhasirlik) kilitlendi.
- [ ] KARAR 5 (altin) kilitlendi.
- [ ] KARAR 6 (yikilan pazar) kilitlendi.
- [ ] KARAR 7 (satilan mal) kilitlendi.
- [ ] KARAR 8 (hangi kaynak stoklu) kilitlendi.
- [ ] KARAR 9 (AI paritesi) kilitlendi.
- [ ] §3.7'nin harita cozumu secildi: **uc nokta-simetrik cift (alti nokta)** mi,
  yoksa **uc ortak nokta** mi? Nehir iki yakayi ayirdigi icin bu, "her tarafin
  kendi ucu var" ile "her lot tartismali" arasindaki secimdir.
- [ ] Oduncu kampi ve tas sahasi icin harita konumlari secildi (liman zaten
  yerinde). Hicbiri nehir gecidini kapatmiyor.
- [ ] §4 kapsam disi listesi teyit edildi.

Kabul: dokuz kararin hicbiri kod yazilirken yeniden tartisilmaz.

### Faz S1 - Stok cekirdegi (oynanis yok)

- [ ] `marketStock.ts`: krallik x kaynak stogu; `credit` / `withdraw` /
  `amount`; negatif ve NaN reddi.
- [ ] `MarketBalance.stocked` tipi + validator (`basePrice`'ta olmayan id
  reddedilir; bos liste gecerlidir).
- [ ] `MarketTradeResult`'a `out-of-stock`; `buy()` stoklu kaynakta stok
  yetmiyorsa **cuzdana dokunmadan** reddeder ve endeksi **oynatmaz**
  (`marketTradeSystem.ts:126`'nin mevcut sirasi korunur).
- [ ] Panel stogu gosterir; dugme kapaliysa nedeni yazar.
- [ ] `buildings.json` bu fazda **`"stocked": []`** gonderir.

Kabul: makine tamdir ama **hicbir kaynak stoklu degildir**, yani oyun bit bit
bugunku gibi oynanir. `tsc`, `test:engine`, `build:verify` yesil.

Bos liste tesaduf degil, planin geri alma kolu (KARAR 8): uc kaynak da stoklu
oldugu icin (§3.6) listeyi erken doldurmak, arz zinciri gelene kadar pazarin
alis tarafini **tamamen** kapatirdi. Liste S3'un basinda tek satirla doldurulur
ve gerekirse ayni satirla geri alinir.

### Faz S2 - Arz noktasi haritada (ekonomi degismedi)

- [ ] `BP_RTS_TradeSite` marker Actor'u + manifest girdisi.
- [ ] `RtsTradeSiteDefinition` + `rtsLevelAdapter` okumasi + blockout alani.
- [ ] `trade-sites.json` + `TradeSiteBalance` + `validateTradeSiteBalance` +
  editor Data Table girdisi.
- [ ] Level'da uc turun de marker'i, §3.7'nin secilen cozumune gore (cift
  halinde ise alti marker): liman, bagimsiz oduncu kampi, tas sahasi.
- [ ] Oduncu kampi ve tas sahasi icin gorsel secimi. Liman hazir
  (`port-secondage-level3`); digerleri icin mevcut mesh kataloğundan secilir,
  yeni varlik uretilmez.
- [ ] `tradeSiteSystem.ts`: tampon dolar, hicbir yere gitmez.
- [ ] Marker'in ayagi altindaki zemin: nokta build/road blocker uretir mi?
  Rihtimin ustune bina kurulamamali (deposit kurali, `liveNodeBlockers` ikizi).
- [ ] Hicbir arz noktasi bir nehir gecidini kapatmiyor (§3.3/§3.7) - marker'lar
  authorlandiktan sonra uc gecidin de yuruyus genisligi korunur.

Kabul: `?rts` Play'de uc arz noktasi da haritadadir, panelde gorulur, tamponu
dolar ve **durur**. Ekonomi S1 oncesiyle bit bit ayni. **Gorsel kabul
kullanicidadir** (olcek, rihtimin yola degdigi kenar).

### Faz S3 - Baglanti ve kervan

Onkosul: yok. V4 Faz 3-4 tamamlandi (§3.4); Faz 5'in gorsel kabulu bu plani
engellemez.

- [ ] `CaravanSystem` `CaravanLane` soyutlamasina alinir (§3.4). **Uretici hatti
  davranisi bit bit korunur** - bu adim tek basina, hicbir yeni oynanis
  eklemeden yesil kosmalidir.
- [ ] `marketSupplySystem.ts`: arz noktasi -> pazar durum cozumu
  (`unlinked-road` / `unlinked-market` / `outside-control` / `claimed-by-enemy` /
  `linked`), ikinci hat saglayicisi olarak.
- [ ] Teslim **stoga** (cuzdana degil); `laneId` uzerinden ayrisir.
- [ ] `buildings.json` `"stocked": ["food", "wood", "stone"]`'a cevrilir - S1'de
  bilincli olarak bos birakilan liste (KARAR 8) burada dolar ve plan bu tek
  satirla **canlanir**. Ayni satirla geri de alinir.
- [ ] Munhasirlik (KARAR 4-A secildiyse): ilk baglayan tutar, rota kopunca
  serbest kalir.
- [ ] Yol kesilince V4 KARAR 5 davranisi aynen gecerli: esek eve doner, yuk
  arz noktasinin tamponuna geri yazilir.

Kabul: yol cekilir, esekler limandan pazara yurur, **stok dolar ve alis dugmesi
acilir**. Bu, planin tasarimsal kabulu - maci oynayan kullanici verir.

### Faz S4 - AI paritesi

- [ ] KARAR 9'un secimi uygulanir (A ise: dusman arz noktasi + authored yol).
- [ ] AI'nin `out-of-stock` aldiginda kirilmadigi, yalnizca `saving`'e dustugu
  dogrulanir (§3.9).
- [ ] AI'nin Cag 2'ye hala ulasabildigi olculur - stok kisiti onu **kilitlemez**,
  yalnizca geciktirir.

### Faz S5 - Saldiri ve kopma

- [ ] Arz yolunun kesilmesi stogu durdurur; panel bunu soyler.
- [ ] Munhasirlik el degistirir; bildirim.
- [ ] Sis: arz noktasi sisin altinda nasil gorunur? (Statik dunya nesnesi
  kurali - agac/deposit ikizi.)

### Faz S6 - UI ve kabul maci

- [ ] Pazar panelinde uc stok satiri son halini alir: "Yiyecek: 240 / lot 100".
- [ ] Arz noktasi paneli: kime ait, tamponu ne, kac esek yolda.
- [ ] Kabul maci: bir bastan sona mac; oyuncu en az bir kez pazarini arz
  noktasina **yakin** kurmayi tercih eder, en az bir kez bir arz yolu kesilir,
  ve **uc hattin ucu de en az bir kez kurulur** - uc kaynagin uc ayri yol karari
  gercekten uc ayri karar mi, yoksa ayni kararin tekrari mi, cevabi burada
  verilir.

## 8. Test ve Gate

`tools/engine-tests.ts`. CLAUDE.md kurali: **sozlesme pinlenir, ayar
pinlenmez.**

| Test | Ne pinler |
| --- | --- |
| "a stocked resource cannot be bought without stock" | Stok < `lotSize` iken `buy` `out-of-stock` doner, cuzdan **ve endeks** degismez |
| "an unstocked resource still buys freely" | KARAR 8: `stocked` disindaki kaynak bugunku davranisini korur |
| "buying a lot removes exactly one lot from stock" | Miktar `lotSize`'dan turetilir, pinlenmez |
| "selling never touches the stock" | Satis tarafinin degismedigi (KARAR 7-A) |
| "every stocked resource is priced" | `stocked` ⊆ `basePrice` anahtarlari - validator sozlesmesi |
| "every stocked resource has a supply site in this project's data" | `trade-sites.json` her stoklu kaynagi karsilar; yoksa alis kalici olarak olu demektir. **Odunun sessizce dusmesini yakalayan test budur** (§3.6) |
| "every priced resource is stocked in this project's data" | Sablonun kendi tercihi: `basePrice` = `stocked`. Bir kaynak fiyatlanip stoksuz birakilirsa suite kirmizi doner ve bu **bilincli** bir karar olmak zorunda kalir |
| "a trade site buffer holds at least one caravan load" | `bufferCapacity >= carryCapacity`, **iki tablodan hesaplanarak** |
| "a supply route uses only committed road cells" | V4 `route()` sozlesmesinin bu rota turunde de gecerliligi |
| "generalising the caravan lane leaves producer logistics unchanged" | §3.4 refactor'u: mevcut V4 kervan/transfer testleri **degismeden** gecer |
| "a severed supply road stops the stock from growing" | Kopru hucresi `remove` edilince stok artmaz |
| "a trade site supplies only the kingdom it is linked to" | `owner` esitligi; dusman limani oyuncunun pazarina yuruyemez |
| "trade sites never consume population" | V4'un nufus testinin ikizi |
| "every trade site has a point-symmetric twin" | §3.7: nehir iki kralligi ayirdigi icin adalet ciftlerle saglanir. Sigir/kurt/stratejik nokta testlerinin ayni kalibi - **haritanin** sozlesmesi, sayinin degil |
| "no trade site blocks a river crossing" | §3.3/§3.7: uc gecidin yuruyus genisligi arz noktasi authorlandiktan sonra da korunur |
| "the market still cannot mint gold" | **Mevcut test**, degismeden gecmeli |

Gate: `npx tsc --noEmit`, `npm run test:engine`, `npm run build:verify`,
`npm run check:assets`. Her fazin sonunda dordu de yesil.

**Kirmiziya donebilirlik.** Her yeni testin en az biri kasitli bozularak kirmizi
gorulur ve geri alinir (V1/V3/V4 aliskanligi).

## 9. Riskler ve Onlemler

| Risk | Onlem |
| --- | --- |
| **Pazar kullanilamaz hale gelir.** 152 odunluk yol + 4 dakikalik lot, oyuncuyu pazardan tamamen sogutabilir. | §3.8 olculdu ve `caravanCount` tam bu yuzden arz noktasinin kendi alani. Faz S3'un kabulu maci oynayan kullanicidadir; ayar oradan gelir. |
| **Faz S1 pazari tamamen kapatir.** Uc kaynak da stoklu oldugu icin (§3.6) arz zinciri gelmeden liste doldurulursa alis tarafi butunuyle oler. | S1 `"stocked": []` gonderir; makine girer, kural girmez, oyun bit bit ayni kalir. Liste S3'un basinda tek satirla dolar - ve ayni satirla geri alinir. |
| **`CaravanLane` refactor'u V4'u bozar.** Calisan bir sistem ikinci musteri icin acilirken uretici hatti sessizce degisebilir. | S3'un ilk maddesi refactor'u **tek basina** yesil kosmaya zorluyor: yeni oynanis yok, mevcut V4 testleri degismeden gecmeli. Ikinci hat ancak ondan sonra takilir. |
| **Harita asimetrisi maci belirler.** Liman oyuncunun nehir yakasinda; dusman ona ancak gecitten ulasir (§3.7). | KARAR 4-A'nin on kosulu §3.7'nin cozulmesi: arz noktalari nokta-simetrik **cift** halinde authorlanir. Test bunu haritanin sozlesmesi olarak pinler. |
| **Uc hat ayni anda tikanir.** Uc kaynak x dort esek = 12 kervan, hepsi ayni pazara. | Filo boyutu arz noktasinin kendi alanidir ve tunable'dir; V4'un `RoadGraph.version` onbellegi rotayi her karede degil yol degisince hesaplar. Performans olcusu Faz S3'un kabulune dahildir. |
| **AI pazardan tamamen dislanir.** Stok kisiti AI'yi Cag 2'ye ulasamaz hale getirebilir. | KARAR 9-A: parite harita authoring ile, sifir AI koduyla saglanir. Faz S4 bunu **olcer**, varsaymaz. |
| **Odun arzi yetmez.** Odun en cok alinan kalem ve bu planin kendi yollari onu tuketiyor (§3.6); arz noktasi yavas kalirsa oyuncu yol cekemedigi icin arz noktasina ulasamaz - kisir dongu. | Oduncu kampi uc turun **en hizlisi** (80/dk, §6.1). Ayrica kisir dongu tam kapali degil: sahip olunan `lumber_camp` 120/dk ile zaten calisiyor, arz noktasi ona alternatif degil ek. |
| **Ikinci bir kervan sistemi dogar.** "Arz kervani" ayri yazilirsa iki durum makinesi ayni hatayi iki kez yapar. | §5.1 kurali: `CaravanSystem`'e ikinci **rota turu** eklenir, ikinci sistem degil. |

## 10. Tamamlanma Kapisi

- [ ] §2'deki dokuz madde uctan uca calisir.
- [ ] §8'deki tum sozlesme testleri gecer; her biri bir kez kirmizi gorulmustur.
- [ ] `npx tsc --noEmit`, `npm run test:engine`, `npm run build:verify`,
  `npm run check:assets` yesil.
- [ ] Kullanici gorsel **ve** hissedilen kabulu verdi (limanin olcegi ve yeri;
  "100 al" dugmesinin acilmasinin gercekten kazanilmis hissettirmesi).
- [ ] §4 kapsam disi listesinden hicbir sey plana sizmadi.
- [ ] V4 planinin §12'si / yol haritasi bu planla guncellendi.

## 11. Uygulama Sirasi

```text
S0 -> S1 -> S2 -> S3 -> S4 -> S5 -> S6
```

Hicbir faz artik baska bir plani beklemiyor (§3.4). S1 ve S2 birbirinden
bagimsizdir; sirasi degistirilebilir ve ikisi de S0 biter bitmez baslatilabilir.
S2'nin gorsel kabulunun erken alinmasi riski azaltir (arz noktalarinin
olcegi/konumu).

S3 kendi icinde ikiye ayrilir ve bu ayrim korunmalidir: once `CaravanLane`
genellestirmesi **hicbir oynanis degistirmeden** yesil kosar, sonra ikinci hat
takilir. Kural ise S3'un sonunda tek satirla (`stocked` listesi) yururluge
girer, yani planin gercekten canlandigi an oradadir - ve ayni satirla geri
alinabilir.
