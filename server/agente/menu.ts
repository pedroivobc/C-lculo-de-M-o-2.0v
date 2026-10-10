import { brl, custosDoCalculo, type Custos, type CustosPadrao, type TipoCalculo } from '../../src/lib/calc';
import { anoBaseIncc } from '../../src/lib/calc/correcao';

/**
 * Conversa do WhatsApp por menus numerados: o corretor escolhe opções (1, 2, 3…) e responde
 * uma pergunta por vez. Feito para quem nunca usou o serviço conseguir orçar sem errar.
 *
 * Este módulo é puro: recebe o estado e a mensagem e devolve o novo estado, as mensagens e,
 * quando chega a hora, a ação (calcular, reenviar, detalhar). Quem executa é ./conversa.ts.
 */

export type FormatoEntrega = 'jpeg' | 'pdf' | 'texto';

/** vai: id de menu, 'fluxo:<id>' ou uma ação ('reenviar', 'detalhar', 'atendente'). descricao: linha de apoio nos botões/lista. */
interface Opcao { rotulo: string; vai: string; descricao?: string }
interface Menu { titulo: string; opcoes: Opcao[]; voltar?: string }

type TipoPergunta = 'valor' | 'valorOuZero' | 'ano' | 'simnao';
interface Pergunta {
  campo: string; titulo: string; texto: string; tipo: TipoPergunta;
  maximo?: { campo: string; erro: string };
  /** Aceita também a cota em % deste campo (ex.: 80% do valor do imóvel). */
  cotaDe?: string;
}
interface Fluxo { titulo: string; calculo: TipoCalculo; fixos: Record<string, unknown>; perguntas: Pergunta[] }

const BANCOS = { itau: 'Itaú', bradesco: 'Bradesco', santander: 'Santander' } as const;

const IMOVEL: Pergunta = { campo: 'valorDeclarado', titulo: 'Valor do imóvel', texto: 'Qual é o valor do imóvel?', tipo: 'valor' };
const FINANCIADO: Pergunta = {
  campo: 'valorFinanciado', titulo: 'Valor financiado', texto: 'Quanto vai ser financiado?', tipo: 'valor', cotaDe: 'valorDeclarado',
  maximo: { campo: 'valorDeclarado', erro: 'O valor financiado não pode ser maior que o valor do imóvel.' },
};
const PRIMEIRO: Pergunta = { campo: 'primeiroImovel', titulo: 'Primeiro imóvel', texto: 'É o primeiro imóvel do comprador?', tipo: 'simnao' };
const DOACAO: Pergunta[] = [
  { campo: 'valorAtribuido', titulo: 'Valor do imóvel', texto: 'Qual é o valor do imóvel na doação?', tipo: 'valor' },
  { campo: 'avaliacaoFazenda', titulo: 'Avaliação da Fazenda', texto: 'Qual é a avaliação da Fazenda (ITCD)?\nSe ainda não tem, responda *não sei*.', tipo: 'valorOuZero' },
];

