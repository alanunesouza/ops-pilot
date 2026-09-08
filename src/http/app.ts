import express, { Express, Request, Response, NextFunction } from "express";
import { ChatRequestSchema, ChatResponse } from "../schemas/chat.js";
import { StrategyRegistry, defaultRegistry } from "../agents/index.js";

export interface AppOptions {
  registry?: StrategyRegistry;
  timeoutMs?: number;
}

/**
 * Fábrica da aplicação Express v5 para o OpsPilot.
 */
export function createApp(options?: AppOptions): Express {
  const app = express();
  const registry = options?.registry ?? defaultRegistry;
  const timeoutMs =
    options?.timeoutMs ??
    (process.env.CHAT_TIMEOUT_MS ? parseInt(process.env.CHAT_TIMEOUT_MS, 10) : 180_000);

  app.use(express.json());

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

    const { message, strategy: strategyName, reflect } = parseResult.data;

    // 2. Resolução da estratégia no catálogo
    const strategy = registry.get(strategyName, { reflect });
    if (!strategy) {
      res.status(422).json({
        error: "Unprocessable Entity",
        message: `Estratégia desconhecida: '${strategyName}'. Opções disponíveis: ${registry.list().join(", ")}`,
      });
      return;
    }

    // 3. Execução com controle de timeout de 180s (configurável)
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

      const result = await Promise.race([strategy.run(message), timeoutPromise]);

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      // 4. Retorno com sucesso (200 OK)
      const responsePayload: ChatResponse = {
        answer: result.answer,
        trace: result.trace,
        metrics: result.metrics,
      };

      res.status(200).json(responsePayload);
    } catch (err: unknown) {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
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
