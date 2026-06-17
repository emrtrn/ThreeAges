import { MeshoptDecoder } from "meshoptimizer";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

export class GltfModelLoader {
  private readonly modelPromises = new Map<string, Promise<GLTF>>();
  private readonly gltfLoader = new GLTFLoader();

  constructor() {
    this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  }

  load(id: string, url: string): Promise<GLTF> {
    let promise = this.modelPromises.get(id);
    if (!promise) {
      // Don't keep a rejected load cached: a transient failure (dev server
      // reload, the file being rewritten, a network blip) would otherwise
      // poison this id forever, so every later attempt replays the same
      // "failed to fetch". Drop it on error so the next call can retry.
      promise = this.gltfLoader.loadAsync(url).catch((error) => {
        this.modelPromises.delete(id);
        throw error;
      });
      this.modelPromises.set(id, promise);
    }
    return promise;
  }
}
