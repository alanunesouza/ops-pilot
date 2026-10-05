# Feature Specification: Memória Semântica do Operador (`008-semantic-memory`)

**Feature Branch**: `008-semantic-memory`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "Memória semântica: MemoryStore por userId - rember (dedup > 0.92), recall top-3 por produto escalar (min 0.3), forget; tabela memories, embedding all-MiniLM-L6-v2 local em BLOB; /chat ganha userId e injeta o recall no prompt; teste: recall acha fato sem palavra em comum. user: @huggingface/transformers com pooling: mean + normaliza: true e lazy singleton src/memory/embeddings.ts e src/memory/memory-store.ts. As colunas de memories (id, user_id, fact, embedding, created_at)"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Armazenamento e Deduplicação Semântica de Fatos do Operador (Priority: P1) 🎯 MVP

Como operador do plantão, quero que o OpsPilot aprenda e registre preferências, papéis e fatos operacionais associados ao meu identificador de usuário (`userId`), para que informações recorrentes não precisem ser repetidas em futuras sessões de atendimento.

**Why this priority**: Estabelece o mecanismo fundamental de gravação de memória semântica com deduplicação automática para evitar redundância na base de conhecimento pessoal.

**Independent Test**: Instanciar o `MemoryStore`, gravar um fato operacional para um determinado `userId`, tentar gravar um fato semanticamente equivalente (similaridade > 0.92) e verificar que o sistema deduplica e não insere registro duplicado.

**Acceptance Scenarios**:

1. **Given** um `MemoryStore` inicializado e um `userId` válido, **When** um novo fato é fornecido ao método `remember(userId, fact)`, **Then** o sistema gera o embedding normalizado localmente e persiste o registro na tabela `memories` com id, `user_id`, `fact`, `embedding` (em BLOB) e `created_at`.
2. **Given** um fato já registrado para um usuário, **When** um novo fato com similaridade semântica superior a `0.92` for enviado para o mesmo `userId`, **Then** o sistema identifica a duplicidade semântica e descarta a inserção redundante, retornando indicação de deduplicação.
3. **Given** dois usuários distintos (`user-A` e `user-B`), **When** ambos registrarem o mesmo fato, **Then** as memórias são armazenadas de forma estritamente isolada por partição de `userId`.

---

### User Story 2 - Recuperação Semântica por Similaridade e Esquecimento de Memórias (Priority: P2)

Como operador ou serviço da APO, quero buscar fatos relevantes através de uma consulta em linguagem natural (`recall`) e revogar fatos obsoletos (`forget`), para contextualizar respostas da IA e manter a base de conhecimento limpa.

**Why this priority**: Permite que o agente recupere informações com base em significado (e não apenas correspondência exata de palavras-chave) e oferece controle de ciclo de vida aos dados do usuário.

**Independent Test**: Registrar múltiplos fatos sobre diferentes tópicos (ex.: serviços favoritos, turnos, credenciais de teste) e realizar consultas semânticas, confirmando que o `recall` retorna até 3 fatos mais similares com pontuação mínima de 0.3; em seguida, esquecer um fato e confirmar sua remoção da busca.

**Acceptance Scenarios**:

1. **Given** uma base com fatos pré-existentes, **When** o método `recall(userId, query, limit = 3)` é executado, **Then** calcula o produto escalar entre o embedding da query e os embeddings das memórias do usuário, retornando até os top-3 registros que atinjam o limiar mínimo de similaridade de `0.3`, ordenados do mais relevante para o menos relevante.
2. **Given** uma query cuja maior similaridade encontrada seja inferior a `0.3`, **When** `recall` é executado, **Then** retorna uma lista vazia, evitando ruídos de contexto.
3. **Given** uma memória identificada por `memoryId`, **When** o método `forget(userId, memoryId)` é chamado, **Then** a memória correspondente é excluída do banco SQLite e não mais recuperada em buscas posteriores.

---

### User Story 3 - Injeção de Contexto Semântico no Endpoint HTTP /chat (Priority: P3)

Como cliente da API HTTP (chat web, CLI ou bot corporativo), quero enviar um `userId` opcional no payload de `POST /chat`, para que o modelo receba automaticamente as memórias semânticas relevantes ao prompt da mensagem atual.

**Why this priority**: Integra a camada de memória semântica diretamente à experiência conversacional do usuário, tornando as respostas da APO contextualizadas e personalizadas.

**Independent Test**: Fazer uma chamada a `POST /chat` contendo `userId` e verificar que o prompt montado para o modelo contém os fatos recuperados via `recall`, enquanto chamadas sem `userId` continuam funcionando normalmente sem injeção de memórias.

**Acceptance Scenarios**:

1. **Given** uma requisição `POST /chat` contendo `userId` e uma mensagem qualquer, **When** o backend processa o chat, **Then** executa `recall(userId, message)` e injeta até 3 fatos mais relevantes no contexto do prompt.
2. **Given** uma requisição `POST /chat` sem `userId` no corpo da requisição, **When** processada, **Then** a busca de memória semântica é ignorada e o fluxo opera normalmente mantendo retrocompatibilidade total.

---

### User Story 4 - Recuperação Semântica sem Palavras em Comum (Priority: P4)

Como engenheiro de qualidade e confiabilidade, quero validar via teste automatizado que o `recall` é capaz de associar semanticamente uma pergunta a um fato armazenado mesmo quando não há nenhuma palavra compartilhada entre a query e o fato registrado.

**Why this priority**: Comprova a efetividade real do modelo de embeddings local em relação a buscas puramente léxicas (BM25 ou regex).

