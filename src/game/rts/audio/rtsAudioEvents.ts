/**
 * Which RTS moments have a sound, and what that sound is called — audio plan
 * Faz 0/1.
 *
 * The event *ids* live here; what each one sounds like lives in
 * `public/game-data/audio/events.json`. That split is the whole point: mix
 * levels, cooldowns and distances get retuned by ear and must not need a code
 * change, while the set of moments the game can make a sound at is a contract
 * two files have to agree on.
 *
 * Pure (no Three.js, no subsystem), so `test:engine` can check that agreement
 * without a renderer — which is the one failure this line cannot otherwise
 * report: an event id named here that no table entry answers is a sound that
 * silently never plays.
 */

import type { UnitRoleId } from "../../data/gameDataTypes";
import type { RtsNotificationKind, RtsNotificationSeverity } from "../ui/rtsNotifications";
import type { RtsMusicState } from "./rtsMusicState";
import { RTS_ZONE_AMBIENCE } from "./rtsZoneAmbience";

/**
 * Sounds triggered by an animation notify.
 *
 * These names are not invented here. They are authored on the units' clips, live
 * in the `*.skeleton.json` sidecars, and reach this module through the same
 * event stream the particle bursts ride — `rtsNotifyEffects.ts` reserved them
 * for exactly this consumer and said so:
 *
 *   "A name with no entry here is not an error and not a gap: it is a marker the
 *    asset authors for a consumer that does not exist yet."
 *
 * This is that consumer. A notify name absent from this map simply makes no
 * sound; it is not reported as a missing event, because plenty of markers exist
 * for the renderer alone.
 */
export const RTS_NOTIFY_AUDIO_EVENTS: Readonly<Record<string, string>> = {
  // The four that were authored for audio and nothing else — see
  // `RTS_NOTIFY_AUDIO_ONLY`. Every one of them must appear here, or it is a
  // marker on a clip that no longer has any consumer at all.
  footstep: "unit.footstep",
  "chop-impact": "unit.chop_impact",
  "sword-swing": "combat.sword_swing",
  "arrow-release": "combat.arrow_release",
  // Drawn *and* heard: a blow landing is the readable half of a fight, and a gun
  // coming apart is the loudest thing on the field.
  "body-impact": "combat.body_impact",
  "wreck-blast": "siege.wreck_blast",
};

/** The audio event a notify fires, or null when the marker is silent by design. */
export function rtsNotifyAudioEvent(notifyName: string): string | null {
  return RTS_NOTIFY_AUDIO_EVENTS[notifyName] ?? null;
}

/**
 * What one rig's copy of a shared marker sounds like, when the shared answer is
 * wrong for it.
 *
 * `RTS_NOTIFY_AUDIO_EVENTS` maps a marker name to one sound for the whole game,
 * which is right for every marker that means the same thing wherever it was
 * authored. `footstep` on the Siege rig is the case where that stops being true,
 * and §82.4's armour split is what exposed it: `siege` is `heavy`, so the gun
 * carriage began playing the boots produced for the Guard. A wheeled gun neither
 * walks nor wears boots, and the four marks on its rig are wheel contacts.
 *
 * The axis here is deliberately **not** a third armour class. Armour answers
 * "how much does a blow landing on this hurt", which `siege` shares with the
 * Guard honestly; what differs is the *mechanism* that made the sound, and that
 * is a property of the rig, not of the unit's toughness. Widening `armorClass`
 * to carry it would have made a combat number answer an animation question, and
 * `combat.body_impact_heavy` would then have needed a siege set it does not want.
 *
 * Two kinds of override, because a rig can disagree with the shared sound in two
 * different ways:
 *
 * - `instead` **replaces** it. The wheel is what the marker means here, so the
 *   footstep must not also play.
 * - `alongside` **adds** to it. The carriage groans as the gun rolls, and no
 *   marker of its own exists for that; it rides the contact marks and thins
 *   itself through its own `cooldownMs`, which is what keeps a body sound from
 *   firing four times per gait cycle. One marker feeding two rates is the reason
 *   these are two events rather than one clip family carrying both layers — a
 *   single set cannot hold a per-contact rate and a per-few-seconds rate at once.
 */
export interface RtsRoleNotifyAudio {
  /** Played *instead of* the shared sound — falls back to it until clips ship. */
  readonly instead?: string;
  /** Played *in addition*, and simply silent until the table answers. */
  readonly alongside?: readonly string[];
}

/** §16's artillery, whose rig means something different by `footstep`. */
export const RTS_SIEGE_WHEEL_ROLL = "siege.wheel_roll";
export const RTS_SIEGE_CARRIAGE_CREAK = "siege.carriage_creak";

/** Which rig disagrees with the shared sound of which marker. */
export const RTS_ROLE_NOTIFY_AUDIO: Readonly<
  Partial<Record<UnitRoleId, Readonly<Record<string, RtsRoleNotifyAudio>>>>
> = {
  siege: {
    footstep: { instead: RTS_SIEGE_WHEEL_ROLL, alongside: [RTS_SIEGE_CARRIAGE_CREAK] },
  },
};

/**
 * The override for this rig's copy of a marker, or null when it has none.
 *
 * Kept as a lookup returning null rather than as a resolver returning a list,
 * because this runs on every footfall of every visible unit and the answer is
 * null for all four markers of three of the four rigs. A list would allocate on
 * the hot path to say "nothing special here".
 */
export function rtsRoleNotifyAudio(
  notifyName: string,
  role: UnitRoleId | null,
): RtsRoleNotifyAudio | null {
  if (role === null) return null;
  return RTS_ROLE_NOTIFY_AUDIO[role]?.[notifyName] ?? null;
}

