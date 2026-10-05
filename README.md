# Cálculo na Mão

Orçamento de escritura, ITBI, financiamento e doação para imóveis em Juiz de Fora (MG), pelo site ou por um agente no WhatsApp.

- **Colocar no ar:** [docs/SETUP.md](docs/SETUP.md) — Supabase, VPS com Evolution API + n8n, primeiro teste.
- **Plano do produto:** [docs/PLANO_IMPLEMENTACAO.md](docs/PLANO_IMPLEMENTACAO.md)

## Estrutura

| Pasta | O que tem |
|---|---|
| `src/lib/calc/` | Fórmulas (escritura, doação, Caixa, banco privado, correção, valor venal), usadas pelo site, pela API e pelo agente |
| `src/` | Front (Vite + React) |
| `server/` | API Express, agente do WhatsApp (Gemini com ferramentas), PDF, exportação |
| `supabase/migrations/` | Esquema do banco |
| `infra/` | Docker Compose: app, Evolution API, n8n, Postgres, Redis, Caddy |
| `n8n/` | Workflow do agente para importar no n8n |

## Rodar local

```bash
cp .env.example .env
npm install
npm run dev     # http://localhost:3000
npm test
```
