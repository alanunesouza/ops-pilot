import { ReasoningStrategy } from "./types.js";
import { reactStrategy } from "./react.js";
import { planAndExecuteStrategy } from "./plan-and-execute.js";
import { withReflection } from "./reflection.js";

export * from "./types.js";
export * from "./react.js";
export * from "./plan-and-execute.js";
export * from "./reflection.js";

export interface StrategyLookupOptions {
  reflect?: boolean;
}

/**
 * Catálogo e gerenciador central de estratégias cognitivas de raciocínio.
 */
export class StrategyRegistry {
  private strategies = new Map<string, ReasoningStrategy>();

  constructor(initialStrategies?: Record<string, ReasoningStrategy>) {
    // Registra estratégias padrão
    this.register("react", reactStrategy);
    this.register("plan-and-execute", planAndExecuteStrategy);
    this.register("plan-execute", planAndExecuteStrategy); // alias

    if (initialStrategies) {
      for (const [name, strat] of Object.entries(initialStrategies)) {
        this.register(name, strat);
      }
    }
  }

  /**
   * Registra uma nova estratégia no catálogo.
   */
  public register(name: string, strategy: ReasoningStrategy): void {
    const key = name.trim().toLowerCase();
    this.strategies.set(key, strategy);
  }

  /**
   * Obtém uma estratégia pelo nome, aplicando reflexão dinamicamente se solicitado.
   */
  public get(name: string = "react", options?: StrategyLookupOptions): ReasoningStrategy | undefined {
    const key = (name || "react").trim().toLowerCase();
    const strategy = this.strategies.get(key);
    if (!strategy) {
      return undefined;
    }

    if (options?.reflect) {
      return withReflection(strategy);
    }

    return strategy;
  }

  /**
   * Lista os identificadores canônicos de estratégias disponíveis.
   */
  public list(): string[] {
    return Array.from(new Set(this.strategies.keys()));
  }
}

export const defaultRegistry = new StrategyRegistry();

export function getStrategy(
  name: string = "react",
  options?: StrategyLookupOptions
): ReasoningStrategy | undefined {
  return defaultRegistry.get(name, options);
}
