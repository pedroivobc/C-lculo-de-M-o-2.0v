# Orçaí Imob — plano de implementação do SaaS + agente WhatsApp

> **Status (out/2026)** — feito: fórmulas extraídas para `src/lib/calc/` com testes de referência; esquema novo do Supabase (`supabase/migrations/`); API com o agente do WhatsApp (Gemini com ferramentas), verificação do número, histórico, PDF e exportação CSV; Docker Compose com Evolution API + n8n; workflow do n8n; chave do Gemini fora do navegador; perfis não são mais públicos. Passo a passo para subir: [SETUP.md](SETUP.md).
> Feito também: front novo com a identidade Orçaí (landing com calculadora ao vivo, cadastro com confirmação do WhatsApp, 7 calculadoras com o orçamento picotado, histórico com exportação, agente e conta), web e celular, usando a mesma lib de cálculo do servidor.
> Feito também: perfis admin/pro/usuario/trial e cartão obrigatório no banco (`supabase/migrations/20261006000000_perfis_e_acesso.sql`); o agente já respeita a regra.

> Feito também: etapa "Seu orçamento" no cadastro (`supabase/migrations/20261007000000_configuracao_orcamento.sql`): estado, cidade e alíquota do ITBI (outras cidades de MG com alíquota informada pelo assinante), logo, cor e formato PDF ou imagem JPEG (`server/imagem.ts`, com sharp). O teste de 3 dias mostra o orçamento como no Pró.

> **Mudança (out/2026):** o **Valor Venal saiu do produto** (calculadora, leitura do espelho do IPTU, rota `/api/iptu/extrair`, tabelas `landValues`/`factors`). As menções a IPTU e valor venal abaixo ficam como histórico. O campo "valor venal" também saiu: a prefeitura mudou o motor de cálculo e a base passa a ser o valor declarado. O orçamento agora mostra **Escritura** (lavratura + arquivamento) e **Registro** (ato de registro + prenotação + certidão de inteiro teor + averbação de inscrição municipal + averbação de dados pessoais), pela Tabela 4 de 2026, conferida com o relatório final do 3º RI de Juiz de Fora (protocolo 229.352: registro R$ 5.110,00).
> Falta: pagamento (Asaas ou Mercado Pago) com tokenização do cartão e webhook de assinatura; telas de cartão, upload de logo/cores do Pro e painel admin; PDF do Pro com logo e paleta — por enquanto a ativação é manual e o app não bloqueia sem assinatura (`VITE_EXIGIR_ASSINATURA`); verificar INPI, domínio (orcai.com.br) e @ antes de lançar.

Design de referência (web e mobile, todas as telas): canvas **Orçaí Imob** no claude.ai (páginas Marca, Web e Mobile).

**Marca:** Orçaí é a marca-mãe; cada segmento é uma vertical com etiqueta (Orçaí Imob primeiro). O símbolo, a paleta e a voz são compartilhados; no código, o nome da vertical vem de `MARCA_NOME`.

## 1. O que vamos colocar no ar

- **Site/app** (web e mobile responsivo): landing, cadastro com WhatsApp, assinatura, calculadoras, histórico com exportação, agente, conta.
- **Assinatura** (anual = 10 mensalidades, "2 meses grátis"), Pix ou cartão:
  - **Essencial** (`nivel = 'usuario'`): R$ 29,90/mês ou R$ 299,00/ano (R$ 24,92/mês). Orçamento com a marca Orçaí.
  - **Pró** (`nivel = 'pro'`): R$ 39,90/mês ou R$ 399,00/ano (R$ 33,25/mês). Orçamento com a logo e as cores do assinante.
  - Preços de vitrine em `src/lib/config.ts` (`PLANOS`); os valores cobrados ficam no gateway.
- **Agente no WhatsApp**: número próprio conectado na Evolution API, orquestrado pelo n8n. O cliente assinante manda mensagem do número cadastrado, o agente identifica a conta, calcula **chamando a nossa API** (nunca "de cabeça"), salva o cálculo no histórico, devolve o resumo + PDF e exporta quando pedido.

