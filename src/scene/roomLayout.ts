export interface LayoutPlacement {
  position: [number, number, number];
  rotationYDeg?: number;
  scale?: number;
}

export interface LayoutModelInstances {
  assetId: string;
  placements: LayoutPlacement[];
}

export interface LayoutCharacter {
  assetId: string;
  name?: string;
  position: [number, number, number];
  rotationYDeg?: number;
  scale?: number;
  animation?: string;
}

export interface RoomLayout {
  schema: 1;
  name: string;
  loadGroups: string[];
  instances: LayoutModelInstances[];
  characters: LayoutCharacter[];
}

const BASE_URL = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

export async function loadRoomLayout(pathOrName: string): Promise<RoomLayout> {
  const url = pathOrName.endsWith(".json")
    ? `/__project-file/${encodeURIComponent(pathOrName.replace(/\\/g, "/").replace(/^\/+/, ""))}`
    : `${BASE_URL}layouts/${pathOrName}.json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Room layout failed: ${response.status} ${response.statusText}`,
    );
  }
  return (await response.json()) as RoomLayout;
}

export function degreesToRadians(degrees: number | undefined): number {
  return ((degrees ?? 0) * Math.PI) / 180;
}
