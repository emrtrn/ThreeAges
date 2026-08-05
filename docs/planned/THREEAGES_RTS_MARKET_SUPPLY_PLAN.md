# ThreeAges RTS - Pazar Arzi ve Ticaret Noktalari Plani

Olusturulma tarihi: 2026-08-04
Durum: **Faz S0, S1, S2, S3 (2026-08-04), S4 ve S5 (2026-08-05) kapandi.** Dokuz
kararin dokuzu da onerildigi gibi kilitlendi, §3.7'nin harita cozumu **uc
nokta-simetrik cift (alti nokta)** olarak secildi ve alti marker'in konumu
olculup sabitlendi (§7 Faz S0). **S1** stok cekirdegini, **S2** arz noktalarini
haritaya koydu; ikisi de ekonomiyi degistirmedi. **S3 ile plan canlandi**:
`CaravanSystem` bir hat (lane) soyutlamasina alindi, `MarketSupplySystem` ikinci
hat saglayicisi oldu, teslim cuzdana degil **pazar stoguna** iniyor ve `stocked`
listesi uc kaynagi da kapsiyor - yani **pazarda ne varsa o kadar alinir**. **S4
pariteyi kapatti** ve KARAR 9-A'nin sozunu tuttu: dusmanin arz yolu Level'a
authorlandi, **sifir AI kodu** yazildi. **S5 kopmayi duyulur kildi**: kesilmenin
kendisi icin tek satir simulasyon kodu yazilmadi (S3 zaten durduruyordu),
yazilan sey bir **okuma katmani** oldu - panelin dort ayri tavsiyesi, uc bildirim
turu, ve sisin cevabi (arz noktasi statik dunya nesnesidir; bilgi de sanati gibi
kesfedilen zeminde durur). **Siradaki: S6** (UI ve kabul maci). Iki
gorsel/oynanis kabulu kullanicida acik: S2'nin mesh yerlesimi (§7 Faz S2) ve
S3'un oynanis kabulu (§7 Faz S3).

S0 sirasinda haritanin ve balans verisinin olculmesi, planin dort ifadesini
duzeltti; hepsi asagida ilgili bolume islendi:

1. Limanin mesh merkezi uc nehir blocker'inin **icinde** - marker mesh merkezine
   konamaz (§3.3).
2. "Nokta-simetrik cift" haritanin **mevcut** konvansiyonu degil; yalnizca geyik
   ve sigir icin gecerli (§3.7).
3. `carryCapacity` `logistics.json`'da **yok**; bina basina `buildings.json`'da
   duruyor, ve `moveSpeed` 2.2 degil **1.76** (§3.8, §6.1, §6.4).
4. Bir lot tek esekle 3.4 degil **4.2 dakika**, dort esekle ~50 degil **~63
   saniye** (§3.8).

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

**S0 duzeltmesi - limanin mesh merkezi yol/bina icin kapali bir hucrede.**
Olculdu: `port-secondage-level3`'un merkezi `(4.61, 17.91)`, ve uc nehir
blocker'inin ucunun de kutusuna giriyor:

| Blocker | Merkez | Kutu |
| --- | --- | --- |
| River Blocker 23 | `(5.2, 11.0)` | x[0.2, 10.2] z[6.0, 16.0] |
| River Blocker 24 | `(8.0, 15.2)` | x[3.0, 13.0] z[10.2, 20.2] |
| River Blocker 25 | `(11.1, 19.0)` | x[6.1, 16.1] z[14.0, 24.0] |

Bu blocker'lar yalnizca yuruyusu kesmiyor: `RtsApp.navigationBlockers()`
(`RtsApp.ts:3780`) **ve** `occupancyBlockers()` (`:3789`) ikisi de
`spatial.navigationBlockers`'i iceriyor, yani ayni kutular **yol hucresi ve bina
footprint'i** yerlesimini de reddediyor.

Sonuc: arz noktasi marker'i mesh merkezine konamaz. Marker rihtimin **kara
tarafindaki apronudur** ve kiyiya cekilir; mesh yerinde kalir. Olculen en yakin
temiz 8x8 rihtim `(-1, 20)` - mesh merkezinden 6.0 birim (3 yol hucresi). §7 Faz
S0 bunu kilitledi. Checklist'teki "liman zaten yerinde" ifadesi bu yuzden yalnizca
**mesh** icin dogruydu, marker icin degil.

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

Dogru cozum arz noktalarini **merkeze gore nokta-simetrik ciftler** halinde
authorlamaktir - her tur icin bir cift, biri her yakada.

**S0 duzeltmesi - bu haritanin mevcut konvansiyonu degil, yeni bir kuraldir.**
Once "sigir suruleri, kurt inleri ve stratejik noktalar hepsi nokta-simetrik"
yaziyordu. Olculdu, ve yalnizca yarisi dogru:

| Cift | Oyuncu yakasi | Dusman yakasi | Tam nokta-simetrik mi? |
| --- | --- | --- | --- |
| Geyik suruleri | `(-30, 22)` | `(30, -22)` | **Evet** |
| Sigir suruleri | `(-18, 14)` | `(18, -14)` | **Evet** |
| Kurt inleri | `(-45, -6)` | `(28, 6)` | Hayir |
| Stratejik noktalar | `(-25.7, -44.6)` | `(34, 54)` | Hayir |
| Guvenli deposit'ler | `(-22.9, 40.8)` tas | `(34, -20)` tas | Hayir |
| Korular | 3 cift, yaka-yaka | (ayni) | Yaklasik, tam degil |

Yani harita **yaka dengesi**ni tutarli sekilde gozetiyor (her turden bir ornek
her yakada), ama **tam nokta-simetri** yalnizca geyik ve sigirda var. Arz
noktalarinin ciftlenmesi bu yuzden bir *tekrar* degil, kasitli bir **yeni
kural**dir - ve gerekcesi haritanin aliskanligi degil, KARAR 4-A'dir: munhasir
bir kaynak asimetrik duramaz, cunku paylasilan bir kaynakta asimetri gecikmedir,
munhasir bir kaynakta **maci belirler**.

Bunun §8'e etkisi: "every trade site has a point-symmetric twin" testi mevcut bir
sozlesmeyi degil, yeni bir sozlesmeyi pinler; yalnizca `tradeSites` uzerinde
kosar (herd/deposit/stratejik nokta o testin kapsaminda **degildir**) ve elle
authorlanmis koordinatlar icin kucuk bir tolerans tasir.

Ciftler halinde authorlandiginda her krallik dogal olarak kendi ucunu tutar, ve
rakibinkini almak **nehri gecmeyi** gerektirir - yani uc gecidin birinden.
Ekonomik hedef boylece haritanin zaten var olan askeri darbogazina baglanir; yeni
bir mekanik icat edilmez.

**S0'da kapandi: uc cift = alti arz noktasi.** Alternatif, uc gecide konan uc
**ortak** nokta idi: her lotu tartismali kilardi ama ekonomiyi askeri darbogaza
fazla baglardi - ve pratikte uc degil **iki** gecit demekti, cunku orta gecit
(`dock-firstage` koprusu) kapsam disi. Secilen cozum alti noktadir; konumlar §7
Faz S0'da kilitlendi.

### 3.8 Olculen debi - naif ayarla bir lot ~4 dakika surer

**S0 duzeltmesi - iki sayi ve bir alanin yeri yanlisti.** Once "`logistics.json`:
`carryCapacity: 30`, `moveSpeed: 2.2`" yaziyordu. Olculen gercek:

| Alan | Plan once ne diyordu | Gercek | Nerede |
| --- | --- | --- | --- |
| `moveSpeed` | 2.2 | **1.76** | `logistics.json` |
| `loadSeconds` | 2 | 2 (dogru) | `logistics.json` |
| `spawnPerProducer` | 1 | 1 (dogru) | `logistics.json` |
| `carryCapacity` | `logistics.json`'da 30 | **`logistics.json`'da yok** | `buildings.json`, bina x kademe basina: 20/25/30/35/45/50/55 |

`carryCapacity`'nin yeri yalnizca bir dizin hatasi degil, §6.1'e is dusuren bir
bulgudur: yuk miktari **kervanin degil, hattin ucundaki ureticinin** alanidir ve
kademeyle buyur. Arz noktasi kademeli bir bina olmadigi icin miras alacagi bir
deger yoktur - bu yuzden **kendi `carryCapacity`'sini tasir** (§6.1, S0'da
kilitlendi). `market.lotSize: 100` dogruydu.

Mevcut limandan oyuncu merkezine (62.7 birim, §3.7) tek esekle, gercek sayilarla:

