# Technical Research: Ferramenta de Status de Provedores Externos

**Feature**: `005-provider-status-tool`  
**Date**: 2026-09-20  
**Status**: Completed  

## Visão Geral

Este documento detalha as decisões técnicas, estratégias de resiliência e abordagens de testabilidade para a ferramenta `check_provider_status`, destinada à triagem de dependências externas da APO.

---

## Decisões Técnicas

### 1. Formato e Endpoints da API Statuspage.io

- **Decisão**: Utilizar os endpoints públicos padrão `/api/v2/status.json` disponibilizados pelo statuspage.io:
  - GitHub: `https://www.githubstatus.com/api/v2/status.json`
  - Cloudflare: `https://www.cloudflarestatus.com/api/v2/status.json`
- **Racional**:
  - Ambas as statuspages utilizam o formato padronizado do Statuspage.io da Atlassian.
  - O endpoint `/api/v2/status.json` é aberto, público, não exige chaves de autenticação ou tokens secretos (alinhado com o Princípio VII da Constitution: *Segurança por Padrão*).
  - O payload de resposta é estável e conciso, contendo o objeto de status:
    ```json
    {
      "page": { "id": "...", "name": "GitHub", "url": "..." },
      "status": {
        "indicator": "none",
        "description": "All Systems Operational"
      }
    }
    ```
- **Alternativas Consideradas**:
  - Endpoints detalhados de componentes (`/api/v2/components.json`): Rejeitado porque retorna centenas de linhas de componentes individuais, consumindo desnecessariamente a janela de contexto do LLM.

### 2. Mecanismo de Timeout e Resiliência (Retry Único)

- **Decisão**:
  - Utilizar a API nativa do Node.js 22 LTS `AbortSignal.timeout(5000)` como sinal de cancelamento da requisição `fetch`.
  - Implementar uma política de retentativa com no máximo 2 execuções (1 tentativa original + 1 retentativa) disparada **exclusivamente** para:
    1. Erros de rede / abort / timeout (`AbortError`, `TypeError: fetch failed`).
    2. Respostas com código de status HTTP 5xx (500 a 599).
  - Respostas com status HTTP 4xx não disparam retentativa (falha de cliente imediata).
- **Racional**:
  - Evita bloqueio da thread ou latência excessiva para o operador durante um plantão crítico.
  - Filtra instabilidades passageiras de rede sem amplificar carga em provedores degradados.
- **Alternativas Consideradas**:
  - Bibliotecas externas de retry (`p-retry`, `axios-retry`): Rejeitadas para evitar dependências adicionais desnecessárias (Princípio YAGNI da Constitution).

### 3. Tratamento de Erros: Erro é Observação

- **Decisão**: Capturar qualquer falha (HTTP, timeout, rede ou validação de schema) e convertê-la em uma string de observação retornada pela tool, nunca disparando exceção para fora da tool.
  - Exemplo de falha de timeout: `"[github] Falha ao consultar statuspage: Timeout de 5000ms excedido após retentativa."`
  - Exemplo de status HTTP com erro: `"[cloudflare] Falha ao consultar statuspage: HTTP 503 Service Unavailable após retentativa."`
- **Racional**:
  - No LangGraph/LangChain, exceções não tratadas arremessadas por tools interrompem imediatamente o loop cognitivo do agente, abortando a requisição HTTP do usuário com status 500.
  - Permitir que o erro seja devolvido como uma observação capacita o modelo de linguagem a interpretar a falha da dependência externa e informar o operador com precisão.
- **Alternativas Consideradas**:
  - Lançar `Error` de domínio na tool: Rejeitado por interromper a execução do agente.

### 4. Formatação Compacta da Saída

- **Decisão**: Retornar uma linha única compacta contendo o nome do provedor, o indicador de gravidade e a descrição oficial:
  - Formato: `[<provider>] indicator: <indicator> | description: <description>`
  - Exemplo real: `[github] indicator: none | description: All Systems Operational`
- **Racional**:
  - Economiza tokens da janela de contexto da LLM e reduz a latência de processamento das chamadas subsequentes.

### 5. Injeção da Função de Fetch para Testes 100% Offline

- **Decisão**: Disponibilizar a fábrica `createCheckProviderStatusTool({ fetchFn })` e exportar `checkProviderStatus` configurado por padrão com `globalThis.fetch`.
- **Racional**:
  - Cumpre o Princípio IV da Constitution (*Teste é Parte da Tarefa*): testes unitários executados nativamente via `node:test` sem dependência de internet ou pacotes de mock externos (`nock`, `msw`).
  - Permite simular respostas lentas (testando o `AbortSignal.timeout`), respostas HTTP 500 para acionar o retry, e payloads com JSON corrompido ou fora do schema Zod.
