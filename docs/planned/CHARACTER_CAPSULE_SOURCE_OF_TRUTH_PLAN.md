# Character Capsule Source of Truth Plan

> Tarih: 2026-07-07
> Kapsam: Actor Script `parentClass: "character"` varliklarinda fizik kapsulunu
> tek kaynak yapmak; `CharacterMovement` icindeki ikinci capsule radius /
> half-height kopyasini kaldirmak; AI, nav ve hareket sistemlerini ayni kapsul
> sozlesmesine baglamak.
>
> Temel karar: Forge Character icin capsule Collider birincil fiziksel govdedir.
> CharacterMovement hiz, ivme, step, slope, rotation ve mode davranisini tasir;
> fiziksel kapsul olcusunu ayri authored prop olarak tasimamalidir.

---

## Problem

Bugun `AI_Character.actor.json` icinde iki kapsul tanimi var:

- `Collider.props.capsuleRadius / capsuleHalfHeight`
- `CharacterMovement.props.capsuleRadius / capsuleHalfHeight`

Bu degerler ayni fiziksel govdeyi tarif ediyor, ama runtime'da farkli sistemlere
besleniyor:

- Physics collider Rapier'e kaydedilen gercek govdeyi ve blocker/sensor
  davranisini belirliyor.
- `CharacterMovement` radius bugun ground probe footprint'ini belirliyor.
- `CharacterMovement` half-height bugun AI sight trace baslangic yuksekliginde
  kullaniliyor.
- Nav profile size hesaplari explicit AI navAgent yoksa collider/movement
  fallback zincirinden geciyor.

Bu iki kaynak ayrisirsa karakterin duvar carpismasi, zemin yoklamasi, AI goz
yuksekligi ve nav footprint'i ayni bedeni temsil etmez. Kenarlarda havada durma,
duvara girme, yanlis sight ray yuksekligi ve authoring sirasinda tekrar eden
manuel senkron hatalari ortaya cikar.

---

## Mevcut Kod Kanitlari

- `engine/scene/capsule.ts`
  - `DEFAULT_CAPSULE_RADIUS = 0.3`
  - `DEFAULT_CAPSULE_HALF_HEIGHT = 0.9`
  - `resolveCapsuleDimensions(...)` full AABB size ve feet-at-origin center
    hesapliyor.
- `engine/scene/actorScript.ts`
  - `defaultCharacterComponents()` Character seed ederken Collider capsule'i
    `DEFAULT_CAPSULE_*` ile olusturuyor.
  - Ayni seed icinde `CharacterMovement` halen `capsuleRadius: 0.3` ve
    `capsuleHalfHeight: 0.9` yaziyor.
- `engine/scene/components.ts`
  - `readColliderComponent(...)` capsule Collider'dan radius, half-height, size
    ve center okuyor.
  - `readCharacterMovementComponent(...)` movement icinden ikinci kapsul
    degerlerini okuyor.
- `src/game/characterMovementSystem.ts`
  - Planar wall resolve fizik `colliderHalfExtents(runtime.id)` ile gercek
    collider half-extents kullanir.
  - Ground probe footprint bugun `runtime.movement.capsuleRadius` kullanir.
- `engine/ai/aiSubsystem.ts`
  - Sight trace point bugun `movement.capsuleHalfHeight * 1.25` kullanir.
- `engine/navigation/navAgentProfile.ts`
  - Nav Agent explicit `AIController.navAgent` degerlerini onceliklendirir.
  - Collider half-extents fallback'i movement capsule fallback'inden once gelir.
- `src/editor/ActorScriptEditor.ts`
  - CharacterMovement Details panelinde capsule radius / half-height alanlari
    halen gorunur ve kaydedilebilir.
  - Character compile uyarilari Character class icin CharacterMovement ve
    capsule Collider beklentisini bugun yalnizca uyari olarak ele alir.

---

## Hedef Sozlesme

### 1. Character capsule tek kaynaktir

`parentClass: "character"` icin ana fiziksel govde:

```text
Collider(shape: "capsule", isStatic: false, isSensor: false)
```

Bu Collider su yuzeyleri surer:

- Rapier rigid body / collider sekli.
- Static/dynamic blocker olarak diger karakterlere carpma.
- Sensor/overlap ve hit olaylari.
- CharacterMovement ground footprint ve wall resolve boyutu.
- AI sight trace/goz yuksekligi.
- Nav Agent size fallback'i.
- Editor viewport / preview capsule gosterimi.

### 2. CharacterMovement kapsul olcusu tasimaz

`CharacterMovement` fiziksel govde olcusu yerine yalnizca hareket davranisini
tasir:

- movement mode
- walk/sprint/jump/gravity/air control
- acceleration/braking/friction
- rotation rate ve orientation modlari
- max step up/down
- max slope angle
- uphill speed scale
- step smoothing

