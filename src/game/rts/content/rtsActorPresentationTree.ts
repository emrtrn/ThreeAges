/**
 * Actor Script component tree -> Three.js node tree.
 *
 * Split out of {@link RtsActorVisualFactory} so the part that decides *what the
 * scene graph looks like* needs no renderer and no network: hand it resolved
 * templates and it is a pure function of the authored components. That is what
 * makes "a second StaticMeshComponent really is a second node, at its authored
 * local transform" a unit test rather than a screenshot.
 */
import { Box3, Color, Group, Mesh, SkinnedMesh, type Material, type Object3D } from "three";
import { clone as cloneSkeletonHierarchy } from "three/examples/jsm/utils/SkeletonUtils.js";
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
 * Resolves the tinted variant of one of a template's materials.
 *
 * Supplied by the factory so the variant can be cached per asset+tint rather
 * than per unit: forty Archers must share one green material, exactly as they
 * already share one geometry. The default below is the correct behaviour for a
 * caller with nowhere to cache (the engine tests), not a cheaper one.
 */
export type TintedMaterialResolver = (material: Material, tint: string) => Material;

/** Resolves an Actor component's authored material-slot override. */
export type ComponentMaterialResolver = (materialId: string) => Material | undefined;

const defaultTintedMaterial: TintedMaterialResolver = (material, tint) => tintedCopy(material, tint);

/** Clone a material and recolour it, leaving every other authored property alone. */
export function tintedCopy(material: Material, tint: string): Material {
  const copy = material.clone();
  // Only materials that actually have a colour respond; a material without one
  // is left as authored rather than being given a property it never had.
  const colored = copy as Material & { color?: Color };
  if (colored.color instanceof Color) colored.color.set(tint);
  return copy;
}

/**
 * Recolour every mesh under a cloned model.
 *
 * Geometry and skeleton are untouched — this is the one thing an Actor may
 * override per role while still sharing the single character mesh the project
 * ships. It is authored (`materialTint` on the mesh component), never derived
 * from gameplay: team colour stays on the selection ring, where it does not
 * compete with the role's silhouette.
 */
function applyMaterialTint(model: Object3D, tint: string, resolve: TintedMaterialResolver): void {
  model.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.material = Array.isArray(child.material)
      ? child.material.map((entry) => resolve(entry, tint))
      : resolve(child.material, tint);
  });
}