export const FLUXOS: Record<string, Fluxo> = {
  cv_simples: { titulo: 'Compra e venda simples', calculo: 'escritura', fixos: { subtipo: 'compra_venda_simples' }, perguntas: [IMOVEL] },
  cv_vinculo: {
    titulo: 'Compra e venda com vínculo', calculo: 'escritura', fixos: { subtipo: 'compra_vinculo' },
    perguntas: [
      { campo: 'valorDeclaradoCompra', titulo: 'Valor da compra', texto: 'Qual é o valor da compra?', tipo: 'valor' },
      { campo: 'valorVinculo', titulo: 'Valor do vínculo', texto: 'Qual é o valor do vínculo?', tipo: 'valor' },
    ],
  },
  cv_interveniencia: {
    titulo: 'Compra e venda com interveniência', calculo: 'escritura', fixos: { subtipo: 'interveniencia' },
    perguntas: [
      { campo: 'valorDeclarado1', titulo: 'Valor do 1º ato', texto: 'Qual é o valor do 1º ato?', tipo: 'valor' },
      { campo: 'valorDeclarado2', titulo: 'Valor do 2º ato', texto: 'Qual é o valor do 2º ato?', tipo: 'valor' },
    ],
  },
  doacao_simples: { titulo: 'Doação simples', calculo: 'doacao', fixos: { subtipo: 'doacao_simples' }, perguntas: DOACAO },
  doacao_usufruto: { titulo: 'Doação com usufruto', calculo: 'doacao', fixos: { subtipo: 'doacao_usufruto' }, perguntas: DOACAO },
  renuncia: { titulo: 'Renúncia de usufruto', calculo: 'doacao', fixos: { subtipo: 'renuncia_usufruto' }, perguntas: DOACAO },
  caixa_sbpe: { titulo: 'Caixa · SBPE', calculo: 'financiamento_caixa', fixos: { modalidade: 'SBPE' }, perguntas: [IMOVEL, FINANCIADO, PRIMEIRO] },
  caixa_mcmv: { titulo: 'Caixa · Minha Casa Minha Vida', calculo: 'financiamento_caixa', fixos: { modalidade: 'MCMV' }, perguntas: [IMOVEL, FINANCIADO] },
  caixa_sfi: { titulo: 'Caixa · SFI', calculo: 'financiamento_caixa', fixos: { modalidade: 'SFI' }, perguntas: [IMOVEL, FINANCIADO] },
  caixa_fgts: { titulo: 'Caixa · FGTS', calculo: 'financiamento_caixa', fixos: { modalidade: 'FGTS', valorFinanciado: 0 }, perguntas: [IMOVEL] },
  caixa_egi: {
    titulo: 'Caixa · Home equity', calculo: 'financiamento_caixa', fixos: { modalidade: 'EGI' },
    perguntas: [IMOVEL, { ...FINANCIADO, titulo: 'Valor do empréstimo', texto: 'Qual é o valor do empréstimo?', maximo: { campo: 'valorDeclarado', erro: 'O empréstimo não pode ser maior que o valor do imóvel.' } }],
  },
  ...Object.fromEntries((['itau', 'bradesco', 'santander'] as const).flatMap((banco) => [
    [`${banco}_sbpe`, { titulo: `${BANCOS[banco]} · SBPE`, calculo: 'banco_privado', fixos: { banco, modalidade: 'SBPE' }, perguntas: [IMOVEL, FINANCIADO, PRIMEIRO] }],
    [`${banco}_sfi`, { titulo: `${BANCOS[banco]} · SFI`, calculo: 'banco_privado', fixos: { banco, modalidade: 'SFI' }, perguntas: [IMOVEL, FINANCIADO] }],
  ])),
  correcao: {
    titulo: 'Atualizar valor de contrato', calculo: 'correcao', fixos: {},
    perguntas: [
      { campo: 'valorOriginal', titulo: 'Valor do contrato', texto: 'Qual é o valor que está no contrato?', tipo: 'valor' },
      { campo: 'anoContrato', titulo: 'Ano do contrato', texto: 'Em que ano o contrato foi assinado?\nEx.: 2015', tipo: 'ano' },
    ],
  },
};

export const MENUS: Record<string, Menu> = {
  inicio: {
    titulo: 'Qual tipo de cálculo iremos fazer hoje?',
    opcoes: [
      { rotulo: 'Compra e venda', vai: 'compra_venda' },
      { rotulo: 'Financiamento', vai: 'financiamento' },
      { rotulo: 'Doação', vai: 'doacao' },
      { rotulo: 'Correção contratual', vai: 'fluxo:correcao' },
    ],
  },
  compra_venda: {
    titulo: '*Compra e venda*\nQual é o tipo?', voltar: 'inicio',
    opcoes: [
      { rotulo: 'Compra e venda simples', vai: 'fluxo:cv_simples' },
      { rotulo: 'Compra e venda com vínculo', vai: 'fluxo:cv_vinculo' },
      { rotulo: 'Compra e venda com interveniência', vai: 'fluxo:cv_interveniencia' },
    ],
  },
  doacao: {
    titulo: '*Doação*\nQual é o tipo?', voltar: 'inicio',
    opcoes: [
      { rotulo: 'Doação simples', vai: 'fluxo:doacao_simples' },
      { rotulo: 'Doação com usufruto', vai: 'fluxo:doacao_usufruto' },
      { rotulo: 'Renúncia de usufruto', vai: 'fluxo:renuncia' },
    ],
  },
  financiamento: {
    titulo: '*Financiamento*\nQual é o banco?', voltar: 'inicio',
    opcoes: [
      { rotulo: 'Caixa', vai: 'caixa' },
      { rotulo: 'Itaú', vai: 'itau' },
      { rotulo: 'Bradesco', vai: 'bradesco' },
      { rotulo: 'Santander', vai: 'santander' },
    ],
  },
  caixa: {
    titulo: '*Caixa*\nQual é a modalidade?', voltar: 'financiamento',
    opcoes: [
      { rotulo: 'SBPE', descricao: 'Financiamento comum', vai: 'fluxo:caixa_sbpe' },
      { rotulo: 'Minha Casa Minha Vida', vai: 'fluxo:caixa_mcmv' },
      { rotulo: 'SFI', vai: 'fluxo:caixa_sfi' },
      { rotulo: 'FGTS', vai: 'fluxo:caixa_fgts' },
      { rotulo: 'Home equity', descricao: 'Empréstimo com o imóvel de garantia', vai: 'fluxo:caixa_egi' },
    ],
  },
  ...Object.fromEntries(Object.entries(BANCOS).map(([id, nome]) => [id, {
    titulo: `*${nome}*\nQual é a modalidade?`, voltar: 'financiamento',
    opcoes: [
      { rotulo: 'SBPE', descricao: 'Financiamento comum', vai: `fluxo:${id}_sbpe` },
      { rotulo: 'SFI', vai: `fluxo:${id}_sfi` },
    ],
  }])),
  depois: {
    titulo: 'Quer fazer mais alguma coisa?', voltar: 'inicio',
    opcoes: [
      { rotulo: 'Fazer outro orçamento', vai: 'inicio' },
      { rotulo: 'Receber em outro formato', vai: 'reenviar' },
      { rotulo: 'Ver os valores detalhados', vai: 'detalhar' },
      { rotulo: 'Falar com um atendente', vai: 'atendente' },
    ],
  },
};

