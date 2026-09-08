export * from "./agents/types.js";
export * from "./agents/index.js";
export {
  withReflection,
  critique,
  evaluateAnswer,
  observationsOf,
  CRITIC_PROMPT,
} from "./agents/reflection.js";
export { verdictSchema, CritiqueSchema } from "./schemas/critique.js";
export * from "./schemas/chat.js";
export { createApp } from "./http/app.js";

// Se executado diretamente como ponto de entrada principal, inicia o servidor HTTP
if (process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js")) {
  import("./http/server.js");
}
