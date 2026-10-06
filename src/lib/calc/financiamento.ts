import { z } from 'zod';
import { camposLocalidade, itbiSfh, obterMunicipio, percentual, type Municipio } from './municipios';
import { MG } from './uf';
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

/** Registro do contrato de financiamento (compra + alienação fiduciária). */
function registroFinanciamento(base: number, financiado: number, reducao: boolean) {
  const soma = MG.lavratura(base) + MG.lavratura(financiado);
  return (reducao ? soma / 2 : soma) + MG.adicionalRegistroFinanciamento;
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

  const lavBase = MG.lavratura(base);
  const lavFin = MG.lavratura(fin);
  const registro =
    e.modalidade === 'SBPE' || e.modalidade === 'MCMV' ? registroFinanciamento(base, fin, e.primeiroImovel)
    : e.modalidade === 'SFI' ? registroFinanciamento(base, fin, false)
    : e.modalidade === 'EGI' ? lavFin + MG.adicionalRegistroFinanciamento
    : lavBase + MG.adicionalRegistroFinanciamento;

  const linhas: Linha[] = [
    { rotulo: 'Taxa Caixa', valor: taxa, origem: 'banco', nota: e.modalidade },
    { rotulo: e.modalidade === 'SBPE' || e.modalidade === 'MCMV' ? 'ITBI (SFH)' : 'ITBI', valor: itbi, origem: m.itbiDoUsuario ? 'usuario' : 'municipio', nota: notaItbi(m, e.modalidade === 'SBPE' || e.modalidade === 'MCMV') },
    { rotulo: 'Prenotação', valor: MG.prenotacao, origem: 'uf' },
    { rotulo: 'Registro', valor: registro, origem: 'uf', nota: e.primeiroImovel && (e.modalidade === 'SBPE' || e.modalidade === 'MCMV') ? 'Primeiro imóvel: 50%' : undefined },
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
    { rotulo: 'Prenotação', valor: MG.prenotacao, origem: 'uf' },
    { rotulo: 'Registro', valor: registroFinanciamento(base, fin, sbpe && e.primeiroImovel), origem: 'uf' },
    { rotulo: 'Certidões', valor: e.certidoes, origem: 'usuario' },
    { rotulo: 'Honorários', valor: e.honorarios, origem: 'usuario' },
  ];
  return { tipo: 'banco_privado', subtipo: `${e.banco}_${e.modalidade}`, municipio: m.id, municipioNome: m.nome, bases: [base, fin], linhas, total: somar(linhas) };
}
