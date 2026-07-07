# AI Yükseklik-Farkında Navigasyon (Merdiven/Rampa ile Y Ekseni) Planı

> Tarih: 2026-07-07
> Durum: KESIN KOK NEDEN bulundu ve COZULDU. Gercek Playground sahnesinde
> yukseltilmis (rampa uzeri) Target Point'e ulasilamamasinin sebebi: agent
> yaricapi authored `navAgent` yerine olceksiz collider'dan (r=1.0) turetiliyordu
> ve dar rampayi grid'den asindiriyordu. Fix: `resolveNavAgentProfile` authored
> navAgent'a oncelik verir; runtime'da path artik `success` (r=0.350). Ayrica
> endpoint projeksiyonu eklendi. Kalan: nav volume yuksekligi uyarisi (A) ve
> otomatik browser smoke.
> Kapsam: AI patrol/moveTo yol bulmasının Y ekseninde (merdiven/rampa ile
> ulaşılan yükseltilmiş target point'ler) çalışması.

## Problem

Sahnede birbirine bağlı target point'ler düz zeminde takip ediliyor. Ancak
noktalardan biri merdivenle çıkılabilen bir yüksekliğe konduğunda AI bir önceki
noktada takılıp kalıyor (stuck-recovery sonrası pes ediyor).

## Kök neden (doğrulandı)

Sorun **hareket** değil, **yol bulma** katmanında. İki katman ayrı çalışıyor:

- **Hareket sistemi Y eksenini zaten hallediyor.**
  `src/game/characterMovementSystem.ts` her frame zemin probing yapıyor
  (`findGroundAt`, `src/game/collision.ts`), `staticSurfaceTriangles`
  (merdiven/rampa üçgenleri) + `maxStepHeight` ile step-up uygulayarak karakteri
  basamaklara çıkarıyor. Merdiven collider'ı `complexAsSimple` trimesh
  (`SM_LinearStair.collision.json` → `complexity: "complexAsSimple"`), yani
  basamaklar yürünebilir yüzey olarak zaten mevcut. **AI merdivenin üstüne
  yönlendirilirse, çıkar.**

- **Yol bulma tek Y düzleminde planlıyor.**
  `engine/navigation/gridNavigation.ts` → `buildNavGrid` grid'i
  `footY = start[1]` tek düzleminde kuruyor; tüm ara hücreler bu yükseklikte.
  Sonuç:
  - Merdiven (trimesh → basamak başına AABB) alçak `footY`'de **dikey engel**
    sayılıyor → grid merdivenin etrafından dolanıyor veya önünde tıkanıyor.
  - Üst platformdaki hedef noktanın X/Z'si alçak grid'e izdüşürülünce
    **platformun altındaki zemine** denk geliyor. `advanceWaypoint` yalnızca X/Z
    mesafesine baktığı için AI "vardım" sanıp platform altında kalıyor ya da bir
    önceki noktada takılıp pes ediyor.

Yani grid dikey geçişi (merdiveni) hiç temsil etmiyor ve üst seviyeyi engel gibi
görüyor.

## Çözüm yaklaşımı: yükseklik-farkında (2.5D heightfield) nav grid

Grid'i düz düzlemden, **hücre başına zemin yüksekliği** taşıyan bir yükseklik
alanına (heightfield) çeviriyoruz. Her X/Z hücresi kendi `floorY`'sini tutar;
komşu hücreler arası geçiş yalnızca **yükseklik farkı ≤ step height** (veya
yürünebilir rampa/basamak) ise açıktır. Böylece merdiven, alçak zeminden üst
platforma **artan yükseklikli bir hücre zinciri** olarak doğal biçimde bağlanır;
yol noktaları gerçek Y'yi taşır; AI basamaklara yönlenir ve mevcut hareket
sistemi onu yukarı taşır.

Mevcut `findGroundAt` / `staticSurfaceTriangles` altyapısını yeniden kullandığı
için mimariye oturuyor. (Recast tarzı tam navmesh veya jump-link'ler aşırı kaçar;
şimdilik gerekmez.)

## Somut değişiklikler

### 1. Engine — `engine/navigation/gridNavigation.ts`
- `NavGrid`'e `floorY: Float32Array` (hücre başına yürünebilir yükseklik) ekle.
- `buildNavGrid`'e opsiyonel `sampleFloorY(x, z) => number | null` kancası ver.
  Kanca yoksa eski davranış (düz `footY`) aynen korunur — geriye dönük uyumlu.
- Komşu genişletmesinde bağlantı kuralı: A→B geçişi ancak
  `B.floorY − A.floorY ≤ stepHeight` (çıkış) ve
  `A.floorY − B.floorY ≤ maxStepDown` (iniş) ise geçerli. Diyagonalde ortogonal
  hücrelerin yüksekliği de kontrol edilir.
- Dikey engel testini (`blocksAgentVertically` / `pointBlocked`) tek `footY`
  yerine **her hücrenin `floorY`'sine göre** değerlendir — böylece üst platformun
  altı alçak hücreyi bloklamaz, üst kattaki duvar ise üst hücreyi bloklar.
- Yol noktaları hücre `floorY`'sini kullanır (son nokta hedefin gerçek Y'si).