**Independent Test**: Executar teste automatizado armazenando um fato como `"O operador prefere mitigação imediata via chaveamento de tráfego"` e consultando com `"Qual procedimento adoto quando há lentidão severa?"`, validando que o fato correto é retornado entre os top-3 resultados com similaridade >= 0.3.

**Acceptance Scenarios**:

1. **Given** uma memória persistida cujo texto não possui sobreposição léxica direta com a pergunta de teste, **When** o `recall` for disparado com a pergunta, **Then** o fato é recuperado com sucesso devido à proximidade de embedding vetorial.

---

### Edge Cases

- **Fato vazio ou em branco**: Tentativas de registrar fatos vazios em `remember` devem ser rejeitadas via validação Zod.
- **Usuário sem memórias registradas**: Se um `userId` válido não possuir memórias gravadas, o `recall` deve retornar lista vazia imediatamente sem erro.
- **Pipeline de embedding sob carga ou primeira execução**: O modelo de embeddings deve ser carregado via *lazy singleton*, evitando custo de inicialização durante a subida do servidor até o momento da primeira chamada.
- **Falha de normalização de vetores**: Todos os vetores devem ser normalizados (`normalize: true`) para que o produto escalar seja numericamente idêntico à similaridade de cosseno ($\cos \theta = \mathbf{u} \cdot \mathbf{v}$).
- **Serialização em BLOB**: O embedding (Float32Array) deve ser gravado e lido do SQLite como `BLOB` binário sem perda de precisão e sem conversão lenta para JSON.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE fornecer o utilitário `src/memory/embeddings.ts` gerenciando o modelo `all-MiniLM-L6-v2` através do pacote `@huggingface/transformers` com *lazy singleton*, pooling `"mean"` e normalização (`normalize: true`).
- **FR-002**: O sistema DEVE implementar a classe `SqliteMemoryStore` (em `src/memory/memory-store.ts`) gerenciando a tabela SQLite `memories` com as seguintes colunas:
  - `id TEXT PRIMARY KEY` (UUID v4)
  - `user_id TEXT NOT NULL`
  - `fact TEXT NOT NULL`
  - `embedding BLOB NOT NULL` (buffer binário Float32Array)
  - `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
- **FR-003**: A tabela `memories` DEVE conter índice em `user_id` para permitir isolamento e filtros rápidos por usuário.
- **FR-004**: O método `remember(userId: string, fact: string)` DEVE gerar o embedding do fato e verificar a similaridade com todas as memórias existentes do `userId`. Se qualquer memória existente possuir produto escalar superior a `0.92`, a inserção DEVE ser deduplicada (não gravada novamente).
- **FR-005**: O método `recall(userId: string, query: string, limit?: number)` DEVE gerar o embedding da consulta, calcular o produto escalar contra todos os embeddings do `userId` e retornar até `limit` (padrão 3) memórias ordenadas por similaridade decrescente, filtrando aquelas com score menor que `0.3`.
- **FR-006**: O método `forget(userId: string, memoryId: string)` DEVE remover a memória correspondente do SQLite, respeitando a posse do `userId`.
- **FR-007**: O schema de entrada `ChatRequestSchema` em `src/schemas/chat.ts` DEVE ser estendido com o campo opcional `userId: z.string().trim().min(1).optional()`.
- **FR-008**: Quando `userId` estiver presente em `POST /chat`, o endpoint DEVE executar `recall(userId, message)` e injetar os fatos recuperados (se houver) no prompt submetido à estratégia de raciocínio.
- **FR-009**: A formatação dos fatos recuperados no prompt DEVE ser claramente demarcada com bloco de contexto (ex.: `[Memórias do Operador]`).
- **FR-010**: A suíte de testes DEVE conter teste determinístico comprovando que o `recall` recupera com sucesso fatos com semântica equivalente sem compartilhamento de palavras-chave.
- **FR-011**: O banco de dados do `MemoryStore` DEVE aceitar conexões `:memory:` para garantir isolamento em testes unitários.
- **FR-012**: Todos os cálculos vetoriais DEVEM operar diretamente sobre buffers binários `Float32Array` via operações de produto escalar otimizadas.

---

### Key Entities *(include if feature involves data)*

- **Memory**: Representa um fato ou conhecimento semântico associado a um operador.
  - Atributos: `id` (UUID único), `userId` (identificador do operador), `fact` (texto do fato em linguagem natural), `embedding` (vetor binário Float32Array de 384 dimensões), `createdAt` (data/hora de registro).
- **MemoryStore**: Interface de serviço que expõe `remember`, `recall` e `forget`.
- **EmbeddingEngine**: Módulo de geração vetorial local via pipeline HuggingFace Transformers.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O método `remember` rejeita 100% dos fatos com similaridade superior a 0.92 para o mesmo usuário.
- **SC-002**: O método `recall` filtra 100% dos fatos com similaridade inferior ao limiar mínimo de 0.3.
- **SC-003**: Recuperação semântica sem palavras em comum alcança 100% de taxa de acerto no cenário do teste de referência.
- **SC-004**: O cálculo de similaridade e ranqueamento de até 100 memórias em SQLite executa em menos de 15 milissegundos.

---

## Assumptions

- O pacote `@huggingface/transformers` é utilizado para carregar localmente o modelo `Xenova/all-MiniLM-L6-v2` sem necessidade de tokens externos ou chaves de API pagas.
- Vetores gerados com `normalize: true` possuem norma euclidiana unitária ($\|\mathbf{v}\| = 1$), permitindo que o produto escalar represente diretamente a similaridade de cosseno.
- O campo `userId` no `/chat` é opcional e transparente para clientes que não necessitem de personalização.
- O armazenamento em `BLOB` utiliza a representação binária nativa de buffers `Float32Array`.
