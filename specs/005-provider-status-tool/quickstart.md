# Quickstart & Validation Guide: Ferramenta de Status de Provedores Externos

**Feature**: `005-provider-status-tool`  
**Date**: 2026-09-20  
**Status**: Completed  

Este guia descreve os passos práticos para validação da ferramenta `check_provider_status`.

---

## 1. Validação Automatizada Offline (100% Determinística)

Executa a suíte de testes unitários das ferramentas, validando a integração de rede simulada:

```bash
node --import tsx --test "src/agents/tools.test.ts"
```

### Comportamentos Validados nos Testes:
1. **Consulta padrão**: Retorna status do GitHub em linha única (`indicator` + `description`).
2. **Consulta parametrizada**: Retorna status do Cloudflare com formatação compacta.
3. **Resiliência a Timeout**: Simula lentidão > 5s via `AbortSignal.timeout`, verifica disparo de retentativa e retorno de observação explicativa.
4. **Resiliência a HTTP 5xx com Retry**: Simula erro 500 na 1ª tentativa e sucesso na 2ª tentativa, garantindo conclusão positiva.
5. **Falha Persistente tratada como Observação**: Simula erros contínuos de rede/500, confirmando que a tool devolve string de erro sem estourar exceção.
6. **Validação Estrita de Schema Zod**: Simula JSON fora do formato esperado e valida a captura graciosa do erro.
7. **Conformidade com as 6 Regras**: Valida metadados, `.describe()`, enums e instruções de quando usar e quando não usar.

---

## 2. Validação da Suíte Completa e Tipos

```bash
npm run typecheck
npm test
```

Ambos os comandos devem concluir com status de saída 0 (zero erros de tipagem e 100% dos testes verdes).

---

## 3. Exemplo de Invocação via Chat API (Opcional com Rede Real)

Com o servidor rodando (`npm run dev`):

```bash
curl -s localhost:3000/chat -X POST \
  -H "Content-Type: application/json" \
  -d '{"message": "O checkout está com lentidão, verifique se a Cloudflare ou o GitHub estão fora do ar"}' | jq -r '.answer'
```