/** Apply one authored material to every primitive rendered by a mesh component. */
function applyComponentMaterial(model: Object3D, material: Material): void {
  model.traverse((child) => {
    if (child instanceof Mesh) child.material = material;
  });
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
/** `userData` key carrying the authored component id of a presentation node. */
export const RTS_ACTOR_COMPONENT_ID = "rtsActorComponentId";

/**
 * The node built for an authored component id, or null.
 *
 * Matched on {@link RTS_ACTOR_COMPONENT_ID} rather than on `name`, so a bone that
 * happens to be called `leftWheelPivot` can never be mistaken for the pivot.
 */
export function findActorComponentNode(root: Object3D, componentId: string): Object3D | null {
  let found: Object3D | null = null;
  root.traverse((child) => {
    if (found === null && child.userData[RTS_ACTOR_COMPONENT_ID] === componentId) found = child;
  });
  return found;
}

export function buildActorPresentationTree(
  def: ActorScriptDef,
  name: string,
  resolveTemplate: (assetId: string) => Object3D | undefined,
  resolveTintedMaterial: TintedMaterialResolver = defaultTintedMaterial,
  resolveComponentMaterial?: ComponentMaterialResolver,
): Group {
  const root = new Group();
  root.name = `rts-actor-presentation:${name}`;
  root.userData.rtsActorPresentation = true;

  const nodes = new Map<string, Group>();
  for (const component of def.components) {
    const node = new Group();
    node.name = component.id;
    // The id in userData, not just in `name`: component ids share a namespace
    // with the model's bone names once a rig is cloned underneath, so anything
    // looking a component up by name can land on a bone instead.
    node.userData[RTS_ACTOR_COMPONENT_ID] = component.id;
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
    // `Object3D.clone` is not enough for a SkeletalMeshComponent: it copies the
    // SkinnedMesh but leaves it bound to the *template's* skeleton, whose bones
    // live outside the scene and are never updated. The clone then skins against
    // stale bone matrices and collapses out of view — the unit's rings and health
    // bar still draw, so the symptom is an invisible body, not a missing actor.
    // SkeletonUtils.clone rebinds each clone to its own bones and is a plain deep
    // clone for the static-mesh case.
    const model = cloneSkeletonHierarchy(template);
    // Tagged so an animator can bind to the model itself rather than to this
    // tree. It matters because animation tracks address nodes *by name*, and
    // authored component ids share a namespace with the model's bone names — a
    // rig with a `root` bone and a component called "root" would otherwise have
    // its clip drive the component node and throw the whole Actor on its back.
    model.userData.rtsActorMeshAssetId = assetId;
    model.traverse((child) => {
      if (child instanceof Mesh) {
        // High-poly skinned units are numerous and animated every frame. At the
        // RTS camera distance their self-shadow detail is not legible, whereas
        // static building meshes remain shadow casters for strategic readability.
        child.castShadow = !(child instanceof SkinnedMesh);
        child.receiveShadow = true;
      }
    });
    const materialSlot = component.props.materialSlot;
    if (typeof materialSlot === "string" && materialSlot.length > 0) {
      const material = resolveComponentMaterial?.(materialSlot);
      if (material) applyComponentMaterial(model, material);
    }
    // Role and faction readability on a one-character pack: every unit is the
    // same rig, told apart by an authored tint — and the Guard authors one per
    // owner, so the two armies read apart at a glance. Untinted components (the
    // Workers, who wear the model's own colours) keep the template's shared
    // materials untouched.
    const tint = component.props.materialTint;
    if (typeof tint === "string" && tint.length > 0) {
      applyMaterialTint(model, tint, resolveTintedMaterial);
    }
    node.add(model);
  }

  return root;
}

/** Ground-plane size of a presentation tree, measured before it is fitted. */
export interface PresentationExtent {
  readonly width: number;
  readonly depth: number;
}

/** The X/Z extent of a whole presentation tree, in the Actor's own units. */
export function presentationExtent(model: Object3D): PresentationExtent {
  const bounds = new Box3().setFromObject(model);
  return { width: bounds.max.x - bounds.min.x, depth: bounds.max.z - bounds.min.z };
}

/**
 * Scale a whole Actor into its gameplay footprint and stand it on the foundation.
 *
 * The bounds are taken over the entire tree, and only the root is scaled and
 * lifted, so a multi-mesh Actor keeps every authored local offset: the wheat
 * stays where the author put it relative to the field instead of each mesh being
 * independently squeezed into the same box.
 *
 * `reference` is what the scale is derived *from*, and it is the difference
 * between a building that grows and one that only changes shape. The art pack
 * models a level ladder as one building in one coordinate space — the hunting
 * camp's level 1 is literally the back-left quarter of the finished camp — so
 * fitting each level to its own bounds blows the small ones up until every level
 * fills the same square: level 1 rendered twice its intended size, sitting off
 * its pad by twice its authored offset, and levelling up made the camp *shrink*.
 * Passing the ladder's largest extent scales every level by the same factor, so
 * a partial model stays partial and stays exactly where it will be once the
 * building is finished. Omitted, the model is its own reference, which is the
 * right answer for anything that has no siblings to agree with.
 */
export function fitPresentationToFootprint(
  model: Object3D,
  footprintWidth: number,
  footprintDepth: number,
  reference: PresentationExtent | null = null,
): void {
  const own = presentationExtent(model);
  if (own.width <= 0 || own.depth <= 0) return;
  const source = reference && reference.width > 0 && reference.depth > 0 ? reference : own;
  const scale = Math.min(footprintWidth / source.width, footprintDepth / source.depth) * MODEL_FOOTPRINT_FILL;
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);
  // The lift is always measured on the model itself: a level that is only part of
  // the building still has to stand on the foundation, not float at the height
  // the finished one would.
  const fittedBounds = new Box3().setFromObject(model);
  model.position.y += FOUNDATION_TOP - fittedBounds.min.y;
}
