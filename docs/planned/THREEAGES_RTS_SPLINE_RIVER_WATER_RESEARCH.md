# ThreeAges RTS Spline Tabanli Nehir Suyu Teknik Arastirmasi

Olusturulma tarihi: 2026-07-24  
Durum: Faz 1 kodlandi - browser gorsel kabul bekliyor  
Kapsam: `RTS_GameplayProof` Landscape nehir yataklarinin akisa, kopuge,
yansimaya ve kalite profillerine sahip performans-dostu su yuzeyleriyle
render edilmesi.

Iliskili dokumanlar:

- [THREEAGES_RTS_LANDSCAPE_LEVEL_PLAN.md](THREEAGES_RTS_LANDSCAPE_LEVEL_PLAN.md)
- [THREEAGES_RTS_LANDSCAPE_CONCEPT.png](THREEAGES_RTS_LANDSCAPE_CONCEPT.png)

## 1. Karar Ozeti

Nehir, serbest yerlestirilmis ve olceklendirilmis bir plane ile
olusturulmamalidir. Onerilen cozum, mevcut Landscape spline'i tek cizgi
otoritesi olarak kullanan ayri bir **Spline River Water Body** sistemidir.

Onerilen sistem su parcalardan olusur:

1. Landscape spline'dan uretilen tek parca ribbon su geometrisi.
2. Spline UV/tanjant yonunu takip eden cift-faz normal-map akisi.
3. Kiyi, hizli akis, kaya ve kopru ayagi icin birlesik kopuk maskesi.
4. Kiyida sonen, dusuk genlikli vertex displacement/WPO.
5. Ayni su kotundaki su mesh'lerinin paylastigi tek planar reflection kaynagi.
6. Low/Medium/High kalite profilleri.

Three.js `Water2` dogrudan kullanilmamalidir. Bunun yerine:

- `Water2`nin cift normal-map ve flow-map yaklasimi,
- Forge `Reflective Surface`in planar reflection matematigi,
- mevcut Landscape spline/polyline altyapisi

Forge'a ait tek bir su sisteminde birlestirilmelidir.

## 2. Problem Tanimi

Hedef goruntu yalnizca mavi veya yari saydam bir yuzey degildir. Nehir:

- Sculpt edilmis yatagi takip etmeli.
- Donuslerde akis yonunu degistirmeli.
- Kiyilarda, kayalarda ve kopru ayaklarinda kopuk gostermeli.
- Sığ ve derin bolgelerde farkli okunmali.
- Gerektiginde cevreyi yansitmali.
- RTS kamerasi ve harita boyutunda kabul edilebilir GPU maliyetinde kalmali.
- Editor'daki authoring ile runtime goruntusu arasinda ayni veriyi kullanmali.

Gorsel su ile gameplay gecis kurali ayri otoritelerdir. Nehir mesh'i veya su
shader'i gizli navigation kurali uretmemelidir. V1'de gecilmezlik acik
`BP_RTS_NavigationBlocker` zincirleri ve kopru bosluklariyla tanimlanmaya devam
etmelidir.

## 3. Mevcut Repo Bulgulari

### 3.1 Landscape ve nehir yatagi

Aktif Landscape sidecar'i:

`public/landscapes/landscape-1.landscape.json`

Mevcut `spline-1`:

- Sekiz kontrol noktasi tasiyor.
- Butun kontrol noktalari `y = -2` kotunda.
- Nokta `width` degeri `4`; toplam yatak genisligi yaklasik 8 birim.
- `falloff = 3`.
- `smooth = true`.
- Deform ve paint segment efektleri uygulanmis.

Bu veri su mesh'i icin yeterli bir merkez cizgisi, genislik ve egri kaynagidir.
Ayri bir elle modellenmis nehir mesh'i gerektirmez.

Engine'de `splineToPolyline()` mevcut Landscape spline'ini cizgisel alt
segmentlere cozer:

`engine/scene/landscape.ts`

Mevcut varsayilan, egri segment basina sekiz alt ornektir. Su icin sabit ornek
sayisi yerine mesafe ve egim/egirlige gore adaptif ornekleme tercih edilmelidir.

### 3.2 Mevcut plane deneyi

Level'a `highpolyplane` static mesh'i eklenmistir:

`public/assets/ThreeAges/Levels/RTS_GameplayProof.level.json`

Bu mesh prototip shader denemesi icin kullanilabilir; nihai nehir geometrisi
icin uygun degildir:

