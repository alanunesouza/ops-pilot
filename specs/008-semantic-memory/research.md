# Research: Memória Semântica do Operador (`008-semantic-memory`)

**Feature Branch**: `008-semantic-memory`  
**Date**: 2026-10-05  
**Spec**: [spec.md](./spec.md)

---

## 1. Contexto e Objetivos

Esta pesquisa estabelece a arquitetura de memória semântica vetorial para o OpsPilot, permitindo que a APO aprenda, deduplique e recupere preferências e fatos contextuais por operador (`userId`), integrando-os diretamente ao prompt de atendimento de `POST /chat`.

Os pilares técnicos a serem analisados são:
1. Geração de embeddings local usando `@huggingface/transformers` (`all-MiniLM-L6-v2`) via *lazy singleton*.
2. Estrutura relacional da tabela `memories` e armazenamento binário de vetores em `BLOB`.
3. Algoritmo de similaridade vetorial via produto escalar (com vetores unitários normalizados).
4. Regras de deduplicação semântica ($> 0.92$) em `remember` e limiar de relevância ($\ge 0.3$) em `recall`.
5. Injeção de contexto semântico no fluxo de diálogo do `/chat` sem alterar a interface pública de quem não utiliza `userId`.

---

## 2. Decisões Arquiteturais e Pesquisas Técnicas

### 2.1. Pipeline de Embeddings Local (`@huggingface/transformers`)

- **Decisão**: Utilizar a biblioteca `@huggingface/transformers` com o modelo `Xenova/all-MiniLM-L6-v2`.
- **Configuração do Pipeline**:
  - Task: `"feature-extraction"`
  - Argumentos de inferência: `{ pooling: "mean", normalize: true }`
  - Lazy Singleton: O pipeline só é carregado sob demanda na primeira chamada a `generateEmbedding()`, evitando impacto no tempo de inicialização do servidor HTTP.
- **Rationale**:
  - O modelo `all-MiniLM-L6-v2` gera vetores compactos de 384 dimensões em ponto flutuante (`Float32Array`).
  - A normalização prévia (`normalize: true`) garante que todo vetor resultante possua norma L2 unitária ($\|\mathbf{v}\| = 1$).
  - Em vetores unitários, a similaridade de cosseno equivale exatamente ao produto escalar:
    $$\text{cosine\_similarity}(\mathbf{u}, \mathbf{v}) = \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\| \|\mathbf{v}\|} = \mathbf{u} \cdot \mathbf{v} = \sum_{i=0}^{383} u_i \cdot v_i$$
  - Essa equivalência elimina a necessidade de raízes quadradas no momento da busca, tornando o cálculo de relevância extremamente rápido em JavaScript/TypeScript.
- **Alternativas consideradas**:
  - *Chamada a APIs remotas (OpenAI / Cohere)*: Rejeitada pela restrição explícita do usuário de inferência local e para evitar custos de latência e credenciais externas no pipeline de memória.

---

### 2.2. Armazenamento Relacional em SQLite (`BLOB`)

- **Decisão**: Armazenar os embeddings diretamente como `BLOB` binário no SQLite na tabela `memories`.
- **Esquema Relacional**:
  ```sql
  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    fact TEXT NOT NULL,
    embedding BLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories (user_id);
  ```
- **Manipulação de Buffer**:
  - Para gravação (`Float32Array` → `Buffer`):
    ```typescript
    const buffer = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
    ```
  - Para leitura (`Buffer` → `Float32Array`):
    ```typescript
    const embedding = new Float32Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength / Float32Array.BYTES_PER_ELEMENT
    );
    ```
- **Rationale**:
  - 384 números de 4 bytes ocupam exatamente 1.536 bytes em formato binário bruto (`BLOB`).
  - Serialização para JSON ocuparia ~3.500 bytes e exigiria parsing de texto para cada linha comparada. O acesso via `BLOB` em memória é de ordem de magnitude mais rápido.
- **Alternativas consideradas**:
  - *Extensão sqlite-vss / sqlite-vec*: Rejeitada por introduzir dependências nativas de compilação em C++ desnecessárias para o volume alvo (até dezenas/centenas de memórias por usuário), onde o cálculo vetorial em JS roda em menos de 1ms.

---

### 2.3. Lógica de Deduplicação (`remember`) e Recuperação (`recall`)

- **Deduplicação (`remember`)**:
  - Antes de inserir um novo fato para o `userId`, calcula o embedding do novo fato.
  - Carrega as memórias existentes do `userId` e calcula o produto escalar.
  - Se $\max(\text{score}) > 0.92$, o fato é considerado semanticamente idêntico e a inserção é ignorada, retornando `{ inserted: false, reason: "deduplicated", memory: existingMemory }`.
  - Caso contrário, insere na tabela e retorna `{ inserted: true, memory: newMemory }`.
- **Recuperação (`recall`)**:
  - Gera o embedding da consulta do usuário.
  - Carrega as memórias do `userId`.
  - Calcula o produto escalar para cada memória:
    ```typescript
    function dotProduct(a: Float32Array, b: Float32Array): number {
      let sum = 0;
      for (let i = 0; i < a.length; i++) {
        sum += a[i] * b[i];
      }
      return sum;
    }
    ```
  - Filtra memórias com $\text{score} \ge 0.3$.
  - Ordena por `score DESC`.
  - Retorna as top-$N$ (padrão 3).

---

### 2.4. Integração no Diálogo do `/chat` via `userId`

- **Decisão**:
  - `ChatRequestSchema` recebe `userId: z.string().trim().min(1).optional()`.
  - Se `userId` for informado:
    - O controller ou `runChat` invoca `memoryStore.recall(userId, message, 3)`.
    - Se houver memórias retornadas, formata um bloco contextual:
      ```text
      [Memórias Semânticas do Operador]
      - Fato 1
      - Fato 2

      [Histórico da Conversa]
      ...

      [Mensagem Atual]
      ...
      ```
  - Se `userId` for omitido, o comportamento anterior de `POST /chat` permanece rigorosamente inalterado.

---

## 3. Resumo de Diretórios e Componentes

| Arquivo | Função |
|---|---|
| `src/memory/embeddings.ts` | Lazy singleton do pipeline de embedding `@huggingface/transformers` com pooling `mean` e normalização unitária |
| `src/memory/memory-store.ts` | Implementação do `SqliteMemoryStore` (`remember`, `recall`, `forget`) |
| `src/memory/types.ts` | Interfaces TypeScript e tipos de memória e resultados |
| `src/http/run-chat.ts` | Injeção do bloco de memórias no prompt quando `userId` estiver presente |
| `src/schemas/chat.ts` | Adição de `userId` opcional ao schema |
