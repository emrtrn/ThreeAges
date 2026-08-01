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
 * per team, while this arcs high, spins, drags smoke and then bursts at the
 * impact point — which needs per-instance materials. They are pooled rather
 * than allocated per shot, because a siege line fires continuously.
 */
import {
  AdditiveBlending,
  ConeGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
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
/** Height the ball leaves the barrel at; the barrel sits low on the carriage. */
const LAUNCH_HEIGHT = 0.95;
/** How long the dust cloud stands at the impact point after the ball lands. */
const BURST_SECONDS = 0.5;

const BALL_RADIUS = 0.24;
const SMOKE_RADIUS = 0.16;
const SMOKE_LENGTH = 1.1;
const DUST_RADIUS = 0.5;
const FLASH_RADIUS = 0.34;

/**
 * Iron is iron for both kingdoms, as fire is in {@link FirebrandSystem}:
 * ownership is already readable from the gun that fired and from the building
 * taking the hit, and a team-tinted cannonball would stop reading as metal.
 */
const BALL_COLOR = "#2f3438";
const SMOKE_COLOR = "#9c968c";
const DUST_COLOR = "#cbbfa8";
const FLASH_COLOR = "#ffd79a";

interface Cannonball {
  readonly group: Group;
  readonly ball: Mesh;
  readonly smoke: Mesh;
  readonly dust: Mesh;
  readonly flash: Mesh;
  readonly smokeMaterial: MeshBasicMaterial;
  readonly dustMaterial: MeshBasicMaterial;
  readonly flashMaterial: MeshBasicMaterial;
  readonly from: Vector3;
  readonly to: Vector3;
  /** Peak lift of this shot's parabola; re-derived from range on every reuse. */
  arc: number;
  duration: number;
  /** Flight time so far; once it passes {@link duration} the dust settles. */
  elapsed: number;
  burst: number;
}

export class CannonballSystem {
  readonly root = new Group();
  private readonly live: Cannonball[] = [];
  /** Spent shots, kept whole (meshes + materials) for the next one fired. */
  private readonly pool: Cannonball[] = [];
  private readonly ballGeometry: BufferGeometry = new IcosahedronGeometry(BALL_RADIUS, 1);
  private readonly dustGeometry: BufferGeometry = new SphereGeometry(DUST_RADIUS, 8, 6);
  private readonly flashGeometry: BufferGeometry = new SphereGeometry(FLASH_RADIUS, 8, 6);
  private readonly smokeGeometry: BufferGeometry;
  private readonly ballMaterial = new MeshStandardMaterial({ color: BALL_COLOR, roughness: 0.45, metalness: 0.6 });
  private readonly scratchAhead = new Vector3();

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
   * Fire one ball from a gun onto a point on its target.
   *
   * `to` is the impact point in full world space — the caller aims it, because
   * only the caller knows the target's footprint. A zero-length shot is dropped:
   * it has nothing to animate, and it would divide by zero below.
   *
   * Returns the shot's flight time in seconds (0 for a dropped shot). This is
   * not decoration any more: the gun's damage is held until the ball lands, so
   * the caller schedules the blow on exactly the number returned here.
   */
  spawn(from: Vector3, to: Vector3): number {
    const start = new Vector3(from.x, from.y + LAUNCH_HEIGHT, from.z);
    const end = to.clone();
    const distance = start.distanceTo(end);
    if (distance < 0.01) return 0;
    const shot = this.pool.pop() ?? this.create();
    shot.from.copy(start);
    shot.to.copy(end);
    shot.arc = Math.max(MIN_ARC, distance * ARC_RATIO);
    shot.duration = Math.min(MAX_FLIGHT_SECONDS, Math.max(MIN_FLIGHT_SECONDS, distance / FLIGHT_SPEED));
    shot.elapsed = 0;
    shot.burst = 0;
    shot.group.position.copy(start);
    shot.ball.visible = true;
    shot.smoke.visible = true;
    shot.dust.visible = false;
    shot.flash.visible = false;
    shot.smokeMaterial.opacity = 0.4;
    shot.dustMaterial.opacity = 0.55;
    shot.flashMaterial.opacity = 0.85;
    shot.dust.scale.setScalar(1);
    shot.flash.scale.setScalar(1);
    this.root.add(shot.group);
    this.live.push(shot);
    return shot.duration;
  }

  update(dt: number): void {
    const step = Math.max(0, dt);
    for (let i = this.live.length - 1; i >= 0; i -= 1) {
      const shot = this.live[i]!;
      if (shot.elapsed < shot.duration) {
        shot.elapsed += step;
        this.advanceFlight(shot);
        continue;
      }
      shot.burst += step;
      if (shot.burst >= BURST_SECONDS) {
        this.recycle(i);
        continue;
      }
      this.advanceBurst(shot);
    }
  }

  /** Drop every shot in the air or bursting — a restart has no shelling to show. */
  clear(): void {
    for (let i = this.live.length - 1; i >= 0; i -= 1) this.recycle(i);
  }

  dispose(): void {
    this.clear();
    for (const shot of this.pool) {
      shot.smokeMaterial.dispose();
      shot.dustMaterial.dispose();
      shot.flashMaterial.dispose();
    }
    this.pool.length = 0;
    this.ballGeometry.dispose();
    this.dustGeometry.dispose();
    this.flashGeometry.dispose();
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

  /** Land it: the ball is gone, a flash snaps and a dust cloud swells and fades. */
  private advanceBurst(shot: Cannonball): void {
    const progress = shot.burst / BURST_SECONDS;
    shot.group.position.copy(shot.to);
    shot.group.rotation.set(0, 0, 0);
    shot.ball.visible = false;
    shot.smoke.visible = false;
    shot.dust.visible = true;
    shot.dust.scale.setScalar(1 + progress * 2.4);
    shot.dustMaterial.opacity = 0.55 * (1 - progress);
    // The flash is the hit itself, so it is over long before the dust settles.
    shot.flash.visible = progress < 0.35;
    shot.flash.scale.setScalar(1 + progress * 1.6);
    shot.flashMaterial.opacity = Math.max(0, 0.85 - progress * 2.6);
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
    const dustMaterial = new MeshBasicMaterial({
      color: DUST_COLOR,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const flashMaterial = new MeshBasicMaterial({
      color: FLASH_COLOR,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const ball = new Mesh(this.ballGeometry, this.ballMaterial);
    const smoke = new Mesh(this.smokeGeometry, smokeMaterial);
    const dust = new Mesh(this.dustGeometry, dustMaterial);
    const flash = new Mesh(this.flashGeometry, flashMaterial);
    dust.visible = false;
    flash.visible = false;
    group.add(ball, smoke, dust, flash);
    return {
      group,
      ball,
      smoke,
      dust,
      flash,
      smokeMaterial,
      dustMaterial,
      flashMaterial,
      from: new Vector3(),
      to: new Vector3(),
      arc: MIN_ARC,
      duration: MIN_FLIGHT_SECONDS,
      elapsed: 0,
      burst: 0,
    };
  }
}
