import { ChatOpenAI } from "@langchain/openai";

export function createModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY não foi encontrada. Certifique-se de configurar o arquivo .env e executar o Node/tsx com a flag '--env-file=.env'."
    );
  }

  const modelName = process.env.OPENROUTER_MODEL || "openrouter/free";

  return new ChatOpenAI({
    modelName,
    apiKey,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
    temperature: 0,
  });
}
