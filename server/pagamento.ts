import Stripe from 'stripe';
import { config } from './config';
import { supabaseAdmin } from './supabase';
import { enviarTexto } from './evolution';
import { cobranca, DIAS_ARREPENDIMENTO, OFERTA_LANCAMENTO, PERIODOS, PLANOS, type Forma, type Nivel, type Periodo } from '../src/lib/planos';

/**
 * Cobrança pela Stripe, sempre no Checkout da própria Stripe (o número do cartão nunca passa por aqui).
 * - Cartão: assinatura mensal com fidelidade de 3, 6 ou 12 meses; depois renova no mesmo plano.
 * - Pix: só no anual, um pagamento à vista que libera 12 meses.
 * - Cadastro do cartão (sem cobrar): libera o teste grátis pelo gatilho do banco.
 * Os produtos e preços são criados na Stripe na primeira vez que alguém assina (ver precoDaStripe).
 * O webhook (tratarEvento) é quem grava `subscriptions` e `cartoes`; as rotas só abrem o Checkout.
 */

let cliente: Stripe | null = null;
export function stripe(): Stripe {
  if (!config.stripe.secretKey) throw new Error('STRIPE_SECRET_KEY não configurada no .env');
  cliente ??= new Stripe(config.stripe.secretKey);
  return cliente;
}

const GATEWAY = 'stripe';
const CUPOM_MES_GRATIS = 'orcai_mes_gratis';

// ---------------- Regras puras (testadas em pagamento.test.ts) ----------------

/** Status da assinatura na Stripe → status no banco. */
export function statusDaStripe(s: Stripe.Subscription.Status): 'pendente' | 'ativa' | 'atrasada' | 'cancelada' {
  if (s === 'active' || s === 'trialing') return 'ativa';
  if (s === 'past_due' || s === 'unpaid' || s === 'paused') return 'atrasada';
  if (s === 'canceled' || s === 'incomplete_expired') return 'cancelada';
  return 'pendente';
}

/** Soma meses mantendo o dia (31/01 + 1 mês = 28/02 ou 29/02). */
export function somarMeses(data: Date, meses: number): Date {
  const d = new Date(data);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d;
}

/** Quando o cancelamento passa a valer: no fim da fidelidade ou, depois dela, no fim do mês já pago. */
export function dataDoCancelamento(fidelidadeAte: Date | null, fimDoMesPago: Date | null, agora = new Date()): Date {
  const candidatos = [fidelidadeAte, fimDoMesPago, agora].filter((d): d is Date => !!d);
  return new Date(Math.max(...candidatos.map((d) => d.getTime())));
}

/** Ainda dá para desistir com reembolso (CDC, art. 49)? */
export function dentroDoArrependimento(inicio: Date, agora = new Date()): boolean {
  return agora.getTime() - inicio.getTime() < DIAS_ARREPENDIMENTO * 86400_000;
}

export const chaveDoPreco = (nivel: Nivel, periodo: Periodo, forma: Forma) => `orcai_${nivel}_${periodo}_${forma}`;

// ---------------- Produtos e preços ----------------

const precosEmCache = new Map<string, string>();

/**
 * ID do preço na Stripe para o plano. Procura pela lookup_key; se não existe ou o valor mudou em planos.ts,
 * cria (o produto tem ID fixo, então chamadas simultâneas não duplicam nada).
 */
