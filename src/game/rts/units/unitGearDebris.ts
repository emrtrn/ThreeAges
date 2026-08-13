/**
 * The gear a fallen soldier leaves on the field.
 *
 * The Guard's body is a single merged `SkinnedMesh`: helmet, shield and sword
 * are welded into it so a live soldier costs one draw call instead of four. That
 * trade is what this module pays back. Nothing can be detached from a merged
 * body, so the gear that hits the ground is never the gear the soldier wore — it
 * is three small static models, spawned at the moment the corpse is removed and
 * standing in for it from then on.
 *
 * **Why at removal and not mid-fall.** A body lies on the field for
 * {@link UNIT_CORPSE_SECONDS} after its death clip ends. Dropping the gear when
 * the clip finishes would leave a corpse wearing a helmet next to a helmet on
 * the ground for the next thirty seconds. Spawning as the body leaves reads as
 * the thing the player expects instead: the fallen are cleared, their kit stays
 * where they fell. It also makes the drop independent of the animation — an
 * off-screen death whose clip was never advanced still leaves its gear.
 *
 * **Why one `InstancedMesh` per kind.** Debris is the one piece of art whose
 * count grows with how badly a battle went, which is exactly when the frame can
 * least afford it. Loose meshes would spend the draw calls the merge just saved
 * and then some — a hundred dead Guards is three hundred objects. Pooled
 * instances make the whole field's debris one draw call per (kind, material)
 * pair no matter how many pieces are lying in it, and the fixed pool means the
 * hundred-and-first death recycles the oldest piece rather than allocating.
 *
 * Ownership: view-side only, exactly like {@link UnitShadowProxies}. It reads a
 * position and a material and writes nothing back; a match that never renders
 * behaves identically without it.
 */
import {
  Box3,
  BufferGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
  type Material,
  type Object3D,
} from "three";

/** The pieces a body can shed. */
export type RtsGearKind = "helmet" | "shield" | "sword" | "bow" | "arrowBag";

export const RTS_GEAR_KINDS: readonly RtsGearKind[] = ["helmet", "shield", "sword", "bow", "arrowBag"];

/**
 * Catalog prop slot each kind's model is registered under
 * (`public/game-data/content/rts-content.json`, `props`).
 *
 * Props rather than Actors because no Actor references these models — the same
 * reason the cannonball is a prop. Going through the slot table keeps the model
 * swappable from data: a fork that ships different gear rebinds the slot and
 * touches no code.
 *
 * Slot names are camelCase because that is what the catalog validator accepts;
 * the asset ids they resolve to are the manifest's own kebab-case.
 */
export const RTS_GEAR_PROP_SLOTS: Readonly<Record<RtsGearKind, string>> = {
  helmet: "guardHelmet",
  shield: "guardShield",
  sword: "guardSword",
  bow: "archerBow",
  arrowBag: "archerArrowBag",
};

/**
 * Which unit type sheds which gear, keyed by `Unit.typeId`.
 *
 * A type with no entry drops nothing, which is the correct behaviour for every
 * unit without separate loose-kit props.
 */
export const RTS_UNIT_GEAR: Readonly<Record<string, readonly RtsGearKind[]>> = {
  guard_placeholder: ["helmet", "shield", "sword"],
  archer_placeholder: ["bow", "arrowBag"],
};

/**
 * How each kind comes to rest, as a pitch about X applied to the authored pose.
 *
 * The models are authored standing in the pose they were worn in, so a sword
 * left alone would stand on its point. A helmet is the exception: it is already
 * the right way up, and only its yaw is randomised.
 */
const REST_PITCH: Readonly<Record<RtsGearKind, number>> = {
  helmet: 0,
  shield: -Math.PI / 2,
  sword: -Math.PI / 2,
  bow: -Math.PI / 2,
  arrowBag: -Math.PI / 2,
};

