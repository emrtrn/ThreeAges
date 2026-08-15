/**
 * Worker stones in flight.
 *
 * Like arrows, these are only the visible trace of a combat hit already
 * resolved by `unitCombat`; removing this system cannot change a target's
 * health, cooldown, target choice or route.
 */
import { Box3, Group, Object3D, Vector3 } from "three";

const ROCK_DIAMETER = 0.22;
const DEFAULT_SPEED = 14;

interface ThrownRock {
  readonly model: Object3D;
  readonly from: Vector3;
  readonly to: Vector3;
  readonly duration: number;
  elapsed: number;
}

function fitRockModel(template: Object3D): Object3D {
  const holder = new Group();
  const model = template.clone(true);
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3());
  const largest = Math.max(size.x, size.y, size.z);
  const scale = largest > 0 ? ROCK_DIAMETER / largest : 1;
  const center = bounds.getCenter(new Vector3());
  model.scale.multiplyScalar(scale);
  model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  model.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = false;
  });
  holder.add(model);
  return holder;
}

export class ThrownRockSystem {
  readonly root = new Group();
  private readonly live: ThrownRock[] = [];
  private readonly scratchAhead = new Vector3();
  private rockTemplate: Object3D | null = null;

  constructor() {
    this.root.name = "rts-thrown-rocks";
  }

  setRockModel(template: Object3D | null): void {
    this.rockTemplate = template ? fitRockModel(template) : null;
    this.clear();
  }

  spawn(from: Vector3, to: Vector3, speed = DEFAULT_SPEED): void {
    if (!this.rockTemplate) return;
    const start = from.clone();
    const end = new Vector3(to.x, to.y + 1.05, to.z);
    const distance = start.distanceTo(end);
    if (distance < 0.01) return;
    const model = this.rockTemplate.clone(true);
    model.position.copy(start);
    model.lookAt(end);
    this.root.add(model);
    this.live.push({
      model,
      from: start,
      to: end,
      duration: distance / (Number.isFinite(speed) && speed > 0 ? speed : DEFAULT_SPEED),
      elapsed: 0,
    });
  }

  update(dt: number): void {
    for (let index = this.live.length - 1; index >= 0; index -= 1) {
      const rock = this.live[index]!;
      rock.elapsed += Math.max(0, dt);
      const progress = rock.elapsed / rock.duration;
      if (progress >= 1) {
        this.root.remove(rock.model);
        this.live.splice(index, 1);
        continue;
      }
      rock.model.position.lerpVectors(rock.from, rock.to, progress);
      rock.model.position.y += Math.sin(progress * Math.PI) * 0.7;
      this.scratchAhead.lerpVectors(rock.from, rock.to, Math.min(1, progress + 0.04));
      this.scratchAhead.y += Math.sin(Math.min(1, progress + 0.04) * Math.PI) * 0.7;
      rock.model.lookAt(this.scratchAhead);
      rock.model.rotateZ(dt * 18);
    }
  }

  clear(): void {
    for (const rock of this.live) this.root.remove(rock.model);
    this.live.length = 0;
  }

  dispose(): void {
    this.clear();
    this.rockTemplate = null;
  }
}
