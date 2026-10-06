import { z } from 'zod';
import { obterMunicipio, camposLocalidade, percentual } from './municipios';
import { MG, aliquotaItcd } from './uf';
import { linhaRegistro } from './registro';
import { Detalhe, Linha, Resultado, somar } from './tipos';

const valor = z.coerce.number().nonnegative();

const custosDoUsuario = {
  folhas: z.coerce.number().int().positive().default(25),
  certidoes: valor.default(400),
  honorarios: valor.default(700),
  ...camposLocalidade,
};

export const entradaEscritura = z.discriminatedUnion('subtipo', [
  z.object({ subtipo: z.literal('compra_venda_simples'), valorDeclarado: valor, ...custosDoUsuario }),
  z.object({
    subtipo: z.literal('interveniencia'),
    valorDeclarado1: valor, valorDeclarado2: valor,
    ...custosDoUsuario,
  }),
  z.object({ subtipo: z.literal('compra_vinculo'), valorDeclaradoCompra: valor, valorVinculo: valor, ...custosDoUsuario }),
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

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Linha "Escritura" do tabelionato: lavratura(s) + arquivamento, com o detalhamento. */
export function linhaEscritura(lavraturas: { rotulo: string; base: number }[], folhas: number): Linha {
  const detalhes: Detalhe[] = lavraturas.map((l) => ({ rotulo: l.rotulo, valor: MG.lavratura(l.base), nota: `Tabelionato de notas · base ${brl(l.base)}` }));
  detalhes.push({ rotulo: 'Arquivamento', valor: Math.round(folhas * MG.precoFolha * 100) / 100, nota: `${folhas} folhas × R$ 13,91` });
  return {
    rotulo: 'Escritura',
    valor: Math.round(detalhes.reduce((s, d) => s + d.valor, 0) * 100) / 100,
    origem: 'uf',
    nota: 'Lavratura e arquivamento · tabela de MG',
    detalhes,
  };
}

/** Escrituras de compra e venda e de doação: ITBI/ITCD, escritura (lavratura + arquivamento) e registro. */
export function calcularEscritura(dados: EntradaEscritura): Resultado {
  const e = entradaEscritura.parse(dados);
  const m = obterMunicipio(e.municipio, e);
  const iss = m.issCartorio;
  const linhas: Linha[] = [];
  let bases: number[] = [];

  const itbi = (base: number, ato?: string) =>
    linhas.push({ rotulo: ato ? `ITBI · ${ato}` : 'ITBI', valor: base * m.itbi.aliquota, origem: m.itbiDoUsuario ? 'usuario' : 'municipio', nota: `${percentual(m.itbi.aliquota)} · ${m.nome}${m.itbiDoUsuario ? ' (alíquota informada)' : ''}` });

  switch (e.subtipo) {
    case 'compra_venda_simples': {
      const base = e.valorDeclarado;
      bases = [base];
      itbi(base);
      linhas.push(linhaEscritura([{ rotulo: 'Lavratura', base }], e.folhas));
      linhas.push(linhaRegistro([{ rotulo: 'Ato de registro · compra e venda', base }], { iss }));
      break;
    }
    case 'interveniencia': {
      const b1 = e.valorDeclarado1;
      const b2 = e.valorDeclarado2;
      bases = [b1, b2];
      itbi(b1, '1º ato'); itbi(b2, '2º ato');
      linhas.push(linhaEscritura([{ rotulo: 'Lavratura · 1º ato', base: b1 }, { rotulo: 'Lavratura · 2º ato', base: b2 }], e.folhas));
      linhas.push(linhaRegistro([{ rotulo: 'Ato de registro · 1º ato', base: b1 }, { rotulo: 'Ato de registro · 2º ato', base: b2 }], { iss }));
      break;
    }
    case 'compra_vinculo': {
      const bc = e.valorDeclaradoCompra;
      const bv = e.valorVinculo;
      bases = [bc, bv];
      itbi(bc, 'compra');
      linhas.push(linhaEscritura([{ rotulo: 'Lavratura · compra', base: bc }, { rotulo: 'Lavratura · vínculo', base: bv }], e.folhas));
      linhas.push(linhaRegistro([{ rotulo: 'Ato de registro · compra', base: bc }, { rotulo: 'Ato de registro · vínculo', base: bv }], { iss }));
      break;
    }
    case 'doacao_simples':
    case 'doacao_usufruto':
    case 'renuncia_usufruto': {
      linhas.push(...atosDeDoacao(e.subtipo, Math.max(e.valorAtribuido, e.avaliacaoFazenda), e.folhas, iss, (b) => { bases = b; }));
      break;
    }
  }

  linhas.push({ rotulo: 'Certidões', valor: e.certidoes, origem: 'usuario' });
  linhas.push({ rotulo: 'Honorários', valor: e.honorarios, origem: 'usuario' });

  return { tipo: 'escritura', subtipo: e.subtipo, municipio: m.id, municipioNome: m.nome, bases, linhas, total: somar(linhas) };
}

/** Atos de doação compartilhados por Escrituras e Doação: imposto, escritura e registro. */
export function atosDeDoacao(
  subtipo: 'doacao_simples' | 'doacao_usufruto' | 'renuncia_usufruto',
  base: number,
  folhas: number,
  iss: number,
  definirBases: (b: number[]) => void,
): Linha[] {
  if (subtipo === 'doacao_simples') {
    const aliq = aliquotaItcd(base);
    definirBases([base]);
    return [
      { rotulo: 'ITCD', valor: base * aliq, origem: 'uf', nota: `${(aliq * 100).toFixed(1).replace('.', ',')}% · MG` },
      linhaEscritura([{ rotulo: 'Lavratura', base }], folhas),
      linhaRegistro([{ rotulo: 'Ato de registro · doação', base }], { iss }),
    ];
  }
  if (subtipo === 'doacao_usufruto') {
    // Nota V da Tabela 4: o usufruto vale a terça parte do imóvel.
    const bu = base / 3;
    definirBases([base, bu]);
    return [
      { rotulo: 'ITCD', valor: base * MG.itcd.aliquotaCheia, origem: 'uf', nota: '5% · MG' },
      linhaEscritura([{ rotulo: 'Lavratura · doação', base }, { rotulo: 'Lavratura · usufruto (1/3)', base: bu }], folhas),
      linhaRegistro([{ rotulo: 'Ato de registro · doação', base }, { rotulo: 'Ato de registro · usufruto (1/3)', base: bu }], { iss }),
    ];
  }
  const bu = base / 3;
  definirBases([base]);
  return [
    { rotulo: 'ITCD', valor: 0, origem: 'uf', nota: 'Isento' },
    linhaEscritura([{ rotulo: 'Lavratura', base }], folhas),
    linhaRegistro([{ rotulo: 'Cancelamento do usufruto (1/3)', base: bu, cancelamento: true }], { iss, rotulo: 'Registro (averbação)' }),
  ];
}
