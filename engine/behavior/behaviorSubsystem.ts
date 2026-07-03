/**
 * Generic behavior subsystem: ticks registered behavior scripts against a live
 * set of entities derived from the scene.
 *
 * This is where the `SceneDocument` begins to act as a runtime source of truth:
 * the host derives entities once, the subsystem holds a mutable transform per
 * behaviored entity, behaviors mutate those transforms each tick, and a host
 * sink syncs the result back to the rendered objects.
 *
 * Pure: no Three.js or DOM. Value imports use relative paths because the
 * engine-test bundler (tools/run-engine-tests.mjs) resolves no path aliases.
 */
import {
  readAudioComponent,
  readBehaviorComponent,
  readInteractionComponent,
  readMessageBindingsComponent,
  readScriptActorComponent,
  readScriptDispatchersComponent,
  readScriptInterfacesComponent,
  readScriptReferencesComponent,
  readTransformComponent,
} from "../scene/components";
import type { AudioComponent, InteractionComponent, TransformComponent } from "../scene/components";
import type { EngineUpdateContext, Subsystem } from "../core/Subsystem";
import type { Entity, EntityId, SceneJsonValue } from "../scene/entity";
import type { ActionMap } from "../input/actionMap";
import type { AudioBus } from "../audio/audioSubsystem";
import {
  ScriptMessageBus,
  type ScriptMessageEnvelope,
  type ScriptMessageFlushResult,
  type ScriptMessagePayload,
  type ScriptMessageTraceEntry,
  type ScriptMessageWarning,
} from "./scriptMessages";
import {
  forwardVectorFromRotation,
  rightVectorFromRotation,
  upVectorFromRotation,
} from "../scene/transform";

/** Stable registry id for the behavior subsystem. */
export const BEHAVIOR_SUBSYSTEM_ID = "behavior";

export type EntityRef = EntityId;

export interface ScriptMessages {
  send(target: EntityRef, type: string, payload?: ScriptMessagePayload): void;
  emit(type: string, payload?: ScriptMessagePayload): void;
}

export type ReadonlyVec3 = readonly [number, number, number];

export interface ScriptTransformSnapshot {
  readonly position: ReadonlyVec3;
  readonly rotation: ReadonlyVec3;
  readonly scale: ReadonlyVec3;
}

export interface ScriptWorld {
  self(): EntityRef;
  ref(key: string): EntityRef | null;
  byName(name: string): EntityRef | null;
  byTag(tag: string): EntityRef[];
  byClassRef(classRef: string): EntityRef[];
  withInterface(name: string): EntityRef[];
  transformOf(ref: EntityRef): ScriptTransformSnapshot | null;
  distanceTo(ref: EntityRef): number | null;
  forwardOf(ref: EntityRef): ReadonlyVec3 | null;
  rightOf(ref: EntityRef): ReadonlyVec3 | null;
  upOf(ref: EntityRef): ReadonlyVec3 | null;
  nearestWithInterface(
    name: string,
    from: EntityRef,
    maxDistance?: number,
  ): EntityRef | null;
}

export interface ScriptState {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  toggle(key: string, fallback?: boolean): boolean;
  persist(key: string, value: SceneJsonValue): void;
}

export type ScriptTimerHandle = string;

export interface ScriptTimers {
  after(seconds: number, message: string, payload?: ScriptMessagePayload): ScriptTimerHandle;
  clear(handle: ScriptTimerHandle): void;
}

/** Options shared by the actor commands: opt in to save-game persistence. */
export interface ActorCommandOptions {
  /**
   * When true, the effect is written to this entity's persistent script state
   * ({@link getPersistentStateSnapshot}) so a save-game restores it on a fresh
   * scene. Never touches the layout file — runtime state only.
   */
  readonly persist?: boolean;
}

/**
 * The generic per-actor command surface (Unreal `SetActorHiddenInGame` /
 * `DestroyActor`). A behavior calls these on {@link BehaviorContext.actor} to
 * act on *its own* entity; the subsystem queues them and applies them once the
 * current tick's behaviors + message flush have run (deterministic end-of-tick
 * mutation), delivering visibility/teardown to the host via an
 * {@link ActorCommandSink}. Targeting other actors is intentionally not exposed
 * here — cross-actor effects go through script messages.
 */
