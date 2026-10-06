import sharp from 'sharp';
import { brl, type Resultado } from '../src/lib/calc';
import { config } from './config';
import { clarear, type Estilo } from './estilo';
import { ESTILO_PADRAO, ROTULO_ORIGEM, TITULO } from './pdf';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FONTE = `font-family="Inter, 'DejaVu Sans', Arial, sans-serif"`;
const TINTA = '#101828', SUAVE = '#556070', LINHA = '#E4E7EC';

const CHIP: Record<string, [string, string]> = {
  municipio: ['#FDECEC', '#9F1D1D'], uf: ['#E8EDFF', '#1B33A8'], banco: ['#F1F3F6', '#344054'], usuario: ['#FFF4CC', '#7A5A00'],
};

/**
 * Orçamento em imagem (JPEG, 1080 px de largura): o formato que circula melhor no WhatsApp.
 * Mesmo conteúdo e mesma regra de marca do PDF.
 */
export async function gerarJpegOrcamento(r: Resultado, meta: { numero: string; data: Date }, estilo: Estilo = ESTILO_PADRAO): Promise<Buffer> {
  const W = 1080, P = 64;
  const partes: string[] = [];
  let y = P;

  if (estilo.logoPng) {
    const { width = 1, height = 1 } = await sharp(estilo.logoPng).metadata();
    const h = Math.min(110, (420 * height) / width);
    const w = (h * width) / height;
    partes.push(`<image x="${P}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${estilo.logoPng.toString('base64')}"/>`);
    y += h + 44;
  } else {
    y += 40;
  }
  partes.push(`<text x="${P}" y="${y}" ${FONTE} font-size="${estilo.logoPng ? 32 : 44}" font-weight="800" fill="${TINTA}">${esc(estilo.cabecalho)}</text>`);
  partes.push(`<text x="${W - P}" y="${y}" ${FONTE} font-size="24" fill="${SUAVE}" text-anchor="end">Orçamento ${esc(meta.numero)} · ${meta.data.toLocaleDateString('pt-BR')}</text>`);
  y += 22;
  partes.push(`<rect x="${P}" y="${y}" width="${W - 2 * P}" height="6" rx="3" fill="${estilo.cor}"/>`);

  y += 76;
  partes.push(`<text x="${P}" y="${y}" ${FONTE} font-size="40" font-weight="800" fill="${TINTA}">${esc(TITULO[r.tipo] ?? r.tipo)}</text>`);
  if (r.bases.length) {
    y += 42;
    partes.push(`<text x="${P}" y="${y}" ${FONTE} font-size="26" fill="${SUAVE}">Base de cálculo: ${esc(r.bases.map(brl).join(' + '))}</text>`);
  }
  if (r.municipioNome && r.municipio !== 'n/a') {
    y += 38;
    partes.push(`<text x="${P}" y="${y}" ${FONTE} font-size="26" fill="${SUAVE}">Imóvel em ${esc(r.municipioNome)} (MG)</text>`);
  }

  y += 40;
  for (const l of r.linhas) {
    y += 46;
    const [fundo, texto] = CHIP[l.origem] ?? CHIP.banco;
    const rotulo = ROTULO_ORIGEM[l.origem];
    const larguraChip = 26 + rotulo.length * 12.5;
    partes.push(`<rect x="${P}" y="${y - 27}" width="${larguraChip}" height="34" rx="8" fill="${fundo}"/>`);
    partes.push(`<text x="${P + larguraChip / 2}" y="${y - 4}" ${FONTE} font-size="18" font-weight="800" fill="${texto}" text-anchor="middle">${esc(rotulo)}</text>`);
    partes.push(`<text x="${P + larguraChip + 18}" y="${y}" ${FONTE} font-size="30" fill="${TINTA}">${esc(l.rotulo)}</text>`);
    partes.push(`<text x="${W - P}" y="${y}" ${FONTE} font-size="30" font-weight="700" fill="${TINTA}" text-anchor="end">${brl(l.valor)}</text>`);
    if (l.nota) {
      y += 34;
      partes.push(`<text x="${P + larguraChip + 18}" y="${y}" ${FONTE} font-size="22" fill="${SUAVE}">${esc(l.nota)}</text>`);
    }
    y += 24;
    partes.push(`<rect x="${P}" y="${y}" width="${W - 2 * P}" height="2" fill="${LINHA}"/>`);
  }

  y += 40;
  const fundoTotal = estilo.personalizado ? `rgb(${clarear(estilo.cor, 0.8).join(',')})` : '#FFD24A';
  partes.push(`<rect x="${P}" y="${y}" width="${W - 2 * P}" height="120" rx="20" fill="${fundoTotal}"/>`);
  partes.push(`<text x="${P + 32}" y="${y + 74}" ${FONTE} font-size="32" font-weight="800" fill="${TINTA}">${r.tipo === 'correcao' ? 'Valor corrigido' : 'Total estimado'}</text>`);
  partes.push(`<text x="${W - P - 32}" y="${y + 80}" ${FONTE} font-size="50" font-weight="900" fill="${TINTA}" text-anchor="end">${brl(r.total)}</text>`);
  y += 120 + 64;

  partes.push(`<text x="${P}" y="${y}" ${FONTE} font-size="21" fill="${SUAVE}">Valores estimados com as tabelas vigentes.</text>`);
  y += 30;
  partes.push(`<text x="${P}" y="${y}" ${FONTE} font-size="21" fill="${SUAVE}">Confirme com o cartório e a prefeitura antes do ato.</text>`);
  y += 38;
  partes.push(`<text x="${P}" y="${y}" ${FONTE} font-size="21" font-weight="700" fill="${SUAVE}">${esc(estilo.personalizado ? `Feito com ${config.marca}` : config.marca)}</text>`);
  const H = Math.ceil(y + P);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#FFFFFF"/>${partes.join('')}</svg>`;
  return sharp(Buffer.from(svg), { density: 144 }).resize({ width: W }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
}