- Kare/dikdortgen topolojisi nehir egirisini takip etmez.
- World-space akisi her donuste yeniden yonlendirmek gerekir.
- Kiyilarda gereksiz overdraw olusturur.
- Manifest girdisi collision ve shadow acik bir static mesh olarak tanimlidir.
- Su ile gameplay collision otoritesini yanlislikla birbirine baglama riski
  tasir.

### 3.3 Mevcut Reflective Surface

Mevcut `ReflectiveSurface`:

- `PlaneGeometry(1, 1)` kullanir.
- Aktor basina ayri `WebGLRenderTarget` olusturur.
- Varsayilan 512x512 half-float hedef ve 4x MSAA kullanir.
- `onBeforeRender` icinde sahneyi yansitilmis kamerayla tekrar render eder.
- Normal-map sapmasi ve Fresnel agirligiyla reflection texture'ini standart
  materyale karistirir.

Ilgili dosyalar:

- `engine/scene/reflectiveSurface.ts`
- `engine/render-three/reflectiveSurface.ts`

Bu yaklasim bir veya az sayida duz yuzey icin uygundur. Nehir boyunca cok sayida
Reflective Surface parcasi kullanmak, her parcanin ayri scene render'i
tetiklemesi nedeniyle uygun degildir.

Ayrica RTS `authoredWorld` yolu su anda static instance, Landscape ve isiklari
mount eder; `reflectiveSurfaces` dizisini mount etmez:

`src/scene/authoredWorld.ts`

Dolayisiyla Level'a konan deneysel Reflective Surface'in Editor'da gorunmesi,
RTS runtime'da otomatik olarak gorunecegi anlamina gelmez.

### 3.4 Mevcut su texture'lari

Manifestte en az su texture'lari mevcuttur:

- `t-water-n`: su normal texture'i.
- `t-water-m`: suya ait gri tonlu yardimci/mask texture'i.
- `water-caustics-*`: farkli caustics texture'lari.

`t-water-n`, ilk ribbon ve flow prototipinde kullanilabilir. Nihai cift-faz
akis icin:

- iki farkli normal texture'i veya
- ayni texture'in farkli olcek/donus/fazlarla iki ornegi

kullanilabilir. Iki farkli normal kaynagi daha az tekrar hissi verir.

## 4. Degerlendirilen Cozumler

| Secenek | Gorsel sonuc | Maliyet | Authoring | Karar |
| --- | --- | --- | --- | --- |
| Buyuk plane + su materyali | Akis nehir egirisini izlemez, kiyilar sorunlu | Dusuk/orta | Kolay fakat kirilgan | Reddedildi |
| Her spline segmentine plane/Reflective Surface | Parca izleri ve cok reflection pass | Yuksek | Zor | Reddedildi |
| Three.js `Water2`yi dogrudan kullanmak | Reflection/refraction/flow iyi, kopuk ve spline authoring eksik | Ana render + reflection + refraction | Forge verisine uyarlama gerekli | Referans olarak kullan |
| Spline ribbon + ozel shader | Akis, kiyi ve kopuk kontrolu yuksek | Dusuk/olceklenebilir | Mevcut spline ile dogal | Onerilen |
| Tam ekran depth/refraction su pipeline'i | En yuksek esneklik | Yuksek ve genis renderer degisikligi | Karmasik | Opsiyonel High kalite |

## 5. Onerilen Veri ve Otorite Modeli

Landscape spline suyun bicimini tanimlar; suya ozel ayarlar ayri aktorde
tutulur. Boylece Landscape, deform/paint sorumlulugunu korur ve su renderer'i
Landscape sidecar'ina shader ayrintilari doldurmaz.

Ornek taslak:

```json
{
  "id": "river-water-1",
  "type": "river",
  "landscapeRef": "landscape-1",
  "splineRef": "spline-1",
  "surfaceLevel": -1.4,
  "widthScale": 0.88,
  "flowSpeed": 0.35,
  "normalScale": 1.0,
  "waveAmplitude": 0.04,
  "waveLength": 3.5,
  "foamProfile": "temperate-river",
  "reflectionMode": "shared-planar",
  "reflectionGroup": "river-level-minus-1-4"
}
```

Alan adlari uygulama oncesi engine naming kurallarina gore kesinlestirilmelidir.
Temel otorite sinirlari:

