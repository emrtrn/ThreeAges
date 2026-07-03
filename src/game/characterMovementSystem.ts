import { readCharacterMovementComponent, readTransformComponent } from "@engine/scene/components";
import type { CharacterMovementComponent, TransformComponent } from "@engine/scene/components";
import type { EngineUpdateContext, Subsystem } from "@engine/core/Subsystem";
import type { Entity, EntityId } from "@engine/scene/entity";
import type { ActionMap } from "@engine/input/actionMap";
import type { PhysicsQuery, TransformSink } from "@engine/behavior/behaviorSubsystem";
import type {
  MovingPlatformQuery,
  PlatformState,
} from "@engine/physics/movingPlatformSubsystem";
import {
  facingYawFromMove,
  planarMoveStep,
  planarMoveStepRelativeToYaw,
  rotateYawToward,
} from "./playerMovement";
import { groundedAt, stepVerticalMotion, type VerticalMotionState } from "./verticalMotion";
import {
  filterWalkableBlockers,
  findGroundAt,
  findLandingGround,
  resolvePlanarMovementSubstepped,
  safeSubstepLength,
  type Aabb3,
  type PlanarDelta,
} from "./collision";
import { slopeCosFromDegrees } from "./slopeSurface";
import {
  UPHILL_SLOWDOWN_REST,
  updateUphillSlowdown,
  uphillSpeedScale,
  type UphillSlowdownState,
} from "./uphillSlowdown";
import type { LocomotionInput } from "./locomotionAnimation";

export const CHARACTER_MOVEMENT_SUBSYSTEM_ID = "characterMovement";

interface CharacterMovementRuntime {
  id: EntityId;
  transform: TransformComponent;
  movement: CharacterMovementComponent;
}

interface CharacterVertical {
  state: VerticalMotionState;
  floorY: number;
  /** Smoothed climb slope driving the uphill walk slowdown. */
  climb: UphillSlowdownState;
  /** Previous frame's raw ground-probe target height (null when not grounded on a probe). */
  lastGroundTargetY: number | null;
}

/** Per-frame snapshot of the moving platforms relevant to one character. */
interface PlatformContext {
  /** Current world AABBs of every live platform (blockers + ground surfaces). */
  readonly aabbs: readonly Aabb3[];
  /** Movement of the platform the character rides this frame (zero if none). */
  readonly carry: readonly [number, number, number];
}

const EMPTY_PLATFORM_CONTEXT: PlatformContext = { aabbs: [], carry: [0, 0, 0] };

export interface CharacterMovementSubsystemOptions {
  getGravityY?: () => number;
  getControlYaw?: (entityId: EntityId) => number | null | undefined;
  isPlayerControlled?: (entityId: EntityId) => boolean;
  reportLocomotion?: (entityId: EntityId, report: LocomotionInput) => void;
  /** Live kinematic platforms the character can stand on, collide with, and ride. */
  platforms?: MovingPlatformQuery;
}

const DEFAULT_GRAVITY_Y = -9.81;
const DEFAULT_MAX_STEP_HEIGHT = 0.45;
const DEFAULT_MAX_STEP_DOWN = 0.5;
const ZERO_DELTA: readonly [number, number, number] = [0, 0, 0];

export class CharacterMovementSubsystem implements Subsystem {
  readonly id = CHARACTER_MOVEMENT_SUBSYSTEM_ID;
  private runtimes: CharacterMovementRuntime[] = [];
  private vertical = new Map<EntityId, CharacterVertical>();
  /**
   * Last-frame world velocity (units/s) per character, from the applied position
   * delta. Feeds the runtime `world.velocityOf` provider (A6, Unreal GetVelocity).
   */
  private velocity = new Map<EntityId, [number, number, number]>();
  private readonly getGravityY: () => number;
  private readonly getControlYaw: (entityId: EntityId) => number | null | undefined;
  private readonly isPlayerControlled: (entityId: EntityId) => boolean;
  private readonly reportLocomotion: ((entityId: EntityId, report: LocomotionInput) => void) | undefined;
  private readonly platforms: MovingPlatformQuery | undefined;

