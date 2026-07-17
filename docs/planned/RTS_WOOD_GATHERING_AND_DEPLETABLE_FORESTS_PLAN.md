# RTS Odun Toplama ve Tukenebilir Orman Plani

Durum: uygulandi; hedefli browser smoke bekliyor.  
Kapsam: `?rts` oduncu kampi, tekil agac kaynaklari, isci davranisi, harita
sanati ve ilgili UI/test yuzeyleri.

## Hedef davranis

1. Oduncu Kampi ancak yakininda en az bir erisilebilir, canli agac varsa
   kurulabilir.
2. Atanan isci kampa degil belirli bir agaca gider, keser, tasima kapasitesi
   dolunca kampa doner ve odunu kampin yerel tamponuna birakir.
3. Her agac kendi miktarina sahiptir. Bir agac bitince dunya gorseli kaybolur
   (veya ayri bir kutuk gorseline doner), diger agaclar calismaya devam eder.
4. Kamp tamponundaki odun mevcut yol-depo lojistigiyle cebe aktarilir. Iscinin
   kamp--depo arasinda ikinci kez yurumesi bu ilk dilimin kapsami degildir.

Bu, oyuncuya "kampi ormana kur / isciyi agaca gonder / orman bittiginde yeni
kamp kur" kararini verir; mevcut yol ve depo kararini bozmadan yapar.

## Mevcut durum ve acik

| Yuzey | Bugun | Gereken |
| --- | --- | --- |
| `lumber_camp` | Orman istemez, sinirsiz `wood` uretir. | Yakin canli agac gerektirir. |
| Isci atamasi | Isci binanin yaklasma noktasinda bekler. | Agac -> kesim -> kamp -> bosaltma dongusu. |
| Kaynak modeli | Tas/altin sonlu, tek nokta kaynak dugumudur. | Odun sonlu ve her agac ayri kaynak varligidir. |
| Orman sanati | `RtsMapArt`, tek bir `Resource_PineTree_Group.gltf` kullanir. | Tekil agac varyantlariyla, kaynak durumuna bagli gosterim. |
| Lojistik | Bagli uretici tamponu aninda depoya/cuze aktarilir. | Kamp tamponu ayni sekilde aktarilir; bu asamada araba eklenmez. |

Var olan `ResourceNodeSystem`, sonluluk ve snapshot icin faydali bir baslangic
olsa da, extractor footprint'i icindeki *tek* dugumu arar. Bu kural agac
toplamaya uygun degildir: kamp ormana yakin olur, isci ise agaca tek tek gider.

## Onerilen model

### 1. Mantiksal kaynak: `ForestSystem`

`src/game/rts/economy/forestSystem.ts` renderer'dan bagimsiz yeni otorite
olsun. Her `TreeDefinition` su alanlari tasir:

- `id`, `x`, `z`, `variant`, `capacity`, `remaining`
- istege bagli `forestId` (UI/AI icin ayni korudaki agaclari gruplayabilmek)
- `depleted` turetilmis alan; ayri mutable bayrak tutulmaz.

API minimumu:

- `nearbyLiveTrees(x, z, radius)`
- `reserveTree(workerId, campId)` / `releaseReservation(workerId)`
- `harvest(treeId, requested)`
- `snapshots()` ve `reset()`

Rezervasyon ayni agaca tum iscilerin yigilmasini engellemeli; varsayilan olarak
agac basina bir isci, sonradan data ile artirilabilen `maxWorkers` yeterlidir.
Bir agac biterse rezervasyonlar serbest birakilir ve isci en yakin erisilebilir
canli agaca yeniden atanir.

Tas ve altin icin mevcut `ResourceNodeSystem` korunur. Ortak bir kaynak arayuzu
ancak ikinci kaynak turu de ayni tasima davranisina gecerse cikarilmalidir;
simdi erken soyutlama gereksiz risk yaratir.

### 2. Kamp kurulum kurali

`lumber_camp.economy` verisine asagidaki alanlar eklenmeli:

```json
{
  "requiresForest": true,
  "gatherRadius": 12,
  "carryCapacity": 5,
  "harvestSeconds": 1.2
}
```

`StructureConstructionService` icin genel `missing-resource-node` kuralini
odunla yamalamak yerine yeni bir placement validator sonucu eklenmeli:
`missing-forest`. Validator, kamp merkezinin `gatherRadius` mesafesinde en az
bir canli agac bulur. Yerlesim onizlemesi ve Build Palette ayni nedeni
"Yakinda kesilebilir agac yok" olarak gosterir.

Kampin footprint'i agac konumlarini kaplamamalidir. Orman, yol bulmayi
kilitleyen yogun bir duvar olmamali; her agacin etrafinda en az bir calisma
yaklasma noktasi aranmalidir.

### 3. Isci durumu ve teslim dongusu

Mevcut `EconomyProductionSystem` isci sahipligini zaten tek merkezde tutar.
Ayri bir wood sistemi eklemek iki sistemin ayni isciyi ele almasi riskini
dogurur. Bu nedenle atama kaydi su durumlarla genisletilmeli:

`moving-to-tree` -> `harvesting` -> `returning-to-camp` -> `unloading`.

Atama kaydi `treeId`, `cargoAmount` ve agac/kamp yaklasma noktalarini tasir.
Kesim yalniz `harvesting` durumunda agacin `remaining` degerini azaltir; kampin
`localBuffer` degeri yalniz `unloading` durumunda artar. Boylece odun agactan
kampin tamponuna isinlanmaz ve UI'daki uretim orani gercek yurume mesafesini
yansitir.

