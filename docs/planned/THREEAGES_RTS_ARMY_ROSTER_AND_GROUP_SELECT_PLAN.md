# ThreeAges RTS Ordu Listesi ve Toplu Seçim Planı

> **Durum:** Faz 1–2 tamam; Faz 3–5 planlandı
> **Tarih:** 2026-07-30
> **Amaç:** Oyuncunun "neyim var?" sorusunu haritadan ayrılmadan yanıtlaması ve
> aynı yerden "hepsini seç" diyebilmesi. Asker çeşitliliği arttıkça UI'ın
> yeniden yazılmadan büyümesi.
> **Kapsam:** HUD ordu şeridi, nüfus kırılım paneli, kontrol grupları, ve bunları
> besleyen saf (DOM'suz) roster modeli.

---

## 1. Sorun

Üst HUD `Nüfus: 18/25` diyor, ama oyuncu şunları göremiyor:

- Kaç işçi, kaç muhafız, kaç okçu, kaç topçu var.
- Nüfusun neden dolduğunu (Topçu `populationCost: 3`, üç Muhafız kadar yer tutar).
- Ordusunun bir kısmının boşta beklediğini.

Toplu seçim için elde iki şey var ve ikisi de eksik:

| Bugün                              | Sorunu                                                     |
| ---------------------------------- | ---------------------------------------------------------- |
| `I` — boştaki işçileri seç         | Yalnız işçiye özel; askere karşılığı yok.                   |
| Birime çift tıkla → aynı roldekiler | Keşfedilebilir değil; ekranda bir birim bulmayı gerektirir. |

**Ve asıl mesele:** çift tıklama `unit.role` üzerinden gruplar. `UnitRoleId`
dört değerden ibaret ve sabit; oysa çeşitlilik **rolün içinde** artacak
(`balance/units.json` anahtarları). Bugün yazılacak her UI role göre gruplarsa,
eklenen ikinci muhafız tipi görünmez olur.

---

## 2. Kesinleşen kararlar

1. **Gruplama anahtarı `units.json` anahtarıdır (tip kimliği), rol değil.**
   Rol yalnızca *sıralama* ve *daralma* (bkz. Faz 5) için ikincil eksendir.
   Bu, planın tamamının dayandığı karardır.

2. **İki katman: her zaman görünen şerit + istenince açılan panel.**
   Şerit "kaç tane" sorusunu bir bakışta yanıtlar ve tek tıkla seçtirir.
   Panel "neden" sorusunu (nüfus payı, boşta olan, üretimdeki) yanıtlar.
   Sürekli görünen yüzey büyümez; büyüyen yüzey isteğe bağlıdır.

3. **Karar UI'da değil, saf bir view fonksiyonunda verilir.**
   Repo'da bu ayrım zaten var: `rtsSelectionView.ts` (karar, test edilebilir) /
   `rtsSelectionPanel.ts` (DOM, "hangi düğüme ne zaman dokunayım"). Roster de
   aynı ikiliyi kurar: `rtsArmyRosterView.ts` / `rtsArmyRoster.ts`.

4. **HUD tek satır kalır.** `--rts-hud-bar-height: 72px` ve `.rts-hud-bar`'ın
   `flex-wrap: nowrap` kuralı korunur; şerit sınırlı sayıda çip gösterir,
   gerisi panele taşar.

5. **Yeni birim eklemek kod değişikliği gerektirmez.** Tek istisna: yeni bir
   *rol* eklendiğinde sıralama tablosuna satır eklenir ve bu **derleme hatası**
   olarak yakalanır (`Record<UnitRoleId, number>`).

6. **Sayılar tuning'dir, sözleşme değil.** Testler "Topçu 3 nüfus tutar" demez;
   "roster'ın nüfus payı, `units.json`'daki `populationCost` ile hesaplananla
   aynıdır" der (CLAUDE.md, *Balance data is tunable*).

---

## 3. Faz 1 — Roster modeli (UI yok) — **TAMAMLANDI**

**Öncelik:** Yüksek. Diğer her şey buna bağlı.

### 1.1 Tip kimliği verinin kendisinde taşınır

**Uygulamada plandan sapıldı, sebebiyle birlikte:** ilk taslak kimliği
`spawn(owner, x, z, typeId, stats)` diye parametre olarak geçirmeyi öneriyordu.
Kod okununca `units.spawn(...)` çağrılarının ~180'inin `tools/engine-tests.ts`
içinde olduğu görüldü; zorunlu bir konumsal parametre, sözleşmeye hiçbir şey
katmadan 180 satırlık mekanik düzenleme demekti.

Yerine kimlik, zaten sahibi olan yere kondu: `units.json` **anahtarı**.

- `UnitBalanceStats.id` (`gameDataTypes.ts`) — tanımın kendi kimliği.
- `validateUnitBalance` (`validateGameData.ts`) bunu **anahtardan damgalar**;
  dosya gövdesinde yazılmaz. Gövdede anahtarla *çelişen* bir `id` varsa yükleme
  hata verir (yarım kalmış bir yeniden adlandırma, ikinci bir isim değildir).
- `Unit.typeId`, `stats.id`'nin aynası — `role`, `speed`, `armorClass` zaten
  aynı şekilde aynalanıyor. Tek satır, sıfır çağrı yeri değişikliği.

Sonuç: üretim kodunda hiçbir `spawn` çağrısı değişmedi, test fixture'larında 5
satır değişti, ve kimlik artık `stats`'ı elinde tutan **herkes** için var.

**Açık kalan yan kazanç:** `RtsApp.ts:1114`'teki `unitIdForRole` ters araması ve
`RtsApp.ts:2422`'deki `unitBalance[event.unitId]?.role` dolaylılığı artık
sadeleştirilebilir; Faz 1 kapsamında zorunlu olmadığı için dokunulmadı.

### 1.2 Saf roster view'ı

`src/game/rts/ui/rtsArmyRosterView.ts` — DOM'suz, three.js'siz.

```ts
export function describeArmyRoster(
  units: readonly RosterUnit[],          // { typeId, stats } — yapısal, Unit sınıfı değil
  options?: {
    isIdle?: (unit: RosterUnit) => boolean;
    isSelected?: (unit: RosterUnit) => boolean;
  },
): ArmyRosterView;

export function armyRosterSignature(view: ArmyRosterView): string;
```

Satır alanları: `typeId`, `label`, `icon`, `role`, `count`, `idle`, `selected`,
`population`. Görünüm toplamları: `totalCount`, `totalIdle`, `totalPopulation`.

Planlanandan iki fark, ikisi de sadeleştirme yönünde:

- **`balance` parametresi yok.** Her birim kendi `stats`'ını zaten taşıyor, yani
  satır bir tabloya bakmadan kurulabiliyor. Bu, "kimliği tabloda bulunamayan
  birim" hata sınıfını tamamen ortadan kaldırdı.
- **`selected` de geri çağrı.** `ReadonlySet` yerine yüklem; `isIdle` ile
  simetrik ve çağıranın seçimi nasıl tuttuğuna karışmıyor.

`isIdle` neden geri çağrı: "boşta" tanımı işçide `workerConstruction` +
`economyProduction` durumudur (`RtsApp.isIdleWorker`), askerde "emri yok ve
çarpışmıyor". Roster modülü bu sistemlerin hiçbirini tanımamalı. Verilmezse
cevap "hiçbiri boşta değil" — iş sistemi olmayan başsız bir çağıranın alması
gereken dürüst cevap.

`armyRosterSignature` planda yoktu; Faz 2'nin "DOM'a yalnız değişince dokun"
kuralını modele taşıdığı için eklendi.

### 1.3 Sıralama kuralı

Kararlı ve veriden türetilir; `units.json`'daki yazım sırasına güvenilmez:

1. Rol sırası: `worker → guard → archer → siege → …`
   (`const ROLE_ORDER: Record<UnitRoleId, number>` — yeni rol eklenince derleme kırılır.)
2. `requiredAge` (settlement → town).
3. `label`, `localeCompare("tr")`.

Faz 5'te opsiyonel `uiOrder` veri alanı bu türetmeyi ezebilir.

### 1.4 Testler (`tools/engine-tests.ts`)

`check("the army roster counts unit types, not roles, and orders them from data")`:

- Aynı rolde iki farklı tip **ayrı** satır olur (planın var oluş sebebi).
- `units.json`'daki **her** tanım için tam bir roster satırı üretilir
  (yeni birim eklendiğinde UI'dan düşmez).
- Sıralama, girdi sırası ters çevrildiğinde değişmez; beklenen sıra
  `worker → guard → archer → siege`.
- Nüfus payı `populationCost`'tan hesaplanır — büyüklük sabitlenmez.
- `isIdle`/`isSelected` satır başına sayılır; yüklem verilmezse sonuç sıfır.
- Boş ordu boş liste verir (HUD'da `0` gösterilmemesinin dayanağı).
- İmza sıralı roster'ı izler, girdi sırasını değil; sayı değişince değişir.

Mevcut `check("unit balance validates combat stats for stable unit ids")` içine
eklendi:

- Her tanım kendi anahtarını `id` olarak geri verir.
- Anahtarla çelişen gövde `id`'si `GameDataError` ile reddedilir.
- Yazılmamış `id` anahtardan damgalanır.

**Doğrulama:** `npx tsc --noEmit` temiz, `npm run test:engine` 1175 kontrol
yeşil, `npm run build:verify` (tsc + vite build + test:engine +
`verify:dist --strict`) geçiyor.

---

## 4. Faz 2 — HUD ordu şeridi — **TAMAMLANDI**

**Öncelik:** Yüksek. Oyuncunun asıl istediği bu.

**Dosyalar:** `ui/rtsArmyRosterStrip.ts` (yeni), `ui/rtsHudBar.ts`
(`mountStatusControl`), `selection/selectionSystem.ts` (`addUnits`),
`RtsApp.ts` (`syncArmyRoster`, `selectUnitsOfType`), `style.css`.

### Yerleşim

`.rts-hud-status` içindeki `matchReadouts`/`workerCluster` ikilisinin yanına
üçüncü küme: `.rts-hud-roster`. Nüfus okumasının **yanında** durur, çünkü
zaten nüfusun kırılımıdır.

```
[arma] [yiyecek][odun][taş][altın]  … uyarı …  [Çağ][Süre][Nüfus 18/25]  [👷12][🛡5][🏹3][➕2]  [Ⅱ]
```

Ekran kenarları doluysa dahi buraya sığar: sağdaki `utilityControls` yalnız bir
düğme, `workerCluster` ise Faz 3'te roster'ın bir satırına dönüşüp yer açar.

### Çip anatomisi

Her çip bir `<button>`: ikon (`stats.icon`, `attachIconFallback` ile), sayı,
ve boşta olan varsa küçük rozet. Erişilebilir ad: `"12 İşçi — hepsini seç"`.

### Etkileşim

| Girdi                 | Davranış                                                    |
| --------------------- | ----------------------------------------------------------- |
| Tıklama               | Haritadaki **tüm** bu tip birimleri seç (`selection.selectUnits`). |
| `Shift` + tıklama     | Mevcut seçime ekle (`selection.addUnits`); kamera oynamaz.   |
| Aynı çipe tekrar tıkla | Kamerayı bu tipten bir sonraki birime taşı (döngüsel).       |
| Boş liste             | Çip hiç çizilmez (0 gösterilmez).                            |

Kamera turu neden ilk tıklamada değil: ilk basış "bunları seç", ikinci basış
"peki neredeler" — farklı iki niyet. Tur imleci (`rosterTourTypeId`) başka bir
çipe basılınca ve maç yeniden başlayınca sıfırlanır. `unitsOf` spawn sırasında
döndüğü için tur, basışlar arasında yeniden karılmayan kararlı bir sıra izler.

Çift tıklamayla rol seçimi ([selectionSystem.ts:137](../../src/game/rts/selection/selectionSystem.ts#L137))
**kalır**; çip onun keşfedilebilir karşılığıdır. İkisi de `selectUnits` üzerinden
gider, yani seçim kuralları tek yerde.

### Performans

`syncHudBar` her karede çağrılıyor. İki kademeli kapı uygulandı:

1. **İmza** (`armyRosterSignature`) her şeyi kapatır — bir satırın çizdiği
   herhangi bir sayı değişmediyse hiçbir DOM'a dokunulmaz.
2. **Düzen** (tip kimliği listesi) yalnız düğmelerin yeniden kurulmasını
   kapatır. Sayı birim üretildikçe/öldükçe sürekli oynar; tip kümesi bir maçta
   birkaç kez değişir, ve yeni DOM yalnız onun için gerekir.

Sayı/rozet metni mevcut hücre-diff kuralıyla güncellenir
(`if (cell.textContent !== text)`) — `RtsHudBar`'ın zaten uyduğu kural.

### Erişilebilirlik

`aria-live` **yok**. Sayı her üretimde değişiyor; canlı bölge ekran okuyucuyu
sürekli böler. `aria-label` + `title` güncellenir, bu kadar. (HUD'daki lojistik
uyarısının `polite` olması bilinçliydi; bu farklı bir okuma.)

Erişilebilir ad sayıyı **adlandırır**: `"12 İşçi, 3 boşta — hepsini seç"`.
Yalnız `12` bir isim değildir, ve dar ekranda ikon gizlendiği için ekranda
kalan tek şey odur.

### Dar ekran

- `≤1400px`: çip küçülür, ikon 16px.
- `≤1180px`: ikon gizlenir, sayı kalır — kaynak hücrelerinin aynı kararı
  (miktar kalır, etiket/gelir gider). Düğme düğme olarak kalır.

### Testler

`check("a roster chip's bulk select replaces, and its Shift half adds")`:
sade tıklama değiştirir, Shift ekler, düşman/ölü birim toplu eklemeye giremez,
boş ekleme seçimi silmez (son birimi ölen bir çipin tıklaması), yapı seçimi
orduya geçince düşer, ve roster'ın `selected` sütunu seçim sistemiyle uyuşur.

Şeridin kendisi DOM olduğu için engine testlerinin kapsamı dışında; test edilen
şey onu besleyen model ve arkasındaki seçim fiili.

---

## 4b. Seçim panelini aynı dile getirme — **TAMAMLANDI**

Faz 2 bittiğinde HUD tipe göre sayıyordu ama seçim paneli hâlâ **role** göre
grupluyordu (`describeUnits`, `new Map<UnitRoleId, number>()`). İkinci bir
muhafız tipi eklendiği gün panel ikisini tek satırda birleştirip birinin
ikonunu ikisi için gösterecekti — HUD doğru sayarken panelin yanlış sayması.

- `describeUnits` artık `describeArmyRoster`'ı kullanıyor. Paylaşılan model,
  paylaşılan sıra: kompozisyon şeridi ile HUD şeridi aynı düzende okunuyor,
  oyuncu tek bir "bu grup nedir" okuması öğreniyor.
- Başlık, en kalabalık **savaş tipini** adlandırıyor (eskiden rol). Eşitlik
  roster sırasına düşüyor, marquee'nin ilk süpürdüğü birime değil — aynı grubu
  yeniden seçmek artık her seferinde aynı başlığı veriyor.
- `onSelectDoubleClick` de tipe geçti. Çift tıklama, o birimin HUD çipine
  tıklamanın dünyadaki ikizi; ikisinin farklı cevap vermesi birini tuzağa
  çevirirdi.
- `RosterUnit` sadeleşti: `{ stats }`. `typeId` alanı `stats.id` ile
  gereksizdi ve birbiriyle çelişebilecek ikinci bir alan demekti. Yan etkisi
  iyi — `SelectedUnitView` artık `RosterUnit`'i olduğu gibi karşılıyor.

**Portre sayacı artık portrenin kendi tipini sayıyor.** Oyun testinde çıkan
kusur: bir işçi + bir muhafız kutuyla seçilince panel bir Muhafız portresinin
üstüne kalın altın `×2` basıyordu. Rozet portreye tutturulmuş olduğu için göz
onu "iki muhafız" diye okuyor — altındaki kompozisyon şeridi ne derse desin.
`selectionCount` artık `dominant.count`. Kaybedilen bir şey yok: tek tipli
seçimde tip zaten seçimin tamamı (davranış aynı), karışık seçimde ise `slots`
her tipi kendi sayısıyla adlandırıyor. Bu, Faz 2'den önce de var olan bir
kusurdu; tip bazlı gruplama onu görünür hâle getirdi.

**Testler:** çift tıklama testine ikinci bir `role: "guard"` tipi eklendi ve
sadece kendi tipini seçtiği pinlendi; seçim paneli testine tip bazlı
kompozisyon şeridi, eşitlik-kararlılığı, ve rozetin üç hâli eklendi — tek tip
(toplam), iki muhafız tipi, ve raporlanan bir işçi + bir muhafız durumu.

**Yolda bulunan bir hata:** `tools/engine-tests.ts` içindeki
`new SelectionSystem(canvas, camera, units, marquee)` çağrısı altı parametreli
ctor'a dört argüman veriyordu; `structures` ve `centers` çalışma zamanında
`undefined` kalıyordu. Test yalnız şanstan geçiyordu (tıklamalar hep bir birime
isabet ettiği için `raycastStructure` hiç çağrılmıyordu). Düzeltildi — sebebi
için bkz. §10.

## 4c. Çoklu seçim paneli: ayrı bir yüz — **TAMAMLANDI**

Portre rozetini düzeltmek semptomu aldı, sebebi bırakmıştı: tek birim paneli
bir grubu anlatmak için kullanılıyordu. Bir grup, tek birimden **farklı bir
soru** sorar.

- Tek birim: "bu nedir ve ne yapıyor" → can, duruş, canlı emir, §33 eşleşmesi.
  Hepsi bu birim hakkında doğru.
- Çok birim: "az önce neyi kaptım" → o çerçevedeki her birim-başı gerçek, seçim
  karışır karışmaz yalana dönüyor: iki gövde için tek can barı, anlaşmayan
  birimler için tek duruş, en kalabalık tipe göre okunmuş tek eşleşme tablosu.

Bu yüzden panel **şekil değiştiriyor**. `units.length > 1` olduğunda
`describeUnits`, tip başına bir kart döndürüyor (`SelectionPanelContent.cards`)
ve tek-birim çerçevesi hiç doldurulmuyor. Kart: portre + sağ altta `×sayı` +
altında tip adı, soldan sağa, tek birimin aldığı portre boyutuyla.

`RtsSelectionPanel` bunu kökteki `data-rts-panel-mode="roster"` ile ayırıyor —
portre/başlık/gövde CSS'te toptan gizleniyor, her biri tek tek koda
bağlanmıyor. Kartlar sığmazsa satır kayıyor (`overflow-x`), küçülmüyor: sekiz
birim tipi sekiz okunmaz dilime dönüşmemeli.

**Kart portresi tek-birim portresiyle birebir:** 88×103px (panel gridinin 1. ve
2. satırı artı aradaki boşluk: 48 + 6 + 49) ve aynı kırpma. Görsel kuralı tek
bir seçiciye bağlı (`.rts-selection-portrait-image, .rts-selection-card-image`):
ikisi aynı görseli aynı kutuda gösterdiği için aynı kırpmalıdır, ve tekinin
çerçeveyi doldurup diğerinin boşluk bırakması kartı "aynı birim, sayılmış"
yerine "daha küçük, başka bir şey" gibi okutur. Çerçeveleme değişirse ikisi
birden değişsin diye ortak seçici.

> İlk denemede kart `contain` ile yerleştirilmişti (hiç kırpma yok). Gerekçe
> kart-içi okunabilirlikti ama yanlıştı: iki yüzey arasındaki **tutarlılık**
> daha ağır basıyor, ve kırpılmamış görsel kutu içinde küçük duruyordu.

`×sayı` rozeti kendi koyu zeminini taşıyor. Metin gölgesi bu illüstrasyonların
parlak bölgelerinde (işçinin çuvalı, kalkanın göbeği) kayboluyordu; bazı
birimlerde görünüp bazılarında kaybolan bir sayaç, hiç sayaç olmamasından kötü.

**Kalan tek şey Kurtar düğmesi:** bir *fiil*, gerçek değil — ayak altında
sıkışmış gövde kalabalıkta da kazılmayı bekliyor ve bunu sunan başka yüzey yok.
Klavye ipucu satırı (`F: Saldırı-Hareket · …`) grup panelinden kaldırıldı;
kartlar panelin tamamı, altına bir metin şeridi eklemek bu şeklin yerine
geçtiği duvarı geri getirirdi. Fiiller tek birim seçiminde öğretilmeye devam
ediyor.

**Bilinçli kayıp:** işçi grubu seçildiğinde iş kırılımı
(`Görev: 1 boşta · 2 inşaatta · 1 üretimde`) artık gösterilmiyor — kart
yüzünde yeri yok. Portre-yalnız grup panelinin bedeli bu; geri istenirse
dönülecek yer `describeUnits`'in `units.length > 1` dalı. Testte de böyle
işaretlendi.

## 5. Faz 3 — Nüfus kırılım paneli

**Öncelik:** Orta.

`Nüfus 18/25` okumasına tıklanır → altında bir popover açılır. Şerit "kaç
tane"yi, panel "neden"i anlatır:

```
NÜFUS 18/25
İşçi            12    (12 nüfus)   3 boşta   [Seç]
Muhafız          5    ( 5 nüfus)             [Seç]
Topçu            1    ( 3 nüfus)             [Seç]
Üretimde        +2    ( 2 rezerve)
```

- `PopulationSystem.snapshot()` zaten `reserved`'ı ayrı tutuyor; "Üretimde"
  satırı ona karşılık gelir ve nüfusun neden dolu göründüğünü açıklar.
- Boştaki işçiler burada **özel bir durum olmaktan çıkar**: `Seç (I)` / `Ata (R)`
  düğmeleri işçi satırının eylemleri hâline gelir, HUD'da ayrı küme olmaktan çıkar
  ve üst şeritte yer açar. `I`/`R` kısayolları aynen korunur.
- Panel `ui-interactive`'dir; şerit değildir (seçim panelinin harita tıklamasını
  yutma dersi: `rtsSelectionPanel.ts` ctor yorumu).
- Açıkken `aria-expanded`, `Esc` ile kapanır — ama `Esc` önce yerleştirme/duraklat
  zincirine takılmamalı; `RtsApp`'in mevcut Escape önceliği gözetilir.

---

## 6. Faz 4 — Kontrol grupları

**Öncelik:** Orta. Çipler "tip" sorusunu çözer; kontrol grupları "benim şu
saldırı müfrezem" sorusunu çözer ve tip sayısından bağımsızdır.

- `Ctrl + 1..9` — canlı seçimi gruba ata.
- `1..9` — grubu çağır.
- Aynı rakama çift basış — kamerayı gruba götür.
- Grup, ölen birimi kendi kendine düşürür (`selectionSystem.remove` ile aynı
  uzlaştırma kuralı).

**Çakışma — kullanıcının kararı gerekiyor:** `Digit1..4` bugün inşa kategorisi
sekmeleri (`rtsInput.ts` `COMMAND_KEYS`). Üç seçenek:

1. **(Önerilen)** Rakamlar kontrol gruplarına gider; inşa kategorileri `Shift+1..4`
   olur. Paletin görünür sekme satırı ve `B` kısayolu zaten var, kayıp küçük.
2. Kontrol grupları `Ctrl+rakam` ile hem atanır hem çağrılır — RTS alışkanlığına
   aykırı, öğrenilmesi zor.
3. Kontrol grupları `F1..F9`'a gider — çakışma yok ama kimse orada aramaz.

Ayrıca bu faz, `COMMAND_KEYS`'in sabit tablodan yeniden atanabilir bir veri
yüzeyine dönmesi için doğru an (`defaultInputBindings.ts` deseni mevcut).

---

## 7. Faz 5 — Büyüme kancaları

Bunlar şimdi **yazılmaz**, ama Faz 1–2 bunları mümkün kılacak şekilde yazılır.

1. **Tip sayısı taşarsa role daralma.** Şerit `K` (öneri: 6) çipten fazlasını
   göstermek zorunda kalırsa, çipler rol çiplerine daralır (`🛡 9` = tüm muhafız
   tipleri) ve tıklama tüm rolü seçer. Tam liste her zaman Faz 3 panelindedir.
   Bu, "tek satır HUD" kuralını birim çeşitliliğinden bağımsız kılar.
2. **`uiOrder` veri alanı.** `units.json`'a opsiyonel sayı; türetilmiş sıralamayı
   ezer. `validateGameData.ts`'e "pozitif tamsayı" kuralı eklenir.
3. **Üretimdeki sayılar çipte.** `12 (+2)` — kuyruk bilgisi
   `barracksProductionSystem` ve `workerProductionSystem`'de mevcut.
4. **Seçim alt grubu.** `entry.selected` çipte vurgu olarak çizilir; karışık bir
   seçimde çipe tıklamak seçimi o tipe daraltır (SC2 alt grup davranışı).
5. **Yapılar için aynı model.** `describeArmyRoster` imzası birim-özel; ileride
   "3 Kışla, 2 Depo" istenirse aynı desen ayrı bir view olarak kopyalanır —
   birim ve yapı tek bir genel "roster" soyutlamasına **zorlanmaz** (seçim
   sisteminin "ordu mu bina mı, ikisi birden değil" kararıyla tutarlı).

---

## 8. Yapılmayacaklar

- **Seçim paneline tip sayıları eklemek.** O panel "ne seçili" sorusunu
  yanıtlar; "neyim var" başka bir soru. İkisini karıştırmak `rtsSelectionView`'un
  Faz 9'da kaçındığı karmaşayı geri getirir.
- **HUD'ı iki satıra çıkarmak.** `--rts-hud-bar-height`'a göre hizalanan dört
  panel var (`debug overlay`, `notification feed`, `mission panel`,
  `objective tracker`); satır sayısı sözleşme.
- **Rol bazlı gruplamayı kalıcı kılmak.** Faz 5.1'deki daralma bir taşma
  çaresidir, varsayılan değil.
- **Şeridi harita üstünde büyütmek.** Plan §52: UI haritanın kritik alanını
  kapatmaz.

---

## 9. Uygulama sırası ve doğrulama

- [x] **Faz 1** — `UnitBalanceStats.id` + `Unit.typeId`, `describeArmyRoster`,
      engine testleri. *(2026-07-30)*
- [x] **Faz 2** — HUD ordu şeridi + tıkla-seç. *(2026-07-31)*
- [ ] **Faz 3** — Nüfus kırılım paneli; işçi kümesi oraya taşınır.
- [ ] **Faz 4** — Kontrol grupları (önce kısayol çakışması kararı).
- [ ] **Faz 5** — Büyüme kancaları, ihtiyaç doğdukça.

Her fazdan sonra: `npx tsc --noEmit`, `npm run test:engine`,
ve görsel kabul için oyunu açıp kullanıcıya sormak
(CLAUDE.md: *Visual acceptance is the user's call*).

---

## 10. Bu planın dışında kalan bir bulgu: `tools/` tip denetiminde değil

`tsconfig.json`'daki `include` listesi `["src", "engine", "editor", "builder",
"game", "project", "vite.config.ts"]` — **`tools` yok**. `npm run test:engine`
ise esbuild ile paketliyor, ve esbuild tip denetimi yapmaz, sadece tipleri
söker. Sonuç: `tools/engine-tests.ts` (40 bin satır, projenin tek test yüzeyi)
hiçbir kapıda tip denetiminden geçmiyor.

§4b'deki dört argümanlı ctor çağrısı bunun ürünü. Aynı sınıftan başkaları da
olabilir: `include`'a `tools` eklenince **221 hata** çıkıyor. Çoğu mekanik —
aynı three.js sembolleri iki ayrı `import` bloğunda, kullanılmayan bir import —
ama içlerinde gerçek olanlar da var (`Property 'skeleton' does not exist on
type 'never'`).

Bu, roster planının parçası değil ve buraya sığmaz; ayrı bir temizlik işi
olarak ele alınmalı. Not burada duruyor çünkü bulunduğu yer burasıydı:
**bu depoda bir testin derlendiği tek an, çalıştığı andır.**
