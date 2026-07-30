# ThreeAges RTS Ordu Listesi ve Toplu Seçim Planı

> **Durum:** Faz 1 tamam; Faz 2–5 planlandı
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

## 4. Faz 2 — HUD ordu şeridi

**Öncelik:** Yüksek. Oyuncunun asıl istediği bu.

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
| `Shift` + tıklama     | Mevcut seçime ekle.                                          |
| Aynı çipe tekrar tıkla | Kamerayı bu tipten bir sonraki birime taşı (döngüsel).       |
| Boş liste             | Çip hiç çizilmez (0 gösterilmez).                            |

Çift tıklamayla rol seçimi ([selectionSystem.ts:137](../../src/game/rts/selection/selectionSystem.ts#L137))
**kalır**; çip onun keşfedilebilir karşılığıdır. İkisi de `selectUnits` üzerinden
gider, yani seçim kuralları tek yerde.

### Performans

`syncHudBar` her karede çağrılıyor. Kural:

- Çip DOM'u yalnız **tip kümesi** değişince yeniden kurulur.
- Sayı/rozet metni mevcut hücre-diff kuralıyla güncellenir
  (`if (cell.textContent !== text)`) — `RtsHudBar`'ın zaten uyduğu kural.
- Roster tek geçişte kurulur (`unitsOf(player)` üzerinde bir `for`).

### Erişilebilirlik

`aria-live` **yok**. Sayı her üretimde değişiyor; canlı bölge ekran okuyucuyu
sürekli böler. `aria-label` + `title` güncellenir, bu kadar. (HUD'daki lojistik
uyarısının `polite` olması bilinçliydi; bu farklı bir okuma.)

---

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
- [ ] **Faz 2** — HUD ordu şeridi + tıkla-seç.
- [ ] **Faz 3** — Nüfus kırılım paneli; işçi kümesi oraya taşınır.
- [ ] **Faz 4** — Kontrol grupları (önce kısayol çakışması kararı).
- [ ] **Faz 5** — Büyüme kancaları, ihtiyaç doğdukça.

Her fazdan sonra: `npx tsc --noEmit`, `npm run test:engine`,
ve görsel kabul için oyunu açıp kullanıcıya sormak
(CLAUDE.md: *Visual acceptance is the user's call*).
