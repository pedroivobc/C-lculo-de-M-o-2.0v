import { jsPDF } from 'jspdf';
import { brl, type Origem, type Resultado } from '../src/lib/calc';
import { config } from './config';

const ROTULO_ORIGEM: Record<Origem, string> = { municipio: 'MUNICÍPIO', uf: 'MG', banco: 'BANCO', usuario: 'VOCÊ' };
const TITULO: Record<string, string> = {
  escritura: 'Escritura', doacao: 'Doação', financiamento_caixa: 'Financiamento Caixa',
  banco_privado: 'Financiamento banco privado', correcao: 'Correção contratual (INCC)', valor_venal: 'Valor venal',
};

/** PDF do orçamento (A4). Cores e ordem seguem a identidade: tinta, azul de ação e total marcado em amarelo. */
export function gerarPdfOrcamento(r: Resultado, meta: { numero: string; data: Date; cabecalho?: string | null }): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 20, R = 190;
  let y = 22;

  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(16, 24, 40);
  doc.text(meta.cabecalho || config.marca, L, y);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(85, 96, 112);
  doc.text(`Orçamento ${meta.numero} · ${meta.data.toLocaleDateString('pt-BR')}`, R, y, { align: 'right' });
  y += 4;
  doc.setDrawColor(35, 66, 214).setLineWidth(0.8).line(L, y, R, y);

  y += 12;
  doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(16, 24, 40);
  doc.text(TITULO[r.tipo] ?? r.tipo, L, y);
  if (r.bases.length) {
    y += 6;
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(85, 96, 112);
    doc.text(`Base de cálculo: ${r.bases.map(brl).join(' + ')}`, L, y);
  }

  y += 10;
  doc.setFontSize(10);
  for (const l of r.linhas) {
    doc.setFont('helvetica', 'bold').setFontSize(7).setTextColor(85, 96, 112);
    doc.text(ROTULO_ORIGEM[l.origem], L, y);
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(16, 24, 40);
    doc.text(l.rotulo, L + 22, y);
    doc.text(brl(l.valor), R, y, { align: 'right' });
    if (l.nota) {
      doc.setFontSize(8).setTextColor(85, 96, 112);
      doc.text(l.nota, L + 22, y + 4);
      y += 4;
    }
    y += 4;
    doc.setDrawColor(228, 231, 236).setLineWidth(0.2).line(L, y, R, y);
    y += 6;
  }

  y += 4;
  doc.setFillColor(255, 210, 74).rect(R - 62, y - 6, 62, 9, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(16, 24, 40);
  doc.text(r.tipo === 'correcao' ? 'Valor corrigido' : 'Total estimado', L, y);
  doc.setFontSize(14).text(brl(r.total), R - 2, y, { align: 'right' });

  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(85, 96, 112);
  doc.text('Valores estimados com as tabelas vigentes. Confirme com o cartório e a prefeitura antes do ato.', L, 285);
  doc.text(config.marca, R, 285, { align: 'right' });

  return Buffer.from(doc.output('arraybuffer'));
}