/**
 * Pieces held per (kind, material) pool before the oldest is recycled.
 *
 * Sized against how much debris can be read rather than against how much can be
 * afforded: the pool is one draw call at any occupancy, so the cost of a bigger
 * number is instance-buffer memory, and the cost of a smaller one is kit
 * vanishing from a battlefield the player is still looking at. Forty-eight is a
 * heavy engagement's worth per piece type per side.
 */
const POOL_CAPACITY = 48;

/** Downward acceleration, in world units per second squared. */
const GRAVITY = 14;
/** Upward kick a piece leaves the body with. */
const TOSS_UP = 2.2;
/** Outward kick, spread over a random bearing. */
const TOSS_OUT = 1.4;
/** How fast a piece tumbles in flight, in radians per second. */
const TUMBLE_SPEED = 7;
/** Speed kept across a bounce. */
const RESTITUTION = 0.35;
/**
 * Impact speed below which a piece stops bouncing and settles.
 *
 * Without a floor here a piece bounces forever in ever smaller hops, each one
 * costing the same integration as the first, and visibly jitters on the ground.
 */
const BOUNCE_MIN_SPEED = 1.2;
/** How quickly a grounded piece rotates from its tumble into its resting pose. */
const SETTLE_RATE = 9;
/**
 * How long a piece lies on the field before it is released.
 *
 * Deliberately longer than {@link UNIT_CORPSE_SECONDS}: the gear is what is left
 * to mark where a fight happened once the bodies are gone, and clearing it on
 * the same clock would erase the aftermath the moment it became the only record
 * of it.
 */
export const GEAR_DEBRIS_SECONDS = 45;
/** The tail of that window spent shrinking out, so nothing pops. */
const FADE_SECONDS = 2;

/** One piece of gear in flight or at rest. */
interface DebrisPiece {
  active: boolean;
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly spinAxis: Vector3;
  readonly orientation: Quaternion;
  /** Pose this piece slerps into once it has stopped moving. */
  readonly rest: Quaternion;
  grounded: boolean;
  /** Seconds since the drop; the release clock, not the flight one. */
  age: number;
}

/** The instanced draw and the pieces feeding it for one (kind, material) pair. */
interface DebrisPool {
  readonly mesh: InstancedMesh;
  readonly pieces: DebrisPiece[];
  /** Next slot the ring buffer hands out; wraps at {@link POOL_CAPACITY}. */
  next: number;
  /**
   * How far the resting pose sits above the ground, measured rather than tuned.
   *
   * Taken from the model's own bounds rotated into {@link REST_PITCH}, so a
   * re-exported sword that is thicker than the old one still lies on the terrain
   * instead of half inside it, and nobody has to remember to retune a constant.
   */
  readonly restLift: number;
}

/** A kind's loaded model: the geometry to draw and the material it came with. */
interface GearModel {
  readonly geometry: BufferGeometry;
  /** The GLB's own material, used when the caller supplies none. */
  readonly material: Material;
}

export class UnitGearDebris {
  /** Scene subtree to add once; pools are added into it as they are first used. */
  readonly root = new Group();
  private readonly models = new Map<RtsGearKind, GearModel>();
  /** Pools keyed by kind and material, so two kingdoms' kit never share a draw. */
  private readonly pools = new Map<string, DebrisPool>();
  private readonly matrix = new Matrix4();
  private readonly scratchQuaternion = new Quaternion();
  private readonly scratchScale = new Vector3();
  private groundHeightAt: ((x: number, z: number) => number) | null = null;
  private visibleAt: ((x: number, z: number) => boolean) | null = null;
  private enabled = true;

  constructor() {
    this.root.name = "rts-unit-gear-debris";
  }

