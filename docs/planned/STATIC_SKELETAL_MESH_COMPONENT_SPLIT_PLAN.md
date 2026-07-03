# Static Mesh / Skeletal Mesh Component Split Planı

> Tarih: 2026-07-03
> Durum: Plan. Kod uygulanmadı.
> Amaç: Forge Actor Script ve sahne Details yüzeylerinde Unreal'a daha yakın
> şekilde `StaticMeshComponent` ve `SkeletalMeshComponent` ayrımını kurmak;
> mesh picker'ları asset tipine göre filtrelemek; sahneye doğrudan bırakılan
> skeletal meshlerde Play animasyon seçimini Details paneline taşımak.

## Problem

Bugünkü Actor Script component modeli tek bir `MeshRenderer` kullanıyor. Bu
component manifestteki hem `staticMesh` hem de `skeletalMesh` assetlerini kabul
ediyor. Bu, Unreal modelinden sapıyor:

- Static Mesh Component ve Skeletal Mesh Component ayrı component türleri olmalı.
- Static Mesh Details yüzeyi static mesh'e özgü kalmalı.
- Skeletal Mesh Details yüzeyi skeletal mesh'e özgü olmalı ve animasyon seçimi
  sunmalı.
- Static mesh componentindeki Mesh picker yalnızca `staticMesh` assetlerini,
  skeletal mesh componentindeki Mesh picker yalnızca `skeletalMesh` assetlerini
  listelemeli.
- Bir skeletal mesh doğrudan sahneye bırakıldığında da Details panelinde
  Animation bölümünden Play modunda çalacağı animation asset/clip seçilebilmeli.

Forge'da Animation Blueprint sistemi yok. Bu plan animasyon seçimini Skeletal
Mesh Editor'daki Animation bölümünde kullanılan skeleton sidecar/clip bilgisine
dayandırır; scene instance ve Actor Script component yalnızca hangi clip'in Play
modunda çalacağını tutar.

## Mevcut Bağlam

- Asset manifest tipi zaten ayrık: `staticMesh` ve `skeletalMesh`.
- Actor Script component listesi `engine/scene/actorScript.ts` içinde
  `MeshRenderer` ile tek mesh componenti sunuyor.
- Runtime/entity okuma yolu `engine/scene/components.ts` içindeki
  `readMeshRendererComponent` fonksiyonuna dayanıyor.
- Actor Script Details picker'ı `src/editor/ActorScriptEditor.ts` içinde tüm model
  assetlerini `isModelAssetType(...)` ile listeliyor.
- Scene editor'da skeletal mesh sürükle-bırak `src/scene/SceneApp.ts` içinde
  `layout.characters[]` kaydı oluşturuyor ve bugün `animation: "idle"` seed ediyor.
- `LayoutCharacter.animation` alanı ve save validator allowlist'i zaten var; bu
  alan sahneye doğrudan bırakılan skeletal mesh animasyon seçimi için genişletilecek.
- Actor Script viewport preview yolu `engine/scene/actorPreview.ts` ve
  `src/editor/ActorScriptViewport.ts` üzerinden component ağacını render ediyor.

## Ana Karar

Yeni modelin kullanıcı yüzeyi iki ayrı component adı üzerinden kurulmalı:

- `StaticMeshComponent`
- `SkeletalMeshComponent`

Eski `MeshRenderer` dosya uyumu korunmalı. Eski actor assetleri açıldığında
bozulmamalı; migration/normalize katmanı asset tipine bakarak mümkünse yeni
component türüne dönüştürmeli, emin olamadığı durumda eski veriyi güvenli şekilde
korumalı.

Runtime'da ilk fazda render uygulaması ortak mesh-rendering altyapısını
kullanabilir. Ayrımın önceliği authoring modeli, picker filtreleri, Details
alanları ve animasyon verisidir.

## Hedef Veri Modeli

### StaticMeshComponent props

```ts
interface StaticMeshComponentProps {
  assetId?: string;        // manifest assetType === "staticMesh"
  materialSlot?: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
  scale?: Vec3;
}
```

### SkeletalMeshComponent props

```ts
interface SkeletalMeshComponentProps {
  assetId?: string;        // manifest assetType === "skeletalMesh"
  animation?: string;      // Play'de çalacak clip adı
  castShadow?: boolean;
  receiveShadow?: boolean;
  scale?: Vec3;
}
```

`animation` başlangıçta clip adı string'i olarak tutulmalı. Daha sonra animation
asset tipi veya montage sistemi genişlerse bu alan `{ clip, mode }` gibi bir
objeye yükseltilebilir; ilk fazda basit string daha az riskli.

## Fazlar

### Faz 0 - Envanter ve Uyumluluk Sınırı