/**
 * The event a marker actually fires for one rig: the rig's own sound when the
 * project ships it, the shared sound when it does not.
 *
 * The same fallback shape as {@link resolveRtsAudioVariant}, and for the same
 * reason — it lets the override land *before* the clips exist. Until a wheel
 * roll is produced, a siege engine keeps playing the heavy footstep it plays
 * today, which is wrong but audible; silence would be worse, and waiting for the
 * clips would mean the code and the clips have to land in the same commit.
 *
 * Pure, with the table's answer passed in, so `test:engine` drives both branches
 * without a scene.
 */
export function resolveRtsRoleNotifyEvent(
  sharedEventId: string | null,
  override: RtsRoleNotifyAudio | null,
  answers: (eventId: string) => boolean,
): string | null {
  const instead = override?.instead;
  if (instead !== undefined && answers(instead)) return instead;
  return sharedEventId;
}

/**
 * Every event id a rig override is *allowed* to name.
 *
 * The twin of {@link rtsAudioVariantEventIds}, and kept out of
 * {@link rtsAudioEventIds} for the same reason: an override is optional by
 * construction, so requiring the table to answer it would make the code
 * unlandable until the clips exist. What this list is for is the other
 * direction — an id here that is not a legal event id, or a table entry named
 * here that nothing triggers.
 */
export function rtsRoleNotifyEventIds(): string[] {
  return [
    ...new Set(
      Object.values(RTS_ROLE_NOTIFY_AUDIO).flatMap((markers) =>
        Object.values(markers).flatMap((audio) => [
          ...(audio.instead === undefined ? [] : [audio.instead]),
          ...(audio.alongside ?? []),
        ]),
      ),
    ),
  ];
}

/**
 * Notification sounds, keyed by severity rather than by kind.
 *
 * Three tiers, matching the design's Info / Warning / Alarm split. Per-kind
 * sounds (a cut road sounding different from a full population) are a later
 * pass: with one clip per tier the player already learns "something happened /
 * something is wrong / something is burning", which is the reading the sound has
 * to carry, and twenty near-identical stingers would only make that harder.
 *
 * What makes these safe to fire on every post is that the notification centre
 * already de-duplicates: a still-true polled condition *refreshes* its notice
 * rather than raising it again, so only a genuine new raise reaches this.
 */
export const RTS_NOTIFICATION_AUDIO_EVENTS: Readonly<
  Record<RtsNotificationSeverity, string>
> = {
  info: "notify.info",
  warning: "notify.warning",
  alert: "notify.alert",
};

/**
 * The notices that answer with their own sound instead of their tier's — audio
 * plan §48 (Paket 2), landed 2026-08-22.
 *
 * The three tiers above stay the floor: a kind absent from this map still
 * sounds, as its severity. What this adds is the handful of notices §14/§16
 * produced clips for, and the reason to give them one is the failure §82.3
 * wrote down — every selection-panel button answered through the tier map, so
 * a pressed button and a depleted quarry made the same noise.
 *
 * Two of them are not notifications in spirit at all. `command` and
 * `command-refused` are the direct answer to a click the player just made (a
 * trade, a train order, a demolish), and the interface's own confirm and error
 * are what a click is owed — which is also why they route to the `ui` bus
 * rather than to `notifications`. Reaching them through this map rather than
 * through fourteen call sites in `runSelectionAction` is the whole point: the
 * notification centre already de-duplicates, and every action already posts.
 *
 * **`age-upgraded` and `enemy-age-upgraded` name the same event**, which is
 * §82.11's decision rather than a shortcut: both are news of the same kind ("a
 * kingdom has advanced"), and what tells the player's own transition from the
 * enemy's is already louder than a second clip could be — `stinger.age_up`
 * plays over the player's and never over the enemy's. So the notice reports the
 * event and the stinger says whose. Two ids sharing one clip would not have
 * separated them audibly either: `pitchVariation` is a random band, not a fixed
 * shift, so the "different" one would only be the same sound written twice.
 */
export const RTS_NOTIFICATION_KIND_AUDIO_EVENTS: Readonly<
  Partial<Record<RtsNotificationKind, string>>
> = {
  /**
   * The enemy's transition, which is the only thing this kind is ever posted
   * for — so the kind is a safe place to hang the sound.
   *
   * The player's own is **not** here, and that asymmetry is not an oversight:
   * `age-upgraded` is posted for an in-age *level-up* as well as for the age
   * transition (`updateProgression` writes both through one kind), so a sound
   * hung on the kind would ring the age bell every time the town gained a
   * level — several times a match, for news the design calls "its blip and
   * nothing more". The transition names the sound at the post instead, through
   * `RtsNotificationRequest.sound`, which exists for exactly this split.
   */
  "enemy-age-upgraded": "notify.age_up",
  "population-full": "notify.population_full",
  "resource-depleted": "notify.resource_depleted",
  "outpost-under-attack": "notify.outpost_attack",
  "center-under-attack": "notify.center_attack",
  "regional-victory-warning": "notify.regional_victory_warning",
  // §48 items 16/17 said the tiers would carry these two and no asset would be
  // produced. Both were produced anyway, so they get the pair of ids they were
  // named for — the cut is still an alert and the restore still info, they just
  // no longer share a clip with every other alarm and every other good news.
  /**
   * The two kinds that earn a sound of their own, and the rule they passed.
   *
   * A kind is only worth its own clip when all three hold: it **recurs** in a
   * match (a once-per-match sound cannot be learned — you did not know it the
   * first time and there is no second), the player may be **looking elsewhere**
   * (the feed already prints the words), and it asks for a **different action**
   * than its neighbours. Everything else takes its severity tier, which is what
   * §24 said in the first place and what the other kinds here already do.
   *
   * `worker-under-attack` passes hardest: a wolf in unscouted ground is not
   * drawn at all, so this line *is* the signal — without it a worker leaves the
   * roster and nothing on screen ever said why.
   */
  "worker-under-attack": "notify.worker_attack",
  /**
   * A trade site's road going cold. Distinct from `logistics-cut` because the
   * thing it stops is different — a buy button rather than a producer — and the
   * repair is somewhere else on the map.
   */
  "supply-cut": "notify.supply_cut",
  "logistics-cut": "notify.logistics_cut",
  "logistics-restored": "notify.logistics_restored",
  command: "ui.confirm",
  "command-refused": "ui.error",
};