| Veri | Otorite |
| --- | --- |
| Merkez egri, nokta genisligi | Landscape spline |
| Yatak sculpt/paint | Landscape |
| Su kotu ve gorunen genislik | River Water Body |
| Akis hizi, dalga, renk, kopuk | Water profile/material |
| Reflection kalite ve paylasim grubu | River Water Body + kalite profili |
| Gecilebilirlik | RTS blocker/bridge marker'lari |
| Terrain-aware unit Y/picking | Ayri Landscape gameplay fazi |

## 6. Ribbon Geometri Uretimi

### 6.1 Ornekleme

Spline, mesafe ve egrilige gore orneklenmelidir:

- Duz bolgede 1.5-2.0 birim aralik.
- Keskin donuste 0.5-1.0 birim aralik.
- Her kontrol noktasi genisligi komsu ornekler arasinda interpolate edilir.
- Cok uzun authored segmentler sabit sekiz parcayla birakilmaz.

### 6.2 Enine kesit

Her uzunluk orneginde 5-9 enine vertex yeterlidir:

- Sol kiyi.
- Sol ic bant.
- Merkez.
- Sag ic bant.
- Sag kiyi.

Daha fazla enine vertex yalnizca belirgin WPO veya enine derinlik profili
gerektiginde kullanilmalidir.

Bu harita olceginde ribbon muhtemelen birkac yuz ile birkac bin vertex arasinda
kalir. Mesh her kare CPU'da yeniden uretilmez; yalniz Editor spline degisikligi,
load veya save sonrasinda rebuild edilir.

### 6.3 UV ve vertex attribute'lari

Onerilen attribute'lar:

| Attribute | Amac |
| --- | --- |
| `uv.x` | Nehir boyunca normalize veya tekrarli arc-length |
| `uv.y` | Sol kiyidan sag kiyiya 0..1 |
| `flowDirection` | World/local XZ spline tanjanti |
| `shoreDistance` | Kiyiya normalize uzaklik |
| `waterDepth` | Su kotu ile Landscape yuksekligi farki |
| `foamMask` | Baked/authored kopuk agirligi |
| `flowSpeed` | Yerel akis hizi veya rapids carpani |

`uv.x`, kontrol noktasi indeksiyle degil kümülatif mesafeyle uretilmelidir.
Boylece texture yogunlugu uzun ve kisa spline segmentlerinde sabit kalir.

## 7. Su Shader'i

### 7.1 Akis

Ana akis efekti vertex hareketi degil, spline boyunca kayan normal texture'idir.

Onerilen algoritma:

1. Iki normal ornegi farkli fazlarda akis yonunde kaydirilir.
2. Ornekler periyodik olarak birbirine blend edilir.
3. Bir faz sifirlanirken digeri gorunur durumda kalir.
4. UV'nin U yonu nehir boyunca aktigi icin normal akisi donusleri otomatik
   takip eder.

Bu yontem, Three.js `Water2`nin akista gorunen texture reset'ini saklamak icin
kullandigi yaklasimdir.

Global `flowDirection` yalnizca duz su yuzeyleri icin yeterlidir. River ribbon
icin yon:

- UV/tangent basis'ten,
- per-vertex spline tanjantindan veya
- karmasik kavsaklarda flow map'ten

alinmalidir.

### 7.2 Sığ/derin su

Su rengi tek sabit renk olmamalidir. `waterDepth` kullanilarak:

- Kiyida daha acik, daha saydam ve yatak rengini gosteren su.
- Merkezde daha koyu/mavi-yesil ve daha az saydam su.
- Sığ bolgede daha belirgin caustics.
- Derinde daha kuvvetli absorption.

uretilebilir.

Landscape height verisi CPU'da zaten mevcut oldugu icin, derinlik ribbon
rebuild sirasinda vertex attribute veya dusuk cozumlu texture olarak
hesaplanabilir. Bu, her pikselde Landscape height aramaktan daha ucuzdur.

### 7.3 WPO / vertex displacement

Three.js'te Unreal'daki isimle bir `World Position Offset` girisi yoktur.
Ayni sonuc vertex shader'da vertex pozisyonunu degistirerek elde edilir.

Nehir icin onerilen aralik:

- Genlik: 0.02-0.08 dunya birimi.
- Ana dalga: akis yonunde.
- Ikincil dalga: daha dusuk genlikli capraz/noise bileseni.
- Rapids bolgesi: daha yuksek frekans ve genlik.
- Kiyi: displacement sifira yaklasir.

