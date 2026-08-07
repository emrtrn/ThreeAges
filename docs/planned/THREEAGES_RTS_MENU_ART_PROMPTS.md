# ThreeAges RTS - Menu ve Yukleme Gorseli Uretim Prompt'lari

Olusturulma tarihi: 2026-08-08
Ilgili plan: `THREEAGES_RTS_MAIN_MENU_LOADING_PLAN.md` (§10)
Hedef arac: **GPT Image 2**

Iki gorsel uretilecek:

| Dosya | Nerede | Guvenli alan |
| --- | --- | --- |
| `public/assets/ui/menu-background.jpg` | Ana menu fonu (kalici) | **Orta** ~%40 genislik / ~%70 yukseklik kartin altinda kalir |
| `public/assets/ui/loading-background.jpg` | Yukleme perdesi fonu | **Alt %20** ilerleme cubugu ve metin icin sakin/koyu |

## 1. Sanat yonu nereden cikti

Prompt'lar uydurulmadi; depodaki varliklardan turetildi. Oyunun uslubu
**stylized low-poly, flat-shaded, vertex-color'li** - `.vertexcolors.json`
sidecar'lari (`public/assets/ThreeAges/StaticMeshes/`) bunu dogruluyor, birçok
mesh dokuya degil koseli renk bloklarina dayaniyor.

Dunyada gercekten bulunanlar:

