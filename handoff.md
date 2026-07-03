# Handoff — P1 Fizik/Collision Sertleştirme (2026-07-02)

## GÜNCELLEME (aynı gün, sonraki oturum): fizik feel ×2

İki kullanıcı geri bildirimi daha uygulandı (detay: checklist Progress Log en
üstteki girdi):

1. **Max Step Down (merdiven inişi):** ground probe'un aşağı-snap eşiği artık
   CharacterMovement prop'u `maxStepDown` (varsayılan 0.2 → **0.5**; editörde
   "Max Step Down"). 50 cm'e kadar basamak inişi grounded kalır — küçük basamakta
   fall animasyonu tetiklenmez.
2. **Uphill slowdown (merdiven/rampa çıkışında yavaşlama):** yeni saf modül
   `src/game/uphillSlowdown.ts` + prop `uphillSpeedScale` (varsayılan **0.65** =
   45°+ tırmanışta hız çarpanı; 1 = kapalı; editörde "Uphill Speed Scale").
   Probe hedefinin kare-başı yükselişinden ölçülen eğim üstel filtreyle (τ=0.25s)
   yumuşatılıp planar hızı ölçekler; inişte/duruşta/havada hız geri gelir.

Dokunulan dosyalar: `engine/scene/components.ts`, `engine/scene/actorScript.ts`,
`src/editor/ActorScriptEditor.ts`, `src/game/uphillSlowdown.ts` (yeni),
`src/game/characterMovementSystem.ts`, `tools/engine-tests.ts`, checklist.
İki prop da free-form (save-validator allowlist gerekmez). Gate: engine 487→494,
`npm run build:verify` YEŞİL. Bu iş de henüz **commit'lenmedi** — aşağıdaki
"step-smoothing commit edilmeli" setiyle birlikte gider (autosave churn'ü yine
karıştırma).

## GÜNCELLEME (aynı gün, devam): P1.6 hareketli platform TAMAM

Hareketli platform fiziği uçtan uca eklendi (kinematik taşıyıcı + carry).
Tam detay: checklist P1.6 maddesi + Progress Log son girdi. Özet:

- **Saf çekirdek** `engine/physics/movingPlatform.ts` — ping-pong üçgen dalga,
  sabit hız, uçlarda temiz yön dönüşü (teleport yok).
- **`MovingPlatformSubsystem`** (`engine/physics/movingPlatformSubsystem.ts`) —
  platformu sürer, transform'u render+fizik sink'ine yazar, güncel dünya AABB +
  bu-frame delta'yı `platforms()` ile sunar. **Karakter hareketinden ÖNCE**
  register (RuntimeSceneApp) — carry frame gecikmesiz.
- **Tipli `MovingPlatform` component** (`offset`/`speed`/`startPhase`) —
  varlığı collider'ı **movable/kinematik** yapar → statik blocker cache'inden
  düşer. `LayoutPlacement.movingPlatform` + adapter (`colliderComponent`'e
  `movable` param) + `saveValidator` (`validateMovingPlatform`) + editör Details
  "Moving Platform" (yalnız instance) + snapshot cloning.
- **CharacterMovement** platformu blocker + zemin + **yatay carry** olarak
  tüketir; carry collision-resolve edilir; rising-platform yükselişi uphill
  ölçümünden çıkarılır (asansörde yavaşlama yok).
