# Paketleme ve Yayın (itch.io)

Oluşturulma tarihi: 2026-08-30
Durum: **Hat kuruldu ve ilk yayın yapıldı (2026-08-30, itch.io).** Otomasyon
sürüm etiketiyle çalışıyor. Kalan iş §8'de.

Bu bir plan değil, bir **bulgu ve hat dökümü**. Oyun ilk kez yayınlanırken ortaya
çıkan altı hatanın hepsi ortak bir özellik taşıyordu: **yerelde görünmüyorlardı.**
Hiçbiri hata vermiyor, hiçbiri build'i kırmıyordu; ikisi oyunu tamamen açılmaz
hâle getiriyor, biri oyunu baştan sona yanlış zeminde oynatıyordu. Bu doküman
onların ne olduğunu, nasıl bulunduğunu ve bir daha geçmemeleri için ne
kurulduğunu yazar.

Tekrarlayan ders: **yayınlanan build'i tahmin etme, servis et ve ölç.**

---

## 1. Yayınlanan build neden yerelden farklıdır

Üç yapısal fark var; altı hatanın hepsi bunlardan birinden çıktı.

| | Yerel geliştirme | Yayınlanan build |
| --- | --- | --- |
| Servis kökü | `http://127.0.0.1:5173/` — sitenin kökü | `.../html/<id>/` — **alt yol** |
| URL | Editör `?rts&flags=...` taşır | **Sorgu dizesi yok**, `index.html` çıplak açılır |
| Dosya kümesi | `public/` tamamı | `forge-prune-dist` 837 dosya / 54.3 MB / 728 manifest girdisi siler |

Buna bir dördüncü eklenir: itch **Linux**'ta servis eder, yani dosya adları
büyük/küçük harfe duyarlıdır. Windows'ta çalışan bir yol orada 404 verebilir.

---

## 2. Bulunan hatalar

### 2.1 Kök-mutlak yollar (oyun hiç açılmıyor)

`vite.config.ts`'te `base` ayarlı değildi, emitlenen `index.html` şunu yazıyordu:

```html
<script src="/assets/index-DUpJqpMv.js">
```

Alt yolda servis edilince bu, oyunun değil **host'un köküne** gider ve 404'ler.
Sonuç: beyaz sayfa, oyuncunun yapabileceği bir şey söylemeyen hiçbir hata yok.
Kodda ayrıca elle yazılmış ~30 mutlak yol vardı (ikonlar, menü arkaplanı, KTX2
transcoder, harita modelleri).

**Düzeltme:** `base: "./"` + tek çözücü `engine/assets/publicUrl.ts`. Yazarlanmış
yollar (`/assets/ui/icons/x.png`) kanonik kalır — `balance/*.json`'daki,
`UiAssetPath`'teki ve engine testlerindeki yazım odur — çözüm **kullanım
noktasında** yapılır. `projectFileUrl` (manifest, model, materyal, sidecar,
layout için tek huni) oradan geçer.

### 2.2 Varsayılan rota oyunu açmıyordu

`src/main.ts` rotayı `params.has("rts")` ile çözüyordu. itch sorgu dizesi
vermediği için oyuncu Forge şablonunun **karakter demosunu** görüyordu.

**Düzeltme:** `params.has("rts") || !import.meta.env.DEV`. Dev'de karakter rotası
varsayılan kalır — editör akışları ve `/?debug` smoke spec'leri ona yazılmış.

### 2.3 `levelAssets` bayrağı: oyun düz zeminde oynanıyordu

En sinsi olanı. Oyun açılıyor, maç başlıyor, HUD geliyor, birimler doğru
modellerle çiziliyor — ama arazi **düz yeşil bir düzlem ve grid**.

Zincir şuydu: `gameplay_proof` preset'i haritayı adlandırıyor, ama
`rtsLevelRef.ts` kapısı `levelAssetsEnabled` şart koşuyor, ve `levelAssets`
`featureFlags.ts`'te varsayılan **kapalı** (sadece `fogOfWar` açık). Editörün
Play düğmesi `previewUrl`'de `?flags=levelAssets` taşıdığı için **yazar her
zaman doğru hâli görüyor, oyuncu hiç görmüyordu.**

Sessiz kalmasının sebebi bir tasarım tercihi: düz zemin,
`rtsLoadingScreen`'in belgelediği "flat placeholder ground" fallback'i —
başarısız bir yükleme oynanabilir kalsın diye var. Tam bu yüzden **sessizce**
başarısız olur.

