import { brl, type TipoCalculo } from '../../src/lib/calc';
import { ANO_BASE_INCC } from '../../src/lib/calc/correcao';

/**
 * Conversa do WhatsApp por menus numerados: o corretor escolhe opções (1, 2, 3…) e responde
 * uma pergunta por vez. Feito para quem nunca usou o serviço conseguir orçar sem errar.
 *
 * Este módulo é puro: recebe o estado e a mensagem e devolve o novo estado, as mensagens e,
 * quando chega a hora, a ação (calcular, reenviar, detalhar). Quem executa é ./conversa.ts.
 */

export type FormatoEntrega = 'jpeg' | 'pdf' | 'texto';

interface Opcao { rotulo: string; vai: string } // vai: id de menu ou 'fluxo:<id>'
interface Menu { titulo: string; opcoes: Opcao[]; voltar?: string }

type TipoPergunta = 'valor' | 'valorOuZero' | 'ano' | 'simnao';
interface Pergunta { campo: string; titulo: string; texto: string; tipo: TipoPergunta; maximo?: { campo: string; erro: string } }
interface Fluxo { titulo: string; calculo: TipoCalculo; fixos: Record<string, unknown>; perguntas: Pergunta[] }

const BANCOS = { itau: 'Itaú', bradesco: 'Bradesco', santander: 'Santander' } as const;