### 2. Engine/game sınırı — yükseklik örnekleyici
- `engine/navigation` saf olmalı (game import edemez), ama `findGroundAt`
  `src/game/collision.ts`'te. İki seçenek:
  - (a) Saf geometri örnekleyiciyi (`sampleTriangleHeight` + AABB-top) `engine/`'e
    taşıyıp DRY yapmak.
  - (b) **Host'un `sampleFloorY` kancasını sağlaması** (RuntimeSceneApp her ikisini
    de import ediyor).
- Öneri: (b) ile başla (sınırı temiz tutar), gerekirse sonra (a)'ya çıkar.

### 3. Runtime — `src/scene/RuntimeSceneApp.ts` (`buildAiPath`)
- `sampleFloorY`'yi `staticSurfaceTriangles()` + `staticBlockerAabbs()` üzerinden,
  volume'ün dikey aralığında en yüksek yürünebilir yüzeyi bulacak şekilde besle
  (step-cap'siz bir `findGroundAt` varyantı).
- Bake cache token'ı zaten blocker+bounds revizyonunu kapsıyor; heightfield da
  onunla invalidate olur. `footY` bucket'ı önemini yitirir (yükseklikler hücre
  başına).
- Nav volume'ün her iki katı da dikey olarak kapsayacak kadar **yüksek olması**
  gerekir (dokümante et).

### 4. Editör overlay (bonus) — `engine/render-three/aiNavigationView.ts` + `src/scene/SceneApp.ts`
- Yeşil yürünebilir-dolgu artık her hücreyi kendi `floorY`'sinde çizerek
  merdiven/platformu **kademeli yeşil yüzey** olarak gösterir — görsel doğrulama.

## Kenar durumlar / sınırlar
- **Tek yükseklik/hücre:** üst üste binen katlar (bir yolun üstünden geçen köprü)
  desteklenmez. Kullanıcının senaryosu (merdivenle çıkılan platform) desteklenir.
  İleride çok-katmanlı grid gerekebilir.
- **Boşluk/atlama:** grid yalnızca step-height ile bağlar; uçurum atlama için
  ayrıca off-mesh/jump-link gerekir (kapsam dışı).
- **Dik merdiven:** basamak yüksekliği `maxStepHeight`'ı aşarsa bağlanmaz (doğru
  davranış; rampa/daha alçak basamak gerekir).