/**
 * The sound a posted notice makes: its own when it has one, its tier's
 * otherwise.
 *
 * A caller may override both — see `RtsNotificationRequest.sound`, which is how
 * a Market trade answers with the till rather than with a generic confirm.
 */
export function rtsNotificationAudioEvent(
  kind: RtsNotificationKind,
  severity: RtsNotificationSeverity,
): string {
  return RTS_NOTIFICATION_KIND_AUDIO_EVENTS[kind] ?? RTS_NOTIFICATION_AUDIO_EVENTS[severity];
}

/**
 * The events fired from a specific place in `RtsApp` rather than from a stream.
 *
 * Named constants rather than string literals at the call sites, for two
 * reasons that happen to point the same way. The first is ordinary: an id
 * written twice drifts, and the checks that keep the code and the table in
 * agreement need one place to read the set from.
 *
 * The second is particular to this codebase. Audio event ids share a syntax with
 * localization keys — lower-case, dotted — and three of these namespaces
 * (`ui.`, `building.`, `unit.`) are *also* locale namespaces. The gate that
 * catches a mistyped translation key scans for key-shaped literals, so a literal
 * `"building.complete"` in gameplay code reads to it as a missing translation.
 * Keeping the ids behind constants means neither system has to know about the
 * other's namespace.
 */
