import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { createModel } from "../agents/model.js";
import { LearningReflectionSchema, LearningReflection } from "../schemas/memory.js";
import { MemoryStore } from "./types.js";
import { getMemoryStore } from "./index.js";

export interface ReflectLearningOptions {
  model?: any;
  memoryStore?: MemoryStore;
}

const SENSITIVE_PATTERN = /\b(password|senha|secret|bearer|token|api[_-]?key|jwt|credentials|credencial)\b/i;

export const REFLECTOR_SYSTEM_PROMPT = `Você é o Refletor de Aprendizado Contínuo do OpsPilot.
Sua função é analisar a última mensagem do operador e extrair fatos duráveis, preferências de plantão ou papéis de trabalho permanentes.

REGRAS DE DISCRIMINAÇÃO:
1. Extraia APENAS preferências de longo prazo, procedimentos padrões preferidos ou responsabilidades de equipe (ex: "O operador prefere chaveamento de tráfego antes de reiniciar serviços", "O operador é o responsável pelos serviços de pagamentos").
2. Formule sempre o fato em terceira pessoa ("O operador...").
3. NUNCA extraia pedidos pontuais, ordens imediatas ou comandos transitórios (ex: "verifique o pod agora", "reinicie a API", "abra um incidente para o alerta 2", "quantos alertas temos?"). Se a mensagem for um pedido pontual ou mera pergunta sem diretriz durável, defina hasLearning = false.
4. NUNCA extraia segredos, senhas, tokens de acesso, credenciais, chaves de API ou dados sensíveis. Se a mensagem contiver segredos, senhas ou tokens, defina hasLearning = false e ignore o fato.`;

/**
 * Analisa a última mensagem do usuário, destila fatos duráveis e persiste no MemoryStore.
 */
export async function reflectLearning(
  userId: string,
  userMessage: string,
  options?: ReflectLearningOptions
): Promise<LearningReflection> {
  const cleanMessage = userMessage.trim();
  if (!cleanMessage) {
    return { hasLearning: false };
  }

  // Guardrail determinístico imediato contra segredos e credenciais
  if (SENSITIVE_PATTERN.test(cleanMessage)) {
    return { hasLearning: false };
  }

  const model = options?.model ?? createModel();
  const memoryStore = options?.memoryStore ?? getMemoryStore();

  const structuredLlm = typeof model.withStructuredOutput === "function"
    ? model.withStructuredOutput(LearningReflectionSchema)
    : model;

  const result: LearningReflection = await structuredLlm.invoke([
    new SystemMessage(REFLECTOR_SYSTEM_PROMPT),
    new HumanMessage(cleanMessage),
  ]);

  if (!result.hasLearning || !result.fact) {
    return { hasLearning: false };
  }

  const cleanFact = result.fact.trim();

  // Guardrail secundário sobre o fato formulado pelo modelo
  if (cleanFact.length < 5 || SENSITIVE_PATTERN.test(cleanFact)) {
    return { hasLearning: false };
  }

  // Persiste a memória destilada para o usuário
  await memoryStore.remember(userId, cleanFact);

  return {
    hasLearning: true,
    fact: cleanFact,
  };
}
