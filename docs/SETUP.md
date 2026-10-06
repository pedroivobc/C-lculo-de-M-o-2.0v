# Colocar no ar: Supabase + VPS (app, Evolution API, n8n)

Ordem recomendada. Cada etapa termina com um teste para saber que deu certo.

## 1. Supabase

O projeto antigo foi pausado por inatividade. Dois caminhos:

**A. Restaurar o projeto pausado** (se ainda aparecer no painel)
1. Entre em supabase.com/dashboard, abra o projeto e clique em **Restore project**. Projetos gratuitos pausados podem ser restaurados por um período limitado; depois disso o painel oferece só o download do backup.
2. Depois de restaurado, abra **SQL Editor** e rode, nesta ordem, `supabase/migrations/20261005000000_schema_inicial.sql`, `supabase/migrations/20261006000000_perfis_e_acesso.sql` e `supabase/migrations/20261007000000_configuracao_orcamento.sql`.
   - Se as tabelas antigas (`profiles`, `calculations`…) ainda existirem com o formato antigo, a migração vai falhar nelas. Como o projeto era de testes, o mais simples é apagar as tabelas antigas antes (`drop table if exists public.calculations, public.api_keys, public.invites, public.orders, public.profiles cascade;`). Se houver dados que você quer manter, exporte antes.

**B. Criar um projeto novo** (recomendado se o antigo não volta ou só tinha testes)
1. New project → região **South America (São Paulo)**.
2. **SQL Editor** → cole e rode, nesta ordem, `supabase/migrations/20261005000000_schema_inicial.sql`, `supabase/migrations/20261006000000_perfis_e_acesso.sql` e `supabase/migrations/20261007000000_configuracao_orcamento.sql`.

Nos dois casos:
3. **Authentication → Providers → Email**: habilite. Em **URL Configuration**, coloque o domínio do app em *Site URL*.
4. **Project Settings → API**: copie `Project URL`, `anon key` e `service_role key`.

> Teste: em **Table Editor** aparecem `municipios` (com Juiz de Fora), `profiles`, `subscriptions`, `cartoes`, `calculations`, `phone_verifications`, `whatsapp_messages`, `pedidos_cidade`. Em **Storage**, os buckets `orcamentos` e `logos` (privados) e `avatars`.

### Perfis de acesso

| Perfil | Como vira | O que pode |
|---|---|---|
| `admin` | à mão, no SQL Editor | tudo; não precisa de cartão nem assinatura |
| `pro` | assinatura ativa com `nivel = 'pro'` (Pró: R$ 39,90/mês; trimestral, semestral ou anual) | usar o sistema; orçamento com a própria logo e cor |
| `usuario` | assinatura ativa com `nivel = 'usuario'` (Essencial: R$ 29,90/mês; trimestral, semestral ou anual) | usar o sistema; orçamento com a marca Orçaí |
| `trial` | todo cadastro novo | 3 dias a partir da validação do cartão; orçamento como no Pró (logo e cor) |

### Configuração do orçamento (etapa 3 do cadastro)

Depois de confirmar o WhatsApp, a pessoa define: **estado** (hoje só MG; os outros registram interesse), **cidade** (Juiz de Fora, com a regra da prefeitura, ou "Outra cidade de MG" com nome e **alíquota do ITBI**), **nome no topo**, **logo** (PNG/JPG/WEBP até 2 MB, bucket `logos`), **cor** e **formato** (PDF ou imagem JPEG). Tudo fica em `profiles` (`uf`, `municipio_padrao`, `cidade_nome`, `itbi_percentual`, `pdf_header`, `pdf_logo_path`, `cor_primaria`, `formato_orcamento`, `configurado_em`) e pode ser mudado em **Conta**.

Todos podem guardar logo e cor; quem decide se aparecem é o plano (`situacao_acesso.personaliza_orcamento`: pro, trial e admin). No Essencial, o orçamento sai com a marca Orçaí e a configuração fica guardada para quando a pessoa passar para o Pró.

O agente e o site usam a cidade e a alíquota do perfil em todo cálculo de ITBI e mandam o orçamento no formato escolhido. Pelo WhatsApp, a imagem chega como foto na conversa (o n8n troca `mediatype` para `image` quando o arquivo é JPEG).