  /**
   * Bind a kind to its loaded prop model. Null unbinds it, which is what a
   * catalog that maps no such prop degrades to: that kind simply never drops.
   *
   * The geometry is cloned and baked flat here rather than referenced, because
   * the model handed in is the factory's shared template — the same object a
   * placed Actor could be using — and both the node transform it carries and the
   * recentring below have to happen without touching it.
   */
  setModel(kind: RtsGearKind, model: Object3D | null): void {
    this.releaseKind(kind);
    if (!model) return;
    const source = findFirstMesh(model);
    if (!source) return;
    model.updateMatrixWorld(true);
    const geometry = source.geometry.clone();
    geometry.applyMatrix4(source.matrixWorld);
    // Recentred so the instance matrix's translation is the piece's middle. A
    // model authored around the hand or head that wore it is offset by however
    // far that was from the rig's origin, and dropped unrecentred it lands that
    // far from the body — a sword a metre to the left of everything else.
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox;
    if (bounds) {
      const center = bounds.getCenter(new Vector3());
      // `translate` goes through `applyMatrix4`, which recomputes an existing
      // bounding box — so the box measured below is the recentred one. Left
      // uncentred it would report the lift of a piece sitting where the hand
      // that held it was, and the kit would land that far under the terrain.
      geometry.translate(-center.x, -center.y, -center.z);
    }
    const material = Array.isArray(source.material) ? source.material[0] : source.material;
    if (!material) {
      geometry.dispose();
      return;
    }
    this.models.set(kind, { geometry, material });
  }

  /** True once a kind has a model and can actually drop. */
  hasModel(kind: RtsGearKind): boolean {
    return this.models.has(kind);
  }

  /**
   * Where debris comes to rest. Absent leaves every piece landing at y = 0,
   * which is right for a flat test field and wrong for an authored landscape.
   */
  setGroundSampler(sample: ((x: number, z: number) => number) | null): void {
    this.groundHeightAt = sample;
  }

  /**
   * Fog test applied per piece, per frame.
   *
   * Debris has to answer to the fog for the same reason a unit's shadow does: a
   * sword lying in ground the player has never scouted is a free report that an
   * army died there. Absent means "no fog in this match", not "show everything
   * regardless" — a caller with fog running must pass its test.
   */
  setVisibilityTest(test: ((x: number, z: number) => boolean) | null): void {
    this.visibleAt = test;
  }