- [ ] `MeshRenderer` kullanım noktalarını sınıflandır:
  - Actor Script authoring.
  - Actor Script preview.
  - Scene editor placed actor render.
  - Runtime placed actor render.
  - Legacy layout adapter.
  - Engine tests.
- [ ] Eski `MeshRenderer` assetleri için migration kararını netleştir:
  - `assetId` manifestte `staticMesh` ise `StaticMeshComponent`.
  - `assetId` manifestte `skeletalMesh` ise `SkeletalMeshComponent`.
  - `assetId` yoksa veya manifestte bulunmuyorsa dosyayı kayıpsız açmak için
    eski props korunur, Details'ta seçilen yeni component tipine göre yazılır.
- [ ] Varsayılan Character Actor Script seed'ini `SkeletalMeshComponent` yap.

### Faz 1 - Engine Component Tipleri

- [ ] `engine/scene/components.ts` içinde iki yeni component sabiti ve typed
  interface ekle:
  - `STATIC_MESH_COMPONENT`
  - `SKELETAL_MESH_COMPONENT`
- [ ] `readStaticMeshComponent` ve `readSkeletalMeshComponent` okuyucularını ekle.
- [ ] `readMeshRendererComponent` için geçici back-compat okuyucu bırak veya ortak
  `readRenderableMeshComponent` helper'ı oluştur.
- [ ] Runtime callsite'larını önce ortak helper'a taşı, sonra eski `MeshRenderer`
  bağımlılığını azalt.
- [ ] Tests: eski `MeshRenderer`, yeni static component ve yeni skeletal component
  entity okuma testleri.

### Faz 2 - Actor Script Component Modeli

- [ ] `ACTOR_COMPONENT_KINDS` içine `StaticMeshComponent` ve
  `SkeletalMeshComponent` ekle.
- [ ] Add Component menüsünde eski `MeshRenderer` yerine iki ayrı seçenek göster.
- [ ] Component icon/label mapping'lerini güncelle.
- [ ] `normalizeActorScriptDef` içinde eski `MeshRenderer` node'larını yeni tipe
  dönüştüren toleranslı migration ekle.
- [ ] Component kind değiştirildiğinde props temizliği uygula:
  - Static'e geçince skeletal animation alanlarını kaldır.
  - Skeletal'a geçince material-slot gibi static-only alanları gerekiyorsa sakla
    veya kaldır; ilk fazda açıkça static-only tutmak daha temiz.

### Faz 3 - Actor Script Details Picker Ayrımı

- [ ] `ActorScriptEditor` içinde `modelAssets()` yerine tipli asset helper'ları kur:
  - `staticMeshAssets()`
  - `skeletalMeshAssets()`
- [ ] `StaticMeshComponent` Details:
  - Mesh picker yalnızca `assetType === "staticMesh"` listelesin.
  - Static mesh'e özgü alanlar: material slot, cast/receive shadow, local scale.
- [ ] `SkeletalMeshComponent` Details:
  - Mesh picker yalnızca `assetType === "skeletalMesh"` listelesin.
  - Animation section ekle.
  - Seçili skeletal mesh'in `*.skeleton.json` sidecar'ından clip listesi oku.
  - Clip yoksa anlaşılır boş durum göster.
  - Bilinmeyen eski `animation` değeri round-trip edilsin.
- [ ] Montage Inputs read-only paneli skeletal component altında kalmalı; static
  component altında görünmemeli.

### Faz 4 - Actor Script Preview ve Runtime Render

- [ ] `engine/scene/actorPreview.ts` preview payload'ını iki component türünü de
  okuyacak şekilde güncelle.
- [ ] `ActorScriptViewport` mesh preview'ında static/skeletal render aynı GLTF
  clone yolunu kullanabilir; skeletal preview'da ilk fazda pose/animasyon
  oynatımı şart değil.
- [ ] `SceneApp` edit-mode placed actor render yolunda yeni component helper'ını
  kullan.
- [ ] `RuntimeSceneApp` placed actor render ve character-ref kayıt yolunu yeni
  skeletal component üzerinden çalıştır.
- [ ] Character parent class için skeletal component varsa character animation
  bridge'i bu componentin `animation` değerini okuyabilmeli.

### Faz 5 - Doğrudan Sahneye Bırakılan Skeletal Mesh Details

- [ ] `EditableSelection` / `buildEditableSelection` içinde `character` seçimleri
  için `animation` değerini Details snapshot'a taşı.
- [ ] `EditorUi.renderDetails` içinde `selection.kind === "character"` için
  `Animation` section ekle.
- [ ] Seçili `assetId` skeletal mesh ise sidecar/GLTF clip listesinden dropdown
  oluştur:
  - `None` veya `Default`.
  - Mevcut clip adları.
  - Bilinmeyen eski değer için `(unknown)` option.