- Gate: engine 494→**500**, `build:verify` + `check:assets` YEŞİL. Bu iş de
  **commit'lenmedi**; feel + platform işi tek yeşil sette birlikte commit'lenebilir
  (autosave churn'ü hariç tut).
- **Sınırlar (backlog):** yalnız translation (dönme carry'si yok); >~6 u/s dikey
  platform step-smooth ease'ini aşabilir. P1 tamamen kapandı; sıradaki **P2**.

Bir sonraki oturumun (veya kişinin) kaldığı yerden devam edebilmesi için bu
oturumun özeti. Kanonik plan: [`docs/completed/PLATFORM_FOUNDATIONS_CHECKLIST.md`](docs/completed/PLATFORM_FOUNDATIONS_CHECKLIST.md)
(Progress Log en güncel durum). Mimari karar kaydı:
[`docs/architecture/UNREAL_BASICS_LESSONS.md`](docs/architecture/UNREAL_BASICS_LESSONS.md)
Progress Log (en üstteki 2026-07-02 girdisi).

## Bu oturumda ne yapıldı

Kullanıcı üç collision semptomu bildirdi; hepsinin kök nedeni bulundu ve çözüldü,
sonra bir feel (his) geri bildirimi geldi:

1. **Box-collision'lı modellerden geçme (#1) + boş yolda görünmez engel (#2) —
   aynı bug.** Hareket-blocker AABB türetimi placement **rotasyonunu yok
   sayıyordu**. Architecture duvarlarının collision pivotu köşede (`Wall_400x300`
   center offset `[2,1.5,0]`); duvar döndürülünce collider metrelerce kayıyordu.
   → Saf `engine/physics/rotatedBox.ts` + `physicsSubsystem` blocker türetimi
   artık `body.transform.rotation`'ı uyguluyor. **Karar:** AABB modeli korundu,
   off-axis şişme kabul; tam OBB backlog.
2. **Tünelleme guard'ı (P1.1).** `resolvePlanarMovementSubstepped` +
   `resolvePlanarMovement`'ta flush-temas float hassasiyeti `PENETRATION_EPSILON`
   ile giderildi (gizli latent bug'dı).
3. **Eğimde düz yürüme (#3, P1.3/P1.4).** **KARAR: Seçenek A (saf çekirdek)** —
   kullanıcı onayladı. Rampalar `complexAsSimple` (trimesh); fizik üçgenleri
   `staticSurfaceTriangles()` (rotasyon bake + `normalY`) ayrı kanaldan sunar;
   ground probe (`src/game/slopeSurface.ts` + `collision.ts`) gerçek eğim
   yüksekliğini interpolasyonla bulup slope limit uygular. Trimesh üçgeni >50°
   duvar/blocker, ≤50° yürünebilir yüzey. `maxSlopeAngleDeg` (45°) yeni
   CharacterMovement prop'u.
4. **Step-smoothing (feel geri bildirimi).** Merdiven step-up'ı tek frame'de
   snap edip kamerayı zıplatıyordu. `characterMovementSystem` grounded zemin
   takibi artık `approachHeight` ile `stepSmoothSpeed` (units/s, varsayılan 6)
   hızında yaklaşıyor; rampalar etkilenmiyor. Yeni free-form prop
   `stepSmoothSpeed` (editörde "Step Smooth Speed").

## Git durumu (ÖNEMLİ)

- **Commit `9cf1270`** ("feat: enhance collision resolution with substepped
  movement and slope support") = **P1.1–P1.4** (rotation + substep + slope).
  Kullanıcı test edip commit'ledi.
- **Commit'lenmemiş çalışma ağacı** iki şey karışık:
  - **Step-smoothing işi (commit edilmeli):** `engine/scene/components.ts`,
    `engine/scene/actorScript.ts`, `src/editor/ActorScriptEditor.ts`,
    `src/game/characterMovementSystem.ts`, `tools/engine-tests.ts`,
    `docs/ongoing/PLATFORM_FOUNDATIONS_CHECKLIST.md`.
  - **Dev-server autosave churn (COMMIT ETME):** `Playground.level.json`,
    `public/project.3dgame.json`, `Floor_400x400.collision.json`,
    `Script_PlayerCharacter.actor.json`, `UAL1_Standard_RM.skeleton.json`.
    Playground.level.json kullanıcının test odası+merdivenini de içeriyor; dev
    sunucusu default sahneyi otomatik yazıyor (bkz. memory
    `dev-server-autosaves-demo-layout`). Bunları step-smoothing commit'ine
    **karıştırma** — `git add` ile sadece kod/doküman dosyalarını seç.

## Doğrulama durumu

- `npm run build:verify` **YEŞİL** (tsc + vite build + **487 engine check** +
  strict dist scan PASS).
- `npm run check:assets` PASS (sadece önceden var olan alâkasız thumbnail
  WARN'ları).

## Kullanıcı için aksiyon notları

- **Eğimi görmek için:** rampa/eğimli yol asset'inin collision Complexity'sini
  Static Mesh editöründe **"Use Complex Collision As Simple"** yap. Box/tilt
  collision hâlâ düz-tepeli davranır.
- **Step-smoothing feel:** `stepSmoothSpeed` (varsayılan 6). Daha yumuşak için
  düşür (3–4); merdivende karakter geride kalıyorsa yükselt.

## Açık kalanlar / sıradaki

- **Step-smoothing gerilimi:** sabit-hız ease "pop'u öldür" vs "hızlı merdivende
  geride kalma" arasında gerilimli. Rahatsız ederse → Unreal-tarzı **kök
  collision anlık, sadece mesh+kamera görsel offset yumuşatma** ayrıştırmasına
  geç (RuntimeSceneApp render/kamera hattına dokunur, daha kapsamlı).
- **P1.5** — rampa/merdiven test gym'i (`CollisionGym.level.json` veya
  playground'a bölüm). Dikkat: gym'i default sahne yapma (autosave). Rampa için
  complexAsSimple bir ramp GLB gerekir (sanat asset'i).
- **P1.6** — hareketli platform: **TAMAM** (bu oturum).
- **P2 — Level Travel** (P1 tamamen bitti; sıradaki büyük faz).

## Anahtar dosyalar

- `engine/physics/rotatedBox.ts` — saf döndürülmüş-kutu dünya AABB'si.
- `src/game/slopeSurface.ts` — saf üçgen yüzey örnekleme (barycentric XZ, normalY,
  slope-cos).
- `src/game/collision.ts` — planar resolve + substep + ground probe (surfaces).
- `src/game/characterMovementSystem.ts` — dikey hareket + step-smoothing +
  uphill slowdown wiring.
- `src/game/uphillSlowdown.ts` — saf tırmanma eğimi ölçümü + hız çarpanı.
- `engine/physics/movingPlatform.ts` — saf ping-pong platform hareketi.
- `engine/physics/movingPlatformSubsystem.ts` — platform sürücüsü +
  `platforms()` query (AABB + carry delta); karakterden önce register.
- `engine/physics/physicsSubsystem.ts` — `staticBlockerAabbs` ve
  `staticSurfaceTriangles` + trimesh wall/surface sınıflandırması
  (`SURFACE_MAX_WALL_DEGREES = 50`).