Todos menos o admin precisam de um cartão validado no gateway (tabela `cartoes`, só com o token do gateway — nunca o número), mesmo pagando no Pix. A regra fica numa função só, `situacao_acesso(uid)`, usada pelo banco (RLS), pela API e pelo agente. O papel acompanha a assinatura sozinho (trigger).

Primeiro admin, depois de criar a sua conta pelo site:
```sql
update profiles set papel = 'admin' where email = 'seu-email@exemplo.com';
```

Para evitar nova pausa por inatividade no plano gratuito: o próprio uso diário do agente já mantém o projeto ativo; com clientes pagando, vale o plano Pro.

## 2. VPS

Qualquer VPS com 2 GB de RAM e Docker (Hetzner, Contabo, DigitalOcean, Hostinger…).

1. Aponte três registros DNS tipo A para o IP da VPS: `app.`, `n8n.` e `evo.` do seu domínio.
2. Na VPS:
   ```bash
   git clone <este repositório> && cd <pasta>
   cp infra/.env.example infra/.env   # preencha tudo; segredos: openssl rand -hex 32
   docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build
   ```
3. O Caddy emite os certificados HTTPS sozinho em 1–2 minutos.

> Teste: `https://app.seudominio/api/saude` responde `{"ok":true,...}`.

## 3. Evolution API: conectar o número do agente

Use um chip **só para o agente** (não o seu WhatsApp pessoal).

**Número novo, antes de conectar:**
- Ative o chip no app **WhatsApp Business** do celular, com nome *Orçaí Imob*, foto (o símbolo da marca) e descrição curta.
- Use o número normalmente por 1 ou 2 dias (algumas conversas de ida e volta) antes de ligar o agente. Números recém-criados que já começam respondendo em volume são os mais bloqueados.
- O número só **responde**: o agente nunca puxa conversa (até a confirmação do cadastro é o corretor quem envia o código). Não use listas de transmissão nem disparos por ele.
- Deixe o celular carregado e com internet: a Evolution funciona como um "aparelho conectado" dele.

1. Criar a instância (troque `SUA_CHAVE` pela `EVOLUTION_API_KEY`):
   ```bash
   curl -X POST https://evo.seudominio/instance/create \
     -H "apikey: SUA_CHAVE" -H "Content-Type: application/json" \
     -d '{"instanceName":"agente","integration":"WHATSAPP-BAILEYS","qrcode":true}'
   ```
2. Ler o QR Code: `GET https://evo.seudominio/instance/connect/agente` (header `apikey`) devolve o QR em base64; ou use o painel em `https://evo.seudominio/manager`. No celular do chip: WhatsApp → Aparelhos conectados → Conectar.
3. Apontar o webhook para o n8n (só o evento de mensagem):
   ```bash
   curl -X POST https://evo.seudominio/webhook/set/agente \
     -H "apikey: SUA_CHAVE" -H "Content-Type: application/json" \
     -d '{"webhook":{"enabled":true,"url":"http://n8n:5678/webhook/evolution-agente","byEvents":false,"base64":false,"events":["MESSAGES_UPSERT"]}}'
   ```
   A URL usa o nome interno `n8n` porque os dois estão na mesma rede Docker.

> Teste: `GET /instance/connectionState/agente` responde `"state":"open"`.

Os nomes exatos dos campos variam um pouco entre versões da Evolution v2; se algum comando for recusado, confira a documentação da versão da imagem em uso (`EVOLUTION_IMAGE`).

## 4. n8n

1. Abra `https://n8n.seudominio`, crie o usuário dono.
2. **Workflows → Import from file** → `n8n/agente-whatsapp.json`.
3. Ative o workflow (chave no canto superior direito).

O workflow não guarda segredos: lê `APP_INTERNAL_URL`, `AGENT_API_KEY`, `EVOLUTION_*` das variáveis de ambiente do container (já definidas no `docker-compose.yml`).

Fluxo: *Evolution: mensagem recebida* → *Filtrar e extrair* (ignora grupos, mensagens enviadas pelo próprio número, áudios e figurinhas; aceita texto e respostas de botão ou lista) → *Perguntar ao agente* (`POST /api/agente/mensagem`) → *Uma resposta por vez* → *Enviar pelo WhatsApp (em ordem)*: texto pelo `sendText`, imagem/PDF/planilha pelo `sendMedia`, uma por vez, na ordem em que o servidor mandou (o orçamento chega antes do menu seguinte).

