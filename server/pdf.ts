import { jsPDF } from 'jspdf';
import { brl, type Resultado } from '../src/lib/calc';
import { config } from './config';
import { COR_MARCA, hexParaRgb, type Estilo } from './estilo';
import { coresDoTotal, LARGURA_LOCKUP, LINHA, linhaDeContato, linhaDeContexto, linhaDoEndereco, logoOrcaiPng, SUAVE, TEXTO, TINTA, tituloDoDocumento, type MetaOrcamento } from './documento';
import sharp from 'sharp';

export { TITULO } from './documento';

export const ESTILO_PADRAO: Estilo = { cabecalho: config.marca, cor: COR_MARCA, formato: 'pdf', personalizado: false };

const rgb = (hex: string) => hexParaRgb(hex);

/**
 * PDF do orçamento (A4), mesmo desenho da imagem: logo no topo (Orçaí, ou a do assinante no Pró e no teste),
 * linhas em tinta e cinza com as partes de Escritura e Registro, total numa faixa. Sem etiquetas coloridas.
 */
export async function gerarPdfOrcamento(r: Resultado, meta: MetaOrcamento, estilo: Estilo = ESTILO_PADRAO): Promise<Buffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 20, R = 190;
  let y = 18;

  // Cabeçalho: logo à esquerda; número e data à direita.
  let alturaLogo = 12;
  if (estilo.logoPng) {
    const { width = 1, height = 1 } = await sharp(estilo.logoPng).metadata();
    alturaLogo = Math.min(24, (95 * height) / width);
    doc.addImage(new Uint8Array(estilo.logoPng), 'PNG', L, y, (alturaLogo * width) / height, alturaLogo);
  } else if (!estilo.personalizado) {
    doc.addImage(new Uint8Array(await logoOrcaiPng()), 'PNG', L, y, (12 * LARGURA_LOCKUP) / 64, 12);
  }
  doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...rgb(SUAVE));
  doc.text('ORÇAMENTO', R, y + 3.5, { align: 'right' });
  doc.setFontSize(14).setTextColor(...rgb(TINTA));
  doc.text(`Nº ${meta.numero.replace('#', '')}`, R, y + 10, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...rgb(SUAVE));
  doc.text(meta.data.toLocaleDateString('pt-BR'), R, y + 15, { align: 'right' });
  y += Math.max(alturaLogo, 16);
  if (estilo.personalizado || estilo.logoPng) {
    y += estilo.logoPng ? 9 : 7;
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...rgb(TINTA));
    doc.text(estilo.cabecalho, L, y);
    const contato = linhaDeContato(estilo);
    if (contato) {
      y += 5;
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...rgb(TEXTO));
      doc.text(contato, L, y);
    }
  }
  y += 5;
  doc.setDrawColor(...rgb(estilo.personalizado ? estilo.cor : TINTA)).setLineWidth(0.6).line(L, y, R, y);

  // Título e contexto.
  y += 12;
  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...rgb(TINTA));
  doc.text(tituloDoDocumento(r), L, y);
  if (meta.endereco) {
    y += 6.5;
    doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...rgb(TEXTO));
    doc.text(doc.splitTextToSize(linhaDoEndereco(r, meta.endereco), R - L)[0], L, y);
  }
  const contexto = linhaDeContexto(r, brl, !!meta.endereco);
  if (contexto) {
    y += 6;
    doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...rgb(SUAVE));
    doc.text(contexto, L, y);
  }

  // Tabela.
  y += 11;
  doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...rgb(SUAVE));
  doc.text('DESCRIÇÃO', L, y, { charSpace: 0.6 });
  doc.text('VALOR', R, y, { align: 'right' });
  y += 2.5;
  doc.setDrawColor(...rgb(TINTA)).setLineWidth(0.4).line(L, y, R, y);

  for (const l of r.linhas) {
    y += 7.5;
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...rgb(TINTA));
    doc.text(l.rotulo, L, y);
    doc.text(brl(l.valor), R, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    if (l.detalhes?.length) {
      doc.setFontSize(9).setTextColor(...rgb(TEXTO));
      for (const d of l.detalhes) {
        y += 5;
        doc.text(d.rotulo, L + 5, y);
        doc.text(brl(d.valor), R, y, { align: 'right' });
      }
    } else if (l.nota) {
      y += 4.8;
      doc.setFontSize(8.5).setTextColor(...rgb(SUAVE));
      doc.text(l.nota, L, y);
    }
    y += 4;
    doc.setDrawColor(...rgb(LINHA)).setLineWidth(0.2).line(L, y, R, y);
  }

  // Total.
  y += 7;
  const cor = coresDoTotal(estilo);
  doc.setFillColor(...rgb(cor.fundo)).roundedRect(L, y, R - L, 16, 2, 2, 'F');
  doc.setTextColor(...rgb(cor.texto));
  doc.setFont('helvetica', 'bold').setFontSize(9).text(r.tipo === 'correcao' ? 'VALOR CORRIGIDO' : 'TOTAL ESTIMADO', L + 6, y + 9.6, { charSpace: 0.6 });
  doc.setFontSize(18).text(brl(r.total), R - 6, y + 10.5, { align: 'right' });

  // Rodapé.
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...rgb(SUAVE));
  doc.text('Valores estimados com as tabelas vigentes de MG. Confirme com o cartório e a prefeitura antes do ato.', L, 284);
  if (estilo.personalizado) {
    const w = (5 * LARGURA_LOCKUP) / 64;
    doc.addImage(new Uint8Array(await logoOrcaiPng()), 'PNG', R - w, 280.6, w, 5);
    doc.text('feito com', R - w - 1.5, 284, { align: 'right' });
  }

  return Buffer.from(doc.output('arraybuffer'));
}