Okyanus icin kullanilan buyuk Gerstner dalgalari nehre aynen uygulanmamalidir.
Yatay Gerstner hareketi kiyida bosluk ve arazi icine girme uretebilir. Bu
nedenle `shoreDistance` ile yatay/dikey displacement sonmelidir.

Gorsel oncelik:

1. Akis yonlu normal.
2. Kopuk.
3. Reflection.
4. Sığ/derin renk.
5. Dusuk genlikli gercek vertex hareketi.

## 8. Kopuk Sistemi

Tek bir otomatik cozum yerine birlesik maske onerilir.

### 8.1 Kiyi kopugu

`uv.y` veya `shoreDistance` ile hesaplanir:

- Kiyiya yaklastikca kopuk agirligi artar.
- Noise ile duz serit gorunumu kirilir.
- Akis yonunde yavasca kaydirilir.
- WPO kiyi bandinda azaltilir.

Bu katman texture/ALU disinda ek scene render'i gerektirmez.

### 8.2 Rapids ve egrilik kopugu

Asagidaki veriler birlestirilebilir:

- Yerel spline egriligi.
- Author edilen `flowSpeed`.
- Yatak egimi.
- Daralan genislik.
- Procedural noise.
- Artist-authored segment maskesi.

Keskin donusun dis kenarinda veya dar bogazda kopuk artirilabilir.

### 8.3 Kaya ve kopru ayagi kopugu

Performans ve sanat kontrolu icin statik engellere:

- `WaterFoamPoint`,
- `WaterFoamStrip` veya
- spline segmenti uzerinde foam stamp

eklenmesi onerilir.

Bu veriler dusuk cozumlu bir nehir maskesine bake edilebilir veya shader'a
sinirli sayida nokta olarak verilebilir. Sahnedeki her mesh'e dinamik uzaklik
hesaplanmamalidir.

### 8.4 Depth-intersection foam

Scene depth texture ile su pikselleri ve ondeki geometri arasindaki derinlik
farki olculerek otomatik kesişim kopugu olusturulabilir. Bu yontem:

- Kaya,
- kiyi,
- kopru ayagi

temaslarinda iyi sonuc verir.

Ancak mevcut RTS direct-render yolunda paylasilan scene depth texture yoktur.
Depth prepass veya render pipeline entegrasyonu gerekir. Ayrica butun sahne
depth'i kullanilirsa suya giren birimler de kopuk uretebilir.

Karar:

- V1: Kiyi maskesi + authored/baked static obstacle kopugu.
- High kalite opsiyonu: Yalnizca secili static-water-obstacle layer'ini kullanan
  depth-intersection foam.

## 9. Kavsaklar, Iki Kol ve Girdaplar

Normal nehir egirisinde spline UV/tanjanti yeterlidir. Su durumlarda yerel flow
map gerekir:

- Iki nehir kolunun birlesmesi.
- Bir kolun ikiye ayrilmasi.
- Kopru ayagi arkasinda girdap.
- Keskin donus icindeki geri akis.
- Selale altindaki dairesel dagilim.

Flow map:

- RG kanallarinda normalize XZ akis vektoru,
- istege bagli B kanalinda yerel hiz veya turbulence

tasiyabilir.

Kavsak icin iki ribbon'i ust uste bindirmek yerine ozel bir junction patch
geometrisi uretilmelidir. Flow map yalnizca bu patch'te kullanilir; butun nehir
icin zorunlu tutulmaz.

## 10. Reflection Mimarisi

### 10.1 Neden ribbon da planar reflection kullanabilir?

Planar reflection gorunen mesh'in dikdortgen olmasini gerektirmez. Yansitma
kamerasi matematiksel bir duzleme gore kurulur. Ayni duzlem uzerindeki kivrimli
ribbon mesh de ayni reflection texture'ini ornekleyebilir.

Mevcut nehir noktalarinin tumu `y = -2` oldugu icin tek sabit su kotu V1 icin
uygundur. Su yuzeyi ornegin `y = -1.4` civarinda tutulursa tek planar reflection
kaynagi kullanilabilir. Kesin kot, yatak derinligi ve kiyi goruntusu Editor'da
ayarlanmalidir.

### 10.2 Paylasilan reflection kaynagi

Mevcut actor-basi model yerine:

```text
Shared Planar Reflection Source
              |
      +-------+-------+
      |               |
 River Water 1   River Water 2
```