## Açık soru
- Hedef nokta bağlantıları **tek bir ajan profili** için mi, yoksa farklı
  boy/step-height'lı ajanlar da olacak mı? Bu, heightfield'in ajan-başına mı yoksa
  paylaşılan mı bakeleneceğini etkiler. (Mevcut `NavGridCache` zaten ajan-profili
  başına anahtarlıyor; heightfield bağlantı eşiği step-height'a bağlı olduğu için
  farklı step-height'lı ajanlar ayrı grid ister.)

## Aşamalar (her biri build-geçer)
1. **Engine:** per-cell `floorY` + `sampleFloorY` kancası + step/slope bağlantısı.
   Sentetik merdiven heightfield'ı ile unit test. (Kanca yokken düz davranış aynen
   korunur — mevcut parite testleri bozulmaz.)
   - Durum: Tamamlandi. `NavGrid.floorY`, opsiyonel `sampleFloorY`, yukseklik
     farki komsu kapisi ve sentetik heightfield testleri eklendi.
2. **Runtime:** `sampleFloorY`'yi game collision yüzeylerinden bağla; merdivenle
   yükseltilmiş hedef noktaya patrol'ü doğrula.
   - Durum: Kismen tamamlandi. Runtime bake artik `findGroundAt` +
     `staticSurfaceTriangles()` uzerinden heightfield ornekliyor; sahne ustu
     patrol smoke testi sonraki cila asamasinda kaldi.
3. **Editör overlay:** dolguyu gerçek yüksekliklerde çiz (görsel teyit). Opsiyonel.
   - Durum: Tamamlandi. Walkable-cell fill artik `NavGrid.floorY` ile ciziliyor;
     editor preview bake `sampleFloorY` kancasi kullaniyor.