**Teşhis eden ölçüm:** ağ izinde `landscapes/` klasörü **hiç istenmiyordu.**
404 yoktu çünkü istek yoktu; istek yoktu çünkü kapı kapalıydı. *Bir klasörün
hiç istenmemesi, 404'ten daha güçlü bir ipucudur.*

**Düzeltme:** preset'e `"levelAssets": true`. Global varsayılan ve onu sabitleyen
engine testi ("remains opt-in during Faz D") olduğu gibi bırakıldı, böylece
`worker_perf_*` ve `archer_locomotion_*` ölçüm preset'leri düz blokout'ta ölçmeye
devam ediyor.

### 2.4 Budanan materyal

Arazinin `snow` katmanı (haritanın **%19'una hâkim**, 3180 hücrede ağırlık > 0.5)
`m-gravel-material`'a bağlıydı → `assets/starter-content/Materials/M_Gravel...`.
`starter-content` şablon içeriğidir ve `forge-prune-dist` onu her build'den siler.
Dev'de var, pakette yok.

**Düzeltme:** katman `threeages-mat-road-gravel`'e bağlandı (yerini aldığı
starter materyalin ThreeAges karşılığı, yani görünüşü en az değiştiren seçenek).

**Genel kural:** yazarlanmış bir sahne `starter-content`/`DevelopmentContent`
altındaki hiçbir varlığa bağlanmamalı. Budama listesi bir "temizlik" değil,
**yayın sözleşmesi**.

### 2.5 Zip'in kendisi

Bu makinede `zip` ve `7z` yok. PowerShell 5.1'in `Compress-Archive`'ı iç içe
girdi adlarına ters bölü yazabiliyor; itch Linux'ta açtığı için
`assets\ui\panel.webp` bir yol değil, **içinde ters bölü olan bir dosya adı**
olur ve her varlık 404'ler. Ayrıca itch zip'in **içeriğini** servis eder, yani
klasörü zip'lersen `dist/index.html` olur ve boş sayfa açılır.

**Düzeltme:** `tools/package-web.mjs` (§4).

### 2.6 `file://` ile test edilemez

Zip'i çıkarıp `index.html`'i tarayıcıda açmak çalışmaz ve çalışmayacak:
`file://` şemasında tarayıcı ES modül `import`'unu ve `fetch`'i cross-origin
sayıp engeller. Sayfa boyanır, bundle hiç yüklenmez.

**Düzeltme:** `npm run preview:package` (§4).

---

## 3. Ölçümler

Hepsi paketlenmiş build alt yoldan servis edilerek, tarayıcının gerçekten
indirdiği baytlar sayılarak alındı.

### 3.1 Oyuncunun beklediği yük

| | önce | sonra |
| --- | --- | --- |
| ana menü açılana kadar | 8.44 MB | **4.82 MB** |
| maç çalışana kadar toplam | 109.2 MB | **98.5 MB** |
| `dist/` | 183 MB | **165 MB** |
| zip | — | **155.3 MB** (864 dosya, 163.0 MB ham) |

Maç yükünün dağılımı: **83.8 MB `assets/ThreeAges`** (modeller), 5.9 MB ses,
3.2 MB UI. Yani `dist` boyutu yanıltıcıdır; beklemenin **%85'i modellerdir.**

### 3.2 UI sanatı: 20 MB → 2.4 MB (−%88)

İki ayrı işlem, çünkü iki grup farklı kırılır:

- **Skin → WebP q95, boyut sabit.** `border-image-slice` **kaynak piksel**
  sayar (`150 fill`, `180 fill`…), yeniden boyutlandırmak her çerçevenin
  köşesini kaydırırdı. Sorun boyut değil formattı: `button_primary_9s.png`
  2172×724 ve 2.44 MB idi.
- **İkonlar → 256 px, PNG kalır.** `UiAssetPath` bunları `.svg|.png` olarak
  tipler, `validateGameData` başkasını reddeder, engine testleri satırları
  sabitler. Ad ve uzantı sabit kalınca tip/validator/test zinciri kıpırdamaz.
  Beş bildirim ikonu **1254×1254** idi ve **30×30 px**'te çiziliyordu:
  603 KB → **12 KB**.

Araç: `tools/optimize-ui-art.mjs` (idempotent; manifest `path`/`thumbnail`/
`runtime.bytes` ve `style.css` `url()`'lerini yalnız dönüştürdüğü dosyalar için
günceller).

### 3.3 Müzik: yapılmayan iş

İlk tahminim "41 MB müzik → ~15 MB" idi. **İkisi de yanlıştı.** Ogg başlıkları
okununca: 20 parça, her biri tam 120 sn, stereo 48 kHz, ortalama **143 kbps** —
savurgan değil. 96 kbps'e inmek ~27 MB verirdi, %50 değil.