export const RTS_AUDIO = {
  // Interface: the direct answer to something the player just clicked.
  uiClick: "ui.click",
  uiError: "ui.error",
  /**
   * An action *succeeded* — §14's `SFX-UI-002`, and the other half of `uiError`.
   *
   * Not a second click sound: `uiClick` says the button was pressed, this says
   * the thing behind it happened. Almost every one of them arrives through the
   * notification map (`command` → here, `command-refused` → `uiError`), because
   * the fourteen actions on the selection panel all already answer by posting a
   * notice and none of them called an audio hook — §82.3's open item, and the
   * reason a demolish and a full granary used to sound identical.
   */
  uiConfirm: "ui.confirm",
  /**
   * A pointer crossing an interface control.
   *
   * Fired from one delegated listener on the HUD host rather than from each
   * control, so a panel built later inherits it without knowing it exists. It
   * stays under `uiClick`: a hover must not read as the press it precedes, or a
   * mouse crossing the screen becomes an instrument.
   *
   * **Split by what is under the pointer, never by repetition.** `uiHoverCard`
   * is the same sound for a different kind of target, and the pair replaced
   * three random variants on one event. That is the opposite of the rule the
   * rest of this table follows, and hover is the case that inverts it: a player
   * sweeping a row of build cards crosses six buttons in a second, and a sound
   * that changes each time is heard as six different controls rather than as
   * variety. Everywhere else a repeat is spread over seconds and one clip is
   * what sounds broken.
   */
  uiHover: "ui.hover",
  /**
   * The same crossing over a picture card rather than a control — the build
   * palette's building and road thumbnails.
   *
   * Chosen by the target carrying an image rather than by a class list, so a
   * card added later is a card without this file being told. Two events instead
   * of one because the change the player should hear is "I have moved from the
   * interface into the cards", not "I have moved again".
   */
  uiHoverCard: "ui.hover_card",
  /**
   * A panel opening and closing — §14's `SFX-UI-005`/`006`.
   *
   * The pause card and the mission panel's fold, not the selection panel: that
   * one appears as a *consequence* of a pick, and it already has the pick's own
   * sound over it. A panel sound there would double every selection.
   */
  uiPanelOpen: "ui.panel_open",
  uiPanelClose: "ui.panel_close",
  /**
   * Something was picked. Separate from a plain click because the design gives
   * a repeated selection its own, much longer cooldown: clicking a button twice
   * is two actions, re-clicking the same squad is one player checking what they
   * have.
   */
  uiSelect: "ui.select",
  /**
   * What was actually picked — §14's `SFX-UI-007`/`008`, and the first split of
   * `uiSelect` rather than a replacement for it.
   *
   * `uiSelect` stays as the answer for a pick that is neither (or both, in a
   * mixed drag), on the same fallback shape §82.4 gave the armour split: the
   * game keeps a sound for the case the project did not produce a clip for.
   * The two are worth telling apart because they are the two things a player
   * clicks between all match long, and a squad answering like a building is the
   * one confusion the interface can remove for free.
   */
  uiSelectUnit: "ui.select_unit",
  uiSelectBuilding: "ui.select_building",
  /**
   * An order was accepted — the audio twin of the command marker dropped on the
   * ground. Its own event rather than a second click, because a marching order
   * and a menu press are the two sounds most worth telling apart by ear.
   */
  uiCommand: "ui.command",
  /**
   * The order's own kind — §14's `SFX-UI-009`/`010`.
   *
   * Same relationship to `uiCommand` that the two selects have to `uiSelect`:
   * these are fired when the command system says what it issued, and the shared
   * sound answers the orders it does not name (a worker task, a structure's
   * attack, a retreat). The design's reason for the split is stated in
   * `guardMove`/`guardAttack` below and holds here too — "we are moving" and
   * "we are engaging" land on the same button and must not land on the same
   * sound.
   */
  uiCommandAttack: "ui.command_attack",
  uiCommandMove: "ui.command_move",
  /**
   * The rally flag being armed — §14's `SFX-UI-011`.
   *
   * The arming, not the placing: pressing Rally puts the game in a mode, and the
   * click that then drops the flag is an ordinary command. A player who arms it
   * and right-clicks away hears `uiCancel`, which is already wired.
   */
  uiRallyPoint: "ui.rally_point",
  /**
   * §14's `SFX-UI-012`/`013`. One toggle, two sounds, and that asymmetry is the
   * point: `uiCancel` used to answer both directions, so the sound said the key
   * had landed without saying which way it went — readable only by looking at
   * the card that just appeared, which is the thing the sound exists to make
   * unnecessary.
   */
  uiPause: "ui.pause",
  uiResume: "ui.resume",
  /** Backing out: a placement abandoned, a mode escaped, the pause menu closing. */
  uiCancel: "ui.cancel",
  buildingPlace: "building.place",
  /** A foundation withdrawn — the opposite of `buildingPlace`, and it should sound it. */
  buildingCancel: "building.cancel",
  /**
   * The hammering at a foundation actually being worked — §17's construction
   * loop, and the third of the three sounds that make a build read by ear
   * (placed, being built, done).
   *
   * A loop rather than a per-blow one-shot, and that is a decision about the
   * asset rather than about the code: the workers have no hammer clip, so there
   * is no notify to hang an impact on (see `workerConstructionSystem`'s note on
   * why the builder stands in his idle). A bed at the site says "work is
   * happening here" without claiming a swing that nothing is animating.
   *
   * Exactly one plays at a time, over the single site described in
   * `RtsApp.updateBuildLoopAudio`. Four foundations do not make four hammers:
   * they are the same sound at four places, and layering them only turns a
   * readable rhythm into a wash.
   */
  buildingBuildLoop: "building.build_loop",
  /**
   * The crew's own blows, layered *over* {@link buildingBuildLoop} rather than
   * replacing it — §17's `SFX-BLD-003`/`004` (hammer) and `SFX-BLD-005` (timber
   * being moved), which only became possible when the clips landed.
   *
   * The bed alone was always a compromise, and its note says why: with no hammer
   * clip there was no blow to play, so a continuous wash stood in for work. These
   * are that blow. They still hang on no animation notify — the builder is in his
   * idle pose (`workerConstructionSystem`) — so the cadence is the scheduler's in
   * {@link RtsApp.updateConstructionWorkAudio}, drawn at random rather than
   * metronomic: a fixed interval reads as a machine, and a site is a crew.
   *
   * Two events rather than one set of eight, because they are two different
   * actions and the ear separates them: a hammer strikes, timber is carried and
   * dropped. Mixing them as one pool would make the ratio unauthorable.
   *
   * They follow the bed's single-site rule (see {@link buildingBuildLoop}): the
   * blows land at the one site that owns the bed, so four foundations are four
   * places on the map and still one readable rhythm.
   */
  buildingConstructionHammer: "building.construction_hammer",
  buildingConstructionWood: "building.construction_wood",
  /**
   * A placement the ground refused — §17's `SFX-BLD-002`, and the missing half
   * of {@link buildingPlace}.
   *
   * Its own event rather than `uiError`, because the two refusals are not the
   * same kind of "no": a greyed-out button says the kingdom cannot afford this,
   * a refused click says *not here*. The player answers them with different
   * actions, so they must not answer with the same sound.
   *
   * Fired only for a confirm that reached the ground and was turned down — the
   * mission gate's refusal upstream keeps `uiError`, since that one is about the
   * building rather than the spot.
   */
  buildingInvalidPlace: "building.invalid_place",
  /**
   * A building taken down by its owner — §17's `SFX-BLD-010`, the *confirmed*
   * press rather than the arming one.
   *
   * Demolish is a two-press command: the first arms and answers with the feed's
   * refusal tone, the second commits. Only the second is this. It rides the
   * notification's `sound` override rather than a call of its own, which is what
   * §82.6 built that field for — the caller whose outcome is more specific than
   * "it worked".
   *
   * Not `structureCollapse`: the building's own collapse still plays where it
   * stands, from the damage table, because razing it is what a full-health
   * `damage()` does. This is the order being taken, over the top of it.
   */
  buildingDemolish: "building.demolish",
  /**
   * An upgrade *starting* — §17's `SFX-BLD-007`/`008`, level-up and age-up as one
   * sound.
   *
   * One event for both because they are the same moment from the player's side:
   * the centre has begun spending time and money on getting bigger. What tells
   * them apart is the progress bar that appears, and §62 holds — nothing here is
   * carried by sound alone.
   *
   * The start, not the finish: an age-up completing already has `stingerAgeUp`,
   * and a level-up completing has its notice. Putting a sound on both ends of a
   * bar would spend the milestone twice.
   */
  buildingUpgrade: "building.upgrade",
  /**
   * A route paved, and a tile unpaved — §18's `SFX-LOG-001` and `SFX-LOG-009`.
   *
   * These answer a click, so they ride the `ui` bus with the placement chirp
   * rather than sounding at the tiles: a road is drawn while the camera is
   * looking at it, and attenuating the reply by distance would only make the
   * far end of a long route quieter than the near end of it.
   *
   * Erase stays armed after a confirm (the tool is a brush, unlike route
   * drawing), so its cooldown is what keeps a dragged rub-out from becoming a
   * machine-gun. The road event's variants exist for the same reason: paving is
   * the one logistics action a player repeats within seconds.
   */
  logisticsRoadPlace: "logistics.road_place",
  logisticsRoadErase: "logistics.road_erase",
  /**
   * A store or a border joining the network — §18's `SFX-LOG-003` and
   * `SFX-LOG-007`.
   *
   * The *link* coming up, not the building finishing: `buildingComplete` already
   * covers the latter, and these two fire on a transition that has nothing to do
   * with construction — a road reaching the site, or a border shifting so the
   * route home is legal again. An outpost's link is worth its own sound because
   * it is the moment its control radius jumps to `connectedControlRadius`, which
   * is the difference between a claim and a usable region.
   *
   * Spatial, at the building: unlike the road tools these are the map telling
   * the player something, and where it happened is half of what it says.
   */
  logisticsDepotConnected: "logistics.depot_connected",
  logisticsOutpostConnected: "logistics.outpost_connected",
  /**
   * The player's border moving outward — §18's `SFX-LOG-008`.
   *
   * Measured off the territory grid's own cell count rather than off the thing
   * that caused it, because the causes are several (an outpost completing, a
   * road reaching one, a rival's outpost falling) and the player only cares that
   * the map is now theirs. A high-water mark, so ground lost and retaken does
   * not re-announce itself.
   *
   * Global rather than placed: an expansion is an area, and an area has no point
   * to sound from. Suppressed on any frame a connection sound above already
   * fired — those two moments cause this one, and hearing both is one event
   * reported twice.
   */
  logisticsTerritoryExpanded: "logistics.territory_expanded",
  /**
   * A unit going down — §19/§20/§21's `SFX-WRK-006` / `SFX-GRD-007` /
   * `SFX-ARC-007`, as one event rather than three.
   *
   * One event because that is what §81.2 settled: the table is coarser than the
   * inventories on purpose, and producing a set per role means a library whose
   * larger half never plays. A role split is a *code* decision (the id chosen by
   * role, or the marker carrying it) and it belongs to the same Faz 5 pass that
   * splits the footstep.
   *
   * Fired on the frame the unit is defeated, not when the corpse is cleared
   * thirty seconds later — `updateUnitDeaths` keeps those two apart precisely so
   * a consumer can pick. That frame is the start of the death animation rather
   * than the moment the body lands, so the *clip* carries the beat: a stagger
   * and kit rustle first, the weight settling after. Timing a fall would need a
   * notify authored on every death clip, which is the trap §81.1 wrote down when
   * the pickaxe was cancelled.
   *
   * Both sides die audibly. The fog gate is what keeps that honest — a loss
   * behind the curtain stays behind it.
   */
  unitDeath: "unit.death",
  /**
   * A unit leaving the queue and standing on the field — §44's Tier 2
   * "Birim üretildi", and the one Tier 2 moment that had no sound at all.
   *
   * **Per unit, not per emptied queue.** The *notice* is deliberately one line
   * per batch (five orders used to post five lines saying nothing the player did
   * not already know), but a sound is not a line: it is the receipt for a thing
   * the player paid for, and the second and third of a batch are as much a
   * receipt as the first. The event's own `cooldownMs` is what keeps a fast
   * queue from stacking, rather than a rule written here.
   *
   * Placed at the building rather than global, for the reason
   * `building.complete` is: a kingdom with a Barracks and an Archery Range
   * training at once has two answers, and where the sound comes from is the only
   * thing that separates them.
   *
   * The player's own only. Both production paths already scope to
   * {@link PLAYER_OWNER} before they get here, and the fog gate would not help:
   * an enemy Barracks the player has scouted is *visible*, so an unscoped hook
   * would narrate the AI's build order.
   */
  unitTrained: "unit.trained",
  /**
   * The hunt's decisive contact — one strike, and the animal is down.
   *
   * Not a combat sound and deliberately not routed through one: hunting never
   * reaches `resolveCombatHit`, so no `body-impact` marker fires and nothing
   * else in the match would have covered it. Placed at the carcass rather than
   * the hunter, because a deer bolts before it drops.
   */
  wildlifeKill: "wildlife.kill",
  /**
   * Working a carcass: the repeated contact after the kill.
   *
   * The simulation reports this every tick a worker is on a body, so the cadence
   * is the app's — drawn from a band, like the construction blow, because an
   * even beat is the one thing a man with a knife never sounds like.
   */
  wildlifeButcher: "wildlife.butcher",
  /**
   * A wolf's bite landing on a person.
   *
   * The fog gate applies, and that is the division of labour with
   * `notify.worker_attack` above: the bite is a *place* and only sounds if the
   * player could see it, while the notice is the report that reaches him
   * wherever it happened.
   */
  wildlifePredatorStrike: "wildlife.predator_strike",
  /**
   * A herd breaking — the frame an animal goes from calm to bolting.
   *
   * One sound for the herd rather than one per animal: twelve deer scattering is
   * a single event to the ear, and the event's own cooldown is what makes it so.
   */
  wildlifeAlarm: "wildlife.alarm",
  /**
   * The donkey's hoof. No marker behind it — the caravan rig authors no notifies
   * at all — so the app times these against travelled distance.
   */
  caravanHoofstep: "caravan.hoofstep",
  /**
   * A bray, and rare on purpose: the one sound here with no informational job.
   * Its spacing is the event's `cooldownMs`, not the roll that offers it.
   */
  caravanDonkeyCall: "caravan.donkey_call",
  /**
   * Loaded panniers working against the girth — §82.8's `alongside` shape: it
   * rides the step and thins itself with its own cooldown, because a creak every
   * hoofbeat is a rattle and a creak every few seconds is a load.
   */
  caravanPannierCreak: "caravan.pannier_creak",
  // World: buildings have no animation notifies, so these are their equivalent.
  buildingComplete: "building.complete",
  structureImpact: "structure.impact",
  structureCollapse: "structure.collapse",
  // The gun's report. The only combat sound with no notify behind it — the
  // shell's flight is timed from the shot, not from a marker on a clip.
  cannonFire: "siege.cannon_fire",
  /**
   * What a shot sounds like *between* the weapon and what it hit.
   *
   * Both of these play at the **arrival** end rather than at the muzzle, and
   * that is a decision rather than a convenience. The departure is already
   * covered where it happens — `combat.arrow_release` off the Archer's marker,
   * `siege.cannon_fire` off the gun — and a second sound stacked on the same
   * point would mostly be masked by the first, loudest one. At the far end it
   * does work nothing else does: it says *something is about to land here*, at
   * the place the player needs to be looking, slightly before it does.
   *
   * The engine is why this is a choice at all. A flight sound physically travels
   * with the projectile, and `AudioPlaybackHandle` cannot be moved once it is
   * playing — it carries `stop`/`setVolume`/`setPitch` and no position. So a
   * travelling sound has to be pinned to one end or the other, and of the two
   * ends only one is not already occupied.
   */
  arrowFlight: "combat.arrow_flight",
  cannonballFlight: "siege.cannonball_flight",
  /**
   * The shell arriving — earth, dust and debris thrown up where it lands.
   *
   * Named for the shell rather than for the ground the clips were produced
   * against, because a gun in this game is aimed at a wall as often as at the
   * dirt in front of one and the event fires wherever the ball actually
   * arrives. It is deliberately *additive* to the damage sound: the wall's
   * `structure.impact_*` crack is the material giving way, this is the blast
   * that did it, and the two are different layers of one moment rather than two
   * answers to it.
   */
  shellImpact: "siege.shell_impact",
  /**
   * §16's economy set. Three different kinds of moment, and they route to three
   * different buses on purpose rather than by namespace:
   *
   * - a Market trade answers a button, so it rides `ui` beside the confirm it
   *   replaces;
   * - a full store is the game telling the player something is being wasted, so
   *   it rides `notifications`;
   * - work starting and a producer coming online happen *at a place on the map*,
   *   so they are spatial and ride `sfx` with the rest of the world.
   *
   * What §16 warns against is the fourth kind, and none of these is it: "saniyede
   * birçok kez kaynak artışı için ses üretilmemelidir". Nothing here fires on a
   * resource tick. The production sounds fire on a producer's *transition* into
   * producing — a building coming online, which happens a few dozen times a
   * match — and never again while it keeps producing.
   */
  economyMarketBuy: "economy.market_buy",
  economyMarketSell: "economy.market_sell",
  economyStockFull: "economy.stock_full",
  economyWorkStart: "economy.work_start",
  // The two that never stop.
  worldAmbience: "world.ambience",
  /**
   * The four gameplay music states (§28), one playlist each.
   *
   * Not triggered like the sounds around them: `MusicDirector` owns these clips
   * and fades between the lists, so what the table entry provides is the running
   * order and the level rather than a play. They are named here anyway, and by
   * the same reasoning as everything else in this map — the set of moments the
   * game can sound at is a contract, and an id no table entry answers is a
   * playlist that silently resolves to nothing.
   *
   * MENU is absent on purpose: it belongs to the shell rather than to a match,
   * and RESULT is §5.11's two stingers below.
   */
  musicSettlement: "music.settlement",
  musicExpansion: "music.expansion",
  musicTension: "music.tension",
  musicBattle: "music.battle",
  /**
   * The three stingers (§5.11): a match-state change announced musically rather
   * than reported.
   *
   * They ride the `music` bus, not `notifications`, and that is the decision
   * worth writing down. Functionally they are announcements, so the notification
   * bus is the tempting home — but a stinger *is* a piece of music (§71 produces
   * them alongside the score, from the same instrument set), and a player who
   * pulls the Music slider down has said what they want to hear. That is only
   * safe because §62's rule holds here: none of these three moments is carried
   * by sound alone. The age-up posts a notification card, and the result screen
   * is on top of the field. Silence costs the player nothing but the flourish.
   *
   * Only the age *transition* gets one, not the in-age level-up: the level-up
   * already has its info notice, and giving both the same fanfare would spend
   * the milestone sound on the thing that is not the milestone.
   */
  /**
   * Guard barks — the unit answering the player rather than the interface
   * answering the click.
   *
   * Fired alongside `uiSelect` / `uiCommand`, not instead of them: the click
   * sound is the interface confirming it heard, the bark is the squad
   * confirming it will go, and a player who selects a worker still needs the
   * first. Only the Guard has lines, so a selection without one is silent here
   * and nothing has to stand in for the others.
   *
   * Move and attack are separate events for the same reason the design keeps
   * `uiCommand` apart from `uiClick`: "we are moving" and "we are engaging"
   * are the two things a player most needs to tell apart without looking, and
   * they are the two orders that land on the same button.
   */
  guardSelect: "voice.guard_select",
  guardMove: "voice.guard_move",
  guardAttack: "voice.guard_attack",
  /**
   * The two stance orders §39 names, kept apart for the same reason move and
   * attack are: both end movement, but hold promises "we stay here and do not
   * chase" while stop promises "whatever we were doing, we are not doing it".
   * Collapsing them into one line would leave the player re-reading the stance
   * to find out which order actually took.
   */
  guardHold: "voice.guard_hold",
  guardStop: "voice.guard_stop",
  /**
   * The one bark nobody clicked for. Driven off the same damage watch that
   * posts the worker notice rather than off a hit, so it reports an engagement
   * and not a wound; the long cooldown in the table is what enforces that.
   */
  guardUnderAttack: "voice.guard_under_attack",
  /**
   * §38's Worker lines. Same five moments the Guard has, minus the two stances
   * (a worker takes neither) and plus the one the Guard has no use for: a
   * refused order. `workerWork` is the acknowledgement that a *job* was picked
   * up, which is the distinction §38 draws between "on my way" and "I'll see
   * to it" — the second says the click found something to do.
   *
   * When a selection holds both classes only one speaks; see
   * `RtsApp.playSelectionAudio` for which and why.
   */
  workerSelect: "voice.worker_select",
  workerMove: "voice.worker_move",
  workerWork: "voice.worker_work",
  workerInvalid: "voice.worker_invalid",
  workerUnderAttack: "voice.worker_under_attack",
  /**
   * §40's Archer lines — all five of the Guard's moments now that the stop line
   * has been recorded.
   *
   * `archerStop` was the one gap this table described rather than hid: until the
   * clips landed, an Archer-only selection answered `H` and stayed silent on
   * `X`, because the fall-through had nowhere left to go (a worker takes no
   * stance and has no stop line either). Three clips and one field closed it,
   * exactly as the note here predicted — `RtsApp` was not opened.
   */
  archerSelect: "voice.archer_select",
  archerMove: "voice.archer_move",
  archerAttack: "voice.archer_attack",
  archerHold: "voice.archer_hold",
  archerStop: "voice.archer_stop",
  archerUnderAttack: "voice.archer_under_attack",
  /**
   * The age transition's *notice* — the news half, on the notifications bus.
   *
   * Named here rather than reached through the notification kind map because
   * only one of the two posts that share the `age-upgraded` kind should sound
   * it; see the note on that map. The player's own transition therefore carries
   * both this and {@link stingerAgeUp}, the enemy's carries only this, and a
   * level-up carries neither.
   */
  notifyAgeUp: "notify.age_up",
  stingerAgeUp: "stinger.age_up",
  stingerVictory: "stinger.victory",
  stingerDefeat: "stinger.defeat",
} as const;

