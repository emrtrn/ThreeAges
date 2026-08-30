/**
 * Guard firebrands — the short-range burning torch a melee unit hurls at an
 * enemy building instead of stabbing it.
 *
 * Same split as {@link ProjectileSystem}: `unitCombat` has already applied the
 * damage by the time a firebrand is spawned, so this is presentation only. What
 * the player must read is "the Guard is setting that building on fire", and a
 * lobbed torch that flares against the wall says it.
 *
 * It is deliberately not a second tracer type inside `projectileSystem`: an
 * arrow is a straight fast line with one shared material per team, while this
 * lobs, flickers, tumbles and then burns down at the impact point, which needs
 * per-instance materials. Those are pooled rather than allocated per throw — a
 * besieging crowd of Guards throws continuously.
 */
import {
  AdditiveBlending,
  Box3,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Texture,
  TextureLoader,
  Vector3,
} from "three";

/** World units/s. A thrown torch is heavy — visibly slower than an arrow. */
const THROW_SPEED = 11;
/**
 * A Guard stands at its melee range from the wall, so an honestly timed throw
 * would be over in a couple of frames. The floor is what makes a point-blank
 * lob readable at all; the arc is what makes it read as *thrown* rather than
 * swung.
 */
const MIN_FLIGHT_SECONDS = 0.34;
const MAX_FLIGHT_SECONDS = 0.9;
/** Peak lift above the straight line, as a share of the throw distance. */
const ARC_RATIO = 0.55;
/** Minimum lift, so a very short throw still visibly goes up and comes down. */
const MIN_ARC = 0.7;
/** Height the torch leaves the Guard's hand at. */
export const FIREBRAND_LAUNCH_HEIGHT = 1.15;
/** How long the flame burns at the impact point after it lands. */
const BURN_SECONDS = 0.55;

const TORCH_LENGTH = 0.95;
const TORCH_FLAME_FORWARD = TORCH_LENGTH * 0.42;

/**
 * Fire is fire for both kingdoms. Ownership is already readable from the Guard
 * that threw it and from the building it lands on, and tinting a flame in team
 * colours would cost it the one thing it has to communicate.
 */
const FLAME_COLOR = "#fff0bd";

export type FirebrandImpactHandler = (effectId: string | null, position: Vector3) => void;

interface Firebrand {
  readonly group: Group;
  readonly torch: Object3D;
  /** A small cross-plane sampling one frame of the shared fire flipbook. */
  readonly flame: Mesh<PlaneGeometry, MeshBasicMaterial>;
  readonly flameMaterial: MeshBasicMaterial;
  readonly from: Vector3;
  readonly to: Vector3;
  /** Peak lift of this throw's parabola; re-derived from range on every reuse. */
  arc: number;
  duration: number;
  /** Flight time so far; once it passes {@link duration} the flame burns down. */
  elapsed: number;
  burn: number;
  impactEffectId: string | null;
}

/** Centre and orient the authored torch for pooled flight instances. */
function fitTorchModel(template: Object3D): Object3D {
  const holder = new Group();
  const model = template.clone(true);
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const largest = Math.max(size.x, size.y, size.z);
  const scale = largest > 0 ? TORCH_LENGTH / largest : 1;
  const center = bounds.getCenter(new Vector3());
  model.scale.multiplyScalar(scale);
  model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  // This prop's handle is +Y. Rotate it so its burning head (-Y) faces the
  // group's flight direction (-Z after `lookAt`) instead of appearing inverted.
  model.rotateX(Math.PI / 2);
  model.traverse((child) => {
    if (child instanceof Mesh) {
      child.castShadow = true;
      child.receiveShadow = false;
    }
  });
  holder.add(model);
  return holder;
}