4. **Cila:** üst-kat duvarları için yükseklik-farkında engel occupancy; smoke
   testi (yükseltilmiş target point'e ulaşan controller, "failure" yok).
   - Durum: Kismen tamamlandi. 2026-07-07 runtime follower kabul kapisi
     yukseklik-farkinda yapildi: `advanceWaypoint`, `requestAiMove` erken success
     ve mevcut hedef karsilastirmasi artik yalniz X/Z degil 3B mesafe kullanir.
     Bu, AI'in target point X/Z'sine vardim sanip rampadaki/ust kattaki hedefi
     erken tamamlamasini engeller.
   - Durum: Tamamlandi. 2026-07-07 nav grid shortcut/segment guvenligi
     height-aware yapildi: path compression artik blocker X/Z kesismesinde
     segmentin Y araligini ve ajan kapsul yuksekligini de kontrol eder. Alt
     kattaki blocker ust-kat segmentini, ust kattaki blocker alt-kat segmentini
     gereksiz bloklamaz. Engine regresyon testi eklendi.
   - Durum: Tamamlandi. 2026-07-07 endpoint projeksiyonu eklendi:
     `searchNavGrid` artik start/goal'u en yakin yurunebilir hucreye projekte
     ediyor (Unreal `ProjectPointToNavigation` karsiligi, `projectEndpoint`).
     Projeksiyon yukseklik-farkinda (3B en yakin) — platform kenarina konan bir
     target point'in mesh-disi/blocklu hucreye yuvarlanip tum sorguyu
     bozmasi engelleniyor; ust platformdaki hedef alttaki zemine degil platform
     hucresine snap oluyor. Rounded hucre zaten passable ise ham endpoint
     aynen korunur (duz-zemin davranisi degismez). Engine unit testleri eklendi.
   - Kok neden incelemesi (2026-07-07, gercek `SM_LinearStair` geometrisi +
     izole reproduksiyon ile): cekirdek height-aware pathing SAGLAM — merdiven
     riser'lari `staticBlockerAabbs`'e giriyor ama basamak yuksekligi (0.2m)
     stepHeight altinda oldugu ve zemin basamakla yukseldigi icin heightfield
     hucrelerini bloklamiyor; alt zemin -> merdiven -> ust platform patrol'u
     A*'da basariyla cikiyor; follower gercekci dikey adim-yumusatma gecikmesiyle
     bile variyor (kalici kilit yok). "Hedef 1'de yurume animasyonunda kalma"
     bir follower deadlock'u DEGIL.
   - **KESIN KOK NEDEN (2026-07-07, gercek Playground sahnesi runtime'inda `?debug`
     ve gecici diag ile dogrulandi):** `aiNavAgentForEntity`, AIController'da acikca
     authored `navAgent {radius:0.35, height:1.8}` olmasina ragmen bunlari yok
     sayip agent yaricapini/yuksekligini `physicsSubsystem.colliderHalfExtents`'ten
     turetiyordu. AI actor'unun kapsul collider'i `capsuleRadius:1, capsuleHalfHeight:3`
     olarak yazilmis ve actor placement scale'i (0.3) collider size'a bakilmadigindan
     agent **r=1.0, h=6.0** okunuyordu → clearance 1.25m. 2m genisligindeki rampa
     her iki taraftan asindirilinca ortada yurunebilir hucre kalmiyor → zemin ile
     rampa tepesi kopuk → A* `failure` → AI "ulasilamaz" goruyor. Duz acik zemindeki
     target (Y=0) genis oldugundan r=1 ile de calisiyor; bu yuzden semptom yalniz
     rampadaki/Y+ target'ta ortaya cikiyordu. (Runtime log: `agent r=1.000 h=6.00
     ... goalCell 1@0.82 ... status=failure` → fix sonrasi `r=0.350 ... status=success`.)
   - **Cozum:** nav-agent boyut cozumleme saf `resolveNavAgentProfile`'a cikarildi
     (`engine/navigation/navAgentProfile.ts`); oncelik Unreal Nav Agent semantigine
     uygun: authored `navAgent` radius/height > collider half-extents > movement
     kapsulu > sabit varsayilan. Actor'un olceksiz/asiri buyuk collider'i artik
     yalniz son care. Engine unit testleri + endpoint projeksiyonu (yukarida) eklendi.
   - **Yan bulgu (kapsam disi, latent):** actor-script collider'ina placement scale
     bakilmiyor; bu AI disinda fizik overlap/separation icin de collider'i ~3x buyuk
     birakir. Ileride scene-build'de actor collider scale bake edilmeli.
   - **Kalan acik:** (A) nav volume yuksekligi hala sessiz — volume maxY icindeki
     geometriyi kapsamazsa ust yuzeyler `null` ornekler; editorde/runtime'da uyari
     adayligi acik. Ve merdivenle erisilen yukseltilmis target'a controller ulasan
     otomatik browser smoke'u.

## Testler
- **Engine unit:** merdiven heightfield alçak→yüksek bağlanır; çok yüksek basamak
  bağlanmaz; rampa bağlanır; platformdaki hedef erişilebilir; düz sahnede eski
  parite bozulmaz; heightfield waypoint/goal kabulü X/Z yakinligi tek basina
  yeterli saymaz; heightfield segment shortcut alt/ust kat blocker ayrimini
  korur.
- **Smoke:** patrol sahnesine merdivenle erişilen yükseltilmiş target point →
  controller ulaşır ("failure" yok).

## Efor / risk
Orta. Ana risk hücre-başına occupancy doğruluğu ve engine/game sınırı; güçlü unit
testlerle azaltılır. Aşama 1+2 çekirdek değeri verir; 3–4 cila.

## İlgili kod
- `engine/navigation/gridNavigation.ts` — `buildNavGrid`, `searchNavGrid`,
  `NavGrid`, `NavGridCache` (bake katmanı, bkz.
  [AI_SYSTEM_RESEARCH_AND_PLAN.md](AI_SYSTEM_RESEARCH_AND_PLAN.md) Faz 3).
- `src/game/collision.ts` — `findGroundAt`, `filterWalkableBlockers`,
  `sampleTriangleHeight`, slope/step gate'leri.
- `src/game/characterMovementSystem.ts` — dikey hareket, step-up, ground probe.
- `src/scene/RuntimeSceneApp.ts` — `buildAiPath`, `aiNavigationBounds`,
  `aiNavAgentForEntity`.
- `engine/physics/physicsSubsystem.ts` — `staticSurfaceTriangles`,
  `staticBlockerAabbs`.