Se você já tinha importado uma versão anterior, apague o workflow antigo e importe o arquivo de novo.

**A conversa** é por menus numerados (`server/agente/menu.ts`): o corretor responde 1, 2, 3… e uma pergunta por vez, com "0 Voltar ao menu anterior" em toda tela. No fim escolhe receber em imagem, PDF ou mensagem escrita. Quem escreve o pedido por extenso no menu inicial (*"escritura de 350 mil"*) é atendido pelo agente com IA, se `GEMINI_API_KEY` estiver preenchida. Depois de 30 minutos parada, a conversa recomeça do menu. O roteiro completo sai de `npx tsx scripts/modelo-whatsapp.ts pasta-de-saida`.

## 5. Primeiro assinante (teste de ponta a ponta)

No `infra/.env`, preencha `AGENTE_WHATSAPP` (número do chip do agente, com DDI) para o app mostrar o botão "Abrir conversa".

Enquanto o pagamento (Asaas) não está integrado, ative à mão:

1. Crie uma conta pelo site.
2. Confirme o WhatsApp na tela que aparece logo após o cadastro (toque em "Abrir o WhatsApp e enviar" e mande o código ao número do agente; a tela avança sozinha). Para testar sem a Evolution conectada, no SQL Editor:
   ```sql
   update profiles set whatsapp_e164 = '+5532999990000', whatsapp_verified_at = now() where email = 'voce@exemplo.com';
   ```
3. Enquanto o gateway não está integrado, simule um cartão validado (sem isso o acesso fica bloqueado):
   ```sql
   insert into cartoes (user_id, gateway, gateway_customer_id, gateway_cartao_token, bandeira, ultimos4, validade_mes, validade_ano, verificado_em)
   select id, 'asaas', 'teste', 'teste-' || id, 'visa', '4242', 12, 2030, now() from profiles where email = 'voce@exemplo.com';
   ```
   Só com isso a conta já entra no teste de 3 dias. Para pular a etapa "Seu orçamento" num teste por SQL: `update profiles set configurado_em = now() where email = 'voce@exemplo.com';` Para testar como assinante:
   ```sql
   insert into subscriptions (user_id, plan, nivel, status, forma_pagamento, current_period_end)
   select id, 'anual', 'usuario', 'ativa', 'pix', now() + interval '1 year' from profiles where email = 'voce@exemplo.com';
   ```
4. Do WhatsApp cadastrado, mande ao número do agente: *"Oi"* e responda **1** (Escritura), **1** (Compra e venda), **1** (Simples), **350 mil** e **3** (Mensagem escrita).

> Esperado: o orçamento escrito com **TOTAL ESTIMADO: R$ 18.743,56** e, logo depois, o menu "Quer fazer mais alguma coisa?". O cálculo aparece em `calculations` com `origem = 'whatsapp'`.

Outros testes: no menu final, **2** (outro formato) e **1** (imagem); **3** (valores detalhados); **0** em qualquer tela volta uma etapa; *"escritura de 350 mil"* no menu inicial (agente com IA); mensagem de um número não cadastrado (deve receber o link de cadastro).

## Rotas da API

| Rota | Quem chama | Para quê |
|---|---|---|
| `POST /api/agente/mensagem` | n8n (`x-agent-key`) | Processa a mensagem e devolve `{status, respostas[]}` |
| `GET /api/agente/identificar?whatsapp=` | n8n | Status do número: `ativo`, `inativo`, `sem_cadastro` |
| `POST /api/whatsapp/codigo` | site (login) | Gera o código que o corretor envia ao agente para confirmar o WhatsApp |
| `POST /api/calculos/:tipo` | site | `escritura`, `doacao`, `financiamento_caixa`, `banco_privado`, `correcao` |
| `GET /api/calculos?mes=AAAA-MM` | site | Histórico |
| `GET /api/calculos/:numero/arquivo?formato=pdf\|jpeg` | site | Link temporário do orçamento (sem `formato`, o da conta) |
| `GET /api/calculos/:numero/pdf` | site | Link temporário do PDF |
| `GET /api/exportar?mes=AAAA-MM` | site | Planilha CSV (abre no Excel) |
| `POST /api/cidades/pedido` | landing | "Quero na minha cidade" |

## Desenvolvimento local

```bash
cp .env.example .env   # preencha
npm install
npm run dev            # http://localhost:3000
npm test               # cálculos de referência e telefone
```
