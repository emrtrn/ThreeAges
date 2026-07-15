/** Development-only world-space diagnostics for the mutable road graph. */
import {
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from "three";

import type { RoadComponent, RoadGraph } from "./roadGraph";

const COMPONENT_COLORS = ["#5bd4ff", "#ffbc5b", "#d45bff", "#7ee078", "#ff6b85"];
const NODE_HEIGHT = 0.23;
const EDGE_HEIGHT = 0.19;

/** Draws color-coded road nodes and edges once per graph topology change. */
export class RoadDebugView {
  readonly root = new Group();
  private readonly nodeGeometry: SphereGeometry;
  private readonly nodeMaterials: MeshBasicMaterial[];
  private readonly edgeMaterials: LineBasicMaterial[];
  private readonly edgeGeometries: BufferGeometry[] = [];
  private renderedVersion = -1;

  constructor(private readonly roads: RoadGraph) {
    this.root.name = "rts-road-debug";
    this.nodeGeometry = new SphereGeometry(this.roads.cellSize * 0.16, 10, 8);
    this.nodeMaterials = COMPONENT_COLORS.map((color) => new MeshBasicMaterial({
      color: new Color(color),
      depthTest: false,
    }));
    this.edgeMaterials = COMPONENT_COLORS.map((color) => new LineBasicMaterial({
      color: new Color(color),
      depthTest: false,
      transparent: true,
      opacity: 0.9,
    }));
    this.refresh();
  }

  refresh(): void {
    if (this.renderedVersion === this.roads.version) return;
    this.disposeEdgeGeometries();
    this.root.clear();
    for (const component of this.roads.components()) this.addComponent(component);
    this.renderedVersion = this.roads.version;
  }

  dispose(): void {
    this.disposeEdgeGeometries();
    this.root.clear();
    this.nodeGeometry.dispose();
    for (const material of this.nodeMaterials) material.dispose();
    for (const material of this.edgeMaterials) material.dispose();
  }

  private addComponent(component: RoadComponent): void {
    const colorIndex = (component.id - 1) % COMPONENT_COLORS.length;
    const nodeMaterial = this.nodeMaterials[colorIndex];
    const edgeMaterial = this.edgeMaterials[colorIndex];
    if (!nodeMaterial || !edgeMaterial) return;
    const cells = new Set(component.cells.map((cell) => `${cell.x}:${cell.z}`));
    for (const cell of component.cells) {
      const node = new Mesh(this.nodeGeometry, nodeMaterial);
      node.name = `rts-road-debug-node-${component.id}`;
      node.position.set(cell.x, NODE_HEIGHT, cell.z);
      node.renderOrder = 2;
      this.root.add(node);
      for (const neighbor of this.forwardNeighbors(cell.x, cell.z)) {
        if (!cells.has(`${neighbor.x}:${neighbor.z}`)) continue;
        const geometry = new BufferGeometry().setFromPoints([
          new Vector3(cell.x, EDGE_HEIGHT, cell.z),
          new Vector3(neighbor.x, EDGE_HEIGHT, neighbor.z),
        ]);
        this.edgeGeometries.push(geometry);
        const edge = new Line(geometry, edgeMaterial);
        edge.name = `rts-road-debug-edge-${component.id}`;
        edge.renderOrder = 1;
        this.root.add(edge);
      }
    }
  }

  private forwardNeighbors(x: number, z: number): readonly { x: number; z: number }[] {
    const step = this.roads.cellSize;
    return [{ x: x + step, z }, { x, z: z + step }];
  }

  private disposeEdgeGeometries(): void {
    for (const geometry of this.edgeGeometries) geometry.dispose();
    this.edgeGeometries.length = 0;
  }
}
