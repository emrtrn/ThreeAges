# engine-tests.ts Bolme Plani

Olusturulma tarihi: 2026-08-06
Durum: **Faz 0 kapandi (filtre + zamanlama, 2026-08-06). Faz 1 bir KARAR
bekliyor. Faz 2-5 planli, baslanmadi.**

Bu plan bir tek dosyanin (`tools/engine-tests.ts`, 50.236 satir) bolunmesini
tarif eder. Fakat planin en onemli ciktisi bolme degil, **olcumdur**: bolmenin
hiz problemini cozmeyecegi, hiz probleminin dokuz check'te oturdugu ve dort
saniyelik bir varsayilan suitin mumkun oldugu, Faz 0 sirasinda olculerek
bulundu. Plan bu bulguya gore yeniden siralandi.

## 1. Neden bu dosya gundeme geldi

Kullanicinin sikayeti: oturumlar cok uzun suruyor, ayni is baska bir ajanla cok
daha kisa surede bitiyor; kod degisikligi tarayicida zaten gorunurken isin
"bitmesi" cok bekletiyor. Olculdugunde beklemenin kaynagi netti:

| Komut | Sure |
|---|---|
| `npx tsc --noEmit` | 9 sn |
| `npm run test:engine` (filtresiz) | **161 sn** |
| `npm run build:verify` | ~4 dk |

Bir oturumda dogrulama kapisi 3-5 kez calisiyorsa, tek basina 10-20 dakika
bloke bekleme demektir.

## 2. Olculen durum

`tools/engine-tests.ts`, 2026-08-06:

- **50.236 satir**, tek dosya, tek modul kapsami.
- **1326 check** (1305'i top-level `check(...)` / `checkAsync(...)`).
- **471 import satiri**, **111 top-level helper** (fixture + yardimci).
- Bundling (esbuild): **0,3 sn**. Check calismasi: **161 sn**.

### 2.1 Kritik bulgu: sure dokuz check'te

`ENGINE_TESTS_TIMING=1` ile check basina olculdu. En yavas dokuz check:

| ms | Check |
|---|---|
| 27069 | Faz 8 §53: the AI researches Barracks II and fields a mixed army |
| 26760 | Faz 8 §49: the AI builds a four-resource economy and reaches the Kasaba age |
| 25569 | Faz 8 §55: the army leaves the economy population headroom |
| 17668 | Faz 8 §49: a finished region rebuilds its own outpost and depot, and repairs its road |
| 14066 | V2 Faz 7: the AI opens a pasture on the contested cattle and lives off the pen |
| 13560 | AI controller runs a headless accelerated match, decides on cadence, and commands its army |
| 12558 | AI expansion runs the §47 recipe end to end and finally earns income |
| 11852 | Kasaba guvenilirlik: standart gameplay_proof acilisi saldirisiz macta Kasaba'ya ulasir |
| 8223 | Faz 8 §27: an AI whose workers are wiped out rebuilds its economy |

Toplam: **157,3 sn / 161,4 sn = %97,5**.

Onuncu en yavas check **353 ms**. Yani bir ucurum var: dokuz check suitin
tamamini yiyor, **kalan 1317 check topluca ~4 saniye** suruyor.

Dokuzunun ortak ozelligi ayni: hepsi **headless hizlandirilmis tam mac
simulasyonu** kosuyor. Bunlar birim testi degil, entegrasyon testidir; degerleri
yuksektir (AI'nin gercekten Kasaba'ya ulastigini kanitlarlar) ama maliyetleri de
oyle.

### 2.2 Bu olcumun plana etkisi

Plan basta "dosyayi bol, suit hizlansin" diye kuruluyordu. Olcum bunu curuttu:

- **Bundling 0,3 sn.** Dosyanin buyuklugu calisma suresine neredeyse hic
  katkida bulunmuyor. Bolmek tek basina bir saniye bile kazandirmaz.
- **Hiz problemi bir mimari problem degil, dokuz testin problemi.** Cozumu
  bolmek degil, **etiketlemek** (Faz 1).
- Bolmenin gercek getirisi bu yuzden hiz degil: **bakim, izolasyon, paralellik
  ve merge**. Plan bu dururust gerekce uzerine kuruldu (Faz 2-5).

Bolme yine de yapilmali - ama "suit yavas" diye degil, "50 bin satirlik tek
modul kapsami bakilamaz halde" diye.

## 3. Faz 0 - Filtre + zamanlama (KAPANDI, 2026-08-06)

Iterasyon maliyetini dusuren ucuz mudahale. Bolme gerektirmedi.

- `tools/run-engine-tests.mjs` artik `--filter` / `-f` / `--filter=` aliyor,
  virgulle ayrilmis, buyuk-kucuk harf duyarsiz alt dizeler, OR'lanir.
  Runner bunu `ENGINE_TESTS_FILTER` env degiskenine yazar.
- `check` / `checkAsync` etiketi filtreye uymayan check'i **calistirmadan**
  atlar.
- Filtreli kosum sonunda `PARTIAL: N passed, M skipped ... Not a green build`
  yazar. **Filtreli kosum asla yesil build sayilmaz.**
- **Hicbir check'e uymayan filtre exit 1** verir; yazim hatasi sessiz kalmaz.
- `ENGINE_TESTS_TIMING=1` her check'in suresini satira ekler (§2.1 tablosu
  bununla cikarildi).