/**
 * The axis a shared world sound splits on — §81.2's deferred decision, taken
 * 2026-08-22 (§82.4).
 *
 * The problem it answers: the event table is coarser than §19–§23's inventories.
 * One `unit.footstep` for four rigs, one `combat.body_impact` for every blow, one
 * `structure.impact` for every building. Producing a set per *role* against that
 * would ship a library whose larger half never plays — which is the trap §81.2
 * wrote down and left open.
 *
 * The axis chosen is **not** role. It is `armorClass`, and the reasons are three:
 *
 * 1. **It is already authored.** `guard`/`siege` are `heavy`, `archer`/`worker`
 *    are `light`. No new data.
 * 2. **It is the axis the ear actually hears.** What a blow sounds like is
 *    decided by what it landed *on*, not by who swung — §20 says exactly this
 *    with `SFX-GRD-004` "sword hit armor" beside `SFX-GRD-005` "sword hit flesh".
 *    A role split would have produced three sets along the wrong axis.
 * 3. **Two sets instead of four.** §19's Worker and §21's Archer are both light;
 *    what the design names between them is the ground ("dirt"), not the body.
 *
 * The events that look shared and are not: `sword-swing` is authored on the Guard
 * rig alone, `arrow-release` on the Archer's, `chop-impact` and `throw-release` on
 * the Worker's. Those are already one role each and need no split.
 *
 * **Buildings are deliberately not here** (§82.5). They looked like the same
 * problem and are not: a house is timber in a settlement and masonry in a town,
 * so a variant derived from one authored material name is age-blind, and ten of
 * the fifteen buildings never authored one. Their sound is named outright by the
 * damage presentation table (`damage.…slots.<slot>.sound`), which is already per
 * age and already covers every building through `defaults` — so there is nothing
 * left here to derive, and leaving a second answer beside the authored one would
 * be the worst of the three options.
 */
