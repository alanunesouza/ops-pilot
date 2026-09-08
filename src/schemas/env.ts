import { z } from "zod";

export const EnvSchema = z.object({
  OPENROUTER_API_KEY: z.string().optional().default(""),
  OPENROUTER_MODEL: z.string().optional().default(""),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function getEnv(): EnvConfig {
  return EnvSchema.parse(process.env);
}
