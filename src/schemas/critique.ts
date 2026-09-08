import { z } from "zod";

/**
 * Schema para validação estruturada do parecer emitido pelo crítico no padrão de reflection.
 */
export const verdictSchema = z.object({
  approved: z.boolean().describe("true se a resposta estiver factualmente precisa e consistente com as observações; false se houver erros, omissões ou alucinações"),
  feedback: z.string().describe("se reprovado: o que corrigir, em específico e acionável; se aprovado: justificativa sucinta"),
});

export const CritiqueSchema = verdictSchema;

export type CritiqueResult = z.infer<typeof CritiqueSchema>;
