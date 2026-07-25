/**
 * The visible stand-in for an Actor that could not be loaded.
 *
 * A broken asset used to take the whole pack down to the legacy path, which hid
 * the breakage behind art that still looked plausible. This is the opposite
 * choice: the one bad building is replaced by something no one can mistake for
 * finished work, the rest of the pack keeps rendering, and the failure is
 * counted in the debug overlay and the log rather than inferred from a screenshot.
 *
 * It is built from code geometry on purpose — a placeholder that loads an asset
 * can fail for the same reason the thing it is replacing failed.
 */
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";

/** Marks a placeholder subtree for tests and debug tooling. */
export const RTS_ACTOR_PLACEHOLDER_FLAG = "rtsActorPlaceholder";

const PLACEHOLDER_COLOR = 0xff00ff;

/**
 * A unit cube standing on y=0, so the caller's footprint fit scales it to the
 * gameplay footprint exactly as it would a real model.
 */
export function createRtsActorPlaceholder(ref: string): Group {
  const root = new Group();
  root.name = `rts-actor-placeholder:${ref}`;
  root.userData[RTS_ACTOR_PLACEHOLDER_FLAG] = true;
  root.userData.rtsActorPresentation = true;

  const body = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({
      color: PLACEHOLDER_COLOR,
      emissive: PLACEHOLDER_COLOR,
      emissiveIntensity: 0.35,
      roughness: 1,
    }),
  );
  body.name = "rts-actor-placeholder-body";
  body.position.y = 0.5;
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);
  return root;
}

/** True when a visual is the stand-in rather than authored art. */
export function isRtsActorPlaceholder(object: { userData: Record<string, unknown> }): boolean {
  return object.userData[RTS_ACTOR_PLACEHOLDER_FLAG] === true;
}