const IMOVEL: Pergunta = { campo: 'valorDeclarado', titulo: 'Valor do imóvel', texto: 'Qual é o valor do imóvel?', tipo: 'valor' };
const FINANCIADO: Pergunta = {
  campo: 'valorFinanciado', titulo: 'Valor financiado', texto: 'Quanto vai ser financiado?', tipo: 'valor',
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
  caixa_mcmv: { titulo: 'Caixa · Minha Casa Minha Vida', calculo: 'financiamento_caixa', fixos: { modalidade: 'MCMV' }, perguntas: [IMOVEL, FINANCIADO, PRIMEIRO] },
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
    titulo: 'O que você quer orçar?',
    opcoes: [
      { rotulo: 'Escritura', vai: 'escritura' },
      { rotulo: 'Financiamento', vai: 'financiamento' },
      { rotulo: 'Atualizar valor de contrato', vai: 'fluxo:correcao' },
    ],
  },
  escritura: {
    titulo: '*Escritura*\nQual é o tipo?', voltar: 'inicio',
    opcoes: [
      { rotulo: 'Compra e venda', vai: 'compra_venda' },
      { rotulo: 'Doação', vai: 'doacao' },
      { rotulo: 'Renúncia de usufruto', vai: 'fluxo:renuncia' },
    ],
  },
  compra_venda: {
    titulo: '*Compra e venda*\nQual é o tipo?', voltar: 'escritura',
    opcoes: [
      { rotulo: 'Compra e venda simples', vai: 'fluxo:cv_simples' },
      { rotulo: 'Compra e venda com vínculo', vai: 'fluxo:cv_vinculo' },
      { rotulo: 'Compra e venda com interveniência', vai: 'fluxo:cv_interveniencia' },
    ],
  },
  doacao: {
    titulo: '*Doação*\nQual é o tipo?', voltar: 'escritura',
    opcoes: [
      { rotulo: 'Doação simples', vai: 'fluxo:doacao_simples' },
      { rotulo: 'Doação com usufruto', vai: 'fluxo:doacao_usufruto' },
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
      { rotulo: 'SBPE (financiamento comum)', vai: 'fluxo:caixa_sbpe' },
      { rotulo: 'Minha Casa Minha Vida', vai: 'fluxo:caixa_mcmv' },
      { rotulo: 'SFI', vai: 'fluxo:caixa_sfi' },
      { rotulo: 'FGTS', vai: 'fluxo:caixa_fgts' },
      { rotulo: 'Home equity (empréstimo com o imóvel de garantia)', vai: 'fluxo:caixa_egi' },
    ],
  },
  ...Object.fromEntries(Object.entries(BANCOS).map(([id, nome]) => [id, {
    titulo: `*${nome}*\nQual é a modalidade?`, voltar: 'financiamento',
    opcoes: [
      { rotulo: 'SBPE (financiamento comum)', vai: `fluxo:${id}_sbpe` },
      { rotulo: 'SFI', vai: `fluxo:${id}_sfi` },
    ],
  }])),
  depois: {
    titulo: 'Quer fazer mais alguma coisa?', voltar: 'inicio',
    opcoes: [
      { rotulo: 'Fazer outro orçamento', vai: 'inicio' },
      { rotulo: 'Receber em outro formato', vai: 'reenviar' },
      { rotulo: 'Ver os valores detalhados', vai: 'detalhar' },
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
  | { tela: 'formato'; fluxo?: string; dados?: Record<string, unknown>; origem?: string; reenvio?: boolean };

export type Estado = Tela & { /** Número (seq) do último orçamento feito nesta conversa. */ ultimo?: number };

export interface MensagemMenu { texto: string; opcoes?: { id: string; titulo: string }[] }

export type Acao =
  | { tipo: 'calcular'; calculo: TipoCalculo; dados: Record<string, unknown>; formato: FormatoEntrega; titulo: string }
  | { tipo: 'reenviar'; seq: number; formato: FormatoEntrega }
  | { tipo: 'detalhar'; seq: number }
  /** Texto livre no menu inicial (ex.: "escritura de 350 mil"): vai para o agente com IA, se houver. */
  | { tipo: 'livre' };

export interface Passo { estado: Estado; mensagens: MensagemMenu[]; acao?: Acao }

export interface ContextoMenu { nome?: string | null; formatoPadrao: FormatoEntrega; temAnexo?: boolean }

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

function lerSimNao(texto: string): boolean | null {
  const t = semAcento(texto).replace(/[️⃣]/g, '');
  if (['1', 'sim', 's', 'si', 'isso', 'e sim'].includes(t)) return true;
  if (['2', 'nao', 'n', 'não'].includes(t)) return false;
  return null;
}

// ---------------- Mensagens ----------------

const NUM = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
const VOLTAR = `${NUM[0]} Voltar ao menu anterior`;

function mensagemMenu(titulo: string, rotulos: string[], comVoltar: boolean, prefixo = ''): MensagemMenu {
  const linhas = rotulos.map((r, i) => `${NUM[i + 1]} ${r}`);
  return {
    texto: `${prefixo}${titulo}\n\n${linhas.join('\n')}${comVoltar ? `\n\n${VOLTAR}` : ''}\n\n_Responda com o número da opção._`,
    opcoes: [...rotulos.map((r, i) => ({ id: String(i + 1), titulo: r })), ...(comVoltar ? [{ id: '0', titulo: 'Voltar' }] : [])],
  };
}

const telaMenu = (id: string, prefixo = '') => {
  const m = MENUS[id];
  return mensagemMenu(m.titulo, m.opcoes.map((o) => o.rotulo), !!m.voltar, prefixo);
};

function telaPergunta(f: Fluxo, i: number, prefixo = ''): MensagemMenu {
  const p = f.perguntas[i];
  const passo = f.perguntas.length > 1 ? ` (${i + 1} de ${f.perguntas.length})` : '';
  if (p.tipo === 'simnao') return mensagemMenu(`*${p.titulo}*${passo}\n${p.texto}`, ['Sim', 'Não'], true, prefixo);
  const exemplo = p.tipo === 'ano' ? '' : '\n_Pode digitar só os números: 350000 vira R$ 350.000,00_';
  return { texto: `${prefixo}*${p.titulo}*${passo}\n${p.texto}${exemplo}\n\n${VOLTAR}`, opcoes: [{ id: '0', titulo: 'Voltar' }] };
}

/** Resposta já entendida, como o corretor vai vê-la: R$ 350.000,00, Sim, 2015. */
function comoTexto(p: Pergunta, valor: unknown): string {
  if (p.tipo === 'simnao') return valor ? 'Sim' : 'Não';
  if (p.tipo === 'ano') return String(valor);
  if (p.tipo === 'valorOuZero' && valor === 0) return 'ainda não tem';
  return brl(Number(valor));
}

function telaFormato(padrao: FormatoEntrega, prefixo = ''): MensagemMenu {
  return mensagemMenu('*Como você quer receber o orçamento?*', FORMATOS.map((f) => f.id === padrao ? `${f.rotulo} · seu padrão` : f.rotulo), true, prefixo);
}

const saudacao = (nome?: string | null) => `Olá${nome ? `, ${nome.split(' ')[0]}` : ''}! 👋 Eu faço o orçamento da documentação do imóvel.\n\n`;

// ---------------- Transições ----------------

/** Re-mostra a tela atual (usado quando a resposta não foi entendida). */
export function telaAtual(e: Estado, ctx: ContextoMenu, prefixo = ''): MensagemMenu {
  if (e.tela === 'menu') return telaMenu(e.id, prefixo);
  if (e.tela === 'pergunta') return telaPergunta(FLUXOS[e.fluxo], e.i, prefixo);
  return telaFormato(ctx.formatoPadrao, prefixo);
}

const NAO_ENTENDI = 'Não entendi 🙂 Responda só com o *número* de uma opção.\n\n';

function irPara(destino: string, origem: string, ultimo?: number): Passo {
  if (destino.startsWith('fluxo:')) {
    const fluxo = destino.slice(6);
    const f = FLUXOS[fluxo];
    return { estado: { tela: 'pergunta', fluxo, i: 0, dados: { ...f.fixos }, origem, ultimo }, mensagens: [telaPergunta(f, 0, `*${f.titulo}*\n\n`)] };
  }
  return { estado: { tela: 'menu', id: destino, ultimo }, mensagens: [telaMenu(destino)] };
}

/** Um passo da conversa. `estado` null = conversa nova (ou parada há muito tempo). */
export function passo(estado: Estado | null, texto: string, ctx: ContextoMenu): Passo {
  const t = semAcento(texto ?? '');
  const ultimo = estado?.ultimo;

  if (!estado || PALAVRAS_INICIO.some((p) => t === p || t.startsWith(`${p} `) || t.startsWith(`${p},`) || t.startsWith(`${p}!`))) {
    // Conversa nova: se já veio um número válido do menu inicial, segue direto.
    const n = estado ? null : lerOpcao(texto, MENUS.inicio.opcoes.map((o) => o.rotulo));
    if (n && MENUS.inicio.opcoes[n - 1]) return irPara(MENUS.inicio.opcoes[n - 1].vai, 'inicio', ultimo);
    if (!estado && /\d/.test(t) && t.length > 8) return { estado: { tela: 'menu', id: 'inicio', ultimo }, mensagens: [], acao: { tipo: 'livre' } };
    return { estado: { tela: 'menu', id: 'inicio', ultimo }, mensagens: [telaMenu('inicio', saudacao(ctx.nome))] };
  }

  const naoEntendi = (): Passo => ({
    estado,
    mensagens: [telaAtual(estado, ctx, ctx.temAnexo ? 'Eu não abro fotos nem arquivos 🙂 Responda com o *número* de uma opção.\n\n' : NAO_ENTENDI)],
  });
  const voltar = PALAVRAS_VOLTAR.includes(t);

  if (estado.tela === 'menu') {
    const menu = MENUS[estado.id];
    if (voltar && menu.voltar) return irPara(menu.voltar, menu.voltar, ultimo);
    const n = lerOpcao(texto, menu.opcoes.map((o) => o.rotulo));
    const opcao = n ? menu.opcoes[n - 1] : undefined;
    if (!opcao) {
      if (estado.id === 'inicio' && /\d/.test(t) && t.length > 8) return { estado, mensagens: [], acao: { tipo: 'livre' } };
      return naoEntendi();
    }
    if (opcao.vai === 'reenviar') {
      if (!ultimo) return irPara('inicio', 'inicio');
      return { estado: { tela: 'formato', reenvio: true, ultimo }, mensagens: [telaFormato(ctx.formatoPadrao)] };
    }
    if (opcao.vai === 'detalhar') {
      if (!ultimo) return irPara('inicio', 'inicio');
      return { estado: { tela: 'menu', id: 'depois', ultimo }, mensagens: [telaMenu('depois')], acao: { tipo: 'detalhar', seq: ultimo } };
    }
    return irPara(opcao.vai, estado.id, ultimo);
  }

  if (estado.tela === 'pergunta') {
    const f = FLUXOS[estado.fluxo];
    const p = f.perguntas[estado.i];
    if (voltar && p.tipo !== 'simnao') {
      if (estado.i === 0) return irPara(estado.origem, estado.origem, ultimo);
      return { estado: { ...estado, i: estado.i - 1 }, mensagens: [telaPergunta(f, estado.i - 1)] };
    }
    let valor: unknown;
    if (p.tipo === 'simnao') {
      if (t === '0' || t === 'voltar') return { estado: { ...estado, i: estado.i - 1 }, mensagens: [telaPergunta(f, estado.i - 1)] };
      valor = lerSimNao(texto);
      if (valor === null) return naoEntendi();
    } else if (p.tipo === 'ano') {
      const ano = Number(t.match(/\b(19|20)\d{2}\b/)?.[0]);
      if (!ano || ano < 1997 || ano > ANO_BASE_INCC) return { estado, mensagens: [telaPergunta(f, estado.i, `Digite o ano com 4 números, entre 1997 e ${ANO_BASE_INCC}.\n\n`)] };
      valor = ano;
    } else {
      const naoSabe = p.tipo === 'valorOuZero' && /^(nao sei|nao tenho|nao tem|sem|ainda nao)/.test(t);
      const v = naoSabe ? 0 : lerValor(texto);
      if (v === null || (p.tipo === 'valor' && v <= 0)) return { estado, mensagens: [telaPergunta(f, estado.i, 'Não entendi o valor 🙂 Digite só os números.\n\n')] };
      if (v > 0 && v < 1000) return { estado, mensagens: [telaPergunta(f, estado.i, `${brl(v)} parece baixo. Digite o valor completo, ex.: 350000 para ${brl(350000)}.\n\n`)] };
      if (p.maximo && v > Number(estado.dados[p.maximo.campo])) return { estado, mensagens: [telaPergunta(f, estado.i, `${p.maximo.erro}\n\n`)] };
      valor = v;
    }
    const dados = { ...estado.dados, [p.campo]: valor };
    // Mostra o que foi entendido, no formato em reais, antes da próxima tela.
    const entendido = `✅ ${p.titulo}: *${comoTexto(p, valor)}*\n\n`;
    if (estado.i + 1 < f.perguntas.length) {
      return { estado: { ...estado, i: estado.i + 1, dados }, mensagens: [telaPergunta(f, estado.i + 1, entendido)] };
    }
    return { estado: { tela: 'formato', fluxo: estado.fluxo, dados, origem: estado.origem, ultimo }, mensagens: [telaFormato(ctx.formatoPadrao, entendido)] };
  }

  // Escolha do formato.
  if (voltar) {
    if (estado.reenvio || !estado.fluxo) return irPara('depois', 'inicio', ultimo);
    const f = FLUXOS[estado.fluxo];
    const i = f.perguntas.length - 1;
    return { estado: { tela: 'pergunta', fluxo: estado.fluxo, i, dados: estado.dados ?? {}, origem: estado.origem ?? 'inicio', ultimo }, mensagens: [telaPergunta(f, i)] };
  }
  const n = lerOpcao(texto, FORMATOS.map((f) => f.rotulo));
  const formato = n ? FORMATOS[n - 1]?.id : undefined;
  if (!formato) return naoEntendi();
  const depois: Estado = { tela: 'menu', id: 'depois', ultimo };
  if (estado.reenvio) {
    if (!ultimo) return irPara('inicio', 'inicio');
    return { estado: depois, mensagens: [telaMenu('depois')], acao: { tipo: 'reenviar', seq: ultimo, formato } };
  }
  const f = FLUXOS[estado.fluxo!];
  return { estado: depois, mensagens: [telaMenu('depois')], acao: { tipo: 'calcular', calculo: f.calculo, dados: estado.dados ?? {}, formato, titulo: f.titulo } };
}
