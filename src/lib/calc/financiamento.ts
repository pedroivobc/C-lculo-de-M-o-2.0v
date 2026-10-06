import { z } from 'zod';
import { camposLocalidade, itbiSfh, obterMunicipio, percentual, type Municipio } from './municipios';
import { FOLHAS_CONTRATO, linhaRegistro } from './registro';
import { Linha, Resultado, somar } from './tipos';

const valor = z.coerce.number().nonnegative();
const booleano = z.preprocess((v) => (typeof v === 'string' ? ['true', 'sim', '1'].includes(v.toLowerCase()) : v), z.boolean());

const comum = {
  valorDeclarado: valor,
  valorFinanciado: valor,
  primeiroImovel: booleano.default(false),
  certidoes: valor.default(260.07),
  /** Folhas do contrato, arquivadas no Registro de Imóveis (contratos da Caixa: 14 a 16). */
  folhasContrato: z.coerce.number().int().min(1).max(200).default(FOLHAS_CONTRATO),
  ...camposLocalidade,
};

/** Teto nacional do valor do imóvel no SFH. Acima dele o contrato é SFI: sem redução no ITBI nem nos 50% do registro. */
export const TETO_SFH = 2250000;

/** Linha do ITBI no financiamento. `pedeSfh` = modalidade do SFH; só vale se o imóvel couber no teto. */
function linhaItbi(m: Municipio, base: number, fin: number, pedeSfh: boolean): Linha {
  const sfh = pedeSfh && base <= TETO_SFH;
  const regra = sfh && m.itbi.sfh ? `Regra do SFH (${percentual(m.itbi.aliquota)} sobre a parte não financiada)` : percentual(m.itbi.aliquota);
  const foraDoTeto = pedeSfh && !sfh ? ' · imóvel acima do teto do SFH (R$ 2,25 mi)' : '';
  return {
    rotulo: sfh ? 'ITBI (SFH)' : 'ITBI',
    valor: sfh ? itbiSfh(m, base, fin) : base * m.itbi.aliquota,
    origem: m.itbiDoUsuario ? 'usuario' : 'municipio',
    nota: `${regra} · ${m.nome}${foraDoTeto}`,
  };
}

/**
 * Registro do contrato de financiamento: registro da compra (pelo valor do imóvel) e da alienação fiduciária
 * (pelo valor financiado), prenotação, arquivamento das folhas do contrato, certidão e averbações.
 * Redução de 50% nos atos do título: sempre no MCMV; no SBPE, só no 1º imóvel (conferido com recibos do 1º RGI de Juiz de Fora).
 */
function registroFinanciamento(m: Municipio, atos: { compra?: number; alienacao?: number }, folhas: number, reducao?: string) {
  const lista: { rotulo: string; base: number }[] = [];
  if (atos.compra !== undefined) lista.push({ rotulo: 'Ato de registro · compra e venda', base: atos.compra });
  if (atos.alienacao !== undefined) lista.push({ rotulo: 'Ato de registro · alienação fiduciária', base: atos.alienacao });
  return linhaRegistro(lista, { iss: m.issCartorio, folhas, reducao: reducao ? 0.5 : 0, notaReducao: reducao });
}

/** Nota da redução de 50% no registro, ou undefined quando não há: MCMV sempre; SBPE só no 1º imóvel; fora do SFH, nunca. */
function reducaoSfh(modalidade: string, sfh: boolean, primeiroImovel: boolean) {
  if (!sfh) return undefined;
  if (modalidade === 'MCMV') return 'MCMV: 50%';
  return primeiroImovel ? '1º imóvel no SFH: 50%' : undefined;
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
  const base = e.valorDeclarado;
  const fin = e.valorFinanciado;
  const pct = e.taxaPercent / 100;
  const honorarios = e.honorarios ?? (e.modalidade === 'FGTS' ? 1200 : 700);

  const taxa =
    e.modalidade === 'MCMV' ? 1000 + fin * pct
    : e.modalidade === 'FGTS' ? (base <= 350000 ? 1600 : 3200)
    : 1800 + fin * pct;

  const pedeSfh = e.modalidade === 'SBPE' || e.modalidade === 'MCMV';
  const sfh = pedeSfh && base <= TETO_SFH;
  const registro =
    e.modalidade === 'EGI' ? registroFinanciamento(m, { alienacao: fin }, e.folhasContrato)
    : e.modalidade === 'FGTS' ? registroFinanciamento(m, { compra: base }, e.folhasContrato)
    : registroFinanciamento(m, { compra: base, alienacao: fin }, e.folhasContrato, reducaoSfh(e.modalidade, sfh, e.primeiroImovel));

  const linhas: Linha[] = [
    { rotulo: 'Taxa Caixa', valor: taxa, origem: 'banco', nota: e.modalidade },
    e.modalidade === 'EGI'
      ? { rotulo: 'ITBI', valor: 0, origem: m.itbiDoUsuario ? 'usuario' : 'municipio', nota: `Sem transmissão (garantia) · ${m.nome}` }
      : linhaItbi(m, base, fin, pedeSfh),
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
  const base = e.valorDeclarado;
  const fin = e.valorFinanciado;
  const sbpe = e.modalidade === 'SBPE';
  const linhas: Linha[] = [
    { rotulo: 'Tarifa de contrato', valor: TARIFA_BANCO[e.banco], origem: 'banco', nota: e.banco },
    linhaItbi(m, base, fin, sbpe),
    registroFinanciamento(m, { compra: base, alienacao: fin }, e.folhasContrato, reducaoSfh(e.modalidade, sbpe && base <= TETO_SFH, e.primeiroImovel)),
    { rotulo: 'Certidões', valor: e.certidoes, origem: 'usuario' },
    { rotulo: 'Honorários', valor: e.honorarios, origem: 'usuario' },
  ];
  return { tipo: 'banco_privado', subtipo: `${e.banco}_${e.modalidade}`, municipio: m.id, municipioNome: m.nome, bases: [base, fin], linhas, total: somar(linhas) };
}