Daha önemlisi ağ izi gösterdi ki **müzik akışla geliyor**: maç boyunca inen
toplam ses 5.9 MB. Yani yeniden kodlamak oyuncunun beklediği süreye
neredeyse hiç dokunmazdı. Üstelik bu makinede `ffmpeg` yok.

**İş iptal edildi.** Ders: bir optimizasyona girişmeden önce o baytların
gerçekten indirilip indirilmediğini ölç.

---

## 4. Hat

| Komut | Ne yapar |
| --- | --- |
| `npm run package:web` | `build` + `tools/package-web.mjs` → `builds/<slug>-web-<tarih>.zip` |
| `npm run preview:package` | En yeni zip'i **itch gibi alt yolda** servis eder: `http://localhost:8080/html/local/` |
| `npm run preview:package -- <klasör>` | Çıkarılmış klasörü servis eder (zip tercih edilir; yüklenen o) |

### 4.1 `tools/package-web.mjs`

Elle yazıldı çünkü ortamda `zip`/`7z` yok ve `Compress-Archive` güvenilmez
(§2.5). Üç şeyi garanti eder:

1. `index.html` **arşiv kökünde**,
2. girdi adlarında **eğik bölü**,
3. zaten sıkıştırılmış medya (webp/ogg/glb/png) STORE'lanır, yalnız metin
   deflate edilir — 155 MB'ı yeniden sıkıştırmak dakikalar alır, kilobayt kazandırır.

Yazdıktan sonra **merkezi dizini geri okur** ve 864 CRC'yi kaynak dosyalara karşı
doğrular; sessizce bozuk bir yükleme, başarı gibi görünen tek hatadır.

`--label v1.0.1` → `sinir-kralliklari-web-v1.0.1.zip`. Etiket temizleyicisi
proje adının `slug`'ından ayrıdır: o noktaları siler ve `v1.0.1`'i `v1-0-1`
yapardı. `release/v3.1` → `release-v3.1`, `..` → tarihe düşer (yol kaçışı yok).

### 4.2 `tools/serve-package.mjs`

**Zip'in kendisinden** servis eder — yüklenecek dosyanın aynısı test edilir,
çıkarma adımı aradan kalkar. Kök dışındaki her yola 404 döner (bir yol
yanlışlıkla çalışıyorsa itch'te çalışmayacaktır), `cache-control: no-store`
gönderir (yoksa dünkü build'e bakıp doğru sanarsın) ve `Range` isteklerini
destekler (Chrome müziği akıtırken ister).

### 4.3 `.github/workflows/release.yml`

```bash
git tag v1.0.1 && git push origin v1.0.1
```

Kapıyı koşar (`build:verify` + `check:assets`), geçerse paketler ve zip'i
**GitHub Release'e ek** olarak koyar.

Üç karar ve sebepleri:

- **Kapı önce, paket sonra.** Etiket, CI'ın hiç görmediği bir commit'e işaret
  edebilir; `build:verify` varsayılmaz, tekrar koşar.
- **Workflow artifact değil, Release eki.** `actions/upload-artifact` verdiğini
  ikinci bir zip'e sarar; indirdiğinde zip içinde zip alırsın ve itch dıştakini
  reddeder. Release eki tam olarak yüklenecek dosyayı verir ve süresi dolmaz.
- **Üçüncü parti action yok.** `gh release create` runner'da hazır gelir;
  `permissions: contents: write` dışında yetki istemez.

**itch'e yükleme kasıtlı olarak elle.** Repoda API anahtarı yok, ve yeşil bir
build ile "oyuncular bunu şimdi görsün" aynı karar değil. Tam otomasyon
istenirse `butler push` bu workflow'a eklenebilir (fark başına yalnız değişen
dosyaları yükler); ön koşul `BUTLER_API_KEY` secret'ı ve oyun slug'ıdır.

---

## 5. Yayın öncesi doğrulama

Bunların hiçbiri gözle yapılmaz; hepsi otomatik veya tek komuttur.

1. `npm run build:verify` — 1577 engine kontrolü + `verify:dist --strict`.
   Bu tarama artık `dist/index.html`'de kök-mutlak `src=`/`href=` görürse
   **build'i kırar** (§2.1'in nöbetçisi).
2. `npm run package:web` — zip üretir ve 864 CRC'yi doğrular.
3. `npm run preview:package` → `http://localhost:8080/html/local/` — **alt
   yolda, sorgu dizesi olmadan** aç.