export class FirebrandSystem {
  readonly root = new Group();
  private readonly live: Firebrand[] = [];
  /** Spent torches, kept whole (meshes + materials) for the next throw. */
  private readonly pool: Firebrand[] = [];
  private readonly scratchAhead = new Vector3();
  private impactHandler: FirebrandImpactHandler | null = null;
  private torchTemplate: Object3D | null = null;
  private flameTexture: Texture | null = null;
  private flameTextureUrl: string | null = null;

  constructor() {
    this.root.name = "rts-firebrands";
  }

  /** Use an authored, unlit torch prop as the thrown body. */
  setTorchModel(template: Object3D | null): void {
    this.torchTemplate = template ? fitTorchModel(template) : null;
    this.clear();
    for (const brand of this.pool) {
      brand.flameMaterial.dispose();
      brand.flame.geometry.dispose();
    }
    this.pool.length = 0;
  }

  /**
   * Bind the same 6x6 fire flipbook the authored particle effects use.
   *
   * The image is shared across every pooled torch. Individual planes change UVs,
   * not texture offsets, so one torch's animation cannot alter another's frame.
   */
  setFlameTextureUrl(url: string | null): void {
    if (url === this.flameTextureUrl) return;
    this.flameTextureUrl = url;
    this.flameTexture?.dispose();
    this.flameTexture = null;
    this.applyFlameTexture(null);
    if (!url) return;
    new TextureLoader().load(url, (texture) => {
      if (this.flameTextureUrl !== url) {
        texture.dispose();
        return;
      }
      texture.flipY = false;
      texture.needsUpdate = true;
      this.flameTexture = texture;
      this.applyFlameTexture(texture);
    });
  }

  /** Play an authored, data-selected burst on the frame the torch reaches its target. */
  setImpactHandler(handler: FirebrandImpactHandler | null): void {
    this.impactHandler = handler;
  }

  /**
   * Throw one torch from an attacker onto a point on its target.
   *
   * `to` is the impact point in full world space — the caller aims it, because
   * only the caller knows the target's footprint. A zero-length throw is
   * dropped: it has nothing to animate, and it would divide by zero below.
   */
  spawn(from: Vector3, to: Vector3, impactEffectId: string | null = null): void {
    const start = new Vector3(from.x, from.y + FIREBRAND_LAUNCH_HEIGHT, from.z);
    const end = to.clone();
    const distance = start.distanceTo(end);
    if (distance < 0.01) return;
    const brand = this.pool.pop() ?? this.create();
    brand.from.copy(start);
    brand.to.copy(end);
    brand.arc = Math.max(MIN_ARC, distance * ARC_RATIO);
    brand.duration = Math.min(MAX_FLIGHT_SECONDS, Math.max(MIN_FLIGHT_SECONDS, distance / THROW_SPEED));
    brand.elapsed = 0;
    brand.burn = 0;
    brand.impactEffectId = impactEffectId;
    brand.group.position.copy(start);
    // A recycled torch may still wear its impact scale; reset it before flight.
    brand.torch.visible = true;
    brand.flame.visible = true;
    brand.flame.scale.setScalar(1);
    brand.flameMaterial.opacity = 0.95;
    this.root.add(brand.group);
    this.live.push(brand);
  }

  update(dt: number): void {
    const step = Math.max(0, dt);
    for (let i = this.live.length - 1; i >= 0; i -= 1) {
      const brand = this.live[i]!;
      if (brand.elapsed < brand.duration) {
        brand.elapsed += step;
        if (brand.elapsed < brand.duration) {
          this.advanceFlight(brand);
          continue;
        }
        this.advanceFlight(brand);
        this.impactHandler?.(brand.impactEffectId, brand.to);
      }
      brand.burn += step;
      if (brand.burn >= BURN_SECONDS) {
        this.recycle(i);
        continue;
      }
      this.advanceBurn(brand);
    }
  }

  /** Drop every flame in the air or on a wall — a restart has no fire to show. */
  clear(): void {
    for (let i = this.live.length - 1; i >= 0; i -= 1) this.recycle(i);
  }