- [ ] Dropdown değişimi `LayoutCharacter.animation` alanını undoable command ile
  güncellesin.
- [ ] Edit-mode sahnede animasyon preview opsiyonel; ana kabul kriteri Play
  modunda seçilen animasyonun çalması.
- [ ] `SceneApp.addAssetAt` skeletal mesh default'unu sabit `"idle"` yerine:
  - skeleton sidecar `animationSet.idle` varsa onu,
  - yoksa ilk GLTF clip'i,
  - hiç clip yoksa boş bırakacak şekilde güncelle.

### Faz 6 - Save Validator ve Persistans

- [ ] Actor Script normalize/save yolunda yeni component adları allowlist içinde
  kalmalı; `normalizeActorScriptDef` bunu sağlıyor mu test et.
- [ ] `SkeletalMeshComponent.props.animation` kayıtta düşmemeli.
- [ ] `LayoutCharacter.animation` zaten allowlist'te; yeni UI akışı için regression
  testi ekle.
- [ ] Yeni `*.skeleton.json` alanı eklenirse `tools/saveValidator.ts` içindeki
  skeleton validator da güncellenmeli. Bu planda yeni skeleton sidecar alanı
  zorunlu değil.

### Faz 7 - Test ve Browser Doğrulama

- [ ] `npx tsc --noEmit`
- [ ] `npm run test:engine`
- [ ] `npm run build:verify`
- [ ] Engine tests:
  - Actor Script normalize eski `MeshRenderer` -> static/skeletal migration.
  - Static component picker helper'ı sadece static mesh döndürür.
  - Skeletal component picker helper'ı sadece skeletal mesh döndürür.
  - Skeletal component animation prop'u entity/runtime tarafında okunur.
  - Layout character animation save/load round-trip.
- [ ] Playwright önerilen smoke:
  - `?editor` aç.
  - Actor Script editor'da Static Mesh Component ekle, Mesh picker'da skeletal
    mesh görünmediğini doğrula.
  - Skeletal Mesh Component ekle, Mesh picker'da static mesh görünmediğini doğrula.
  - Skeletal componentte Animation dropdown'ının clipleri gösterdiğini doğrula.
  - Skeletal mesh'i sahneye sürükle, Details Animation dropdown'ından clip seç,
    kaydet ve Play'de clip'in kullanıldığını doğrula.

## Kabul Kriterleri

- Actor Script Add Component menüsünde `StaticMeshComponent` ve
  `SkeletalMeshComponent` ayrı görünür.
- Static Mesh Component'in Mesh picker'ında yalnızca static mesh assetleri görünür.
- Skeletal Mesh Component'in Mesh picker'ında yalnızca skeletal mesh assetleri
  görünür.
- Skeletal Mesh Component Details panelinde Play animasyonu için clip seçilebilir.
- Eski `MeshRenderer` kullanan actor scriptler açılırken bozulmaz.
- Character parent class default mesh componenti skeletal mesh component olur.
- Skeletal mesh doğrudan sahneye bırakıldığında Details panelinde Animation
  section görünür ve seçilen değer Play modunda kullanılır.
- Save/reload sonrası component tipi, asset seçimi ve animation seçimi korunur.
- `npx tsc --noEmit`, `npm run test:engine`, `npm run build:verify` geçer.

## Riskler

- `MeshRenderer` çok sayıda runtime callsite'ta ortak render abstraction olarak
  kullanılıyor. İlk uygulama küçük tutulmalı: dış kullanıcı yüzeyini ikiye ayır,
  iç render helper'ını ortak bırak.
- Eski actor script migration manifest erişimi gerektirebilir. Saf normalize
  fonksiyonu manifest bilmeden çalıştığı için migration iki katmanlı olabilir:
  pure normalize eski componenti korur, editor/load katmanı asset tipini biliyorsa
  önerilen yeni tipe taşır.
- Sahneye doğrudan bırakılan skeletal mesh legacy `layout.characters[]` yolunda.
  Actor Script component refactor'ı bu yolu otomatik çözmez; Details animation
  işi ayrı bir scene-selection değişikliğidir.
- Animasyon asset sistemi henüz Animation Blueprint değil. UI metni "Animation"
  ve "Clip" terimleriyle sınırlı kalmalı; olmayan blueprint kavramı vaat
  edilmemeli.

## Güvenlik ve Doğrulama Notu

Bu iş save/load validation, asset sidecar okuma ve editor/runtime asset ingestion
yollarına dokunacağı için uygulamaya geçmeden önce kapsamı netleştirilmiş bir
Codex Security diff scan önerilir. Scan sessiz çalıştırılmamalı; kullanıcı
onayından sonra yeni değişiklik diff'i üzerinde yapılmalı.