4. Piksele değil özniteliğe bak:

   | öznitelik | beklenen |
   | --- | --- |
   | `data-rts-level` | `authored` |
   | `data-rts-level-ref` | `assets/ThreeAges/Levels/RTS_GameplayProof.level.json` |
   | `data-rts-ground` | `landscape` |
   | `data-rts-content-assets` | `ready` |
   | `data-rts-content-placeholders` | `0` |

   **`data-rts-ground` "flat" başlar** ve Landscape yüklenince "landscape" olur.
   Bir kez okumak erken okumaktır — smoke aynı sebeple 30 sn bütçe verir.
5. Konsolda 404 var mı. `.skeleton.json` / `.uvw.json` / `.materials.json`
   404'leri **normaldir** — opsiyonel editör sidecar'ları, yükleyiciler tolere
   eder. Bunların dışında bir 404 gerçek hatadır.

Regresyon nöbetçileri koda gömüldü: `verify-dist.mjs` kök-mutlak yol taraması,
`publicUrl` sözleşmesini sabitleyen iki engine kontrolü, ve
`rts-assetization-baseline.spec.ts`'te bayraksız rotanın `authored` + `landscape`
çözdüğünü iddia eden üç smoke kontrolü.

---

## 6. itch.io yükleme ayarları

- Zip'i yükle, **"This file will be played in the browser"** işaretle.
- Viewport: oyun tam ekran canvas; 1280×720 iyi bir başlangıç.
  **"Fullscreen button"** açık.
- itch'in tıkla-başlat kapağını **kapatma** — tarayıcı ses politikası bir
  kullanıcı hareketi istiyor, o kapak tam olarak onu sağlıyor.
- "Mobile friendly": `index.html` mobil odaklı yazıldı ama gerçek cihazda
  doğrulanmadı; denemeden işaretleme.
- 155 MB, itch'in dosya başına 1 GB sınırının altında.

---

## 7. Yanlış çıkan iki hipotez

Kayda geçiyor, çünkü ikisi de ölçülmeseydi yanlış işe girişilecekti.

1. **"Müziği yeniden kodlayalım, 41 MB → 15 MB."** Müzik akışla geliyor ve
   zaten makul bitrate'te (§3.3). İş iptal.
2. **"`levelAssets` açılınca smoke'un 30 sn bütçesi aşıldı, testleri ben
   bozdum."** Temiz baseline'da aynı spec koşuldu: **9 kırmızı zaten vardı**,
   "Play the level you edit" dahil. Değişiklik hiçbir yeni hata eklemedi.

Bir de "harf durumu uyuşmazlığı" şüphesi ölçülüp **elendi**: 639 varlık
referansında 0 uyuşmazlık. Elenmiş bir şüphe de bir bulgudur — ama denetimin
kendisi saklanmalı, çünkü Windows'ta çalışan bir yol Linux'ta 404 verebilir.

---

## 8. Açık kalanlar

| Konu | Durum |
| --- | --- |
| **Modeller** | Maç yükünün 83.8 MB'ı. Draco/meshopt + GLB içi doku sıkıştırma ile yarıya inmek gerçekçi, ama görsel risk taşır ve ölçe ölçe gidilmeli. Yayın sonrası en yüksek getirili iş. |
| **Oyun kaydı** | Yok. `localStorage` yalnız ayarlar ve menü müziği için. Sekme yenilenince ilerleme gider. Tasarım kararı bekliyor. |
| **Mobil** | Doğrulanmadı. |
| **Önceden kırmızı smoke** | `rts-assetization-baseline.spec.ts`'te 9 test bu çalışmadan önce de kırmızıydı ("Play the level you edit", "Landscape Faz 5", "Assetization Faz E", 6× "Material assetization"). Ayrı bir iş. |
| **butler ile tam otomasyon** | Altyapı hazır, karar verilmedi (§4.3). |

---

## 9. İlgili dosyalar

| Dosya | Rol |
| --- | --- |
| `vite.config.ts` | `base: "./"` — hattın ön koşulu |
| `engine/assets/publicUrl.ts` | Tek yol çözücü; `import.meta.env` tembel okunur (node testleri için) |
| `src/project/ProjectSystem.ts` | `projectFileUrl` — her proje dosyasının tek hunisi |
| `tools/package-web.mjs` | Zip üretimi + CRC doğrulaması |
| `tools/serve-package.mjs` | Zip'i alt yolda servis eder |
| `tools/optimize-ui-art.mjs` | UI sanatı optimizasyonu |
| `builder/web/verify-dist.mjs` | Kök-mutlak yol nöbetçisi |
| `.github/workflows/release.yml` | Etiket → kapı → paket → Release |