const FORMATOS: { id: FormatoEntrega; rotulo: string }[] = [
  { id: 'jpeg', rotulo: 'Imagem (foto)' },
  { id: 'pdf', rotulo: 'PDF' },
  { id: 'texto', rotulo: 'Mensagem escrita' },
];

// ---------------- Estado ----------------

export type Tela =
  | { tela: 'menu'; id: string }
  | { tela: 'pergunta'; fluxo: string; i: number; dados: Record<string, unknown>; origem: string }
  /** Pergunta se o corretor quer o endereço do imóvel no orçamento e, se sim, pede o texto. */
  | { tela: 'endereco'; etapa: 'pergunta' | 'digitar'; fluxo: string; dados: Record<string, unknown>; origem: string }
  | { tela: 'formato'; fluxo?: string; dados?: Record<string, unknown>; origem?: string; reenvio?: boolean; endereco?: string }
  /** Conversa passada para uma pessoa (Chatwoot): o robô fica quieto até o corretor escrever "menu". */
  | { tela: 'atendente'; desde: string }
  /** Conversa livre com a IA (pedido por extenso ou áudio): as respostas seguintes também vão para ela até "menu". */
  | { tela: 'ia' };

export type Estado = Tela & {
  /** Número (seq) do último orçamento feito nesta conversa. */
  ultimo?: number;
  /** Certidões/honorários trocados pelo corretor só para o próximo orçamento ("honorarios 900"). */
  custos?: Partial<Custos>;
};

/**
 * `texto` é a mensagem completa com as opções numeradas (funciona em qualquer WhatsApp).
 * `corpo` é o mesmo texto sem a lista, para quando as opções vão como botões ou lista (./whatsapp.ts).
 */
export interface MensagemMenu { texto: string; corpo?: string; opcoes?: { id: string; titulo: string; descricao?: string }[] }

export type Acao =
  | { tipo: 'calcular'; calculo: TipoCalculo; dados: Record<string, unknown>; formato: FormatoEntrega; titulo: string; endereco?: string }
  | { tipo: 'reenviar'; seq: number; formato: FormatoEntrega }
  | { tipo: 'detalhar'; seq: number }
  /** Texto livre no menu inicial (ex.: "escritura de 350 mil"): vai para o agente com IA, se houver. */
  | { tipo: 'livre' }
  /** Pediu para falar com uma pessoa: avisa a equipe no Chatwoot. */
  | { tipo: 'atendente' };

export interface Passo { estado: Estado; mensagens: MensagemMenu[]; acao?: Acao }

export interface ContextoMenu {
  nome?: string | null;
  formatoPadrao: FormatoEntrega;
  temAnexo?: boolean;
  /** Certidões e honorários padrão do assinante (null = valores sugeridos pelo sistema). */
  custosPadrao?: CustosPadrao | null;
  /** Município do assinante: define, por exemplo, se a correção contratual aparece. */
  municipio?: string;
}

// ---------------- Leitura do que a pessoa digitou ----------------

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const PALAVRAS_INICIO = ['menu', 'inicio', 'oi', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'comecar', 'cancelar', 'sair', 'reiniciar'];
const PALAVRAS_VOLTAR = ['0', 'voltar', 'volta', 'anterior'];