  /**
   * Drop one body's kit at a point.
   *
   * `material` is the material the *unit's own mesh* was drawn with, handed in
   * rather than looked up so the gear inherits whatever the body had — the
   * kingdom's colour variant, an Actor's tint — without this module knowing that
   * either concept exists. Null falls back to the model's own material, which is
   * the correct degrade for a fork whose props are already team-neutral.
   *
   * `seed` makes one body's scatter stable: called twice with the same seed the
   * kit lands the same way, so a replay or a headless check sees one field.
   */
  drop(
    origin: Vector3,
    seed: number,
    kinds: readonly RtsGearKind[],
    material: Material | null,
  ): void {
    if (!this.enabled) return;
    const random = makeDebrisRng(seed);
    for (const kind of kinds) {
      const model = this.models.get(kind);
      if (!model) continue;
      const pool = this.poolFor(kind, material ?? model.material, model);
      const piece = pool.pieces[pool.next] as DebrisPiece;
      pool.next = (pool.next + 1) % pool.pieces.length;
      const bearing = random() * Math.PI * 2;
      const spread = TOSS_OUT * (0.5 + random() * 0.5);
      piece.active = true;
      piece.grounded = false;
      piece.age = 0;
      // Half a body's height, so the kit leaves the corpse rather than the soil.
      piece.position.set(origin.x, origin.y + 0.5, origin.z);
      piece.velocity.set(
        Math.cos(bearing) * spread,
        TOSS_UP * (0.7 + random() * 0.6),
        Math.sin(bearing) * spread,
      );
      piece.spinAxis
        .set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1)
        .normalize();
      // A degenerate axis (three zeros from an unlucky seed) normalises to NaN
      // and would poison the quaternion for the rest of the piece's life.
      if (!Number.isFinite(piece.spinAxis.x)) piece.spinAxis.set(0, 1, 0);
      piece.orientation.identity();
      piece.rest.setFromAxisAngle(UP, random() * Math.PI * 2);
      piece.rest.multiply(this.scratchQuaternion.setFromAxisAngle(RIGHT, REST_PITCH[kind]));
    }
  }

  /**
   * Advance every live piece and write the frame's instances.
   *
   * Two clocks, for the reason `Unit.updateDeath` documents: the tumble is a
   * physical fall and runs on the rendered delta so it looks the same at any
   * game speed, while the lie-there window is spent in *simulation* seconds so a
   * player fast-forwarding a battle sees the field clear at the speed they asked
   * for rather than watching thirty-second-old kit at 8x.
   */
  advance(dt: number, simulationSpeed = 1): void {
    const step = Math.max(0, dt);
    const speed = Number.isFinite(simulationSpeed) && simulationSpeed > 0 ? simulationSpeed : 1;
    for (const pool of this.pools.values()) {
      let written = 0;
      for (const piece of pool.pieces) {
        if (!piece.active) continue;
        this.advancePiece(piece, step, pool.restLift);
        piece.age += step * speed;
        if (piece.age >= GEAR_DEBRIS_SECONDS) {
          piece.active = false;
          continue;
        }
        // Fogged pieces are skipped rather than deactivated: the kit is still
        // lying there and comes back the moment something scouts the ground.
        if (this.visibleAt && !this.visibleAt(piece.position.x, piece.position.z)) continue;
        const remaining = GEAR_DEBRIS_SECONDS - piece.age;
        const scale = remaining < FADE_SECONDS ? Math.max(0, remaining / FADE_SECONDS) : 1;
        this.matrix.compose(
          piece.position,
          piece.orientation,
          this.scratchScale.setScalar(scale),
        );
        pool.mesh.setMatrixAt(written, this.matrix);
        written += 1;
      }
      pool.mesh.count = written;
      if (written > 0) pool.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Turn the layer off — for the quality levels that draw no such detail, and
   * for a headless match that has no reason to integrate a tumble at all.
   * Disabling also drops what is already lying there, because a layer that comes
   * back should not come back holding a battle the player has since forgotten.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.clear();
  }

  /** Drop everything on the field — match reset, and teardown. */
  clear(): void {
    for (const pool of this.pools.values()) {
      for (const piece of pool.pieces) piece.active = false;
      pool.next = 0;
      pool.mesh.count = 0;
    }
  }

  /** Live piece count, for tests and the debug overlay. */
  activeCount(): number {
    let total = 0;
    for (const pool of this.pools.values()) {
      for (const piece of pool.pieces) if (piece.active) total += 1;
    }
    return total;
  }

  /** Instances actually drawn last frame — what the layer costs to look at. */
  drawnCount(): number {
    let total = 0;
    for (const pool of this.pools.values()) total += pool.mesh.count;
    return total;
  }

  dispose(): void {
    for (const pool of this.pools.values()) {
      this.root.remove(pool.mesh);
      pool.mesh.dispose();
    }
    this.pools.clear();
    // Geometries are this module's clones and are its to release. Materials
    // never are: every one of them is either the factory's shared slot material
    // or the shared template's, and disposing one here would blank the model it
    // was borrowed from.
    for (const model of this.models.values()) model.geometry.dispose();
    this.models.clear();
  }

  private advancePiece(piece: DebrisPiece, dt: number, restLift: number): void {
    if (piece.grounded) {
      // Rotating into the resting pose is the whole of a settled piece's work.
      // `rotateTowards` stops exactly on arrival, so this costs nothing once the
      // field has stopped moving.
      piece.orientation.rotateTowards(piece.rest, SETTLE_RATE * dt);
      return;
    }
    piece.velocity.y -= GRAVITY * dt;
    piece.position.addScaledVector(piece.velocity, dt);
    this.scratchQuaternion.setFromAxisAngle(piece.spinAxis, TUMBLE_SPEED * dt);
    piece.orientation.multiply(this.scratchQuaternion).normalize();
    const ground = (this.groundHeightAt?.(piece.position.x, piece.position.z) ?? 0) + restLift;
    if (piece.position.y > ground) return;
    piece.position.y = ground;
    if (-piece.velocity.y > BOUNCE_MIN_SPEED) {
      piece.velocity.y = -piece.velocity.y * RESTITUTION;
      // Ground friction on the bounce, or a piece skates away from the body it
      // fell off and the kit ends up scattered across half a formation.
      piece.velocity.x *= 0.5;
      piece.velocity.z *= 0.5;
      return;
    }
    piece.grounded = true;
    piece.velocity.set(0, 0, 0);
  }

  private poolFor(kind: RtsGearKind, material: Material, model: GearModel): DebrisPool {
    const key = `${kind}|${material.uuid}`;
    const existing = this.pools.get(key);
    if (existing) return existing;
    const mesh = new InstancedMesh(model.geometry, material, POOL_CAPACITY);
    mesh.name = `rts-gear-debris-${kind}`;
    // Debris is small, flat and on the ground. It receives the terrain's light
    // and shadow, and casts none of its own: a shadow map slot per piece type
    // would buy a contact shadow under a helmet already touching the soil.
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    // The instance matrices are rewritten every frame without invalidating the
    // derived bounding sphere, exactly as the unit shadow proxies are; culling
    // on a stale sphere would blink out the debris that just landed.
    mesh.frustumCulled = false;
    mesh.count = 0;
    const pool: DebrisPool = {
      mesh,
      pieces: Array.from({ length: POOL_CAPACITY }, makeDebrisPiece),
      next: 0,
      restLift: measureRestLift(model.geometry, REST_PITCH[kind]),
    };
    this.pools.set(key, pool);
    this.root.add(mesh);
    return pool;
  }

  /** Retire the pools drawing a kind whose model is being replaced or removed. */
  private releaseKind(kind: RtsGearKind): void {
    for (const [key, pool] of [...this.pools]) {
      if (!key.startsWith(`${kind}|`)) continue;
      this.root.remove(pool.mesh);
      pool.mesh.dispose();
      this.pools.delete(key);
    }
    this.models.get(kind)?.geometry.dispose();
    this.models.delete(kind);
  }
}

