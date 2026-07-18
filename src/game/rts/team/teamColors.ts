/**
 * Team identity colours and the ground ring that carries them — Vertical Slice
 * Plan v0.2 §63 ("Takım rengi materyali") and §64 ("Takım renkleri").
 *
 * Why a ground ring rather than tinting the flag material on the art: at RTS
 * camera distance a pennant is a few pixels at the top of a silhouette and
 * disappears behind buildings and in a crowded fight, so it cannot be the thing
 * ownership is read from. A disc on the ground under each unit and building sits
 * in the one place the camera always sees, and it shares the ring vocabulary the
 * selection rings already use. The flag material stays whatever the artist
 * authored — this is additive, not a replacement.
 *
 * Cyan rather than the older blue (`#2d7fd6`): plain blue sinks into shadowed
 * ground and evening light, while cyan holds contrast against both the terrain
 * and the yellow selection ring.
 *
 * Rings render *under* the selection rings (`SELECTION_RING_Y` 0.04–0.05) so the
 * two never z-fight and "selected" stays legible on top of "whose it is".
 */
import { Color, Mesh, MeshBasicMaterial, RingGeometry } from "three";

import type { UnitOwner } from "../units/unit";

/** Canonical per-kingdom identity colour. The single source for every surface. */
export const TEAM_COLOR: Record<UnitOwner, string> = {
  player: "#22d3ee",
  enemy: "#e2483a",
};

/** Ground height for team rings; below the selection rings that sit at 0.04+. */
export const TEAM_RING_Y = 0.015;

/** Ring thickness as a fraction of its radius, so small and large rings read alike. */
const RING_THICKNESS_RATIO = 0.18;
const MIN_RING_THICKNESS = 0.12;

/**
 * A flat team-coloured ring laid on the ground, sized to sit just outside
 * `radius`. Unlit (`MeshBasicMaterial`) on purpose: ownership must read the same
 * under a building's shadow as in open ground, and a lit ring loses the fight
 * exactly when the camera is furthest away.
 *
 * The caller owns the returned mesh — add it to the object that moves, and it
 * follows for free.
 */
export function createTeamRing(owner: UnitOwner, radius: number): Mesh {
  const thickness = Math.max(radius * RING_THICKNESS_RATIO, MIN_RING_THICKNESS);
  const ring = new Mesh(
    new RingGeometry(radius, radius + thickness, 32),
    new MeshBasicMaterial({
      color: new Color(TEAM_COLOR[owner]),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  ring.name = `rts-team-ring-${owner}`;
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = TEAM_RING_Y;
  return ring;
}