Ayni kot ve reflection grubundaki su mesh'leri:

- tek mirrored camera,
- tek render target,
- tek scene render

paylasir.

`ReflectiveSurface` icindeki reflection uretimi, gorunen plane mesh'inden
ayrilip paylasilabilir bir `PlanarReflectionSource`/`PlanarReflectionProbe`
haline getirilebilir.

### 10.3 Eğimli su ve selaleler

Tek planar reflection:

- ayni duzlemdeki nehir ve gol icin dogru,
- egimli su yuzeyi boyunca matematiksel olarak yanlis,
- selale icin uygun degildir.

Farkli su kotlari gerekirse nehir az sayida `reach` bolgesine ayrilmalidir:

- Her yatay reach bir reflection grubu.
- Kot degisimi selale/rapids mesh'i.
- Selale icin environment/reflection capture, noise, foam ve particle.

Her spline segmentine planar reflection verilmemelidir.

### 10.4 Kalite kademeleri

| Profil | Reflection |
| --- | --- |
| Low | Planar kapali; sky/environment veya reflection capture |
| Medium | %25-%35 ekran cozumurlugu; iki karede bir veya kamera hareketinde update |
| High | %50 ekran cozumurlugu veya kontrollu 512 hedef; daha sik update |

Ek optimizasyonlar:

- Reflection pass'te shadow auto-update kapali.
- Su, foam, editor helper, UI ve gereksiz efekt layer'lari reflection'dan
  cikarilir.
- Kamera ve sahne sabitse reflection yeniden render edilmez.
- Gorunmeyen su grubunun reflection'i update edilmez.
- Sabit 4x MSAA yerine kalite profiline gore 0/2/4 secilir.
- Cok uzak top-down goruste eski reflection texture'i yeniden kullanilir.

## 11. Refraction ve Su Alti Goruntusu

Three.js `Water2`, reflection ve refraction icin iki ayri yardimci render
calistirir. Bu, ana sahne render'ina ek olarak iki scene render'i demektir.

RTS V1 icin tam refraction onerilmez. Daha ucuz cozum:

- Opaque Landscape/yatak once render edilir.
- Su transparent veya uygun blend sirasinda render edilir.
- Sığ/derin renk ve alpha yatak goruntusunu kontrol eder.
- Normal map reflection UV'sini hafif bozar.

Alt sahnenin gercek screen-space distortion'i daha sonra kalite opsiyonu olarak
eklenebilir. Full refraction pass ilk uygulama dilimine alinmamalidir.

## 12. Performans Butcesi

Hedef V1 maliyeti:

- Bir bagli nehir govdesi icin bir draw call veya az sayida chunk.
- Birkac yuz/birkac bin vertex.
- CPU'da yalniz spline degisince geometri rebuild.
- Kare basina yalniz `time`, akis ve kalite uniform guncellemesi.
- Surekli kopuk icin particle kullanmama.
- Particle'i yalniz selale, carpma ve seyrek vurgu noktalarinda kullanma.
- En fazla bir paylasilan planar reflection pass.
- Full refraction pass olmamasi.

Yaklasik render yapisi:

| Profil | Ana sahne | Reflection | Refraction | Toplam scene render |
| --- | ---: | ---: | ---: | ---: |
| Low | 1 | 0 | 0 | 1 |
| Medium/High onerilen | 1 | 1 paylasilan/throttled | 0 | 1-2 |
| Water2 benzeri tam yol | 1 | 1 | 1 | 3 |

Medium profil reflection'i her kare yenilemediginde ortalama maliyet iki tam
render'dan daha dusuk olur.

## 13. Editor Authoring Akisi

Onerilen tasarimci akisi:

1. Landscape actor secilir.
2. Landscape spline ile nehir yatagi deform/paint edilir.
3. `River Water Body` eklenir.
4. `landscapeRef` ve `splineRef` secilir.
5. Su kotu, genislik carpani ve profil atanir.
6. Gereken segmentlere rapids/foam degeri verilir.
7. Kaya ve kopru ayaklarina foam point/strip eklenir.
8. Editor viewport'ta Low/Medium/High preview secilir.
9. Save sonrasinda ayni actor ve spline RTS runtime'da mount edilir.

Preview'da:

- Ribbon siniri,
- akis oklari,
- kiyi kopuk bandi,
- yerel hiz,
- reflection group

debug gorunumlari yararli olur.