  constructor(
    private readonly actions: ActionMap,
    private readonly sink: TransformSink,
    private readonly physics?: PhysicsQuery,
    options: CharacterMovementSubsystemOptions = {},
  ) {
    this.getGravityY = options.getGravityY ?? (() => DEFAULT_GRAVITY_Y);
    this.getControlYaw = options.getControlYaw ?? (() => null);
    this.isPlayerControlled = options.isPlayerControlled ?? (() => true);
    this.reportLocomotion = options.reportLocomotion;
    this.platforms = options.platforms;
  }

  setEntities(entities: readonly Entity[]): void {
    this.vertical.clear();
    this.velocity.clear();
    this.runtimes = [];
    for (const entity of entities) {
      const transform = readTransformComponent(entity);
      const movement = readCharacterMovementComponent(entity);
      if (!transform || !movement) continue;
      this.runtimes.push({
        id: entity.id,
        transform: cloneTransform(transform),
        movement,
      });
    }
  }

  clear(): void {
    this.runtimes = [];
    this.vertical.clear();
    this.velocity.clear();
  }

  resetEntityTransform(entityId: EntityId, transform: TransformComponent): void {
    const runtime = this.runtimes.find((entry) => entry.id === entityId);
    if (!runtime) return;
    runtime.transform = cloneTransform(transform);
    this.vertical.set(entityId, freshVertical(transform.position[1]));
    // A teleport/respawn is not motion; drop stale velocity so a probe after the
    // jump doesn't read the warp distance as a huge one-frame speed.
    this.velocity.delete(entityId);
  }

  update(engine: EngineUpdateContext): void {
    for (const runtime of this.runtimes) {
      if (!this.isPlayerControlled(runtime.id)) continue;
      const prevX = runtime.transform.position[0];
      const prevY = runtime.transform.position[1];
      const prevZ = runtime.transform.position[2];
      this.updateRuntime(runtime, engine);
      if (engine.deltaSeconds > 0) {
        this.velocity.set(runtime.id, [
          (runtime.transform.position[0] - prevX) / engine.deltaSeconds,
          (runtime.transform.position[1] - prevY) / engine.deltaSeconds,
          (runtime.transform.position[2] - prevZ) / engine.deltaSeconds,
        ]);
      }
      this.sink(runtime.id, runtime.transform);
    }
  }

  /**
   * Last-frame world velocity (units/s) of a character, or null if it has none yet
   * (not a character, unpossessed, or not yet ticked). Backs the runtime
   * `world.velocityOf` provider (A6).
   */
  velocityOf(entityId: EntityId): readonly [number, number, number] | null {
    return this.velocity.get(entityId) ?? null;
  }

  dispose(): void {
    this.clear();
  }

