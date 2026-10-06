import ExcelJS from 'exceljs';
import {
  definirParametros, normalizarParametros, parametros, PARAMETROS_2026,
  type Ato, type Faixa, type ItbiJuizDeFora, type Parametros, type TabelaEmolumentos, type TabelaIncc, type TipoTabela,
} from '../src/lib/calc';
import { supabaseAdmin } from './supabase';

/**
 * Tabelas anuais (emolumentos de MG, INCC, base do ITBI de Juiz de Fora) por planilha.
 * O admin baixa a planilha da tabela em vigor, troca os valores e envia como a do ano seguinte,
 * com a data em que passa a valer. Antes de publicar, o sistema valida e mostra o quanto mudou.
 */
export const TIPOS: Record<TipoTabela, { nome: string; arquivo: string }> = {
  emolumentos: { nome: 'Tabela de emolumentos de MG (TJMG)', arquivo: 'emolumentos-mg' },
  incc: { nome: 'INCC da correção contratual (Juiz de Fora)', arquivo: 'incc-correcao-jf' },
  itbiJf: { nome: 'Base do desconto de ITBI no SFH (Juiz de Fora)', arquivo: 'itbi-sfh-juiz-de-fora' },
};
export const tipoValido = (t: string): t is TipoTabela => t in TIPOS;

const anoDe = (tipo: TipoTabela, p: Parametros) => (tipo === 'incc' ? p.incc.anoBase : p[tipo].ano);
const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD

// ---------------- Carregar a versão vigente ----------------

export interface VersaoVigente { ano: number; vigenciaInicio: string | null }
let vigentes: Record<TipoTabela, VersaoVigente> = {
  emolumentos: { ano: 2026, vigenciaInicio: null }, incc: { ano: 2026, vigenciaInicio: null }, itbiJf: { ano: 2026, vigenciaInicio: null },
};
export const versoesVigentes = () => vigentes;

/** Lê do banco a versão em vigor de cada tabela e troca os parâmetros dos cálculos. */
export async function carregarTabelasVigentes() {
  const { data, error } = await supabaseAdmin().from('tabelas_anuais')
    .select('tipo, ano, vigencia_inicio, dados').lte('vigencia_inicio', hoje()).order('vigencia_inicio', { ascending: false });
  if (error) throw new Error(`Falha ao ler as tabelas anuais: ${error.message}`);
  const novos: Partial<Parametros> = {};
  const novasVersoes = { ...vigentes };
  for (const tipo of Object.keys(TIPOS) as TipoTabela[]) {
    const v = data?.find((d) => d.tipo === tipo);
    if (v) {
      (novos as Record<string, unknown>)[tipo] = v.dados;
      novasVersoes[tipo] = { ano: v.ano, vigenciaInicio: v.vigencia_inicio };
    } else {
      (novos as Record<string, unknown>)[tipo] = PARAMETROS_2026[tipo];
      novasVersoes[tipo] = { ano: anoDe(tipo, PARAMETROS_2026), vigenciaInicio: null };
    }
  }
  definirParametros(normalizarParametros(novos));
  vigentes = novasVersoes;
}

/** Carrega ao subir e de 15 em 15 minutos (pega a virada do ano sem reiniciar o servidor). */
export function manterTabelasAtualizadas() {
  const carregar = () => carregarTabelasVigentes().catch((e) => console.error('Tabelas anuais:', e instanceof Error ? e.message : e));
  carregar();
  setInterval(carregar, 15 * 60_000).unref();
}

/** Parâmetros para o site (JSON não tem Infinity: a última faixa de cancelamento vai como null). */
export function parametrosParaJson() {
  return JSON.parse(JSON.stringify(parametros(), (_k, v) => (v === Infinity ? null : v)));
}

// ---------------- Planilha: gerar a partir da tabela ----------------

const MOEDA = '#,##0.00';

function instrucoes(wb: ExcelJS.Workbook, linhas: string[]) {
  const ws = wb.addWorksheet('Instruções');
  ws.getColumn(1).width = 110;
  linhas.forEach((l, i) => { const c = ws.getCell(i + 1, 1); c.value = l; if (i === 0) c.font = { bold: true, size: 14 }; c.alignment = { wrapText: true }; });
}

