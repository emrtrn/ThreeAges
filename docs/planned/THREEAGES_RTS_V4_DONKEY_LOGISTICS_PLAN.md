# ThreeAges RTS V4 - Yuk Esegi ve Gorunur Lojistik Plani

Olusturulma tarihi: 2026-08-04
Durum: **Faz 5 kod ve gorsel/tasarimsal kabul olarak tamamlandi (2026-08-04); Faz 6'nin UI ve AI kod dogrulamasi tamamlandi, kabul maci bekliyor.** Faz 3'un gorsel kabulu kullanici tarafindan verildi. Faz 0'daki alti kararin hepsi §4'teki onerilen
secenekle kapandi: **1-B, 2-A, 3-B, 4-A, 5-A, 6-A.** Kapsam disi listesi (§4
sonu) teyit edildi. Bu kararlar kod yazilirken yeniden tartisilmaz.

Ust plan: `docs/planned/THREEAGES_RTS_WILDLIFE_AND_HUNTING_PLAN.md` §12 - "V4 -
Esek lojistigi (Donkey) - en yuksek getirili madde". Sira **V2 -> V3 -> V4**
olarak kilitlenmisti; V2 tamamlandi, V3 son fazlarinda, V4 bu dosyadan
yurutulur. **V5 (suvari / Cag 3) yapilmayacaktir**, yani yol haritasi bu planla
biter.

Kapsam: `public/assets/ThreeAges/Animals/Donkey.gltf` varligini, oyunun **zaten
var olan ama gorunmeyen** lojistik zincirine govde vermek icin kullanmak. Bu
jenerik bir "hayvan ekleme" degildir; oyunun kendi ayirt edici sistemini
(yol + depo + tampon) ilk kez ekranda gorunur ve saldirilabilir kilmaktir.

## 1. Hedef

Bugun bir uretici binanin tamponu, yol baglantisi varsa **her tick anlik olarak**
cuzdana bosalir. Yolun uzunlugunun, gectigi arazinin, uzerinde dusman olup
olmadiginin hicbir bedeli yoktur; yol yalnizca bir **boolean**dir: "bagli mi?"

V4 sonrasi hedeflenen cumle:

> **Yol bir baglanti degil, bir mesafedir. Uzun yol gec gelir, kesilen yol hic
> gelmez.**

Kazanc uc katmanlidir:

1. **Gorsel** - yollar uzerinde yuruyen bir sey vardir; harita canlidir.
2. **Tasarimsal** - uzak uretici gercekten uzaktir; depo yeri artik bir karardir.
3. **Taktik** - kervan vurulabilir; yol kesme ve baskin ilk kez **anlamli** bir
   hamledir.

## 2. Basari Tanimi

Asagidaki akisin calismasi hedeflenir:

1. Oyuncu oduncu kampini merkezden uzaga kurar ve yolla baglar.
2. Kamp uretmeye baslar; tamponu (`localBuffer`) dolmaya baslar.
3. Kamptan bir **yuk esegi** cikar, **yol hucreleri uzerinde** depoya/merkeze
   yurur, orada durur, yukunu bosaltir ve geri doner.
4. Cuzdandaki odun, esek **vardiginda** artar - uretim aninda degil.
5. Kervan yolda kaldigi surece tampon dolmaya devam eder; tampon dolunca uretim
   `buffer-full` ile **durur**. Oyuncu bunu "depoyu yaklastir ya da ikinci esek
   ekle" olarak okur.
6. Dusman asker kervanı gorur ve vurur; esek olur, uzerindeki yuk **kaybolur**
   (KARAR 4). Bildirim panelinde "Kervan vuruldu" yazar.
7. Dusman yolun bir hucresini yok ederse rota kopar; uretici `unlinked-*`
   durumuna duser ve kervan evine doner. Yol onarilinca akis kendiliginden
   devam eder.
8. Esek **nufus saymaz**, nav grid'i bloklamaz ve secilebilir bir birim degildir.
9. AI kervan yonetmek zorunda kalmaz: sistem otomatiktir ve AI ekonomisi
   V4'ten once ne yapiyorsa onu yapmaya devam eder, yalnizca daha yavas gelir.

## 3. Mevcut Durum - Olculen Baslangic Noktasi

### 3.1 Tasima bugun **anlik ve gorunmez** - degistirilecek tek cumle burada

`src/game/rts/economy/logisticsTransferSystem.ts:16` dosyanin kendi basligini
soyluyor:

```ts
/** Individual carts are out of scope: linked buffers flush after production. */
```

`update()` her cagrida `links.snapshots()` uzerinde yurur, `status === "linked"`
olan her ureticinin tamponunu `withdrawBuffered` ile bosaltir ve cuzdana
`credit` eder (`:27-47`). `RtsApp` bunu uretimden hemen sonra cagirir
(`RtsApp.ts:2762`), yani **uretilen mal ayni tick icinde merkeze varmis olur**.

Bu, V4'un tam olarak neyi degistirdigini tanimlar: sistem silinmez, **kapisi
kervana baglanir**. Kervan gelmediyse `withdrawBuffered` cagrilmaz.

### 3.2 `ProductionLogisticsSystem` **durum** verir, **rota** vermez