```
 Cliente (WhatsApp)                                   Cliente (navegador/celular)
        │                                                        │
        ▼                                                        ▼
 Evolution API ──webhook──► n8n ──HTTP (chave do agente)──► API Express (server.ts) ◄── front React
        ▲                    │  identifica, IA decide           │  cálculos (lib compartilhada)
        └──── sendText/      │  qual ferramenta chamar          │  PDF / exportação
              sendMedia ◄────┘                                  ▼
                                                     Supabase (Auth, Postgres, Storage)
                                                                ▲
                                          Gateway de pagamento ─┘ (webhook de assinatura)
```

## 2. Decisões de stack

| Peça | Escolha | Por quê |
|---|---|---|
| Front | Manter Vite + React + Tailwind, adicionar `react-router` | Já existe; precisa de rotas reais (landing pública, /app/..., /assinar) |
| API | Manter Express (`server.ts`) | Já existe; vira o "cérebro" usado pelo site **e** pelo n8n |
| Banco/Auth/Arquivos | Supabase | Já existe; RLS + Storage privado para PDFs |
| Pagamento | **Asaas** (alternativa: Mercado Pago) | Assinatura recorrente com Pix e cartão, webhooks, cobrança no CPF/CNPJ |
| WhatsApp | Evolution API (self-hosted) | Sua escolha; ver riscos na seção 8 |
| Orquestração | n8n (self-hosted) | Sua escolha; nó "AI Agent" com ferramentas HTTP |
| IA do agente | Modelo com *tool calling* no nó AI Agent do n8n | O modelo só interpreta a mensagem e escolhe a ferramenta; os números vêm da API |
| Leitura do IPTU | Mover a chamada do Gemini para o servidor | Hoje a chave vai para o navegador (ver 3.1) |
| Hospedagem | 1 VPS com Docker Compose: `app`, `n8n`, `evolution-api` (+ postgres/redis da Evolution) | Evolution e n8n já pedem VPS; tudo no mesmo lugar, atrás de um proxy com HTTPS (Caddy/Traefik) |

## 3. Correções obrigatórias no código atual (antes de vender)

1. **Chave do Gemini exposta**: `vite.config.ts` faz `define: { 'process.env.GEMINI_API_KEY': ... }` e `src/services/geminiService.ts` roda no navegador — a chave vai no bundle público. Mover para `POST /api/iptu/extrair` no servidor e remover o `define`.
2. **Perfis públicos**: `supabase-schema.sql` tem `"Public profiles are viewable by everyone." ... USING (true)`. Com o WhatsApp no perfil, qualquer usuário logado leria o telefone de todos. Trocar por `USING (auth.uid() = id)`.
3. **Fórmulas presas nos componentes**: `Escrituras.tsx`, `FinanciamentoCaixa.tsx`, `FinanciamentoBancoPrivado.tsx`, `Doacao.tsx`, `CorrecaoContratual.tsx`, `ValorVenal.tsx` calculam dentro do React. O agente precisa das **mesmas** fórmulas no servidor → extrair para `src/lib/calc/` (funções puras, sem React) e usar nos dois lados.
4. **Conferir tabelas** (sinalizado, não alterado):
   - `src/data/notaryFees.ts`: a faixa `{ min: 3700000.01, max: 3700000.0, fee: 15289.15 }` nunca é alcançada (min > max).
   - Registro base é R$ 496,74 em `Escrituras.tsx` e R$ 335,52 em `Doacao.tsx`; confirmar se é intencional.
5. Só `ValorVenal` (e parte das escrituras) salvam em `calculations`. Todas as calculadoras passam a salvar via API.

## 4. Modelo de dados (Supabase)