export type RtsAudioVariant = "light" | "heavy";

const ARMOR_VARIANTS = ["light", "heavy"] as const satisfies readonly RtsAudioVariant[];

/** Which shared events may carry a variant, and which variants each admits. */
export const RTS_AUDIO_SPLIT: Readonly<Record<string, readonly RtsAudioVariant[]>> = {
  [RTS_NOTIFY_AUDIO_EVENTS.footstep!]: ARMOR_VARIANTS,
  [RTS_NOTIFY_AUDIO_EVENTS["body-impact"]!]: ARMOR_VARIANTS,
  [RTS_AUDIO.unitDeath]: ARMOR_VARIANTS,
};

/** `combat.body_impact` + `heavy` → `combat.body_impact_heavy`. */
export function rtsAudioVariantEvent(baseEventId: string, variant: RtsAudioVariant): string {
  return `${baseEventId}_${variant}`;
}

/**
 * The event to actually fire: the variant when the project ships one, the shared
 * sound when it does not.
 *
 * The fallback is what makes the split safe to land *before* the clips exist,
 * and it is deliberately the same shape as the music state machine's ("a state
 * whose playlist the project does not ship keeps the one already playing"). Two
 * things follow from it that are worth being explicit about:
 *
 * - Production can arrive one class at a time. The heavy footstep set can ship
 *   months before the light one without a silent frame in between.
 * - A fork that produces one set per event never has to know this exists.
 *
 * Pure, with the table's answer passed in, so `test:engine` drives both branches
 * without a scene — and so this module keeps knowing nothing about the runtime.
 */