- Runner artik bundle ve kosum surelerini ayri ayri basar.

Olculen etki: `npm run test:engine -- --filter market` **161 sn -> 1 sn**.

`build:verify` ve CI filtresiz kosmaya devam ediyor; degistirilmedi.
Doguralama seviyeleri (`hizli` / `tam`) `CLAUDE.md` ve `AGENTS.md`'ye yazildi.

## 4. Faz 1 - Yavas check'leri etiketle (EN YUKSEK GETIRI, KARAR BEKLIYOR)

§2.1'e gore varsayilan suit **161 sn yerine ~4 sn** olabilir.

Onerilen: harness'a ucuncu bir giris eklemek.

```ts
// Headless tam mac simulasyonu kosan entegrasyon check'i.
// Varsayilan kosumda atlanir; --slow, ENGINE_TESTS_SLOW=1 ve CI kosar.
checkSlow("Faz 8 §53: the AI researches Barracks II and fields a mixed army", () => { ... });
```

- `npm run test:engine` -> hizli 1317 check, **~4 sn**, cikti `FAST` etiketli.
- `npm run test:engine -- --slow` -> hepsi, ~161 sn.
- `npm run build:verify` -> **degismez, hepsini kosar**.
- CI -> **degismez, hepsini kosar**.

Bir check'i `checkSlow` yapmanin tek olcutu **sure**dir (esik: >1 sn, §2.1'deki
ucurumun cok altinda), onemi degil. Yani bu bir "onemsiz testler" kovasi degil,
bir "pahali testler" kovasidir; isim de bunu soylemeli.

**KARAR (kullaniciya):** varsayilan `test:engine` bu dokuz entegrasyon
check'ini atlasin mi?

- **Lehte:** gunluk kapi 161 sn -> 4 sn; commit oncesi `tam` seviye ve CI zaten
  hepsini kosuyor, yani hicbir regresyon `main`'e kacamaz.
- **Aleyhte:** AI davranis regresyonlari lokal olarak **gec** yakalanir. AI
  koduna dokunan bir oturumda `--slow` (veya `--filter "Faz 8"`) unutulursa,
  hata CI'da gorunur.
- **Riski kucultmek:** AI/ekonomi kodu degistiyse `hizli` seviye bile
  `--filter "AI"` kosmali. Bu, `CLAUDE.md`'deki tier kuralina bir cumle olarak
  eklenir.

Bu karar verilmeden Faz 2'ye gecilmemeli: `checkSlow` harness'a girecek ucuncu
kavramdir ve Faz 3'teki harness cikarmasini dogrudan sekillendirir.

## 5. Faz 2 - Paylasilan fixture'lari cikar

Herhangi bir bolmenin **on kosulu**. Bugun 111 top-level helper ve fixture tek
modul kapsaminda duruyor; dosyalar ayrilinca bunlarin ithal edilebilir olmasi
gerekir.

Hedef: `tools/engine-tests/fixtures/`

- `balance.ts` - `RTS_TEST_UNIT_STATS`, `RTS_TEST_ARCHER_STATS`,
  `RTS_TEST_SIEGE_STATS`, `RTS_TEST_WORKER_STATS`, `RTS_TEST_UNIT_BALANCE`.
  (`CLAUDE.md`'nin "balans verisi ayarlanabilir" kurali geregi bunlar bilerek
  `balance/units.json` degildir; cikarilirken bu yorum korunmali.)
- `binary.ts` - `pngHeader`, `jpegHeader`, `webpVp8xHeader`.
- `fs.ts` - `listPublicFiles`, `findManifestStaticMeshFixture`.
- `scene.ts` - sahne/entity kurucu yardimcilar.

Kural: fixture dosyalari **check icermez**, sadece disari veri/yardimci verir.
Bu faz tek basina commit edilebilir ve check sayisi degismez.

## 6. Faz 3 - Harness'i cikar

`tools/engine-tests/harness.ts`:

- `check`, `checkAsync`, (Faz 1 gecerse) `checkSlow`
- filtre + timing + `FAST`/`PARTIAL` mantigi
- sayaclar