  private updateRuntime(runtime: CharacterMovementRuntime, engine: EngineUpdateContext): void {
    const movement = runtime.movement;
    // Climbing (stairs or a ramp) slows the walk: the smoothed slope measured by
    // the previous frames' ground probes scales this frame's planar speed.
    const climbScale = this.uphillScale(runtime);
    const speed =
      (this.actions.held("sprint")
        ? movement.maxWalkSpeed * movement.sprintMultiplier
        : movement.maxWalkSpeed) * climbScale;
    const input = {
      forward: this.actions.held("move-forward"),
      back: this.actions.held("move-back"),
      left: this.actions.held("move-left"),
      right: this.actions.held("move-right"),
    };
    const controlYaw = this.getControlYaw(runtime.id);
    const planar =
      typeof controlYaw === "number" && Number.isFinite(controlYaw)
        ? planarMoveStepRelativeToYaw(input, speed, engine.deltaSeconds, controlYaw)
        : planarMoveStep(input, speed, engine.deltaSeconds);
    // Snapshot the live platforms once so blocker/probe/carry all see the same
    // frame (the platform subsystem already ticked this frame's motion).
    const platformCtx = this.platformContext(runtime);
    // The player's own move resolves first (and drives facing); the platform then
    // carries the rider horizontally, resolved too so it can't shove through a wall.
    const { dx, dz } = this.resolvePlanarAgainstBlockers(runtime, planar, platformCtx.aabbs);
    runtime.transform.position[0] += dx;
    runtime.transform.position[2] += dz;
    if (platformCtx.carry[0] !== 0 || platformCtx.carry[2] !== 0) {
      const carried = this.resolvePlanarAgainstBlockers(
        runtime,
        { dx: platformCtx.carry[0], dz: platformCtx.carry[2] },
        platformCtx.aabbs,
      );
      runtime.transform.position[0] += carried.dx;
      runtime.transform.position[2] += carried.dz;
    }
    const yaw = facingYawFromMove(dx, dz);
    let targetYaw: number | null = null;
    if (
      movement.orientRotationToControl &&
      typeof controlYaw === "number" &&
      Number.isFinite(controlYaw)
    ) {
      targetYaw = controlYawToCharacterYaw(controlYaw);
    } else if (movement.orientRotationToMovement && yaw !== null) {
      targetYaw = yaw;
    }
    if (targetYaw !== null) {
      const yawRate = Math.max(0, movement.rotationRate[2]);
      runtime.transform.rotation[1] = rotateYawToward(
        runtime.transform.rotation[1],
        targetYaw,
        yawRate * engine.deltaSeconds,
      );
    }

    const vertical = this.updateVertical(runtime, engine, Math.hypot(dx, dz), platformCtx);
    this.reportLocomotion?.(runtime.id, {
      planarSpeed:
        engine.deltaSeconds > 0 ? Math.hypot(planar.dx, planar.dz) / engine.deltaSeconds : 0,
      grounded: vertical.grounded,
      velocityY: vertical.velocityY,
    });
  }

  private updateVertical(
    runtime: CharacterMovementRuntime,
    engine: EngineUpdateContext,
    planarDistance: number,
    platformCtx: PlatformContext,
  ): VerticalMotionState {
    const movement = runtime.movement;
    if (movement.movementMode !== "walking" && movement.movementMode !== "falling") {
      return { y: runtime.transform.position[1], velocityY: 0, grounded: true };
    }
    let vertical = this.vertical.get(runtime.id);
    if (!vertical) {
      vertical = freshVertical(runtime.transform.position[1]);
      this.vertical.set(runtime.id, vertical);
    }
    const previousY = vertical.state.y;
    const ground = this.groundAt(runtime, platformCtx.aabbs);
    // Measure the climb from the raw probe targets (not the smoothed floor), so
    // the uphill slowdown sees the true geometry. Airborne or probe-less frames
    // feed a flat sample, decaying the slowdown back toward full speed. A rising
    // platform's carry is subtracted so riding an elevator isn't read as climbing.
    const climbGround =
      vertical.state.grounded && !this.actions.pressed("jump") ? ground : null;
    const floorRise =
      climbGround && vertical.lastGroundTargetY !== null
        ? climbGround.floorY - vertical.lastGroundTargetY - platformCtx.carry[1]
        : 0;
    vertical.climb = updateUphillSlowdown(
      vertical.climb,
      floorRise,
      planarDistance,
      engine.deltaSeconds,
    );
    vertical.lastGroundTargetY = climbGround ? climbGround.floorY : null;
    if (vertical.state.grounded) {
      if (this.actions.pressed("jump")) {
        vertical.floorY = ground?.floorY ?? vertical.floorY;
      } else if (ground) {
        // Ease the resting height toward the new floor so a step is climbed over a
        // few frames instead of snapping in one (which pops the camera). Ramps have
        // a tiny per-frame rise, so they reach the target every frame (no lag).
        vertical.floorY = approachHeight(
          vertical.floorY,
          ground.floorY,
          movement.stepSmoothSpeed * engine.deltaSeconds,
        );
        vertical.state = groundedAt(vertical.floorY);
      } else if (!this.hasGroundProbe()) {
        vertical.state = groundedAt(vertical.floorY);
      } else {
        vertical.floorY = previousY;
        vertical.state = { y: previousY, velocityY: 0, grounded: false };
      }
    }
    vertical.state = stepVerticalMotion(vertical.state, {
      gravityY: this.getGravityY() * movement.gravityScale,
      jumpSpeed: movement.jumpSpeed,
      floorY: vertical.state.grounded ? vertical.floorY : null,
      dt: engine.deltaSeconds,
      jump: this.actions.pressed("jump"),
    });
    if (!vertical.state.grounded) {
      const landing = this.landingGround(runtime, previousY, vertical.state.y, platformCtx.aabbs);
      if (landing) {
        vertical.floorY = landing.floorY;
        vertical.state = groundedAt(landing.floorY);
      } else if (
        !this.hasGroundProbe() &&
        previousY >= vertical.floorY &&
        vertical.state.y <= vertical.floorY
      ) {
        vertical.state = groundedAt(vertical.floorY);
      }
    }
    runtime.transform.position[1] = vertical.state.y;
    return vertical.state;
  }

