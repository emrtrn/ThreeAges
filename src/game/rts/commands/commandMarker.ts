/**
 * World command marker — Vertical Slice Plan v0.2 §21 ("Dünya komut işareti").
 *
 * A brief flat ring dropped on the ground where a move order was issued, giving
 * the player visible confirmation of the command point. Markers animate a quick
 * shrink + fade and remove themselves, so no manual cleanup is needed.
 */
import {
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  type Vector3,
} from "three";

const LIFETIME_SECONDS = 0.55;
const START_SCALE = 1.6;
const END_SCALE = 0.9;

interface ActiveMarker {
  readonly mesh: Mesh;
  readonly material: MeshBasicMaterial;
  age: number;
}

export class CommandMarkerSystem {
  readonly root = new Group();
  private readonly geometry = new RingGeometry(0.7, 1.0, 28);
  private readonly markers: ActiveMarker[] = [];

  constructor() {
    this.root.name = "rts-command-markers";
  }

  /** Drop a marker at a ground point (y is forced just above the surface). */
  spawn(point: Vector3, color = "#e8f0c0"): void {
    const material = new MeshBasicMaterial({
      color: new Color(color),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const mesh = new Mesh(this.geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(point.x, 0.05, point.z);
    this.root.add(mesh);
    this.markers.push({ mesh, material, age: 0 });
  }

  update(dt: number): void {
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const marker = this.markers[i];
      if (!marker) continue;
      marker.age += dt;
      const t = marker.age / LIFETIME_SECONDS;
      if (t >= 1) {
        this.root.remove(marker.mesh);
        marker.material.dispose();
        this.markers.splice(i, 1);
        continue;
      }
      const scale = START_SCALE + (END_SCALE - START_SCALE) * t;
      marker.mesh.scale.set(scale, scale, scale);
      marker.material.opacity = 0.9 * (1 - t);
    }
  }

  /** Remove transient markers when resetting the match before their normal fade. */
  clear(): void {
    for (const marker of this.markers) {
      this.root.remove(marker.mesh);
      marker.material.dispose();
    }
    this.markers.length = 0;
  }
}