export async function precoDaStripe(nivel: Nivel, periodo: Periodo, forma: Forma): Promise<string> {
  const chave = chaveDoPreco(nivel, periodo, forma);
  const { centavos, recorrente } = cobranca(nivel, periodo, forma);
  const emCache = precosEmCache.get(chave);
  if (emCache) return emCache;

  const s = stripe();
  const { data } = await s.prices.list({ lookup_keys: [chave], active: true, limit: 1 });
  if (data[0] && data[0].unit_amount === centavos) {
    precosEmCache.set(chave, data[0].id);
    return data[0].id;
  }
  const produto = `orcai_${nivel}`;
  await s.products.create({ id: produto, name: `Orça.ai ${PLANOS[nivel].nome}`, description: PLANOS[nivel].resumo })
    .catch((e) => { if ((e as Stripe.errors.StripeError).code !== 'resource_already_exists') throw e; });
  const novo = await s.prices.create({
    product: produto,
    currency: 'brl',
    unit_amount: centavos,
    lookup_key: chave,
    transfer_lookup_key: true, // valor novo em planos.ts: o preço antigo fica para quem já assinou
    nickname: `${PLANOS[nivel].nome} ${PERIODOS[periodo].nome.toLowerCase()} (${forma === 'pix' ? 'Pix' : 'cartão'})`,
    ...(recorrente ? { recurring: { interval: 'month' as const, interval_count: 1 } } : {}),
    metadata: { nivel, periodo, forma },
  });
  precosEmCache.set(chave, novo.id);
  return novo.id;
}

const CHAVE_LANCAMENTO = 'orcai_lancamento_cartao';

/** Preço mensal da oferta de lançamento (mesma lógica de precoDaStripe). */
async function precoLancamento(): Promise<string> {
  const emCache = precosEmCache.get(CHAVE_LANCAMENTO);
  if (emCache) return emCache;
  const s = stripe();
  const { data } = await s.prices.list({ lookup_keys: [CHAVE_LANCAMENTO], active: true, limit: 1 });
  if (data[0] && data[0].unit_amount === OFERTA_LANCAMENTO.mensalCentavos) {
    precosEmCache.set(CHAVE_LANCAMENTO, data[0].id);
    return data[0].id;
  }
  const produto = `orcai_${OFERTA_LANCAMENTO.nivel}`;
  await s.products.create({ id: produto, name: `Orça.ai ${PLANOS[OFERTA_LANCAMENTO.nivel].nome}`, description: PLANOS[OFERTA_LANCAMENTO.nivel].resumo })
    .catch((e) => { if ((e as Stripe.errors.StripeError).code !== 'resource_already_exists') throw e; });
  const novo = await s.prices.create({
    product: produto,
    currency: 'brl',
    unit_amount: OFERTA_LANCAMENTO.mensalCentavos,
    lookup_key: CHAVE_LANCAMENTO,
    transfer_lookup_key: true,
    nickname: OFERTA_LANCAMENTO.nome,
    recurring: { interval: 'month', interval_count: 1 },
    metadata: { nivel: OFERTA_LANCAMENTO.nivel, periodo: 'lancamento', forma: 'cartao' },
  });
  precosEmCache.set(CHAVE_LANCAMENTO, novo.id);
  return novo.id;
}

async function cupomMesGratis(): Promise<string> {
  await stripe().coupons.create({ id: CUPOM_MES_GRATIS, name: '1 mês grátis (indicação)', percent_off: 100, duration: 'once' })
    .catch((e) => { if ((e as Stripe.errors.StripeError).code !== 'resource_already_exists') throw e; });
  return CUPOM_MES_GRATIS;
}

// ---------------- Cliente ----------------

/** Cliente Stripe da conta, criado na primeira vez com nome, e-mail e CPF. */
export async function clienteDoUsuario(userId: string): Promise<string> {
  const db = supabaseAdmin();
  const { data: existente } = await db.from('clientes_gateway').select('customer_id').eq('user_id', userId).eq('gateway', GATEWAY).maybeSingle();
  if (existente) return existente.customer_id;
  const { data: p } = await db.from('profiles').select('full_name, email, cpf').eq('id', userId).single();
  const novo = await stripe().customers.create({
    name: p?.full_name ?? undefined,
    email: p?.email ?? undefined,
    metadata: { user_id: userId },
    ...(p?.cpf ? { tax_id_data: [{ type: 'br_cpf' as const, value: p.cpf }] } : {}),
  }, { idempotencyKey: `cliente-${userId}` });
  const { error } = await db.from('clientes_gateway').insert({ user_id: userId, gateway: GATEWAY, customer_id: novo.id });
  if (error?.code === '23505') {
    // Outra aba criou ao mesmo tempo: fica o que foi gravado primeiro.
    const { data } = await db.from('clientes_gateway').select('customer_id').eq('user_id', userId).eq('gateway', GATEWAY).single();
    return data!.customer_id;
  }
  if (error) throw new Error(error.message);
  return novo.id;
}