export interface ActorCommands {
  /** Shows/hides this entity's rendered object (host-applied). */
  setVisibility(visible: boolean, options?: ActorCommandOptions): void;
  /**
   * Destroys this entity: after this tick it leaves the behavior instance set,
   * the world indexes and its message subscriptions, and the host removes its
   * render object + physics body. Subsequent ticks/messages/contacts skip it.
   */
  destroy(options?: ActorCommandOptions): void;
  /**
   * Destroys this entity after `seconds` of behavior simulation time. Passing 0
   * or a negative/non-finite value clears the active lifespan, matching Unreal's
   * SetLifeSpan(0) cancel semantics.
   */
  setLifeSpan(seconds: number): void;
}

/**
 * Host sink for {@link ActorCommands}, wired by the runtime shell (the
 * `AudioBus` precedent: engine defines the surface, the host implements it).
 * `setVisibility` toggles the entity's rendered object; `destroy` tears down its
 * render object and physics body. The subsystem does its own internal cleanup
 * (indexes/instances/subscriptions) before calling `destroy`, so the sink only
 * owns render + physics.
 */
export interface ActorCommandSink {
  setVisibility(entityId: EntityId, visible: boolean): void;
  destroy(entityId: EntityId): void;
}

/** A queued actor command, applied at the end of the tick it was issued in. */
type ActorCommand =
  | { readonly entityId: EntityId; readonly kind: "visibility"; readonly visible: boolean }
  | { readonly entityId: EntityId; readonly kind: "destroy" };

interface ScriptTimerRecord {
  readonly handle: ScriptTimerHandle;
  readonly entityId: EntityId;
  readonly message: string;
  readonly payload: ScriptMessagePayload | undefined;
  readonly createdFrame: number;
  remainingSeconds: number;
}

/**
 * Reserved persistent-state keys the actor commands use when `persist` is set.
 * Namespaced so they never collide with an authored `state`/`persist` key.
 */
const RESERVED_HIDDEN_KEY = "__actorHidden";
const RESERVED_DESTROYED_KEY = "__actorDestroyed";

export interface PersistentScriptStateEntry {
  readonly entityId: EntityId;
  readonly key: string;
  readonly value: SceneJsonValue;
}

/** Per-tick context handed to a behavior update function. */
export interface BehaviorContext {
  readonly entityId: EntityId;
  readonly engine: EngineUpdateContext;
  readonly actions: ActionMap;
  readonly messages: ScriptMessages;
  readonly world: ScriptWorld;
  readonly state: ScriptState;
  readonly timers: ScriptTimers;
  /** Generic per-actor commands (visibility/destroy) targeting this entity. */
  readonly actor: ActorCommands;
  readonly physics?: PhysicsQuery;
  readonly audio?: AudioBus;
  readonly audioComponent?: AudioComponent;
  /** This entity's authored interaction marker, when it carries one. */
  readonly interactionComponent?: InteractionComponent;
  readonly params: Record<string, SceneJsonValue>;
  /** Present when this behavior was invoked by a script message binding. */
  readonly message?: ScriptMessageEnvelope;
  /** This entity's transform; behaviors mutate it in place. */
  readonly transform: TransformComponent;
}

export type BehaviorUpdate = (context: BehaviorContext) => void;

export interface PhysicsContact {
  readonly a: EntityId;
  readonly b: EntityId;
  readonly isSensor: boolean;
}

