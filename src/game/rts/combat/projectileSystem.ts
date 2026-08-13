/**
 * Archer projectiles — Vertical Slice Plan v0.2 §45 ("Menzilli saldırı ve
 * mermi").
 *
 * Damage is applied by `unitCombat` at the moment of firing; this system only
 * shows the shot travelling. That split is deliberate (plan §14: "tek haritaya
 * uygun güvenilir çözüm"): an in-flight projectile that carries its own damage
 * has to answer what happens when its target dies, moves out of range, or the
 * match restarts mid-arc, and every one of those answers is a bug the vertical
 * slice does not need. What the player must read is "the Archer is shooting
 * that unit", and the authored arrow says it without pretending to be gameplay.
 */
import {
  Box3,
  Group,
  Mesh,
  Object3D,
  Vector3,
} from "three";

import type { UnitOwner } from "../units/unit";

/** World units/s. Fast enough to read as an arrow, slow enough to see. */
const PROJECTILE_SPEED = 26;
/** Impact height, so a shot lands around a target's torso rather than its feet. */
const LAUNCH_HEIGHT = 1.25;
/** The real Arrow asset is authored at this length; keeps future replacements legible. */
const ARROW_LENGTH = 0.75;

interface Projectile {
  readonly model: Object3D;
  readonly from: Vector3;
  readonly to: Vector3;
  readonly duration: number;
  elapsed: number;
}

/**
 * Put an authored arrow's nock at the holder origin and align its long +Z axis
 * with the flight direction. The export's world scale is deliberately ignored:
 * an Arrow supplied by a project should stay readable at the same combat range.
 */
function fitArrowModel(template: Object3D): Object3D {
  const holder = new Group();
  const model = template.clone(true);
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const length = Math.max(size.x, size.y, size.z);
  const scale = length > 0 ? ARROW_LENGTH / length : 1;
  const center = bounds.getCenter(new Vector3());
  model.scale.multiplyScalar(scale);
  model.position.add(new Vector3(-center.x * scale, -center.y * scale, -bounds.min.z * scale));
  model.traverse((child) => {
    if (child instanceof Mesh) {
      child.castShadow = true;
      child.receiveShadow = false;
    }
  });
  holder.add(model);
  return holder;
}

export class ProjectileSystem {
  readonly root = new Group();
  private readonly live: Projectile[] = [];
  private readonly scratchAhead = new Vector3();
  /** Null until the Actor pack resolves the project-authored Arrow prop. */
  private arrowTemplate: Object3D | null = null;

  constructor() {
    this.root.name = "rts-projectiles";
  }

  /**
   * Use this project's authored Arrow mesh for every ranged flight.
   *
   * A missing prop intentionally yields no flight visual rather than reverting
   * to the generic sphere the Archer no longer uses.
   */
  setArrowModel(template: Object3D | null): void {
    this.arrowTemplate = template ? fitArrowModel(template) : null;
    this.clear();
  }

  /** Show one authored arrow travelling from the release point to where a target stood. */
  spawn(_owner: UnitOwner, from: Vector3, to: Vector3, launchHeight = LAUNCH_HEIGHT, lateralOffset = 0): void {
    if (!this.arrowTemplate) return;
    const start = new Vector3(from.x, from.y + launchHeight, from.z);
    const end = new Vector3(to.x, to.y + LAUNCH_HEIGHT, to.z);
    if (lateralOffset !== 0) {
      const side = new Vector3(-(end.z - start.z), 0, end.x - start.x);
      if (side.lengthSq() > 0) {
        side.normalize().multiplyScalar(lateralOffset);
        start.add(side);
        end.add(side);
      }
    }
    const distance = start.distanceTo(end);
    // A point-blank shot has nothing to animate; skipping it also avoids a
    // zero-length flight dividing by zero below.
    if (distance < 0.01) return;
    const model = this.arrowTemplate.clone(true);
    model.position.copy(start);
    model.lookAt(end);
    this.root.add(model);
    this.live.push({ model, from: start, to: end, duration: distance / PROJECTILE_SPEED, elapsed: 0 });
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i -= 1) {
      const projectile = this.live[i]!;
      projectile.elapsed += Math.max(0, dt);
      const progress = projectile.elapsed / projectile.duration;
      if (progress >= 1) {
        this.root.remove(projectile.model);
        this.live.splice(i, 1);
        continue;
      }
      projectile.model.position.lerpVectors(projectile.from, projectile.to, progress);
      projectile.model.position.y += Math.sin(progress * Math.PI) * 0.45;
      const aheadProgress = Math.min(1, progress + 0.04);
      this.scratchAhead.lerpVectors(projectile.from, projectile.to, aheadProgress);
      this.scratchAhead.y += Math.sin(aheadProgress * Math.PI) * 0.45;
      if (this.scratchAhead.distanceToSquared(projectile.model.position) > 1e-6) {
        projectile.model.lookAt(this.scratchAhead);
      }
    }
  }

  /** Drop every arrow in flight — a match restart has no history to animate. */
  clear(): void {
    for (const projectile of this.live) this.root.remove(projectile.model);
    this.live.length = 0;
  }

  dispose(): void {
    this.clear();
    this.arrowTemplate = null;
  }
}
