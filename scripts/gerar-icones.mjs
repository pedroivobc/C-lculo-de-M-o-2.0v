/** Gera os ícones do app (PWA e iPhone) a partir do símbolo da marca. Uso: node scripts/gerar-icones.mjs */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const simbolo = readFileSync('public/marca/simbolo.svg', 'utf8');
const desenho = simbolo.replace(/^<svg[^>]*>/, '').replace('</svg>', '').replace(/<rect width="64" height="64"[^>]*\/>/, '');
// Fundo inteiro (sem cantos) e o desenho menor, dentro da área segura dos ícones "maskable" e do iPhone.
const cheio = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2342d6"/><g transform="translate(32 32) scale(0.78) translate(-32 -31)">${desenho}</g></svg>`;

const gerar = (svg, tamanho, arquivo) => sharp(Buffer.from(svg), { density: 384 }).resize(tamanho, tamanho).png().toFile(`public/icones/${arquivo}`);
await gerar(simbolo, 192, 'icone-192.png');
await gerar(simbolo, 512, 'icone-512.png');
await gerar(cheio, 512, 'icone-maskable-512.png');
await gerar(cheio, 180, 'apple-touch-icon.png');
console.log('Ícones gerados em public/icones');