  private resolvePlanarAgainstBlockers(
    runtime: CharacterMovementRuntime,
    planar: PlanarDelta,
    platformAabbs: readonly Aabb3[],
  ): PlanarDelta {
    if (!this.physics) return planar;
    const footY = runtime.transform.position[1];
    const stepUp = this.maxStepHeight(runtime);
    // Filter both channels: a blocker whose top is within step height (the ground
    // you stand on, including the platform under your feet) is not a wall, so
    // carry along it isn't self-blocked; a taller side is.
    const staticBlockers = filterWalkableBlockers(footY, this.physics.staticBlockerAabbs(), stepUp);
    const blockers =
      platformAabbs.length > 0
        ? [...staticBlockers, ...filterWalkableBlockers(footY, platformAabbs, stepUp)]
        : staticBlockers;
    if (blockers.length === 0) return planar;
    const half = this.physics.colliderHalfExtents(runtime.id);
    if (!half) return planar;
    const centerPosition: [number, number, number] = [
      runtime.transform.position[0],
      runtime.transform.position[1] + half[1],
      runtime.transform.position[2],
    ];
    // Substep the resolve so a fast move / dt spike can't tunnel a thin wall.
    return resolvePlanarMovementSubstepped(
      centerPosition,
      planar,
      half,
      blockers,
      safeSubstepLength(blockers),
    );
  }

  private groundAt(runtime: CharacterMovementRuntime, platformAabbs: readonly Aabb3[]) {
    const blockers = this.groundBlockers(platformAabbs);
    const surfaces = this.physics?.staticSurfaceTriangles() ?? [];
    if (blockers.length === 0 && surfaces.length === 0) return null;
    return findGroundAt(runtime.transform.position, blockers, this.groundOptions(runtime, surfaces));
  }

  private landingGround(
    runtime: CharacterMovementRuntime,
    previousY: number,
    nextY: number,
    platformAabbs: readonly Aabb3[],
  ) {
    const blockers = this.groundBlockers(platformAabbs);
    const surfaces = this.physics?.staticSurfaceTriangles() ?? [];
    if (blockers.length === 0 && surfaces.length === 0) return null;
    return findLandingGround(
      previousY,
      nextY,
      runtime.transform.position,
      blockers,
      this.groundOptions(runtime, surfaces),
    );
  }

  /** Static blockers plus the current moving-platform AABBs (both are standable tops). */
  private groundBlockers(platformAabbs: readonly Aabb3[]): readonly Aabb3[] {
    const staticBlockers = this.physics?.staticBlockerAabbs() ?? [];
    if (platformAabbs.length === 0) return staticBlockers;
    return [...staticBlockers, ...platformAabbs];
  }

