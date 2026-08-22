/**
 * Music for the main menu — audio plan §28.1, the one state that is not a match.
 *
 * Its own small audio stack, and that is forced rather than chosen: the menu
 * runs *before* `RtsApp` is constructed (see `ui/rtsMainMenu.ts` on why the card
 * moved in front of the app), so the subsystem, the mix and the frame loop that
 * the match owns do not exist yet. What it does not do is reimplement any of
 * them — the same `AudioSubsystem`, the same `MusicDirector`, the same
 * `events.json` entry, so the menu's playlist crossfades and obeys the player's
 * Music slider exactly like the match's.
 *
 * Torn down at the click that starts a match. The two stacks never overlap: the
 * boot awaits the menu's answer before it builds anything, so there is one audio
 * context at a time.
 *
 * **Autoplay is expected to refuse this on a cold load,** and nothing here can
 * change that: a browser will not sound a page that has had no interaction, and
 * the menu is the first screen. So the start is retried on the player's first
 * gesture — which on a return trip from a match has already happened, and on a
 * first visit usually happens while they read the setup rows. A menu they click
 * straight through stays silent, and that is the correct outcome rather than a
 * bug to work around.
 */

import { AudioSubsystem } from "@engine/audio/audioSubsystem";
import { MusicDirector } from "@engine/audio/musicDirector";
import {
  AUDIO_BUS_IDS,
  type BusMixSnapshot,
} from "@engine/audio/audioBus";
import { normalizeAudioEventTable } from "@engine/audio/audioEventTable";
import { parseRtsSoundManifestPaths } from "@/game/rts/content/rtsContentValidation";
import { RTS_MENU_MUSIC_EVENT } from "./rtsAudioEvents";
import { projectFileUrl } from "@/project/ProjectSystem";
import { logger } from "@/game/core/logger";
import { UserSettingsStore } from "@engine/persistence/userSettingsStore";
import { createLocalStorageAdapter } from "@engine/persistence/saveGameStore";

const log = logger("UI");

/**
 * The player's saved volume trims, or an empty set when storage is unavailable.
 *
 * Read here rather than passed in, because the menu is the first screen and
 * nothing upstream of it has a reason to own a settings store. Same key and same
 * shape as the match's, so the level does not change across a screen the player
 * did not touch — and a private-mode browser that refuses storage simply gets
 * the authored mix, which is the same fallback the match takes.
 */
function readSavedBusTrims(): BusMixSnapshot {
  try {
    const store = new UserSettingsStore({
      storage: createLocalStorageAdapter(window.localStorage),
    });
    return store.read().audio.busVolumes;
  } catch {
    return {};
  }
}

export class RtsMenuMusic {
  private readonly audio: AudioSubsystem;
  private readonly director: MusicDirector;
  private frame: number | null = null;
  private lastTime = 0;
  private clock = 0;
  private disposed = false;
  private readonly unlock = (): void => {
    // The gesture the autoplay policy was waiting for. `resumeContext` also
    // re-asks any stream it refused, which is the play started below.
    this.audio.resumeContext();
  };
  /**
   * The same hold the match applies, for the same reason — see
   * `MusicDirector.setPaused`.
   *
   * The menu has its own frame loop and it is `requestAnimationFrame`, so it
   * stops with a hidden tab while the audio device does not. Without this the
   * menu track plays on unheard, runs out, and the schedule that would have
   * handed over is still standing where the loop left it: the player comes back
   * to a menu that has gone quiet for good.
   */
  private readonly handleVisibilityChange = (): void => {
    if (this.disposed) return;
    if (document.visibilityState !== "visible") {
      this.director.setPaused(true, this.clock);
      this.audio.suspendContext();
      return;
    }
    this.audio.resumeContext();
    this.director.setPaused(false, this.clock);
    // The loop restarts from now, not from whenever it was last serviced: an
    // unserviced rAF hands back a delta covering the whole time away.
    this.lastTime = performance.now();
  };

  private constructor(audio: AudioSubsystem, director: MusicDirector) {
    this.audio = audio;
    this.director = director;
  }

