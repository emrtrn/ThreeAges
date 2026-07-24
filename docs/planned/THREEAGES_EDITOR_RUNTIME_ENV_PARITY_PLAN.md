# ThreeAges Editor <-> Runtime Ortam Paritesi Plani

Olusturulma tarihi: 2026-07-24
Durum: Planlandi - uygulama baslamadi
Kapsam: Editorde authoring yapilan ortam aktorlerinin (Sky Atmosphere / Sky Light,
Exponential Height Fog, Cloud Layer, Post Process, arka plan + ambient) RTS oyun
runtime'inda (`RtsApp`) da birebir gorunmesini saglamak. Kok neden bir bug degil,
iki ayri render hattinin sessizce ayrilmasidir.

## 0. Neden bu plan var (kok neden)

Forge'un temel sozu (CLAUDE.md): **"One SceneApp renders both the runtime and the
editor viewport."** Editorde gorunen sahne = oyunda gorunen sahne, cunku ikisi ayni
render hattindan gecer. WYSIWYG'in tek garantisi budur.

Bu proje o sozu kirdi. Su an ortami uygulayan uc parca var:

1. **Editor viewport** — authored ortami uygular.
2. **`RuntimeSceneApp`** (`src/scene/RuntimeSceneApp.ts`, `/` rotasi / editor Play
   tusu) — ayni ortami uygular. Editorle paritesi tamdir.
3. **`RtsApp`** (`src/game/rts/RtsApp.ts`, `?rts` rotasi) — sahneyi koddan sifirdan
   kuran ayri bir uygulama. Level'i yalniz gameplay verisi (marker, statik mesh,
   authored directional light) olarak okur; ortam aktorlerini **hic okumaz**.

Kullanicinin oynadigi sey #3. Editor ise #1'i onizler. Sonuc: editor, oyunun
kullanmadigi bir renderer'in onizlemesi haline geldi; parite ozellik ozellik
asindi (skylight, fog, cloud, post-process hicbir zaman RTS tarafina baglanmadi).

