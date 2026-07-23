/**
 * Player-facing match notifications — Vertical Slice Plan v0.2 §51 (Faz 9).
 *
 * Pure state: no DOM, so `test:engine` verifies the suppression rules directly
 * rather than by looking at a screenshot (the §82 pattern `formatRtsAiDebug`
 * established). {@link RtsNotificationFeed} renders what `active()` returns.
 *
 * This exists because §52 asks for "Aynı uyarı sürekli spam oluşturmuyor", and
 * the conditions behind these notices are *polled*, not evented: population-full
 * and logistics-cut are true on every frame they are true, so a naive feed would
 * append the same line sixty times a second. Two rules keep that readable:
 *
 * 1. A repeat of a still-live notice *refreshes* it instead of stacking. A
 *    persistent condition therefore reads as one line that stays up while it
 *    holds — which is also what the player wants: the notice disappearing is the
 *    signal that the problem is gone.
 * 2. Once a notice expires, its key is muted for a cooldown. Without this, a
 *    condition flickering across the expiry boundary (a producer whose road is
 *    contested) would re-post forever.
 *
 * Note what is *not* counted: refreshes. An early build showed the refresh count
 * and a single unroaded farm read "×378" — the simulation tick rate wearing a
 * notification's clothes. Only raises are counted; see {@link RtsNotification}.
 *
 * Durations run on rendered-frame time, not simulation time: at §38's 8x test
 * speed a notice must still be readable for the same number of *real* seconds.
 */

export type RtsNotificationKind =
  | "population-full"
  | "resource-depleted"
  | "logistics-cut"
  | "outpost-under-attack"
  | "center-under-attack"
  | "age-upgraded"
  | "enemy-age-upgraded"
  | "regional-victory-warning"
  | "peace-active"
  | "peace-ending"
  | "peace-ended";

/** Drives presentation weight only; the feed never reorders by severity. */
export type RtsNotificationSeverity = "info" | "warning" | "alert";

interface NotificationRule {
  readonly severity: RtsNotificationSeverity;
  /** Real seconds a notice stays visible once nothing refreshes it. */
  readonly displaySeconds: number;
  /** Real seconds a key stays muted after expiring, damping flicker. */
  readonly cooldownSeconds: number;
}

/**
 * Cooldowns scale with how *actionable* a notice is, not how urgent it sounds.
 * "Merkez saldırı altında" is the shortest because the player must be able to
 * tell a second assault from the first one; an age-up is a one-shot event that
 * cannot repeat, so it needs no cooldown at all.
 */
const RULES: Readonly<Record<RtsNotificationKind, NotificationRule>> = {
  "population-full": { severity: "warning", displaySeconds: 6, cooldownSeconds: 20 },
  "resource-depleted": { severity: "warning", displaySeconds: 8, cooldownSeconds: 30 },
  "logistics-cut": { severity: "alert", displaySeconds: 8, cooldownSeconds: 15 },
  "outpost-under-attack": { severity: "alert", displaySeconds: 6, cooldownSeconds: 12 },
  "center-under-attack": { severity: "alert", displaySeconds: 8, cooldownSeconds: 10 },
  "age-upgraded": { severity: "info", displaySeconds: 6, cooldownSeconds: 0 },
  "enemy-age-upgraded": { severity: "warning", displaySeconds: 8, cooldownSeconds: 0 },
  // §58: the longest display and a cooldown to match. Unlike the others this
  // notice describes a *countdown* rather than an event, so it should still be
  // on screen while the player decides what to do about it — but re-raising it
  // every few seconds for three minutes would be the "×378" failure above.
  "regional-victory-warning": { severity: "alert", displaySeconds: 10, cooldownSeconds: 25 },
  // The three saldırmazlık (non-aggression) notices are each raised exactly once
  // per match — a stage guard in RtsApp fires them on clock thresholds, not per
  // frame — so they need no cooldown. They replace what would otherwise be a
  // remaining-time counter, which would sit confusingly beside the HUD's own
  // elapsed-time readout (one counting up, one down). The heads-up before the
  // window closes is the actionable one, so it is the loudest.
  "peace-active": { severity: "info", displaySeconds: 8, cooldownSeconds: 0 },
  "peace-ending": { severity: "alert", displaySeconds: 10, cooldownSeconds: 0 },
  "peace-ended": { severity: "warning", displaySeconds: 8, cooldownSeconds: 0 },
};

