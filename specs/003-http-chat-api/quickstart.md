# Quickstart: Validação do Endpoint `POST /chat`

Este guia descreve os passos práticos para validação local do endpoint `POST /chat` por meio de testes automatizados e chamadas via terminal (`curl`).

---

## 1. Testes de Integração Automatizados (100% Offline e Sem Rede)

Os testes de integração utilizam uma estratégia simulada determinística (*fake strategy*) sem fazer chamadas a provedores externos ou consumir chaves de API:

```bash
npm test
```

Para checagem estática de tipos TypeScript:
```bash
npm run typecheck
```

**Cenários cobertos pelos testes:**
- Resposta `200 OK` com estratégia padrão (`react`) contendo `{ answer, trace, metrics }`.
- Resposta `200 OK` com `reflect: true`, verificando a inclusão de evento `critique` no trace.
- Resposta `400 Bad Request` com violações do Zod para payloads vazios ou inválidos.
- Resposta `422 Unprocessable Entity` para estratégias não registradas no catálogo.
- Resposta `504 Gateway Timeout` para operações que excedem o tempo limite estipulado.

---

## 2. Inicialização e Testes Locais com `curl`

### Iniciar o servidor HTTP:
```bash
npm run dev
```
*(O servidor iniciará ouvindo na porta configurada, por exemplo `http://localhost:3000`)*.

---

### Exemplos de Chamadas `curl`:

#### Requisição Padrão (`react` sem reflexão):
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Quantos alertas críticos estão disparando?"}'
```

#### Requisição com Estratégia Específica e Camada Reflection:
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Verifique os alertas de pagamento", "strategy": "plan-and-execute", "reflect": true}'
```

#### Requisição com Erro de Validação (Corpo Inválido):
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": ""}'
```
*Retorno esperado: HTTP 400 com lista de issues do Zod.*

#### Requisição com Estratégia Desconhecida:
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Olá", "strategy": "inexistente"}'
```
*Retorno esperado: HTTP 422 com lista de estratégias disponíveis.*