const UP = new Vector3(0, 1, 0);
const RIGHT = new Vector3(1, 0, 0);

function makeDebrisPiece(): DebrisPiece {
  return {
    active: false,
    position: new Vector3(),
    velocity: new Vector3(),
    spinAxis: new Vector3(0, 1, 0),
    orientation: new Quaternion(),
    rest: new Quaternion(),
    grounded: false,
    age: 0,
  };
}

/** First drawable in a loaded prop model; these GLBs hold exactly one. */
function findFirstMesh(model: Object3D): Mesh | null {
  let found: Mesh | null = null;
  model.traverse((child) => {
    if (found || !(child instanceof Mesh)) return;
    found = child;
  });
  return found;
}

/**
 * How far a resting piece's centre sits above the ground it lies on.
 *
 * Measured from the model's own bounds turned into the resting pose, so the
 * number tracks the asset instead of a constant somebody has to remember to
 * retune when the art changes.
 */
function measureRestLift(geometry: BufferGeometry, pitch: number): number {
  const bounds = geometry.boundingBox ?? new Box3().setFromBufferAttribute(
    geometry.getAttribute("position") as never,
  );
  const rotation = new Matrix4().makeRotationX(pitch);
  const rotated = bounds.clone().applyMatrix4(rotation);
  return Math.max(0, -rotated.min.y);
}

/**
 * Deterministic 32-bit PRNG (mulberry32), so one body's scatter is reproducible.
 *
 * Local rather than shared with the wildlife's: that one is seeded simulation —
 * where a deer wandered decides whether a hunter reaches it — and this is
 * decoration. Keeping them apart means a change to how debris scatters can never
 * move an animal.
 */
function makeDebrisRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
