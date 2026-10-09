# Tarefa: colocar no ar o agente de WhatsApp do Orça.ai Imob (Evolution API + n8n numa VPS)

## Contexto

O Orça.ai Imob é um SaaS de orçamentos de cartório e ITBI para corretores (Juiz de Fora/MG). Partes:

- **Site + API (Express)**: já rodam na **Vercel**. Endereço de teste (Preview):
  `https://c-lculo-de-m-o-2-0v-git-claude-a-3615f0-pedroivo-7089s-projects.vercel.app`
  Teste: `GET /api/saude` responde `{"ok":true,"marca":"Orça.ai Imob"}`.
- **Banco**: Supabase (já configurado; você não precisa mexer nele).
- **Falta subir** (é a sua tarefa): **Evolution API v2** (WhatsApp via Baileys, número comum, sem API oficial) e **n8n**, numa VPS com Docker, e ligar os dois à API da Vercel.

Repositório: `github.com/pedroivobc/C-lculo-de-M-o-2.0v`, branch `claude/awesome-knuth-35djnl`. Leia antes de começar:
- `docs/SETUP.md` — seções **3 (Evolution)** e **4 (n8n)** têm os comandos exatos
- `infra/docker-compose.yml`, `infra/Caddyfile`, `infra/.env.example`
- `n8n/agente-whatsapp.json` — o workflow pronto para importar

## Como o fluxo funciona

1. Alguém manda mensagem para o número do agente.
2. Evolution recebe e dispara webhook (evento `MESSAGES_UPSERT`) para o n8n: `/webhook/evolution-agente`.
3. O n8n filtra (ignora grupos, mensagens do próprio número, áudio, figurinha; aceita texto e respostas de botão/lista) e chama a API:
   `POST {APP_INTERNAL_URL}/api/agente/mensagem` com header `x-agent-key: {AGENT_API_KEY}`.
4. A API devolve uma lista de mensagens (texto, imagem, PDF); o n8n envia uma por vez, em ordem, pela Evolution (`/message/sendText` ou `/message/sendMedia`).

O número **só responde**: nunca inicia conversa, nada de disparos em massa.

## O que fazer

1. **VPS**: Ubuntu com Docker + Docker Compose, mínimo 2 GB de RAM. Pergunte ao usuário o IP/acesso SSH e o domínio.
2. **DNS**: registros A de `n8n.<dominio>` e `evo.<dominio>` para o IP da VPS. (O `app.` não é necessário: o app está na Vercel.)
3. **Subir só Evolution + n8n + Postgres + Redis + Caddy** a partir de `infra/docker-compose.yml`. O serviço `app` desse compose NÃO deve subir (o app roda na Vercel): remova-o ou crie um override, e tire `app` do `depends_on` do Caddy e o bloco dele do `Caddyfile`.
4. **Variáveis do n8n** (no compose):
   - `APP_INTERNAL_URL` = URL da API na Vercel (ver "Proteção da Vercel" abaixo) — **sem barra no final**
   - `AGENT_API_KEY` = **o mesmo valor** cadastrado na Vercel (o usuário copia de lá; é Secret, se não tiver guardado, gere um novo com `openssl rand -hex 32` e atualize nos dois lugares, depois Redeploy na Vercel)
   - `EVOLUTION_INTERNAL_URL=http://evolution:8080`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE=agente`
   - `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` (o workflow lê `$env`)
5. **Evolution**: criar a instância `agente` (`WHATSAPP-BAILEYS`), ler o QR Code no celular do chip (WhatsApp → Aparelhos conectados), e configurar o webhook só com `MESSAGES_UPSERT` apontando para `http://n8n:5678/webhook/evolution-agente`. Comandos em `docs/SETUP.md` §3. Confirme `GET /instance/connectionState/agente` → `"state":"open"`.
6. **n8n**: criar o usuário dono, importar `n8n/agente-whatsapp.json`, ativar o workflow.
7. **Vercel** (o usuário faz no painel, ou você orienta): cadastrar `EVOLUTION_API_URL=https://evo.<dominio>`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE=agente` e `VITE_AGENTE_WHATSAPP=<número com DDI, só dígitos>` em Production e Preview, depois Redeploy.

## Proteção da Vercel (importante)

O endereço de **Preview** está protegido por login da Vercel: chamadas do n8n recebem 401. Duas saídas:

- **A (recomendada para produção)**: usar o domínio de **Production** da Vercel (não protegido por padrão). Para isso a branch `claude/awesome-knuth-35djnl` precisa estar mesclada na `main` — confirme com o usuário antes.
- **B (para testar agora)**: no painel da Vercel → Project → Settings → Deployment Protection → **Protection Bypass for Automation** → gerar o segredo. No n8n, no nó **"Perguntar ao agente"**, adicionar o header `x-vercel-protection-bypass: <segredo>` (de preferência via variável de ambiente, ex.: `{{ $env.VERCEL_BYPASS }}`).

## Como testar (ponta a ponta)

1. Do celular de outra pessoa, mande "oi" para o número do agente: deve chegar o menu numerado ("1️⃣ Escritura…").
2. No site, logado, em **Confirmar WhatsApp**: gere o código e envie ao agente pelo WhatsApp; o site deve confirmar sozinho em segundos.
3. Faça um orçamento pelo menu e peça em PDF: o arquivo deve chegar na conversa.

Se algo falhar: execuções do n8n (Executions), logs da Evolution (`docker compose logs evolution`) e o status da resposta de `/api/agente/mensagem` (401 = chave do agente ou proteção da Vercel; 5xx = ver logs da Vercel).

## Regras

- **Nunca** cole chaves e senhas em conversa, issue ou commit. Use `.env` na VPS (fora do git) e o painel da Vercel.
- Não mude o código da API nem o banco do Supabase; se achar que precisa, descreva e pergunte.
- O chip do agente deve ser exclusivo (não o WhatsApp pessoal), com WhatsApp Business ativado e usado normalmente por 1–2 dias antes de ligar, para evitar bloqueio.
- Ao terminar, entregue: domínios usados, como reiniciar (`docker compose ... up -d`), como reconectar o QR se o WhatsApp desconectar, e o resultado dos 3 testes.