`productionLogisticsSystem.ts:9` alti durumu tanir:

```ts
"outside-control" | "unlinked-road" | "unlinked-depot" | "unlinked-main-network"
  | "depot-occupied" | "linked"
```

`snapshots()` her uretici icin `roadCell` (footprint'e degen yol hucresi),
`componentId` (yol adasi) ve `depotStructureId` uretir (`:31-93`). Bunlarin
hepsi **baglantiyi** anlatir; ikisi arasindaki **hucre dizisi** hicbir yerde
uretilmez.

Kazanc: kervanin nereden nereye gidecegi zaten cozulmus durumdadir. Eksik olan
tek sey aradaki yoldur.

### 3.3 Kritik bulgu - `RoadGraph` mevcut yollar uzerinde rota **donduremez**

Uc sorgusu vardir ve ucu de kervanin ihtiyacini karsilamaz:

| Metot | Ne yapar | Neden yetmez |
| --- | --- | --- |
| `plan(start, end, blockers)` (`roadGraph.ts:63`) | **Bos zeminde** en kisa ortogonal rotayi cizer ve yalniz yeni hucreleri ucretlendirir | Yol **insa** aracidir; mevcut hucrelerle sinirli degildir, yani kervan yoldan cikip cayirdan yurur |
| `connected(a, b)` (`:162`) | Committed hucreler uzerinde BFS | Yalniz `boolean` doner |
| `components()` (`:184`) | Bagli ada listesi | Hucre sirasi yok, iki nokta arasi yol yok |

Yani **yeni bir sorgu gerekir**: `route(from, to): readonly RoadCell[] | null` -
yalnizca committed hucreler uzerinden, deterministik siralamayla. `plan`'in
ozel `shortestRoute` metodu (`:227-245`) neredeyse birebir sablondur; fark,
komsu adayinin `isInside && !isBlocked` yerine **`this.cells.has(key)`** ile
suzulmesidir. `reconstruct` (`:247`) aynen paylasilir.

Bu, V4'un tek gercek yeni **altyapi** parcasidir ve hayvandan bagimsiz olarak da
dogru bir kazanctir (yol debug goruntusu, gelecekteki yol kesme UI'si).

### 3.4 Sahiplik - tuzak V1'de teshis edildi, kacis yolu V2'de kanitlandi

`PopulationSystem.snapshot()` nufusu `units.unitsOf(this.owner).length` ile
sayar (`populationSystem.ts:39`). **Esek `Unit` yapilirsa her kervan bir nufus
yer** ve neden hicbir yerde gorunmez - V1 §3.5'in kaydettigi tuzagin birebir
ayni si.

Kacis yolu zaten calisiyor: `WildlifeAnimal.owner` alani `CombatTargetOwner`
tipindedir ve `tame` disinda kimse yazmaz (`wildlifeSystem.ts:110-117`).
Evcillestirilmis bir inek bugun oyuncunundur, nufus saymaz, sis altinda
gizlenmez ve `CombatTarget` olarak dovusebilir. Yuk esegi **ayni deseni**
kullanir: `UnitSystem`'in degil, `WildlifeSystem`'in kardesi olan bir
`CaravanSystem`.

### 3.5 Saldiriya aciklik neredeyse bedava - ama iki ucu keskin

`RtsApp.combatTargets()` (`RtsApp.ts:2639-2646`) askerin hedef havuzudur:
birimler, merkezler, yapilar ve **duruma gore** yirticilar. `isHostile`
(`combat/damageResolution.ts:46`) yalnizca `owner` karsilastirir.

Kervanin `owner` alani `"player"` / `"enemy"` olacagi icin listeye eklenmesi
onu **otomatik olarak** gecerli bir hedef yapar. Yeni savas kodu gerekmez.

Ayni sebep riski de dogurur: her kervan bir hedeftir, yani agresif duruştaki
askerler ana kavgayi birakip kervan kovalayabilir. Bu yuzden kervan hedef
havuzuna **duruma gore** girer (V3'un yirticida ogrendigi ders): karsi tarafin
gorus alanindaki kervan hedeftir, ucu bucagi belirsiz bir kervan degil. Faz 5'in
ilk maddesi budur.

### 3.6 Varlik durumu - manifest hazir, sidecar ve Actor yok

`Donkey.gltf` `public/assets/manifest.json:25461` icinde zaten kayitlidir
(`assetType: "skeletalMesh"`, `category: "Animals"`). Eksik olanlar:

- `public/assets/ThreeAges/Animals/Donkey.skeleton.json` - **yok**. Klasorde
  bugun Bull, Cow, Deer, Fox, Stag, Wolf sidecar'lari var; Donkey, Alpaca,
  Horse, Horse_White, Husky, ShibaInu yok.
- `BP_RTS_Donkey.actor.json` - **yok**.

Donkey **toynakli ailedendir** (V1 §3.1 tablosu: Alpaca, Bull, Cow, Deer,
Donkey, Horse, Horse_White, Stag), yani `Deer.skeleton.json` sablonu birebir
kopyalanir: `Attack_Headbutt`, `Jump_toIdle`, `Idle_Headlow` yazimlariyla. Kopek
ailesinin sablonu (`Attack`, `Jump_ToIdle`) kullanilirsa klip **sessizce
cozulmez** ve esek T-pose'da kalir.

### 3.7 Kritik bulgu - `animals.json` her turden **avlanabilirlik** istiyor

`validateAnimalBalance` (`validateGameData.ts:1132-1235`) her tur icin sunlari
**zorunlu** kilar: `meatCapacity`, `maxHealth`, `moveSpeed`, `walkClipSpeed`,
`fleeRadius`, `fleeSeconds`, `fleeRecoverySeconds`, `huntSeconds`, `roamRadius`,
`turnRateDegPerSecond` (hepsi > 0) ve `tameable` (boolean). Ustune bir de
"av yakalanabilir olmali" esitsizligini dogrular (`:1160-1173`).

Yani yuk esegi `animals.json`'a yazilirsa, **otlamayan ve avlanmayan bir hayvan
icin otlama yaricapi ve kacis suresi uydurmak** zorunda kalinir - tablonun
anlamini bozan, ilerideki bir tuner'i yaniltacak sahte veri. Bu, KARAR 3'un
gerekcesidir: kervan verisi kendi tablosunu hak eder.

### 3.8 Tampon zaten baski uretiyor - kervan onu **gercek** yapar

`economyProductionSystem` uretimi tampon dolunca durdurur
(`economyProductionSystem.ts:438`, `status = "buffer-full"`). Bugun bu durum
neredeyse hic gorulmez, cunku tampon ayni tick bosalir.

Kervan araya girince `buffer-full` **normal bir oyun durumu** olur: uzak kamp,
tek esekle tamponu dolduramaz ve durur. Bu, V4'un tasarimsal getirisinin tamami
bedavaya gelen kismidir - yeni bir ceza mekanigi yazilmaz, var olan bir durum
nihayet tetiklenir.

`ResourceCapacitySystem.availableFor` (`resourceCapacitySystem.ts`) zaten cuzdan
tavanini uygular ve `LogisticsTransferSystem` onu okur; kervan da ayni cagriyi
varista yapar, yani depo kapasitesi kurali degismez.

### 3.9 Navigasyon - kervan nav ajani **olmamalidir**

Hayvanlar bugun ne nav ajani ne de nav blocker'dir (V1 Faz 2 karari, `RtsApp.ts`
`updateSimulation` yorumu). Kervan bunu bozmaz: **hucre dizisi zaten bir
yoldur**, yani yol bulma isi `RoadGraph.route` ile bir kez cozulur ve esek o
diziyi takip eder. Yol hucreleri `occupancyBlockers()` ile yalnizca **insaat**
icin doludur, yuruyus icin degil (`roadGraph.ts:110-117`).

Zemine oturma: hayvanlar `syncUnitsToGround` ile ayni yuzeye oturur
(`RtsApp.ts:3430-3433`); kervan ayni yola girer, aksi halde author edilmis bir
Landscape'te y = 0'da kalir.

### 3.10 Yol kesme zaten mumkun - eksik olan sonucu

`RoadGraph.remove(cells)` (`:92`) ve `wouldDisconnect(cell)` (`:138`) hazirdir;
ikincisi bir hucrenin **kopru** olup olmadigini saf bir sorgu ile soyler.
Bugun bir yolun kesilmesi ureticinin durumunu `unlinked-*`'e cevirir ve gelir
aninda durur. Kervanla birlikte bu **yolda mahsur kalmis bir yuk** anlamina da
gelir; Faz 5 bunun cevabini verir (KARAR 5).

### 3.11 Isgal kancasi hazir

`LogisticsOccupationSystem` (`logisticsOccupationSystem.ts:16`) bir depoyu
sahipligini almadan kullanilamaz kilar; `ProductionLogisticsSystem` bunu okuyup
`depot-occupied` durumunu uretir ve merkeze dogrudan teslimata izin verir
(`productionLogisticsSystem.ts:80-85`). Kervan hedefini secerken **ayni
otoriteyi** kullanmalidir, yoksa esek isgal altindaki depoya yuruyup orada
bekler.

### 3.12 AI kervan bilmiyor - ve bilmemeli

`aiEconomyManager` bina sayar ve isci atar; lojistigi hic sormaz. V4 bunu
**degistirmemelidir**: kervan otomatik olursa AI'nin ogrenecegi hicbir sey
yoktur ve iki taraf da ayni yavaslamayi yasar. AI'nin tek gorecegi degisiklik,
gelirinin biraz gecikmesidir - ve bu, insan oyuncu icin de aynidir.

KARAR 2 "satin alinan esek" secilirse bu bedava uyum bozulur ve AI'ya bir satin
alma kurali yazmak **zorunlu** hale gelir. Karari verirken bu maliyet gorunur
olmalidir.

### 3.13 Locomotion polish plani ucus halinde - bagimlilik notu

`git status`: `validateGameData.ts` ve `gameDataTypes.ts` uzerinde commit
edilmemis degisiklikler var; validator artik her turden
`turnRateDegPerSecond` ve `restSeconds` istiyor ama `animals.json` henuz
tasimiyor (`docs/planned/THREEAGES_RTS_WILDLIFE_LOCOMOTION_POLISH_PLAN.md`).

V4'un Faz 1'i **o plan yesile donduktan sonra** baslamalidir; aksi halde yeni
tur girdisi hangi alanlari tasiyacagini bilemez. Kervan kendi tablosunu alirsa
(KARAR 3-B) bu bagimlilik yalniz sidecar'la sinirli kalir.

## 4. Tasarim Kararlari (Faz 0 - **KILITLENDI**)

Alti soru, alti kez onerilen secenek: **1-B, 2-A, 3-B, 4-A, 5-A, 6-A**.
Gerekceler asagida oldugu gibi durur; secilen sik her basligin altinda
**[KILITLI]** ile isaretlidir.

### KARAR 1 - Kervan transferi **gercekten** mi tasir? -> **B [KILITLI]**

- **A - Saf gorsel.** Transfer bugunku gibi anlik kalir; esek yalnizca yolda
  yuruyen bir suslemedir. Risksiz, ama plani ozetleyen cumlenin ("yol bir
  mesafedir") hicbirini teslim etmez.
- **B - Transferi kervan tasir. ONERILEN.** `LogisticsTransferSystem` yalniz
  kervan varista `withdrawBuffered` cagirir. Butun tasarimsal getiri buradan
  gelir ve §3.8 sayesinde neredeyse bedavadir.

Not: B secilse bile **geri cekilme yolu acik kalir** - Faz 3 kervani gorsel
olarak calistirir, Faz 4 kapiyi ona baglar. Faz 4 geri alinirsa oyun A'ya
doner.

### KARAR 2 - Kervan otomatik mi, satin alinan mi? -> **A [KILITLI]**

- **A - Otomatik. ONERILEN.** Bagli her uretici bir esek dogurur; oyuncu
  yonetmez. AI uyumu bedavadir (§3.12), yeni UI yoktur.
- **B - Satin alinan birim.** Depodan "yuk esegi" alinir; kervan sayisi bir
  yatirim kararidir. Daha derin, ama yeni bir uretim kuyrugu, yeni bir UI, yeni
  bir AI kurali ve nufus/limit sorusu getirir - V4'u iki katina cikarir.

### KARAR 3 - Esegin verisi nerede durur? -> **B [KILITLI]**

- **A - `animals.json`.** Tek hayvan tablosu, ama §3.7 geregi avlanma alanlari
  uydurulur.
- **B - Kendi tablosu (`balance/logistics.json`). ONERILEN.** Kervan bir hayvan
  degil, bir **lojistik birimidir**; hareket/direnc alanlari `moveSpeed`,
  `maxHealth`, `walkClipSpeed` buradadir. Yuk kapasitesi ise hizmet ettigi
  yapinin canli seviye ekonomisinden turetilir. Sidecar yine hayvan sidecar'idir
  (art ortak, veri ayri).

### KARAR 4 - Vurulan kervanin yuku ne olur? -> **A [KILITLI]**

- **A - Kaybolur. ONERILEN.** Basit, okunakli, hemen dogru: baskin uretimi
  keser. Yeni UI borcu yoktur.
- **B - Saldirana gecer (yagma).** Daha zengin, ama cuzdan/kapasite, bildirim,
  AI degerlendirmesi ve "kim aldi" gorunurlugu borclarini birden getirir. V4.1
  adayidir.

### KARAR 5 - Yol kesilince yoldaki kervan ne yapar? -> **A [KILITLI]**

- **A - Evine doner, yuk ureticinin tamponuna geri yazilir. ONERILEN.** Kayip
  yalnizca zamandir; oyuncu "yolu onar" dersini ceza almadan ogrenir.
- **B - Yerinde bekler.** Yol onarilinca devam eder. Daha gercekci ama
  saldiriya acik bir hedefi ortada birakir ve "neden duruyor" sorusunu dogurur.

### KARAR 6 - Esek uretilebilir/cogaltilabilir mi (agil baglantisi)? -> **A [KILITLI]**

- **A - Hayir. ONERILEN.** V2'nin agili yiyecek uretir; esek lojistiktir. Ikisini
  baglamak V4'u V2'nin devami yapar ve kapsami buyutur.
- **B - Agilda esek yetistirilir**, kervan sayisi agila baglanir. V4.1 adayi.

### Kapsam disi (V4'e sizmayacaklar)

- Yagma (KARAR 4-B), agil-esek baglantisi (KARAR 6-B)
- Kervan escort emri / muhafiz atama
- Yol uzerinde hiz farki (kaldirim > toprak) - cekici ama ayri bir denge isi
- At, suvari, Cag 3 (V5 - **yapilmayacak**)
- Alpaca / Husky / ShibaInu (bagimsiz maddeler, §12)

## 5. Dokunulacak Dosyalar

### 5.1 Kod

| Dosya | Is |
| --- | --- |
| `src/game/rts/roads/roadGraph.ts` | **Yeni metot** `route(from, to)`: yalniz committed hucreler uzerinde deterministik en kisa yol; `shortestRoute`/`reconstruct` ile paylasilan iskelet |
| `src/game/rts/logistics/caravanSystem.ts` | **Yeni.** Kervan durumu ve durum makinesi (`loading -> outbound -> unloading -> inbound`); `WildlifeSystem`'in kardesi, `UnitSystem`'in degil |
| `src/game/rts/logistics/caravanView.ts` | **Yeni.** `WildlifeView` ikizi: snapshot -> Object3D, klip surusu, sis gorunurlugu |
| `src/game/rts/logistics/caravanRoute.ts` | **Yeni.** Saf hucre-dizisi takibi (ilerleme, yon, varis testi) - test edilebilir cekirdek |
| `src/game/rts/economy/logisticsTransferSystem.ts` | Anlik bosaltma yerine **kervan varisiyla** bosaltma (KARAR 1-B); kervan yoksa davranis degismez |
| `src/game/rts/economy/productionLogisticsSystem.ts` | Kervanin hedefini secmesi icin `depotStructureId` + isgal otoritesinin disari acilmasi (§3.11) |
| `src/game/rts/combat/combatTarget.ts` | Degisiklik **beklenmiyor** - kervan `player`/`enemy` sahibidir, tip zaten yeterli |
| `src/game/rts/RtsApp.ts` | `CaravanSystem` kurulumu, update sirasi (simulasyon delta'si), `combatTargets()`'a duruma bagli kervan girisi, zemine oturtma, sunum fabrikasi |
| `src/game/rts/ui/rtsSelectionView.ts` | Uretici panelinde kervan durumu ("Kervan yolda", "Tampon dolu") |
| `src/game/rts/ui/rtsNotifications.ts` (mevcut kanal) | "Kervan vuruldu" bildirimi |
| `src/game/rts/vision/fogVisibilityBinder.ts` | Kervanin sis kurali: kendi kervanin her zaman gorunur, dusmanınki yalniz gorus alaninda (hayvan kurali) |
| `src/game/data/gameDataTypes.ts` | `CaravanBalance` tipi (KARAR 3-B) |
| `src/game/data/validateGameData.ts` | `validateCaravanBalance`: yalniz hayvan hareket/direnc verisini dogrular; yuk kapasitesi yapinin canli ekonomisidir |
| `tools/engine-tests.ts` | §8'deki sozlesme testleri |

### 5.2 Veri ve varlik

| Dosya | Is |
| --- | --- |
| `public/assets/ThreeAges/Animals/Donkey.skeleton.json` | **Yeni.** Toynakli `animationSet` (Deer sablonu birebir) |
| `public/assets/ThreeAges/Actors/Wildlife/BP_RTS_Donkey.actor.json` | **Yeni.** `BP_RTS_Deer` deseni; `scale` editorde denenerek bulunur |
| `public/game-data/balance/logistics.json` | **Yeni** (KARAR 3-B). Kervan hizi, kapasitesi, sagligi (§6) |
| `public/game-data/content/rts-content.json` | Kervan icin `actorRef` eslemesi |
| `public/assets/manifest.json` | Yalniz yeni Actor girdisi (Donkey mesh'i zaten kayitli) |

### 5.3 Allowlist notu

Bu plan CLAUDE.md'nin **ikinci allowlist yuzeyine** dokunur:
`Donkey.skeleton.json`. Sidecar yalnizca mevcut `animationSet` semasini
kullandigi surece `tools/saveValidator.ts` **degismez**.

Kural (V1 §5.3'ten devralinir): **kervan verisi sidecar'a yazilmaz.** Sidecar
klip otoritesidir; kapasite/hiz/saglik `balance/logistics.json`'a gider. Bu,
allowlist isini tamamen disarida birakir.

`LayoutPlacement` allowlist'ine dokunulmaz: kervan Level'da author edilmez,
calisma zamaninda uretilir. **Yeni marker tipi gerekmez.**

## 6. Balans Verisi (oneri)

### 6.1 `logistics.json` (KARAR 3-B secilirse)

| Alan | Deger | Gerekce |
| --- | --- | --- |
| `label` | Yuk Esegi | |
| `carryCapacity` | **Yapidan turetilir** | Tam dolu yapinin mevcut seviye dakika uretimi. Tampon bu degerden kucukse esek ancak `buffer-full` oldugunda elindeki miktarla cikar; sabit hayvan tablosu sayisi yoktur |
| `moveSpeed` | **1.76** | Onceki 2.2'nin %20 altinda. Sunum `forceWalk` ile bu hizda dahi kosu degil yurume klibini kullanir |
| `walkClipSpeed` | ~~1.2~~ **1.4** | §3.6/V1 §3.8: otlama degil yuruyus hizi. 0.22 olcekli toynakli ailenin komsulariyla (inek 1.1, boga 1.2, erkek geyik 1.4) ayni bantta |
| `maxHealth` | 45 | Isci civari; bir okcunun birkac atisiyla duser |
| `armorClass` | `light` | Hayvan kurali |
| `loadSeconds` | 2 | Yukleme/bosaltma duraklamasi; kervan "isliyor" gorunur |
| `spawnPerProducer` | 1 | Bagli uretici basina bir esek (KARAR 2-A) |

**Yuk esigi.** Esek, tampon yapinin mevcut seviye dakika uretimine ulasana kadar
yerinde bekler. Tampon dolar veya kaynak biterse kalan miktarla cikabilir; bu,
isci gelmeden bos kervan turu atilmasini engeller.

### 6.2 Neden `units.json`'a girmiyor

Esek bir birim degildir: secilmez, emir almaz, nufus saymaz, kuyruktan cikmaz.
`units.json`'a girse `UnitRoleId`, roster UI'si, grup secimi ve nufus yollarinin
hepsi onu birden gormek zorunda kalirdi - V1 §3.5'in kacindigi tuzagin ta
kendisi.

### 6.3 `resources.json`'a dokunulmuyor

Kervan yeni bir kaynak turu tasimaz; **var olan kaynagi tasir**. Hicbir kaynak
profili degismez.

## 7. Fazlar ve Checklist

### Faz 0 - Karar kilidi

- [x] KARAR 1 (transferi kervan mi tasir) kilitlendi: **B** - transferi kervan tasir.
- [x] KARAR 2 (otomatik / satin alinan) kilitlendi: **A** - otomatik.
- [x] KARAR 3 (verinin yeri) kilitlendi: **B** - `balance/logistics.json`.
- [x] KARAR 4 (vurulan yuk) kilitlendi: **A** - yuk kaybolur.
- [x] KARAR 5 (kesilen yol) kilitlendi: **A** - eve doner, yuk tampona geri yazilir.
- [x] KARAR 6 (agil baglantisi) kilitlendi: **A** - baglanti yok.
- [x] §4 kapsam disi listesi V4'e sizmayacak sekilde teyit edildi.

Kabul: alti kararin hicbiri kod yazilirken yeniden tartisilmaz.

### Faz 1 - Varlik ve veri (oynanis yok)

Onkosul: locomotion polish plani yesil (§3.13).

- [x] `Donkey.skeleton.json` yazildi (toynakli sablon; `Idle`, `Walk`,
  `Gallop`, `Gallop_Jump`, `Jump_toIdle`, `Eating`, `Attack_Headbutt`,
  `Death`). Donkey.gltf'in tasidigi 13 klip dogrulandi; Deer sablonu birebir
  uydu.
- [x] Klip adlarinin gltf'te gercekten var oldugu **mevcut engine testine**
  eklendi - test `Animals/` klasorunu tarayarak calistigi icin Donkey sidecar'i
  yazilir yazilmaz kapsama **kendiliginden** girdi; kod degisikligi gerekmedi.
- [x] `BP_RTS_Donkey.actor.json` (Deer deseni, `assetId: "donkey"`,
  `scale 0.22` - inek/erkek geyik ile ayni baslangic) + manifest girdisi
  (`threeages-rts-donkey-actor`) + `rts-content.json` eslemesi.
  **Not:** esleme `animals` bolumune degil **yeni `logistics` bolumune** yazildi;
  `validateAnimals` her anahtari `animals.json`'a karsi dogruluyor ve kervanin
  orada satiri yok (KARAR 3-B). Bolum istege bagli: eski bir katalog dosyasi
  onsuz da gecerli kalir.
- [x] `logistics.json` + `CaravanBalance` tipi + `validateCaravanBalance` +
  `smallestProducerBufferCapacity` + `loadCaravanBalance` + editor Data Table
  girdisi ("Lojistik Dengesi (Yuk Esegi)").
- [x] Uc sozlesme testi yazildi ve **her biri bir kez kirmizi goruldu**:
  yuk/tampon siniri, validator reddi, kervan sanati + "tur tablosunda satiri
  yok". Kirmizi kaniti kasitli bozma ile alindi ve geri alindi.

Kabul: `npx tsc --noEmit` (temiz), `npm run test:engine` (1279 kontrol, uc yeni
V4 kontrolu dahil) ve `npm run check:assets` (PASS) yesil kosuldu.
`npm run build:verify` **ayni tarama icinde ayrica kosulmadi**: paralel yurutulen
yirtici/lokomosyon calismasi `RTS_GameplayProof.level.json`'i mac ortasinda
degistirdigi icin suite o dosyanin in adalet kontrolunde kirmizi; V4'e ait
hicbir kontrol etkilenmiyor. O calisma yesile dondugunde `build:verify`
tekrarlanmalidir. **Gorsel kabul Skeletal Mesh Editor'de** alinir -
V1 §3.6/§3.7 geregi viewport'a birakilan bir karakter ne `?rts` Play'de gorunur
ne de sidecar'i kullanir. Kullaniciya bakmasi soylenir; Playwright kaniti
uretilmez (CLAUDE.md kurali).

### Faz 2 - `RoadGraph.route()` (oynanis yok)

- [x] `route(from, to): readonly RoadCell[] | null` - yalniz committed hucreler,
  deterministik siralama, kopuk agda `null`.
- [x] Uc yuzey testi (§8): rota her hucresi committed; ayni girdi ayni cikti;
  kopru hucresi `remove` edilince `null`.

Kabul: saf ekleme, hicbir oynanis degisikligi yok; suite yesil. 2026-08-04'te
`npx tsc --noEmit`, `npm run test:engine` (1283 kontrol), `npm run build:verify`
ve `npm run check:assets` yesil. Committed-hucre filtresi gecici olarak tersine
cevrilerek yeni rota sozlesmesinin kirmizi kaniti alindi, sonra geri alindi.

### Faz 3 - Kervan haritada yuruyor (ekonomi degismedi)

- [x] `caravanSystem.ts` + `caravanRoute.ts`: bagli her uretici icin bir kervan;
  `loading -> outbound -> unloading -> inbound` dongusu.
- [x] `caravanView.ts` + `RtsApp` mount: sunum **render delta'sinda**,
  simulasyon **simulasyon delta'sinda** (hayvan kurali, `RtsApp.ts:1881` ve
  `:2751` ayrimi).
- [x] Zemine oturtma (`syncUnitsToGround` yuzeyi).
- [x] Nufus saymaz, nav blocker uretmez - test (§8).
- [x] Transfer **hala anlik**: bu fazda esek yalniz yuruyor.

Kabul: `?rts` Play rotasinda esekler yollarda gidip geliyor; HUD/ekonomi
V4 oncesiyle **bit bit ayni**. Kod gate'i 2026-08-04'te yesil: `npx tsc --noEmit`,
`npm run test:engine` (1285 kontrol), `npm run build:verify` ve `npm run
check:assets`. Rota yonu gecici olarak tersine cevrilerek yeni surekli-rota
sozlesmesinin kirmizi kaniti alindi, sonra geri alindi. Gorsel kabul kullanici
tarafindan 2026-08-04'te verildi (olcek, hiz, ayak kaymasi - V1 §3.8'in
`walkClipSpeed` dersi burada sinandi).

### Faz 4 - Transfer kervana baglanir (KARAR 1-B)

- [x] `LogisticsTransferSystem` yalniz kervan varista `withdrawBuffered` cagirir;
  `availableFor` cagrisi ve cuzdan tavani aynen korunur.
- [x] `buffer-full` gercek bir durum olur; uretici paneli bunu soyler.
- [x] Isgal edilmis depo (§3.11) hedef secimine dahil: kervan merkeze doner.

Kabul: uzak kamp yakin kamptan gorunur olcude yavas gelir; tampon dolar ve
uretim durur. Kod gate'i 2026-08-04'te yesil: `npx tsc --noEmit`, `npm run
test:engine` (1287 kontrol), `npm run build:verify` ve `npm run check:assets`.
Kredi cagrisi gecici kaldirilarak varis-aktarim sozlesmesinin kirmizi kaniti
alindi, sonra geri alindi. Gorsel ve hissedilen kabul kullanici tarafindan
2026-08-04'te verildi; Faz 5 baslayabilir.

### Faz 5 - Saldiri ve yol kesme

- [x] Kervan `combatTargets()`'a **duruma bagli** girer (§3.5); agresif asker
  ana kavgayi birakip kervan kovalamaz.
- [x] Olum: `Death` klibi, yuk KARAR 4'e gore islenir, bildirim.
- [x] Yol kesilince KARAR 5 davranisi; `unlinked-*` durumu zaten dogru.
- [x] Sis: kendi kervanin daima gorunur, dusmanınki gorus alaninda (hayvan
  kurali, `isWildlifeVisible` ikizi).

Kabul: Kod gate'i 2026-08-04'te yesil: `npx tsc --noEmit`, `npm run
test:engine` (1290 kontrol), `npm run build:verify` ve `npm run check:assets`.
`test:engine`, yol kesiminde kervanin yalniz committed yol uzerinden eve
donmesini; olum penceresini ve kendi/dusman sis kuralini pinler. Gorsel kabul
kullanici tarafindan 2026-08-04'te verildi: dusman gorusundeki kervan
vurulabildi, `Death` klibi/bildirimi goruldu ve kesilen yolda kervan geri
dondu.

### Faz 6 - UI, AI ve kabul maci

- [x] Uretici panelinde kervan satiri: yol bekleme, yuk esigi, teslim, donus
  ve stok dolu bekleme Turkce gorunur; bildirim metinleri korunur.
- [x] AI dogrulamasi: AI hicbir sey ogrenmedi ama ekonomisi tutarli
  (§3.12) - ayni esik, rota ve stok kurallari dusman kervanina da uygulanir;
  gelir kesilmez, yalnizca gecikir.
- [ ] Kabul maci: bir bastan sona mac; oyuncu en az bir kez depo yerini
  kervan yuzunden degistirir ve en az bir kez kervan vurur/vurulur.

Kod gate'i 2026-08-04'te yesil: `npx tsc --noEmit`, `npm run test:engine`
(1291 kontrol), `npm run build:verify` ve `npm run check:assets`.
Uretici satiri stok doldugunda `Kervan: Stok dolu, ureticide bekliyor`, kismi
yukte ise esik/miktar bilgisini gosterir. Son kabul maci interaktiftir; bu
satir otomatik testle kapatilmaz.

## 8. Test ve Gate

`tools/engine-tests.ts`. CLAUDE.md kurali: **sozlesme pinlenir, ayar
pinlenmez.**

| Test | Ne pinler |
| --- | --- |
| "a caravan route uses only committed road cells" | `route()`'un her hucresi `all()` icinde; cayirdan gecmez |
| "a caravan route is deterministic" | Ayni girdi ayni dizi - headless AI ile oyuncu ayni yolu gorur |
| "a severed road leaves the producer without a route" | Kopru hucresi `remove` edilince `route()` `null`, uretici `unlinked-*` |
| "caravans never consume population" | Kervanli maçta `PopulationSystem.snapshot()` degismez (V1'in nufus testinin ikizi) |
| "a caravan waits for a full producer load" | Tampon esige ulasmadan esek yerinde kalir; `buffer-full` ve biten kaynak kismi yuk icin istisnadir |
| "wood only reaches the wallet when the caravan arrives" (Faz 4) | Kervan yoldayken cuzdan artmaz; varista tam `min(buffer, carryCapacity)` kadar artar - miktar tablodan turetilir |
| "the nearest usable depot beats the farther command centre" | Hedef, ayni yol agindaki depo ve merkez adaylari arasinda rota mesafesiyle secilir |
| "storage full pauses the caravan" | Kuresel stokta yer yokken yeni tur baslamaz; yoldaki esek eve doner |
| "an enemy caravan uses same delayed automatic shipment" | Oyuncu ve AI ayni yuk esigi/stok sinirinda calisir; AI'ya ozel gelir yolu yoktur |
| "producer panel names full-store caravan hold" | UI, tam stoklu ureticide esegin bekledigini Turkce ve acikca yazar |
| "a caravan belongs to its producer's kingdom" | `owner` esitligi; dusman kervani oyuncunun deposuna gitmez |
| "an occupied depot does not receive caravans" | §3.11 otoritesi kervanda da gecerli |
| "wildlife sidecars name clips the shipped animal models actually carry" | **Mevcut test**, Donkey ile genisletilir |

Gate: `npx tsc --noEmit`, `npm run test:engine`, `npm run build:verify`,
`npm run check:assets`. Her fazin sonunda dordu de yesil.

**Kirmiziya donebilirlik.** Her yeni testin en az biri kasitli bozularak
kirmizi gorulur ve geri alinir (V1/V3 aliskanligi): ornegin `route()` gecici
olarak `plan()`'a baglanip "committed cells" testinin kirildigi dogrulanir.

## 9. Riskler ve Onlemler

| Risk | Onlem |
| --- | --- |
| **Oyun hissi yavaslar.** Gorunur lojistik, ekonomiyi sikici olcude gecikli yapabilir. | Faz 3/Faz 4 ayrimi tam olarak bunun icin: gorsel once gelir, ekonomik bagi ikinci adimdir ve tek basina geri alinabilir. Kabul maci kararı verir. |
| **Askerler kervan kovalar.** Hedef havuzu genisleyince ana kavga dagilir. | Kervan havuza **duruma bagli** girer (§3.5); V3'un yirticida ogrendigi ders birebir uygulanir. |
| **Performans.** Bagli uretici basina bir skinned mesh + her varista rota sorgusu. | Rota **yol degisince** yeniden hesaplanir (`RoadGraph.version` zaten var, `:52`), her karede degil. Kervan sayisi uretici sayisiyla sinirli ve `spawnPerProducer` tunable. |
| **Ayak kaymasi.** V1 §3.8'in tuzagi: klip kalibrasyonu model olcegini bilmez. | `walkClipSpeed` author edilir ve kervan hizi ona kalibre edilir; Faz 3'un gorsel kabulu bunu sinar. |
| **Sidecar aile karisikligi.** Kopek sablonu Donkey'e uygulanirsa sessiz T-pose. | Klip adi testi (mevcut) Donkey'i de kapsar - hata derlemede degil, suite'te yakalanir. |
| **AI dengesi.** Kervan AI'yi orantisiz vurursa mac tek tarafli olur. | KARAR 2-A (otomatik) tam da bunu onler: iki taraf ayni gecikmeyi yasar, AI'ya kural yazilmaz. |
| **Veri kacagi.** Kervan verisi sidecar'a yazilirsa allowlist isi cikar ve alan sessizce dusurulur. | §5.3 kurali: veri `balance/logistics.json`'a yazilir. |

## 10. Tamamlanma Kapisi

- [ ] §2'deki dokuz madde uctan uca calisir.
- [ ] §8'deki tum sozlesme testleri gecer; her biri bir kez kirmizi gorulmustur.
- [ ] `npx tsc --noEmit`, `npm run test:engine`, `npm run build:verify`,
  `npm run check:assets` yesil.
- [ ] Kullanici gorsel **ve** hissedilen kabulu verdi (esek olcegi/animasyonu;
  uzak deponun gercekten pahali hissettirmesi).
- [ ] §4 kapsam disi listesinden hicbir sey V4'e sizmadi.
- [ ] V1 planinin §12'si guncellendi ve **arsivleme yeniden degerlendirildi** -
  V1 §10'un askidaki maddesi acikca "V4 bittiginde" diyor.

## 11. Uygulama Sirasi

Faz 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6.

Faz 2 (rota sorgusu) Faz 3'ten **once** gelmelidir: kervan yolunu bilmeden
yuruyemez. Faz 1 ve Faz 2 birbirinden bagimsizdir ve sirasi degistirilebilir;
Faz 1'in gorsel kabulunun erken alinmasi riski azaltir.

Faz 4, Faz 3 kabul edilmeden **baslamaz**: ekonomiyi gorunmeyen bir kervana
baglamak, iki hatayi ayni anda ayirt edilemez kilar.
