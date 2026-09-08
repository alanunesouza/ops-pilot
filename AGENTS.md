# Diretrizes do Agente Antigravity - OpsPilot

Consulte a skill local [.agents/skills/instructions/SKILL.md](file:///Users/alannunes/studies/po%CC%81s/IA/modulo-04/ops-pilot/.agents/skills/instructions/SKILL.md) para a arquitetura, convenções e comandos do projeto.

## Política de Execução de Comandos do Agente

### Permitidos automaticamente (Allow List):
- `npm run` (e scripts definidos no package.json)
- `npm run test` / `npm test`
- `npx tsc`
- `node`
- `git status`, `git diff`, `git add`, `git commit`

### Proibidos expressamente (Deny List):
- `rm -rf`
- `sudo`
- `git push --force`
- Leitura de arquivos `.env` no terminal (ex.: `cat .env`, `grep .env`, etc.)

### Aprovação manual necessária:
- `git push` (nunca executar de forma autônoma sem consentimento explícito do usuário)