```sql
-- Perfil: WhatsApp é a identidade do agente
alter table profiles
  add column email text,
  add column whatsapp_e164 text unique,          -- ex.: +5532999990000
  add column whatsapp_verified_at timestamptz,
  add column pdf_header text,                    -- "Sua marca no PDF"
  add column pdf_logo_path text;

drop policy "Public profiles are viewable by everyone." on profiles;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);

-- Código de verificação do WhatsApp (guardar só o hash)
create table phone_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  whatsapp_e164 text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
alter table phone_verifications enable row level security; -- só o servidor (service role) acessa

-- Assinatura
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  plan text not null check (plan in ('mensal','anual')),
  status text not null check (status in ('pendente','ativa','atrasada','cancelada')),
  gateway text not null default 'asaas',
  gateway_customer_id text,
  gateway_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table subscriptions enable row level security;
create policy "Users can view own subscription" on subscriptions for select using (auth.uid() = user_id);

-- Cálculos: um formato só para site e WhatsApp
alter table calculations
  add column seq bigint generated always as identity,   -- "#0142" que o cliente cita no WhatsApp
  add column tipo text,              -- escritura | financiamento_caixa | banco_privado | doacao | correcao | valor_venal
  add column subtipo text,
  add column origem text not null default 'site' check (origem in ('site','whatsapp')),
  add column entrada jsonb,          -- inputs
  add column resultado jsonb,        -- memória de cálculo (linhas)
  add column total numeric,
  add column pdf_path text;          -- Storage privado
create index on calculations (user_id, created_at desc);

-- Log das conversas (suporte e auditoria; definir retenção, ex. 90 dias)
create table whatsapp_messages (
  id bigserial primary key,
  user_id uuid references auth.users on delete set null,
  whatsapp_e164 text not null,
  direcao text not null check (direcao in ('entrada','saida')),
  tipo text not null,                -- texto | imagem | documento
  conteudo text,
  evolution_message_id text unique,  -- idempotência: a Evolution pode reenviar o webhook
  calculation_id uuid references calculations on delete set null,
  created_at timestamptz default now()
);
alter table whatsapp_messages enable row level security;
```

As tabelas `orders`, `api_keys` e `invites` do esquema atual deixam de ser usadas pelo produto (o "Analytics" pode ler `subscriptions`). Remover depois que o novo fluxo estiver no ar.

## 5. API (Express, `server.ts`)

Separar em `server/routes/*.ts`. Três tipos de autenticação:

- **Usuário** (site): `Authorization: Bearer <jwt do Supabase>` → valida com `supabase.auth.getUser`.
- **Agente** (n8n): `x-agent-key: <AGENT_API_KEY>` + `x-whatsapp: +55...`. A API resolve o usuário pelo telefone e **sempre** confere assinatura ativa.
- **Webhooks**: token/assinatura do gateway; segredo na URL ou header para a Evolution.

| Rota | Quem chama | O que faz |
|---|---|---|
| `POST /api/whatsapp/codigo` | usuário | Gera código de 6 dígitos (hash, 30 min) e devolve ao site, que abre o WhatsApp com a mensagem pronta. O corretor envia ao agente; `server/verificacao.ts` confere (máx. 5 tentativas) e grava `whatsapp_e164` + `verified_at`. O agente nunca chama primeiro. |
| `POST /api/assinatura` | usuário | Cria cliente + assinatura no Asaas (Essencial R$ 29,90/mês ou R$ 299/ano; Pró R$ 39,90/mês ou R$ 399/ano), devolve Pix copia-e-cola/QR ou processa cartão |
| `POST /api/webhooks/asaas` | gateway | Atualiza `subscriptions`; ao ativar, envia boas-vindas no WhatsApp |
| `POST /api/calculos/:tipo` | usuário **e** agente | Roda a lib de cálculo, salva em `calculations` (origem site/whatsapp), devolve memória + total + `seq` |
| `POST /api/iptu/extrair` | usuário **e** agente | Recebe PDF/foto (base64), chama Gemini no servidor, devolve dados + valor venal |
| `GET /api/calculos` | usuário | Lista/filtra histórico (busca, tipo, período, origem) |
| `GET /api/calculos/:seq/pdf` | usuário **e** agente | Gera (ou reaproveita) o PDF no Storage e devolve URL assinada (expira em 10 min) |
| `GET /api/exportar?periodo=2026-10&formato=xlsx\|pdf\|csv` | usuário **e** agente | Gera arquivo do período, URL assinada |
| `GET /api/agente/identificar?whatsapp=` | agente | `{ status: 'ativo' \| 'sem_cadastro' \| 'inativo', nome, user_id }` |
| `GET /api/conta/dados` / `DELETE /api/conta` | usuário | LGPD: exportar tudo / excluir conta |