function planilha(wb: ExcelJS.Workbook, nome: string, colunas: { header: string; key: string; width: number; moeda?: boolean }[], linhas: object[]) {
  const ws = wb.addWorksheet(nome);
  ws.columns = colunas.map(({ header, key, width }) => ({ header, key, width }));
  ws.getRow(1).font = { bold: true };
  linhas.forEach((l) => ws.addRow(l));
  colunas.forEach((c, i) => { if (c.moeda) ws.getColumn(i + 1).numFmt = MOEDA; });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

export async function gerarPlanilha(tipo: TipoTabela, p: Parametros = parametros()): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Orçaí Imob';
  if (tipo === 'emolumentos') {
    const e = p.emolumentos;
    instrucoes(wb, [
      `Tabela de emolumentos de MG · ${e.ano}`,
      'Troque só os valores (emolumento bruto e TFJ) pelos da nova portaria do TJMG. Não mude o nome das abas nem a ordem das colunas.',
      'Faixas: uma linha por faixa da Tabela 4, item 5-e (os mesmos valores valem para a escritura, Tabela 1, item 4-b). "Até" é o teto da faixa.',
      'Excedente: o ato somado a cada valor (ou fração) acima da última faixa. Cancelamento: Tabela 4, item 1-g; na última linha, escreva "acima" no "Até".',
      'Atos fixos: prenotação, averbação, certidão de inteiro teor e arquivamento por folha. Não mude a coluna "Chave".',
      'Emolumento bruto = emolumento + Recompe + fundos (como no recibo do cartório). O ISS é calculado pelo sistema.',
    ]);
    const cols = [
      { header: 'Até (R$)', key: 'ate', width: 16, moeda: true }, { header: 'Código', key: 'codigo', width: 10 },
      { header: 'Emolumento bruto (R$)', key: 'bruto', width: 22, moeda: true }, { header: 'TFJ (R$)', key: 'tfj', width: 14, moeda: true },
    ];
    planilha(wb, 'Faixas', cols, e.faixas);
    planilha(wb, 'Excedente', [
      { header: 'Código', key: 'codigo', width: 10 }, { header: 'A cada (R$)', key: 'aCada', width: 16, moeda: true },
      { header: 'Máximo de vezes', key: 'maxFaixas', width: 16 },
      { header: 'Emolumento bruto (R$)', key: 'bruto', width: 22, moeda: true }, { header: 'TFJ (R$)', key: 'tfj', width: 14, moeda: true },
    ], [e.excedente]);
    planilha(wb, 'Cancelamento', cols, e.cancelamento.map((f, i, t) => ({ ...f, ate: i === t.length - 1 || f.ate === Infinity ? 'acima' : f.ate })));
    planilha(wb, 'Atos fixos', [
      { header: 'Chave', key: 'chave', width: 22 }, { header: 'Ato', key: 'nome', width: 34 }, { header: 'Código', key: 'codigo', width: 10 },
      { header: 'Emolumento bruto (R$)', key: 'bruto', width: 22, moeda: true }, { header: 'TFJ (R$)', key: 'tfj', width: 14, moeda: true },
    ], (Object.keys(NOMES_ATOS) as (keyof typeof NOMES_ATOS)[]).map((k) => ({ chave: k, nome: NOMES_ATOS[k], ...e.atos[k] })));
  } else if (tipo === 'incc') {
    instrucoes(wb, [
      `INCC da correção contratual · ano-base ${p.incc.anoBase}`,
      'Acrescente uma linha com o ano novo e o índice. Mantenha os anos anteriores: eles são usados para corrigir contratos antigos.',
      'O ano mais recente da lista vira o ano-base da correção.',
    ]);
    planilha(wb, 'INCC', [{ header: 'Ano', key: 'ano', width: 10 }, { header: 'Índice', key: 'indice', width: 14 }],
      Object.entries(p.incc.indices).map(([ano, indice]) => ({ ano: Number(ano), indice })).sort((a, b) => a.ano - b.ano));
  } else {
    instrucoes(wb, [
      `Base do desconto de ITBI no SFH · Juiz de Fora · ${p.itbiJf.ano}`,
      'Limite: até quanto do valor financiado pelo SFH paga a alíquota reduzida (o resto paga a alíquota cheia de 2%).',
      'Atualize o limite com o valor do ano informado pela Prefeitura de Juiz de Fora. A alíquota reduzida hoje é de 0,5%.',
    ]);
    planilha(wb, 'ITBI Juiz de Fora', [
      { header: 'Parâmetro', key: 'chave', width: 26 }, { header: 'Valor', key: 'valor', width: 16 }, { header: 'O que é', key: 'nota', width: 60 },
    ], [
      { chave: 'limite_sfh', valor: p.itbiJf.limiarSfh, nota: 'Limite da parte financiada com alíquota reduzida (R$)' },
      { chave: 'aliquota_reduzida_percentual', valor: p.itbiJf.aliquotaFinanciado * 100, nota: 'Alíquota reduzida sobre a parte financiada (%), ex.: 0,5' },
    ]);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const NOMES_ATOS = {
  prenotacao: 'Prenotação', averbacao: 'Averbação (inscrição municipal, dados pessoais)',
  certidaoInteiroTeor: 'Certidão de inteiro teor', arquivamentoFolha: 'Arquivamento (por folha)',
} as const;

// ---------------- Planilha: ler e validar ----------------

class ErroPlanilha extends Error {}

/** Número de uma célula: aceita número, fórmula com resultado e texto "1.400,00" / "1400.00" / "R$ 1.400". */
function numero(valor: ExcelJS.CellValue): number | null {
  let v: unknown = valor;
  if (v && typeof v === 'object' && 'result' in v) v = (v as { result: unknown }).result;
  if (v && typeof v === 'object' && 'richText' in v) v = (v as { richText: { text: string }[] }).richText.map((r) => r.text).join('');
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const t = v.replace(/r\$|\s/gi, '');
  if (!t) return null;
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : null;
}
function texto(valor: ExcelJS.CellValue): string {
  let v: unknown = valor;
  if (v && typeof v === 'object' && 'result' in v) v = (v as { result: unknown }).result;
  if (v && typeof v === 'object' && 'richText' in v) v = (v as { richText: { text: string }[] }).richText.map((r) => r.text).join('');
  return String(v ?? '').trim();
}

function aba(wb: ExcelJS.Workbook, nome: string) {
  const ws = wb.getWorksheet(nome);
  if (!ws) throw new ErroPlanilha(`Falta a aba "${nome}". Baixe a planilha atual e edite em cima dela.`);
  const linhas: { n: number; c: (i: number) => ExcelJS.CellValue }[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const vazia = [1, 2, 3, 4, 5].every((i) => row.getCell(i).value === null || row.getCell(i).value === '');
    if (!vazia) linhas.push({ n, c: (i) => row.getCell(i).value });
  });
  return linhas;
}

function exigir(cond: boolean, msg: string): asserts cond { if (!cond) throw new ErroPlanilha(msg); }

function lerAto(c: (i: number) => ExcelJS.CellValue, onde: string, codigoCol: number, brutoCol: number, tfjCol: number): Ato {
  const codigo = texto(c(codigoCol)); const bruto = numero(c(brutoCol)); const tfj = numero(c(tfjCol));
  exigir(!!codigo, `${onde}: falta o código do ato.`);
  exigir(bruto !== null && bruto > 0, `${onde}: emolumento bruto inválido.`);
  exigir(tfj !== null && tfj >= 0, `${onde}: TFJ inválida.`);
  return { codigo, bruto: Math.round(bruto * 100) / 100, tfj: Math.round(tfj * 100) / 100 };
}

function lerFaixas(linhas: ReturnType<typeof aba>, nomeAba: string, ultimaAberta: boolean): Faixa[] {
  const faixas = linhas.map(({ n, c }, i) => {
    const onde = `Aba "${nomeAba}", linha ${n}`;
    const aberta = ultimaAberta && i === linhas.length - 1;
    const ate = aberta ? Infinity : numero(c(1));
    exigir(ate !== null && ate > 0, `${onde}: valor "Até" inválido.`);
    return { ate, ...lerAto(c, onde, 2, 3, 4) };
  });
  exigir(faixas.length >= (ultimaAberta ? 1 : 5), `Aba "${nomeAba}": faltam faixas.`);
  faixas.forEach((f, i) => i > 0 && exigir(f.ate > faixas[i - 1].ate, `Aba "${nomeAba}": as faixas precisam estar em ordem crescente (veja a faixa até ${faixas[i - 1].ate}).`));
  return faixas;
}

/** Lê a planilha enviada pelo admin e devolve a tabela pronta, ou explica o que está errado. */
export async function lerPlanilha<T extends TipoTabela>(tipo: T, arquivo: Buffer, ano: number): Promise<Parametros[T]> {
  return (await lerPlanilhaDe(tipo, arquivo, ano)) as Parametros[T];
}

async function lerPlanilhaDe(tipo: TipoTabela, arquivo: Buffer, ano: number): Promise<Parametros[TipoTabela]> {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(arquivo as unknown as ArrayBuffer); } catch { throw new ErroPlanilha('Não consegui abrir o arquivo. Envie a planilha em .xlsx (Excel ou Google Planilhas → Baixar → .xlsx).'); }

  if (tipo === 'emolumentos') {
    const faixas = lerFaixas(aba(wb, 'Faixas'), 'Faixas', false);
    const [ex] = aba(wb, 'Excedente');
    exigir(!!ex, 'Aba "Excedente": falta a linha do excedente.');
    const aCada = numero(ex.c(2)); const maxFaixas = numero(ex.c(3));
    exigir(aCada !== null && aCada > 0 && maxFaixas !== null && maxFaixas > 0, 'Aba "Excedente": "A cada" e "Máximo de vezes" precisam ser maiores que zero.');
    const excedente = { ...lerAto(ex.c, 'Aba "Excedente"', 1, 4, 5), aCada, maxFaixas: Math.round(maxFaixas) };
    const cancelamento = lerFaixas(aba(wb, 'Cancelamento'), 'Cancelamento', true);
    const atosLinhas = aba(wb, 'Atos fixos');
    const atos = {} as TabelaEmolumentos['atos'];
    for (const chave of Object.keys(NOMES_ATOS) as (keyof typeof NOMES_ATOS)[]) {
      const l = atosLinhas.find(({ c }) => texto(c(1)) === chave);
      exigir(!!l, `Aba "Atos fixos": falta a linha "${chave}" (${NOMES_ATOS[chave]}).`);
      atos[chave] = lerAto(l.c, `Aba "Atos fixos", ${NOMES_ATOS[chave]}`, 3, 4, 5);
    }
    return { ano, faixas, excedente, cancelamento, atos } satisfies TabelaEmolumentos;
  }

  if (tipo === 'incc') {
    const indices: Record<number, number> = {};
    for (const { n, c } of aba(wb, 'INCC')) {
      const a = numero(c(1)); const v = numero(c(2));
      exigir(a !== null && Number.isInteger(a) && a >= 1990 && a <= 2100, `Aba "INCC", linha ${n}: ano inválido.`);
      exigir(v !== null && v > 0, `Aba "INCC", linha ${n}: índice inválido.`);
      exigir(!(a in indices), `Aba "INCC": o ano ${a} aparece duas vezes.`);
      indices[a] = v;
    }
    const anos = Object.keys(indices).map(Number).sort((x, y) => x - y);
    exigir(anos.length >= 2, 'Aba "INCC": faltam anos.');
    anos.forEach((a, i) => i > 0 && exigir(a === anos[i - 1] + 1, `Aba "INCC": falta o ano ${anos[i - 1] + 1}.`));
    exigir(anos[anos.length - 1] === ano, `Aba "INCC": o último ano da lista é ${anos[anos.length - 1]}, mas você está publicando ${ano}. Acrescente a linha de ${ano}.`);
    return { anoBase: ano, indices } satisfies TabelaIncc;
  }

  const linhas = aba(wb, 'ITBI Juiz de Fora');
  const valor = (chave: string) => numero(linhas.find(({ c }) => texto(c(1)) === chave)?.c(2) ?? null);
  const limite = valor('limite_sfh'); const pct = valor('aliquota_reduzida_percentual');
  exigir(limite !== null && limite > 1000, 'Aba "ITBI Juiz de Fora": "limite_sfh" inválido.');
  exigir(pct !== null && pct > 0 && pct <= 5, 'Aba "ITBI Juiz de Fora": "aliquota_reduzida_percentual" inválida (ex.: 0,5).');
  return { ano, limiarSfh: Math.round(limite * 100) / 100, aliquotaFinanciado: pct / 100 } satisfies ItbiJuizDeFora;
}