/** A world-space axis-aligned bounding box. */
export interface PhysicsAabb {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

/**
 * A world-space walkable surface triangle (from a static trimesh collider), with
 * its upward normal component precomputed. Fed to the ground probe so a ramp is
 * walked at its true incline height instead of a flat AABB top.
 */
export interface PhysicsSurfaceTriangle {
  readonly a: readonly [number, number, number];
  readonly b: readonly [number, number, number];
  readonly c: readonly [number, number, number];
  /** |normal.y| after normalization: 1 = flat floor, 0 = vertical. */
  readonly normalY: number;
}

export interface PhysicsQuery {
  contactsForEntity(entityId: EntityId): readonly PhysicsContact[];
  /** World-space AABBs of every static, non-sensor collider (movement blockers). */
  staticBlockerAabbs(): readonly PhysicsAabb[];
  /** World-space walkable surface triangles (static trimesh) for the ground probe. */
  staticSurfaceTriangles(): readonly PhysicsSurfaceTriangle[];
  /** Half-extents (size*scale/2) of an entity's collider, or null if it has none. */
  colliderHalfExtents(entityId: EntityId): readonly [number, number, number] | null;
}

/** Resolves a script id to its update function. Runtime/game-owned. */
export interface BehaviorRegistry {
  get(scriptId: string): BehaviorUpdate | undefined;
}

/** Invoked after each behaviored entity ticks, to sync its transform to render. */
export type TransformSink = (entityId: EntityId, transform: TransformComponent) => void;

export interface BehaviorSubsystemOptions {
  readonly messageBus?: ScriptMessageBus;
  readonly messageTraceLimit?: number;
  readonly onMessageWarnings?: (warnings: readonly ScriptMessageWarning[]) => void;
  /** Host sink for actor visibility/destroy commands (A1); omitted in pure tests. */
  readonly actorCommandSink?: ActorCommandSink;
}

export interface ScriptMessageSubscriberDebugInfo {
  readonly entityId: EntityId;
  readonly message: string;
  readonly scriptId: string;
  readonly target: "self" | "any";
}

export interface ScriptActorDebugInfo {
  readonly entityId: EntityId;
  readonly name?: string;
  readonly classRef?: string;
  readonly nodeId?: string;
  readonly interfaces: readonly string[];
  readonly dispatchers: readonly { readonly name: string; readonly payload: Record<string, string> }[];
  readonly subscribers: readonly ScriptMessageSubscriberDebugInfo[];
}

export interface ScriptMessageDebugSnapshot {
  readonly lastFlush: ScriptMessageFlushResult;
  readonly recentMessages: readonly ScriptMessageTraceEntry[];
  readonly subscribers: readonly ScriptMessageSubscriberDebugInfo[];
}

interface RuntimeEntityState {
  id: EntityId;
  entity: Entity;
  transform: TransformComponent;
  audioComponent: AudioComponent | undefined;
  interactionComponent: InteractionComponent | undefined;
}

interface BehaviorInstance {
  runtime: RuntimeEntityState;
  update: BehaviorUpdate;
  params: Record<string, SceneJsonValue>;
}

export class BehaviorSubsystem implements Subsystem {
  readonly id = BEHAVIOR_SUBSYSTEM_ID;
  private instances: BehaviorInstance[] = [];
  private runtimeEntities = new Map<EntityId, RuntimeEntityState>();
  private nameIndex = new Map<string, EntityId>();
  private tagIndex = new Map<string, Set<EntityId>>();
  private classRefIndex = new Map<string, Set<EntityId>>();
  private nodeIdIndex = new Map<string, EntityId>();
  private interfaceIndex = new Map<string, Set<EntityId>>();
  private messageSubscriptions: Array<{ entityId: EntityId; unsubscribe: () => void }> = [];
  private messageSubscriberInfo: ScriptMessageSubscriberDebugInfo[] = [];
  private runtimeState = new Map<EntityId, Map<string, unknown>>();
  private persistentStateKeys = new Map<EntityId, Set<string>>();
  /** Actor commands queued this tick, applied after the message flush. */
  private commandQueue: ActorCommand[] = [];
  private timers = new Map<ScriptTimerHandle, ScriptTimerRecord>();
  private lifeSpans = new Map<EntityId, { remainingSeconds: number; createdFrame: number }>();
  private nextTimerId = 1;
  private readonly messageBus: ScriptMessageBus;
  private lastMessageFlushResult: ScriptMessageFlushResult = {
    processed: 0,
    delivered: 0,
    warnings: [],
  };
  private enabled = true;

  constructor(
    private readonly registry: BehaviorRegistry,
    private readonly actions: ActionMap,
    private readonly sink: TransformSink,
    private readonly physics?: PhysicsQuery,
    private readonly audio?: AudioBus,
    options: BehaviorSubsystemOptions = {},
  ) {
    this.messageBus =
      options.messageBus ??
      new ScriptMessageBus({
        targetExists: (target) => this.runtimeEntities.has(target),
        ...(options.messageTraceLimit !== undefined
          ? { recentTraceLimit: options.messageTraceLimit }
          : {}),
      });
    this.onMessageWarnings = options.onMessageWarnings;
    this.actorCommandSink = options.actorCommandSink;
  }

  private readonly onMessageWarnings:
    | ((warnings: readonly ScriptMessageWarning[]) => void)
    | undefined;

  private readonly actorCommandSink: ActorCommandSink | undefined;

