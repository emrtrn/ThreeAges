/**
 * Artillery cannonballs — the lobbed iron ball a Topçu throws at whatever it is
 * shooting, from well outside the range of the thing being shot at.
 *
 * Unlike {@link ProjectileSystem} and {@link FirebrandSystem}, this one is not
 * pure decoration trailing a blow that already landed: `unitCombat` holds the
 * gun's damage in a {@link PendingImpactQueue} for exactly the flight time
 * {@link CannonballSystem.spawn} returns, so the wall cracks when the ball
 * reaches it. What the player must read is "that gun is shelling the wall from
 * a hill the wall cannot answer", and a heavy arc that lands in a cloud of dust
 * says it — which only holds if the damage waits for the dust.
 *
 * Because it now gates damage, it is advanced on the simulation delta rather
 * than the rendered one: a shell freezes on pause and flies faster at 2x, in
 * step with the blow it is carrying.
 *
 * It is not a second tracer type inside `projectileSystem` for the same reason
 * the firebrand is not: an arrow is a straight fast line sharing one material
 * per team, while this arcs high, spins and drags smoke — which needs
 * per-instance materials. They are pooled rather than allocated per shot,
 * because a siege line fires continuously.
 *
 * What this class does *not* own is the burst at the far end. The blast used to
 * be two hand-built spheres here; it is now an authored particle effect named by
 * the firing unit (`impactEffect` in `balance/units.json`) and played through
 * the same VFX runtime as the buildings' damage slots, so the explosion can be
 * retuned in the effect editor without touching this file. All this system still
 * decides is *when* and *where* — it reports the landing through
 * {@link CannonballSystem.setImpactHandler}, on the frame the ball arrives.
 */
import {
  Box3,
  ConeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector3,
  type BufferGeometry,
} from "three";

/**
 * World units/s. Slower than an arrow (26) and faster than a thrown torch (11):
 * the flight is the window in which the defender can see the shell coming.
 */
const FLIGHT_SPEED = 19;
/** A shell always hangs in the air long enough to be read as one. */
const MIN_FLIGHT_SECONDS = 0.45;
const MAX_FLIGHT_SECONDS = 1.6;
/**
 * Peak lift above the straight line, as a share of the shot distance. Lower
 * than the torch's 0.55 — a gun is flatter than a throw — but high enough that
 * a full-range shot climbs several units and visibly comes back down.
 */
const ARC_RATIO = 0.24;
const MIN_ARC = 1.1;
/**
 * Height the ball leaves the barrel at on a wheeled gun; the barrel sits low on
 * the carriage. A gun mounted somewhere else — the Karakol's parapet — passes
 * its own height to {@link CannonballSystem.spawn}.
 */
const LAUNCH_HEIGHT = 0.95;

const BALL_RADIUS = 0.18;
const SMOKE_RADIUS = 0.16;
const SMOKE_LENGTH = 1.1;

/**
 * Iron is iron for both kingdoms, as fire is in {@link FirebrandSystem}:
 * ownership is already readable from the gun that fired and from the building
 * taking the hit, and a team-tinted cannonball would stop reading as metal.
 */
const BALL_COLOR = "#2f3438";
const SMOKE_COLOR = "#9c968c";

/**
 * Told where a shell just landed, and which authored effect that gun's shots
 * burst into. A null id is a gun whose data names no impact effect: the ball
 * still arrives and still deals its damage, it simply lands quietly.
 */
export type CannonballImpactHandler = (effectId: string | null, position: Vector3) => void;

interface Cannonball {
  readonly group: Group;
  /** The iron itself: the procedural stand-in, or a clone of the authored model. */
  readonly ball: Object3D;
  readonly smoke: Mesh;
  readonly smokeMaterial: MeshBasicMaterial;
  readonly from: Vector3;
  readonly to: Vector3;
  /** Peak lift of this shot's parabola; re-derived from range on every reuse. */
  arc: number;
  duration: number;
  /** Flight time so far; once it reaches {@link duration} the shell has landed. */
  elapsed: number;
  /** Authored burst for this shot, carried from the gun that fired it. */
  impactEffectId: string | null;
}