- **Binalar** (First Age / Second Age, her biri Level 1-3): Command Center,
  Barracks, Archery Range, Farm (+ ayri bugday mesh'i), House, Depot,
  Hunting Camp, Gold Mine, Quarry, Lumber Camp, Market, Outpost, Dock
- **Birimler**: Worker, Guard, Archer, Siege
- **Hayvanlar**: Deer, Stag, Wolf, Fox, Cow, Bull, Donkey, Horse
- **Doga**: huş (birch), akcaagac (maple), common tree, olu agaclar, cicekli
  calilar, uzun/ince cimen, `Mountain4K`
- **Zemin**: nehir + ahsap koprular, yollar (cag ilerledikce toprak ->
  parke tasi)
- **Caglar**: Yerlesim (settlement) -> Kasaba (town) -> sehir

**Onemli kisit:** gorseller oyun icindeki gorunume yakin durmali. Fotogercekci
veya agir yagliboya bir key-art, low-poly sahneye gecisde tokat gibi carpar.
Prompt'lar bu yuzden bilerek "stylized low-poly 3D render" istiyor.

## 2. Boyut ve kirpma

Hedef **1920x1080 (16:9)**. GPT Image 2 yatay ciktiyi 3:2'ye yakin bir oranda
(orn. 1536x1024) verirse, 16:9'a kirpmak icin **ust ve altta pay birakacak
sekilde** komposizyon kur - iki prompt da bunu zaten soyluyor. Sonra:

1. 1536x1024 -> merkezden 1536x864'e kirp
2. 1920x1080'e olcekle
3. JPEG kalite ~85 kaydet (`.webp` de olur; plan iki uzantiyi da kabul eder)

## 3. Prompt - Ana menu fonu

**Konu:** oyunun adini anlatan tek kare - ayni vadide uc cag ust uste.

```
A wide stylized low-poly 3D rendered landscape of a medieval valley at golden
hour, painted in the clean flat-shaded vertex-colored style of a low-poly
strategy game. The composition is a deep panoramic vista seen from a high
vantage point on a hillside.

Left third of the frame: a small humble settlement of timber-and-thatch houses
with a modest wooden hall, a wheat farm with neat golden fields, a lumber camp
with stacked logs, and a dirt path winding between them. A few deer graze at
the treeline.

Right third of the frame: a larger walled town with stone-and-timber buildings,
a barracks with training grounds, an archery range, and a cobblestone road
leading to a wooden bridge over a wide winding river. A small caravan of
donkeys carries crates along the road.

Far background, centered but distant and hazy: the silhouette of a great
fortified city against tall angular low-poly mountains, softened by warm
atmospheric haze.

Center of the frame at mid-height must stay visually calm and uncluttered:
open river water, soft haze, and empty warm sky, so that a user interface panel
placed there remains readable. Keep the middle band low in contrast and free of
sharp detail.

Lighting: warm low golden sunlight from the left, long soft shadows, gentle
volumetric haze in the valley, a clear sky with a few stylized flat clouds.
Palette: saturated grass greens, warm ochre wheat, terracotta roofs, cool
blue-grey river and distant mountains.

Style: stylized low-poly 3D render, flat shading, faceted geometry, clean
readable silhouettes, no visible texture detail, soft ambient occlusion,
game key art quality. Leave generous empty headroom at the top and empty
ground at the bottom so the image can be cropped to a 16:9 banner.
```

**Negatif / kacinilacaklar** (arac ayri bir alan sunuyorsa oraya, sunmuyorsa
prompt'un sonuna ekle):

```
no text, no lettering, no logos, no watermark, no user interface, no HUD,
no icons, no photorealism, no oil painting texture, no heavy brush strokes,
no characters in close-up, no modern objects, no lens flare, no vignette,
no dark night scene, no busy detail in the center of the frame
```

**Kabul kontrolu:** gorseli ekrana koy, ortasina zihnen bir kart yerlestir.
Kartin altinda kalan sey "bosa giden" bir sey olmamali. Oluyorsa ilgi noktalari
fazla merkezde demektir; yeniden uret.

## 4. Prompt - Yukleme perdesi fonu

**Konu:** menuden farkli olmali (kullanicinin sarti). Menu genis ve durgun bir
vista; bu daha alcak, daha yakin ve **hareket halinde** - "yoldayiz" hissi,
yuklemenin kendisiyle ortusuyor.

```
A stylized low-poly 3D rendered scene at early dawn: a caravan of laden donkeys
and a hooded worker crossing a wooden plank bridge over a wide slow river,
heading toward a medieval town whose rooftops and watchtower rise through
morning mist in the middle distance.

Camera is low and close, roughly at eye level of the caravan, looking slightly
upward along the road, so the bridge and the road fill the lower half and the
misty town and angular low-poly mountains fill the upper half. Birch and maple
trees with faceted foliage line the near riverbank; tall wispy grass and small
flowering bushes catch the light at the water's edge. A stag stands watching
from the far bank, small in frame.

The bottom fifth of the image must be visually quiet and darker: the shadowed
planks of the bridge and the dim road surface, low contrast, no important
detail, so that a progress bar and small text placed there stay legible.

Lighting: cool blue pre-dawn ambience with a narrow band of warm orange light
breaking on the horizon behind the town, gentle mist over the water, soft god
rays through the trees. Palette: cool blue-greys and deep greens in the
foreground, warm amber accents on the horizon and on the caravan lanterns.

Style: stylized low-poly 3D render, flat shading, faceted geometry, clean
readable silhouettes, no visible texture detail, soft ambient occlusion,
atmospheric depth, game loading-screen key art quality. Leave empty headroom
at the top and extra road at the bottom so the image can be cropped to a
16:9 banner.
```

**Negatif / kacinilacaklar:**

```
no text, no lettering, no logos, no watermark, no user interface, no HUD,
no progress bar, no icons, no photorealism, no oil painting texture,
no heavy brush strokes, no modern objects, no lens flare, no bright midday
sun, no busy detail in the bottom fifth of the frame
```

**Kabul kontrolu:** alt beste birine beyaz bir metin satiri ve ince bir cubuk
koyup oku. Okunmuyorsa o bant fazla parlak veya fazla detayli demektir.

## 5. Iki gorselin birbirine gore durumu

Ikisi ayni oyunun olmali ama ayni kare olmamali. Kasitli farklar:

| | Menu | Yukleme |
| --- | --- | --- |
| Kamera | Yuksek, genis vista | Alcak, yakin, yol hizasinda |
| Zaman | Altin saat (aksam sicakligi) | Safak oncesi (soguk mavi + turuncu serit) |
| Duygu | Durgun, "bir krallik baslamak uzere" | Hareketli, "yoldayiz" |
| Sakin alan | Orta | Alt %20 |

Ikisi ayni palet ailesinden gelsin (ayni yesiller, ayni terracotta), ki
perdeden menuye gecis kopuk hissettirmesin.

## 6. Iterasyon notu

Ilk cikti nadiren guvenli alani dogru birakir; en sik hata **merkeze detay
doldurmak**. Duzeltmek icin ureteci bastan calistirmak yerine su tek cumleyi
ekleyerek varyasyon iste:

- Menu icin: `Move all buildings and detail further toward the left and right
  edges; the central third must be only open water, haze and sky.`
- Yukleme icin: `Darken and simplify the bottom fifth of the image; remove all
  detail from the lower edge.`