  /**
   * Derives the live behavior set from a scene's entities. An entity becomes a
   * runtime instance when it has a Behavior whose scriptId resolves in the
   * registry and a Transform to mutate. Each instance gets its own mutable
   * transform copy (the runtime source of truth behaviors edit).
   */
  setEntities(entities: readonly Entity[]): void {
    this.resetMessageSubscriptions();
    this.messageBus.clear();
    const instances: BehaviorInstance[] = [];
    this.runtimeEntities.clear();
    this.nameIndex.clear();
    this.tagIndex.clear();
    this.classRefIndex.clear();
    this.nodeIdIndex.clear();
    this.interfaceIndex.clear();
    this.runtimeState.clear();
    this.persistentStateKeys.clear();
    this.commandQueue = [];
    this.timers.clear();
    this.lifeSpans.clear();

    for (const entity of entities) {
      const transform = readTransformComponent(entity);
      if (!transform) continue;
      const runtime: RuntimeEntityState = {
        id: entity.id,
        entity,
        transform: cloneTransform(transform),
        audioComponent: readAudioComponent(entity),
        interactionComponent: readInteractionComponent(entity),
      };
      this.runtimeEntities.set(entity.id, runtime);
      if (entity.name) this.nameIndex.set(entity.name, entity.id);
      for (const tag of entity.tags ?? []) this.addToIndex(this.tagIndex, tag, entity.id);
      const scriptActor = readScriptActorComponent(entity);
      if (scriptActor) {
        this.addToIndex(this.classRefIndex, scriptActor.classRef, entity.id);
        if (scriptActor.nodeId) this.nodeIdIndex.set(scriptActor.nodeId, entity.id);
      }
      const interfaces = readScriptInterfacesComponent(entity);
      for (const name of interfaces?.interfaces ?? []) {
        this.addToIndex(this.interfaceIndex, name, entity.id);
      }
    }

    for (const entity of entities) {
      const behavior = readBehaviorComponent(entity);
      if (!behavior) continue;
      const update = this.registry.get(behavior.scriptId);
      if (!update) continue;
      const runtime = this.runtimeEntities.get(entity.id);
      if (!runtime) continue;
      instances.push({
        runtime,
        update,
        params: behavior.params ?? {},
      });
    }
    this.instances = instances;

    for (const entity of entities) {
      const runtime = this.runtimeEntities.get(entity.id);
      if (!runtime) continue;
      const messageBindings = readMessageBindingsComponent(entity);
      for (const binding of messageBindings?.bindings ?? []) {
        const update = this.registry.get(binding.scriptId);
        if (!update) continue;
        const unsubscribe = this.messageBus.subscribe(
          binding.message,
          (envelope) => {
            const engine = this.currentEngine;
            if (!engine) return;
            const context = this.createContext(
              runtime,
              engine,
              binding.params ?? {},
              envelope,
            );
            update(context);
            this.sink(runtime.id, runtime.transform);
          },
          binding.target === "self" ? { target: runtime.id } : {},
        );
        this.messageSubscriptions.push({ entityId: runtime.id, unsubscribe });
        this.messageSubscriberInfo.push({
          entityId: runtime.id,
          message: binding.message,
          scriptId: binding.scriptId,
          target: binding.target,
        });
      }
    }
  }

  /** Drops all behavior instances (e.g. on scene teardown/reload). */
  clear(): void {
    this.instances = [];
    this.messageBus.clear();
    this.runtimeEntities.clear();
    this.nameIndex.clear();
    this.tagIndex.clear();
    this.classRefIndex.clear();
    this.nodeIdIndex.clear();
    this.interfaceIndex.clear();
    this.runtimeState.clear();
    this.persistentStateKeys.clear();
    this.commandQueue = [];
    this.timers.clear();
    this.lifeSpans.clear();
    this.resetMessageSubscriptions();
  }

  resetEntityTransform(entityId: EntityId, transform: TransformComponent): void {
    const runtime = this.runtimeEntities.get(entityId);
    if (!runtime) return;
    runtime.transform = cloneTransform(transform);
  }

