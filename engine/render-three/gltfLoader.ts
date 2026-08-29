import type { WebGLRenderer } from "three";
import { MeshoptDecoder } from "meshoptimizer";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { publicUrl } from "../assets/publicUrl";

// Resolved against the deploy base rather than the origin root: a published
// build is served from a subpath, where "/vendor/basis/" would 404 and every
// KTX2 texture would silently fail to transcode. Resolved lazily below, since
// module scope must stay free of `import.meta.env` (see publicUrl).
const KTX2_TRANSCODER_PATH = "vendor/basis/";

let sharedKtx2Loader: KTX2Loader | null = null;

function ktx2LoaderForRenderer(renderer: WebGLRenderer): KTX2Loader {
  sharedKtx2Loader ??= new KTX2Loader().setTranscoderPath(publicUrl(KTX2_TRANSCODER_PATH));
  sharedKtx2Loader.detectSupport(renderer);
  return sharedKtx2Loader;
}

export function createForgeGltfLoader(renderer?: WebGLRenderer): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  if (renderer) loader.setKTX2Loader(ktx2LoaderForRenderer(renderer));
  return loader;
}