  dispose(): void {
    this.clear();
    this.impactHandler = null;
    for (const brand of this.pool) {
      brand.flameMaterial.dispose();
      brand.flame.geometry.dispose();
    }
    this.pool.length = 0;
    this.flameTexture?.dispose();
    this.flameTexture = null;
  }

  /** Travel the parabola, face the direction of travel, and flicker. */
  private advanceFlight(brand: Firebrand): void {
    const progress = Math.min(1, brand.elapsed / brand.duration);
    this.positionAt(brand, progress, brand.group.position);
    // Aiming slightly ahead on the same curve keeps the tail trailing correctly
    // through the top of the arc, where the direction of travel flips.
    const ahead = this.positionAt(brand, Math.min(1, progress + 0.05), this.scratchAhead);
    if (ahead.distanceToSquared(brand.group.position) > 1e-6) brand.group.lookAt(ahead);
    // The flipbook supplies the flame shape; the tiny scale/opacity variation
    // keeps several torches from advancing in lockstep.
    const flicker = 1 + Math.sin(brand.elapsed * 47) * 0.14;
    brand.flame.scale.setScalar(flicker);
    brand.flameMaterial.opacity = 0.82 + Math.sin(brand.elapsed * 31 + 1.3) * 0.13;
    this.setFlameFrame(brand, Math.floor(brand.elapsed * 24) % 36);
  }

  /** Keep the flipbook flame with the embedded torch while the impact burst fades. */
  private advanceBurn(brand: Firebrand): void {
    const progress = brand.burn / BURN_SECONDS;
    brand.flame.scale.setScalar(1 + progress * 0.45);
    brand.flameMaterial.opacity = Math.max(0, 0.9 * (1 - progress));
    this.setFlameFrame(brand, Math.floor((brand.elapsed + brand.burn) * 24) % 36);
  }

  /** Point on the throw's parabola at `progress` in 0..1, written into `out`. */
  private positionAt(brand: Firebrand, progress: number, out: Vector3): Vector3 {
    out.lerpVectors(brand.from, brand.to, progress);
    out.y += Math.sin(progress * Math.PI) * brand.arc;
    return out;
  }

  private recycle(index: number): void {
    const brand = this.live[index]!;
    this.root.remove(brand.group);
    this.live.splice(index, 1);
    this.pool.push(brand);
  }

  private applyFlameTexture(texture: Texture | null): void {
    for (const brand of [...this.live, ...this.pool]) {
      brand.flameMaterial.map = texture;
      brand.flameMaterial.needsUpdate = true;
    }
  }

  /** Maps an animated frame into this brand's independent plane UVs. */
  private setFlameFrame(brand: Firebrand, frame: number): void {
    const frameIndex = ((frame % 36) + 36) % 36;
    const column = frameIndex % 6;
    const row = Math.floor(frameIndex / 6);
    const unit = 1 / 6;
    const uv = brand.flame.geometry.getAttribute("uv");
    uv.setXY(0, column * unit, (row + 1) * unit);
    uv.setXY(1, (column + 1) * unit, (row + 1) * unit);
    uv.setXY(2, column * unit, row * unit);
    uv.setXY(3, (column + 1) * unit, row * unit);
    uv.needsUpdate = true;
  }

  private create(): Firebrand {
    const group = new Group();
    const flameMaterial = new MeshBasicMaterial({
      color: FLAME_COLOR,
      map: this.flameTexture,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
    });
    const torch = this.torchTemplate
      ? this.torchTemplate.clone(true)
      : new Group();
    const flame = new Mesh(new PlaneGeometry(0.68, 0.92), flameMaterial);
    flame.position.z = -TORCH_FLAME_FORWARD;
    group.add(torch, flame);
    return {
      group,
      torch,
      flame,
      flameMaterial,
      from: new Vector3(),
      to: new Vector3(),
      arc: MIN_ARC,
      duration: MIN_FLIGHT_SECONDS,
      elapsed: 0,
      burn: 0,
      impactEffectId: null,
    };
  }
}
