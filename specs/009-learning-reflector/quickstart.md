# Quickstart: Validação do Refletor de Aprendizado (`009-learning-reflector`)

Este guia detalha os passos para validação automatizada e manual do aprendizado contínuo pós-resposta e da ferramenta de revogação de preferências.

---

## 1. Validação via Testes Automatizados

Execute os testes unitários dedicados do refletor e da nova tool:

```bash
npm test -- "src/memory/reflector.test.ts"
npm test -- "src/agents/tools.test.ts"
npm test -- "src/http/server.test.ts"
```

### Casos de Teste Essenciais:
1. **Destilação de Fato Durável**: Mensagem "Sempre faça chaveamento de tráfego antes de reiniciar" gera `{ hasLearning: true, fact: "..." }` e salva no `MemoryStore`.
2. **Rejeição de Pedido Pontual**: Mensagem "Verifique o status do pod auth agora" gera `{ hasLearning: false }`.
3. **Rejeição de Segredos**: Mensagem contendo senha/token ("Minha senha do banco é secret123") gera `{ hasLearning: false }`.
4. **Tool `forget_preference`**: Exclui a memória localizada por busca semântica via `recall`.
5. **Integração HTTP `/chat`**: Responde 200 OK sem aguardar o refletor síncrono, que persiste em background.

---

## 2. Validação Manual via API HTTP

```bash
# 1. Enviar mensagem expressando uma preferência durável
curl -s localhost:3000/chat -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Em incidentes de lentidão, prefiro escalonamento direto para o time de banco de dados.",
    "userId": "usr-teste-1"
  }'

# 2. Consultar o chat novamente e verificar que a memória foi aprendida
curl -s localhost:3000/chat -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Qual é a minha recomendação para incidentes de lentidão?",
    "userId": "usr-teste-1"
  }'
```
