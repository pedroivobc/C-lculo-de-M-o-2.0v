import jsPDF from 'jspdf';
import { LOGO_CLEMENTE } from '../assets/logoClemente';

interface PDFData {
  subtipo: string;
  base: number;
  financiamento?: number;
  itens: { label: string; valor: number }[];
  total: number;
}

export const generateClementePDF = (dados: PDFData) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pW = doc.internal.pageSize.getWidth();
  const mL = 25, mR = 25;
  const cW = pW - mL - mR;
  const col1W = cW * 0.62;
  const col2W = cW * 0.38;
  const rowH = 10;
  let y = 15;

  // LOGO centralizada
  const logoW = 60, logoH = 40;
  doc.addImage(LOGO_CLEMENTE, 'PNG', (pW - logoW) / 2, y, logoW, logoH);
  y += logoH + 5;

  // LINHA DOURADA topo da tabela
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.8);
  doc.line(mL, y, pW - mR, y);
  y += 1;

  // Função helper para desenhar linha da tabela
  const drawRow = (
    label: string,
    value: string,
    bgR: number, bgG: number, bgB: number,
    textR: number, textG: number, textB: number,
    bold: boolean = false,
    fontSize: number = 10
  ) => {
    // Fundo da linha
    doc.setFillColor(bgR, bgG, bgB);
    doc.rect(mL, y, cW, rowH, 'F');

    // Borda direita da col1
    doc.setDrawColor(200, 180, 100);
    doc.setLineWidth(0.2);
    doc.line(mL + col1W, y, mL + col1W, y + rowH);

    // Texto
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(textR, textG, textB);
    doc.text(label.toUpperCase(), mL + 4, y + 6.5);
    doc.text(value, mL + col1W + col2W - 4, y + 6.5, { align: 'right' });

    y += rowH;
  };

  const fmt = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // LINHA TIPO DA OPERAÇÃO — fundo dourado
  drawRow(dados.subtipo, fmt(dados.base), 212, 175, 55, 45, 35, 0, true, 10);

  // LINHA BASE DE CÁLCULO — fundo preto
  drawRow('Base de Cálculo', fmt(dados.base), 26, 26, 46, 255, 255, 255, true, 10);

  // LINHA FINANCIAMENTO — fundo cinza escuro (apenas para módulos de financiamento)
  if (dados.financiamento) {
    drawRow('Financiamento', fmt(dados.financiamento), 45, 45, 65, 255, 255, 255, true, 10);
  }

  // LINHAS DOS ITENS — alternando bege e branco
  dados.itens.forEach((item, i) => {
    const bege = i % 2 === 0;
    drawRow(
      item.label,
      fmt(item.valor),
      bege ? 254 : 255,
      bege ? 249 : 255,
      bege ? 240 : 255,
      45, 45, 45,
      false,
      10
    );
  });

  // LINHA TOTAL — fundo dourado
  drawRow('Total', fmt(dados.total), 212, 175, 55, 45, 35, 0, true, 11);

  // LINHA DOURADA abaixo do total
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.8);
  doc.line(mL, y, pW - mR, y);
  y += 5;

  // NOTA RODAPÉ
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text('*Valores sujeitos a alterações conforme tabelas vigentes e condições específicas da transação.', pW / 2, y, { align: 'center' });
  y += 5;

  // DADOS DO RESPONSÁVEL
  const perfil = JSON.parse(localStorage.getItem('perfilUsuario') || '{}');
  const nomePerfil = perfil.nome || '';
  const telPerfil = perfil.telefone || '';
  const emailPerfil = perfil.email || '';

  if (nomePerfil || telPerfil || emailPerfil) {
    y += 2;
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.2);
    doc.line(mL, y, pW - mR, y);
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(`Responsável: ${nomePerfil}`, mL, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Tel: ${telPerfil}  |  E-mail: ${emailPerfil}`, mL, y);
    y += 2;

    doc.line(mL, y, pW - mR, y);
    y += 6;
  } else {
    y += 5;
  }

  // LINHA DOURADA FINAL
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.5);
  doc.line(mL, y, pW - mR, y);
  y += 5;

  // ENDEREÇO
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text('Rua Santa Rita, 454 – Sala 203 – Centro – Juiz de Fora/MG – CEP 36010-071', pW / 2, y, { align: 'center' });

  doc.save(`Orcamento_${dados.subtipo.replace(/ /g, '_')}.pdf`);
};