  /**
   * Enables or disables behavior simulation. When disabled, update() is a no-op
   * so edit-mode hosts can keep authored scenes static until Play mode runs.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  getLastMessageFlushResult(): ScriptMessageFlushResult {
    return this.lastMessageFlushResult;
  }

  getScriptMessageDebugSnapshot(): ScriptMessageDebugSnapshot {
    return {
      lastFlush: this.lastMessageFlushResult,
      recentMessages: this.messageBus.getRecentTrace(),
      subscribers: this.messageSubscriberInfo,
    };
  }

  getScriptActorDebugInfo(entityId: EntityId): ScriptActorDebugInfo | null {
    const runtime = this.runtimeEntities.get(entityId);
    if (!runtime) return null;
    const actor = readScriptActorComponent(runtime.entity);
    const info: ScriptActorDebugInfo = {
      entityId,
      ...(runtime.entity.name ? { name: runtime.entity.name } : {}),
      ...(actor?.classRef ? { classRef: actor.classRef } : {}),
      ...(actor?.nodeId ? { nodeId: actor.nodeId } : {}),
      interfaces: readScriptInterfacesComponent(runtime.entity)?.interfaces ?? [],
      dispatchers: readScriptDispatchersComponent(runtime.entity)?.dispatchers ?? [],
      subscribers: this.messageSubscriberInfo.filter((subscriber) => subscriber.entityId === entityId),
    };
    return info;
  }

  getPersistentStateSnapshot(): PersistentScriptStateEntry[] {
    const entries: PersistentScriptStateEntry[] = [];
    for (const [entityId, keys] of this.persistentStateKeys) {
      const store = this.runtimeState.get(entityId);
      if (!store) continue;
      for (const key of keys) {
        if (!store.has(key)) continue;
        entries.push({
          entityId,
          key,
          value: cloneSceneJsonValue(store.get(key) as SceneJsonValue),
        });
      }
    }
    return entries.sort(
      (a, b) => a.entityId.localeCompare(b.entityId) || a.key.localeCompare(b.key),
    );
  }

  applyPersistentStateSnapshot(entries: readonly PersistentScriptStateEntry[]): void {
    for (const entry of entries) {
      if (!this.runtimeEntities.has(entry.entityId)) continue;
      let store = this.runtimeState.get(entry.entityId);
      if (!store) {
        store = new Map();
        this.runtimeState.set(entry.entityId, store);
      }
      store.set(entry.key, cloneSceneJsonValue(entry.value));
      this.markPersistentState(entry.entityId, entry.key);
    }
    this.applyPersistedActorEffects();
  }

  private currentEngine: EngineUpdateContext | null = null;
  private lastEngineFrame = 0;

  /**
   * Enqueues a script message from a non-behavior runtime source (e.g. a Game
   * Mode emitting an animation notify). Delivered on the next message flush.
   */
  emitScriptMessage(
    type: string,
    source: EntityId,
    payload?: ScriptMessagePayload,
    target?: EntityId,
  ): void {
    this.messageBus.send({
      frame: this.lastEngineFrame,
      type,
      source,
      ...(target !== undefined ? { target } : {}),
      ...(payload !== undefined ? { payload } : {}),
    });
  }

  /**
   * Subscribes a non-behavior runtime source (e.g. a Game Mode reacting to a
   * `death`/`ragdoll` event) to a script message type, optionally scoped to one
   * target entity. Returns an unsubscribe handle the caller must release on
   * teardown. Unlike actor-script message bindings this is not tracked in the
   * debug subscriber index; the caller owns the lifetime. Note that `clear()`
   * (scene teardown/reload) drops all subscriptions, so re-subscribe after a
   * rebuild if needed.
   */
  subscribeScriptMessage(
    type: string,
    handler: (envelope: ScriptMessageEnvelope) => void,
    options: { readonly target?: EntityId } = {},
  ): () => void {
    return this.messageBus.subscribe(
      type,
      handler,
      options.target !== undefined ? { target: options.target } : {},
    );
  }

  update(engine: EngineUpdateContext): void {
    if (!this.enabled) return;
    this.currentEngine = engine;
    this.lastEngineFrame = engine.frame;
    for (const instance of this.instances) {
      const context = this.createContext(instance.runtime, engine, instance.params);
      instance.update(context);
      this.sink(instance.runtime.id, instance.runtime.transform);
    }
    this.advanceTimers(engine);
    this.advanceLifeSpans(engine);
    this.lastMessageFlushResult = this.messageBus.flush();
    if (this.lastMessageFlushResult.warnings.length > 0) {
      this.onMessageWarnings?.(this.lastMessageFlushResult.warnings);
    }
    // Actor commands (visibility/destroy) apply once the tick's behaviors and
    // message handlers have all run, so a mutation is deterministic end-of-tick.
    this.flushActorCommands();
    this.currentEngine = null;
  }

  dispose(): void {
    this.clear();
  }

  private createContext(
    runtime: RuntimeEntityState,
    engine: EngineUpdateContext,
    params: Record<string, SceneJsonValue>,
    message?: ScriptMessageEnvelope,
  ): BehaviorContext {
    const context: BehaviorContext = {
      entityId: runtime.id,
      engine,
      actions: this.actions,
      messages: this.scriptMessages(runtime.id, engine),
      world: this.scriptWorld(runtime.id),
      state: this.scriptState(runtime.id),
      timers: this.scriptTimers(runtime.id, engine),
      actor: this.actorCommands(runtime.id),
      params,
      transform: runtime.transform,
    };
    if (this.physics) {
      (context as BehaviorContext & { physics: PhysicsQuery }).physics = this.physics;
    }
    if (this.audio) {
      (context as BehaviorContext & { audio: AudioBus }).audio = this.audio;
    }
    if (runtime.audioComponent) {
      (context as BehaviorContext & { audioComponent: AudioComponent }).audioComponent =
        runtime.audioComponent;
    }
    if (runtime.interactionComponent) {
      (context as BehaviorContext & { interactionComponent: InteractionComponent }).interactionComponent =
        runtime.interactionComponent;
    }
    if (message) {
      (context as BehaviorContext & { message: ScriptMessageEnvelope }).message = message;
    }
    return context;
  }