## 14. Onerilen Uygulama Fazlari

Bu bolum uygulama onayi sonrasi izlenecek sirayi tanimlar; arastirma dokumaninin
olusturulmasi bu maddeleri tamamlamaz.

### Faz 1 - Spline ribbon prototipi

- [x] River Water Body veri modelini ve save validator allowlist'ini tanimla.
- [x] `landscapeRef + splineRef` cozumleme kurallarini ekle.
- [x] Adaptif spline ribbon geometry uret.
- [x] Arc-length UV, shore distance ve flow tangent attribute'larini yaz.
- [x] Editor ve RTS `authoredWorld` mount/dispose destegi ekle.
- [x] Reflection olmadan temel renk + `t-water-n` akis prototipi yap.

Kabul:

- Su tek mesh olarak mevcut `spline-1`i takip eder.
- Donuslerde akis texture'i yon degistirir.
- Kiyida plane tasmasi veya kare sinir gorunmez.
- Runtime restart/dispose sonrasinda GPU kaynagi sizmaz.

Uygulama notu (2026-07-24): `river-water-1`, `RTS_GameplayProof` level'inda
`landscape-1/spline-1` referansiyla tanimlandi. Ribbon CPU'da yalniz load veya
editor spline degisikliginde yeniden uretilir; su mesh'i picking, collision ve
navigation otoritesinden dislanmistir. `npx.cmd tsc --noEmit`,
`npm.cmd run test:engine` ve `npm.cmd run build:verify` basarili. Kiyi/akis
gorsel kabulunun editor ve RTS browser smoke ile ayrica yapilmasi gerekir.

### Faz 2 - Su materyali ve temel kopuk

- [x] Cift-faz normal flow ekle.
- [x] Sığ/derin renk ve alpha uygula.
- [x] Kiyi displacement sonumunu ekle.
- [x] Kiyi ve procedural rapids kopugunu ekle.
- [x] Dusuk genlikli WPO ekle.
- [x] Su shadow/collision/render-order kurallarini netlestir.

Kabul:

- Akista gorunur texture reset'i yoktur.
- Kiyida vertex hareketinden kaynakli bosluk/tasma yoktur.
- Su yatagi top-down kamerada okunur.

Uygulama notu (2026-07-24): Ribbon'a Landscape yuksekliginden bake edilen
`waterDepth` ve spline egrilik/egiminden uretilen `rapidness` attribute'lari
eklendi. Shader iki farkli hiz/olcekte normal fazini blend eder; kiyida WPO
soner ve kopuk yalniz kiyi/rapid verisinden gelir. Su `transparent`,
`depthWrite=false`, shadow kapali ve collision/navigation disidir. Production
build ile gameplay-proof authored-level browser smoke basarili; paylasilan
engine paketi ise ilgisiz yol `ageLayers` beklenti uyusmazliginda duruyor.

### Faz 3 - Paylasilan planar reflection

- [x] Reflection uretimini gorunen Reflective Surface plane'inden ayir.
- [x] Ayni kot/grup sular icin tek reflection kaynagi kullan.
- [x] Resolution scale, update interval ve visibility throttling ekle.
- [x] Low/Medium/High kalite baglantisini kur.
- [ ] Reflection render layer filtresini ekle.

Kabul:

- Iki nehir ayni kotta tek reflection scene render'i paylasir.
- Her spline segmenti ayri render target olusturmaz.
- Low profilde planar reflection tamamen kapanabilir.

Uygulama notu (2026-07-24): `PlanarReflectionSource`, gorunen plane yerine
River Water Body tarafindan paylasilan bir render target/kamera kaynagidir.
Gruplama anahtari reflection group + dunya su kotu + kalite profilini icerir;
farkli kotlar ayni hedefi paylasamaz. Low kaynak olusturmaz, Medium 256px ve
en az 32ms, High 512px ve en az 4ms aralikla guncellenir. Kaynak, gorunmeyen
su ribbon'i cizilmedigi icin update edilmez. Render-layer filtrelemesi sonraki
Faz 3 dilimi olarak acik kalir.

### Faz 4 - Author edilen obstacle kopugu

- [ ] Foam Point/Strip veya esdeger authoring verisini tanimla.
- [ ] Kopru ayagi ve kayalar icin maskeyi ribbon'a uygula.
- [ ] Segment bazli rapids/hiz authoring'i ekle.
- [ ] Kavsak gerekiyorsa junction patch + yerel flow map ekle.