Kanit:
- `RtsApp.buildScene()` sabit `scene.background` ([RtsApp.ts:516](../../src/game/rts/RtsApp.ts#L516)),
  sabit `AmbientLight(0.65)` + `DirectionalLight` ([:974-985](../../src/game/rts/RtsApp.ts#L974-L985))
  kurar; `scene.fog` ve `scene.environment` hic set edilmez.
- `src/game/rts` altinda `heightFog` / `skyAtmosphere` / `skyLight` / `applySceneFog`
  / `resolveSkyAtmosphere` gecen tek satir yok. Oradaki tum "fog" kelimeleri savas
  sisi (fog-of-war), atmosferik sis degil.
- `rtsLevelLoader.loadRtsLevel` ham `layout`'u `RtsApp`'e verir (yani veri erisilebilir),
  ama `RtsApp` ortam singleton'larini kullanmaz.

## 1. Hedef

Tasarimci editorde Sky Atmosphere, Sky Light, Exponential Height Fog, Cloud Layer,
Post Process veya arka plan/ambient ayarlarini degistirip kaydettiginde,
`?rts&preset=...&flags=levelAssets` ile acilan oyunun **birebir ayni gorunmesi** —
kod degisikligi olmadan.

Ilke: **Oyun runtime'i, Forge runtime'inin bir ust kumesi olmalidir; paraleli degil.**
`RtsApp` ortami yeniden yazmaz, paylasimli katmani *cagirir* ve ustune sadece kendi
gameplay katmanini (birimler, fog-of-war, UI) bindirir.

## 2. Basari Tanimi

Asagidaki akis kod degisikligi olmadan calismali:

1. Tasarimci Level'i editorde acar, Height Fog ekler + Sky Atmosphere/Sky Light
   ayarini degistirir, kaydeder.
2. `http://127.0.0.1:5173/?rts&preset=gameplay_proof&flags=levelAssets` acilir.
3. Oyunda sis ve gokyuzu/skylight editordekiyle ayni gorunur.
4. Ayni Level `/` (RuntimeSceneApp) rotasinda da ayni gorunmeye devam eder (regresyon yok).
5. Level'da hicbir ortam aktoru yoksa, `RtsApp` bugunku gorunumunu korur (fallback).

## 3. Mimari Karar: Paylasimli `AuthoredEnvironment` katmani

`RuntimeSceneApp` icindeki ortam mantigini, bir runtime'a bagli olmayan tek bir
owner'a tasi. Aday: `engine/render-three/authoredEnvironment.ts` (ya da
`engine/scene/`) icinde bir `AuthoredEnvironment` sinifi/factory.

Tasinacak mevcut yuzey (RuntimeSceneApp'te bugun private metotlar):

| Bugunku metot | Ne yapar | Yeni katmanda |
| --- | --- | --- |
| `applyRuntimeSky` ([:5241](../../src/scene/RuntimeSceneApp.ts#L5241)) | Sky dome + gunes yonu + tone mapping | `apply()` |
| `applyRuntimeReflection` ([:5290](../../src/scene/RuntimeSceneApp.ts#L5290)) | Sky Light IBL yakalar, `scene.environment` | `apply()` |
| `applyRuntimeFog` ([:5263](../../src/scene/RuntimeSceneApp.ts#L5263)) | `scene.fog` = heightFog | `apply()` |
| `applyRuntimeClouds` ([:5273](../../src/scene/RuntimeSceneApp.ts#L5273)) | Cloud dome | `apply()` |
| `applyRuntimePostProcess` ([:5318](../../src/scene/RuntimeSceneApp.ts#L5318)) | Tone mapping + post pipeline | `apply()` (opsiyonel, Faz 3) |
| `applySceneBackgroundAndAmbient` ([SceneRuntimeCore](../../src/scene/SceneRuntimeCore.ts)) | worldSettings arka plan + ambient | `apply()` |
| per-frame follow ([:1304-1307](../../src/scene/RuntimeSceneApp.ts#L1304-L1307)) | `followCameraWithSky/Clouds` + `advanceCloudTime` | `update(camera, dt)` |
| teardown ([:2841-2849](../../src/scene/RuntimeSceneApp.ts#L2841-L2849)) | sky/cloud/reflectionTarget dispose | `dispose()` |

Onerilen arayuz (taslak):

```ts
interface AuthoredEnvironmentDeps {
  scene: Scene;
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  // Sky, gunes yonunu bir directional light'in rotasyonundan alir.
  sunLight: () => Object3D | null;
}

class AuthoredEnvironment {
  constructor(deps: AuthoredEnvironmentDeps);
  // Level'daki ortam singleton'larini uygular. Aktor yoksa ilgili parca no-op.
  apply(layout: RoomLayout, opts?: { recaptureReflection?: boolean }): void;
  update(deltaSeconds: number): void;   // per-frame sky/cloud follow
  dispose(): void;
  // RtsApp'in fallback ambient/background'i geri cekmesi icin:
  hasAuthoredSky(layout: RoomLayout): boolean;
  hasAuthoredBackground(layout: RoomLayout): boolean;
}
```

Bu owner; `skyObject`, `cloudObject`, `reflectionTarget`, `postProcessPipeline`
alanlarina *sahip olur*. `RuntimeSceneApp` bu alanlari kendinden cikarir ve owner'a
delege eder (davranis birebir korunur). `RtsApp` ayni owner'i insta eder.

## 4. Kapsam

Dahil (V1):
- Sky Atmosphere dome + gunes yonu + tone mapping
- Sky Light / IBL (`scene.environment`, ambient bounce)
- Exponential Height Fog (`scene.fog`)
- Arka plan rengi + ambient (worldSettings)

Faz 3 (opsiyonel, ayri karar):
- Cloud Layer
- Post Process (tone mapping + bloom/AA pipeline)

Haric (bu plan degil):
- Sphere Reflection Capture / Planar Reflection / Reflective Surface — bunlar
  daha gameplay/perf-hassas; RTS'e tasinmalari ayri bir faz. (River water zaten
  kendi shared planar reflection'ini kullaniyor.)
- Kalite profilleri / adaptive quality (`RtsApp`'in kendi perf modeli var).
- Yeni authoring ozelligi. Bu plan yalniz *mevcut* authored ortamin RTS'te
  gorunmesini saglar.

## 5. Fazlar

### Faz 0 - Extraction (davranis degismez)
`AuthoredEnvironment`'i olustur; `RuntimeSceneApp`'in ortam metotlarini oraya tasi
ve `RuntimeSceneApp` owner'i cagiracak sekilde ince delege haline gelsin.
Kabul: `/` rotasi (editor Play) gorunumu birebir ayni; `npm run test:engine` ve
mevcut smoke'lar yesil. Salt refactor, sifir gorsel degisiklik.

### Faz 1 - RtsApp entegrasyonu (fog + sky/skylight + background)
`RtsApp` bir `AuthoredEnvironment` insta eder. `loadAuthoredWorld` yolunda,
`levelAssets` flag'i acikken ve `options.levelLayout` varken `apply(layout)` cagrilir.
- Authored sky/skylight varsa: sabit `AmbientLight(0.65)` ve sabit `scene.background`
  geri cekilir (codeSun'in emekliye ayrilmasiyla ayni desen: yukleme basarisiz
  olursa fallback'te kal).
- Per-frame: `RtsApp` update dongusunde `environment.update(dt)` cagrilir.
- Teardown/restart yolunda `environment.dispose()`.
Kabul: authored fog + skylight'li Level RTS'te editordekiyle ayni; ortamsiz Level
bugunku RTS gorunumunu korur.

### Faz 2 - Parite guvencesi (test)
Otomatik parite kontrolu (asagida §6). CI'ye baglanir.

### Faz 3 - Cloud + Post Process (opsiyonel)
Cloud Layer ve Post Process'i ayni katmandan RTS'e bagla. Post-process tone
mapping RTS'in mevcut gorunumunu degistirebilir; bu yuzden ayri faz ve ayri
gorsel onay. Gerekirse `applyEditorMatchedPlayLook` paritesi de burada ele alinir.

### Faz 4 - Dokumantasyon + temizlik
CLAUDE.md "Current Capabilities" ve bu dokuman guncellenir; `RtsApp`'teki sabit
ortam kodu (artik fallback) net yorumlanir.

## 6. Parite testi (regresyon kalkani)

Amac: sapmayi kullanici fark etmeden yakalamak. En az bir otomatik kontrol:

- **Engine/smoke:** authored `heightFog` + `skyAtmosphere` iceren minimal bir Level
  ile `RtsApp` (veya `AuthoredEnvironment.apply`) kosulur; assert:
  `scene.fog !== null` ve `scene.environment !== null`. Ortamsiz Level'da ikisi de
  fallback degerinde.
- Ideal ust hedef: "authored aktor turu basina, level'i render ettigini iddia eden
  her runtime onu uygular" invaryanti. En azindan fog + skylight icin kilitlenir.

## 7. Riskler ve dikkat

- **Isik cift sayimi:** Authored skylight (IBL ambient) + sabit `AmbientLight(0.65)`
  ayni anda kalirsa sahne yaninik olur. Fallback'i authored ortam *basariyla*
  yuklendikten sonra geri cekmek sart (codeSun deseni).
- **Golge kamerasi:** RTS sun'unun ozel shadow-camera ayarlari var; authored
  directional light devralinca golge kapsami korunmali.
- **Post-process tone mapping** RTS gorunumunu kaydirabilir -> Faz 3'e ayrildi,
  ayri onay.
- **Perf:** Sky Light IBL yakalama (`captureSkyEnvironment`) boot'ta bir kez; RTS
  boot suresine etkisi olcumlenir. Cloud dome per-frame maliyeti dusuk ama olculur.
- **Teardown/restart:** RTS pause->restart yolunda environment dispose+reapply
  dogru sirada olmali (reflectionTarget sizmasi olmasin).

## 8. Ilerleme Kaydi

- 2026-07-24: Plan olusturuldu. Kok neden: RtsApp ayri render hatti; authored ortam
  singleton'larini yok sayiyor. Karar: paylasimli `AuthoredEnvironment` katmani +
  parite testi.
- 2026-07-24: **Faz 0 tamamlandi.** `engine/render-three/authoredEnvironment.ts`
  olusturuldu — `AuthoredEnvironment` sinifi sky/reflection(skylight)/fog/cloud
  singleton'larina ve sky<->post-process exposure kaplinine sahip; `apply*`,
  `applySkyPostProcessExposure`, `update`, `disposeReflectionTarget`, `teardown`
  API'leri. `RuntimeSceneApp` bu owner'a delege ediyor: `skyObject`/`cloudObject`/
  `reflectionTarget` alanlari ve `applyRuntimeSky`/`Fog`/`Clouds`/`Reflection` +
  `disposeReflectionTarget` + `applyRuntimeSkyPostProcessExposure` metotlari kaldirildi;
  build/per-frame/teardown/dispose cagrilari owner'a baglandi. Davranis birebir korundu
  (uygulama sirasi: sky -> reflection -> postProcess -> fog -> clouds). Dogrulama:
  `tsc --noEmit` temiz; `test:engine`'deki tek hata onceden var olan River Water foam
  WIP'i (degisiklik geri alininca ayni sekilde basarisiz — bu refactor'dan bagimsiz).
  Sonraki: Faz 1 — `RtsApp`'i ayni owner'a baglamak (`levelAssets` arkasinda).
