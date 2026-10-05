import express, { Express, Request, Response, NextFunction } from "express";
import { ChatRequestSchema, ChatResponse } from "../schemas/chat.js";
import { StrategyRegistry, defaultRegistry } from "../agents/index.js";
import { ConversationStore, getConversationStore } from "../store/index.js";
import { MemoryStore, getMemoryStore } from "../memory/index.js";
import { runChat, UnknownStrategyError } from "./run-chat.js";

export interface AppOptions {
  registry?: StrategyRegistry;
  timeoutMs?: number;
  conversations?: ConversationStore;
  memoryStore?: MemoryStore;
  reflectorModel?: any;
  onReflect?: (reflection: any) => void;
}

export { runChat };

/**
 * Fábrica da aplicação Express v5 para o OpsPilot.
 */
export function createApp(options?: AppOptions): Express {
  const app = express();
  const registry = options?.registry ?? defaultRegistry;
  const conversations = options?.conversations ?? getConversationStore();
  const memoryStore = options?.memoryStore ?? getMemoryStore();
  const reflectorModel = options?.reflectorModel;
  const onReflect = options?.onReflect;
  const timeoutMs =
    options?.timeoutMs ??
    (process.env.CHAT_TIMEOUT_MS ? parseInt(process.env.CHAT_TIMEOUT_MS, 10) : 180_000);

  app.use(express.json());
  // Suporte flexível a requisições com corpo JSON sem cabeçalho Content-Type (ex.: curl -d '{...}')
  app.use(express.text({ type: "*/*" }));
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (typeof req.body === "string" && (req.body.trim().startsWith("{") || req.body.trim().startsWith("["))) {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        // Ignora se não for JSON válido
      }
    }
    next();
  });

  app.post("/chat", async (req: Request, res: Response, next: NextFunction) => {
    // 1. Validação na fronteira com Zod
    const parseResult = ChatRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: "Bad Request",
        message: "Corpo da requisição inválido",
        issues: parseResult.error.issues,
      });
      return;
    }

    const { strategy: strategyName, reflect } = parseResult.data;

    // 2. Resolução da estratégia no catálogo
    const strategy = registry.get(strategyName, { reflect });
    if (!strategy) {
      res.status(422).json({
        error: "Unprocessable Entity",
        message: `Estratégia desconhecida: '${strategyName}'. Opções disponíveis: ${registry.list().join(", ")}`,
      });
      return;
    }

    // 3. Execução com controle de timeout
    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          const timeoutError = new Error(
            `A execução da estratégia excedeu o tempo limite de ${Math.round(timeoutMs / 1000)}s.`
          );
          timeoutError.name = "GatewayTimeoutError";
          reject(timeoutError);
        }, timeoutMs);
      });

      const responsePayload = await Promise.race([
        runChat(parseResult.data, {
          conversations,
          memoryStore,
          strategy,
          registry,
          reflectorModel,
          onReflect,
        }),
        timeoutPromise,
      ]);

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      // 4. Retorno com sucesso (200 OK)
      res.status(200).json(responsePayload);
    } catch (err: unknown) {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      if (err instanceof UnknownStrategyError) {
        res.status(422).json({
          error: "Unprocessable Entity",
          message: err.message,
        });
        return;
      }

      const isTimeout =
        (err as { name?: string })?.name === "GatewayTimeoutError" ||
        (err instanceof Error && err.message.includes("tempo limite"));

      if (isTimeout) {
        res.status(504).json({
          error: "Gateway Timeout",
          message:
            err instanceof Error
              ? err.message
              : `A execução da estratégia excedeu o tempo limite de ${Math.round(timeoutMs / 1000)}s.`,
        });
        return;
      }

      // 5. Erro interno inesperado
      res.status(500).json({
        error: "Internal Server Error",
        message: err instanceof Error ? err.message : "Erro interno durante a execução do agente.",
      });
    }
  });

  return app;
}