Kabul:

- Kopru ayagi ve kaya etrafinda kontrollu kopuk vardir.
- Kopuk birim ve gecici aktorlerde istemsiz tetiklenmez.

### Faz 5 - Opsiyonel yuksek kalite

- [ ] Secili water-obstacle layer'i icin depth-intersection foam prototipi.
- [ ] Screen-space refraction/distortion prototipi.
- [ ] Farkli su kotlari/reach ve selale sinirlarini tasarla.
- [ ] GPU zaman olcumu sonucuna gore ozellikleri kalite profiline bagla.

## 15. Dogrulama ve Olcum

Kod uygulamasinda AGENTS kurallarina gore temel gate:

```powershell
npx.cmd tsc --noEmit
npm.cmd run test:engine
npm.cmd run build:verify
```

Browser/Playwright kabulunde:

- Editor'da spline noktasi tasindiginda ribbon rebuild.
- Save/reload sonrasinda River Water Body referanslari.
- RTS runtime'da authored Landscape ve suyun birlikte mount edilmesi.
- Console error ve WebGL warning kontrolu.
- Kiyi, kopru ayagi ve donuslerde ekran goruntusu.
- Low/Medium/High karsilastirmasi.
- Reflection acik/kapali GPU frame-time karsilastirmasi.
- Uzak ve yakin RTS kamera zoom seviyeleri.

Olculmesi gereken metrikler:

- Su draw call sayisi.
- Su vertex/triangle sayisi.
- Reflection pass GPU suresi.
- Ana sahne GPU suresi.
- Render target bellek tahmini.
- Reflection update frekansi.
- Shader compile varyant sayisi.

Otomatik testler gorsel kabul yerine gecmez. Su akis yonu, kopuk okunurlugu,
reflection stabilitesi ve kiyi artefaktlari hedefli browser smoke veya manuel
kabul gerektirir.

## 16. Riskler ve Onlemler

| Risk | Etki | Onlem |
| --- | --- | --- |
| Her segmentte reflection actor | Scene render sayisi patlar | Kot/grup basina paylasilan reflection |
| Buyuk kare plane | Kiyi overdraw ve yanlis akis | Spline ribbon geometry |
| Full Water2 kullanimi | Reflection + refraction maliyeti | Yalniz cift-normal akis fikrini al |
| Buyuk Gerstner dalgasi | Nehir/kiyi tasmasi | Dusuk genlik + shore fade |
| Spline segment basina sabit az ornek | Keskin donuste kirik mesh | Adaptif arc-length/egrilik ornekleme |
| Depth foam tum aktorleri gorur | Birimler etrafinda istemsiz kopuk | Static obstacle layer veya authored mask |
| Eğimli nehirde tek planar reflection | Yanlis perspektif | Yatay reach gruplari + selale ayirimi |
| Su mesh'inden navigation turetmek | Gizli gameplay otoritesi | Blocker/bridge marker otoritesini koru |
| Transparent render-order | Kiyi, fog ve overlay artefakti | Acik renderOrder/depthWrite testi |
| Editor var, RTS mount yok | Runtime'da kayip su | Generic authored-world mount/dispose |

## 17. Nihai Tavsiye

ThreeAges icin en dengeli cozum:

**Landscape spline tabanli ribbon geometri + Water2 esinli cift-normal akis +
hybrid kopuk maskesi + kalite profiline bagli paylasilan planar reflection.**

Ilk prototip reflection veya depth foam ile baslamamalidir. Once mevcut
`spline-1`in:

- tek mesh olarak izlenmesi,
- donuslerde dogru akmasi,
- kiyiya oturmasi,
- sığ/derin gorunmesi

kanitlanmalidir. Reflection, bu temel geometri ve materyal kabul edildikten sonra
paylasilabilir kaynak olarak eklenmelidir.

## 18. Dis Kaynaklar

- Three.js Water2 r184:
  <https://github.com/mrdoob/three.js/blob/r184/examples/jsm/objects/Water2.js>
- Three.js Reflector:
  <https://threejs.org/docs/pages/Reflector.html>
- Three.js WaterMesh:
  <https://threejs.org/docs/pages/WaterMesh.html>
- Three.js DepthTexture:
  <https://threejs.org/docs/pages/DepthTexture.html>
- NVIDIA GPU Gems - Effective Water Simulation from Physical Models:
  <https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models>