Kamp tamponu doluysa, isci eldeki yukunu once kampa birakir; sonra "tampon
dolu" durumunda kampta bekler. Agac bittiyse eldeki yuk yine teslim edilir,
ardindan isci serbest kalir veya ayni koruda yeni agac arar.

### 4. Harita ve gosterim

`RtsMapBlockout` icine `forests` veya duz `trees` authored verisi eklenmeli.
Oyuncu ve dusman baslangicinda en az birer kucuk koru, haritanin genisleme
alanlarinda daha zengin korular olmali; AI'nin mevcut `lumber_camp` anchor'lari
bu yaricapta kalacak sekilde tasinmalidir.

`RtsForestArt` sadece gosterim sorumlusu olsun. `Resource_Tree1.gltf`,
`Resource_Tree2.gltf` ve `Resource_PineTree.gltf` varyantlari kullanilsin;
`*_Group.gltf` orman kaynagi olarak kullanilmasin. Her mantiksal agac ayri
`treeId` ile eslesir ve tukendiginde o agacin gorseli gizlenir/sokulur.

Performans icin tavsiye: mantikta her agac ayri varlik kalsin; ayni varyanttaki
goruntuler `InstancedMesh` ile cizilebilsin. Bu tek bir "kalabalik static
mesh" degildir: `instanceId -> treeId` eslemesiyle her agac bagimsiz tuketilir
ve secilebilir. Ilk V1'de agac sayisi dusukse tekil `Group` clone'lariyla
baslayip, profil sonucu gerekirse instancing'e gecmek de guvenlidir.

### 5. UI, bildirim ve AI

- Secili kampta: atanan isci, calisan isci, tasinan yuk, yakin canli agac
  sayisi, tampon ve "orman tukendi" durumu gorunmeli.
- Mevcut `resource-depleted` bildirimi `wood:<forestId>` anahtariyla koru
  bazinda bir kez gonderilmeli; tek agac icin bildirim spam'i yapilmamali.
- AI, baslangic ve genisleme `lumber_camp` anchor'larini yalniz orman
  validator'u geciyorsa kullanmali. Koru bitince yeni canli koru bulamazsa
  ekonomi darbogazi `no-wood-source` olarak gorunmeli; ayni kampa tekrar tekrar
  kurma denememeli.

## Uygulama sirasi

1. **Veri ve orman otoritesi:** tree tanimlari, `ForestSystem`, balance
   validatoru ve deterministic unit testleri.
2. **Yerlesim ve harita:** kamp yakinlik validatoru, oyuncu/AI korulari ve
   `RtsForestArt`; grup meshini kaldirma.
3. **Toplama dongusu:** EconomyProductionSystem'de agac-hedefli atama, yuk ve
   kamp teslimi; mevcut worker ownership kurallarini koruma.
4. **Okunurluk:** selection/debug snapshot'lari, koru-bitti bildirimi ve AI
   fallback'i.
5. **Denge ve kabul:** yurume mesafesine gore oran, agac kapasitesi, baslangic
   korusu ve genisleme korusu ayarlari.

## Kabul kriterleri

- [x] Agacsiz alanda Oduncu Kampi onizlemesi gecersiz ve neden acik.
- [x] Isci bir agaca gider, keser, sonra kampa donup yukunu
      birakir; cebe giren odun kamp tamponu ve mevcut lojistikten gecer.
- [x] Bir agac bitince yalniz o agac kaybolur; komsu agaclar
      kesilmeye devam eder.
- [x] Koru tamamen bitince isci serbest kalir veya erisilebilir baska agaca
      yeniden atanir; sonsuz path/atama dongusu olmaz.
- [x] Tas/altin sonlu dugum davranisi ve tarla uretimi gerilemez.
- [ ] AI baslangicta gecerli bir koru yakini kamp kurar; koru bittiginde
      gecersiz anchor'a takilmaz.
- [ ] Hedefli `?rts&debug` browser smoke: kamp onizlemesi, agaca gidis, kampa
      teslim ve tekil agac kaybolmasi goruldu.
- [x] `npx.cmd tsc --noEmit`, `npm.cmd run test:engine` (1026 kontrol) ve
      `npm.cmd run build:verify` basarili.

## Uygulama kaydi (2026-07-17)

- `ForestSystem`, `RTS_BLOCKOUT_MAP.trees` ve `RtsMapArt` ile her agac mantikta
  ve gorselde ayri tutuldu; eski orman grup meshi kaldirildi.
- `lumber_camp` balance verisi `requiresForest`, `gatherRadius` ve
  `carryCapacity` ile tanimlandi. Yerlesim ve palette `missing-forest`
  gerekcesini verir.
- Ekonomi atamasi agaca gidis, kesim, kampa donus ve bosaltma durumlarini
  tasir. Odun yalniz bosaltma aninda kampin yerel tamponuna girer.
- Hedefli engine testi agacsiz yerlesimi, tek agacin tuketimini, kampa teslimi
  ve isci serbest birakilmasini kanitlar.

## Acik tasarim kararleri

1. **Tukenince ne gorunur?** Varsayilan onerim agaci kaldirmak; kutuk mesh'i
   varsa daha okunakli oldugu icin tercih edilir. Kutuk kaynak degildir.
2. **Yenilenme var mi?** V1'de yok. Yenilenme, arazinin stratejik degerini
   dusurur ve AI/dengeyi yeniden tasarlamayi gerektirir.
3. **Kamp yakini mi, agac ustune mi?** Kamp, koru yaricapi icinde ama agac
   ustune degil kurulur. Bu hem okunur hem de kirsal alan hissini korur.
4. **Agaclar engel mi?** V1'de sert navigation blocker olmasin; her agac icin
   erisilebilir calisma noktasi yeterli. Yogun orman icinde pathing/clearance
   istendiginde bu ayrica ele alinmali.
