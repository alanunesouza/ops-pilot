import type { ConversationMessage } from "../store/types.js";
import type { Memory } from "../memory/types.js";

/**
 * Compõe o prompt de entrada concatenando memórias do operador e o histórico recente de mensagens.
 * Se houver memórias ou mensagens anteriores, insere blocos contextuais delimitados.
 * 
 * @param message Mensagem atual do usuário
 * @param history Lista das últimas mensagens do diálogo
 * @param memories Lista de memórias semânticas relevantes recuperadas
 * @returns Texto contextualizado pronto para consumo pelas estratégias cognitivas
 */
export function composePromptWithHistory(
  message: string,
  history?: ConversationMessage[],
  memories?: Memory[]
): string {
  const blocks: string[] = [];

  if (memories && memories.length > 0) {
    const formattedMemories = memories.map((m) => `- ${m.fact}`).join("\n");
    blocks.push(`[Memórias do Operador]\n${formattedMemories}`);
  }

  if (history && history.length > 0) {
    const formattedHistory = history
      .map((msg) => {
        const roleLabel =
          msg.role === "assistant"
            ? "Assistant"
            : msg.role === "system"
            ? "System"
            : "User";
        return `${roleLabel}: ${msg.content}`;
      })
      .join("\n");
    blocks.push(`[Histórico da Conversa]\n${formattedHistory}`);
  }

  if (blocks.length === 0) {
    return message;
  }

  blocks.push(`[Mensagem Atual]\n${message}`);
  return blocks.join("\n\n");
}