export function resolveRtsAudioVariant(
  baseEventId: string,
  variant: RtsAudioVariant | null,
  answers: (eventId: string) => boolean,
): string {
  if (variant === null) return baseEventId;
  // A variant nobody declared for this event is a caller bug, not a fallback
  // case: it would resolve to an id no table will ever answer and go silent.
  if (!RTS_AUDIO_SPLIT[baseEventId]?.includes(variant)) return baseEventId;
  const variantId = rtsAudioVariantEvent(baseEventId, variant);
  return answers(variantId) ? variantId : baseEventId;
}

/**
 * Every variant id the table is *allowed* to carry.
 *
 * Kept apart from {@link rtsAudioEventIds}: that set is what the table **must**
 * answer, and a variant is optional by construction. This is what stops an
 * added `combat.body_impact_heavy` from reading as an entry nothing triggers.
 */
export function rtsAudioVariantEventIds(): string[] {
  return Object.entries(RTS_AUDIO_SPLIT).flatMap(([baseId, variants]) =>
    variants.map((variant) => rtsAudioVariantEvent(baseId, variant)),
  );
}

/** Every audio event id this game triggers by name. The table must answer all of them. */
/**
 * The menu's playlist (§28.1) — a table entry no *match* ever triggers.
 *
 * Kept here with the rest so this file remains the single answer to "which
 * moments have a sound", but deliberately outside {@link RTS_AUDIO} and
 * {@link rtsAudioEventIds}: those are what `RtsApp` can fire, and the menu runs
 * before `RtsApp` exists. `rtsMenuMusic.ts` is the owner.
 */
/** The moments §38–§40 give a unit a line for. */
export type RtsVoiceMoment =
  | "select"
  | "move"
  | "attack"
  | "work"
  | "invalid"
  | "hold"
  | "stop"
  | "underAttack";

/** One role's bark set. A moment the design records no line for is simply absent. */
export type RtsUnitVoiceLines = Readonly<{ role: string }> &
  Readonly<Partial<Record<RtsVoiceMoment, string>>>;

