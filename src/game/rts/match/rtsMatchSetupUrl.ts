/**
 * Match setup ↔ URL — `THREEAGES_RTS_MAIN_MENU_LOADING_PLAN.md` KARAR 3 and 4.
 *
 * The menu transition is deliberately *not* a navigation (KARAR 2: a reload would
 * throw away everything the menu pre-loaded), which leaves the address bar
 * pointing at the menu while the player is in a match. That is a real loss — a
 * refresh would drop them back to the menu, and the link they copy would not open
 * what they are looking at — so the boot writes the resolved setup back with
 * `history.pushState`. The URL stays the description of what is on screen, and it
 * costs one string instead of a page load.
 *
 * The same parameters are the skip condition on the way in. A URL that already
 * says which match to play has answered the menu's only question, so the menu has
 * nothing to ask and the boot goes straight to loading. That covers the shared
 * link, the refresh, and — through `?level=` — the editor's Play button, which is
 * an author trying a map rather than a player choosing one.
 *
 * Pure TS: `URLSearchParams` is a platform primitive, not a DOM one, so this stays
 * checkable outside a browser (Forge boundary, CLAUDE.md).
 */
import { AI_PROFILES } from "../../data/gameDataTypes";
import { MISSION_MODE_CHOICES } from "../tutorial/missionModeChoice";
import { FOG_OF_WAR_CHOICES } from "../vision/fogOfWarChoice";
import { VICTORY_CONDITION_CHOICES } from "./victoryConditionChoice";
import type { RtsMatchSetupValues } from "./rtsMatchSetup";

export const MATCH_SETUP_PARAMS = {
  mode: "mode",
  victory: "victory",
  fog: "fog",
  difficulty: "difficulty",
  seed: "seed",
} as const;

/**
 * Does this URL already say which match to play?
 *
 * `mode` is the marker rather than "all four present", so a hand-typed
 * `?rts&mode=free` works and a link is not invalidated by a parameter added
 * later — anything missing simply falls back through the same resolution a cold
 * boot uses. `level` is KARAR 4: the editor's Play button hands over a map to
 * try, and an author trying a map does not pass through a menu.
 */
export function urlPinsMatchSetup(params: URLSearchParams): boolean {
  return params.has(MATCH_SETUP_PARAMS.mode) || params.has("level");
}

/**
 * The setup a URL asks for, with `fallback` filling every gap.
 *
 * `fallback` is not a default table — it is the fully resolved boot state
 * (preset → `?flags=` → stored choice), so a parameter that is absent leaves that
 * chain exactly as it was. Only an explicit, *valid* parameter overrides it; a
 * typo falls back rather than failing the boot, because a bad link should still
 * open a playable match.
 */
export function readMatchSetupFromUrl(
  params: URLSearchParams,
  fallback: RtsMatchSetupValues,
): RtsMatchSetupValues {
  return {
    // `?mission=<id>` is the older, still-supported door onto a specific chain.
    // Asking for one *is* asking for the story mode, so it outranks `mode`.
    missionMode: params.has("mission")
      ? "story"
      : pick(params.get(MATCH_SETUP_PARAMS.mode), MISSION_MODE_CHOICES, fallback.missionMode),
    victoryCondition: pick(
      params.get(MATCH_SETUP_PARAMS.victory),
      VICTORY_CONDITION_CHOICES,
      fallback.victoryCondition,
    ),
    fogOfWar: pick(params.get(MATCH_SETUP_PARAMS.fog), FOG_OF_WAR_CHOICES, fallback.fogOfWar),
    aiProfile: pick(params.get(MATCH_SETUP_PARAMS.difficulty), AI_PROFILES, fallback.aiProfile),
  };
}

/**
 * The address the match should be at, as a `?…` string for `pushState`.
 *
 * Built from the incoming parameters rather than from scratch so everything the
 * route already understood — `?debug`, `?preset=`, `?flags=`, `?level=`,
 * `?mission=` — survives the transition. The seed is pinned explicitly because it
 * defaults to `Date.now()`: without it the refresh this function exists to
 * support would open a different map.
 */
export function matchSetupSearch(
  params: URLSearchParams,
  setup: RtsMatchSetupValues,
  seed: number,
): string {
  const next = new URLSearchParams(params);
  next.set(MATCH_SETUP_PARAMS.mode, setup.missionMode);
  next.set(MATCH_SETUP_PARAMS.victory, setup.victoryCondition);
  next.set(MATCH_SETUP_PARAMS.fog, setup.fogOfWar);
  next.set(MATCH_SETUP_PARAMS.difficulty, setup.aiProfile);
  next.set(MATCH_SETUP_PARAMS.seed, String(seed));
  // `?rts` and `?debug` are valueless flags; `URLSearchParams` serialises them as
  // `rts=` , which the route's `has()` checks still read correctly, but the bare
  // form is what every existing link and doc uses, so it is restored.
  return `?${next.toString().replace(/=(?=&|$)/g, "")}`;
}

/**
 * The address the *menu* should be at — the inverse of {@link matchSetupSearch},
 * for the pause card's "Ana Menü".
 *
 * Only the five setup parameters are dropped, and dropping them is the point:
 * `mode` is what {@link urlPinsMatchSetup} reads, so leaving it behind would put
 * the player on a menu whose own URL says "skip the menu" — one refresh and they
 * are back in the match they just left. The seed goes with it because the next
 * match started from the menu is a new match, not a re-run of that one.
 *
 * Everything else the route understands (`?rts`, `?debug`, `?preset=`, `?flags=`,
 * `?mission=`) survives — `?level=` included, and that one is deliberate even
 * though it also pins: an author who arrived from the editor's Play button is
 * still trying that map, so the URL keeps saying so and the next match they start
 * is still that map. A refresh takes them straight back into it, which is KARAR 4
 * doing its job; the in-page button is how they reach the menu.
 */
export function menuSearch(params: URLSearchParams): string {
  const next = new URLSearchParams(params);
  for (const key of Object.values(MATCH_SETUP_PARAMS)) next.delete(key);
  return `?${next.toString().replace(/=(?=&|$)/g, "")}`;
}

function pick<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}
