import { z } from "zod";

export const statusSchema = z.object({
  status: z.object({
    indicator: z.string(),
    description: z.string(),
  }),
});
export type StatuspageResponse = z.infer<typeof statusSchema>;

export const STATUS_URL = {
  github: "https://www.githubstatus.com/api/v2/status.json",
  cloudflare: "https://www.cloudflarestatus.com/api/v2/status.json",
} as const;

export type ProviderName = keyof typeof STATUS_URL;

export const ProviderEnumSchema = z.enum(["github", "cloudflare"]);
export type ProviderEnum = z.infer<typeof ProviderEnumSchema>;

export const ProviderStatusInputSchema = z.object({
  provider: ProviderEnumSchema.default("github").describe(
    "Provedor externo a consultar o status: 'github' ou 'cloudflare'. Padrão: 'github'."
  ),
});
export type ProviderStatusInput = z.infer<typeof ProviderStatusInputSchema>;
