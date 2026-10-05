import { z } from "zod";

/**
 * Schema para o refletor de aprendizado contínuo estruturado.
 */
export const LearningReflectionSchema = z.object({
  hasLearning: z
    .boolean()
    .describe("True se a mensagem contém uma preferência durável, papel ou diretriz permanente do operador."),
  fact: z
    .string()
    .trim()
    .min(5)
    .optional()
    .describe("Fato durável formulado em terceira pessoa (ex: 'O operador prefere...'), omitindo segredos ou pedidos efêmeros."),
});

export type LearningReflection = z.infer<typeof LearningReflectionSchema>;

/**
 * Schema de entrada para a ferramenta forget_preference.
 */
export const ForgetPreferenceInputSchema = z.object({
  preference: z
    .string()
    .trim()
    .min(1)
    .describe("Descrição em linguagem natural ou palavra-chave da preferência que o operador deseja esquecer."),
});

export type ForgetPreferenceInput = z.infer<typeof ForgetPreferenceInputSchema>;
