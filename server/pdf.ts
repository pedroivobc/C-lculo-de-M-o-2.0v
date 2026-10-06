import { jsPDF } from 'jspdf';
import { brl, type Origem, type Resultado } from '../src/lib/calc';
import { config } from './config';
import { clarear, COR_MARCA, hexParaRgb, type Estilo } from './estilo';
import sharp from 'sharp';

export const ROTULO_ORIGEM: Record<Origem, string> = { municipio: 'MUNICÍPIO', uf: 'MG', banco: 'BANCO', usuario: 'VOCÊ' };
export const TITULO: Record<string, string> = {
  escritura: 'Escritura', doacao: 'Doação', financiamento_caixa: 'Financiamento Caixa',
  banco_privado: 'Financiamento banco privado', correcao: 'Correção contratual (INCC)', valor_venal: 'Valor venal',
};

export const ESTILO_PADRAO: Estilo = { cabecalho: config.marca, cor: COR_MARCA, formato: 'pdf', personalizado: false };

/**
 * PDF do orçamento (A4). Sem personalização: tinta, azul de ação e total em amarelo (marca Orçaí).
 * Com personalização (Pró e teste): logo do assinante no topo, linha e total na cor dele.
 */
export async function gerarPdfOrcamento(r: Resultado, meta: { numero: string; data: Date }, estilo: Estilo = ESTILO_PADRAO): Promise<Buffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 20, R = 190;
  let y = 22;

  if (estilo.logoPng) {
    const { width = 1, height = 1 } = await sharp(estilo.logoPng).metadata();
    const h = Math.min(16, (60 * height) / width); // até 60 × 16 mm
    const w = (h * width) / height;
    doc.addImage(new Uint8Array(estilo.logoPng), 'PNG', L, 12, w, h);
    y = 12 + h + 7;
  }
  doc.setFont('helvetica', 'bold').setFontSize(estilo.logoPng ? 13 : 18).setTextColor(16, 24, 40);
  doc.text(estilo.cabecalho, L, y);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(85, 96, 112);
  doc.text(`Orçamento ${meta.numero} · ${meta.data.toLocaleDateString('pt-BR')}`, R, y, { align: 'right' });
  y += 4;
  doc.setDrawColor(...hexParaRgb(estilo.cor)).setLineWidth(0.8).line(L, y, R, y);

  y += 12;
  doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(16, 24, 40);
  doc.text(TITULO[r.tipo] ?? r.tipo, L, y);
  if (r.bases.length) {
    y += 6;
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(85, 96, 112);
    doc.text(`Base de cálculo: ${r.bases.map(brl).join(' + ')}`, L, y);
  }
  if (r.municipioNome && r.municipio !== 'n/a') {
    y += 5;
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(85, 96, 112);
    doc.text(`Imóvel em ${r.municipioNome} (MG)`, L, y);
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
  if (estilo.personalizado) doc.setFillColor(...clarear(estilo.cor, 0.8));
  else doc.setFillColor(255, 210, 74);
  doc.rect(R - 62, y - 6, 62, 9, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(16, 24, 40);
  doc.text(r.tipo === 'correcao' ? 'Valor corrigido' : 'Total estimado', L, y);
  doc.setFontSize(14).text(brl(r.total), R - 2, y, { align: 'right' });

  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(85, 96, 112);
  doc.text('Valores estimados com as tabelas vigentes. Confirme com o cartório e a prefeitura antes do ato.', L, 285);
  doc.text(estilo.personalizado ? `Feito com ${config.marca}` : config.marca, R, 285, { align: 'right' });

  return Buffer.from(doc.output('arraybuffer'));
}