/**
 * The feed is a corner overlay, not a log. §52 requires the UI not to cover the
 * map's critical areas, so the oldest notice is dropped rather than growing the
 * column downward. The decision trail lives in the debug panel.
 */
export const MAX_ACTIVE_NOTIFICATIONS = 4;

export interface RtsNotification {
  readonly id: number;
  readonly kind: RtsNotificationKind;
  readonly severity: RtsNotificationSeverity;
  readonly text: string;
  /**
   * How many separate times this problem has been *raised* this match; 1 means
   * "the first time". Deliberately not a count of refreshes: a polled condition
   * refreshes once per simulation tick, so counting those reported "×378" for a
   * single unroaded farm — a number that measures the tick rate, not anything
   * the player did or could act on. Counting raises makes it mean "your centre
   * has now been attacked three separate times", which is worth a glance.
   */
  readonly raises: number;
}

export interface RtsNotificationRequest {
  readonly kind: RtsNotificationKind;
  /**
   * Distinguishes notices of one kind that are genuinely different problems —
   * depleted stone vs depleted gold. Omit when the kind is its own subject.
   */
  readonly subject?: string;
  readonly text: string;
}

/** Why a post did not reach the player; returned so tests can assert intent. */
export type RtsNotificationPostResult = "posted" | "refreshed" | "suppressed";

interface NotificationEntry {
  readonly id: number;
  readonly kind: RtsNotificationKind;
  readonly key: string;
  readonly raises: number;
  text: string;
  expiresAt: number;
}

/** Per-key history, kept across expiry so a re-raise knows it is not the first. */
interface KeyHistory {
  raises: number;
  /** Time the post-expiry cooldown ends; 0 once it has lapsed. */
  mutedUntil: number;
}

export class RtsNotificationCenter {
  private readonly entries: NotificationEntry[] = [];
  private readonly history = new Map<string, KeyHistory>();
  private now = 0;
  private nextId = 1;

  /**
   * @returns `posted` for a newly raised notice, `refreshed` when it extended a
   * live one, `suppressed` when the cooldown swallowed it.
   */
  post(request: RtsNotificationRequest): RtsNotificationPostResult {
    const rule = RULES[request.kind];
    const key = notificationKey(request);
    const live = this.entries.find((entry) => entry.key === key);
    if (live) {
      // A still-true condition extends its notice. It does not count as another
      // raise: the player has not been told anything new.
      live.text = request.text;
      live.expiresAt = this.now + rule.displaySeconds;
      return "refreshed";
    }
    const history = this.history.get(key);
    if (history && this.now < history.mutedUntil) return "suppressed";
    const raises = (history?.raises ?? 0) + 1;
    this.history.set(key, { raises, mutedUntil: 0 });
    this.entries.push({
      id: this.nextId++,
      kind: request.kind,
      key,
      raises,
      text: request.text,
      expiresAt: this.now + rule.displaySeconds,
    });
    // Drop from the front: the oldest notice is the one the player has had the
    // most time to read.
    if (this.entries.length > MAX_ACTIVE_NOTIFICATIONS) this.entries.shift();
    return "posted";
  }

  /** Advance on the rendered-frame delta and retire anything that timed out. */
  advance(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError("Notification delta must be a non-negative finite number");
    }
    this.now += deltaSeconds;
    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      const entry = this.entries[index]!;
      if (entry.expiresAt > this.now) continue;
      this.entries.splice(index, 1);
      const cooldown = RULES[entry.kind].cooldownSeconds;
      const history = this.history.get(entry.key);
      if (history && cooldown > 0) history.mutedUntil = this.now + cooldown;
    }
  }

  active(): readonly RtsNotification[] {
    return this.entries.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      severity: RULES[entry.kind].severity,
      text: entry.text,
      raises: entry.raises,
    }));
  }

  /** A restarted match starts silent, with no cooldown or history carried over. */
  reset(): void {
    this.entries.length = 0;
    this.history.clear();
    this.now = 0;
    this.nextId = 1;
  }
}

function notificationKey(request: Pick<RtsNotificationRequest, "kind" | "subject">): string {
  return request.subject === undefined ? request.kind : `${request.kind}:${request.subject}`;
}
