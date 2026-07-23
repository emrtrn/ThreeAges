/** Loads a Forge Level's RTS marker Actors without taking ownership of rendering. */
import { normalizeActorScriptDef } from "@engine/scene/actorScript";
import type { RoomLayout } from "@engine/scene/layout";
import { projectFileUrl } from "@/project/ProjectSystem";
import type { BuildingBalance, ResourceBalance } from "../../data/gameDataTypes";
import { adaptRtsLevel, type RtsLevelDefinition } from "./rtsLevelAdapter";

async function fetchJson(path: string): Promise<unknown> {
  const response = await fetch(projectFileUrl(path), { cache: "no-cache" });
  if (!response.ok) throw new Error(`RTS Level fetch failed: ${path} (${response.status})`);
  return response.json();
}

/** A resolved Level: its validated gameplay markers plus the raw layout for
 *  Faz E's authored-world mounting (the layout carries the static instances,
 *  lights and world settings the markers deliberately do not). */
export interface RtsLevel {
  readonly definition: RtsLevelDefinition;
  readonly layout: RoomLayout;
}

/** Fetches Level layout and every placed Actor class, then validates its RTS markers. */
export async function loadRtsLevel(
  levelRef: string,
  balance: { readonly buildings: BuildingBalance; readonly resources: ResourceBalance },
): Promise<RtsLevel> {
  const layout = await fetchJson(levelRef) as RoomLayout;
  const actors = await Promise.all((layout.actors ?? []).map(async (instance, index) => ({
    index,
    instance,
    def: normalizeActorScriptDef(await fetchJson(instance.classRef), instance.classRef),
  })));
  return { definition: adaptRtsLevel(actors, layout.splines ?? [], balance), layout };
}

/** Back-compat: the marker definition only, for callers that ignore the art. */
export async function loadRtsLevelDefinition(
  levelRef: string,
  balance: { readonly buildings: BuildingBalance; readonly resources: ResourceBalance },
): Promise<RtsLevelDefinition> {
  return (await loadRtsLevel(levelRef, balance)).definition;
}