/** Número da opção: "2", "2)", "2️⃣", "opção 2". Devolve null quando não é uma escolha. */
export function lerOpcao(texto: string, opcoes: string[]): number | null {
  const t = semAcento(texto).replace(/[️⃣]/g, '');
  const m = t.match(/^(?:opcao\s*)?(\d{1,2})\s*[).\-]?$/);
  if (m) return Number(m[1]);
  // Também aceita o nome da opção escrito ("escritura", "caixa"), desde que aponte para uma opção só.
  if (t.length < 3) return null;
  const exata = opcoes.findIndex((o) => semAcento(o) === t);
  if (exata >= 0) return exata + 1;
  const comeco = opcoes.map((o, i) => (semAcento(o).startsWith(t) ? i : -1)).filter((i) => i >= 0);
  return comeco.length === 1 ? comeco[0] + 1 : null;
}

/** Valor em reais: "350000", "350.000,00", "R$ 350 mil", "1,2 milhão", "350k". */
export function lerValor(texto: string): number | null {
  const t = semAcento(texto).replace(/r\$|reais/g, '').trim();
  const num = t.match(/\d[\d.,]*/)?.[0];
  if (!num) return null;
  const resto = t.slice(t.indexOf(num) + num.length);
  const mult = /^\s*(mi\b|milh)/.test(resto) ? 1e6 : /^\s*(mil\b|k\b)/.test(resto) ? 1e3 : 1;
  let n: number;
  if (mult > 1) n = Number(num.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  else if (num.includes(',')) n = Number(num.replace(/\./g, '').replace(',', '.'));
  else if (/^\d{1,3}(\.\d{3})+$/.test(num)) n = Number(num.replace(/\./g, ''));
  else n = Number(num);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * mult * 100) / 100;
}

/**
 * Cota em % de uma base: "80%", "80 %", "80" ou "80,5" (até 100 sem o símbolo, já que ninguém financia R$ 80).
 * Devolve null quando a resposta é um valor em reais.
 */
export function lerCota(texto: string, base: number): { pct: number; valor: number } | null {
  const t = semAcento(texto).replace(/\s+/g, ' ').trim();
  if (!base) return null;
  const comSimbolo = t.match(/^(\d{1,3}(?:[.,]\d{1,2})?)\s*(%|por cento)$/);
  const semSimbolo = t.match(/^(\d{1,3}(?:[.,]\d{1,2})?)$/);
  const bruto = comSimbolo?.[1] ?? (semSimbolo && Number(semSimbolo[1].replace(',', '.')) <= 100 ? semSimbolo[1] : null);
  if (!bruto) return null;
  const pct = Number(bruto.replace(',', '.'));
  if (!(pct > 0)) return null;
  return { pct, valor: Math.round(base * pct) / 100 };
}

function lerSimNao(texto: string): boolean | null {
  const t = semAcento(texto).replace(/[️⃣]/g, '');
  if (['1', 'sim', 's', 'si', 'isso', 'e sim'].includes(t)) return true;
  if (['2', 'nao', 'n', 'não'].includes(t)) return false;
  return null;
}

// ---------------- Mensagens ----------------

const NUM = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
const VOLTAR = `${NUM[0]} Voltar ao menu anterior`;

type Rotulo = string | { rotulo: string; descricao?: string };

function mensagemMenu(titulo: string, rotulos: Rotulo[], comVoltar: boolean, prefixo = ''): MensagemMenu {
  const itens = rotulos.map((r) => (typeof r === 'string' ? { rotulo: r } : r));
  const linhas = itens.map((r, i) => `${NUM[i + 1]} ${r.rotulo}${r.descricao ? ` · ${r.descricao[0].toLowerCase()}${r.descricao.slice(1)}` : ''}`);
  return {
    texto: `${prefixo}${titulo}\n\n${linhas.join('\n')}${comVoltar ? `\n\n${VOLTAR}` : ''}\n\n_Responda com o número da opção._`,
    corpo: `${prefixo}${titulo}`,
    opcoes: [...itens.map((r, i) => ({ id: String(i + 1), titulo: r.rotulo, descricao: r.descricao })), ...(comVoltar ? [{ id: '0', titulo: 'Voltar' }] : [])],
  };
}

/** Correção contratual (INCC) só aparece para quem atua em Juiz de Fora. */
export const MUNICIPIO_CORRECAO = 'mg-juiz-de-fora';

/** O menu como esta pessoa vê: no inicial, a correção contratual só para Juiz de Fora. */
export function menuDe(id: string, ctx?: ContextoMenu): Menu {
  const m = MENUS[id] ?? MENUS.inicio; // sessão salva com um menu que não existe mais
  if (!MENUS[id]) return menuDe('inicio', ctx);
  if (id !== 'inicio' || ctx?.municipio === MUNICIPIO_CORRECAO) return m;
  return { ...m, opcoes: m.opcoes.filter((o) => o.vai !== 'fluxo:correcao') };
}