/**
 * §38–§40's three bark sets, and the order in which they speak.
 *
 * **One voice per event.** A box drawn over a mixed group is still one pick and
 * an order given to it is still one order, so two classes answering would be two
 * men talking over each other — `maxInstances` cannot prevent that, because it
 * is per event and these are separate events. The list is therefore ordered, and
 * the first *selected* role that owns a line for the moment gets it.
 *
 * Falling through on a missing line rather than going silent is the other half
 * of the rule, and it is what makes a mixed selection read correctly: the Guard
 * outranks the Worker, but a right-click that lands on a tree produces a
 * `worker-task`, which the Guard has no line for — and that outcome names whose
 * order it was. So the crew answers it, and the Guard stays quiet without
 * anything having to know that a worker was involved.
 *
 * Ordered guard → archer → worker: military first, and within it the class that
 * holds the line rather than the one that shoots over it.
 */
export const RTS_UNIT_VOICE_LINES = [
  {
    role: "guard",
    select: RTS_AUDIO.guardSelect,
    move: RTS_AUDIO.guardMove,
    attack: RTS_AUDIO.guardAttack,
    hold: RTS_AUDIO.guardHold,
    stop: RTS_AUDIO.guardStop,
    underAttack: RTS_AUDIO.guardUnderAttack,
  },
  {
    role: "archer",
    select: RTS_AUDIO.archerSelect,
    move: RTS_AUDIO.archerMove,
    attack: RTS_AUDIO.archerAttack,
    hold: RTS_AUDIO.archerHold,
    stop: RTS_AUDIO.archerStop,
    underAttack: RTS_AUDIO.archerUnderAttack,
  },
  {
    role: "worker",
    select: RTS_AUDIO.workerSelect,
    move: RTS_AUDIO.workerMove,
    work: RTS_AUDIO.workerWork,
    invalid: RTS_AUDIO.workerInvalid,
    underAttack: RTS_AUDIO.workerUnderAttack,
    // No `attack`, `hold` or `stop`: a worker takes no stance (`issueStance`
    // skips the role outright) and gives no battle cry.
  },
] as const satisfies readonly RtsUnitVoiceLines[];

/**
 * Which line answers a moment, given who is present — or null for silence.
 *
 * `present` is asked per role rather than handed a list, so the caller keeps
 * deciding what "present" means: picked, for an order; wounded this frame, for
 * the alarm. Pure, so `test:engine` drives every combination without a match.
 */
export function resolveUnitVoice(
  moment: RtsVoiceMoment,
  present: (role: string) => boolean,
  order: readonly RtsUnitVoiceLines[] = RTS_UNIT_VOICE_LINES,
): string | null {
  for (const lines of order) {
    if (!present(lines.role)) continue;
    const eventId = lines[moment];
    if (eventId !== undefined) return eventId;
  }
  return null;
}

/**
 * The same table read backwards, for the one moment nobody clicked.
 *
 * A raid that catches a mixed force wounds every class at once, and the
 * one-voice rule applies there too — but the priority inverts, because what
 * makes a report *news* inverts. A guard losing health is usually the fight the
 * player is already watching; a worker losing health is a man who cannot answer
 * and is not on screen. So the most helpless voice wins the frame.
 */
export const RTS_UNIT_ALARM_VOICE_ORDER: readonly RtsUnitVoiceLines[] =
  [...RTS_UNIT_VOICE_LINES].reverse();

export const RTS_MENU_MUSIC_EVENT = "music.menu";

/**
 * §28's four gameplay states mapped to the table entry that holds each playlist.
 *
 * Keyed by the state name so the state machine can stay ignorant of event ids
 * and this file stays the one place a moment is bound to a sound.
 */
export const RTS_MUSIC_STATE_EVENTS = {
  settlement: RTS_AUDIO.musicSettlement,
  expansion: RTS_AUDIO.musicExpansion,
  tension: RTS_AUDIO.musicTension,
  battle: RTS_AUDIO.musicBattle,
} as const satisfies Readonly<Record<RtsMusicState, string>>;

/**
 * One production sound per resource — §16's `SFX-ECO-003`…`006`.
 *
 * Keyed by the balance table's resource id rather than named as four constants,
 * because the caller has a `resourceId` in hand and nothing else: a producer
 * reports what it makes, and the sound follows from that. A resource with no
 * entry is silent, which is what a fork that adds a fifth resource should get
 * until it produces a clip for it.
 *
 * Fired on the frame a producer starts producing, not on the resource arriving:
 * §16 is explicit that a per-tick income sound is the wrong shape, and a
 * building coming online is the state change worth hearing.
 */
export const RTS_RESOURCE_PRODUCTION_AUDIO_EVENTS: Readonly<Record<string, string>> = {
  food: "economy.food_production",
  wood: "economy.wood_production",
  stone: "economy.stone_production",
  gold: "economy.gold_production",
};

/** The production sound for one resource, or null when the project ships none. */
export function rtsResourceProductionAudioEvent(resourceId: string): string | null {
  return RTS_RESOURCE_PRODUCTION_AUDIO_EVENTS[resourceId] ?? null;
}

export function rtsAudioEventIds(): string[] {
  return [
    ...new Set([
      ...Object.values(RTS_NOTIFY_AUDIO_EVENTS),
      ...Object.values(RTS_NOTIFICATION_AUDIO_EVENTS),
      ...Object.values(RTS_NOTIFICATION_KIND_AUDIO_EVENTS),
      ...Object.values(RTS_RESOURCE_PRODUCTION_AUDIO_EVENTS),
      // The zone beds (§82.13) live in their own module because what anchors
      // them is map knowledge, not an audio moment — but they are fired by
      // `RtsApp` like everything else here, so the table has to answer them.
      ...Object.values(RTS_ZONE_AMBIENCE),
      ...Object.values(RTS_AUDIO),
    ]),
  ];
}