`capsuleRadius` ve `capsuleHalfHeight` bu component icin deprecated alanlar
olur. Ilk uygulama geriye donuk okur; yeni kayitlar bunlari yazmaz.

### 3. Character capsule kaldirilamaz invariant olur

Unreal benzeri beklenti:

```text
Character = Pawn + root Transform + required capsule Collider + MeshRenderer
          + CharacterMovement
```

Bu nedenle Character class'ta ana capsule Collider:

- default olarak gelir;
- Details panelinde olculeri duzenlenebilir;
- component listesinden kaldirilamaz;
- shape'i capsule disina cevrilemez;
- static/sensor olacak sekilde bozulamaz;
- varsa baska Collider'lar eklenebilir, ama ana Character capsule'in yerini
  alamaz.

Ortalama insan default'u bugunku Forge olceginde `radius: 0.3`,
`halfHeight: 0.9` olarak kalir. Daha iri AI karakterler `AI_Character` gibi
Collider capsule olcusunu buyutur; movement tarafinda ikinci bir kopya girmez.

---

## Onerilen Teknik Tasarim

### Ortak helper

Yeni veya mevcut capsule module'u uzerinden tek bir helper tanimlanmali:

```ts
resolveCharacterCapsule(entity): {
  radius: number;
  halfHeight: number;
  center: Vec3;
  halfExtents: Vec3;
  source: "collider" | "legacyMovement" | "default";
}
```

Beklenen oncelik:

1. Entity uzerindeki required non-sensor capsule Collider.
2. Sadece legacy dosyalar icin `CharacterMovement.capsuleRadius /
   capsuleHalfHeight`.
3. `DEFAULT_CAPSULE_RADIUS / DEFAULT_CAPSULE_HALF_HEIGHT`.

Not: Runtime collision resolve zaten `physics.colliderHalfExtents(id)` ile
fizik dunyasindaki sonucu okuyabiliyor. Helper'in amaci, ground footprint,
AI sight ve nav fallback gibi fizik backend'e dogrudan bagli olmayan hesaplari
ayni capsule sozlesmesine baglamak.

### Runtime kullanimlari

- `CharacterMovementSubsystem.footprintHalf(...)`
  - `runtime.movement.capsuleRadius` yerine resolved character capsule radius
    kullanir.
  - Physics query yoksa legacy/default fallback ile calismaya devam eder.
- `AISubsystem.sightTracePoint(...)`
  - Movement half-height yerine resolved capsule half-height/eye height kullanir.
  - Eye height formulu dokumante edilir. Ilk davranis korumasi icin
    `halfHeight * 1.25` korunabilir, ama kaynak collider olur.
- `resolveNavAgentProfile(...)`
  - Explicit `AIController.navAgent` yine en yuksek oncelik kalir.
  - Fallback olarak collider-derived size kullanilir.
  - Movement capsule fallback'i sadece legacy dosyalar icin gecici tutulur ve
    testle sabitlenir.

### Authoring kullanimlari

- `defaultCharacterComponents()`
  - CharacterMovement seed'inden `capsuleRadius` ve `capsuleHalfHeight` cikar.
  - Collider seed'i `DEFAULT_CAPSULE_*` ile kalir.
- `ActorScriptEditor`
  - CharacterMovement Details panelinden capsule fields kaldirilir.
  - Ana Character Collider icin Details UI'da "Character Capsule" olarak net bir
    alan kalir.
  - Required component silme / shape degistirme aksiyonlari disabled olur veya
    no-op + editor warning verir.
- Compile/validation
  - Character class required capsule Collider yoksa editor otomatik onarir veya
    save oncesi normalize eder.
  - CharacterMovement var ama Character/Pawn degilse mevcut uyari korunur.

### Data migration

Yeni save ciktisi:

```jsonc
{
  "component": "CharacterMovement",
  "props": {
    "maxWalkSpeed": 3,
    "movementMode": "walking",
    "maxStepHeight": 0.45
  }
}
```

Legacy input toleransi:

```jsonc
{
  "component": "CharacterMovement",
  "props": {
    "capsuleRadius": 1,
    "capsuleHalfHeight": 3
  }
}
```

Legacy alanlar:

- Runtime'da sadece fallback olarak okunur.
- Editor'de yeni kayitta yazilmaz.
- Save normalization sirasinda Character capsule Collider mevcutsa
  CharacterMovement icinden temizlenir.
- Character capsule Collider eksik legacy dosyada migration, movement capsule
  degerlerinden Collider olusturabilir.

---

## Faz Plani

### Faz 0 - Baseline ve test kapsami

- [x] `AI_Character.actor.json` ve `AI_Test.actor.json` mevcut split degerleri
      test fixture olarak incelensin.
- [x] `readColliderComponent(...)`, `readCharacterMovementComponent(...)`,
      `defaultCharacterComponents()` ve ActorScriptEditor Details alanlari icin
      mevcut davranis snapshot'i yazilsin.