async function usuarioDoCliente(customerId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from('clientes_gateway').select('user_id').eq('customer_id', customerId).maybeSingle();
  return data?.user_id ?? null;
}

// ---------------- Checkout ----------------

export class ErroAssinatura extends Error {}

/** Assinatura que ainda vale (ativa ou atrasada), para não cobrar duas vezes. */
async function assinaturaVigente(userId: string) {
  const { data } = await supabaseAdmin().from('subscriptions')
    .select('id, forma_pagamento, status, current_period_end, fidelidade_ate, cancela_em, gateway_subscription_id, plan, nivel, created_at')
    .eq('user_id', userId).eq('gateway', GATEWAY).in('status', ['ativa', 'atrasada'])
    .order('current_period_end', { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  if (data.forma_pagamento === 'pix' && data.current_period_end && new Date(data.current_period_end) < new Date()) return null;
  return data;
}

/** Abre o Checkout da Stripe para assinar. Devolve a URL para onde o site manda o usuário. */
export async function abrirCheckout(userId: string, nivel: Nivel, periodo: Periodo, forma: Forma): Promise<string> {
  cobranca(nivel, periodo, forma); // valida (Pix só no anual)
  const vigente = await assinaturaVigente(userId);
  if (vigente?.forma_pagamento === 'cartao' && !vigente.cancela_em) {
    throw new ErroAssinatura('Você já tem uma assinatura no cartão. Para trocar de plano, fale com o suporte.');
  }
  // Pix: renovar só no último mês do ano pago.
  if (vigente?.forma_pagamento === 'pix' && vigente.current_period_end
      && new Date(vigente.current_period_end).getTime() - Date.now() > 31 * 86400_000) {
    throw new ErroAssinatura(`Seu plano anual está pago até ${new Date(vigente.current_period_end).toLocaleDateString('pt-BR')}. A renovação abre 30 dias antes.`);
  }

  const customer = await clienteDoUsuario(userId);
  const price = await precoDaStripe(nivel, periodo, forma);
  const metadata = { user_id: userId, nivel, periodo, forma };
  const comum = {
    customer,
    locale: 'pt-BR' as const,
    line_items: [{ price, quantity: 1 }],
    metadata,
    success_url: `${config.appUrl}/app/conta?assinatura=ok`,
    cancel_url: `${config.appUrl}/assinar?nivel=${nivel}&plano=${periodo}`,
  };

  if (forma === 'pix') {
    const s = await stripe().checkout.sessions.create({
      ...comum,
      mode: 'payment',
      payment_method_types: ['pix'],
      payment_intent_data: { metadata, description: `Orça.ai ${PLANOS[nivel].nome} anual` },
    });
    return s.url!;
  }

  // Mês grátis de indicação já liberado: entra como desconto na primeira cobrança.
  const recompensa = await recompensaLiberada(userId);
  const s = await stripe().checkout.sessions.create({
    ...comum,
    mode: 'subscription',
    payment_method_types: ['card'],
    // A recompensa vira 'usada' quando a assinatura é criada (sincronizarAssinatura), não aqui: o Checkout pode ser abandonado.
    subscription_data: { metadata: recompensa ? { ...metadata, recompensa } : metadata },
    ...(recompensa ? { discounts: [{ coupon: await cupomMesGratis() }] } : {}),
  });
  return s.url!;
}

/**
 * Vagas da oferta de lançamento que ainda restam. Conta quem cadastrou o cartão e está no teste ou assinando;
 * quem desiste no teste (assinatura cancelada) devolve a vaga.
 */
export async function vagasDoLancamento(): Promise<number> {
  const { count, error } = await supabaseAdmin().from('subscriptions').select('id', { count: 'exact', head: true })
    .eq('plan', 'lancamento').in('status', ['ativa', 'atrasada', 'pendente']);
  if (error) throw new Error(error.message);
  return Math.max(0, OFERTA_LANCAMENTO.vagas - (count ?? 0));
}

/** Checkout da oferta de lançamento: cartão, 3 dias de teste e depois R$ 9,90 por mês. */
export async function abrirCheckoutLancamento(userId: string): Promise<string> {
  if (await vagasDoLancamento() <= 0) throw new ErroAssinatura('As vagas da oferta de lançamento acabaram. Veja os outros planos.');
  const db = supabaseAdmin();
  const { data: ja } = await db.from('subscriptions').select('id').eq('user_id', userId).eq('plan', 'lancamento').limit(1).maybeSingle();
  if (ja) throw new ErroAssinatura('A oferta de lançamento vale uma vez por conta.');
  if (await assinaturaVigente(userId)) throw new ErroAssinatura('Você já tem uma assinatura. Para trocar de plano, fale com o suporte.');
  const metadata = { user_id: userId, nivel: OFERTA_LANCAMENTO.nivel, periodo: 'lancamento', forma: 'cartao' };
  const s = await stripe().checkout.sessions.create({
    customer: await clienteDoUsuario(userId),
    mode: 'subscription',
    locale: 'pt-BR',
    payment_method_types: ['card'],
    payment_method_collection: 'always', // o cartão é exigido mesmo no teste
    line_items: [{ price: await precoLancamento(), quantity: 1 }],
    metadata,
    subscription_data: {
      metadata,
      trial_period_days: OFERTA_LANCAMENTO.diasTeste,
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
    },
    success_url: `${config.appUrl}/app/conta?assinatura=ok`,
    cancel_url: `${config.appUrl}/assinar`,
  });
  return s.url!;
}

/** Cadastra o cartão sem cobrar (libera o teste grátis). */
export async function abrirCadastroDeCartao(userId: string): Promise<string> {
  const s = await stripe().checkout.sessions.create({
    customer: await clienteDoUsuario(userId),
    mode: 'setup',
    locale: 'pt-BR',
    payment_method_types: ['card'],
    metadata: { user_id: userId },
    setup_intent_data: { metadata: { user_id: userId } },
    success_url: `${config.appUrl}/app?cartao=ok`,
    cancel_url: `${config.appUrl}/assinar`,
  });
  return s.url!;
}

/** Portal da Stripe: trocar cartão e ver faturas. O cancelamento é pelo app, por causa da fidelidade. */
export async function abrirPortal(userId: string): Promise<string> {
  const s = stripe();
  const { data } = await s.billingPortal.configurations.list({ active: true, limit: 100 });
  let configuracao = data.find((c) => c.metadata?.orcai === '1')?.id;
  if (!configuracao) {
    configuracao = (await s.billingPortal.configurations.create({
      business_profile: { headline: 'Orça.ai: cartão e faturas' },
      features: {
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true },
        customer_update: { enabled: false },
        subscription_cancel: { enabled: false },
      },
      metadata: { orcai: '1' },
    })).id;
  }
  const portal = await s.billingPortal.sessions.create({
    customer: await clienteDoUsuario(userId),
    configuration: configuracao,
    locale: 'pt-BR',
    return_url: `${config.appUrl}/app/conta`,
  });
  return portal.url;
}

/** Agenda o cancelamento da assinatura no cartão: vale no fim da fidelidade ou do mês já pago. */
export async function cancelarAssinatura(userId: string): Promise<{ cancelaEm: string }> {
  const vigente = await assinaturaVigente(userId);
  // Pix anual nos 7 primeiros dias: estorna o pagamento e encerra.
  if (vigente?.forma_pagamento === 'pix' && vigente.gateway_subscription_id && dentroDoArrependimento(new Date(vigente.created_at))) {
    const sessao = await stripe().checkout.sessions.retrieve(vigente.gateway_subscription_id);
    if (sessao.payment_intent) {
      await stripe().refunds.create({ payment_intent: String(sessao.payment_intent) }, { idempotencyKey: `arrependimento-${sessao.id}` });
    }
    await supabaseAdmin().from('subscriptions').update({ status: 'cancelada', cancela_em: new Date().toISOString() }).eq('id', vigente.id);
    return { cancelaEm: new Date().toISOString() };
  }
  if (!vigente || vigente.forma_pagamento !== 'cartao' || !vigente.gateway_subscription_id) {
    throw new ErroAssinatura('Não há assinatura no cartão para cancelar. O plano anual no Pix simplesmente não renova.');
  }
  // Arrependimento (7 primeiros dias, inclui o teste): cancela agora e devolve o que foi pago.
  const atual = await stripe().subscriptions.retrieve(vigente.gateway_subscription_id);
  if (dentroDoArrependimento(new Date(atual.start_date * 1000))) {
    await stripe().subscriptions.cancel(atual.id);
    const customer = typeof atual.customer === 'string' ? atual.customer : atual.customer.id;
    const { data: cobrancas } = await stripe().charges.list({ customer, created: { gte: atual.start_date }, limit: 20 });
    for (const c of cobrancas) {
      if (c.paid && !c.refunded) await stripe().refunds.create({ charge: c.id }, { idempotencyKey: `arrependimento-${c.id}` });
    }
    await sincronizarAssinatura(atual.id);
    return { cancelaEm: new Date().toISOString() };
  }
  const quando = dataDoCancelamento(
    vigente.fidelidade_ate ? new Date(vigente.fidelidade_ate) : null,
    vigente.current_period_end ? new Date(vigente.current_period_end) : null,
  );
  await stripe().subscriptions.update(vigente.gateway_subscription_id, { cancel_at: Math.ceil(quando.getTime() / 1000) });
  await sincronizarAssinatura(vigente.gateway_subscription_id);
  return { cancelaEm: quando.toISOString() };
}

// ---------------- Webhook ----------------

/** Confere a assinatura do evento com STRIPE_WEBHOOK_SECRET. Lança erro se não for da Stripe. */
export function lerEvento(corpo: Buffer, assinatura: string): Stripe.Event {
  if (!config.stripe.webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET não configurado no .env');
  return stripe().webhooks.constructEvent(corpo, assinatura, config.stripe.webhookSecret);
}

/** Aplica o evento no banco. Tudo aqui pode rodar duas vezes sem efeito a mais (a Stripe reenvia). */
export async function tratarEvento(evento: Stripe.Event): Promise<void> {
  switch (evento.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const sessao = evento.data.object;
      if (sessao.mode === 'setup') return gravarCartaoDoSetup(sessao);
      if (sessao.mode === 'payment' && sessao.payment_status === 'paid') return ativarPix(sessao);
      if (sessao.mode === 'subscription' && sessao.subscription) return sincronizarAssinatura(String(sessao.subscription));
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return sincronizarAssinatura(evento.data.object.id);
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      // `parent` é das versões novas da API; `subscription` direto, das antigas (versão escolhida no webhook).
      const fatura = evento.data.object as Stripe.Invoice & { subscription?: string | { id: string } | null };
      const id = fatura.parent?.subscription_details?.subscription ?? fatura.subscription;
      if (id) return sincronizarAssinatura(typeof id === 'string' ? id : id.id);
      return;
    }
    default:
      return;
  }
}

/** Grava (ou atualiza) o cartão em `cartoes`: só token, bandeira, 4 últimos e validade. */
async function gravarCartao(userId: string, customerId: string, pm: Stripe.PaymentMethod | string | null) {
  if (!pm) return;
  const metodo = typeof pm === 'string' ? await stripe().paymentMethods.retrieve(pm) : pm;
  if (!metodo.card) return;
  const db = supabaseAdmin();
  const linha = {
    user_id: userId,
    gateway: GATEWAY,
    gateway_customer_id: customerId,
    gateway_cartao_token: metodo.id,
    bandeira: metodo.card.brand,
    ultimos4: metodo.card.last4,
    validade_mes: metodo.card.exp_month,
    validade_ano: metodo.card.exp_year,
    verificado_em: new Date().toISOString(),
    principal: true,
  };
  const { data: existente } = await db.from('cartoes').select('id').eq('gateway', GATEWAY).eq('gateway_cartao_token', metodo.id).maybeSingle();
  if (existente) return; // já gravado (evento repetido)
  await db.from('cartoes').update({ principal: false }).eq('user_id', userId).is('removido_em', null);
  const { error } = await db.from('cartoes').insert(linha);
  if (error && error.code !== '23505') throw new Error(`Falha ao gravar o cartão: ${error.message}`);
}

async function gravarCartaoDoSetup(sessao: Stripe.Checkout.Session) {
  const userId = sessao.metadata?.user_id;
  if (!userId || !sessao.setup_intent || !sessao.customer) return;
  const intent = await stripe().setupIntents.retrieve(String(sessao.setup_intent));
  await gravarCartao(userId, String(sessao.customer), intent.payment_method as string | Stripe.PaymentMethod | null);
}

/** Plano anual pago no Pix: 12 meses a partir de hoje ou do fim do ano já pago (renovação antecipada). */
async function ativarPix(sessao: Stripe.Checkout.Session) {
  const m = sessao.metadata ?? {};
  const userId = m.user_id;
  if (!userId || m.forma !== 'pix') return;
  const db = supabaseAdmin();
  const { data: jaGravado } = await db.from('subscriptions').select('id').eq('gateway_subscription_id', sessao.id).maybeSingle();
  if (jaGravado) return;

  const { data: anterior } = await db.from('subscriptions').select('current_period_end')
    .eq('user_id', userId).eq('status', 'ativa').eq('forma_pagamento', 'pix')
    .order('current_period_end', { ascending: false }).limit(1).maybeSingle();
  const inicio = anterior?.current_period_end && new Date(anterior.current_period_end) > new Date()
    ? new Date(anterior.current_period_end) : new Date();
  // Mês grátis de indicação já liberado: estica o ano pago.
  const recompensa = await recompensaLiberada(userId);
  const fim = somarMeses(inicio, 12 + (recompensa ? 1 : 0));

  const { error } = await db.from('subscriptions').insert({
    user_id: userId,
    plan: 'anual',
    nivel: m.nivel === 'pro' ? 'pro' : 'usuario',
    status: 'ativa',
    gateway: GATEWAY,
    gateway_customer_id: sessao.customer ? String(sessao.customer) : null,
    gateway_subscription_id: sessao.id,
    forma_pagamento: 'pix',
    current_period_end: fim.toISOString(),
    fidelidade_ate: fim.toISOString(),
  });
  if (error?.code === '23505') return; // evento repetido
  if (error) throw new Error(`Falha ao ativar o Pix: ${error.message}`);
  if (recompensa) await marcarRecompensaUsada(recompensa);
  await aposAtivar(userId, !anterior);
}

/**
 * Espelha a assinatura do cartão em `subscriptions` (status, mês pago, fidelidade e cancelamento).
 * Sempre relê na API: o formato do evento depende da versão escolhida no webhook, e o estado atual vence o do evento.
 */
export async function sincronizarAssinatura(id: string) {
  const sub = await stripe().subscriptions.retrieve(id);
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const userId = sub.metadata?.user_id || await usuarioDoCliente(customerId);
  if (!userId) return;
  const lancamento = sub.metadata?.periodo === 'lancamento';
  const periodo = (['trimestral', 'semestral', 'anual'] as const).find((p) => p === sub.metadata?.periodo) ?? 'trimestral';
  // Fidelidade conta a partir do fim do teste (oferta de lançamento: 12 meses pagos).
  const inicioPago = new Date((sub.trial_end ?? sub.start_date) * 1000);
  const mesesFidelidade = lancamento ? OFERTA_LANCAMENTO.fidelidadeMeses : PERIODOS[periodo].meses;
  const nivel = sub.metadata?.nivel === 'pro' ? 'pro' : 'usuario';
  const fimDoMes = sub.items.data[0]?.current_period_end;
  const status = statusDaStripe(sub.status);
  const db = supabaseAdmin();
  const { data: antes } = await db.from('subscriptions').select('status').eq('gateway_subscription_id', sub.id).maybeSingle();

  const { error } = await db.from('subscriptions').upsert({
    user_id: userId,
    plan: lancamento ? 'lancamento' : periodo,
    nivel,
    status,
    gateway: GATEWAY,
    gateway_customer_id: customerId,
    gateway_subscription_id: sub.id,
    forma_pagamento: 'cartao',
    current_period_end: fimDoMes ? new Date(fimDoMes * 1000).toISOString() : null,
    fidelidade_ate: somarMeses(inicioPago, mesesFidelidade).toISOString(),
    cancela_em: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString()
      : sub.cancel_at_period_end && fimDoMes ? new Date(fimDoMes * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'gateway_subscription_id' });
  if (error) throw new Error(`Falha ao gravar a assinatura: ${error.message}`);

  await gravarCartao(userId, customerId, sub.default_payment_method as string | Stripe.PaymentMethod | null);
  if (sub.metadata?.recompensa) await marcarRecompensaUsada(sub.metadata.recompensa);
  if (status === 'ativa' && antes?.status !== 'ativa') await aposAtivar(userId, !antes);
  // A cada mensalidade paga, o próximo mês grátis guardado (se houver) entra na mensalidade seguinte.
  else if (status === 'ativa') await entregarRecompensas(userId).catch((e) => console.error('Indicação:', e));
}

// ---------------- Indicação: 1 mês grátis ----------------

async function recompensaLiberada(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from('recompensas_indicacao').select('id')
    .eq('indicador', userId).eq('status', 'liberada').order('liberada_em').limit(1).maybeSingle();
  return data?.id ?? null;
}

async function marcarRecompensaUsada(id: string) {
  await supabaseAdmin().from('recompensas_indicacao').update({ status: 'usada', usada_em: new Date().toISOString() })
    .eq('id', id).eq('status', 'liberada');
}

/**
 * Entrega o mês grátis a quem indicou, se já tem assinatura: no cartão, um cupom de 100% na próxima
 * mensalidade (um de cada vez); no Pix, um mês a mais no ano pago. Sem assinatura, fica guardado
 * e entra quando ele assinar (abrirCheckout / ativarPix).
 */
export async function entregarRecompensas(indicador: string) {
  const recompensa = await recompensaLiberada(indicador);
  if (!recompensa) return;
  const vigente = await assinaturaVigente(indicador);
  if (!vigente || vigente.status !== 'ativa') return;
  if (vigente.forma_pagamento === 'pix' && vigente.current_period_end) {
    await supabaseAdmin().from('subscriptions')
      .update({ current_period_end: somarMeses(new Date(vigente.current_period_end), 1).toISOString() }).eq('id', vigente.id);
    return marcarRecompensaUsada(recompensa);
  }
  if (vigente.forma_pagamento === 'cartao' && vigente.gateway_subscription_id) {
    const sub = await stripe().subscriptions.retrieve(vigente.gateway_subscription_id);
    if (sub.discounts?.length) return; // ainda há um mês grátis para descontar
    await stripe().subscriptions.update(sub.id, { discounts: [{ coupon: await cupomMesGratis() }] });
    return marcarRecompensaUsada(recompensa);
  }
}

/** Depois de ativar: entrega meses grátis pendentes (do próprio e de quem o indicou) e dá boas-vindas. */
async function aposAtivar(userId: string, primeiraVez: boolean) {
  const db = supabaseAdmin();
  const { data: p } = await db.from('profiles').select('indicado_por, whatsapp_e164, whatsapp_verified_at, full_name, nome').eq('id', userId).single();
  await entregarRecompensas(userId).catch((e) => console.error('Indicação:', e));
  if (p?.indicado_por) await entregarRecompensas(p.indicado_por).catch((e) => console.error('Indicação:', e));
  if (primeiraVez && p?.whatsapp_e164 && p.whatsapp_verified_at) {
    const nome = p.nome?.trim() || (p.full_name ?? '').trim().split(/\s+/)[0];
    await enviarTexto(p.whatsapp_e164, `${nome ? `${nome}, sua` : 'Sua'} assinatura do ${config.marca} está ativa. É só mandar aqui o cálculo que você precisa.`)
      .catch((e) => console.error('Boas-vindas no WhatsApp:', e));
  }
}
