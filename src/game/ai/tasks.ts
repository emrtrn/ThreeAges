/**
 * Project AI task registry.
 *
 * Keep game-specific combat/mission tasks here. For now the project exposes the
 * generic Forge built-ins (wait, setBlackboard, sendMessage, move requests).
 */
import { createDefaultAiTaskRegistry, type AiTaskRegistry } from "@engine/ai/behaviorRunner";

export function createGameAiTaskRegistry(): AiTaskRegistry {
  return createDefaultAiTaskRegistry();
}