- Tek yon: 62.7 / 1.76 = **35.6 sn**
- Gidis-donus + iki duraklama: 71.2 + 4 = **75.2 sn**
- Debi: 30 birim / 75.2 sn = **~23.9 birim/dk**
- Bir lot (100 birim): **~4.2 dakika**

Uc kaynak icin ayni anda: uc ayri hat, uc ayri filo. Tek esekli ayarla oyuncu
dakikada ~0.24 lot alabilir - yani pazar pratikte kapalidir.

Bu, "sinirsiz alim" ile "pratikte hic alim yok" arasinda ikincisine cok yakin
duruyor. Sonuc bir tasarim hatasi degil, bir **ayar** sorusudur ve plan buna
kendi tunable'ini vermelidir (§6): arz noktasi kendi `caravanCount`'unu, kendi
`carryCapacity`'sini ve kendi uretim hizini tasir. Dort esekle ayni lot **~63
saniyeye** iner.

Duzeltmenin sonucu degistirmedigine dikkat: yanlis sayilarla da dogru sayilarla
da tek esek "pratikte hic", dort esek "oynanabilir" veriyor. Degisen yalnizca
buyukluk (~%25) - yani §6.1'in tunable'lari ayni gerekceyle ayni yerde duruyor.

Iki knob birbirine bagli ve bu bilincli: `perMinute` filonun tasiyabileceginin
uzerine cikarsa tampon surekli dolu kalir ve ilan edilen hiz bir yalan olur.
Cevap yeni bir kural degil, V4 §3.8'in zaten ogrettigi sey: tampon dolunca
uretim `buffer-full`'a duser ve panel bunu soyler. Oyuncu bunu "ikinci esek ekle
ya da pazari yaklastir" diye okur - ureticide ne okuyorsa.

Not: V4'un `carryCapacity <= localBufferCapacity` kurali arz noktasi icin de
gecerlidir - tampon arz noktasinin kendi `carryCapacity`'sinin altina inerse esek
her seferinde tamponu bosaltir ve "tampon dolu" baskisi kaybolur. Arz noktasinda
iki alan da **ayni tabloda** (`trade-sites.json`) durdugu icin bu kural tek
dosyadan dogrulanir; ureticide iki tablo gerekiyordu.

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

## 4. Tasarim Kararlari (Faz S0 - **KILITLENDI**, 2026-08-04)

Dokuz soru, dokuz oneri. **Dokuzunun da onerisi kabul edildi.** Alternatifler
(B secenekleri) kayit icin duruyor - neyin neden secilmedigini ileride okumak
icin, yeniden acmak icin degil.

| Karar | Kilit |
| --- | --- |
| 1 - Stok kimin | **A** - krallik basina tek havuz |
| 2 - Tukenir mi | **A** - yenilenebilir, hiz sinirli (`capacity` opsiyonel alan olarak semada durur) |
| 3 - Isci | **A** - hayir, isci istemez |
| 4 - Munhasirlik | **A** - munhasir; ilk baglayan tutar (§3.7 on kosuluyla, o da secildi) |
| 5 - Altin | **Hicbir sey** - bu planda altin icin yapilacak is yok |
| 6 - Yikilan pazar | **A** - stok kralliga ait, durur |
| 7 - Satilan mal | **A** - hayir, stoga girmez |
| 8 - Hangi kaynak stoklu | **Ucu de**; mekanizma veriden (`stocked` listesi) |
| 9 - AI paritesi | **A** - harita authoring, sifir AI kodu |

### KARAR 1 - Stok kralliga mi, binaya mi ait? -> **A KILITLENDI**

- **A - Krallik basina tek stok havuzu. ONERILEN.** Fiyat tablosu (KR-M2) ve
  komisyon (`commissionFor`) zaten krallik basina; stok da oyle olursa panel
  bastan sona tek olcekte konusur. Bir pazar yikilinca stok kaybolmaz, yalnizca
  ikmal durur.
- **B - Pazar binasi basina stok.** Kusatilan pazarin stogunu kaybetmek daha
  zengin, ama ayni panel yari-krallik yari-bina olur ve oyuncu hangi sayinin
  neye ait oldugunu okuyamaz (§3.2).

### KARAR 2 - Arz noktasi tukenir mi? -> **A KILITLENDI**

- **A - Yenilenebilir, hiz sinirli. ONERILEN.** Nehir baliklanir, saha kazilir;
  sinir **debi**dir, miktar degil. Planin butun gerilimi buradan gelir.
- **B - Sonlu (`resourceNode` gibi).** Tukenince arz noktasi olur ve pazarin
  alis tarafi kalici olarak kapanir - "tek seferlik ganimet"e geri donus.

Veri yine de `capacity`'yi **istege bagli** tasimalidir, boylece bir fork sonlu
saha authorlayabilir. Sablon `null` (yenilenebilir) gonderir.

### KARAR 3 - Arz noktasi isci ister mi? -> **A KILITLENDI**

- **A - Hayir. ONERILEN.** Limanin kendi balikcilari, sahanin kendi kazicilari
  vardir. Nufus saymaz, isci atanmaz. Karar tek bir seydir: **yolu cekmek**.
- **B - Isci atanir.** O zaman arz noktasi sadece "uzaktaki bir tarla"dir; pazar
  hicbir sey eklemez ve nufus tavanina yeni bir musteri gelir.

### KARAR 4 - Ayni arz noktasini iki krallik birden kullanabilir mi? -> **A KILITLENDI** (§3.7 kosulu da secildi)

- **A - Munhasir. ONERILEN.** Yolu ilk degdiren krallik noktayi tutar; rota
  koptugu anda (`route()` `null`) nokta serbest kalir. Rakipten almanin yolu
  **onun yolunu kesmektir** - V4 Faz 5 bunu zaten mumkun kiliyor. Yeni savas
  kodu gerekmez, `LogisticsOccupationSystem` deseni birebir kullanilir.
- **B - Paylasimli.** Her krallik kendi yolunu ceker, ikisi de alir. Guvenli ama
  arz noktasi bir **hedef** olmaktan cikar.

**A'nin on kosulu §3.7'dir.** Munhasir bir kaynak asimetrik duramaz - ve nehir
iki kralligi ayirdigi icin bugunku tek liman, tanimi geregi asimetriktir.

### KARAR 5 - Altin icin ne yapilacak? -> **Hicbir sey (bu planda). KILITLENDI**

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

### KARAR 6 - Pazar yikilinca / kopunca stok ne olur? -> **A KILITLENDI**

