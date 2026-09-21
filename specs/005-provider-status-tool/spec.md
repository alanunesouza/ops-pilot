# Feature Specification: Ferramenta de Consulta a Status de Provedores Externos (`005-provider-status-tool`)

**Feature Branch**: `005-provider-status-tool`

**Created**: 2026-09-20

**Status**: Draft

**Input**: User description: "Tool de status de provedores externos: - Tool check_provider_status em src/agents/tools.ts: consulta a statuspage pública do provedor via API statuspage.io (sem chave): github -> https://www.githubstatus.com/api/v2/status.json, cloudflare -> https://www.cloudflarestatus.com/api/v2/status.json. Parâmetro provider (enum: github | cloudflare, default 'github', .describe explicando). Descrição orientada a quando usar: suspeita de problema externo, 'é o nosso ou do provedor?', dependência fora do ar. - Resiliência: timeout de 5s via AbortSignal.timeout; falha de rede ou 5xx, UMA nova tentativa; resposta validada com zod ({ status: { indicator, description } }); qualquer falha final retorna string de erro legível como resultado da tool (erro é observação - nunca lançar exceção para fora da tool). - Retorno compacto (indicador + descrição, uma linha), para não inflar o contexto. - Teste: a função de fetch é injetável; testes cobrem sucesso, timeout e resposta inválida sem uso de rede (fake fetch)"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Verificação Rápida de Saúde de Dependências Externas (Priority: P1) 🎯 MVP

Como operador de plantão (on-call) ou como a APO (Agente de Produção e Operações), quero consultar o status operacional público de provedores externos essenciais (GitHub e Cloudflare) através da ferramenta `check_provider_status`, para discernir rapidamente se uma anomalia ou falha reportada decorre de problema interno da nossa infraestrutura ou de instabilidade no provedor terceirizado ("é nosso ou do provedor?").

**Why this priority**: Fornece ao agente a capacidade cognitiva de isolar causas raízes externas sem depender de credenciais privadas ou configurações complexas de infraestrutura.

**Independent Test**: Executar a ferramenta `check_provider_status` selecionando o provedor desejado (`github` ou `cloudflare`) e verificar o retorno de uma linha compacta contendo o indicador oficial de status e a descrição resumida.

**Acceptance Scenarios**:

1. **Given** a ferramenta `check_provider_status`, **When** invocada sem parâmetros, **Then** assume automaticamente o provedor padrão `"github"` e retorna a resposta formatada em uma única linha compacta.
2. **Given** a ferramenta `check_provider_status`, **When** invocada com `provider: "cloudflare"`, **Then** consulta o status público do Cloudflare e retorna o indicador e descrição correspondentes.
3. **Given** a descrição e esquema da ferramenta, **When** inspecionados pelo modelo da APO, **Then** apresentam orientações claras sobre quando usar (suspeita de falha externa, dependência fora do ar) e quando não usar (alertas e serviços internos).

---

### User Story 2 - Resiliência, Timeout e Retorno Amigável de Falhas (Priority: P2)

Como engenheiro de confiabilidade, quero que as requisições externas tenham limite de tempo rigoroso (5s), tentem novamente uma única vez mediante falha transitória de rede ou erro HTTP 5xx, e reportem falhas finais como texto legível no resultado da ferramenta sem lançar exceções não tratadas, para que a execução da APO nunca seja abortada por instabilidades da rede externa.

**Why this priority**: Garante robustez operacional e preserva a continuidade do fluxo de raciocínio da IA, transformando falhas de terceiros em observações acionáveis.

**Independent Test**: Simular falhas com timeout de 5 segundos, respostas HTTP 500 ou schemas corrompidos, validando que a ferramenta executa exatamente uma retentativa antes de reportar a falha em string limpa sem disparar exceção para fora da tool.

**Acceptance Scenarios**:

1. **Given** uma requisição externa que demore mais de 5 segundos, **When** o temporizador expirar via `AbortSignal.timeout`, **Then** a requisição é cancelada e uma nova tentativa é disparada; persistindo a lentidão, retorna mensagem de observação indicando timeout.
2. **Given** uma resposta externa com código de erro HTTP 5xx ou erro de conexão de rede, **When** a primeira tentativa falhar, **Then** o sistema executa exatamente uma nova tentativa; se persistir o erro, retorna texto estruturado descrevendo a falha.
3. **Given** uma resposta cujo payload JSON não obedeça ao schema Zod esperado (`{ status: { indicator, description } }`), **When** for processada, **Then** o erro de validação é capturado e retornado como texto de observação da ferramenta.

---

### User Story 3 - Injeção de Dependência de Rede e Cobertura Offline Total (Priority: P3)

Como desenvolvedor de software, quero que o cliente HTTP utilizado pela ferramenta suporte injeção de dependência da função de busca (`fetch`), para permitir testes unitários determinísticos, sem rede e capazes de reproduzir cenários extremos de lentidão e corrupção de payload em milissegundos.

**Why this priority**: Garante conformidade estrita com o Princípio IV da Constitution (testes determinísticos offline, rápidos e sem dependências externas voláteis).

**Independent Test**: Executar a suíte de testes unitários injetando mocks de fetch e confirmando a validação de fluxos de sucesso, retry, timeout de 5s e payloads inválidos em menos de 100ms.

**Acceptance Scenarios**:

