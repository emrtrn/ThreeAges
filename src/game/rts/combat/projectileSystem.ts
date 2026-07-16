/**
 * Ranged-attack tracers — Vertical Slice Plan v0.2 §45 ("Menzilli saldırı ve
 * mermi").
 *
 * Damage is applied by `unitCombat` at the moment of firing; this system only
 * shows the shot travelling. That split is deliberate (plan §14: "tek haritaya
 * uygun güvenilir çözüm"): an in-flight projectile that carries its own damage
 * has to answer what happens when its target dies, moves out of range, or the
 * match restarts mid-arc, and every one of those answers is a bug the vertical
 * slice does not need. What the player must read is "the Archer is shooting
 * that unit", and a tracer says it.
 */
import {
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from "three";

import type { UnitOwner } from "../units/unit";

/** World units/s. Fast enough to read as an arrow, slow enough to see. */
const PROJECTILE_SPEED = 26;
/** Launch and impact heights, so a shot arcs between torsos rather than feet. */
const LAUNCH_HEIGHT = 1.25;
const PROJECTILE_RADIUS = 0.09;

const TRACER_COLOR: Record<UnitOwner, string> = {
  player: "#9fd2ff",
  enemy: "#ffb3a4",
};

interface Projectile {
  readonly mesh: Mesh;
  readonly from: Vector3;
  readonly to: Vector3;
  readonly duration: number;
  elapsed: number;
}

export class ProjectileSystem {
  readonly root = new Group();
  private readonly live: Projectile[] = [];
  /** One geometry and one material per team for every tracer ever fired. */
  private readonly geometry: BufferGeometry = new SphereGeometry(PROJECTILE_RADIUS, 6, 4);
  private readonly materials: Record<UnitOwner, Material>;

  constructor() {
    this.root.name = "rts-projectiles";
    this.materials = {
      player: new MeshBasicMaterial({ color: TRACER_COLOR.player }),
      enemy: new MeshBasicMaterial({ color: TRACER_COLOR.enemy }),
    };
  }

  /** Show one shot travelling from an attacker to where its target stood. */
  spawn(owner: UnitOwner, from: Vector3, to: Vector3): void {
    const start = new Vector3(from.x, LAUNCH_HEIGHT, from.z);
    const end = new Vector3(to.x, LAUNCH_HEIGHT, to.z);
    const distance = start.distanceTo(end);
    // A point-blank shot has nothing to animate; skipping it also avoids a
    // zero-length flight dividing by zero below.
    if (distance < 0.01) return;
    const mesh = new Mesh(this.geometry, this.materials[owner]);
    mesh.position.copy(start);
    this.root.add(mesh);
    this.live.push({ mesh, from: start, to: end, duration: distance / PROJECTILE_SPEED, elapsed: 0 });
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i -= 1) {
      const projectile = this.live[i]!;
      projectile.elapsed += Math.max(0, dt);
      const progress = projectile.elapsed / projectile.duration;
      if (progress >= 1) {
        this.root.remove(projectile.mesh);
        this.live.splice(i, 1);
        continue;
      }
      projectile.mesh.position.lerpVectors(projectile.from, projectile.to, progress);
      // A shallow arc; purely presentational, and it keeps a volley readable
      // when several archers fire along the same line.
      projectile.mesh.position.y += Math.sin(progress * Math.PI) * 0.45;
    }
  }

  /** Drop every tracer in flight — a match restart has no history to animate. */
  clear(): void {
    for (const projectile of this.live) this.root.remove(projectile.mesh);
    this.live.length = 0;
  }

  dispose(): void {
    this.clear();
    this.geometry.dispose();
    for (const material of Object.values(this.materials)) material.dispose();
  }
}
