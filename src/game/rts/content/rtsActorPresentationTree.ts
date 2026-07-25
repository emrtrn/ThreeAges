/**
 * Actor Script component tree -> Three.js node tree.
 *
 * Split out of {@link RtsActorVisualFactory} so the part that decides *what the
 * scene graph looks like* needs no renderer and no network: hand it resolved
 * templates and it is a pure function of the authored components. That is what
 * makes "a second StaticMeshComponent really is a second node, at its authored
 * local transform" a unit test rather than a screenshot.
 */
import { Box3, Group, Mesh, type Object3D } from "three";
import { isMeshComponentKind, type ActorScriptDef } from "@engine/scene/actorScript";

const DEGREES_TO_RADIANS = Math.PI / 180;
/** Foundation slabs stand this proud of the ground; models sit on top of them. */
const FOUNDATION_TOP = 0.18;
/** Leave a margin inside the footprint so neighbours never visually touch. */
const MODEL_FOOTPRINT_FILL = 0.86;

function readVec3(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const [x, y, z] = value;
  return typeof x === "number" && typeof y === "number" && typeof z === "number"
    ? [x, y, z]
    : null;
}

/**
 * Build one node per authored component, parented as authored, with each mesh
 * component's resolved model cloned underneath it.
 *
 * Every component becomes a node whether or not it renders, so a mesh hung off a
 * bare Transform keeps that Transform's offset instead of collapsing onto the
 * root. Components whose template is missing still get their node — the tree
 * shape stays honest, and the validator is what refuses to load such a pack.
 */
export function buildActorPresentationTree(
  def: ActorScriptDef,
  name: string,
  resolveTemplate: (assetId: string) => Object3D | undefined,
): Group {
  const root = new Group();
  root.name = `rts-actor-presentation:${name}`;
  root.userData.rtsActorPresentation = true;

  const nodes = new Map<string, Group>();
  for (const component of def.components) {
    const node = new Group();
    node.name = component.id;
    const position = readVec3(component.props.position);
    const rotation = readVec3(component.props.rotation);
    const scale = readVec3(component.props.scale);
    if (position) node.position.set(...position);
    if (rotation) {
      node.rotation.set(
        rotation[0] * DEGREES_TO_RADIANS,
        rotation[1] * DEGREES_TO_RADIANS,
        rotation[2] * DEGREES_TO_RADIANS,
      );
    }
    if (scale) node.scale.set(...scale);
    nodes.set(component.id, node);
  }

  for (const component of def.components) {
    const node = nodes.get(component.id);
    if (!node) continue;
    (component.parent ? nodes.get(component.parent) : root)?.add(node);
    if (!isMeshComponentKind(component.component)) continue;
    const assetId = component.props.assetId;
    const template = typeof assetId === "string" ? resolveTemplate(assetId) : undefined;
    if (!template) continue;
    const model = template.clone(true);
    model.traverse((child) => {
      if (child instanceof Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    node.add(model);
  }

  return root;
}

/**
 * Scale a whole Actor into its gameplay footprint and stand it on the foundation.
 *
 * The bounds are taken over the entire tree, and only the root is scaled and
 * lifted, so a multi-mesh Actor keeps every authored local offset: the wheat
 * stays where the author put it relative to the field instead of each mesh being
 * independently squeezed into the same box.
 */
export function fitPresentationToFootprint(
  model: Object3D,
  footprintWidth: number,
  footprintDepth: number,
): void {
  const sourceBounds = new Box3().setFromObject(model);
  const sourceWidth = sourceBounds.max.x - sourceBounds.min.x;
  const sourceDepth = sourceBounds.max.z - sourceBounds.min.z;
  if (sourceWidth <= 0 || sourceDepth <= 0) return;
  const scale = Math.min(footprintWidth / sourceWidth, footprintDepth / sourceDepth) * MODEL_FOOTPRINT_FILL;
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);
  const fittedBounds = new Box3().setFromObject(model);
  model.position.y += FOUNDATION_TOP - fittedBounds.min.y;
}
