import { publicUrl } from "@engine/assets/publicUrl";

export interface ProjectManifest {
  schema: 1;
  name: string;
  type: string;
  version: string;
  entry: string;
  publicDir: string;
  editor: {
    defaultScene: string;
    assetCatalog?: string;
    assetManifest: string;
    /** Optional project-relative path to a gameplay metadata schema (Details panel). */
    metadataSchema?: string;
    /** Optional URL of the project's runtime dev server, opened by Play/Test (P). */
    previewUrl?: string;
    /**
     * Whether Play/Test adds the editor's current Level as `?level=`.
     * Defaults to true so generic projects always preview what was just saved.
     */
    appendActiveLevelToPreview?: boolean;
    gridSize?: number;
    gridEnabled?: boolean;
    snapRotationDeg?: number;
    snapRotationEnabled?: boolean;
    snapScale?: number;
    snapScaleEnabled?: boolean;
  };
  scripts: {
    preview?: string;
    build?: string;
    package?: string;
  };
  output: {
    distDir: string;
  };
}

export interface ActiveProject {
  manifest: ProjectManifest;
  manifestPath: string;
  rootName: string;
}

let activeProjectPromise: Promise<ActiveProject> | null = null;

/**
 * Loads this project's manifest. Single-codebase template: the manifest is a
 * static file bundled in `public/`, fetched directly (works in dev and in the
 * packaged game) — no external-project dev middleware involved.
 */
export async function loadActiveProject(): Promise<ActiveProject> {
  activeProjectPromise ??= fetch("/project.3dgame.json").then(async (response) => {
    if (!response.ok) {
      throw new Error(`Project manifest failed: ${response.status} ${response.statusText}`);
    }
    const manifest = (await response.json()) as ProjectManifest;
    return {
      manifest,
      manifestPath: "project.3dgame.json",
      rootName: manifest.name,
    };
  });
  return activeProjectPromise;
}

/**
 * URL for a path relative to the project's public root.
 *
 * Vite serves `public/` at the deploy base — `/` in dev, but a *relative* base
 * in a build, because a published game is served from a subpath it does not
 * control (see `publicUrl`). This is the single funnel every project file goes
 * through — manifest, models, materials, UVW and mesh-paint sidecars, layouts —
 * so resolving here is what makes the packaged build work off the origin root.
 */
export function projectFileUrl(publicRelativePath: string): string {
  return publicUrl(publicRelativePath);
}

export function projectPublicFileUrl(
  _manifest: ProjectManifest,
  publicRelativePath: string,
): string {
  // Manifest paths are already relative to the public root in the single
  // codebase, so publicDir no longer needs to be prepended.
  return projectFileUrl(publicRelativePath);
}

export function dirnameProjectPath(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const slash = normalized.lastIndexOf("/");
  return slash >= 0 ? normalized.slice(0, slash) : "";
}
