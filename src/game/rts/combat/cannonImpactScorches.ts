/**
 * The dark, soft-edged marks artillery shells leave on the ground.
 *
 * A mark is deliberately a view-side afterimage of a shell landing. It neither
 * owns damage nor asks what was hit: {@link CannonballSystem} reports a landed
 * shell after its flight, and the RTS shell adds one here. That keeps the
 * scorch, burst and delayed damage in the same moment without making a decal a
 * gameplay collider or a second combat timeline.
 *
 * This is a lightweight ground decal rather than a projected texture. A shared
 * radial shader gives every instance a transparent black centre that eases to
 * nothing at its rim, so there is no bitmap to load or atlas to maintain. The
 * small fixed pool also makes a sustained cannon barrage bounded: an old mark
 * is replaced before a field can grow an unbounded number of drawables.
 */
import {
  CircleGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  ShaderMaterial,
  Vector3,
} from "three";

/** A full field can retain this many recent shell scars at once. */
const MAX_SCORCHES = 24;
/** Simulation seconds a mark remains before it is retired. */
export const CANNON_SCORCH_SECONDS = 36;
/** The final seconds of a mark's life spent fading away. */
const FADE_SECONDS = 6;
/** Lift off the sampled terrain; enough to avoid z-fighting, not to float. */
const SURFACE_OFFSET = 0.025;

interface Scorch {
  readonly position: Vector3;
  readonly scale: number;
  readonly rotation: number;
  age: number;
}

/** A stable 0..1 variation from a world-space landing point. */
function scorchVariation(x: number, z: number): number {
  const value = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Instanced, radial ground scorch layer for artillery impacts.
 *
 * The public surface only accepts a landed position and presentation sources
 * (terrain/fog). No combat type crosses this boundary, which means a headless
 * match remains wholly independent of this class.
 */
export class CannonImpactScorches {
  readonly root = new Group();
  private readonly geometry = new CircleGeometry(1, 20).rotateX(-Math.PI / 2);
  private readonly material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute float instanceOpacity;
      varying vec2 vUv;
      varying float vOpacity;
      void main() {
        vUv = uv;
        vOpacity = instanceOpacity;
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      varying float vOpacity;
      void main() {
        float radius = length(vUv - vec2(0.5)) * 2.0;
        float edge = 1.0 - smoothstep(0.32, 1.0, radius);
        gl_FragColor = vec4(vec3(0.018), edge * vOpacity * 0.62);
      }
    `,
  });
  private readonly mesh: InstancedMesh;
  private readonly opacity: InstancedBufferAttribute;
  private readonly matrix = new Matrix4();
  private readonly scale = new Vector3();
  private readonly marks: Scorch[] = [];
  private groundHeightAt: ((x: number, z: number) => number) | null = null;
  private visibleAt: ((x: number, z: number) => boolean) | null = null;

  constructor() {
    this.root.name = "rts-cannon-impact-scorches";
    this.opacity = new InstancedBufferAttribute(new Float32Array(MAX_SCORCHES), 1);
    this.geometry.setAttribute("instanceOpacity", this.opacity);
    this.mesh = new InstancedMesh(this.geometry, this.material, MAX_SCORCHES);
    this.mesh.name = "rts-cannon-impact-scorch-instances";
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = false;
    this.mesh.renderOrder = 1;
    this.root.add(this.mesh);
  }

  /** Current retained marks, including ones temporarily hidden by fog. */
  get count(): number {
    return this.marks.length;
  }

  /** Where a world-space shell point meets the terrain. */
  setGroundSampler(sample: ((x: number, z: number) => number) | null): void {
    this.groundHeightAt = sample;
  }

  /** Avoid revealing artillery fire in ground the player cannot currently see. */
  setVisibilityTest(test: ((x: number, z: number) => boolean) | null): void {
    this.visibleAt = test;
  }

  /**
   * Leave one scorch at a landed shell's X/Z point.
   *
   * The slight stable variation prevents a barrage from reading as a stamped
   * grid, while avoiding ambient randomness that would make a replay differ.
   */
  add(position: Vector3): void {
    const variation = scorchVariation(position.x, position.z);
    const y = this.groundHeightAt?.(position.x, position.z) ?? position.y;
    this.marks.push({
      position: new Vector3(position.x, y + SURFACE_OFFSET, position.z),
      scale: 1.35 + variation * 0.85,
      rotation: variation * Math.PI * 2,
      age: 0,
    });
    if (this.marks.length > MAX_SCORCHES) this.marks.shift();
    this.writeInstances();
  }

  /**
   * Age marks in simulation time, so a fast-forwarded battle also advances its
   * aftermath. Rendering still calls this on frame delta for smooth fading.
   */
  update(deltaSeconds: number, simulationSpeed = 1): void {
    const step = Math.max(0, deltaSeconds)
      * (Number.isFinite(simulationSpeed) && simulationSpeed > 0 ? simulationSpeed : 1);
    if (step <= 0) return;
    for (const mark of this.marks) mark.age += step;
    while (true) {
      const oldest = this.marks[0];
      if (!oldest || oldest.age < CANNON_SCORCH_SECONDS) break;
      this.marks.shift();
    }
    this.writeInstances();
  }

  /** A restarted match has no artillery history on its new field. */
  clear(): void {
    this.marks.length = 0;
    this.mesh.count = 0;
  }

  dispose(): void {
    this.clear();
    this.root.remove(this.mesh);
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }

  private writeInstances(): void {
    let written = 0;
    for (const mark of this.marks) {
      if (this.visibleAt && !this.visibleAt(mark.position.x, mark.position.z)) continue;
      const remaining = CANNON_SCORCH_SECONDS - mark.age;
      const opacity = remaining < FADE_SECONDS ? Math.max(0, remaining / FADE_SECONDS) : 1;
      this.matrix.makeRotationY(mark.rotation);
      this.matrix.scale(this.scale.setScalar(mark.scale));
      this.matrix.setPosition(mark.position);
      this.mesh.setMatrixAt(written, this.matrix);
      this.opacity.setX(written, opacity);
      written += 1;
    }
    this.mesh.count = written;
    if (written > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.opacity.needsUpdate = true;
    }
  }
}