  /**
   * Snapshots the live platforms for this frame: their AABBs (blockers + ground)
   * and the carry delta of whichever platform the character is standing on.
   */
  private platformContext(runtime: CharacterMovementRuntime): PlatformContext {
    const states = this.platforms?.platforms() ?? [];
    if (states.length === 0) return EMPTY_PLATFORM_CONTEXT;
    const aabbs = states.map((state) => state.aabb as Aabb3);
    return { aabbs, carry: this.carryDelta(runtime, states, aabbs) };
  }

  /**
   * The this-frame movement of the platform the character rides, or zero. A rider
   * must be grounded and the platform must win the ground probe (be the highest
   * surface under the feet) — so standing on a static floor above a passing
   * platform doesn't carry.
   */
  private carryDelta(
    runtime: CharacterMovementRuntime,
    states: readonly PlatformState[],
    platformAabbs: readonly Aabb3[],
  ): readonly [number, number, number] {
    const vertical = this.vertical.get(runtime.id);
    if (vertical && !vertical.state.grounded) return ZERO_DELTA;
    const ground = this.groundAt(runtime, platformAabbs);
    if (!ground || !ground.blocker) return ZERO_DELTA;
    const state = states.find((candidate) => candidate.aabb === ground.blocker);
    return state ? state.delta : ZERO_DELTA;
  }

  private groundOptions(
    runtime: CharacterMovementRuntime,
    surfaces: ReturnType<NonNullable<PhysicsQuery["staticSurfaceTriangles"]>>,
  ) {
    return {
      footprintHalf: this.footprintHalf(runtime),
      maxStepUp: this.maxStepHeight(runtime),
      maxStepDown: this.maxStepDown(runtime),
      surfaces,
      maxSlopeCos: slopeCosFromDegrees(runtime.movement.maxSlopeAngleDeg),
    };
  }

  private hasGroundProbe(): boolean {
    const blockers = this.physics?.staticBlockerAabbs();
    if (blockers && blockers.length > 0) return true;
    const surfaces = this.physics?.staticSurfaceTriangles();
    if (surfaces && surfaces.length > 0) return true;
    return (this.platforms?.platforms().length ?? 0) > 0;
  }

  private footprintHalf(runtime: CharacterMovementRuntime): [number, number] {
    const radius = Math.max(runtime.movement.capsuleRadius, 0.001);
    return [radius, radius];
  }

  private maxStepHeight(runtime: CharacterMovementRuntime): number {
    return Math.max(runtime.movement.maxStepHeight ?? DEFAULT_MAX_STEP_HEIGHT, 0);
  }

  private maxStepDown(runtime: CharacterMovementRuntime): number {
    return Math.max(runtime.movement.maxStepDown ?? DEFAULT_MAX_STEP_DOWN, 0);
  }

  private uphillScale(runtime: CharacterMovementRuntime): number {
    const vertical = this.vertical.get(runtime.id);
    if (!vertical) return 1;
    return uphillSpeedScale(vertical.climb, runtime.movement.uphillSpeedScale ?? 1);
  }
}

function controlYawToCharacterYaw(yaw: number): number {
  return facingYawFromMove(-Math.sin(yaw), -Math.cos(yaw)) ?? 0;
}

function freshVertical(floorY: number): CharacterVertical {
  return {
    state: groundedAt(floorY),
    floorY,
    climb: UPHILL_SLOWDOWN_REST,
    lastGroundTargetY: null,
  };
}

/** Moves `current` toward `target` by at most `maxDelta`; a non-positive `maxDelta` snaps. */
function approachHeight(current: number, target: number, maxDelta: number): number {
  if (!(maxDelta > 0)) return target;
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

function cloneTransform(transform: TransformComponent): TransformComponent {
  return {
    position: [...transform.position],
    rotation: [...transform.rotation],
    scale: [...transform.scale],
  };
}