  private scriptTimers(entityId: EntityId, engine: EngineUpdateContext): ScriptTimers {
    return {
      after: (seconds, message, payload) => {
        const handle = `script-timer:${this.nextTimerId}`;
        this.nextTimerId += 1;
        this.timers.set(handle, {
          handle,
          entityId,
          message,
          payload: payload ? { ...payload } : undefined,
          createdFrame: engine.frame,
          remainingSeconds: Math.max(0, Number.isFinite(seconds) ? seconds : 0),
        });
        return handle;
      },
      clear: (handle) => {
        this.timers.delete(handle);
      },
    };
  }

  private scriptMessages(source: EntityId, engine: EngineUpdateContext): ScriptMessages {
    return {
      send: (target, type, payload) => {
        const input = { frame: engine.frame, type, source, target };
        this.messageBus.send(payload === undefined ? input : { ...input, payload });
      },
      emit: (type, payload) => {
        const input = { frame: engine.frame, type, source };
        this.messageBus.emit(payload === undefined ? input : { ...input, payload });
      },
    };
  }

  private scriptWorld(self: EntityId): ScriptWorld {
    return {
      self: () => self,
      ref: (key) => this.resolveReference(self, key),
      byName: (name) => this.nameIndex.get(name) ?? null,
      byTag: (tag) => [...(this.tagIndex.get(tag) ?? [])],
      byClassRef: (classRef) => [...(this.classRefIndex.get(classRef) ?? [])],
      withInterface: (name) => [...(this.interfaceIndex.get(name) ?? [])],
      transformOf: (ref) => this.transformOf(ref),
      distanceTo: (ref) => this.distanceBetween(self, ref),
      forwardOf: (ref) => this.directionOf(ref, forwardVectorFromRotation),
      rightOf: (ref) => this.directionOf(ref, rightVectorFromRotation),
      upOf: (ref) => this.directionOf(ref, upVectorFromRotation),
      nearestWithInterface: (name, from, maxDistance) =>
        this.nearestWithInterface(name, from, maxDistance),
    };
  }

  private scriptState(entityId: EntityId): ScriptState {
    const getStore = (): Map<string, unknown> => {
      let store = this.runtimeState.get(entityId);
      if (!store) {
        store = new Map();
        this.runtimeState.set(entityId, store);
      }
      return store;
    };
    return {
      get: (key, fallback) => (getStore().has(key) ? (getStore().get(key) as typeof fallback) : fallback),
      set: (key, value) => {
        getStore().set(key, value);
      },
      toggle: (key, fallback = false) => {
        const store = getStore();
        const next = !(store.has(key) ? Boolean(store.get(key)) : fallback);
        store.set(key, next);
        return next;
      },
      persist: (key, value) => {
        getStore().set(key, cloneSceneJsonValue(value));
        this.markPersistentState(entityId, key);
      },
    };
  }

  private actorCommands(entityId: EntityId): ActorCommands {
    return {
      setVisibility: (visible, options) => {
        this.commandQueue.push({ entityId, kind: "visibility", visible });
        if (options?.persist) this.scriptState(entityId).persist(RESERVED_HIDDEN_KEY, !visible);
      },
      destroy: (options) => {
        this.commandQueue.push({ entityId, kind: "destroy" });
        if (options?.persist) this.scriptState(entityId).persist(RESERVED_DESTROYED_KEY, true);
      },
      setLifeSpan: (seconds) => {
        if (!Number.isFinite(seconds) || seconds <= 0) {
          this.lifeSpans.delete(entityId);
          return;
        }
        this.lifeSpans.set(entityId, {
          remainingSeconds: seconds,
          createdFrame: this.currentEngine?.frame ?? this.lastEngineFrame,
        });
      },
    };
  }

