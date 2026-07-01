/**
 * Dialogue and Voice — typed schema for authored dialogue assets.
 *
 * Two asset kinds, modelled on Unreal's Dialogue Voice / Dialogue Wave split:
 *
 * - `*.dialoguevoice.json` → {@link DialogueVoiceAsset}: a speaking voice's
 *   identity/metadata (gender, plurality, locale hints). Carries no audio.
 * - `*.dialogue.json`      → {@link DialogueLineAsset}: one authored line. Holds
 *   spoken/subtitle text, voice-actor direction, and one or more
 *   {@link DialogueContextMapping}s that resolve the same line to different
 *   recorded audio depending on speaker/listener/locale context.
 *
 * The resolver (`dialogueResolver.ts`) is pure and headless; the runtime
 * (`dialogueSubsystem.ts`) plays a resolved line's audio and drives subtitles.
 * Conversation sequencing (`*.conversation.json`) is a later track (D3) and is
 * intentionally not modelled here.
 */

export const DIALOGUE_VOICE_GENDERS = ["neutral", "feminine", "masculine"] as const;
export type DialogueVoiceGender = (typeof DIALOGUE_VOICE_GENDERS)[number];

export const DIALOGUE_VOICE_PLURALITIES = ["singular", "plural"] as const;
export type DialogueVoicePlurality = (typeof DIALOGUE_VOICE_PLURALITIES)[number];

/** A dialogue line's audio resolves to either a raw `sound` clip or a Sound Cue. */
export const DIALOGUE_AUDIO_SOURCE_TYPES = ["sound", "soundCue"] as const;
export type DialogueAudioSourceType = (typeof DIALOGUE_AUDIO_SOURCE_TYPES)[number];

/**
 * A speaking voice identity. Referenced by dialogue lines (as speaker/target)
 * and by conversation nodes. Holds no audio — it is metadata that, together with
 * listener context, selects which recorded {@link DialogueContextMapping} plays.
 */
export interface DialogueVoiceAsset {
  schema: 1;
  type: "dialogueVoice";
  id: string;
  name: string;
  /** Optional binding to a scene actor/character this voice speaks for. */
  actorId?: string;
  /** Human-facing speaker name shown on the subtitle (defaults to `name`). */
  displayName?: string;
  gender?: DialogueVoiceGender;
  plurality?: DialogueVoicePlurality;
  /** Preferred locales for this voice's recordings (localization hint). */
  localeHints?: string[];
}

/**
 * Maps a dialogue line to concrete recorded audio for one speaker/listener/locale
 * context. The same line can carry several mappings; the resolver picks the best
 * match for the runtime play context (see `dialogueResolver.ts`).
 */
export interface DialogueContextMapping {
  /** Voice doing the speaking. Required — a mapping always has a speaker. */
  speakerVoiceId: string;
  /** Listener voices this mapping is directed at (empty/absent = any listener). */
  targetVoiceIds?: string[];
  /** Locale this recording is for (absent = locale-agnostic fallback). */
  locale?: string;
  /** Resolved audio asset id (a `sound` clip or a `soundCue`). Absent = subtitle only. */
  audioSourceId?: string;
  /** Whether `audioSourceId` names a raw sound or a Sound Cue. Defaults to `sound`. */
  audioSourceType?: DialogueAudioSourceType;
  /** Localization table key for this context's translated text/audio (D4). */
  localizationKey?: string;
}

/**
 * One authored spoken line. `spokenText` is the canonical script text;
 * `subtitleText` overrides what is displayed when present. Context mappings bind
 * the line to recorded audio per speaker/listener/locale.
 */
export interface DialogueLineAsset {
  schema: 1;
  type: "dialogueLine";
  id: string;
  spokenText: string;
  /** Displayed subtitle when it differs from the spoken script text. */
  subtitleText?: string;
  /** Direction notes for the voice actor (not shown in game). */
  voiceActorDirection?: string;
  /** Marks mature content so a project can gate/skip it. */
  mature?: boolean;
  contexts: DialogueContextMapping[];
}

/** Runtime context for a `playLine` call — who speaks, who listens, which locale. */
export interface DialoguePlayContext {
  speakerVoiceId?: string;
  targetVoiceId?: string;
  locale?: string;
}

export function isDialogueVoiceGender(value: unknown): value is DialogueVoiceGender {
  return typeof value === "string" && DIALOGUE_VOICE_GENDERS.includes(value as DialogueVoiceGender);
}

export function isDialogueVoicePlurality(value: unknown): value is DialogueVoicePlurality {
  return (
    typeof value === "string" &&
    DIALOGUE_VOICE_PLURALITIES.includes(value as DialogueVoicePlurality)
  );
}

export function isDialogueAudioSourceType(value: unknown): value is DialogueAudioSourceType {
  return (
    typeof value === "string" &&
    DIALOGUE_AUDIO_SOURCE_TYPES.includes(value as DialogueAudioSourceType)
  );
}

export function isDialogueVoiceAsset(value: unknown): value is DialogueVoiceAsset {
  return (
    !!value &&
    typeof value === "object" &&
    (value as DialogueVoiceAsset).type === "dialogueVoice" &&
    typeof (value as DialogueVoiceAsset).id === "string"
  );
}

export function isDialogueLineAsset(value: unknown): value is DialogueLineAsset {
  return (
    !!value &&
    typeof value === "object" &&
    (value as DialogueLineAsset).type === "dialogueLine" &&
    typeof (value as DialogueLineAsset).id === "string"
  );
}
