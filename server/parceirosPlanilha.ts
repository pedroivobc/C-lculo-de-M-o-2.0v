import ExcelJS from 'exceljs';

/**
 * Planilha para cadastrar vários corretores parceiros de uma vez: o time baixa o modelo, preenche uma linha por
 * parceiro e envia. Cada linha passa pelas mesmas regras do cadastro um a um (rota POST /api/parceiros/importar).
 */

export const ABA_PARCEIROS = 'Parceiros';
export const MAX_LINHAS_PLANILHA = 500;

const COLUNAS = [
  { chave: 'nome', titulo: 'Nome', largura: 32 },
  { chave: 'imobiliaria', titulo: 'Imobiliária', largura: 30 },
  { chave: 'telefone', titulo: 'WhatsApp (com DDD)', largura: 22 },
  { chave: 'email', titulo: 'E-mail (opcional)', largura: 34 },
] as const;

export interface LinhaPlanilha { linha: number; nome: string; imobiliaria: string; telefone: string; email: string }

export class ErroPlanilhaParceiros extends Error {}

/** Modelo em branco: aba "Parceiros" com o cabeçalho e a aba "Instruções" com um exemplo. */
export async function modeloParceiros(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Orça.ai';
  const ws = wb.addWorksheet(ABA_PARCEIROS);
  ws.columns = COLUNAS.map((c) => ({ header: c.titulo, key: c.chave, width: c.largura }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2342D6' } };
  ws.getColumn(3).numFmt = '@'; // telefone como texto: o Excel não tira o zero nem vira notação científica
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const inst = wb.addWorksheet('Instruções');
  inst.getColumn(1).width = 26;
  inst.getColumn(2).width = 90;
  const linhas: [string, string][] = [
    ['Como preencher', ''],
    ['', 'Uma linha por corretor parceiro, na aba "Parceiros". Não mude os títulos das colunas.'],
    ['Nome', 'Nome do corretor, como vai aparecer no orçamento. Obrigatório.'],
    ['Imobiliária', 'Imobiliária em que ele trabalha. Obrigatório. Escreva sempre do mesmo jeito para o filtro do painel juntar certo.'],
    ['WhatsApp (com DDD)', 'Obrigatório. É por este número que o agente reconhece o parceiro. Ex.: (32) 99999-0000.'],
    ['E-mail (opcional)', 'Com e-mail, ele também recebe um convite para usar o site.'],
    ['', ''],
    ['Exemplo', ''],
    ['Nome', 'Maria Souza'],
    ['Imobiliária', 'Imobiliária Centro'],
    ['WhatsApp (com DDD)', '(32) 99999-0000'],
    ['E-mail (opcional)', 'maria@imobiliariacentro.com.br'],
    ['', ''],
    ['Ao enviar', `Até ${MAX_LINHAS_PLANILHA} parceiros por planilha. Quem já está cadastrado (mesmo telefone ou e-mail) é ignorado, então dá para enviar a mesma planilha de novo depois de corrigir alguma linha.`],
  ];
  linhas.forEach(([a, b], i) => {
    const r = inst.getRow(i + 1);
    r.getCell(1).value = a; r.getCell(2).value = b;
    r.getCell(2).alignment = { wrapText: true };
    if (a === 'Como preencher' || a === 'Exemplo' || a === 'Ao enviar') r.getCell(1).font = { bold: true, size: 13 };
    else r.getCell(1).font = { bold: true };
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const normalizar = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z]/g, '');

/** Coluna de cada campo pelo título (aceita variações como "Telefone", "Celular", "Email"). */
function colunaDe(titulo: string): keyof Omit<LinhaPlanilha, 'linha'> | null {
  const t = normalizar(titulo);
  if (!t) return null;
  if (t.startsWith('nome')) return 'nome';
  if (t.startsWith('imobiliaria') || t.startsWith('empresa')) return 'imobiliaria';
  if (t.startsWith('whatsapp') || t.startsWith('telefone') || t.startsWith('celular') || t.startsWith('fone')) return 'telefone';
  if (t.startsWith('email')) return 'email';
  return null;
}

/** Texto da célula, seja número, texto, hiperlink (e-mail) ou fórmula. */
function textoDaCelula(c: ExcelJS.Cell): string {
  const v = c.value;
  if (v == null) return '';
  if (typeof v === 'number') return String(Math.round(v));
  if (typeof v === 'object' && 'text' in v && typeof v.text === 'string') return v.text.trim();
  if (typeof v === 'object' && 'result' in v) return String(v.result ?? '').trim();
  if (typeof v === 'object' && 'richText' in v) return v.richText.map((p) => p.text).join('').trim();
  return String(c.text ?? v).trim();
}

/** Lê a planilha preenchida. Linhas em branco são puladas; o número da linha volta para o relatório. */
export async function lerPlanilhaParceiros(arquivo: Buffer): Promise<LinhaPlanilha[]> {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(arquivo as unknown as ArrayBuffer); } catch {
    throw new ErroPlanilhaParceiros('Não consegui abrir o arquivo. Envie a planilha em .xlsx (Excel ou Google Planilhas → Baixar → .xlsx).');
  }
  const ws = wb.getWorksheet(ABA_PARCEIROS) ?? wb.worksheets[0];
  if (!ws) throw new ErroPlanilhaParceiros('A planilha está vazia.');

  const mapa = new Map<number, keyof Omit<LinhaPlanilha, 'linha'>>();
  ws.getRow(1).eachCell((c, col) => { const k = colunaDe(textoDaCelula(c)); if (k) mapa.set(col, k); });
  const faltando = (['nome', 'imobiliaria', 'telefone'] as const).filter((k) => ![...mapa.values()].includes(k));
  if (faltando.length) {
    const nomes = { nome: 'Nome', imobiliaria: 'Imobiliária', telefone: 'WhatsApp (com DDD)' };
    throw new ErroPlanilhaParceiros(`Faltam as colunas: ${faltando.map((k) => `"${nomes[k]}"`).join(', ')}. Use a planilha modelo.`);
  }

  const linhas: LinhaPlanilha[] = [];
  for (let i = 2; i <= ws.rowCount; i++) {
    const r = ws.getRow(i);
    const l: LinhaPlanilha = { linha: i, nome: '', imobiliaria: '', telefone: '', email: '' };
    for (const [col, k] of mapa) l[k] = textoDaCelula(r.getCell(col));
    if (!l.nome && !l.imobiliaria && !l.telefone && !l.email) continue;
    linhas.push(l);
  }
  if (!linhas.length) throw new ErroPlanilhaParceiros('Nenhum parceiro na planilha. Preencha a partir da linha 2 da aba "Parceiros".');
  if (linhas.length > MAX_LINHAS_PLANILHA) throw new ErroPlanilhaParceiros(`A planilha tem ${linhas.length} parceiros. Envie no máximo ${MAX_LINHAS_PLANILHA} por vez.`);
  return linhas;
}