  private advanceTimers(engine: EngineUpdateContext): void {
    if (this.timers.size === 0) return;
    const deltaSeconds = Math.max(0, engine.deltaSeconds);
    const due: ScriptTimerRecord[] = [];
    for (const timer of this.timers.values()) {
      if (!this.runtimeEntities.has(timer.entityId)) {
        this.timers.delete(timer.handle);
        continue;
      }
      if (timer.createdFrame === engine.frame) continue;
      timer.remainingSeconds -= deltaSeconds;
      if (timer.remainingSeconds > 0) continue;
      due.push(timer);
      this.timers.delete(timer.handle);
    }
    for (const timer of due) {
      if (!this.runtimeEntities.has(timer.entityId)) continue;
      const input = {
        frame: engine.frame,
        type: timer.message,
        source: timer.entityId,
        target: timer.entityId,
      };
      this.messageBus.send(
        timer.payload === undefined ? input : { ...input, payload: timer.payload },
      );
    }
  }

  private advanceLifeSpans(engine: EngineUpdateContext): void {
    if (this.lifeSpans.size === 0) return;
    const deltaSeconds = Math.max(0, engine.deltaSeconds);
    for (const [entityId, lifeSpan] of [...this.lifeSpans.entries()]) {
      if (!this.runtimeEntities.has(entityId)) {
        this.lifeSpans.delete(entityId);
        continue;
      }
      if (lifeSpan.createdFrame === engine.frame) continue;
      lifeSpan.remainingSeconds -= deltaSeconds;
      if (lifeSpan.remainingSeconds > 0) continue;
      this.lifeSpans.delete(entityId);
      this.commandQueue.push({ entityId, kind: "destroy" });
    }
  }

  /** Applies every queued actor command in issue order, then empties the queue. */
  private flushActorCommands(): void {
    if (this.commandQueue.length === 0) return;
    const commands = this.commandQueue;
    this.commandQueue = [];
    for (const command of commands) this.processActorCommand(command);
  }

  private processActorCommand(command: ActorCommand): void {
    if (command.kind === "visibility") {
      this.actorCommandSink?.setVisibility(command.entityId, command.visible);
      return;
    }
    // Destroy: drop the entity from the subsystem's own bookkeeping first (so it
    // stops ticking / being indexed / receiving messages this frame), then let
    // the host tear down its render object + physics body. Idempotent: a second
    // destroy for the same entity still notifies the host but skips re-detaching.
    if (this.runtimeEntities.has(command.entityId)) this.detachEntity(command.entityId);
    this.actorCommandSink?.destroy(command.entityId);
  }

  /**
   * Removes a destroyed entity from the live behavior set: its instance, world
   * indexes and message subscriptions. Its `runtimeState` is deliberately kept so
   * a persisted destroy/hide marker survives for a re-save ({@link getPersistentStateSnapshot});
   * `setEntities`/`clear` wipe it on the next rebuild.
   */
  private detachEntity(entityId: EntityId): void {
    const runtime = this.runtimeEntities.get(entityId);
    if (!runtime) return;
    this.instances = this.instances.filter((instance) => instance.runtime.id !== entityId);
    this.runtimeEntities.delete(entityId);
    if (runtime.entity.name && this.nameIndex.get(runtime.entity.name) === entityId) {
      this.nameIndex.delete(runtime.entity.name);
    }
    for (const [nodeId, id] of this.nodeIdIndex) {
      if (id === entityId) this.nodeIdIndex.delete(nodeId);
    }
    for (const set of this.tagIndex.values()) set.delete(entityId);
    for (const set of this.classRefIndex.values()) set.delete(entityId);
    for (const set of this.interfaceIndex.values()) set.delete(entityId);
    for (const [handle, timer] of [...this.timers.entries()]) {
      if (timer.entityId === entityId) this.timers.delete(handle);
    }
    this.lifeSpans.delete(entityId);
    const kept: Array<{ entityId: EntityId; unsubscribe: () => void }> = [];
    for (const subscription of this.messageSubscriptions) {
      if (subscription.entityId === entityId) subscription.unsubscribe();
      else kept.push(subscription);
    }
    this.messageSubscriptions = kept;
    this.messageSubscriberInfo = this.messageSubscriberInfo.filter(
      (subscriber) => subscriber.entityId !== entityId,
    );
  }

  /**
   * Re-applies persisted hide/destroy markers after a save-game restore (A1.3):
   * a fresh scene rebuilt the entities, the snapshot repopulated their reserved
   * keys, so an entity flagged destroyed/hidden in the save is brought back to
   * that state via the host sink. Applied immediately (restore runs after the
   * scene is fully built), not queued, so the effect lands before the first tick.
   */
  private applyPersistedActorEffects(): void {
    const effects: ActorCommand[] = [];
    for (const [entityId, store] of this.runtimeState) {
      if (store.get(RESERVED_DESTROYED_KEY) === true) {
        effects.push({ entityId, kind: "destroy" });
      } else if (store.get(RESERVED_HIDDEN_KEY) === true) {
        effects.push({ entityId, kind: "visibility", visible: false });
      }
    }
    for (const effect of effects) this.processActorCommand(effect);
  }