- [x] Ground footprint, AI sight height ve nav fallback icin ayrismayi gosteren
      negatif test eklensin.

### Faz 1 - Ortak capsule contract

- [x] `engine/scene/capsule.ts` veya yakin bir scene helper modulu altinda
      `resolveCharacterCapsule(...)` ekle.
- [x] Helper non-sensor capsule Collider'i onceliklendirsin.
- [x] Legacy movement capsule fallback'i testle sinirlansin.
- [x] Default fallback `DEFAULT_CAPSULE_*` ile gelsin.

### Faz 2 - Runtime sistemlerini collider source'a bagla

- [x] `CharacterMovementSubsystem.footprintHalf(...)` collider-derived radius
      kullansin.
- [x] `AISubsystem.sightTracePoint(...)` collider-derived half-height kullansin.
- [ ] Nav profile input zinciri explicit `AIController.navAgent` kararini
      bozmadan collider fallback'i tek kaynaga baglasin.
- [ ] Wall resolve icin mevcut `physics.colliderHalfExtents(id)` kullanimi
      korunup testle sabitlensin.

### Faz 3 - Actor Script authoring ve invariant

- [x] `defaultCharacterComponents()` CharacterMovement seed'inden capsule
      alanlarini kaldirsin.
- [x] Character seed Collider'i `DEFAULT_CAPSULE_*` ile kalmaya devam etsin.
- [x] ActorScriptEditor CharacterMovement Details panelinden capsule alanlari
      kaldirilsin.
- [ ] Character ana capsule Collider silme/shape degistirme/static/sensor
      bozulmalarina karsi editor invariant eklensin.
- [ ] Character compile warnings "eksik required capsule" durumunu sadece uyari
      degil, onarilabilir invariant olarak ele alsin.

### Faz 4 - Save normalization ve starter content migration

- [ ] `/__save-actor` akisi `normalizeActorScriptDef(...)` uzerinden yeni
      contract'a uygun cikti uretsin.
- [ ] Character capsule Collider varsa CharacterMovement legacy capsule alanlari
      save payload'undan temizlensin.
- [ ] Character capsule Collider eksik ama legacy movement capsule varsa
      migration Collider olustursun.
- [ ] `AI_Character.actor.json`, `AI_Test.actor.json` ve starter Player
      scriptleri yeni formata tasinsin.
- [ ] Manifest/check assets akisinda yeni veri kaybi olmadigi dogrulansin.

### Faz 5 - Editor/browser smoke ve dokuman kapanisi

- [ ] `?editor` Actor Script editor'de Character class acilip required capsule
      gorunur ve CharacterMovement'te capsule fields yok dogrulansin.
- [ ] AI_Character Play modunda ground, wall, sight ve nav davranisi regrese
      etmeden calissin.
- [ ] `docs/architecture/UNREAL_BASICS_LESSONS.md` ilgili CharacterMovement
      kararina yeni "capsule source of truth" notu eklensin.
- [ ] Bu plan uygulaninca `docs/COMPLETED_WORK_INDEX.md` uzerinden izlenen completed-work archive altina tasinsin veya checklist
      tamamlandi olarak isaretlensin.

---

## Test ve Dogrulama Kapilari

Kod degisikligi yapilan her slice icin:

```powershell
npx.cmd tsc --noEmit
npm.cmd run test:engine
npm.cmd run build:verify
```

UI/editor slice'lari icin ek olarak Playwright onerilir:

- `?editor` Actor Script Details smoke.
- CharacterMovement Details'te capsule alanlarinin yoklugu.
- Character Collider alanlarinin gorunmesi ve required component davranisi.
- Play modunda AI_Character hareket/sight smoke.

Bu is `save/load validation`, actor asset normalization ve authored runtime data
contract'ina dokundugu icin uygulama tamamlandiginda Codex Security diff scan
icin uygun kapsam:

```text
Actor Script save/load + starter-content asset migration diff
```

Scan sessiz calistirilmeyecek; uygulama bittikten sonra kullanici onayi ile
baslatilmali.

---

## Kabul Kriterleri

- Yeni Character Actor Script olusturuldugunda capsule Collider varsayilan gelir.
- Character ana capsule Collider kaldirilamaz veya non-capsule hale getirilemez.
- CharacterMovement Details paneli capsule radius / half-height istemez.
- Runtime ground footprint, AI sight height ve nav fallback ayni Collider
  capsule olcusunden turetilir.
- `AI_Character` gibi buyuk karakterlerde sadece Collider capsule olcusu
  degistirilerek fizik, hareket ve AI tutarli kalir.
- Eski Actor Script dosyalari acilir; legacy movement capsule alanlari veri
  kaybi yaratmadan yeni Collider contract'ina migrate edilir.