- **A - Stok kralliga ait, durur. ONERILEN.** (KARAR 1-A'nin dogal sonucu.)
  Kopan sey **ikmal**dir, stok degil.
- **B - Stok kaybolur.** KARAR 1-B secilirse zorunlu olur.

### KARAR 7 - Satilan mal alinabilir stoga eklenir mi? -> **A KILITLENDI**

- **A - Hayir. ONERILEN.** Satis, mali oyunun disina cikarir. B secilirse bir
  krallik **hicbir yol cekmeden** kendi stogunu doldurabilir - yani planin
  kaldirdigi seyin ta kendisi geri gelir. (Kar edilemez; `assertNoArbitrage`
  bunu zaten garanti eder. Sorun kar degil, **arz zincirinin atlanmasi**dir.)
- **B - Evet, satilan mal stoga girer.**

### KARAR 8 - Hangi kaynak stok ister? -> **Ucu de; mekanizma veriden. KILITLENDI**

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

### KARAR 9 - AI paritesi nasil saglanir? -> **A KILITLENDI**

- **A - Harita authoring. ONERILEN.** Dusmanin arz noktasi, mevcut
  `enemyBaseRoute` / `enemyExpansions` iskeletiyle bagli sekilde authorlanir.
  Sifir AI kodu, tam parite (§3.9).
- **B - AI'ya arz yolu kurma kurali yazilir.** `aiEconomyManager`'a yeni bir
  intent, yeni bir yol planlayicisi ve yeni bir debug satiri - kapsami iki
  katina cikarir.

### Kapsam disi (bu plana sizmayacaklar) - **S0'da teyit edildi**

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
| `public/assets/ThreeAges/Levels/RTS_GameplayProof.level.json` | **Alti** marker (uc tur x iki yaka) ve dusman yakasinin liman mesh'i; koordinatlar §7 Faz S0'da kilitli |
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

`carryCapacity` **S0'da eklendi**: §3.8'in olctugu gibi bu alan bugun
`logistics.json`'da yok, `buildings.json`'da bina x kademe basina duruyor. Arz
noktasi kademeli bir bina olmadigi icin miras alacagi bir deger yok, bu yuzden
kendi degerini tasir - ve boylece `bufferCapacity >= carryCapacity` kurali tek
tablodan dogrulanabilir.

```jsonc
{
  "river_port": {
    "label": "Nehir Limani",
    "resourceId": "food",
    "perMinute": 60,
    "carryCapacity": 30,
    "bufferCapacity": 120,
    "caravanCount": 4,
    "dock": { "width": 8, "depth": 8 }
  },
  "timber_camp": {
    "label": "Bagimsiz Oduncu Kampi",
    "resourceId": "wood",
    "perMinute": 80,
    "carryCapacity": 30,
    "bufferCapacity": 120,
    "caravanCount": 4,
    "dock": { "width": 8, "depth": 8 }
  },
  "stone_pit": {
    "label": "Tas Sahasi",
    "resourceId": "stone",
    "perMinute": 40,
    "carryCapacity": 30,
    "bufferCapacity": 120,
    "caravanCount": 4,
    "dock": { "width": 8, "depth": 8 }
  }
}
```

| Alan | Deger | Gerekce |
| --- | --- | --- |
| `perMinute` | 60 / 80 / 40 | Siralama talebi izler (§3.6): odun en cok alinan, tas en pahali (`basePrice` 20, digerlerinin iki kati - ayni altin daha az birim tas alir, o yuzden daha yavas dolmasi yeterlidir). Odunun 80'i, sahip olunan `lumber_camp`'in 120/dk'sinin **altinda** kalir; arz noktasi koru kesmenin yerini almaz, korusu tukenmis ya da henuz kamp kuramamis kralligin cikis kapisi olur |
| `carryCapacity` | 30 | Ureticinin orta kademesiyle ayni (`buildings.json` 20..55 arasi verir). Arz noktasi yukselmedigi icin tek bir deger yeter; 30 filo aritmetigini de temiz tutar |
| `bufferCapacity` | 120 | `carryCapacity` (30) x `caravanCount` (4) - butun kervan filosu ayni anda yuklenebilir, ve V4'un `carryCapacity <= bufferCapacity` kurali saglanir. Iki alan da bu tabloda oldugu icin iliski **tek dosyadan** turetilir |
| `caravanCount` | 4 | §3.8'in olcusu: 4 esek bir lotu ~63 saniyeye indirir. Tek esekle ~4.2 dakika, ki bu "pratikte hic" demektir |
| `dock` | 8x8 | Pazarin footprint'i ile ayni; yolun degecegi kenar yeterince genis. Alti konumun altisi da bu olcuyle temiz olculdu (§7 Faz S0) |
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

Ayni yuk esegi, ayni hiz (`moveSpeed: 1.76`), ayni yukleme suresi. Filo
buyuklugu arz noktasinin kendi `caravanCount`'undadir, cunku bu bir **lojistik
hatti** ozelligidir, hayvanin degil.

**S0 duzeltmesi.** Burada once "ayni kapasite" yaziyordu, ama miras alinacak bir
kapasite yok: `carryCapacity` `logistics.json`'da bulunmuyor, `buildings.json`'da
bina x kademe basina duruyor (§3.8). Yani yuk miktari zaten hayvanin degil,
**hattin ucundaki tesisin** alani - ve arz noktasi kademelenmedigi icin kendi
sabit degerini tasir (§6.1). Bu, §6.4'un kuralini bozmuyor, ayni kurali
`carryCapacity`'ye de uyguluyor: dosya yine degismiyor.

## 7. Fazlar ve Checklist

### Faz S0 - Karar kilidi -> **TAMAM (2026-08-04)**

- [x] KARAR 1 (stok kimin) kilitlendi. -> **A**, krallik basina tek havuz.
- [x] KARAR 2 (tukenir mi) kilitlendi. -> **A**, yenilenebilir; `capacity`
  opsiyonel alan olarak semada durur.
- [x] KARAR 3 (isci) kilitlendi. -> **A**, isci istemez.
- [x] KARAR 4 (munhasirlik) kilitlendi. -> **A**, ilk baglayan tutar.
- [x] KARAR 5 (altin) kilitlendi. -> **Hicbir sey**; altin kervani ayri plan.
- [x] KARAR 6 (yikilan pazar) kilitlendi. -> **A**, stok durur.
- [x] KARAR 7 (satilan mal) kilitlendi. -> **A**, stoga girmez.
- [x] KARAR 8 (hangi kaynak stoklu) kilitlendi. -> **Ucu de**, liste olarak.
- [x] KARAR 9 (AI paritesi) kilitlendi. -> **A**, harita authoring.
- [x] §3.7'nin harita cozumu secildi. -> **Uc nokta-simetrik cift (alti nokta).**
  Uc ortak nokta secilmedi: orta gecit kapsam disi oldugu icin pratikte uc degil
  iki nokta olurdu, ve ekonomi askeri darbogaza fazla baglanirdi.
- [x] Alti marker konumu secildi ve olculdu (asagidaki tablo). Liman **yerinde
  degildi**: mesh merkezi uc blocker'in icinde, marker kiyiya cekildi (§3.3).
- [x] §4 kapsam disi listesi teyit edildi - hicbiri sizmayacak. Cag/seviye gorsel
  yukseltmesi de disarida kaldi.
- [x] **Ek kilit (§3.8'in bulgusu):** arz noktasi kendi `carryCapacity`'sini
  tasir; `logistics.json` degismez (§6.1, §6.4).

#### Kilitlenen marker konumlari

Alti konumun altisi da olculdu: 8x8 rihtim hicbir nehir blocker'i, agac, deposit,
build anchor, expansion marker ya da suru ile cakismiyor; hicbiri bir nehir
gecidine 16 birimden yakin degil (yani hicbiri gecit kapatmiyor).

| Tur | `resourceId` | Oyuncu yakasi | Dusman yakasi | Kendi merkezinden yol | Karsi merkezden |
| --- | --- | --- | --- | --- | --- |
| Liman | `food` | `(-1, 20)` | `(1, -20)` | 120 / 112 odun | 196 / 204 odun |
| Oduncu kampi | `wood` | `(-8, 50)` | `(8, -50)` | 84 / 84 odun | 268 / 276 odun |
| Tas sahasi | `stone` | `(-28, 6)` | `(28, -6)` | 92 / 84 odun | 220 / 228 odun |

Konumlarin gerekceleri:

- **Liman.** Mesh `(4.61, 17.91)`'de kalir; marker onun kara tarafindaki
  apronudur, 6.0 birim (3 hucre) uzakta. Kiyiya en yakin temiz simetrik 8x8
  budur (§3.3). Dusman yakasi icin ayni mesh `(-4.61, -17.91)`'e aynalanir.
- **Oduncu kampi.** Merkezi koru ciftinin kenarinda: `(-8, 50)` south-grove'a
  8.9 birim, aynasi `(8, -50)` north-grove'a 6.3 birim. Kralligin **kendi**
  korusunun dibi degil - orasi yol karari uretmezdi. 84 odunla en ucuz hat,
  ki §3.6'nin kisir dongusune (odun almak icin odun harcamak) karsi kasitli.
- **Tas sahasi.** `(-28, 6)`, mevcut `external_stone` deposit'ine 11.7 birim -
  yani harita zaten orayi "tas bolgesi" diye okutuyor. Ileri bir konum
  (z-x = 34, nehre yakin), 92 odun.

Ayrica olculdu ve KARAR 9-A icin **isi kolaylastiriyor**: dusman yakasindaki
liman `(1, -20)` `enemy_west production` marker'ina 9.8 birim, oduncu kampi
`(8, -50)` `enemy_west depot`'a 10.2 birim. Yani AI'nin authored yol iskeleti
zaten bu noktalarin yanindan geciyor; parite icin cekilecek yol kisa.

Kabul: dokuz kararin hicbiri kod yazilirken yeniden tartisilmaz. **Verildi.**
Gorsel kabul (olcek, rihtimin yola degdigi kenar) S2'ye ait ve kullanicidadir.

### Faz S1 - Stok cekirdegi (oynanis yok) -> **TAMAM (2026-08-04)**

- [x] `marketStock.ts`: krallik x kaynak stogu; `credit` / `withdraw` /
  `amount`; negatif ve NaN reddi. Withdraw **atomiktir** - yetmezse hicbir sey
  kimildamaz, cuzdanin `exchange`'iyle ayni sozlesme.
- [x] `MarketBalance.stocked` tipi + validator (`basePrice`'ta olmayan id
  reddedilir; bos liste gecerlidir; alan **istege bagli** ve yoklugu `[]`
  demektir, yani eski veri dokunulmadan calisir).
- [x] `MarketTradeResult`'a `out-of-stock`; `buy()` stoklu kaynakta stok
  yetmiyorsa **cuzdana dokunmadan** reddeder ve endeksi **oynatmaz**.
- [x] Panel stogu gosterir; dugme kapaliysa nedeni yazar - ve **eksigi**
  adlandirir ("Pazarda stok yok: 99/100"), cunku oyuncunun bilmesi gereken sey
  yolun calisip calismadigi.
- [x] `buildings.json` bu fazda **`"stocked": []`** gonderir.
- [x] AI dogrulandi (§3.9): `out-of-stock` `no-completed-market`/`disconnected`
  olmadigi icin `aiTradeManager.ts:152`'de kod degismeden `saving`'e dusuyor.

Kabul: makine tamdir ama **hicbir kaynak stoklu degildir**, yani oyun bit bit
bugunku gibi oynanir. `tsc --noEmit`, `test:engine` (1294 check), `build:verify`,
`check:assets` - **dordu de yesil.**

Kirmiziya donebilirlik yapildi: alti kasitli mutasyon, altisi da yakalandi -
stok kapisinin kaldirilmasi, stogun dusulmemesi, satisin stogu doldurmasi
(KARAR 7-A), validator'un fiyatsiz id kabul etmesi, panelin bos rafi
gormezden gelmesi, stogun eksiye inmesi. Her biri hedefledigi assertion'la
kirmizi dondu ve geri alindi.

**S1'de olcuyu degistiren bir sey:** `marketStock.ts` ilk yazildiginda bir
`snapshotFor` tasiyordu; panelin onu hic cagirmadigi ortaya cikti (panel kaydi
`balance.stocked` uzerinden kuruluyor, cunku **stoklu ama bos** ile **stoklu
degil** ayri gorunmek zorunda). Olu kod birakmak yerine kaldirildi ve neden
olmadigi dosyaya yazildi.

Bos liste tesaduf degil, planin geri alma kolu (KARAR 8): uc kaynak da stoklu
oldugu icin (§3.6) listeyi erken doldurmak, arz zinciri gelene kadar pazarin
alis tarafini **tamamen** kapatirdi. Liste S3'un basinda tek satirla doldurulur
ve gerekirse ayni satirla geri alinir. §8'in "every priced resource is stocked"
testi de bu yuzden S1'de **yok**: S1'in kendi testi tam tersini pinliyor
(`stocked === []`), ve S3 o satiri doldururken bu iki test yer degistirir.

### Faz S2 - Arz noktasi haritada (ekonomi degismedi) -> **TAMAM (2026-08-04)**

- [x] `BP_RTS_TradeSite` marker Actor'u + manifest girdisi
  (`threeages-rts-trade-site-marker`).
- [x] `RtsTradeSiteDefinition` + `rtsLevelAdapter` okumasi + blockout alani
  (+ `rtsSpatialLayout` alani).
- [x] `trade-sites.json` + `TradeSiteBalance` + `validateTradeSiteBalance` +
  editor Data Table girdisi ("Arz Noktasi Dengesi").
- [x] Level'da alti marker: liman `(-1,20)`/`(1,-20)`, oduncu kampi
  `(-8,50)`/`(8,-50)`, tas sahasi `(-28,6)`/`(28,-6)` (§7 Faz S0'da kilitli).
  Liman mesh'i `(4.61,17.91)`'de kaldi; dusman yakasi icin `(-4.61,-17.91)`'e
  aynalandi (yaw 120 -> 300, ayni olcek 3).
- [x] Oduncu kampi ve tas sahasi icin gorsel secimi. Yeni varlik uretilmedi;
  mevcut StaticMesh katalogundan, her biri iki yakada:
  oduncu kampi = `resource-pinetree-group-cut` (olcek 3) + `logs` (olcek 3),
  tas sahasi = `mine` (olcek 3) + `rock-group` (olcek 2.5).
- [x] `tradeSiteSystem.ts`: tampon dolar, **hicbir yere gitmez**.
- [x] Marker'in ayagi altindaki zemin: `dockBlockers()`, `liveNodeBlockers`'in
  ikizi. Rihtim hem bina yerlesimine hem yol hucresine kapali - ikisi de
  `RtsApp`'in iki blocker listesine baglandi. **Yol rihtime disaridan degecek**
  (S3'un `roadCellTouchingFootprint`'i), o yuzden rihtimin *ustunun* yola da
  kapali olmasi dogru olan: uzerinden gecen bir yol, baglantiyi kuran kenari
  isgal ederdi.
- [x] Hicbir arz noktasi bir nehir gecidini kapatmiyor - **secilen mesh'lerle
  yeniden olculdu** (asagida). Ayrica rihtimlerin hicbiri agac, deposit, build
  anchor ya da expansion slot'una degmiyor; bu da teste baglandi.
- [x] Liman marker'i mesh merkezinde **degil** (§3.3). Marker `(-1,20)`, mesh
  `(4.61,17.91)` - 6.0 birim. Aynasi ayni bagintiyi tasiyor.

Kabul: `?rts` Play'de alti arz noktasi da haritadadir, tamponu dolar ve
**durur**. Ekonomi S1 oncesiyle bit bit ayni (`stocked` hala `[]`).
`tsc --noEmit`, `test:engine` (1298 check), `build:verify`, `check:assets` -
**dordu de yesil**; `check:assets` yalnizca marker'in thumbnail'i icin uyariyor,
ki diger yedi RTS marker'i da ayni uyariyi tasiyor.

`smoke:browser`'in RTS baseline spec'i de kosuldu: sekiz testin **yedisi yesil**
(iki ayri boot yolu, sifir runtime hatasi, authored Level + landscape mount).
Sekizincisi - "Landscape Faz 5: command and build placement picking work over the
mounted landscape" - kirmizi, ama **bu plandan once de kirmiziydi**: degisiklikler
stash'lenip temiz agacta tekrar kosuldu, ayni yerde ayni sekilde dustu
("Yerlesim" dugmesine tiklama zaman asimina ugruyor). S2'nin urunu degil; ayri
bir is olarak durmali.

**Gorsel kabul kullanicida acik** - olcek, rihtimin yola degecegi kenar, ve
ozellikle asagidaki 0.40'lik pay.

#### S2'de olculenler

**Mesh'lerin gecit payi.** S0'un on olcumu 8x8 rihtimi baz aliyordu; asil soru
secilen mesh'lerdi. Her yerlestirmenin kosegen erisimi ile en yakin gecidin
yarim genisligi karsilastirildi (ikisi de kasitli olarak comert):

| Yerlestirme | Konum | Dunya olcusu | En yakin gecide pay |
| --- | --- | --- | --- |
| Liman (oyuncu) | `(4.61, 17.91)` | 8.0 x 8.6 | 10.10 |
| **Liman (dusman)** | `(-4.61, -17.91)` | 8.0 x 8.6 | **0.40** |
| Tas sahasi mesh'leri | `(±28, ∓6)` civari | ~3.9 x 4.1 | 13.9 - 21.2 |
| Oduncu kampi mesh'leri | `(∓8, ±50)` civari | ~4.5 x 4.4 | 36.6 - 39.5 |

Aynalanan liman **0.40 birimle** en dar paya sahip, ve sebebi ayna degil
haritanin kendisi: orta gecit `(-3.5, -4.1)`'de, yani **merkezde degil**. Ayna
mesh'i kendi marker'ina oyuncu tarafiyla birebir ayni bagintida durur, ama gecide
o kadar yakin duser. Uc gerekce onu birakmayi destekliyor: (1) mesh bir
**gorseldir**, `navigationBlockers` uretmez, yani yuruyus genisligi tanimi geregi
degismedi; (2) olcumun kendisi comert - gecit genisligi blocker *merkezleri*
arasi mesafe, gercek acikligi bundan ~10 birim dar; (3) `dock-firstage` koprusune
13.6 birim var, yani ortusme yok. Yine de **bu, S2'nin en dar sayisidir ve gorsel
kabulun ilk bakacagi yerdir**; rahatsiz ederse cozum mesh'i nehir asagi 2-3 birim
kaydirmaktir, marker'a dokunmadan.

**Planin harfinden iki sapma** (ikisi de bilincli, ikisi de dar):

1. **Marker `resourceId` degil `siteType` tasiyor.** §5.1 marker'in
   (`resourceId`, `siteId`, rihtim olcusu) tasidigini yaziyordu, ama §5.3 ayni
   anda "hiz/tampon/kervan sayisi `trade-sites.json`'a gider" diyor - ve rihtim
   olcusu §6.1'de zaten o tablodadir. Ikisini birden tutmak, Level'in "food"
   derken tablonun "wood" demesini mumkun kilardi: sahibi olmayan bir celiski.
   Marker `siteId` + `siteType` tasir; kaynak, hiz, tampon ve rihtim tek yerde,
   tabloda durur. §5.3'un kurali ("Level yalnizca nerede ve hangi tur soyler")
   boylece tam olarak korunur.
2. **`siteType`'i tabloya karsi dogrulayan yer adapter degil sistemdir.**
   `adaptRtsLevel` marker'in *seklini* dogrular (bos olmayan id, tekil id);
   bilinmeyen bir tur `TradeSiteSystem` kurucusunda patlar - `ResourceNodeSystem`
   bilinmeyen `resourceId` icin ne yapiyorsa aynen o. Alternatif, `adaptRtsLevel`
   imzasina besinci bir balans tablosu eklemek ve on bes cagri yerini
   guncellemekti; ayni hatayi ayni yuksek sesle veren, daha ucuz yol bu.

**Iki harita disarida kaldi.** `RTS_BLOCKOUT_MAP` ve `RTS_CoreMatch` icin
`tradeSites` bos birakildi. S0'un alti konumu `RTS_GameplayProof`'un nehri,
korulari ve deposit'lerine gore olculdu; o haritalarda ayni olcum yok, ve
**munhasir** bir kaynagi olculmemis zemine gozle koymak §3.7'nin "maci belirler"
dedigi asimetrinin ta kendisidir. Bunun S3'e dusen sonucu su: `stocked` listesi
dolduruldugunda o iki haritada pazarin alis tarafi kalici olarak kapali kalir.
Varsayilan preset (`gameplay_proof`) zaten `RTS_GameplayProof`'u aciyor, ama S3
bu iki haritayi ya olcup authorlamali ya da acikca kapsam disi ilan etmelidir.

**Testler (§8'den bu fazda pinlenenler).** Dordu de kasitli mutasyonla bir kez
kirmizi gorulup geri alindi:
`a trade site buffer holds at least one caravan load`,
`every priced resource has a supply site in this project's data`,
`every trade site has a point-symmetric twin`,
`no trade site blocks a river crossing`, artisi tampon tavani, rihtim
geometrisi, bilinmeyen tur/tekrarli id reddi, ve "her tur haritada authorlanmis
mi". Bir de tuning degil **iliski** olarak: oduncu kampi arz noktasinin hizi
(80/dk) sahip olunan `lumber_camp`'in acilis hizinin (3 x 40 = 120/dk) **altinda**
kalmalidir (§3.6) - iki taraf da tablodan turetiliyor.

### Faz S3 - Baglanti ve kervan -> **KOD TAMAM (2026-08-04), oynanis kabulu kullanicida**

Onkosul: yok. V4 Faz 3-4 tamamlandi (§3.4); Faz 5'in gorsel kabulu bu plani
engellemedi.

- [x] `CaravanSystem` `CaravanLane` soyutlamasina alindi (§3.4). Yeni dosyalar:
  `logistics/caravanLane.ts` (hat + saglayici sozlesmesi) ve
  `logistics/producerCaravanLanes.ts` (V4 hatti, **kural degismeden** tasindi -
  `destinationFor` dahil). Bu adim tek basina kosuldu ve **1298 check yesil**
  dondu: sifir oynanis degisikligi.
- [x] `marketSupplySystem.ts`: arz noktasi -> pazar durum cozumu
  (`unlinked-road` / `unlinked-market` / `outside-control` / `claimed-by-enemy` /
  `linked`), ikinci hat saglayicisi olarak.
- [x] Teslim **stoga** (cuzdana degil); `laneId` uzerinden ayrisir.
  `TradeSiteSystem.withdrawBuffered` eklendi (ureticinin ikizi, **varista**
  cekiyor).
- [x] `buildings.json` `"stocked": ["food", "wood", "stone"]`'a cevrildi. S1'in
  `stocked === []` testi ile S3'un "her fiyatlanan kaynak stoklu" testi §7 Faz
  S1'de ongoruldugu gibi **yer degistirdi**.
- [x] Munhasirlik (KARAR 4-A): ilk baglayan tutar, **rota** kopunca serbest
  kalir. Kontrol (kusatma) sahipligi dusurmez - yalnizca teslimi durdurur.
- [x] Yol kesilince V4 KARAR 5 davranisi aynen gecerli: esek eve doner, yuk
  arz noktasinin tamponunda kalir (varista cekildigi icin geri yazilacak bir sey
  yok).

Kabul: `tsc --noEmit`, `test:engine` (**1303 check**), `build:verify`,
`check:assets` - **dordu de yesil**. Oynanis kabulu (yol cekilir, esekler
limandan pazara yurur, stok dolar ve alis dugmesi acilir) **maci oynayan
kullanicida**.

Kirmiziya donebilirlik yapildi: dort kasitli mutasyon, dordu de yakalandi -
filonun tek yuke uzusmesi, tamponu bosaltmayan cekim, kopan yolda ayakta kalan
sahiplik, rafa hic ulasmayan teslim. Her biri hedefledigi assertion'la kirmizi
dondu ve geri alindi.

#### S3'te olculenler - kodun ortaya cikardigi uc sey

**1. Filo kilitlenmesi (`claimed`).** Plan §3.8 "dort esek bir lotu ~63 saniyeye
indirir" diyor. Kod yazilinca gorundu ki V4'un `dispatch` sozlesmesi bunu
veremezdi: `CaravanSystem` yuk durumunu **hat basina bir kez** soruyordu ve
`spawnPerProducer: 1` oldugu icin bu hic fark etmemisti. Dort esekle fark her
seyi belirliyor - dordu de ayni "bir tam yuk hazir" cevabini alip **birlikte**
cikiyor ve aralarinda tek yuk tasiyorlardi.

Sebep V4'un dogru bir kurali: yuk tampondan **varista** dusulur (KARAR 5 - geri
donen esek yuku birakti yerde birakmali). Yani yoldaki yuk hala tamponda
gorunur. Cozum `dispatch(lane, claimed)`: saglayiciya "bu hatta kac esek zaten
dusulmemis yuk tasiyor" soylenir, ve arz noktasi `buffered >= carryCapacity *
(claimed + 1)` ister. Uretici hatti `claimed`'i **gormezden gelir** - V4
davranisi birebir korunur.

Onemli olan sey: **korunum testi bunu yakalamadi.** `withdrawBuffered` kismi yuk
dondurdugu icin hicbir sey kaybolmuyordu, yalnizca debi tekliyordu. Yakalayan
sey bir esitsizlik oldu: `buffered >= carryCapacity * outbound`, her karede.
Kisa test rotasinda (10 birim) fark gorunmuyor; haritanin gercek mesafelerinde
(gidis-donus 70-140 sn) tampon tavana vurup uretimi durduruyor - yani §3.8'in
uyardigi "ilan edilen hiz bir yalan olur" durumu.

**2. El degistiren arz noktasinin esekleri.** Munhasirlik testi yazilana kadar
gorunmedi: hat kimligi `supply:<siteId>` oldugu icin, arz noktasi el
degistirdiginde **eski sahibinin esekleri ayni hatta kaliyordu**. `owner`
kervanda kuruluma sabitlendigi icin her varis `owner mismatch` ile sessizce
dusuyordu - yani nokta el degistiriyor ama yeni sahip **hicbir zaman mal
alamiyordu**. Ayrica dusman akincisi icin bayrak da yanlis kaliyordu
(`isCaravanAttackable`). Cozum: kervan kimligine sahip eklendi
(`caravan:<lane>:<owner>:<index>`), boylece eski filo mevcut "eve yuru" yolundan
emekliye ayriliyor ve yenisi doguyor. Yeni kural degil, var olan makinenin
dogru anahtarlanmasi.

**3. `outside-control` ne demek oldu.** §7'nin durum listesi bu adi tasiyordu
ama karsiligi yaziliyken secildi: **teslim alacak pazarin kontrol disi olmasi**
(KR-M4'un ayni yuklemi). Munhasirlik bundan **ayri** tutuldu: kusatilan pazar
teslim alamaz ama arz noktasini kaybetmez, cunku noktayi tutan sey **yol**dur
(KARAR 4-A). Ikisini birlestirmek, bir pazari kusatmayi ayni anda rakibin
limanini almak yapardi - plan bunun yolu olarak yol kesmeyi secmisti.

Ayrica `claimed-by-enemy` bir **noktanin** durumu olamaz (noktanin tek sahibi
vardir); soran kralliga gore bir olgudur. `snapshots()` dort durumu uretir,
`statusFor(siteId, owner)` besincisini.

#### Planin harfinden bir sapma (bilincli, dar)

**`CaravanLane.destination` null olabilir.** §3.4'un taslaginda zorunlu. Ama V4,
deposu ve merkezi ayni anda kalmamis bir kralligin yoldaki esegini **eve
yurutuyordu**; hedefi cozulemeyen hatti listeden dusurmek onlari yolun ortasinda
silerdi. §7 Faz S3'un kendi kurali ("uretici hatti davranisi bit bit korunur")
taslak imzadan agir bastigi icin alan null'lanabilir birakildi ve `CaravanSystem`
hedefi olmayan hattan kervan **dogurmaz**, ama o hattin `source`'unu eve yuruyus
icin kullanir.

#### S3'ten sonra acik kalan tek sey - ve neden kapsam disi birakildi

`RTS_BLOCKOUT_MAP` ve `RTS_CoreMatch` hala `tradeSites: []` (S2'nin notu). S3
`stocked`'i doldurdugu icin **o iki haritada pazarin alis tarafi kalicidir
kapali**. Etkilenen tek yol `?preset=debug_fast` (levelRef'i yok, kod
blockout'una duser); shipped varsayilan `gameplay_proof` ve `siege_test`'in
ikisi de `RTS_GameplayProof`'u aciyor, `RTS_CoreMatch` ise `main.ts:119`'un
dedigi gibi preset degil kod-ayna test verisi.

S2'nin verdigi iki secenekten **acikca kapsam disi** secildi, ve gerekcesi
S2'nin kendi gerekcesi: alti konum `RTS_GameplayProof`'un nehrine, korularina ve
deposit'lerine gore olculdu; o haritalarda ayni olcum yok ve **munhasir** bir
kaynagi olculmemis zemine gozle koymak §3.7'nin "maci belirler" dedigi
asimetrinin ta kendisidir. Bir debug preset'inin alis dugmesi, olculmemis bir
haritaya munhasir liman koymaktan ucuz bir bedeldir. Kullanici tersini isterse
is, S0'un olcum turunu o iki harita icin tekrarlamaktir - kod degil, olcum.

### Faz S4 - AI paritesi -> **TAMAM (2026-08-05)**

- [x] KARAR 9-A uygulandi: **sifir AI kodu**. Dusmanin arz yolu, mevcut
  `rts.route:enemy:base:0` omurgasinin **kuyruguna** on bes nokta eklenerek
  authorlandi (`RTS_GameplayProof.level.json`). Kuyruk dort ucu bagliyor: once
  pazar, sonra liman, oduncu kampi ve tas sahasi. Hicbir `.ts` dosyasi
  degismedi - `AiInfrastructureManager` bu polyline'i zaten yuruyor.
- [x] AI'nin `out-of-stock` aldiginda kirilmadigi dogrulandi (§3.9). Bu aslinda
  **S3'te kapanmisti**: `Faz M4` testi zaten "an unsupplied market delays the AI
  instead of jamming it" diye pinliyor. S4 eksik olan yari eklendi - **dusman
  sahipli** bir hat ucu ucuna kosuldu (asagida).
- [x] AI'nin Cag 2'ye hala ulasabildigi **olculdu** (asagida). Kilitlemiyor:
  alis kapali kalsa da AI 1065.5 saniyede Town'a cikiyor.

#### Authorlanan kuyruk ve olcumleri

Kuyruk, omurganin son noktasindan (`(50,-34)`, oduncu kampi) sonra basliyor:

| Bacak | Noktalar | Yeni hucre | Odun |
| --- | --- | --- | --- |
| Pazar | `(46,-34) -> (46,-30) -> (44,-30) -> (44,-56)` | 13 | 52 |
| Liman | `(44,-30) -> (22,-30) -> (22,-28) -> (6,-28) -> (6,-26)` | 9 | 36 |
| Oduncu kampi | `(6,-28) -> (6,-44)` | 8 | 32 |
| Tas sahasi | `(6,-28) -> (18,-28) -> (18,-10) -> (22,-10)` | 11 | 44 |

Ilk uc nokta (`(46,-34) -> (46,-30) -> (44,-30)`) bilerek acik yazildi: omurga
`(48,-30)`'daki dis yatak yuzunden orada zaten kiviriyor, ve tek bacakla
`(50,-34) -> (44,-30)` istendiginde A* yeni bir hucreyi `(44,-28)`'e - yani
authored `gold_mine` yuvasinin ustune - koyuyordu. Uc kisa bacak ayni yere
**sifir odunla** ve deterministik olarak variyor.

Statik olcum (omurga, RtsApp'in yol blocker kumesiyle bastan sona doseniyor:
nehir + koru + yatak + rihtim + iki merkez):

| Olcu | Once | Sonra |
| --- | --- | --- |
| Omurganin odunu | 108 | **272** (+164) |
| Omurganin hucresi | 27 | **68** |
| Pazara degen yol hucresi | **yok** | `(44,-56)` |
| Limana / oduncu kampina / tas sahasina degen | **yok** | `(6,-26)` / `(6,-44)` / `(22,-10)` |
| Arz noktasi -> pazar rotasi | - | 68 / 82 / 76 birim |

Uc rota uzunlugu §3.8'in oyuncu icin olctugu 62.7 birime yakin duruyor - yani
AI'nin hatti oyuncununkinden **kisa degil**, biraz uzun. Kuyrugun hicbir hucresi
authorlanmis bir bina yuvasina degmiyor, ve oyuncunun uc arz noktasi omurgadan
**dokunulmadan** kaliyor (ikisi de teste baglandi): munhasir bir kaynakta
(KARAR 4-A) dusmanin yolunun oyuncunun rihtimina degmesi, o noktayi bedavaya
dusmana verirdi.

#### Sira bir detay degil, kilitlenmeme sartinin ta kendisi

Kuyruk **sona** eklendi ve testi de bunu pinliyor. `AiInfrastructureManager`
polyline'i sirayla yuruyor ve `insufficient-resources`'ta bekliyor; arz kuyrugu
one alinsaydi AI acilis odununu **henuz kurmadigi** bir pazara giden yola
harcarken kendi ureticileri yolsuz beklerdi - gecikmenin kilide donusmesi tam
olarak budur. Test bu yuzden bir sayi degil bir **sira** pinliyor: depo, tarla
ve oduncu kampi yolda olmadan hicbir arz hucresi dosenemez. Kasitli olarak
kuyrugu basa alarak kirmizi gorulup geri alindi (`leg 4 vs 2`).

#### Olculen: stok kapisi Cag 2'yi kilitlemiyor

Mevcut basi bos AI dunyasi (`aiTestWorld`, kod blockout'u - orada **hic arz
noktasi yok**, yani alis tarafi bastan sona kapali) 1800 saniye kosuldu:

| Olcu | Sonuc |
| --- | --- |
| Town'a cikis | **1065.5 sn** |
| `tradeStep` dagilimi | `idle` 1480 / `saving` 2084 / `traded` 36 |
| Kurulan binalar | depo, tarla, oduncu kampi, avci kampi, agil, kisla, karakol, tas ocagi, altin madeni, **pazar**, ev x4, okculuk, + bir genisleme |

Uc sey birden okunuyor. (1) Alis kapaliyken bile AI Town'a cikiyor - kapinin
kilit olmadigi gozlem, varsayim degil. (2) Otuz alti ticaret **satis**: AI'nin
gercek acigi altinda ve satis tarafina KARAR 7-A geregi hicbir sey olmadi, yani
stok kapisi AI'nin en cok kullandigi yonu hic tutmuyor. (3) Kalan `saving`'ler
kirilma degil bekleme - `AiTradeManager` her tikte yeniden deniyor.

Odun tarafi da ayni yonu veriyor: kuyrugun 164 odunu, AI'nin acilis
`lumber_camp`'inin (§3.6: 120 odun/dk) **~82 saniyesi**, ve omurga baglandiktan
**sonra** odeniyor.

#### S4'te bulunan gercek hata - ve once yanlis raporlanan bir bulgu

**Once geri cekilen bulgu.** S4 ilk raporunda "dusman merkezine degen yol hucresi
yok" yaziyordu. **Yanlisti, olcum hatasiydi**: gecici harness merkezin
footprint'ine 7 (nav blocker'in `COMMAND_CENTER_FOOTPRINT` sabiti) veriyordu, ama
`roadCellTouchingFootprint`'in okudugu sey `CommandCenter.stats.footprint`, yani
`buildings.json`'daki **8x8** satir. Sekizle hesap tutuyor: `(38,-32)` hucresi
`|Δz| = 6`, `6 - 4 - 1 = 1` ile tam toleransta - merkez omurganin **ilk
bacagindan** itibaren yola degiyor. Merkez yerinde kaliyor, degistirilecek bir
sey yok. (Ders: iki footprint var - blocker'in 7'si, balans satirinin 8'i - ve
hangi sorunun hangisini okudugu onemli.)

**Gercek hata ise daha buyuktu ve dordu birden yuvaydi.** Omurga `(48,-30)`'daki
agacin (`enemy-wood-1`) etrafindan dolanmak zorunda - `(50,-30)`'un tek serbest
komsusu `(50,-28)`, cunku `(48,-30)`, `(50,-32)` ve `(52,-30)` uc ayri agac. Bu
dolanma `(46,-28)`'i dosuyor ve o hucre dusmanin **tek** `gold_mine` yuvasiyla
(`(44,-26)`) cakisiyordu. Ayni taramada uc `house` yuvasi da (`(50,-44)`,
`(54,-44)`, `(50,-48)`) **canli agaclarin** ustunde cikti.

Bunlar sessiz degil, kalici kayiplar: yol insa alanini rezerve ediyor,
`AiBuildManager` reddedilen bir yuvayi `AI_ANCHOR_FAILURE_LIMIT` (3) denemeden
sonra **mac boyunca** kara listeye aliyor, ve ne omurganin ne de yuvalarin
birbirine karsi test edildigi bir yer vardi. Sonuc: AI **hic altin madeni
kuramiyordu** ve alti ev yuvasindan ucu oluydu - kendi Settlement planinin
istedigi **dort** eve bile ulasamiyordu (Town plani alti istiyor).

**Duzeltildi - dort marker tasindi** (hepsi olculdu; yol, agac, yatak, rihtim,
diger yuvalar ve kontrol yaricapi karsisinda dogrulandi):

| Yuva | Once | Sonra | Neden engelliydi |
| --- | --- | --- | --- |
| `gold_mine` | `(44,-26)` | **`(44,-24)`** | yol hucresi `(46,-28)` |
| `house` | `(50,-44)` | **`(54,-48)`** | `enemy-wood-7/8` agaclari |
| `house` | `(54,-44)` | **`(58,-46)`** | `enemy-wood-8` agaclari |
| `house` | `(50,-48)` | **`(50,-50)`** | `enemy-wood-7-dense` |

`gold_mine`'in yeni yeri hala `enemy_safe_gold` yatagini (`(42,-20)`) 4.5 birimle
`gatherRadius: 8` icinde tutuyor, ve yol temasi `(46,-28)`'den geliyor - yani
madenin **geliri de yolu da** duruyor. Toplam yer degistirme 12.1 birim.

**Boslugun kendisi de kapatildi.** §40'in mevcut testi **kod blockout'unun**
yuvalarini **bos zeminde** yarguluyor; shipped Level'inkilere ve **yola** karsi
hicbir sey bakmiyordu. Yeni test
(`Faz S4: every authored enemy slot survives the road the AI paves past it`)
omurgayi dosuyor ve sonra her dusman yuvasini - us ve genisleme, hepsi ayni anda
ayakta - reddedilmedigine karsi olcuyor; ustune AI'nin Town planinin istedigi
sayida yuva kaldigini ve merkez/depo/tarla/oduncu/tas/altin'in yola **degdigini**
pinliyor. Iki kasitli geri alma ile kirmizi gorulup geri alindi (yol kaynakli
`gold_mine @(44,-26)` ve agac kaynakli `house @(50,-48)`).

#### Testler (§8'e ek olarak bu fazda pinlenenler)

- `Faz S4: the enemy's authored spine reaches its own Market and all three of its
  trade sites` - omurganin bacak bacak dosenmesi, pazara ve uc noktaya degme,
  her noktadan pazara rota, oyuncunun noktalarinin **degmemesi**, ve yukaridaki
  sira sarti.
- `Faz S4: the AI's own supply lane fills its shelf, and its trade rule spends
  what arrives` - `owner: "enemy"` ile ucu ucuna: bos rafta `saving`, kervanlar
  kostuktan sonra rafta bir lot, ve `AiTradeManager` o lotu **satin aliyor**.
- `Faz S4: every authored enemy slot survives the road the AI paves past it` -
  yukaridaki bosluk testi; bu plandan dogdu ama kapsami plandan genis, cunku
  yakaladigi hata da oyleydi.

Kirmiziya donebilirlik yapildi: bes kasitli mutasyon, besi de yakalandi -
kuyrugun kaldirilmasi ("the enemy Market slot has no road cell touching it"),
kuyrugun basa alinmasi ("the depot must be on the road before the first supply
spur"), `out-of-stock`'un `no-market` diye okunmasi ("before the first delivery
the AI waits rather than jams"), ve iki marker'in eski yerine geri konmasi
(`gold_mine @(44,-26)`, `house @(50,-48)`). Her biri geri alindi.

Kabul: `tsc --noEmit`, `test:engine` (**1310 check**), `build:verify`,
`check:assets` - **dordu de yesil**.

### Faz S5 - Saldiri ve kopma -> **TAMAM (2026-08-05)**

- [x] Arz yolunun kesilmesi stogu durdurur; **panel bunu soyler**. Kesilmenin
  kendisi icin tek satir simulasyon kodu yazilmadi - S3 zaten hatti dusuruyor,
  esekleri eve yuruyor ve rafi durduruyordu. S5'in tamami bir **okuma**
  katmanidir: `MarketSupplyState` (`supplying` / `cut` / `unclaimed` / `rival`),
  saf `marketSupplyLines()`, ve `MarketDetailView.supply`.
- [x] Munhasirlik el degistirir; bildirim. Uc yeni bildirim turu:
  `supply-linked` (yesil, gecise bagli), `supply-cut` (kirmizi, ureticininki gibi
  **poll**lanir), `supply-lost` (el degistirme basina **bir kez**). Kural
  `RtsApp`'te degil saf `ui/rtsSupplyNotices.ts`'te durur, cunku pinlenmeye deger
  olan sey hangi karenin haber oldugudur.
- [x] Sis: cevap **iki yarimdir** ve yalnizca ikincisi is cikardi (asagida).

#### S5'te olculenler - kodun ortaya cikardigi dort sey

**1. Panelin tek cumlesi dort durumun ucunde yanlisti.** S5 oncesi her bos raf
ayni seyi diyordu: "Bir arz noktasına yol çekin." Dort duruma karsi olculdu:
calisan ama henuz bir lot yapmamis hatta oyuncuyu **zaten sahip oldugu yolun
ikincisini** cekmeye yolluyor; cektigi ve kaybettigi yolda "onar" yerine "cek"
diyor; ve o kaynagin arz noktasini hic authorlamamis bir haritada (S3'un acik
notu: `RTS_BLOCKOUT_MAP`, `RTS_CoreMatch`) **hicbir yere** cikmayan bir yol
oneriyor. Durum ayrimi susleme degil: her biri **farkli bir eylem** adlandiriyor,
ve panel testi tam olarak bunu pinliyor.

**2. `cut`, dunyanin tutmadigi bir hafiza istiyor.** Hic cekilmemis yol ile kopan
yol grafikte **ayni** durumdur (`owner: null`, `unlinked-market`) - S3'un kendi
testi de bunu boyle pinliyor. Yani "onar" ile "cek" arasindaki fark geometride
degil tarihte. Cozum `everSuppliedSites`: mac boyunca monotonik bir kume, ve
S3'un `claims` haritasinin ayni cinsten kardesi - rota kaybolunca geri
getirilemeyen bir olgu. Monotonik olmasi kasitli: bir nokta seni bir kez
besledikten sonra "onar" onun icin **her zaman** dogru tavsiyedir, o yuzden
kumeden hicbir sey cikmaz.

**3. Sisin cevabi ikiye ayrildi - ve gorsel yari zaten hazirdi.** Arz noktasinin
**sanati** authorlanmis Level `instances`'idir, ve `loadRtsAuthoredWorld` her
Level instance'ini `FogMask`'e verir: fragment basina, **explored** alfasina gore
kesilir (GDD 08 §40). Yani agac/deposit ikizi kurali *insaat geregi* zaten
gecerliydi; yapilan sey onu pinlemek oldu (her marker'in bir rihtim kosegeni
icinde authorlanmis sanati olmali), cunku deposit'lerin gittigi yol - runtime'da
mesh uretmek - kendi `visible` yazicisini gerektirir ve sissiz render eder.

Eksik olan yari **bilgi** tarafiydi: panel, oyuncunun **hic kesfetmedigi** zemin
uzerindeki bir rakip talebini raporlayacakti - kendi ussundeki bir binadan
bedavaya kesif sonucu. Bu yuzden `siteSupplyState` bir `explored` bayragi alir ve
kesfedilmemis bir rakip talebi `unclaimed` okur: kesfedilmemis bir harita zaten
oyle gorunur, git yolu cek ve ogren.

**4. `rival`, `unclaimed`'in *altinda* siralanir.** §3.7'nin ciftlerine karsi
olculdu: her kaynagin iki noktasi var. Rakip kendi yakasindakini tutuyorken
oyuncunun kendi yakasindaki hala bostaysa, dogru cumle "kendininkine yol cek"tir;
"rakibin elinde" ise oyuncuyu **bos duran bir liman icin** savasa yollayan bir
yalandir. `rival` son caredir - o kaynagi besleyebilecek **her** noktanin
baskasinda oldugu anlamina gelir. Test bu siralamayi ayri ayri pinliyor.

Bir de bildirimin kapisi iki isi birden yapiyor: yalnizca **daha once beslemis**
noktalar kotu haber uretir. Bu hem akisi rakibin uc noktasiyla doldurmayi
onluyor (haritada alti nokta var), hem de - beslenmis olmak yol gerektirdigi, yol
da zemin gerektirdigi icin - akisi ikinci bir sis testi yazmadan oyuncunun
kesfettigi alanin icinde tutuyor.

#### S5'in planin harfinden sapmasi (bilincli, dar)

Plan "munhasirlik el degistirir; **bildirim**" diyor, tekil. Iki yon iki ayri
haber cikti: rakipten **almak** `supply-linked`'in "ele geçirildi" metnini,
**kaybetmek** `supply-lost`'u aliyor. Tek tur, iyi haberle kotu haberi ayni renge
boyardi - akis rengi turden aliyor.

Kapsam disi birakilan: arz noktasinin **kendi paneli** (kime ait, tamponu ne, kac
esek yolda) ve pazar panelinin uc stok satirinin son hali - ikisi de **S6**'nin
maddeleri. S5 duran bir hatti okunur kilmakta durdu.

#### S5'te pinlenen testler (§8'e ek)

- `Faz S5: a stopped supply names which of the four things to do about it` - dort
  durum, `rival < unclaimed` siralamasi, `absent`, ve sis kurali (kesfedilmemis
  rakip talebi `unclaimed` okur; kendi hattin sis altinda da gorunur).
- `Faz S5: the feed says a lane linked, stopped, or changed hands — and nothing
  else` - uc gecis, uc metin, "hic yol cekmedigin nokta haber uretmez" kapisi, ve
  akisin kendi kurallari (poll'lanan kesinti tek satir kalir, baglanti onu
  aninda emekliye ayirir).
- `Faz S5: the Market panel turns a stopped lane into the repair that fixes it` -
  her durumun **farkli** bir eylem adlandirdigi; dolu rafin olu hatta amber
  okundugu; ve S1'in "arz zinciri olmayan proje aynen eski panel" geri donusu.
- `Faz S5: a trade site is a static world object, so its art rides the Level's
  fog mask` - sanatin authorlanmis Level sanati oldugu, yani sis kuralinin
  kendiliginden gecerli oldugu.

Kirmiziya donebilirlik yapildi: bes kasitli mutasyon, besi de hedefledigi
assertion'la yakalandi - sis kapisinin kaldirilmasi ("an unexplored site keeps
its claim to itself"), `everSupplied` kapisinin kaldirilmasi ("a site you never
paved to raises nothing"), calisan hattin yine "yol cek" demesi, `rival`'in
`unclaimed`'in ustune cikarilmasi, ve bir arz noktasinin Level sanatinin
tasinmasi. Her biri geri alindi.

Kabul: `npx tsc --noEmit`, `verify:imports`, `vite build`, `verify:dist
--strict`, `check:assets` - **hepsi yesil**. `test:engine`: S5'in dort testi de
yesil (**1313 check**, asagidaki not sartiyla). **Not:** calisma agacinda bu
plandan bagimsiz, devam eden bir merkez-seviye / `intentScorer` degisikligi var
(`src/game/rts/ai/intentScorer.ts`, `public/game-data/balance/buildings.json`,
`GDD/13_...md` ve `engine-tests.ts`'in kendi hunk'i) ve suite **o** testte
("AI intent scoring reflects the §30 drivers and always names a reason") kirmizi
duruyor. S5'in dosyalarindan hicbiri o testin okudugu hicbir seye dokunmuyor; o
degisiklik yesile donduginde suite butunuyle yesil olur.

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
| "a trade site buffer holds at least one caravan load" | `bufferCapacity >= carryCapacity`, **ayni tablodan** (§6.1): S0'da olculdu ki `carryCapacity` `logistics.json'da yok, o yuzden arz noktasi kendi degerini tasir |
| "a supply route uses only committed road cells" | V4 `route()` sozlesmesinin bu rota turunde de gecerliligi |
| "generalising the caravan lane leaves producer logistics unchanged" | §3.4 refactor'u: mevcut V4 kervan/transfer testleri **degismeden** gecer |
| "a severed supply road stops the stock from growing" | Kopru hucresi `remove` edilince stok artmaz |
| "a trade site supplies only the kingdom it is linked to" | `owner` esitligi; dusman limani oyuncunun pazarina yuruyemez |
| "trade sites never consume population" | V4'un nufus testinin ikizi |
| "every trade site has a point-symmetric twin" | §3.7: nehir iki kralligi ayirdigi icin adalet ciftlerle saglanir. **Yalnizca `tradeSites` uzerinde kosar** ve kucuk bir tolerans tasir - S0'da olculdu ki tam nokta-simetri haritada yalnizca geyik ve sigirda var (kurt/stratejik nokta/deposit ciftleri simetrik degil), yani bu mevcut bir kalibin tekrari degil KARAR 4-A'nin getirdigi **yeni** bir sozlesmedir |
| "no trade site blocks a river crossing" | §3.3/§3.7: uc gecidin yuruyus genisligi arz noktasi authorlandiktan sonra da korunur |
| "the market still cannot mint gold" | **Mevcut test**, degismeden gecmeli |
| "a stopped supply names which of the four things to do about it" | S5: dort durumun her birinin **farkli** bir eylem adlandirdigi; `rival`'in `unclaimed`'in altinda siralandigi (§3.7'nin ciftleri yuzunden); ve sis kurali - kesfedilmemis bir rakip talebi `unclaimed` okur |
| "the feed says a lane linked, stopped, or changed hands — and nothing else" | S5: uc gecis, ve "hic yol cekmedigin nokta haber uretmez" kapisi - akisi hem rakibin uc noktasindan hem de kesfedilmemis zeminden uzak tutan tek kural |
| "the Market panel turns a stopped lane into the repair that fixes it" | S5: panelin cumlesi durumdan turer; dolu raf + olu hat **amber** okunur; ve arz zinciri olmayan proje aynen S1'in paneli kalir |
| "a trade site is a static world object, so its art rides the Level's fog mask" | S5: arz noktasinin sanati **authorlanmis Level sanati**dir, yani agac/deposit sis kurali insaat geregi gecerlidir. Runtime'da mesh uretmeye kayilirsa kirmizi doner |

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
S0 (TAMAM) -> S1 (TAMAM) -> S2 (TAMAM) -> S3 (TAMAM) -> S4 (TAMAM)
  -> S5 (TAMAM) -> S6
```

Hicbir faz artik baska bir plani beklemiyor (§3.4). S1 ve S2 birbirinden
bagimsizdi; ikisi de bitti. S3 de bitti ve kendi icindeki ikiye ayrilma
korundu: once `CaravanLane` genellestirmesi hicbir oynanis degistirmeden yesil
kostu (1298 check), sonra ikinci hat takildi (1303 check). Kural en sonda tek
satirla (`stocked` listesi) yururluge girdi - ve ayni satirla geri alinabilir.

Iki acik kabul S4'u bloke etmedi ve etmemesi de dogruydu: S2'nin mesh yerlesimi
rota hesabini degistirmiyor, S3'un ayar kabulu (`caravanCount`, `perMinute`) ise
AI paritesinin konusu degildi - S4 dusmanin **yolunun** var olup olmadigini
olctu, ne kadar hizli aktigini degil. S4 kod degil **veri** oldugu icin (tek
dosya: Level'in omurga spline'i) S5'in onune de hicbir kod borcu birakmadi.

S5 de S6'nin onune birakmiyor, ve sebebi ayni cinsten: S5 hicbir simulasyon
kurali degistirmedi - yalnizca S3'un zaten urettigi durumu okudu. S6'ya kalan
sey (arz noktasi paneli, pazar panelinin son hali, kabul maci) bu okumanin
ustune biner; `MarketSupplyLine` ve `siteSupplyState` tam da o panelin
soracaklaridir. Ayni acik kabuller S5'i de bloke etmedi ve etmemeliydi: S5'in
her cumlesi durum makinesinden turuyor, mesh'in nerede durdugundan degil.
