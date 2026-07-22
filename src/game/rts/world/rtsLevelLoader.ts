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

/** Fetches Level layout and every placed Actor class, then validates its RTS markers. */
export async function loadRtsLevelDefinition(
  levelRef: string,
  balance: { readonly buildings: BuildingBalance; readonly resources: ResourceBalance },
): Promise<RtsLevelDefinition> {
  const layout = await fetchJson(levelRef) as RoomLayout;
  const actors = await Promise.all((layout.actors ?? []).map(async (instance, index) => ({
    index,
    instance,
    def: normalizeActorScriptDef(await fetchJson(instance.classRef), instance.classRef),
  })));
  return adaptRtsLevel(actors, layout.splines ?? [], balance);
}