Buradaki tek gercek tasarim problemi: bugun `checks` ve `skipped` **modul-global
`let`**. Dosyalar ayrilinca sayac tek bir yerde yasamali. Cozum: harness modulu
singleton sayaci tutar, her test dosyasi harness'i **import eder**, ve ozet
basimi test dosyalarindan degil **runner'dan** cagrilir:

```ts
// tools/engine-tests/index.ts
import "./scene.test";
import "./editor.test";
// ...
import { reportSummary } from "./harness";
reportSummary();
```

`run-engine-tests.mjs`'in entry point'i `tools/engine-tests.ts` yerine
`tools/engine-tests/index.ts` olur. Bu faz da check sayisini degistirmez.

## 7. Faz 4 - Alan bazli dosyalara bol

Check'lerin satir dagilimi (5000 satirlik kovalar) kabaca duz: 132 / 161 / 141 /
166 / 195 / 149 / 93 / 98 / 92 / 77. Yani dogal bir tek kesme noktasi yok;
bolme **alan** (domain) esasli olmali, satir esasli degil.

Dosyadaki mevcut banner'lar baslangic haritasidir (`// === Section N ===` ve
`// --- baslik ---`). Onerilen hedef dosyalar:

| Dosya | Icerik |
|---|---|
| `scene.test.ts` | sahne runtime, legacy room layout adapter, serialization |
| `editor.test.ts` | gizmo drag matematigi, wall-snap, outliner, data table, EditorSceneController |
| `save-validator.test.ts` | Section 10 + skeleton/effect sidecar allowlist'leri |
| `audio-dialogue.test.ts` | sound cue, dialogue/voice, conversation, audio bus |
| `spline-landscape.test.ts` | generic spline (Faz 1-4), painted roads, river water, sculpt |
| `ui-framework.test.ts` | UI widget/UMG lite, erisilebilirlik, game framework, gamepad/touch |
| `assets.test.ts` | manifest sagligi, skeletal animasyon, collision/skeleton loader |
| `rts-economy.test.ts` | market, stok, arz hatlari (Faz M/S serisi), uretim |
| `rts-wildlife.test.ts` | pasture/taming (V2 Faz 3-6), avlanma, retaliation |
| `rts-world.test.ts` | nav grid, blockout/level adapter, fog of war, spatial layout |
| `rts-ai.test.ts` | Faz 5/8 AI - **§2.1'deki dokuz yavas check'in tamami burada** |

Yurutme kurali: **her seferinde tek alan tasi, her tasima kendi commit'i, her
commit'ten sonra filtresiz suit yesil ve check sayisi tam 1326.** Sayac
degistiyse bir check tasima sirasinda dusmustur; bu, bu fazin tek ciddi riski ve
tek kabul olcutudur.

`rts-ai.test.ts` en son tasinmalidir: hem en pahalisi hem de Faz 1 karari onu
dogrudan etkiler.

## 8. Faz 5 - Paralel kosum

Ancak Faz 4'ten sonra anlamli. Runner her test dosyasini ayri bir worker
process'te kosar (`N = os.cpus().length`), ozet toplanir.

Beklenen etki: duvar saati **toplam** degil **en yavas dosya** olur. Faz 1
gecerse `rts-ai.test.ts` ~157 sn'lik tek kule olarak kalir; o dosya da kendi
icinde bolunerek (AI ekonomi / AI ordu / AI bolge) daha da paralellesebilir.

Faz 1 yapilmadan Faz 5'in getirisi sinirlidir (157 sn'lik tek dosya suiti yine
157 sn'de tutar). Bu yuzden siralama **Faz 1 > Faz 5**'tir.

## 9. Kabul olcutleri (her faz icin)

- Filtresiz `npm run test:engine` yesil ve **check sayisi tam 1326** (Faz 1
  sonrasi: `--slow` ile 1326).
- `npx tsc --noEmit` temiz.
- `npm run build:verify` yesil.
- CI degismeden yesil; CI **hicbir zaman** filtreli ya da hizli-mod kosmaz.
- Her faz tek basina commit edilebilir; yarim birakilan bir faz suiti kirmizi
  birakmaz.

## 10. Kapsam disi

- **Test framework getirmek yok.** Proje bilincli olarak cerceve kullanmiyor
  (`node:assert` + duz node, `verify-dist.mjs` ile ayni stil). Vitest/Jest bu
  plani kolaylastirirdi ama konvansiyonu ve bagimlilik yuzeyini degistirir; ayri
  bir karar olarak ele alinmali, bu planin icine kacak yoluyla girmemeli.
- **Check silmek veya zayiflatmak yok.** Bu plan hicbir testin kapsamini
  daraltmaz; sadece ne zaman kosuldugunu ve nerede durdugunu degistirir.
- **Balans degerlerini teste sabitlemek yok** - `CLAUDE.md`'deki "balans verisi
  ayarlanabilirdir" kurali tasima sirasinda da gecerlidir.
