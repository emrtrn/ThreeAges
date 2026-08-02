/**
 * Anything on the field that hides until its ground is scouted — §59,
 * GDD 08 §39–§40.
 *
 * The reason this is an interface rather than a list of `Object3D`s: the two
 * kinds of static art on an RTS map cannot be hidden the same way.
 *
 *  - A **prop with its own node** — the blockout ridge, a code-built rock — has
 *    an `Object3D`, and `visible = false` is the whole of it.
 *  - An **authored Level placement** does not. Every copy of a model shares one
 *    {@link InstancedMesh}, so there is no node to switch off; hiding one copy
 *    means zeroing its instance matrix and remembering the original to put back.
 *
 * Collapsing both behind {@link FogProp} is what lets `FogVisibilityBinder` hold
 * one worklist and know nothing about either. That matters more than it sounds:
 * before this existed, the *only* scenery the fog covered was a group named
 * `"rts-central-ridge-art"` in game code, so a model placed in the editor was
 * simply never fogged — and there was no way to fog it without naming it here.
 *
 * §40's latch is what keeps this cheap. `explored` never clears, so each prop is
 * revealed at most once for the whole match and leaves the worklist for good; a
 * Level with ten thousand placements pays ten thousand reveals over twenty
 * minutes, not per tick.
 *
 * View-side only: nothing here reads or writes simulation state.
 */
import { InstancedMesh, Matrix4, Object3D, Vector3 } from "three";

/**
 * One hideable thing, reduced to the two questions the binder asks: where does
 * it stand, and show or hide it.
 */
export interface FogProp {
  /** World X the reveal test is taken at. */
  readonly x: number;
  /** World Z the reveal test is taken at. */
  readonly z: number;
  setRevealed(revealed: boolean): void;
}

/** A prop that owns its node; `visible` is the whole mechanism. */
class ObjectFogProp implements FogProp {
  readonly x: number;
  readonly z: number;

  constructor(private readonly object: Object3D) {
    this.x = object.position.x;
    this.z = object.position.z;
  }

  setRevealed(revealed: boolean): void {
    this.object.visible = revealed;
  }
}

/**
 * One placement inside a batched mesh.
 *
 * Hidden by writing a zero matrix, which collapses the instance to a point and
 * costs nothing to rasterize; revealed by writing back the matrix the loader
 * built. The original is copied at construction rather than read back on demand
 * because by the time a prop is revealed its slot holds the zero matrix, and
 * there would be nothing left to restore from.
 */
class InstancedFogProp implements FogProp {
  readonly x: number;
  readonly z: number;
  private readonly original = new Matrix4();

  constructor(
    private readonly mesh: InstancedMesh,
    private readonly index: number,
    worldPosition: Vector3,
  ) {
    this.x = worldPosition.x;
    this.z = worldPosition.z;
    mesh.getMatrixAt(index, this.original);
  }

  setRevealed(revealed: boolean): void {
    this.mesh.setMatrixAt(this.index, revealed ? this.original : ZERO_MATRIX);
    // Per instance rather than batched per frame: reveals are rare (§40's latch
    // fires once per prop for the whole match), so the flag is set a few times a
    // second at worst, and a caller that forgot to raise it would leave the prop
    // invisible until something else happened to touch the same mesh.
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/**
 * A matrix that maps every vertex onto the origin. Shared and never mutated —
 * `setMatrixAt` copies out of it.
 */
const ZERO_MATRIX = new Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

/** Wrap nodes that own their own visibility. */
export function objectFogProps(objects: readonly Object3D[]): FogProp[] {
  return objects.map((object) => new ObjectFogProp(object));
}

/**
 * One prop per placement across every batched authored mesh.
 *
 * World positions, not instance-local ones: the meshes hang under the authored
 * world's root, which a Level is free to have offset or rotated, and the vision
 * grid is indexed in world space. `updateWorldMatrix` is forced first because
 * this runs the moment the world mounts, before any render has flushed the
 * scene graph's matrices.
 *
 * A model built from several nodes yields several props per placement, all at
 * roughly the same spot and all revealed by the same cell. That is a few extra
 * entries in a worklist that empties itself, and it is the price of not having
 * to know how the loader split the model up.
 */
export function instancedFogProps(meshes: readonly InstancedMesh[]): FogProp[] {
  const props: FogProp[] = [];
  const local = new Matrix4();
  const position = new Vector3();
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    for (let index = 0; index < mesh.count; index += 1) {
      mesh.getMatrixAt(index, local);
      position.setFromMatrixPosition(local).applyMatrix4(mesh.matrixWorld);
      props.push(new InstancedFogProp(mesh, index, position));
    }
  }
  return props;
}
