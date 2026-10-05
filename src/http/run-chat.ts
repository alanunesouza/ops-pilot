import { ChatRequest, ChatResponse } from "../schemas/chat.js";
import { ReasoningStrategy, defaultRegistry, StrategyRegistry } from "../agents/index.js";
import { ConversationStore, getConversationStore } from "../store/index.js";
import { MemoryStore, getMemoryStore, Memory, reflectLearning } from "../memory/index.js";

export type ChatInput = ChatRequest;

export interface RunChatOptions {
  conversations?: ConversationStore;
  memoryStore?: MemoryStore;
  strategy?: ReasoningStrategy;
  registry?: StrategyRegistry;
  reflectorModel?: any;
  onReflect?: (reflection: any) => void;
}

export class UnknownStrategyError extends Error {
  constructor(strategyName: string, available: string[]) {
    super(`Estratégia desconhecida: '${strategyName}'. Opções disponíveis: ${available.join(", ")}`);
    this.name = "UnknownStrategyError";
  }
}

/**
 * Executa o fluxo de diálogo persistente multi-turnos com a APO.
 */
export async function runChat(
  input: ChatInput,
  options?: RunChatOptions
): Promise<ChatResponse> {
  const conversations = options?.conversations ?? getConversationStore();
  const registry = options?.registry ?? defaultRegistry;
  const strategy =
    options?.strategy ??
    registry.get(input.strategy, { reflect: input.reflect });

  if (!strategy) {
    throw new UnknownStrategyError(input.strategy, registry.list());
  }

  const conversationId = input.conversationId ?? conversations.create();
  // buscando as ultimas 12 mensagens do historico da conversa
  const history = conversations.lastMessages(conversationId, 12);

  let memories: Memory[] | undefined;
  const memoryStore = options?.memoryStore ?? getMemoryStore();

  if (input.userId) {
    memories = await memoryStore.recall(input.userId, input.message, 3);
  }

  conversations.append(conversationId, "user", input.message);
  const result = await strategy.run({ message: input.message, history, memories });
  conversations.append(conversationId, "assistant", result.answer);

  // Disparo assíncrono não bloqueante do refletor de aprendizado contínuo
  if (input.userId) {
    reflectLearning(input.userId, input.message, {
      memoryStore,
      model: options?.reflectorModel,
    })
      .then((res) => options?.onReflect?.(res))
      .catch((err) => {
        console.error("[LearningReflector] Erro assíncrono ao refletir aprendizado:", err);
      });
  }

  return {
    conversationId,
    ...result,
    metrics: {
      ...result.metrics,
      historyMessages: history.length,
      memoriesRecalled: memories ? memories.length : 0,
    },
  };
}
