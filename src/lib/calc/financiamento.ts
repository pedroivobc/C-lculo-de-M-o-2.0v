import { z } from 'zod';
import { camposLocalidade, itbiSfh, obterMunicipio, percentual, type Municipio } from './municipios';
import { linhaRegistro } from './registro';
import { Linha, Resultado, somar } from './tipos';

const valor = z.coerce.number().nonnegative();
const booleano = z.preprocess((v) => (typeof v === 'string' ? ['true', 'sim', '1'].includes(v.toLowerCase()) : v), z.boolean());

const comum = {
  valorDeclarado: valor,
  valorVenal: valor,
  valorFinanciado: valor,
  primeiroImovel: booleano.default(false),
  certidoes: valor.default(260.07),
  ...camposLocalidade,
};

const notaItbi = (m: Municipio, sfh: boolean) =>
  `${sfh && m.itbi.sfh ? `Regra do SFH (${percentual(m.itbi.aliquota)} sobre a parte não financiada)` : percentual(m.itbi.aliquota)} · ${m.nome}`;

/**
 * Registro do contrato de financiamento: registro da compra (pelo valor do imóvel) e da alienação fiduciária
 * (pelo valor financiado), mais prenotação, certidão e averbações. No SFH, o primeiro imóvel tem 50% de redução nos atos de registro.
 */
function registroFinanciamento(m: Municipio, atos: { compra?: number; alienacao?: number }, primeiroImovel: boolean) {
  const reducao = primeiroImovel ? 0.5 : undefined;
  const lista: { rotulo: string; base: number; reducao?: number }[] = [];
  if (atos.compra !== undefined) lista.push({ rotulo: 'Ato de registro · compra e venda', base: atos.compra, reducao });
  if (atos.alienacao !== undefined) lista.push({ rotulo: 'Ato de registro · alienação fiduciária', base: atos.alienacao, reducao });
  return linhaRegistro(lista, { iss: m.issCartorio, notaReducao: '1º imóvel no SFH: 50%' });
}

export const entradaCaixa = z.object({
  modalidade: z.enum(['SBPE', 'MCMV', 'SFI', 'EGI', 'FGTS']),
  taxaPercent: valor.default(1.5),
  honorarios: valor.optional(),
  ...comum,
});
export type EntradaCaixa = z.infer<typeof entradaCaixa>;

/** Espelha src/components/FinanciamentoCaixa.tsx. */
export function calcularCaixa(dados: EntradaCaixa): Resultado {
  const e = entradaCaixa.parse(dados);
  const m = obterMunicipio(e.municipio, e);
  const base = Math.max(e.valorDeclarado, e.valorVenal);
  const fin = e.valorFinanciado;
  const pct = e.taxaPercent / 100;
  const honorarios = e.honorarios ?? (e.modalidade === 'FGTS' ? 1200 : 700);

  const taxa =
    e.modalidade === 'MCMV' ? 1000 + fin * pct
    : e.modalidade === 'FGTS' ? (base <= 350000 ? 1600 : 3200)
    : 1800 + fin * pct;

  const itbi =
    e.modalidade === 'SBPE' || e.modalidade === 'MCMV' ? itbiSfh(m, base, fin)
    : e.modalidade === 'EGI' ? 0
    : base * m.itbi.aliquota;

  const sfh = e.modalidade === 'SBPE' || e.modalidade === 'MCMV';
  const registro =
    e.modalidade === 'EGI' ? registroFinanciamento(m, { alienacao: fin }, false)
    : e.modalidade === 'FGTS' ? registroFinanciamento(m, { compra: base }, false)
    : registroFinanciamento(m, { compra: base, alienacao: fin }, sfh && e.primeiroImovel);

  const linhas: Linha[] = [
    { rotulo: 'Taxa Caixa', valor: taxa, origem: 'banco', nota: e.modalidade },
    { rotulo: e.modalidade === 'SBPE' || e.modalidade === 'MCMV' ? 'ITBI (SFH)' : 'ITBI', valor: itbi, origem: m.itbiDoUsuario ? 'usuario' : 'municipio', nota: notaItbi(m, e.modalidade === 'SBPE' || e.modalidade === 'MCMV') },
    registro,
    { rotulo: 'Certidões', valor: e.certidoes, origem: 'usuario' },
    { rotulo: 'Honorários', valor: honorarios, origem: 'usuario' },
  ];
  return { tipo: 'financiamento_caixa', subtipo: e.modalidade, municipio: m.id, municipioNome: m.nome, bases: [base, fin], linhas, total: somar(linhas) };
}

export const TARIFA_BANCO = { itau: 1950, bradesco: 3200, santander: 3200 } as const;

export const entradaBancoPrivado = z.object({
  banco: z.enum(['itau', 'bradesco', 'santander']),
  modalidade: z.enum(['SBPE', 'SFI']),
  honorarios: valor.default(700),
  ...comum,
});
export type EntradaBancoPrivado = z.infer<typeof entradaBancoPrivado>;

/** Espelha src/components/FinanciamentoBancoPrivado.tsx. */
export function calcularBancoPrivado(dados: EntradaBancoPrivado): Resultado {
  const e = entradaBancoPrivado.parse(dados);
  const m = obterMunicipio(e.municipio, e);
  const base = Math.max(e.valorDeclarado, e.valorVenal);
  const fin = e.valorFinanciado;
  const sbpe = e.modalidade === 'SBPE';
  const linhas: Linha[] = [
    { rotulo: 'Tarifa de contrato', valor: TARIFA_BANCO[e.banco], origem: 'banco', nota: e.banco },
    { rotulo: sbpe ? 'ITBI (SFH)' : 'ITBI', valor: sbpe ? itbiSfh(m, base, fin) : base * m.itbi.aliquota, origem: m.itbiDoUsuario ? 'usuario' : 'municipio', nota: notaItbi(m, sbpe) },
    registroFinanciamento(m, { compra: base, alienacao: fin }, sbpe && e.primeiroImovel),
    { rotulo: 'Certidões', valor: e.certidoes, origem: 'usuario' },
    { rotulo: 'Honorários', valor: e.honorarios, origem: 'usuario' },
  ];
  return { tipo: 'banco_privado', subtipo: `${e.banco}_${e.modalidade}`, municipio: m.id, municipioNome: m.nome, bases: [base, fin], linhas, total: somar(linhas) };
}