Bibliotecas novas: `exceljs` (planilha), `zod` (validar entrada das rotas), `express-rate-limit`. O `jspdf` atual já roda no Node — mover `src/lib/pdfGenerator.ts` para uso no servidor e trocar o logo fixo da Clemente pelo `pdf_header`/`pdf_logo_path` do cliente.

### Lib de cálculo compartilhada (`src/lib/calc/`)

```
calc/
  tabelas.ts          // notaryFees, INCC, constantes (PRECO_FOLHA, REGISTRO_BASE, PRENOTACAO…)
  escritura.ts        // calcularEscritura(subtipo, entrada) → { base, linhas[], total }
  financiamento.ts    // calcularCaixa(...), calcularBancoPrivado(...)
  doacao.ts
  correcao.ts
  valorVenal.ts
  index.ts            // registry: tipo → { schema zod, calcular }
```

Cada função devolve `linhas: { rotulo, nota?, valor }[]` — é o que o site mostra, o PDF imprime e o agente resume no WhatsApp.

**Testes de referência** (Vitest), com os números do design, que batem com as fórmulas atuais:

| Caso | Total esperado |
|---|---|
| Escritura compra e venda, declarado 320.000, venal 350.000, 25 fls, certidões 400, honorários 700 | R$ 19.044,99 |
| Caixa SBPE, base 350.000, financiado 280.000, 1º imóvel, taxa 1,5%, certidões 260,07, honorários 1.000 | R$ 17.942,73 |
| Itaú SBPE, base 500.000, financiado 400.000, não é 1º imóvel, honorários 700 | R$ 22.474,22 |
| Doação simples, base 300.000, 25 fls | R$ 19.383,77 |
| Correção INCC, R$ 180.000 em 2015 | R$ 330.492,46 (+83,61%) |

## 6. Fluxo no n8n

**Workflow "Agente WhatsApp"**

1. **Webhook** recebendo o evento `MESSAGES_UPSERT` da Evolution (URL com segredo).
2. **Filtro**: descartar `fromMe`, grupos (`@g.us`), status/broadcast e mensagens já processadas (`evolution_message_id`).
3. **Normalizar telefone**: `remoteJid` → E.164. ⚠️ Números brasileiros antigos podem chegar **sem o 9** (`55 32 9999-0000` vs `55 32 99999-0000`); a API deve aceitar as duas formas ao identificar.
4. **HTTP → `/api/agente/identificar`**
   - `sem_cadastro` → responde com link de cadastro e para.
   - `inativo` → responde com link de pagamento e para.
   - `ativo` → segue.
