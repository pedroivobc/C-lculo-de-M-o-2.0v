import sharp from 'sharp';
import { ROTULO_SUBTIPO_ESCRITURA, type Resultado } from '../src/lib/calc';
import { hexParaRgb, type Estilo } from './estilo';

/**
 * O que o PDF e a imagem do orçamento têm em comum: textos, linhas e cores.
 * O documento vai para o cliente final, então é sóbrio: logo no topo, linhas em tinta e cinza,
 * o total numa faixa (tinta, ou a cor do assinante no Pró). Sem etiquetas coloridas de origem.
 */
export const TINTA = '#101828';
export const TEXTO = '#344054';
export const SUAVE = '#667085';
export const LINHA = '#E4E7EC';

export const TITULO: Record<string, string> = {
  escritura: 'Escritura', doacao: 'Doação', financiamento_caixa: 'Financiamento Caixa',
  banco_privado: 'Financiamento bancário', correcao: 'Correção contratual (INCC)',
};

const BANCO: Record<string, string> = { itau: 'Itaú', bradesco: 'Bradesco', santander: 'Santander' };

/** "Escritura · Compra e venda simples", "Financiamento Caixa · SBPE"… */
export function tituloDoDocumento(r: Resultado) {
  const base = TITULO[r.tipo] ?? r.tipo;
  if (r.tipo === 'escritura' || r.tipo === 'doacao') {
    const sub = ROTULO_SUBTIPO_ESCRITURA[r.subtipo as keyof typeof ROTULO_SUBTIPO_ESCRITURA];
    return sub ? `${base} · ${sub}` : base;
  }
  if (r.tipo === 'banco_privado') {
    const [banco, modalidade] = r.subtipo.split('_');
    return `${base} · ${BANCO[banco] ?? banco} ${modalidade ?? ''}`.trim();
  }
  if (r.tipo === 'financiamento_caixa') return `${base} · ${r.subtipo}`;
  return base;
}

export function linhaDeContexto(r: Resultado, brl: (n: number) => string) {
  const partes: string[] = [];
  if (r.municipioNome && r.municipio !== 'n/a') partes.push(`Imóvel em ${r.municipioNome} (MG)`);
  if (r.bases.length) partes.push(`Base de cálculo ${r.bases.map(brl).join(' + ')}`);
  return partes.join(' · ');
}

/** Faixa do total: tinta na marca Orçaí; a cor do assinante quando personalizado. Texto branco ou tinta, pelo contraste. */
export function coresDoTotal(estilo: Estilo): { fundo: string; texto: string } {
  const fundo = estilo.personalizado ? estilo.cor : TINTA;
  const [r, g, b] = hexParaRgb(fundo).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminancia = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { fundo, texto: luminancia > 0.35 ? TINTA : '#FFFFFF' };
}

/** Logo da Orçaí (símbolo + "orçaí" + IMOB) em SVG, para a imagem e para virar PNG no PDF. */
export function lockupOrcaiSvg(altura = 64) {
  const e = altura / 64;
  return `<g transform="scale(${e})">
    <rect width="64" height="64" rx="15" fill="#2342D6"/>
    <path d="M18 11H46V51L42 47L38 51L34 47L30 51L26 47L22 51L18 47Z" fill="#FFFFFF"/>
    <rect x="23" y="18" width="18" height="3" rx="1.5" fill="#AFC0F5"/>
    <rect x="23" y="24" width="12" height="3" rx="1.5" fill="#AFC0F5"/>
    <rect x="21" y="32" width="22" height="9" rx="2" fill="#FFD24A"/>
    <rect x="24" y="35" width="16" height="3" rx="1.5" fill="#101828"/>
    <text x="80" y="46" font-family="'DejaVu Sans', Arial, sans-serif" font-weight="700" font-size="40" letter-spacing="-1.5" fill="${TINTA}">orça<tspan fill="#2342D6">í</tspan></text>
    <rect x="200" y="20" width="62" height="26" rx="6" fill="${TINTA}"/>
    <text x="231" y="39" text-anchor="middle" font-family="'DejaVu Sans', Arial, sans-serif" font-weight="700" font-size="15" letter-spacing="1.5" fill="#FFFFFF">IMOB</text>
  </g>`;
}
export const LARGURA_LOCKUP = 262; // em unidades do símbolo (altura 64)

let lockupPng: Promise<Buffer> | null = null;
/** PNG da logo Orçaí (alta resolução), feito uma vez. */
export function logoOrcaiPng() {
  lockupPng ??= sharp(Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA_LOCKUP * 4}" height="256" viewBox="0 0 ${LARGURA_LOCKUP} 64">${lockupOrcaiSvg(64)}</svg>`,
  )).png().toBuffer();
  return lockupPng;
}
