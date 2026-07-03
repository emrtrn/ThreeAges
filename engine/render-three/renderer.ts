import { PCFSoftShadowMap, WebGLRenderer } from "three";

export interface RenderStats {
  drawCalls: number;
  triangles: number;
}

/** GPU resource counts from `renderer.info` (for the `?debug` memory readout). */
export interface RenderMemoryStats {
  /** Live geometries retained on the GPU. */
  geometries: number;
  /** Live textures retained on the GPU. */
  textures: number;
  /** Compiled shader programs. */
  programs: number;
}

export function createSceneRenderer(
  canvas: HTMLCanvasElement,
  maxPixelRatio: number,
): WebGLRenderer {
  if (!canvas.getContext("webgl2")) {
    throw new Error("WebGL2 is not supported on this device/browser.");
  }

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, maxPixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  return renderer;
}

export function readRenderStats(renderer: WebGLRenderer): RenderStats {
  const { calls, triangles } = renderer.info.render;
  return { drawCalls: calls, triangles };
}

export function readRenderMemory(renderer: WebGLRenderer): RenderMemoryStats {
  const { memory, programs } = renderer.info;
  return {
    geometries: memory.geometries,
    textures: memory.textures,
    programs: programs?.length ?? 0,
  };
}
