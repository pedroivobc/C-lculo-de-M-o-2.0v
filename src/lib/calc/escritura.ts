import { z } from 'zod';
import { obterMunicipio, MUNICIPIO_PADRAO } from './municipios';
import { MG, aliquotaItcd } from './uf';
import { Linha, Resultado, somar } from './tipos';

const valor = z.coerce.number().nonnegative();

const custosDoUsuario = {
  folhas: z.coerce.number().int().positive().default(25),
  certidoes: valor.default(400),
  honorarios: valor.default(700),
  municipio: z.string().default(MUNICIPIO_PADRAO),
};

export const entradaEscritura = z.discriminatedUnion('subtipo', [
  z.object({ subtipo: z.literal('compra_venda_simples'), valorDeclarado: valor, valorVenal: valor, ...custosDoUsuario }),
  z.object({
    subtipo: z.literal('interveniencia'),
    valorDeclarado1: valor, valorVenal1: valor, valorDeclarado2: valor, valorVenal2: valor,
    ...custosDoUsuario,
  }),
  z.object({ subtipo: z.literal('compra_vinculo'), valorDeclaradoCompra: valor, valorVenalCompra: valor, valorVinculo: valor, ...custosDoUsuario }),
  z.object({ subtipo: z.literal('doacao_simples'), valorAtribuido: valor, avaliacaoFazenda: valor, ...custosDoUsuario }),
  z.object({ subtipo: z.literal('doacao_usufruto'), valorAtribuido: valor, avaliacaoFazenda: valor, ...custosDoUsuario }),
  z.object({ subtipo: z.literal('renuncia_usufruto'), valorAtribuido: valor, avaliacaoFazenda: valor, ...custosDoUsuario }),
]);
export type EntradaEscritura = z.infer<typeof entradaEscritura>;

export const ROTULO_SUBTIPO_ESCRITURA: Record<EntradaEscritura['subtipo'], string> = {
  compra_venda_simples: 'Compra e venda simples',
  interveniencia: 'Com interveniência',
  compra_vinculo: 'Compra + vínculo',
  doacao_simples: 'Doação simples',
  doacao_usufruto: 'Doação com usufruto',
  renuncia_usufruto: 'Renúncia de usufruto',
};

/** Espelha src/components/Escrituras.tsx. */
export function calcularEscritura(dados: EntradaEscritura): Resultado {
  const e = entradaEscritura.parse(dados);
  const m = obterMunicipio(e.municipio);
  const lav = MG.lavratura;
  const reg = MG.registroEscritura;
  const linhas: Linha[] = [];
  let bases: number[] = [];

  const itbi = (base: number, ato?: string) =>
    linhas.push({ rotulo: ato ? `ITBI · ${ato}` : 'ITBI', valor: base * m.itbi.aliquota, origem: 'municipio', nota: `${m.itbi.aliquota * 100}% · ${m.nome}` });
  const lavratura = (base: number, ato?: string) =>
    linhas.push({ rotulo: ato ? `Lavratura · ${ato}` : 'Lavratura', valor: lav(base), origem: 'uf', nota: 'Tabela de emolumentos de MG' });
  const registro = (valorReg: number, ato?: string, nota?: string) =>
    linhas.push({ rotulo: ato ? `Registro · ${ato}` : 'Registro', valor: valorReg, origem: 'uf', nota });

  switch (e.subtipo) {
    case 'compra_venda_simples': {
      const base = Math.max(e.valorDeclarado, e.valorVenal);
      bases = [base];
      itbi(base);
      lavratura(base);
      registro(lav(base) + reg.base, undefined, `Lavratura + R$ ${reg.base.toFixed(2).replace('.', ',')}`);
      break;
    }
    case 'interveniencia': {
      const b1 = Math.max(e.valorDeclarado1, e.valorVenal1);
      const b2 = Math.max(e.valorDeclarado2, e.valorVenal2);
      bases = [b1, b2];
      itbi(b1, '1º ato'); itbi(b2, '2º ato');
      lavratura(b1, '1º ato'); lavratura(b2, '2º ato');
      registro(lav(b1) + reg.base, '1º ato');
      registro(lav(b2) + reg.reduzido, '2º ato', 'Registro reduzido');
      break;
    }
    case 'compra_vinculo': {
      const bc = Math.max(e.valorDeclaradoCompra, e.valorVenalCompra);
      const bv = e.valorVinculo;
      bases = [bc, bv];
      itbi(bc, 'compra');
      lavratura(bc, 'compra'); lavratura(bv, 'vínculo');
      registro(lav(bc) + reg.base, 'compra');
      registro(lav(bv) + reg.reduzido, 'vínculo', 'Registro reduzido');
      break;
    }
    case 'doacao_simples':
    case 'doacao_usufruto':
    case 'renuncia_usufruto': {
      linhas.push(...atosDeDoacao(e.subtipo, Math.max(e.valorAtribuido, e.avaliacaoFazenda), reg, (b) => { bases = b; }));
      break;
    }
  }

  linhas.push({ rotulo: 'Arquivamento', valor: e.folhas * MG.precoFolha, origem: 'uf', nota: `${e.folhas} folhas × R$ 13,91` });
  linhas.push({ rotulo: 'Certidões', valor: e.certidoes, origem: 'usuario' });
  linhas.push({ rotulo: 'Honorários', valor: e.honorarios, origem: 'usuario' });

  return { tipo: 'escritura', subtipo: e.subtipo, municipio: m.id, bases, linhas, total: somar(linhas) };
}

/** Atos de doação compartilhados por Escrituras e Doação (que só diferem nos valores de registro). */
export function atosDeDoacao(
  subtipo: 'doacao_simples' | 'doacao_usufruto' | 'renuncia_usufruto',
  base: number,
  reg: { base: number; reduzido: number },
  definirBases: (b: number[]) => void,
): Linha[] {
  const lav = MG.lavratura;
  const linhas: Linha[] = [];
  if (subtipo === 'doacao_simples') {
    const aliq = aliquotaItcd(base);
    definirBases([base]);
    linhas.push({ rotulo: 'ITCD', valor: base * aliq, origem: 'uf', nota: `${(aliq * 100).toFixed(1).replace('.', ',')}% · MG` });
    linhas.push({ rotulo: 'Lavratura', valor: lav(base), origem: 'uf' });
    linhas.push({ rotulo: 'Registro', valor: lav(base) + reg.base, origem: 'uf' });
  } else if (subtipo === 'doacao_usufruto') {
    const bu = base / 3;
    definirBases([base, bu]);
    linhas.push({ rotulo: 'ITCD', valor: base * MG.itcd.aliquotaCheia, origem: 'uf', nota: '5% · MG' });
    linhas.push({ rotulo: 'Lavratura · doação', valor: lav(base), origem: 'uf' });
    linhas.push({ rotulo: 'Lavratura · usufruto', valor: lav(bu), origem: 'uf', nota: '1/3 da base' });
    linhas.push({ rotulo: 'Registro · doação', valor: lav(base) + reg.base, origem: 'uf' });
    linhas.push({ rotulo: 'Registro · usufruto', valor: lav(bu) + reg.reduzido, origem: 'uf' });
  } else {
    definirBases([base]);
    linhas.push({ rotulo: 'ITCD', valor: 0, origem: 'uf', nota: 'Isento' });
    linhas.push({ rotulo: 'Lavratura', valor: lav(base), origem: 'uf' });
    linhas.push({ rotulo: 'Registro', valor: MG.registroRenunciaUsufruto, origem: 'uf' });
  }
  return linhas;
}