const telaMenu = (id: string, prefixo = '', ctx?: ContextoMenu) => {
  const m = menuDe(id, ctx);
  return mensagemMenu(m.titulo, m.opcoes.map((o) => ({ rotulo: o.rotulo, descricao: o.descricao })), !!m.voltar, prefixo);
};

function telaPergunta(f: Fluxo, i: number, prefixo = '', dados: Record<string, unknown> = {}): MensagemMenu {
  const p = f.perguntas[i];
  const passo = f.perguntas.length > 1 ? ` (${i + 1} de ${f.perguntas.length})` : '';
  if (p.tipo === 'simnao') return mensagemMenu(`*${p.titulo}*${passo}\n${p.texto}`, ['Sim', 'Não'], true, prefixo);
  const base = p.cotaDe ? Number(dados[p.cotaDe]) : 0;
  const exemplo = p.tipo === 'ano' ? ''
    : base ? `\nDigite o valor ou a cota em %.\n_Ex.: ${Math.round(base * 0.8)} ou 80% (= ${brl(Math.round(base * 0.8 * 100) / 100)})_`
    : '\n_Pode digitar só os números: 350000 vira R$ 350.000,00_';
  const pergunta = `${prefixo}*${p.titulo}*${passo}\n${p.texto}${exemplo}`;
  return { texto: `${pergunta}\n\n${VOLTAR}`, corpo: pergunta, opcoes: [{ id: '0', titulo: 'Voltar' }] };
}

/** Resposta já entendida, como o corretor vai vê-la: R$ 350.000,00, Sim, 2015. */
function comoTexto(p: Pergunta, valor: unknown): string {
  if (p.tipo === 'simnao') return valor ? 'Sim' : 'Não';
  if (p.tipo === 'ano') return String(valor);
  if (p.tipo === 'valorOuZero' && valor === 0) return 'ainda não tem';
  return brl(Number(valor));
}

/** Certidões e honorários que vão entrar no orçamento em andamento. */
function custosEmUso(e: Estado, ctx: ContextoMenu): Custos | null {
  if (e.tela === 'menu' || e.tela === 'atendente' || e.tela === 'ia') return null;
  if (e.tela === 'formato' && (e.reenvio || !e.fluxo)) return null;
  const f = FLUXOS[e.fluxo!];
  const base = custosDoCalculo(f.calculo, ctx.custosPadrao ?? null, e.dados ?? {});
  return base && { ...base, ...e.custos };
}

function telaFormato(ctx: ContextoMenu, e?: Estado, prefixo = ''): MensagemMenu {
  const c = e ? custosEmUso(e, ctx) : null;
  const custos = c ? `Certidões: *${brl(c.certidoes)}*\nHonorários: *${brl(c.honorarios)}*\n_Para mudar só neste orçamento, escreva_ *honorarios 900* _ou_ *certidoes 350*\n\n` : '';
  return mensagemMenu(`${custos}*Como você quer receber o orçamento?*`, FORMATOS.map((f) => ({ rotulo: f.rotulo, descricao: f.id === ctx.formatoPadrao ? 'Seu padrão' : undefined })), true, prefixo);
}

/** Boas-vindas de toda conversa nova: "Olá, Pedro! 👋 Qual tipo de cálculo iremos fazer hoje?" */
const saudacao = (nome?: string | null) => `Olá${nome ? `, ${nome}` : ''}! 👋 `;

// ---------------- Transições ----------------

const EXEMPLO_ENDERECO = 'Rua Halfeld, 100, apto 201 · Centro';

function telaEndereco(etapa: 'pergunta' | 'digitar', prefixo = ''): MensagemMenu {
  if (etapa === 'pergunta') return mensagemMenu('*Endereço do imóvel*\nQuer colocar o endereço do imóvel no orçamento?', ['Sim', 'Não'], true, prefixo);
  const pergunta = `${prefixo}*Endereço do imóvel*\nDigite o endereço como quer que apareça no orçamento.\n_Ex.: ${EXEMPLO_ENDERECO}_`;
  return { texto: `${pergunta}\n\n${VOLTAR}`, corpo: pergunta, opcoes: [{ id: '0', titulo: 'Voltar' }] };
}

/** Re-mostra a tela atual (usado quando a resposta não foi entendida). */
export function telaAtual(e: Estado, ctx: ContextoMenu, prefixo = ''): MensagemMenu {
  if (e.tela === 'atendente' || e.tela === 'ia') return telaMenu('inicio', prefixo, ctx);
  if (e.tela === 'menu') return telaMenu(e.id, prefixo, ctx);
  if (e.tela === 'pergunta') return telaPergunta(FLUXOS[e.fluxo], e.i, prefixo, e.dados);
  if (e.tela === 'endereco') return telaEndereco(e.etapa, prefixo);
  return telaFormato(ctx, e, prefixo);
}

