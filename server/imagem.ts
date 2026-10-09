import sharp from 'sharp';
import { brl, type Resultado } from '../src/lib/calc';
import { config } from './config';
import type { Estilo } from './estilo';
import { ESTILO_PADRAO } from './pdf';
import { coresDoTotal, LARGURA_LOCKUP, LINHA, linhaDeContato, linhaDeContexto, linhaDoEndereco, lockupOrcaiSvg, SUAVE, TEXTO, TINTA, tituloDoDocumento, type MetaOrcamento } from './documento';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FONTE = `font-family="'DejaVu Sans', Arial, sans-serif"`;

/**
 * Orçamento em imagem (JPEG, 1080 px de largura): o formato que circula melhor no WhatsApp.
 * Logo no topo, linhas sóbrias com as partes de Escritura e Registro, total numa faixa.
 */
export async function gerarJpegOrcamento(r: Resultado, meta: MetaOrcamento, estilo: Estilo = ESTILO_PADRAO): Promise<Buffer> {
  const W = 1080, P = 72, D = W - P;
  const t: string[] = [];
  let y = P;

  // Cabeçalho: logo à esquerda, número e data à direita.
  let alturaLogo = 64;
  if (estilo.logoPng) {
    const { width = 1, height = 1 } = await sharp(estilo.logoPng).metadata();
    alturaLogo = Math.min(130, (520 * height) / width);
    const w = (alturaLogo * width) / height;
    t.push(`<image x="${P}" y="${y}" width="${w}" height="${alturaLogo}" href="data:image/png;base64,${estilo.logoPng.toString('base64')}"/>`);
  } else if (!estilo.personalizado) {
    t.push(`<g transform="translate(${P} ${y})">${lockupOrcaiSvg(64)}</g>`);
  }
  t.push(`<text x="${D}" y="${y + 22}" ${FONTE} font-size="18" font-weight="700" letter-spacing="2" fill="${SUAVE}" text-anchor="end">ORÇAMENTO</text>`);
  t.push(`<text x="${D}" y="${y + 58}" ${FONTE} font-size="34" font-weight="700" fill="${TINTA}" text-anchor="end">Nº ${esc(meta.numero.replace('#', ''))}</text>`);
  t.push(`<text x="${D}" y="${y + 88}" ${FONTE} font-size="20" fill="${SUAVE}" text-anchor="end">${meta.data.toLocaleDateString('pt-BR')}</text>`);
  y += Math.max(alturaLogo, 92);
  if (estilo.personalizado || estilo.logoPng) {
    y += estilo.logoPng ? 46 : 34;
    t.push(`<text x="${P}" y="${y}" ${FONTE} font-size="24" font-weight="700" fill="${TINTA}">${esc(estilo.cabecalho)}</text>`);
    const contato = linhaDeContato(estilo);
    if (contato) {
      y += 30;
      t.push(`<text x="${P}" y="${y}" ${FONTE} font-size="19" fill="${TEXTO}">${esc(contato)}</text>`);
    }
  }
  y += 30;
  t.push(`<rect x="${P}" y="${y}" width="${D - P}" height="3" fill="${estilo.personalizado ? estilo.cor : TINTA}"/>`);

  // Título e contexto.
  y += 70;
  t.push(`<text x="${P}" y="${y}" ${FONTE} font-size="38" font-weight="700" fill="${TINTA}">${esc(tituloDoDocumento(r))}</text>`);
  if (meta.endereco) {
    y += 42;
    const linha = linhaDoEndereco(r, meta.endereco);
    t.push(`<text x="${P}" y="${y}" ${FONTE} font-size="23" font-weight="700" fill="${TEXTO}">${esc(linha.length > 72 ? `${linha.slice(0, 71)}…` : linha)}</text>`);
  }
  const contexto = linhaDeContexto(r, brl, !!meta.endereco);
  if (contexto) {
    y += 40;
    t.push(`<text x="${P}" y="${y}" ${FONTE} font-size="22" fill="${SUAVE}">${esc(contexto)}</text>`);
  }

  // Cabeçalho da tabela.
  y += 60;
  t.push(`<text x="${P}" y="${y}" ${FONTE} font-size="17" font-weight="700" letter-spacing="2" fill="${SUAVE}">DESCRIÇÃO</text>`);
  t.push(`<text x="${D}" y="${y}" ${FONTE} font-size="17" font-weight="700" letter-spacing="2" fill="${SUAVE}" text-anchor="end">VALOR</text>`);
  y += 18;
  t.push(`<rect x="${P}" y="${y}" width="${D - P}" height="2" fill="${TINTA}"/>`);

  for (const l of r.linhas) {
    y += 50;
    t.push(`<text x="${P}" y="${y}" ${FONTE} font-size="28" font-weight="700" fill="${TINTA}">${esc(l.rotulo)}</text>`);
    t.push(`<text x="${D}" y="${y}" ${FONTE} font-size="28" font-weight="700" fill="${TINTA}" text-anchor="end">${brl(l.valor)}</text>`);
    if (l.detalhes?.length) {
      for (const d of l.detalhes) {
        y += 34;
        t.push(`<text x="${P + 24}" y="${y}" ${FONTE} font-size="21" fill="${TEXTO}">${esc(d.rotulo)}</text>`);
        t.push(`<text x="${D}" y="${y}" ${FONTE} font-size="21" fill="${TEXTO}" text-anchor="end">${brl(d.valor)}</text>`);
      }
    } else if (l.nota) {
      y += 32;
      t.push(`<text x="${P}" y="${y}" ${FONTE} font-size="20" fill="${SUAVE}">${esc(l.nota)}</text>`);
    }
    y += 24;
    t.push(`<rect x="${P}" y="${y}" width="${D - P}" height="1.5" fill="${LINHA}"/>`);
  }

  // Total.
  y += 36;
  const cor = coresDoTotal(estilo);
  t.push(`<rect x="${P}" y="${y}" width="${D - P}" height="112" rx="14" fill="${cor.fundo}"/>`);
  t.push(`<text x="${P + 32}" y="${y + 66}" ${FONTE} font-size="22" font-weight="700" letter-spacing="2" fill="${cor.texto}">${r.tipo === 'correcao' ? 'VALOR CORRIGIDO' : 'TOTAL ESTIMADO'}</text>`);
  t.push(`<text x="${D - 32}" y="${y + 72}" ${FONTE} font-size="48" font-weight="700" fill="${cor.texto}" text-anchor="end">${brl(r.total)}</text>`);
  y += 112 + 56;

  // Rodapé.
  t.push(`<text x="${P}" y="${y}" ${FONTE} font-size="19" fill="${SUAVE}">Valores estimados com as tabelas vigentes de MG.</text>`);
  y += 28;
  t.push(`<text x="${P}" y="${y}" ${FONTE} font-size="19" fill="${SUAVE}">Confirme com o cartório e a prefeitura antes do ato.</text>`);
  if (estilo.personalizado) {
    t.push(`<g transform="translate(${D - (LARGURA_LOCKUP * 26) / 64} ${y - 22})">${lockupOrcaiSvg(26)}</g>`);
    t.push(`<text x="${D - (LARGURA_LOCKUP * 26) / 64 - 10}" y="${y - 3}" ${FONTE} font-size="16" fill="${SUAVE}" text-anchor="end">feito com</text>`);
  } else {
    t.push(`<text x="${D}" y="${y}" ${FONTE} font-size="19" fill="${SUAVE}" text-anchor="end">${esc(config.marca)}</text>`);
  }
  const H = Math.ceil(y + P);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#FFFFFF"/>${t.join('')}</svg>`;
  return sharp(Buffer.from(svg), { density: 144 }).resize({ width: W }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}
