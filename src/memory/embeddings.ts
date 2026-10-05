import { pipeline } from "@huggingface/transformers";

let extractorPromise: Promise<any> | null = null;

/**
 * Retorna o pipeline de extração de embeddings (lazy singleton).
 */
export async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractorPromise;
}

/**
 * Gera o embedding de um texto em linguagem natural.
 * Utiliza pooling "mean" e normalização unitária ("normalize: true").
 * 
 * @param text Texto de entrada
 * @returns Float32Array contendo o vetor normalizado de 384 dimensões
 */
export async function embed(text: string): Promise<Float32Array> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return new Float32Array(output.data);
}

/**
 * Calcula o produto escalar entre dois vetores float32.
 * Para vetores normalizados com norma unitária, o produto escalar equivale à similaridade de cosseno.
 * 
 * @param a Primeiro vetor
 * @param b Segundo vetor
 * @returns Pontuação de similaridade entre -1.0 e 1.0
 */
export function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}
