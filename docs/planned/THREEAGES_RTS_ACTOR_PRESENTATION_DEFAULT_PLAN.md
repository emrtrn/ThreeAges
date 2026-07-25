# ThreeAges RTS Actor Sunumunu Varsayilan Yapma Plani

Olusturulma tarihi: 2026-07-25  
Durum: Faz 1 ve Faz 2 uygulandi. Faz 3-5 bekliyor.

## Karar

RTS'nin varsayilan gorsel otoritesi Actor Script olacaktir. `contentAssets` flag'i, yeni katalog/Actor yolunun gecis donemindeki opt-in anahtaridir. Plan tamamlandiginda normal `?rts` rotasi Actor Script sunumunu kullanir; flag geriye uyumlu no-op olur ve daha sonra kaldirilir.

## Mevcut durum ve sorun

```text
Flag kapali
  RtsBuildingVisuals -> rtsBuildingArt.ts -> tek glTF model

Flag acik (?rts&flags=contentAssets)
  rts-content.json -> *.actor.json -> RtsActorVisualFactory
  -> tum StaticMeshComponent / SkeletalMeshComponent'ler
```

Ikinci yol, Actor'un tum render edilebilir componentlerini okur. Bu nedenle ikinci bir `StaticMeshComponent` yalnizca Actor sunum yolu aktifken gorunur. Component'e `position`, `rotation` veya `scale` verilmezse model root'un lokal orijininde cizilir; baska bir mesh ile ust uste kalabilir.

Flag, eksik katalog eslemesi veya bozuk bir assetin normal RTS baslangicini bozmasini engelleyen gecis guvencesidir. Kapsam ve dogrulama tamamlandiginda paralel legacy yolun bakim maliyeti anlamsiz hale gelir.

## Hedef mimari

```text
RtsApp
  -> rts-content.json (gameplay id -> Actor ref)
  -> RtsActorVisualFactory (component agaci + manifest assetleri)
  -> RtsBuildingVisuals / UnitSystem (presentation handle)

balance/*.json
  -> maliyet, footprint, can, uretim ve gameplay kurallari
```

- Balance ve simulation verileri Actor Script'e tasinmaz.
- `rts-content.json`, gameplay kimligi ile Actor ref'i arasindaki tek esleme noktasidir.
- Actor Script, component agaci, lokal transform, mesh ve diger sunum verilerinin otoritesidir.
- `assets/manifest.json`, her `assetId`nin tek asset otoritesidir.

## Uygulama notlari (2026-07-25)

Faz 1 ve Faz 2 tamamlandi.

- Katalog artik 11 building kimliginin tamamini iki age ve uc level icin esler
  (`public/game-data/content/rts-content.json`). Actor'lar
  `public/assets/ThreeAges/Actors/Buildings/` altinda; her biri legacy
  `rtsBuildingArt.ts` mesh eslemesiyle ayni modeli gosterir, boylece iki yol
  gorsel olarak ayni acilir.
- `BP_RTS_Barracks_T1/T2` yerine yasli set (`_FirstAge_/_SecondAge_ T1..T3`)
  geldi. Kaynak kamplari (`lumber_camp`, `quarry`, `gold_mine`) pakette tek
  modele sahip oldugu icin bilincli olarak tum age/level'da ayni Actor'a coz.
- Command Center artik `RtsBuildingVisuals.applyToCenter` icinde de Actor yolunu
  once dener; pack yuklendiginde `RtsApp` merkezleri yeniden giydirir.
- **Onayli istisna:** `archer_placeholder`, `siege_placeholder`,
  `worker_placeholder` Actor'a eslenmedi. Pakette tek karakter mesh'i var, uc
  rolu de ona eslemek Guard ile ayni modele dusurur ve GDD 06 §3.4'un rol
  okunabilirligini bozardi. Bu uc kimlik kod silueti kullanmaya devam eder ve
  test icinde acik bir istisna listesi olarak gecer.
- Yeni dogrulama otoritesi: `src/game/rts/content/rtsContentValidation.ts`
  (manifest eslemesi, mesh/tur uyumu, benzersiz component id, parent ve dongu
  kontrolu, kapsama bosluklari). `RtsActorVisualFactory` ve engine testleri ayni
  fonksiyonu kullanir, yani CI'dan gecen bir pack oyunda farkli davranamaz.
- Sunum agaci `src/game/rts/content/rtsActorPresentationTree.ts`e ayrildi;
  renderer gerektirmedigi icin coklu mesh ve lokal transform davranisi artik
  unit testle kanitlanabiliyor.
- Level tavani art paketinden degil age balance'tan turetiliyor
  (`1 + levelUpgrades.length`), bu yuzden yeni bir level eklemek Actor'lari
  authorlanana kadar testi kirar.

## Faz 1 — Kapsam envanteri ve veri sozlesmesi

1. Tum unit ve building gameplay kimliklerini; completed, construction, age ve level varyantlariyla listele.
2. Her varyantin `rts-content.json` icinde Actor ref'i oldugunu dogrula.
3. Eksik modele sahip varyantlar icin bilincli placeholder presentation Actor author et; sessiz legacy fallback kullanma.
4. Nihai modda eksik katalog eslemesini build/test hatasi kabul edecek sema ve testleri tanimla.

Teslim olcutu: Her playable RTS kimligi icin kapsama matrisi ve testle hesaplanan ref sayisi vardir.

## Faz 2 — Actor ve asset dogrulamasi