const NAO_ENTENDI = 'Não entendi 🙂 Responda só com o *número* de uma opção.\n\n';

function irPara(destino: string, origem: string, ultimo: number | undefined, ctx: ContextoMenu): Passo {
  if (destino.startsWith('fluxo:')) {
    const fluxo = destino.slice(6);
    const f = FLUXOS[fluxo];
    return { estado: { tela: 'pergunta', fluxo, i: 0, dados: { ...f.fixos }, origem, ultimo }, mensagens: [telaPergunta(f, 0, `*${f.titulo}*\n\n`)] };
  }
  return { estado: { tela: 'menu', id: destino, ultimo }, mensagens: [telaMenu(destino, '', ctx)] };
}

const PALAVRAS_ATENDENTE = /^(atendente|atendimento|humano|pessoa|falar com (um |uma )?(atendente|pessoa|humano))$/;
export const TEXTO_ATENDENTE = 'Certo! Vou chamar alguém da nossa equipe para falar com você por aqui. 🙋\n\n_Quando quiser voltar aos orçamentos automáticos, escreva_ *menu*.';

function passoDoMenu(estado: Estado | null, texto: string, ctx: ContextoMenu): Passo {
  const t = semAcento(texto ?? '');
  const ultimo = estado?.ultimo;

  // Com uma pessoa atendendo, o robô não responde nada; só "menu" devolve a conversa a ele.
  if (estado?.tela === 'atendente') {
    if (t !== 'menu') return { estado, mensagens: [] };
    return { estado: { tela: 'menu', id: 'inicio', ultimo }, mensagens: [telaMenu('inicio', saudacao(ctx.nome), ctx)] };
  }
  if (PALAVRAS_ATENDENTE.test(t)) {
    return { estado: { tela: 'atendente', desde: new Date().toISOString(), ultimo }, mensagens: [{ texto: TEXTO_ATENDENTE }], acao: { tipo: 'atendente' } };
  }

  if (!estado || PALAVRAS_INICIO.some((p) => t === p || t.startsWith(`${p} `) || t.startsWith(`${p},`) || t.startsWith(`${p}!`))) {
    // Conversa nova: se já veio um número válido do menu inicial, segue direto.
    const inicio = menuDe('inicio', ctx);
    const n = estado ? null : lerOpcao(texto, inicio.opcoes.map((o) => o.rotulo));
    if (n && inicio.opcoes[n - 1]) return irPara(inicio.opcoes[n - 1].vai, 'inicio', ultimo, ctx);
    if (!estado && /\d/.test(t) && t.length > 8) return { estado: { tela: 'ia', ultimo }, mensagens: [], acao: { tipo: 'livre' } };
    return { estado: { tela: 'menu', id: 'inicio', ultimo }, mensagens: [telaMenu('inicio', saudacao(ctx.nome), ctx)] };
  }

  // A IA fez uma pergunta (ex.: "compra e venda simples ou com financiamento?"): a resposta volta para ela.
  if (estado.tela === 'ia') return { estado, mensagens: [], acao: { tipo: 'livre' } };

  const naoEntendi = (): Passo => ({
    estado,
    mensagens: [telaAtual(estado, ctx, ctx.temAnexo ? 'Eu não abro fotos nem arquivos 🙂 Responda com o *número* de uma opção.\n\n' : NAO_ENTENDI)],
  });
  const voltar = PALAVRAS_VOLTAR.includes(t);

  if (estado.tela === 'menu') {
    const menu = menuDe(estado.id, ctx);
    if (voltar && menu.voltar) return irPara(menu.voltar, menu.voltar, ultimo, ctx);
    const n = lerOpcao(texto, menu.opcoes.map((o) => o.rotulo));
    const opcao = n ? menu.opcoes[n - 1] : undefined;
    if (!opcao) {
      if (estado.id === 'inicio' && /\d/.test(t) && t.length > 8) return { estado: { tela: 'ia', ultimo }, mensagens: [], acao: { tipo: 'livre' } };
      return naoEntendi();
    }
    if (opcao.vai === 'reenviar') {
      if (!ultimo) return irPara('inicio', 'inicio', undefined, ctx);
      return { estado: { tela: 'formato', reenvio: true, ultimo }, mensagens: [telaFormato(ctx)] };
    }
    if (opcao.vai === 'atendente') {
      return { estado: { tela: 'atendente', desde: new Date().toISOString(), ultimo }, mensagens: [{ texto: TEXTO_ATENDENTE }], acao: { tipo: 'atendente' } };
    }
    if (opcao.vai === 'detalhar') {
      if (!ultimo) return irPara('inicio', 'inicio', undefined, ctx);
      return { estado: { tela: 'menu', id: 'depois', ultimo }, mensagens: [telaMenu('depois')], acao: { tipo: 'detalhar', seq: ultimo } };
    }
    return irPara(opcao.vai, estado.id, ultimo, ctx);
  }

  if (estado.tela === 'pergunta') {
    const f = FLUXOS[estado.fluxo];
    const p = f.perguntas[estado.i];
    if (voltar && p.tipo !== 'simnao') {
      if (estado.i === 0) return irPara(estado.origem, estado.origem, ultimo, ctx);
      return { estado: { ...estado, i: estado.i - 1 }, mensagens: [telaPergunta(f, estado.i - 1, '', estado.dados)] };
    }
    let valor: unknown;
    if (p.tipo === 'simnao') {
      if (t === '0' || t === 'voltar') return { estado: { ...estado, i: estado.i - 1 }, mensagens: [telaPergunta(f, estado.i - 1, '', estado.dados)] };
      valor = lerSimNao(texto);
      if (valor === null) return naoEntendi();
    } else if (p.tipo === 'ano') {
      const ano = Number(t.match(/\b(19|20)\d{2}\b/)?.[0]);
      if (!ano || ano < 1997 || ano > anoBaseIncc()) return { estado, mensagens: [telaPergunta(f, estado.i, `Digite o ano com 4 números, entre 1997 e ${anoBaseIncc()}.\n\n`, estado.dados)] };
      valor = ano;
    } else {
      const naoSabe = p.tipo === 'valorOuZero' && /^(nao sei|nao tenho|nao tem|sem|ainda nao)/.test(t);
      const cota = p.cotaDe ? lerCota(texto, Number(estado.dados[p.cotaDe])) : null;
      if (cota && cota.pct > 100) return { estado, mensagens: [telaPergunta(f, estado.i, 'A cota vai de 1% a 100%.\n\n', estado.dados)] };
      const v = naoSabe ? 0 : cota ? cota.valor : lerValor(texto);
      if (v === null || (p.tipo === 'valor' && v <= 0)) return { estado, mensagens: [telaPergunta(f, estado.i, 'Não entendi o valor 🙂 Digite só os números.\n\n', estado.dados)] };
      if (v > 0 && v < 1000) return { estado, mensagens: [telaPergunta(f, estado.i, `${brl(v)} parece baixo. Digite o valor completo, ex.: 350000 para ${brl(350000)}.\n\n`, estado.dados)] };
      if (p.maximo && v > Number(estado.dados[p.maximo.campo])) return { estado, mensagens: [telaPergunta(f, estado.i, `${p.maximo.erro}\n\n`, estado.dados)] };
      valor = v;
    }
    const dados = { ...estado.dados, [p.campo]: valor };
    // Mostra o que foi entendido, no formato em reais, antes da próxima tela.
    const cotaInformada = p.cotaDe ? lerCota(texto, Number(estado.dados[p.cotaDe])) : null;
    const entendido = `✅ ${p.titulo}: *${comoTexto(p, valor)}*${cotaInformada ? ` (${cotaInformada.pct.toLocaleString('pt-BR')}% de ${brl(Number(estado.dados[p.cotaDe!]))})` : ''}\n\n`;
    if (estado.i + 1 < f.perguntas.length) {
      return { estado: { ...estado, i: estado.i + 1, dados }, mensagens: [telaPergunta(f, estado.i + 1, entendido, dados)] };
    }
    if (f.calculo !== 'correcao') {
      return { estado: { tela: 'endereco', etapa: 'pergunta', fluxo: estado.fluxo, dados, origem: estado.origem, ultimo, custos: estado.custos }, mensagens: [telaEndereco('pergunta', entendido)] };
    }
    const noFormato: Estado = { tela: 'formato', fluxo: estado.fluxo, dados, origem: estado.origem, ultimo, custos: estado.custos };
    return { estado: noFormato, mensagens: [telaFormato(ctx, noFormato, entendido)] };
  }

  if (estado.tela === 'endereco') {
    const f = FLUXOS[estado.fluxo];
    if (estado.etapa === 'pergunta') {
      if (voltar) {
        const i = f.perguntas.length - 1;
        return { estado: { tela: 'pergunta', fluxo: estado.fluxo, i, dados: estado.dados, origem: estado.origem, ultimo }, mensagens: [telaPergunta(f, i, '', estado.dados)] };
      }
      const quer = lerSimNao(texto);
      if (quer === null) return naoEntendi();
      if (quer) return { estado: { ...estado, etapa: 'digitar' }, mensagens: [telaEndereco('digitar')] };
      const noFormato: Estado = { tela: 'formato', fluxo: estado.fluxo, dados: estado.dados, origem: estado.origem, ultimo };
      return { estado: noFormato, mensagens: [telaFormato(ctx, { ...noFormato, custos: estado.custos })] };
    }
    if (voltar) return { estado: { ...estado, etapa: 'pergunta' }, mensagens: [telaEndereco('pergunta')] };
    const endereco = (texto ?? '').replace(/\s+/g, ' ').trim();
    if (endereco.length < 5 || !/[a-zA-ZÀ-ú]/.test(endereco)) return { estado, mensagens: [telaEndereco('digitar', 'Escreva o endereço com rua e número 🙂\n\n')] };
    const curto = endereco.slice(0, 120);
    const noFormato: Estado = { tela: 'formato', fluxo: estado.fluxo, dados: estado.dados, origem: estado.origem, ultimo, endereco: curto };
    return { estado: noFormato, mensagens: [telaFormato(ctx, { ...noFormato, custos: estado.custos }, `✅ Endereço: *${curto}*\n\n`)] };
  }

  // Escolha do formato.
  if (voltar) {
    if (estado.reenvio || !estado.fluxo) return irPara('depois', 'inicio', ultimo, ctx);
    const f = FLUXOS[estado.fluxo];
    if (f.calculo !== 'correcao') {
      return { estado: { tela: 'endereco', etapa: 'pergunta', fluxo: estado.fluxo, dados: estado.dados ?? {}, origem: estado.origem ?? 'inicio', ultimo }, mensagens: [telaEndereco('pergunta')] };
    }
    const i = f.perguntas.length - 1;
    return { estado: { tela: 'pergunta', fluxo: estado.fluxo, i, dados: estado.dados ?? {}, origem: estado.origem ?? 'inicio', ultimo }, mensagens: [telaPergunta(f, i, '', estado.dados ?? {})] };
  }
  const n = lerOpcao(texto, FORMATOS.map((f) => f.rotulo));
  const formato = n ? FORMATOS[n - 1]?.id : undefined;
  if (!formato) return naoEntendi();
  const depois: Estado = { tela: 'menu', id: 'depois', ultimo };
  if (estado.reenvio) {
    if (!ultimo) return irPara('inicio', 'inicio', undefined, ctx);
    return { estado: depois, mensagens: [telaMenu('depois')], acao: { tipo: 'reenviar', seq: ultimo, formato } };
  }
  const f = FLUXOS[estado.fluxo!];
  return { estado: depois, mensagens: [telaMenu('depois')], acao: { tipo: 'calcular', calculo: f.calculo, dados: { ...estado.dados, ...estado.custos }, formato, titulo: f.titulo, endereco: estado.endereco } };
}