1. **Given** a suíte de testes unitários, **When** os testes da ferramenta `check_provider_status` forem executados, **Then** utilizam uma função injetável de fetch sem emitir tráfego real de rede.
2. **Given** uma execução padrão em ambiente dev ou produção, **When** nenhuma função customizada for fornecida, **Then** utiliza a implementação nativa global `fetch` do Node.js.

---

### Edge Cases

- **Timeout em ambas as tentativas**: Se a primeira tentativa estourar o limite de 5s e a segunda tentativa também estourar, a ferramenta retorna string de observação indicando timeout em ambas as tentativas sem lançar erro.
- **Falha na primeira tentativa e sucesso na segunda**: A ferramenta deve retornar o status de sucesso obtido na segunda tentativa sem reportar erro.
- **Status HTTP 4xx (ex.: 404 Not Found)**: Erros 4xx indicam alteração de rota do provedor e não devem disparar retentativa desnecessária, retornando imediatamente mensagem amigável de erro.
- **Provedor com caracteres maiúsculos ou espaços**: A ferramenta deve normalizar entradas como `"GitHub "` ou `"CLOUDFLARE"` para minúsculas antes de resolver o endpoint.
- **Corpo de resposta não-JSON ou vazio**: Falha na decodificação de JSON deve ser capturada graciosamente e retornada como observação de erro.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE disponibilizar uma nova ferramenta LangChain denominada `check_provider_status` no arquivo `src/agents/tools.ts`.
- **FR-002**: A ferramenta DEVE aceitar o parâmetro opcional `provider` com enum restrito aos valores `"github"` e `"cloudflare"`, assumindo `"github"` como valor padrão.
- **FR-003**: O schema da ferramenta DEVE conter descrição explícita via `.describe()` em cada parâmetro, esclarecendo quais provedores são suportados.
- **FR-004**: A descrição da ferramenta DEVE seguir rigorosamente as 6 regras semânticas de ferramentas, orientando o agente sobre quando usar (suspeita de instabilidade externa, dependência fora do ar, "é o nosso ou do provedor?") e quando não usar (consultas de alertas ou incidentes internos).
- **FR-005**: A ferramenta DEVE mapear os provedores suportados para as seguintes URLs públicas da API statuspage.io (sem necessidade de chaves de autenticação):
  - `github`: `https://www.githubstatus.com/api/v2/status.json`
  - `cloudflare`: `https://www.cloudflarestatus.com/api/v2/status.json`
- **FR-006**: A ferramenta DEVE aplicar timeout estrito de 5 segundos por tentativa de requisição HTTP utilizando `AbortSignal.timeout(5000)`.
- **FR-007**: Em caso de falha de conexão de rede ou retorno com código de status HTTP 5xx, a ferramenta DEVE realizar exatamente UMA nova tentativa antes de concluir a falha.
- **FR-008**: O payload de resposta recebido DEVE ser validado na fronteira com schema Zod contendo a estrutura mínima:
  ```typescript
  z.object({
    status: z.object({
      indicator: z.string(),
      description: z.string(),
    }),
  })
  ```
- **FR-009**: Em caso de sucesso, o retorno da ferramenta DEVE ser uma string compacta em linha única (ex.: `[github] indicator: none | description: All Systems Operational`) para preservar a janela de contexto da APO.
- **FR-010**: Toda e qualquer exceção ou falha final (timeout, rede, erro HTTP ou schema inválido) DEVE ser capturada e retornada como string informativa como observação da ferramenta, sendo terminantemente proibido lançar exceções não tratadas para fora da tool.
- **FR-011**: O mecanismo de requisição DEVE aceitar a injeção da função de `fetch`, permitindo testes unitários 100% offline e determinísticos.
- **FR-012**: A ferramenta DEVE ser incluída na lista exportada de ferramentas operacionais `opsTools` em `src/agents/tools.ts`.

---

### Key Entities *(include if feature involves data)*

- **ProviderStatusRequest**: Entrada da ferramenta contendo o identificador do provedor externo.
  - Atributos: `provider` (`"github" | "cloudflare"`), default `"github"`.
- **ProviderStatusResponse**: Estrutura validada da API pública de status.
  - Atributos: `status.indicator` (ex.: `"none"`, `"minor"`, `"major"`, `"critical"`), `status.description` (texto explicativo oficial do provedor).
- **ProviderConfig**: Configuração interna contendo o nome e o endpoint público do provedor.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das consultas bem-sucedidas retornam resposta em formato compacto de linha única com menos de 150 caracteres.
- **SC-002**: 100% das falhas de rede, timeouts ou respostas com código HTTP 5xx disparam no máximo uma única retentativa antes da finalização.
- **SC-003**: 0% de exceções não tratadas escapam da ferramenta, garantindo que qualquer falha externa seja convertida em texto de observação compreensível para o modelo.
- **SC-004**: A suíte de testes automatizados da ferramenta executa com mocks determinísticos em menos de 100 milissegundos sem depender de acesso à internet.

---

## Assumptions

- As APIs públicas do statuspage.io para GitHub e Cloudflare não exigem autenticação, tokens ou chaves de API para leitura do endpoint `/status.json`.
- O Node.js 22 LTS disponibiliza a implementação global nativa de `fetch` e `AbortSignal.timeout` de forma nativa e estável.
- Um timeout de 5 segundos é suficiente para determinar indisponibilidade de statuspages públicas em ambiente produtivo.
- Uma retentativa imediata única é suficiente para filtrar instabilidades transientes de conexão sem degradar excessivamente a latência percebida da APO.