/**
 * Wrap an authored ball model so it tumbles about its own centre at the size the
 * shot needs to read at.
 *
 * The holder exists because the tumble writes `ball.rotation` directly: a model
 * whose geometry sits off its own origin would orbit that origin instead of
 * spinning, which reads as a shell wobbling on an invisible string. Recentring
 * inside a holder fixes that without touching the asset.
 */
function fitBallModel(template: Object3D): Object3D {
  const holder = new Group();
  const model = template.clone(true);
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const largest = Math.max(size.x, size.y, size.z);
  const scale = largest > 0 ? (BALL_RADIUS * 2) / largest : 1;
  model.scale.multiplyScalar(scale);
  model.position.sub(bounds.getCenter(new Vector3()).multiplyScalar(scale));
  model.traverse((child) => {
    if (child instanceof Mesh) {
      child.castShadow = true;
      // A shell is in the air for under two seconds and is never a surface
      // anything else is drawn against; receiving shadows is pure cost.
      child.receiveShadow = false;
    }
  });
  holder.add(model);
  return holder;
}

export class CannonballSystem {
  readonly root = new Group();
  private readonly live: Cannonball[] = [];
  /** Spent shots, kept whole (meshes + materials) for the next one fired. */
  private readonly pool: Cannonball[] = [];
  private readonly ballGeometry: BufferGeometry = new IcosahedronGeometry(BALL_RADIUS, 1);
  private readonly smokeGeometry: BufferGeometry;
  private readonly ballMaterial = new MeshStandardMaterial({ color: BALL_COLOR, roughness: 0.45, metalness: 0.6 });
  private readonly scratchAhead = new Vector3();
  private impactHandler: CannonballImpactHandler | null = null;
  /** Authored ball art, already centred and sized; null keeps the procedural one. */
  private ballTemplate: Object3D | null = null;

  constructor() {
    this.root.name = "rts-cannonballs";
    // Built pointing down -Z with its tip at the origin, so the cone trails
    // behind a group whose +Z faces the direction of travel.
    const smoke = new ConeGeometry(SMOKE_RADIUS, SMOKE_LENGTH, 6, 1, true);
    smoke.rotateX(Math.PI / 2);
    smoke.translate(0, 0, -SMOKE_LENGTH / 2);
    this.smokeGeometry = smoke;
  }

  /**
   * Draw the shell as an authored model instead of the procedural sphere.
   *
   * The model is centred on its own bounds and scaled to {@link BALL_RADIUS},
   * because a shell's *readability* is a gameplay fact — the player has to see
   * the shot coming — while its modelled size is whatever the artist exported.
   * Sizing here rather than in the Actor data keeps that promise for any model
   * this is ever handed.
   *
   * Called once, when the presentation pack finishes loading. Shots already in
   * the pool were built around the old mesh, so the pool is emptied rather than
   * left to hand out sphere and model alternately.
   */
  setBallModel(template: Object3D | null): void {
    this.ballTemplate = template ? fitBallModel(template) : null;
    this.clear();
    for (const shot of this.pool) shot.smokeMaterial.dispose();
    this.pool.length = 0;
  }

  /** Who plays the authored burst when a shell arrives; one handler for all guns. */
  setImpactHandler(handler: CannonballImpactHandler | null): void {
    this.impactHandler = handler;
  }

  /**
   * Fire one ball from a gun onto a point on its target.
   *
   * `to` is the impact point in full world space — the caller aims it, because
   * only the caller knows the target's footprint. A zero-length shot is dropped:
   * it has nothing to animate, and it would divide by zero below.
   *
   * `impactEffectId` is the gun's authored burst, handed over at spawn rather
   * than looked up on landing, because by then the shot is the only thing left
   * that remembers which unit fired it.
   *
   * `launchHeight` is how far above `from` the muzzle sits, so the same gun can
   * be carried by a wheeled carriage or built into a tower's parapet without the
   * caller having to pre-bake the offset into `from`.
   *
   * Returns the shot's flight time in seconds (0 for a dropped shot). This is
   * not decoration any more: the gun's damage is held until the ball lands, so
   * the caller schedules the blow on exactly the number returned here.
   */
  spawn(
    from: Vector3,
    to: Vector3,
    impactEffectId: string | null = null,
    launchHeight = LAUNCH_HEIGHT,
  ): number {
    const start = new Vector3(from.x, from.y + launchHeight, from.z);
    const end = to.clone();
    const distance = start.distanceTo(end);
    if (distance < 0.01) return 0;
    const shot = this.pool.pop() ?? this.create();
    shot.from.copy(start);
    shot.to.copy(end);
    shot.arc = Math.max(MIN_ARC, distance * ARC_RATIO);
    shot.duration = Math.min(MAX_FLIGHT_SECONDS, Math.max(MIN_FLIGHT_SECONDS, distance / FLIGHT_SPEED));
    shot.elapsed = 0;
    shot.impactEffectId = impactEffectId;
    shot.group.position.copy(start);
    shot.ball.visible = true;
    shot.smoke.visible = true;
    shot.smokeMaterial.opacity = 0.4;
    this.root.add(shot.group);
    this.live.push(shot);
    return shot.duration;
  }

