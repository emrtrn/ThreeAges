import type { WebGLRenderer } from "three";
import { MeshoptDecoder } from "meshoptimizer";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";

const KTX2_TRANSCODER_PATH = "/vendor/basis/";

let sharedKtx2Loader: KTX2Loader | null = null;

function ktx2LoaderForRenderer(renderer: WebGLRenderer): KTX2Loader {
  sharedKtx2Loader ??= new KTX2Loader().setTranscoderPath(KTX2_TRANSCODER_PATH);
  sharedKtx2Loader.detectSupport(renderer);
  return sharedKtx2Loader;
}

export function createForgeGltfLoader(renderer?: WebGLRenderer): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  if (renderer) loader.setKTX2Loader(ktx2LoaderForRenderer(renderer));
  return loader;
}
