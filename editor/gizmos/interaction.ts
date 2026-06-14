import {
  Camera,
  Matrix4,
  Object3D,
  Plane,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from "three";

import {
  selectionToTransform,
  type EditableSelection,
  type EditableTransform,
} from "@editor/core/editableScene";
import { clamp } from "@editor/core/numeric";
import type { Selection } from "@editor/core/selection";
import { transformToMatrix } from "@editor/render-three/transformMatrices";
import { degreesToRadians } from "@engine/scene/transform";
import type { Vec3 } from "@engine/scene/layout";
import {
  isPlaneAxis,
  type GizmoPlaneAxis,
} from "./axes";
import {
  gizmoHandlesEqual,
  type GizmoHandle,
} from "./handles";

const DEFAULT_SCREEN_SIZE_PX = 118;

export interface LinkedMoveStart {
  selection: Selection;
  startTransform: EditableTransform;
}

export type GizmoPointerDrag =
  | {
      mode: "move";
      axis: GizmoHandle["axis"];
      selection: Selection;
      offset: Vector3;
      pointerId: number;
      startTransform: EditableTransform;
      startPosition: Vec3;
      startClientX: number;
      startClientY: number;
      freeMoveRight?: Vector3 | undefined;
      freeMoveUp?: Vector3 | undefined;
      linkedTransforms?: LinkedMoveStart[] | undefined;
      movePlane?: Plane | undefined;
      planeStartHit?: Vector3 | undefined;
      /** When set, the move handles drag the pivot point instead of the object. */
      pivotEdit?: boolean | undefined;
      /** Inverse of the fixed object world matrix, to map dragged world to local pivot. */
      pivotMatrixInverse?: Matrix4 | undefined;
      /** Pivot value at drag start, for the undo step. */
      startPivot?: Vec3 | undefined;
    }
  | {
      mode: "rotate";
      axis: GizmoHandle["axis"];
      selection: Selection;
      pointerId: number;
      startTransform: EditableTransform;
      startClientX: number;
      startRotation: Vec3;
      linkedTransforms?: LinkedMoveStart[] | undefined;
      pivotWorld?: Vector3 | undefined;
      pivot?: Vec3 | undefined;
    }
  | {
      mode: "scale";
      axis: GizmoHandle["axis"];
      selection: Selection;
      pointerId: number;
      startTransform: EditableTransform;
      startClientX: number;
      startClientY: number;
      startScale: Vec3;
      linkedTransforms?: LinkedMoveStart[] | undefined;
      pivotWorld?: Vector3 | undefined;
      pivot?: Vec3 | undefined;
    };

export interface CreateGizmoPointerDragOptions {
  handle: GizmoHandle;
  selection: Selection;
  selected: EditableSelection;
  pointerId: number;
  clientX: number;
  clientY: number;
  floorHit: Vector3 | null;
  freeMoveBasis: { right: Vector3; up: Vector3 };
  linkedTransforms?: LinkedMoveStart[] | undefined;
  descendantTransforms?: LinkedMoveStart[] | undefined;
  movePlane?: Plane | undefined;
  planeStartHit?: Vector3 | undefined;
  pivot: Vec3;
  pivotWorld: Vector3 | null;
  pivotEditing: boolean;
}

export class GizmoInteractionStore {
  private active: GizmoHandle | null = null;
  private hovered: GizmoHandle | null = null;

  get activeHandle(): GizmoHandle | null {
    return this.active;
  }

  get hoveredHandle(): GizmoHandle | null {
    return this.hovered;
  }

  beginDrag(handle: GizmoHandle): void {
    this.active = { ...handle };
    this.hovered = null;
  }

  endDrag(): void {
    this.active = null;
  }

  setHover(handle: GizmoHandle | null): boolean {
    if (gizmoHandlesEqual(handle, this.hovered)) return false;
    this.hovered = handle ? { ...handle } : null;
    return true;
  }

  clearHover(): boolean {
    if (!this.hovered) return false;
    this.hovered = null;
    return true;
  }
}

export function gizmoDragBaseWorld(
  selected: EditableSelection,
  pivotWorld: Vector3 | null,
  pivotEditing: boolean,
): Vector3 {
  return (pivotEditing ? pivotWorld : null) ?? new Vector3(...selected.position);
}

export function createGizmoMovePlane(
  handle: GizmoHandle,
  base: Vector3,
  gizmoQuaternion: Quaternion,
): Plane | undefined {
  if (handle.tool !== "move" || !isPlaneAxis(handle.axis)) return undefined;
  return new Plane().setFromNormalAndCoplanarPoint(
    planeAxisNormalWorld(handle.axis, gizmoQuaternion),
    base,
  );
}

export function createGizmoPointerDrag(
  options: CreateGizmoPointerDragOptions,
): GizmoPointerDrag {
  const {
    handle,
    selection,
    selected,
    pointerId,
    clientX,
    clientY,
    floorHit,
    freeMoveBasis,
    linkedTransforms,
    descendantTransforms,
    movePlane,
    planeStartHit,
    pivot,
    pivotWorld,
    pivotEditing,
  } = options;
  const startTransform = selectionToTransform(selected);

  if (handle.tool === "move") {
    const base = gizmoDragBaseWorld(selected, pivotWorld, pivotEditing);
    return {
      mode: "move",
      axis: handle.axis,
      selection,
      pointerId,
      startTransform,
      offset: floorHit ? new Vector3(base.x - floorHit.x, 0, base.z - floorHit.z) : new Vector3(),
      startPosition: [base.x, base.y, base.z],
      startClientX: clientX,
      startClientY: clientY,
      freeMoveRight: freeMoveBasis.right,
      freeMoveUp: freeMoveBasis.up,
      linkedTransforms: pivotEditing ? undefined : linkedTransforms,
      movePlane,
      planeStartHit,
      pivotEdit: pivotEditing ? true : undefined,
      pivotMatrixInverse: pivotEditing ? transformToMatrix(startTransform).invert() : undefined,
      startPivot: pivotEditing ? pivot : undefined,
    };
  }

  const hasPivot = pivot[0] !== 0 || pivot[1] !== 0 || pivot[2] !== 0;
  if (handle.tool === "rotate") {
    return {
      mode: "rotate",
      axis: handle.axis,
      selection,
      pointerId,
      startTransform,
      startClientX: clientX,
      startRotation: [...selected.rotation],
      linkedTransforms: descendantTransforms,
      pivot: hasPivot ? pivot : undefined,
      pivotWorld: hasPivot ? pivotWorld ?? undefined : undefined,
    };
  }

  return {
    mode: "scale",
    axis: handle.axis,
    selection,
    pointerId,
    startTransform,
    startClientX: clientX,
    startClientY: clientY,
    startScale: [...selected.scale],
    linkedTransforms: descendantTransforms,
    pivot: hasPivot ? pivot : undefined,
    pivotWorld: hasPivot ? pivotWorld ?? undefined : undefined,
  };
}

export function pickGizmoHandle(
  raycaster: Raycaster,
  camera: Camera,
  pointerNdc: Vector2,
  visible: boolean,
  pickables: Object3D[],
): GizmoHandle | null {
  if (!visible || pickables.length === 0) return null;
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects(pickables, true);
  const handle = hits[0]?.object.userData.gizmoHandle as GizmoHandle | undefined;
  return handle ?? null;
}

export function calculateGizmoScreenScale(
  cameraFovDegrees: number,
  cameraDistance: number,
  viewportHeight: number,
  screenSizePx: number = DEFAULT_SCREEN_SIZE_PX,
): number {
  const safeViewportHeight = viewportHeight || 1;
  const distance = Math.max(0.01, cameraDistance);
  const viewHeight = 2 * Math.tan(degreesToRadians(cameraFovDegrees) / 2) * distance;
  const worldUnitsPerPixel = viewHeight / safeViewportHeight;
  return clamp(worldUnitsPerPixel * screenSizePx, 0.35, 4);
}

export function screenSpaceMoveBasis(cameraQuaternion: Quaternion): { right: Vector3; up: Vector3 } {
  return {
    right: new Vector3(1, 0, 0).applyQuaternion(cameraQuaternion).normalize(),
    up: new Vector3(0, 1, 0).applyQuaternion(cameraQuaternion).normalize(),
  };
}

export function planeAxisNormalWorld(axis: GizmoPlaneAxis, gizmoQuaternion: Quaternion): Vector3 {
  const local =
    axis === "xy"
      ? new Vector3(0, 0, 1)
      : axis === "yz"
        ? new Vector3(1, 0, 0)
        : new Vector3(0, 1, 0);
  return local.applyQuaternion(gizmoQuaternion).normalize();
}