  private markPersistentState(entityId: EntityId, key: string): void {
    let keys = this.persistentStateKeys.get(entityId);
    if (!keys) {
      keys = new Set();
      this.persistentStateKeys.set(entityId, keys);
    }
    keys.add(key);
  }

  private nearestWithInterface(
    name: string,
    from: EntityId,
    maxDistance: number | undefined,
  ): EntityId | null {
    const source = this.runtimeEntities.get(from);
    if (!source) return null;
    let best: EntityId | null = null;
    let bestDistanceSq = Infinity;
    const maxDistanceSq = maxDistance === undefined ? Infinity : maxDistance * maxDistance;
    for (const targetId of this.interfaceIndex.get(name) ?? []) {
      if (targetId === from) continue;
      const target = this.runtimeEntities.get(targetId);
      if (!target) continue;
      const dx = target.transform.position[0] - source.transform.position[0];
      const dy = target.transform.position[1] - source.transform.position[1];
      const dz = target.transform.position[2] - source.transform.position[2];
      const distanceSq = dx * dx + dy * dy + dz * dz;
      if (distanceSq > maxDistanceSq || distanceSq >= bestDistanceSq) continue;
      best = targetId;
      bestDistanceSq = distanceSq;
    }
    return best;
  }

  private transformOf(entityId: EntityId): ScriptTransformSnapshot | null {
    const runtime = this.runtimeEntities.get(entityId);
    if (!runtime) return null;
    return cloneTransform(runtime.transform);
  }

  private distanceBetween(from: EntityId, to: EntityId): number | null {
    const source = this.runtimeEntities.get(from);
    const target = this.runtimeEntities.get(to);
    if (!source || !target) return null;
    return distanceBetweenTransforms(source.transform, target.transform);
  }

  private directionOf(
    entityId: EntityId,
    resolve: (rotation: [number, number, number]) => [number, number, number],
  ): ReadonlyVec3 | null {
    const runtime = this.runtimeEntities.get(entityId);
    if (!runtime) return null;
    return resolve(runtime.transform.rotation);
  }

  private resolveReference(sourceEntityId: EntityId, key: string): EntityId | null {
    const source = this.runtimeEntities.get(sourceEntityId);
    if (!source) return null;
    const references = readScriptReferencesComponent(source.entity);
    const reference = references?.references.find((entry) => entry.key === key);
    if (!reference) return null;
    const selector = reference.selector;
    if (selector.byNodeId) return this.nodeIdIndex.get(selector.byNodeId) ?? null;
    if (selector.byName) return this.nameIndex.get(selector.byName) ?? null;
    if (selector.byTag) return this.firstSorted(this.tagIndex.get(selector.byTag));
    if (selector.byClassRef) return this.firstSorted(this.classRefIndex.get(selector.byClassRef));
    if (selector.byInterface) return this.firstSorted(this.interfaceIndex.get(selector.byInterface));
    return null;
  }

  private firstSorted(values: Set<EntityId> | undefined): EntityId | null {
    if (!values || values.size === 0) return null;
    return [...values].sort((a, b) => a.localeCompare(b))[0] ?? null;
  }

  private addToIndex(index: Map<string, Set<EntityId>>, key: string, entityId: EntityId): void {
    let set = index.get(key);
    if (!set) {
      set = new Set();
      index.set(key, set);
    }
    set.add(entityId);
  }

  private resetMessageSubscriptions(): void {
    for (const subscription of this.messageSubscriptions) subscription.unsubscribe();
    this.messageSubscriptions = [];
    this.messageSubscriberInfo = [];
  }
}

function cloneTransform(transform: TransformComponent): TransformComponent {
  return {
    position: [...transform.position],
    rotation: [...transform.rotation],
    scale: [...transform.scale],
  };
}

function distanceBetweenTransforms(a: TransformComponent, b: TransformComponent): number {
  const dx = b.position[0] - a.position[0];
  const dy = b.position[1] - a.position[1];
  const dz = b.position[2] - a.position[2];
  return Math.hypot(dx, dy, dz);
}

function cloneSceneJsonValue(value: SceneJsonValue): SceneJsonValue {
  if (Array.isArray(value)) return value.map(cloneSceneJsonValue);
  if (typeof value === "object" && value !== null) {
    const clone: Record<string, SceneJsonValue> = {};
    for (const [key, entry] of Object.entries(value)) clone[key] = cloneSceneJsonValue(entry);
    return clone;
  }
  return value;
}