  /**
   * Fetches what the menu playlist needs and starts it, or answers null.
   *
   * Null for every ordinary absence — no `music.menu` entry, an empty playlist,
   * a manifest that ships none of its clips — because a menu without music is a
   * complete menu. A failure to *load* is logged and also answers null: the menu
   * is what the player is looking at, and it must not be held up by a fetch for
   * something they may never hear.
   */
  static async start(): Promise<RtsMenuMusic | null> {
    try {
      const [manifestJson, tableJson] = await Promise.all([
        fetch(projectFileUrl("assets/manifest.json")).then((response) => response.json()),
        fetch(projectFileUrl("game-data/audio/events.json")).then((response) => response.json()),
      ]);
      const table = normalizeAudioEventTable(tableJson);
      const definition = table.events[RTS_MENU_MUSIC_EVENT];
      if (!definition || definition.clips.length === 0) return null;

      const sounds = parseRtsSoundManifestPaths(manifestJson);
      const clips = definition.clips.filter((clipId) => sounds.has(clipId));
      if (clips.length === 0) {
        // Named rather than passed over: an id in the table that the manifest
        // does not answer is a wiring mistake, and its only other symptom is a
        // menu that is quiet for no stated reason.
        log.warn(`"${RTS_MENU_MUSIC_EVENT}" names no clip this project ships; the menu stays silent`);
        return null;
      }

      const audio = new AudioSubsystem({
        backend: "web-audio",
        resolveClipUrl: (clipId) => {
          const path = sounds.get(clipId);
          return path ? projectFileUrl(path) : null;
        },
      });
      const trims = readSavedBusTrims();
      const snapshot: BusMixSnapshot = {};
      for (const bus of AUDIO_BUS_IDS) {
        snapshot[bus] = (table.buses[bus] ?? 1) * (trims[bus] ?? 1);
      }
      audio.applyMixSnapshot(snapshot);

      const { bus, volume } = definition;
      const director = new MusicDirector({
        clips,
        volume,
        // Streamed like every bed, and here it earns it twice: the menu is the
        // first thing loaded, and decoding a two-minute track before the player
        // can click Start would spend their patience on the one sound they are
        // least likely to stay for.
        play: (clipId, gain) => audio.play(clipId, { bus, volume: gain, stream: true }),
        durationOf: (clipId) => audio.clipDurationSeconds(clipId),
        settings: table.music,
      });

      const menuMusic = new RtsMenuMusic(audio, director);
      menuMusic.begin();
      return menuMusic;
    } catch (error) {
      log.warn(
        `menu music did not load; the menu stays silent: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private begin(): void {
    this.lastTime = performance.now();
    this.director.start(this.clock);
    // Passive: this never calls preventDefault, and it is only here to notice
    // that a gesture happened at all.
    window.addEventListener("pointerdown", this.unlock, { passive: true });
    window.addEventListener("keydown", this.unlock, { passive: true });
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.tick();
  }

  /**
   * The menu's own frame loop — one call a frame, and only for the music.
   *
   * The menu is HTML and repaints itself; nothing else here needs a loop. The
   * director does, because a crossfade is a ramp written per frame, and it rides
   * real seconds rather than the match clock that does not exist yet.
   */
  private readonly tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    // Clamped: a tab left in the background hands back one enormous delta, and
    // an unclamped one would push the schedule past a whole track in a frame.
    this.clock += Math.min(0.25, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.audio.update({ deltaSeconds: 0, elapsedSeconds: this.clock, frame: 0 });
    this.director.advance(this.clock);
    this.frame = requestAnimationFrame(this.tick);
  };

  /**
   * Stops the menu music and releases its audio context.
   *
   * A short fade rather than a cut: this runs at the click that starts a match,
   * under a loading curtain, and a track chopped mid-bar is the one moment the
   * player would hear the seam between the two screens.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    window.removeEventListener("pointerdown", this.unlock);
    window.removeEventListener("keydown", this.unlock);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.director.stop(0.6);
    // After the fade it is asked for, so the ramp is not cut off by the context
    // closing under it.
    window.setTimeout(() => this.audio.dispose(), 700);
  }
}