export const ehErroPlanilha = (e: unknown): e is Error => e instanceof ErroPlanilha;

// ---------------- Comparar com a tabela em vigor ----------------

const pct = (novo: number, velho: number) => (velho ? Math.round(((novo - velho) / velho) * 10000) / 100 : 0);

/** Quanto a tabela nova muda em relação à vigente, com avisos do que parece estranho. */
export function compararTabelas(tipo: TipoTabela, nova: Parametros[TipoTabela], atual: Parametros = parametros()) {
  const avisos: string[] = [];
  const linhas: { item: string; antes: string; depois: string; variacao: number }[] = [];
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (tipo === 'emolumentos') {
    const n = nova as TabelaEmolumentos; const a = atual.emolumentos;
    if (n.faixas.length !== a.faixas.length) avisos.push(`O número de faixas mudou: ${a.faixas.length} → ${n.faixas.length}. Confira se é isso mesmo na portaria.`);
    n.faixas.forEach((f, i) => {
      const v = a.faixas[i];
      const item = `Faixa até ${brl(f.ate)} (${f.codigo})`;
      linhas.push({ item, antes: v ? brl(v.bruto + v.tfj) : '—', depois: brl(f.bruto + f.tfj), variacao: v ? pct(f.bruto + f.tfj, v.bruto + v.tfj) : 0 });
    });
    for (const k of Object.keys(NOMES_ATOS) as (keyof typeof NOMES_ATOS)[]) {
      linhas.push({ item: NOMES_ATOS[k], antes: brl(a.atos[k].bruto + a.atos[k].tfj), depois: brl(n.atos[k].bruto + n.atos[k].tfj), variacao: pct(n.atos[k].bruto + n.atos[k].tfj, a.atos[k].bruto + a.atos[k].tfj) });
    }
  } else if (tipo === 'incc') {
    const n = nova as TabelaIncc; const a = atual.incc;
    for (const [ano, v] of Object.entries(n.indices)) {
      const antigo = a.indices[Number(ano)];
      if (antigo === undefined) linhas.push({ item: `INCC ${ano} (novo)`, antes: '—', depois: String(v), variacao: pct(v, a.indices[Number(ano) - 1] ?? v) });
      else if (antigo !== v) linhas.push({ item: `INCC ${ano} (alterado)`, antes: String(antigo), depois: String(v), variacao: pct(v, antigo) });
    }
    const removidos = Object.keys(a.indices).filter((ano) => !(ano in n.indices));
    if (removidos.length) avisos.push(`Anos que estavam na tabela e sumiram: ${removidos.join(', ')}. Contratos desses anos deixam de ser corrigidos.`);
  } else {
    const n = nova as ItbiJuizDeFora; const a = atual.itbiJf;
    linhas.push({ item: 'Limite da parte financiada (SFH)', antes: brl(a.limiarSfh), depois: brl(n.limiarSfh), variacao: pct(n.limiarSfh, a.limiarSfh) });
    linhas.push({ item: 'Alíquota reduzida', antes: `${a.aliquotaFinanciado * 100}%`, depois: `${n.aliquotaFinanciado * 100}%`, variacao: pct(n.aliquotaFinanciado, a.aliquotaFinanciado) });
  }

  const variacoes = linhas.filter((l) => l.antes !== '—').map((l) => l.variacao);
  const fora = linhas.filter((l) => l.antes !== '—' && (l.variacao < -1 || l.variacao > 25));
  if (fora.length) avisos.push(`${fora.length} ${fora.length === 1 ? 'item variou' : 'itens variaram'} menos de -1% ou mais de 25%: confira se não há erro de digitação (${fora.slice(0, 3).map((l) => l.item).join('; ')}${fora.length > 3 ? '…' : ''}).`);
  return {
    linhas,
    avisos,
    variacao: variacoes.length ? { minima: Math.min(...variacoes), maxima: Math.max(...variacoes), media: Math.round((variacoes.reduce((s, v) => s + v, 0) / variacoes.length) * 100) / 100 } : null,
  };
}

// ---------------- Publicar e listar ----------------

export async function publicarTabela(tipo: TipoTabela, ano: number, vigenciaInicio: string, dados: Parametros[TipoTabela], userId: string) {
  const db = supabaseAdmin();
  const { error } = await db.from('tabelas_anuais').upsert(
    { tipo, ano, vigencia_inicio: vigenciaInicio, dados: JSON.parse(JSON.stringify(dados, (_k, v) => (v === Infinity ? null : v))), publicado_por: userId },
    { onConflict: 'tipo,vigencia_inicio' },
  );
  if (error) throw new Error(`Não foi possível publicar: ${error.message}`);
  await carregarTabelasVigentes();
}

export async function listarVersoes() {
  const { data } = await supabaseAdmin().from('tabelas_anuais')
    .select('id, tipo, ano, vigencia_inicio, created_at').order('vigencia_inicio', { ascending: false });
  return (data ?? []).map((v) => ({ ...v, emVigor: vigentes[v.tipo as TipoTabela]?.vigenciaInicio === v.vigencia_inicio, futura: v.vigencia_inicio > hoje() }));
}

export async function removerVersao(id: string) {
  const { error } = await supabaseAdmin().from('tabelas_anuais').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await carregarTabelasVigentes();
}
