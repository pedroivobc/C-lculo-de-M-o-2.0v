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

## 2a. Produção: só o site no servidor da Clemente (2.24.79.129)

O servidor já roda Evolution, n8n e outros serviços atrás de um nginx com certbot. O site entra ao lado deles:

1. Registros A de `calculonamao.com.br` e `www` apontando para `2.24.79.129` (registro.br > Configurar endereçamento).
2. No servidor:
   ```bash
   git clone https://github.com/pedroivobc/C-lculo-de-M-o-2.0v /opt/orcaai
   cd /opt/orcaai/infra/app-servidor && cp .env.example .env && nano .env
   docker compose up -d --build
   cp nginx-calculonamao.conf /etc/nginx/sites-enabled/calculonamao
   nginx -t && systemctl reload nginx
   certbot --nginx -d calculonamao.com.br -d www.calculonamao.com.br
   ```
3. Para atualizar: `cd /opt/orcaai && git pull && cd infra/app-servidor && docker compose up -d --build`.
4. No n8n, o nó que chama o app usa `https://calculonamao.com.br/api/agente/mensagem`.

`infra/app-vps` é a variante para um VPS vazio (traz o próprio Caddy).

## 2b. Site e API na Vercel (alternativa à VPS para o app)

O site e a API (login, cálculos salvos, PDF/imagem, cupom, tabelas anuais) também rodam na Vercel:
o `vercel.json` chama `scripts/vercel-build.mjs`, que gera o site estático e uma função com a API.
A Evolution e o n8n continuam na VPS (precisam de processo ligado o tempo todo).

Em **Vercel → Project → Settings → Environment Variables** (Preview e/ou Production):

| Variável | Para quê |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | login no site (entram no build: depois de mudar, faça um novo deploy) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | API: cálculos salvos, PDF, cupom, tabelas |
| `APP_URL` | endereço do site (links no PDF e nas mensagens) |
| `AGENT_API_KEY`, `VERIFICACAO_SEGREDO` | chamadas do n8n e código de verificação do WhatsApp |
| `GEMINI_API_KEY` | respostas em texto livre no WhatsApp (opcional) |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` | Evolution na VPS |
| `VITE_AGENTE_WHATSAPP`, `VITE_EMPRESA_CNPJ`, `VITE_EMAIL_PRIVACIDADE` | número do agente e dados das páginas legais |

No n8n, troque o endereço da API (`/api/agente/...`) pelo da Vercel. Se o deploy de preview estiver
protegido (Vercel Authentication), o n8n não passa: use o domínio de produção ou um bypass de automação.

> Teste: `https://<seu-projeto>.vercel.app/api/saude` responde `{"ok":true,...}`.

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

Fluxo: *Evolution: mensagem recebida* → *Filtrar e extrair* (ignora grupos, mensagens enviadas pelo próprio número, áudios e figurinhas; aceita texto e respostas de botão ou lista) → *Perguntar ao agente* (`POST /api/agente/mensagem`) → *Uma resposta por vez* → *Enviar pelo WhatsApp (em ordem)*: cada resposta já vem do servidor com `envio.rota` (`sendText`, `sendButtons`, `sendList` ou `sendMedia`) e `envio.corpo`, e o n8n só repassa para a Evolution, uma por vez, na ordem em que o servidor mandou (o orçamento chega antes do menu seguinte). Com um servidor anterior (sem `envio`), o nó cai no envio antigo: texto por `sendText` e arquivo por `sendMedia`.

Se você já tinha importado uma versão anterior, apague o workflow antigo e importe o arquivo de novo.

**A conversa** começa com *"Olá, {nome}! 👋 Qual tipo de cálculo iremos fazer hoje?"* e as opções Compra e venda, Financiamento, Doação e Correção contratual (só para Juiz de Fora), e segue por menus (`server/agente/menu.ts`): o corretor responde 1, 2, 3… e uma pergunta por vez, com "0 Voltar ao menu anterior" em toda tela. No fim escolhe receber em imagem, PDF ou mensagem escrita. Quem escreve o pedido por extenso no menu inicial (*"escritura de 350 mil"*) é atendido pelo agente com IA, se `GEMINI_API_KEY` estiver preenchida. Depois de 30 minutos parada, a conversa recomeça do menu. O roteiro completo sai de `npx tsx scripts/modelo-whatsapp.ts pasta-de-saida`.

### Botões e lista no WhatsApp

Com `WHATSAPP_BOTOES=sim` no `.env` do app, as opções saem como **botões** (telas com até 3 opções curtas, como Sim/Não/Voltar) ou **lista** com o botão "Ver opções" (até 10 opções, como o menu inicial). Com a variável vazia, vai o texto numerado de sempre. Digitar o número continua funcionando nos dois casos, e a resposta do botão chega ao servidor como o número da opção.