5. **Agrupar mensagens** (opcional, Redis, 3–5 s): a pessoa costuma mandar 2–3 mensagens seguidas.
6. **Mídia?** imagem/PDF → `getBase64FromMediaMessage` da Evolution → `/api/iptu/extrair`.
7. **AI Agent** (memória Postgres por `user_id`, últimas ~10 mensagens) com ferramentas HTTP:
   `calcular_escritura`, `calcular_financiamento_caixa`, `calcular_banco_privado`, `calcular_doacao`, `corrigir_contrato`, `ler_espelho_iptu`, `buscar_calculo`, `exportar_periodo`, `gerar_pdf`.
   Regras do prompt de sistema: português, frases curtas; **nunca** inventar valor — todo número vem de uma ferramenta; se faltar dado (ex.: valor venal), perguntar; sempre informar o nº do cálculo (#0142); lembrar que é estimativa.
8. **Responder**: `sendText` com o resumo; `sendMedia` (documento) com o PDF/planilha pela URL assinada.
9. **Registrar** entrada/saída em `whatsapp_messages`.

**Workflows auxiliares**: boas-vindas ao ativar assinatura (chamado pela API), lembrete de renovação (7 dias antes, anual) e de Pix mensal, alerta para você quando a Evolution desconectar (evento `CONNECTION_UPDATE`).

## 6.1 Expansão por município (MG primeiro, começando por Juiz de Fora)

O cálculo tem três camadas com donos diferentes, e é isso que define o que precisa ser feito para abrir uma cidade nova:

| Camada | Dono | Exemplos | Para abrir outra cidade de MG |
|---|---|---|---|
| Estadual (UF) | TJMG / SEF-MG | lavratura, registro, arquivamento, prenotação, ITCD | Nada — já vale para MG inteiro |
| Municipal | Prefeitura | ITBI (alíquota, regra do SFH, base), valor venal, layout do espelho do IPTU | Cadastrar regras + ensinar a leitura do espelho daquela prefeitura |
| Banco / usuário | Banco, assinante | taxa Caixa, tarifas, certidões, honorários | Nada |

Modelo de dados:

```sql
create table municipios (
  id text primary key,                 -- 'mg-juiz-de-fora'
  uf char(2) not null,                 -- 'MG'
  nome text not null,
  status text not null check (status in ('ativo','em_breve')),
  itbi jsonb not null,                 -- { aliquota: 0.02, sfh: { limiar: 107603.17, fixo: 538.02, aliquota_financiado: 0.005 } }
  valor_venal jsonb,                   -- tabelas/fatores da prefeitura (hoje em src/data/landValues.ts e factors.ts)
  iptu_prompt text,                    -- instruções de leitura do espelho daquela prefeitura
  vigencia date not null
);

create table pedidos_cidade (           -- "Quero na minha cidade" da landing
  id bigserial primary key,
  cidade text not null,
  uf char(2) not null default 'MG',
  whatsapp_e164 text,
  user_id uuid references auth.users on delete set null,
  created_at timestamptz default now()
);

alter table profiles add column municipio_padrao text references municipios default 'mg-juiz-de-fora';
alter table calculations add column municipio text references municipios;
```

Regras de código:
- A lib `calc/` recebe o município como parâmetro (`calcularEscritura(entrada, { municipio })`) e devolve em cada linha a **origem** (`'municipio' | 'uf' | 'banco' | 'usuario'`). O front mostra isso como etiqueta (JUIZ DE FORA / MG / BANCO / VOCÊ) e o PDF também.
- Tabela de emolumentos fica por UF (`tabelas/mg-2026.ts`), com vigência — permite trocar o ano sem mexer em código de cálculo.
- O agente usa o `municipio_padrao` do assinante; se a mensagem citar outra cidade ainda `em_breve`, responde que ainda não atende e registra em `pedidos_cidade`.
- Ordem de abertura: ranking de `pedidos_cidade` (o formulário da landing alimenta isso).

## 7. Front-end (seguindo o canvas)

- Direção visual comercial (substitui o tema preto/dourado atual): azul-tinta `#101828`, azul de ação `#2342d6`, vermelho de Minas `#c8202a` só em rótulos e no carimbo, amarelo marca-texto `#ffd24a` nos preços; títulos e números em **Archivo** (largura 112%), texto em **Instrument Sans**.
- Peça-assinatura: o resultado de cada cálculo é um **orçamento picotado** com etiqueta de origem por linha, total marcado em amarelo e carimbo "Juiz de Fora · MG". Na landing ele é uma calculadora ao vivo (o visitante testa antes de assinar).
- Seletor de município no menu (web) e no início (mobile), com Juiz de Fora ativo e as demais cidades de MG "em breve".
- Rotas: `/` landing · `/entrar` · `/cadastro` (nome, e-mail, WhatsApp) → `/verificar` (código) → `/assinar` · `/app` início · `/app/<calculadora>` · `/app/historico` · `/app/agente` · `/app/conta`.
- Guarda de rota: sem assinatura ativa → `/assinar`.
- Layout: menu lateral no desktop; barra inferior com 4 abas (Início, Histórico, Agente, Conta) no celular; calculadoras abrem como tela cheia com botões fixos embaixo.
- Remover do menu: Analytics, API Keys, Convites (viram área de admin sua, se quiser).
- "Usar na escritura" leva o valor venal / valor corrigido para a escritura (hoje isso é feito pelo `localStorage`; passa a ser pelo histórico).

## 8. Riscos e cuidados

- **Evolution API usa o protocolo do WhatsApp Web (não oficial)**. Risco real de banimento do número, principalmente se mandar mensagens em massa. Cuidados: número dedicado e "aquecido", só responder a quem chamou, sem disparos. Plano B: a Evolution também conecta na **API oficial (WhatsApp Cloud API)** — migrar sem trocar o n8n quando o volume crescer.
- **Margem**: Essencial R$ 29,90 e Pró R$ 39,90 cobrem imposto (Simples, Anexo III ou V), gateway, nota fiscal e infraestrutura com folga: taxa fixa por cobrança Pix/cartão e custo de IA por mensagem pesam. Confirme as taxas do gateway e incentive o anual. Defina um **uso justo** (ex.: [LIMITE] cálculos/mês) e conte no `/api/calculos`.
- **LGPD**: telefone, endereço e valores de imóvel de terceiros são dados pessoais. Termos + política de privacidade no cadastro, exportar/excluir conta, retenção do log de conversas, PDFs em bucket privado com URL que expira.
- **Responsabilidade**: todo resultado com "estimativa — confirme com o cartório", como já está no app.
- **Segurança**: chaves só no servidor; webhooks autenticados; rate limit por IP e por telefone; `x-agent-key` rotacionável.

## 9. Variáveis de ambiente

```
# Supabase
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # só servidor

# IA (só servidor — remover o define do vite.config.ts)
GEMINI_API_KEY=

# Agente
AGENT_API_KEY=                    # n8n → API
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=calculo-na-mao
AGENT_WHATSAPP_NUMBER=+55...

# Pagamento
ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=
PRICE_MENSAL_CENTS=2990
PRICE_ANUAL_CENTS=29900

APP_URL=https://...
```

## 10. Fases

| Fase | Entrega | Pronto quando |
|---|---|---|
| **0. Base** | Correções da seção 3, lib `calc/` + testes de referência, esquema da seção 4 | Testes passando com os 5 casos; chave do Gemini fora do bundle |
| **1. API** | Rotas da seção 5 (cálculo, histórico, PDF, exportação, IPTU) | Site e `curl` com `x-agent-key` geram o mesmo cálculo |
| **2. Cadastro + pagamento** | Cadastro com WhatsApp, código de verificação, Asaas sandbox, webhook | Pagar no sandbox ativa a conta e chega a mensagem de boas-vindas |
| **3. Front novo** | Telas do canvas (web + mobile) | Fluxo landing → cadastro → assinatura → cálculo → histórico no celular |
| **4. Agente** | VPS com Docker Compose, Evolution conectada, workflow n8n | 10 conversas de teste: escritura, Caixa, foto do IPTU, "exportar outubro", número não cadastrado, assinatura vencida |
| **5. Lançamento** | Asaas produção, termos/LGPD, monitoramento, backup | Primeiros clientes pagantes |

## 11. Decisões em aberto

1. Gateway: Asaas ou Mercado Pago?
2. Uso justo: quantos cálculos/mês por assinante?
3. Teste grátis? (ex.: 3 cálculos pelo WhatsApp antes de pagar)
4. Uma conta = um WhatsApp, ou permitir mais de um número por conta (equipe)?
5. Modelo de IA do nó AI Agent no n8n (custo × qualidade em português).