const COMANDO_CUSTOS = /^(honorarios?|certidoes|certidao)\b\s*:?\s*(.*)$/;

/**
 * Um passo da conversa. `estado` null = conversa nova (ou parada há muito tempo).
 * Em qualquer tela, "honorarios 900" ou "certidoes 350" troca o valor só para o próximo orçamento.
 */
export function passo(estado: Estado | null, texto: string, ctx: ContextoMenu): Passo {
  const m = semAcento(texto ?? '').match(COMANDO_CUSTOS);
  if (m) {
    const atual: Estado = estado ?? { tela: 'menu', id: 'inicio' };
    const campo: keyof Custos = m[1].startsWith('honorario') ? 'honorarios' : 'certidoes';
    const nome = campo === 'honorarios' ? 'Honorários' : 'Certidões';
    const resto = m[2].trim();
    if (/^padra?o/.test(resto)) {
      const { [campo]: _, ...outros } = atual.custos ?? {};
      const novo = { ...atual, custos: outros };
      return { estado: novo, mensagens: [telaAtual(novo, ctx, `✅ ${nome}: voltou para o seu valor padrão.\n\n`)] };
    }
    const v = resto ? lerValor(resto) : null;
    if (v === null) {
      return { estado: atual, mensagens: [telaAtual(atual, ctx, `Para mudar ${nome.toLowerCase()} só neste orçamento, escreva o valor junto. Ex.: *${campo} 900*\nPara voltar ao seu padrão: *${campo} padrao*\n\n`)] };
    }
    const novo: Estado = { ...atual, custos: { ...atual.custos, [campo]: v } };
    return { estado: novo, mensagens: [telaAtual(novo, ctx, `✅ ${nome} deste orçamento: *${brl(v)}*\n\n`)] };
  }
  const p = passoDoMenu(estado, texto, ctx);
  // A troca de custos vale até o próximo orçamento sair.
  if (estado?.custos && p.acao?.tipo !== 'calcular' && !p.estado.custos) p.estado = { ...p.estado, custos: estado.custos };
  return p;
}
