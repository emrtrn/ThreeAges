/**
 * The yellow ground ring that marks a selected unit or building, and its shared
 * pulse.
 *
 * Three call sites built this mesh independently (unit, placed structure,
 * command centre) with the same colours copied by hand, so "make the selection
 * ring breathe" would otherwise have been the same edit three times, and the
 * three would have drifted the first time only one of them was touched.
 *
 * The pulse is driven from a single module-level phase rather than per-ring
 * timers: every selected object must brighten *together*. Rings animating on
 * their own spawn time read as unrelated blinking objects instead of one
 * "these are yours right now" state.
 *
 * The glow is a stack of additive halo annuli parented to the ring itself. Being
 * children means `ring.visible = false` still hides them all (three.js hides the
 * whole subtree), so the existing selection call sites keep working untouched.
 *
 * The glow breathes by fading successive layers in and out, not by scaling
 * anything. Scaling the band would move the ring's edges, which is a lie — the
 * ring's radius states the building's footprint, so it has to hold still while
 * only the light around it moves. Scaling the halo alone has the same problem
 * from the other side: a mesh scales about its centre, so a grown halo lifts off
 * the band and leaves a gap at every radius but one. Static geometry with
 * animated opacity is the only version where the glow reaches outward and the
 * band never budges.
 */
import { AdditiveBlending, Color, Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry } from "three";

/** Ground clearance for selection rings; above `TEAM_RING_Y` so the two never z-fight. */
export const SELECTION_RING_Y = 0.05;
/**
 * Radial width of the solid band — the one knob for every selection ring in the
 * game. Deliberately not a per-call-site option: a unit ring and a building ring
 * that differ in width read as two different kinds of marker, and the whole
 * point of the shared module is that "selected" looks like one thing. Radius
 * still varies (it states the footprint); thickness must not.
 *
 * The halo widths derive from it, so raising this widens the glow with the band.
 */
export const SELECTION_RING_THICKNESS = 0.05;
const RING_SEGMENTS = 48;
/** How far each halo layer bleeds past the previous one, as a multiple of thickness. */
const HALO_SPREAD = 1;
/** Full bright/dim cycles per second. Slow: this is ambient state, not an alarm. */
const PULSE_HZ = 0.55;
const EMISSIVE_MIN = 0.5;
const EMISSIVE_MAX = 3;
/**
 * Peak opacity per halo layer, innermost first. Additive blending stacks them,
 * so the falloff the player sees is the sum — brightest against the band and
 * thinning outward, without a gradient texture.
 */
const HALO_LAYER_OPACITY = [0.24, 0.15, 0.09] as const;
/**
 * Fraction of the pulse each successive layer waits before it starts fading in.
 * This is what makes the glow *reach*: the inner layer is already lit while the
 * outer ones are still dark, so brightening travels outward from the band.
 */
const HALO_LAYER_DELAY = 0.3;
/** How much of the innermost layer stays lit at the bottom of the pulse. */
const HALO_FLOOR = 0.35;

export interface SelectionRingOptions {
  /** Mesh name for scene-graph debugging. */
  readonly name?: string;
  /** Height above the object's origin. Defaults to {@link SELECTION_RING_Y}. */
  readonly y?: number;
  /** Band colour; the halo is derived from it. Defaults to the selection yellow. */
  readonly color?: string;
  /** Emissive tint of the lit band. Defaults to the selection yellow's dark twin. */
  readonly emissive?: string;
}

const DEFAULT_COLOR = "#f2f27a";
const DEFAULT_EMISSIVE = "#8f8f20";

/**
 * Live rings, held weakly: a unit that dies or a building that is razed drops
 * its ring with the rest of its scene graph, and nothing here should keep that
 * memory alive or need a matching `unregister` call at every removal site.
 */
const registered = new Set<WeakRef<Mesh>>();
let pulsePhase = 0;

/**
 * A flat pulsing selection ring laid on the ground, sized so its inner edge sits
 * at `innerRadius`. The caller owns the mesh — add it to the object that moves,
 * toggle `visible` to select, and the pulse follows for free.
 */
export function createSelectionRing(innerRadius: number, options: SelectionRingOptions = {}): Mesh {
  const thickness = SELECTION_RING_THICKNESS;
  const ring = new Mesh(
    new RingGeometry(innerRadius, innerRadius + thickness, RING_SEGMENTS),
    new MeshStandardMaterial({
      color: new Color(options.color ?? DEFAULT_COLOR),
      emissive: new Color(options.emissive ?? DEFAULT_EMISSIVE),
      emissiveIntensity: EMISSIVE_MAX,
      roughness: 0.5,
    }),
  );
  ring.name = options.name ?? "rts-selection-ring";
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = options.y ?? SELECTION_RING_Y;
  ring.visible = false;

  HALO_LAYER_OPACITY.forEach((peak, layer) => {
    const spread = thickness * HALO_SPREAD * (layer + 1);
    const halo = new Mesh(
      new RingGeometry(
        Math.max(0.01, innerRadius - spread),
        innerRadius + thickness + spread,
        RING_SEGMENTS,
      ),
      new MeshBasicMaterial({
        color: new Color(options.color ?? DEFAULT_COLOR),
        transparent: true,
        opacity: peak,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    halo.name = `${ring.name}-glow-${layer}`;
    halo.userData.haloLayer = layer;
    // Local -z is world-down once the ring is laid flat, so the halo stack sits
    // just under the solid band instead of z-fighting it where they overlap.
    halo.position.z = -0.005 - layer * 0.001;
    ring.add(halo);
  });

  registered.add(new WeakRef(ring));
  return ring;
}

/**
 * Advance the shared pulse one rendered frame. Runs on the render delta, not the
 * simulation's, so the ring breathes at the same rate at any game speed.
 */
export function updateSelectionRingPulse(deltaSeconds: number): void {
  pulsePhase = (pulsePhase + Math.max(0, deltaSeconds) * PULSE_HZ * Math.PI * 2) % (Math.PI * 2);
  const t = 0.5 + 0.5 * Math.sin(pulsePhase);
  for (const ref of registered) {
    const ring = ref.deref();
    if (!ring) {
      registered.delete(ref);
      continue;
    }
    // Hidden rings are the common case (most objects are unselected), and a
    // material nobody draws costs nothing to leave stale.
    if (!ring.visible) continue;
    const material = ring.material;
    if (material instanceof MeshStandardMaterial) {
      material.emissiveIntensity = EMISSIVE_MIN + (EMISSIVE_MAX - EMISSIVE_MIN) * t;
    }
    for (const halo of ring.children) {
      if (!(halo instanceof Mesh) || !(halo.material instanceof MeshBasicMaterial)) continue;
      const layer = typeof halo.userData.haloLayer === "number" ? halo.userData.haloLayer : 0;
      const peak = HALO_LAYER_OPACITY[layer] ?? 0;
      // Each layer covers the tail of the pulse the one inside it has already
      // passed, so the lit edge travels outward instead of the whole glow
      // flashing at once.
      const reveal = clamp01((t - layer * HALO_LAYER_DELAY) / (1 - HALO_LAYER_DELAY));
      halo.material.opacity = peak * (layer === 0 ? HALO_FLOOR + (1 - HALO_FLOOR) * reveal : reveal);
    }
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
