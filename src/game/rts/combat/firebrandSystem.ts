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
  ConeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
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
const LAUNCH_HEIGHT = 1.15;
/** How long the flame burns at the impact point after it lands. */
const BURN_SECONDS = 0.55;

const CORE_RADIUS = 0.15;
const HALO_RADIUS = 0.32;
const TAIL_RADIUS = 0.17;
const TAIL_LENGTH = 0.8;

/**
 * Fire is fire for both kingdoms. Ownership is already readable from the Guard
 * that threw it and from the building it lands on, and tinting a flame in team
 * colours would cost it the one thing it has to communicate.
 */
const CORE_COLOR = "#fff0bd";
const HALO_COLOR = "#ff7a1c";
const TAIL_COLOR = "#ff9c2c";

interface Firebrand {
  readonly group: Group;
  readonly core: Mesh;
  readonly tail: Mesh;
  readonly halo: Mesh;
  readonly coreMaterial: MeshBasicMaterial;
  readonly tailMaterial: MeshBasicMaterial;
  readonly haloMaterial: MeshBasicMaterial;
  readonly from: Vector3;
  readonly to: Vector3;
  /** Peak lift of this throw's parabola; re-derived from range on every reuse. */
  arc: number;
  duration: number;
  /** Flight time so far; once it passes {@link duration} the flame burns down. */
  elapsed: number;
  burn: number;
}

export class FirebrandSystem {
  readonly root = new Group();
  private readonly live: Firebrand[] = [];
  /** Spent torches, kept whole (meshes + materials) for the next throw. */
  private readonly pool: Firebrand[] = [];
  private readonly coreGeometry: BufferGeometry = new IcosahedronGeometry(CORE_RADIUS, 0);
  private readonly haloGeometry: BufferGeometry = new SphereGeometry(HALO_RADIUS, 8, 6);
  private readonly tailGeometry: BufferGeometry;
  private readonly scratchAhead = new Vector3();

  constructor() {
    this.root.name = "rts-firebrands";
    // Built pointing down -Z with its tip at the origin, so the cone trails
    // behind a group whose +Z faces the direction of travel.
    const tail = new ConeGeometry(TAIL_RADIUS, TAIL_LENGTH, 6, 1, true);
    tail.rotateX(Math.PI / 2);
    tail.translate(0, 0, -TAIL_LENGTH / 2);
    this.tailGeometry = tail;
  }

  /**
   * Throw one torch from an attacker onto a point on its target.
   *
   * `to` is the impact point in full world space — the caller aims it, because
   * only the caller knows the target's footprint. A zero-length throw is
   * dropped: it has nothing to animate, and it would divide by zero below.
   */
  spawn(from: Vector3, to: Vector3): void {
    const start = new Vector3(from.x, from.y + LAUNCH_HEIGHT, from.z);
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
    brand.group.position.copy(start);
    // A recycled torch still wears the flare-out scale it died at; the flight
    // update overwrites these, but a fresh throw must not depend on that order.
    brand.core.scale.setScalar(1);
    brand.halo.scale.setScalar(1);
    brand.tail.scale.setScalar(1);
    brand.tail.visible = true;
    brand.core.visible = true;
    brand.coreMaterial.opacity = 1;
    brand.tailMaterial.opacity = 0.75;
    brand.haloMaterial.opacity = 0.55;
    this.root.add(brand.group);
    this.live.push(brand);
  }

  update(dt: number): void {
    const step = Math.max(0, dt);
    for (let i = this.live.length - 1; i >= 0; i -= 1) {
      const brand = this.live[i]!;
      if (brand.elapsed < brand.duration) {
        brand.elapsed += step;
        this.advanceFlight(brand);
        continue;
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
    for (const brand of this.pool) {
      brand.coreMaterial.dispose();
      brand.tailMaterial.dispose();
      brand.haloMaterial.dispose();
    }
    this.pool.length = 0;
    this.coreGeometry.dispose();
    this.haloGeometry.dispose();
    this.tailGeometry.dispose();
  }

  /** Travel the parabola, face the direction of travel, and flicker. */
  private advanceFlight(brand: Firebrand): void {
    const progress = Math.min(1, brand.elapsed / brand.duration);
    this.positionAt(brand, progress, brand.group.position);
    // Aiming slightly ahead on the same curve keeps the tail trailing correctly
    // through the top of the arc, where the direction of travel flips.
    const ahead = this.positionAt(brand, Math.min(1, progress + 0.05), this.scratchAhead);
    if (ahead.distanceToSquared(brand.group.position) > 1e-6) brand.group.lookAt(ahead);
    // Cheap deterministic flicker: a torch that pulses reads as burning rather
    // than as a glowing pebble, and it costs one sine per frame.
    const flicker = 1 + Math.sin(brand.elapsed * 47) * 0.14;
    brand.core.scale.setScalar(flicker);
    brand.halo.scale.setScalar(1 + Math.sin(brand.elapsed * 31 + 1.3) * 0.12);
    brand.tail.scale.set(1, 1, 0.8 + flicker * 0.3);
    brand.core.rotation.x += 0.35;
    brand.core.rotation.z += 0.27;
  }

  /** Flare out at the impact point: the halo swells and fades, the torch is gone. */
  private advanceBurn(brand: Firebrand): void {
    const progress = brand.burn / BURN_SECONDS;
    brand.tail.visible = false;
    brand.core.visible = progress < 0.45;
    brand.coreMaterial.opacity = Math.max(0, 1 - progress * 2.4);
    brand.halo.scale.setScalar(1 + progress * 2.2);
    brand.haloMaterial.opacity = 0.55 * (1 - progress);
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

  private create(): Firebrand {
    const group = new Group();
    const coreMaterial = new MeshBasicMaterial({ color: CORE_COLOR, transparent: true, depthWrite: false });
    const tailMaterial = new MeshBasicMaterial({
      color: TAIL_COLOR,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const haloMaterial = new MeshBasicMaterial({
      color: HALO_COLOR,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const core = new Mesh(this.coreGeometry, coreMaterial);
    const tail = new Mesh(this.tailGeometry, tailMaterial);
    const halo = new Mesh(this.haloGeometry, haloMaterial);
    group.add(core, tail, halo);
    return {
      group,
      core,
      tail,
      halo,
      coreMaterial,
      tailMaterial,
      haloMaterial,
      from: new Vector3(),
      to: new Vector3(),
      arc: MIN_ARC,
      duration: MIN_FLIGHT_SECONDS,
      elapsed: 0,
      burn: 0,
    };
  }
}