  update(dt: number): void {
    const step = Math.max(0, dt);
    for (let i = this.live.length - 1; i >= 0; i -= 1) {
      const shot = this.live[i]!;
      shot.elapsed += step;
      if (shot.elapsed < shot.duration) {
        this.advanceFlight(shot);
        continue;
      }
      // Read before recycling: the pool is free to hand this shot to the next
      // gun the moment it goes back, and the burst has to be the one that landed.
      const effectId = shot.impactEffectId;
      const landed = shot.to.clone();
      this.recycle(i);
      this.impactHandler?.(effectId, landed);
    }
  }

  /** Drop every shot in the air — a restart has no shelling to show, and no bursts. */
  clear(): void {
    for (let i = this.live.length - 1; i >= 0; i -= 1) this.recycle(i);
  }

  dispose(): void {
    this.clear();
    this.impactHandler = null;
    for (const shot of this.pool) shot.smokeMaterial.dispose();
    this.pool.length = 0;
    this.ballGeometry.dispose();
    this.smokeGeometry.dispose();
    this.ballMaterial.dispose();
  }

  /** Travel the parabola, face the direction of travel, and tumble. */
  private advanceFlight(shot: Cannonball): void {
    const progress = Math.min(1, shot.elapsed / shot.duration);
    this.positionAt(shot, progress, shot.group.position);
    // Aiming slightly ahead on the same curve keeps the smoke trailing correctly
    // through the top of the arc, where the direction of travel flips.
    const ahead = this.positionAt(shot, Math.min(1, progress + 0.05), this.scratchAhead);
    if (ahead.distanceToSquared(shot.group.position) > 1e-6) shot.group.lookAt(ahead);
    shot.ball.rotation.x += 0.22;
    shot.ball.rotation.y += 0.17;
    // The trail thins out behind the ball rather than following it the whole way:
    // muzzle smoke is left at the gun, not carried to the target.
    shot.smokeMaterial.opacity = 0.4 * (1 - progress);
    shot.smoke.scale.set(1, 1, 1 - progress * 0.5);
  }

  /** Point on the shot's parabola at `progress` in 0..1, written into `out`. */
  private positionAt(shot: Cannonball, progress: number, out: Vector3): Vector3 {
    out.lerpVectors(shot.from, shot.to, progress);
    out.y += Math.sin(progress * Math.PI) * shot.arc;
    return out;
  }

  private recycle(index: number): void {
    const shot = this.live[index]!;
    this.root.remove(shot.group);
    this.live.splice(index, 1);
    this.pool.push(shot);
  }

  private create(): Cannonball {
    const group = new Group();
    const smokeMaterial = new MeshBasicMaterial({
      color: SMOKE_COLOR,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const ball = this.ballTemplate
      ? this.ballTemplate.clone(true)
      : new Mesh(this.ballGeometry, this.ballMaterial);
    const smoke = new Mesh(this.smokeGeometry, smokeMaterial);
    group.add(ball, smoke);
    return {
      group,
      ball,
      smoke,
      smokeMaterial,
      from: new Vector3(),
      to: new Vector3(),
      arc: MIN_ARC,
      duration: MIN_FLIGHT_SECONDS,
      elapsed: 0,
      impactEffectId: null,
    };
  }
}