1. Her `*.actor.json` dosyasini `normalizeActorScriptDef` ile normalize et.
2. Her mesh componenti icin dolu `assetId` zorunlu kil.
3. `assetId`nin manifestte oldugunu ve component turuyle (`staticMesh` / `skeletalMesh`) uyustugunu dogrula.
4. Component id benzersizligini, parent referanslarini ve component agacinda dongu olmadigini kontrol et.
5. Presentation ref'i olan Actor'un en az bir mesh componenti oldugunu zorunlu kil.
6. Coklu mesh Actor'de tum componentlerin olusturuldugunu ve parent/lokal transformlarin korundugunu unit test ile kanitla.

Teslim olcutu: Bozuk Actor, eksik mesh, hatali parent ve manifest uyusmazligi anlamli hata verir.

## Faz 3 — Runtime hata davranisi

1. `RtsActorVisualFactory.load()` toplu hatasini per-Actor sonuca ayir; hata ref ve component id ile raporlansin.
2. Gecis doneminde bozuk tek Actor icin acik placeholder kullan; tum pack'i legacy moda dusurme.
3. Placeholder sayisini debug dataset ve logda gorunur yap.
4. Construction, completed, preview, upgrade ve age degisiminde ayni Actor secim yolunun kullanildigini test et.
5. Root footprint'e olceklenirken coklu mesh bounding box ve lokal konumlarinin korundugunu dogrula.

Teslim olcutu: Asset sorunu teshis edilebilir olur ve render dongusu devam eder.

## Faz 4 — Varsayilan rotaya gecis

1. `main.ts`de RTS content katalogunu feature flag'e bagli olmadan yukle.
2. `RtsApp` Actor visual factory'sini her RTS baslangicinda olustur.
3. `RtsBuildingVisuals` icindeki `rtsBuildingArt.ts` fallback'ini gecici hata-placeholderina indir; normal akista glTF path secimi yapmasin.
4. `?flags=contentAssets`i bir surum boyunca no-op tut veya kaldirilacagini release notunda duyur.
5. Cikis kriterleri saglaninca eski preload ve `rtsBuildingArt.ts` yolunu kaldir.

Teslim olcutu: `?rts` ve `?rts&flags=contentAssets` ayni Actor component agacini render eder; ikinci static mesh iki URL'de de gorunur.

## Faz 5 — Legacy temizligi

1. Legacy fallback referanslarini `rg` ve TypeScript ile sifirla.
2. Legacy yolu test eden browser/engine testlerini Actor kapsam testleriyle degistir.
3. Feature flag kaydini ve dokumantasyonunu kaldir veya `retired` olarak isaretle.
4. Authoring rehberine coklu mesh ve lokal transform ornekleri ekle.

## Zorunlu testler

| Katman | Senaryo | Beklenen sonuc |
| --- | --- | --- |
| Unit | Katalogtaki her ref | Actor dosyasi, mesh componenti ve manifest asseti gecerlidir |
| Unit | Iki `StaticMeshComponent` | Iki model runtime root altindadir; parent/local transform korunur |
| Unit | Bozuk `assetId` | Ref ve component id iceren deterministik hata |
| Engine | Tum building state'leri | Construction/completed/preview/upgrade dogru Actor'i secer |
| Browser | `?rts` | `data-rts-content-assets="ready"`; console error yok |
| Browser | Coklu mesh Farm | Zemin ve bugday mesh sayisi sahnede ikidir |
| Browser | Yerlesim, upgrade, age degisimi | Yeni Actor gorunur; eski visual leak etmez |
| Browser | Katalog/asset hatasi | Acik hata/placeholder gorunur; render loop devam eder |

TypeScript degisikliginden sonra `npx tsc --noEmit` calistirilir. Runtime veya Three.js degisikliginde asagidaki yerel kapı tercih edilir:

```text
npx tsc --noEmit
npm run test:engine
npm run build:verify
```

Actor sunumundaki anlamli degisiklikler ayrica `?rts` uzerinde Playwright smoke testiyle dogrulanir. Test, varsayilan rotanin feature flag gerektirmedigini acikca kanitlamalidir.

## Cikis kriterleri

- Her aktif RTS gameplay kimligi ve gerekli varyanti Actor katalogunda eslenmistir.
- Manifest, Actor ve component agaci dogrulamasi CI'da calisir.
- Varsayilan `?rts` browser smoke testinde Actor assets `ready` olur.
- Coklu mesh, preview, construction, upgrade ve age gecisleri browser testleriyle kanitlanmistir.
- Placeholder/fallback sayisi sifirdir veya urun tarafindan onayli acik istisnalardir.
- `npx tsc --noEmit`, `npm run test:engine` ve `npm run build:verify` basarilidir.

## Riskler

| Risk | Onlem |
| --- | --- |
| Bir Actor dosyasi tum pack'i bozuyor | Per-Actor sonuc, ref bazli hata ve placeholder |
| Ikinci mesh gorunmuyor | Scene graph/component sayisi testi; acik lokal transform authoring'i |
| Coplanar yuzeylerde z-fighting | Asset birlestirme veya bilincli kucuk lokal offset |
| Actor presentation gameplay'i etkiliyor | Balance/simulation sinirini koruyan testler |
| Eski ve yeni yol farkli gorunuyor | Varsayilan gecisten once karsilastirmali Playwright ekran goruntuleri |

## Uygulama sirasi

Once Faz 1 ve Faz 2 tamamlanir. Kapsama ve veri dogrulamasi olmadan flag kaldirilmaz. Faz 3 hata davranisini gozlemlenebilir hale getirir. Faz 4, onceki testler yesilken varsayilan akisi degistirir. Faz 5, bir surumluk gozlemden sonra teknik borcu temizler.