Na conexão por QR code (`WHATSAPP-BAILEYS`), o WhatsApp não garante botões e listas para números comuns: em alguns aparelhos a mensagem não aparece. Ligue a variável, teste no seu celular (Android e iPhone, se puder) e volte para vazio se algo não aparecer. Na API oficial da Meta (`WHATSAPP-BUSINESS` na Evolution), botões e listas são suportados.

### Chatwoot: passar para uma pessoa

O corretor pode escrever *atendente* a qualquer momento, ou escolher *Falar com um atendente* no menu depois do orçamento. O robô avisa que vai chamar alguém e **fica quieto naquela conversa** até o corretor escrever *menu* (ou por 8 horas sem mensagens).

1. Ligue a integração nativa da Evolution com o Chatwoot na instância do agente (painel `/manager` → Chatwoot, ou `POST /chatwoot/set/<instância>`), para as conversas aparecerem no Chatwoot e as respostas da equipe saírem pelo mesmo número. Deixe a importação de contatos e mensagens como preferir.
2. No `.env` do app, preencha `CHATWOOT_URL`, `CHATWOOT_API_TOKEN` (Chatwoot → Perfil → Token de acesso) e `CHATWOOT_ACCOUNT_ID` (o número na URL do Chatwoot, `/app/accounts/<id>`).

Com isso, quando o corretor pede um atendente, o servidor abre a conversa no Chatwoot, põe a etiqueta **atendente** e deixa uma nota privada com o nome dele e o último orçamento. Sem essas variáveis, o robô pausa do mesmo jeito; só não marca nada no Chatwoot.

## 4a. Pagamento (Stripe)

Não existe plano mensal. No cartão, todo plano (trimestral, semestral, anual) é cobrado mês a mês com fidelidade de 3, 6 ou 12 meses e depois renova no mesmo plano. O Pix vale só para o anual, pago de uma vez. Valores em `src/lib/planos.ts`.

1. **Chave:** no `.env` do servidor, `STRIPE_SECRET_KEY=sk_test_...` (teste) e depois `sk_live_...` (produção).
2. **Pix:** no painel da Stripe, Configurações > Formas de pagamento, ativar o Pix.
3. **Webhook:** Desenvolvedores > Webhooks > Adicionar destino, URL `https://SEU_DOMINIO/api/webhooks/stripe`, versão mais recente da API, eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Copiar o segredo (`whsec_...`) para `STRIPE_WEBHOOK_SECRET`.
4. Aplicar a migração `20261018000000_stripe.sql` no Supabase e rodar `docker compose up -d --build`.
5. Produtos e preços são criados sozinhos na primeira assinatura (lookup keys `orcai_<nivel>_<periodo>_<forma>`). Mudou um valor em `planos.ts`, o preço novo vale para quem assinar depois.
6. **Oferta de lançamento** (`OFERTA_LANCAMENTO` em `src/lib/planos.ts`): Plano Fundador: Pró anual a R$ 9,90/mês para os 20 primeiros (renovação depois do 1º ano ainda a definir), 3 dias de teste com o cartão já cadastrado (a Stripe cobra no 4º dia), fidelidade de 12 meses. Conta como vaga quem está no teste ou assinando; quem desiste devolve a vaga. Em qualquer plano, nos 7 primeiros dias o cancelamento é imediato e o valor pago é estornado (CDC, art. 49). Quando as vagas acabam, a oferta some do site.
7. Teste com o cartão `4242 4242 4242 4242`. Com tudo certo, `EXIGIR_ASSINATURA=true`.

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

## Todo ano: atualizar as tabelas

Emolumentos de MG (TJMG), INCC da correção contratual e a base do desconto de ITBI de Juiz de Fora mudam todo ano.
Nada disso exige mexer no código: entre com a conta de administrador e abra **Tabelas anuais** no menu.

1. **Baixar planilha** da tabela em vigor (.xlsx; abre no Excel ou no Google Planilhas).
2. Troque os valores pelos do ano novo. Emolumentos: emolumento bruto e TFJ de cada faixa e dos atos fixos. INCC: acrescente a linha do ano. ITBI de JF: o limite do SFH.
3. Envie a planilha informando o **ano** e a **data em que passa a valer** (ex.: 01/01/2027). Pode ser enviada antes: fica agendada.
4. O sistema confere a planilha (faixas em ordem, valores válidos, ano do INCC) e mostra a **prévia** com a variação de cada item; variações abaixo de -1% ou acima de 25% aparecem em vermelho.
5. **Publicar.** Na data escolhida, o site, a API e o WhatsApp passam a calcular com a tabela nova (o servidor relê a cada 15 minutos). Uma versão publicada por engano pode ser removida; os cálculos voltam para a anterior.

As versões ficam em `tabelas_anuais` (migration `20261013000000_tabelas_anuais.sql`). Sem nenhuma versão publicada, valem as tabelas de 2026 de `src/lib/calc/parametros.ts`.
