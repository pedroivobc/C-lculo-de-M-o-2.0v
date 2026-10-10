import { z } from 'zod';

/**
 * Motor de ITBI por município (pesquisa de 10/10/2026: São Paulo, Rio de Janeiro, Brasília, Fortaleza e Salvador).
 *
 * Cada regra é versionada (vigência, fonte e data de conferência) e devolve a base usada, o imposto, as parcelas
 * do cálculo e se o resultado depende de comprovação documental (isenções e benefícios reconhecidos pela prefeitura).
 *
 * Ainda não aparece no site: só o administrador usa (POST /api/admin/itbi). Os emolumentos de cartório
 * dessas cidades seguem tabelas estaduais que ainda não foram cadastradas (hoje só a de MG).
 */

export const SISTEMAS = ['SFH', 'SFI', 'CH', 'PAR', 'HIS', 'OUTRO'] as const;

const dinheiro = z.coerce.number().nonnegative();
const sim = z.preprocess((v) => (typeof v === 'string' ? ['true', 'sim', '1'].includes(v.toLowerCase()) : v), z.boolean()).default(false);

export const entradaItbi = z.object({
  /** Código IBGE do município (7 dígitos). */
  municipioIbge: z.string().regex(/^\d{7}$/, 'Código IBGE com 7 dígitos'),
  /** Data do fato gerador (AAAA-MM-DD); escolhe a regra vigente. Padrão: hoje. */
  dataFatoGerador: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Valor sujeito às alíquotas (base adotada para a guia). */
  baseCalculo: dinheiro,
  /** Valor declarado no negócio. Padrão: a própria base. */
  valorTransacao: dinheiro.optional(),
  tipoAquisicao: z.enum(['avista', 'financiamento', 'consorcio']).default('avista'),
  /** Sistema de financiamento lido no contrato (não deduzir pelo banco). */
  sistemaFinanciamento: z.enum(SISTEMAS).optional(),
  valorFinanciado: dinheiro.default(0),
  primeiraAquisicao: sim,
  imovelResidencial: sim,
  primeiraTransmissaoImovelNovo: sim,
  atendeDefinicaoImovelNovoDf: sim,
  imovelPopularReconhecido: sim,
  pagamentoItbiAntecipado: sim,
  beneficioMcmvReconhecido: sim,
  valorCorretagemComNfse: dinheiro.default(0),
});
export type EntradaItbi = z.infer<typeof entradaItbi>;

export interface ParcelaItbi { descricao: string; base: number; aliquota: number; valor: number }

export interface ResultadoItbi {
  municipioIbge: string;
  municipio: string;
  uf: string;
  /** Identificador da regra aplicada, ex.: "SP-2026:sfh". */
  regra: string;
  baseUtilizada: number;
  imposto: number;
  parcelas: ParcelaItbi[];
  exigeValidacaoDocumental: boolean;
  observacoes: string[];
  fonte: string;
  vigenciaInicio: string;
  conferidoEm: string;
}

const centavos = (n: number) => Math.round(Number((n * 100).toFixed(6))) / 100;

function parcela(descricao: string, base: number, aliquota: number): ParcelaItbi {
  const b = centavos(base);
  return { descricao, base: b, aliquota, valor: centavos(b * aliquota) };
}

type Calculo = { regra: string; base: number; parcelas: ParcelaItbi[]; validar?: boolean; observacoes?: string[] };

interface RegraMunicipal {
  ibge: string;
  municipio: string;
  uf: string;
  vigenciaInicio: string;
  fonte: string;
  conferidoEm: string;
  calcular: (e: EntradaItbi) => Calculo;
}

const AVISO_BASE = 'A prefeitura pode discordar do valor declarado; a guia usa a base efetivamente adotada (STJ, Tema 1.113).';

// ---------------- São Paulo/SP ----------------
const SP = { aliquota: 0.03, reduzida: 0.005, faixaFinanciada: 120968, tetoImovel: 725808, isencaoAte: 245527.77 };

const saoPaulo2026: RegraMunicipal = {
  ibge: '3550308', municipio: 'São Paulo', uf: 'SP', vigenciaInicio: '2026-01-01', conferidoEm: '2026-10-10',
  fonte: 'Prefeitura de São Paulo: ITBI — Cálculo do Imposto e Imunidades, Isenções e Incentivos (atualização de 13/01/2026)',
  calcular(e) {
    const base = e.baseCalculo;
    const valorTotal = Math.max(base, e.valorTransacao ?? base);
    const isenta = (e.primeiraAquisicao && e.imovelResidencial) || e.beneficioMcmvReconhecido;
    if (isenta && valorTotal <= SP.isencaoAte) {
      return {
        regra: 'SP-2026:isencao', base, parcelas: [], validar: true,
        observacoes: [`Isenção: primeira aquisição residencial por pessoa física ou PMCMV, até R$ 245.527,77. Depende de comprovação dos requisitos municipais.`],
      };
    }
    const elegivel = (e.tipoAquisicao === 'financiamento' && ['SFH', 'PAR', 'HIS'].includes(e.sistemaFinanciamento ?? ''))
      || e.tipoAquisicao === 'consorcio';
    if (elegivel && base <= SP.tetoImovel) {
      const faixa = Math.min(e.valorFinanciado, SP.faixaFinanciada, base);
      return {
        regra: 'SP-2026:sfh', base,
        parcelas: [
          parcela('Parte financiada (até R$ 120.968,00) a 0,5%', faixa, SP.reduzida),
          parcela('Restante da base a 3%', base - faixa, SP.aliquota),
        ],
      };
    }
    const observacoes = elegivel ? ['Imóvel acima de R$ 725.808,00: sem a faixa de 0,5% do financiamento.'] : [];
    return { regra: 'SP-2026:geral', base, parcelas: [parcela('Base a 3%', base, SP.aliquota)], observacoes };
  },
};

// ---------------- Rio de Janeiro/RJ ----------------
const rioDeJaneiro2026: RegraMunicipal = {
  ibge: '3304557', municipio: 'Rio de Janeiro', uf: 'RJ', vigenciaInicio: '2026-01-01', conferidoEm: '2026-10-10',
  fonte: 'Secretaria Municipal de Fazenda do Rio de Janeiro: Cálculo do ITBI',
  calcular(e) {
    const obs = e.tipoAquisicao !== 'avista' ? ['No Rio, o financiamento não reduz a alíquota.'] : [];
    return { regra: 'RJ-2026:geral', base: e.baseCalculo, parcelas: [parcela('Base a 3%', e.baseCalculo, 0.03)], observacoes: obs };
  },
};

// ---------------- Brasília/DF ----------------
const brasilia2025: RegraMunicipal = {
  ibge: '5300108', municipio: 'Brasília', uf: 'DF', vigenciaInicio: '2025-01-01', conferidoEm: '2026-10-10',
  fonte: 'Distrito Federal: Lei nº 7.635/2024 e Decreto nº 46.695/2024',
  calcular(e) {
    const base = e.baseCalculo;
    if (e.primeiraTransmissaoImovelNovo && e.atendeDefinicaoImovelNovoDf) {
      return {
        regra: 'DF-2025:imovel-novo', base, parcelas: [parcela('Primeira transmissão de imóvel novo a 1%', base, 0.01)], validar: true,
        observacoes: ['Imóvel novo: primeira transferência onerosa em até 5 anos do ano seguinte ao habite-se (ou em construção sob incorporação, com matrícula individualizada).'],
      };
    }
    return { regra: 'DF-2025:geral', base, parcelas: [parcela('Base a 2%', base, 0.02)] };
  },
};

// ---------------- Fortaleza/CE ----------------
const FOR = { cheia: 0.04, antecipada: 0.02, reduzida: 0.005, faixaSfh: 390672.24 };

const fortaleza2026: RegraMunicipal = {
  ibge: '2304400', municipio: 'Fortaleza', uf: 'CE', vigenciaInicio: '2026-01-01', conferidoEm: '2026-10-10',
  fonte: 'SEFIN Fortaleza: alíquotas e perguntas frequentes (2026); Código Tributário Municipal, LC nº 159/2013 até a LC nº 452/2025',
  calcular(e) {
    const observacoes: string[] = [];
    let validar = false;
    let base = e.baseCalculo;
    if (e.valorCorretagemComNfse > 0) {
      base = Math.max(0, base - e.valorCorretagemComNfse);
      validar = true;
      observacoes.push('Base reduzida pela corretagem comprovada por NFS-e do sistema municipal.');
    }
    if (e.beneficioMcmvReconhecido) {
      return { regra: 'FOR-2026:mcmv', base, parcelas: [], validar: true, observacoes: [...observacoes, 'Isenção do PMCMV: depende do benefício reconhecido pela SEFIN.'] };
    }
    const aliquota = e.pagamentoItbiAntecipado ? FOR.antecipada : FOR.cheia;
    const rotulo = e.pagamentoItbiAntecipado ? '2% (ITBI pago antes do instrumento)' : '4%';
    if (!e.pagamentoItbiAntecipado) observacoes.push('Pagando o ITBI antes da lavratura, a alíquota cai de 4% para 2%.');
    if (e.tipoAquisicao === 'financiamento' && e.sistemaFinanciamento === 'SFH') {
      const faixa = Math.min(e.valorFinanciado, FOR.faixaSfh, base);
      return {
        regra: `FOR-2026:sfh-${e.pagamentoItbiAntecipado ? 'antecipado' : 'normal'}`, base, validar, observacoes,
        parcelas: [
          parcela('Parte financiada no SFH (até R$ 390.672,24) a 0,5%', faixa, FOR.reduzida),
          parcela(`Restante da base a ${rotulo}`, base - faixa, aliquota),
        ],
      };
    }
    return {
      regra: `FOR-2026:geral-${e.pagamentoItbiAntecipado ? 'antecipado' : 'normal'}`, base, validar, observacoes,
      parcelas: [parcela(`Base a ${rotulo}`, base, aliquota)],
    };
  },
};

// ---------------- Salvador/BA ----------------
const salvador2026: RegraMunicipal = {
  ibge: '2927408', municipio: 'Salvador', uf: 'BA', vigenciaInicio: '2026-01-01', conferidoEm: '2026-10-10',
  fonte: 'SEFAZ Salvador: perguntas e respostas sobre base de cálculo, avaliação e alíquotas do ITIV',
  calcular(e) {
    const base = e.baseCalculo;
    if (e.imovelPopularReconhecido) {
      return {
        regra: 'SSA-2026:popular', base, parcelas: [parcela('Imóvel popular reconhecido a 1%', base, 0.01)], validar: true,
        observacoes: ['1% só com o enquadramento de imóvel popular reconhecido pela prefeitura (o preço baixo sozinho não basta).'],
      };
    }
    return { regra: 'SSA-2026:geral', base, parcelas: [parcela('Base a 3% (ITIV)', base, 0.03)] };
  },
};

/** Regras por código IBGE, da mais nova para a mais antiga. */
export const REGRAS_ITBI: Record<string, RegraMunicipal[]> = {};
for (const r of [saoPaulo2026, rioDeJaneiro2026, brasilia2025, fortaleza2026, salvador2026]) {
  (REGRAS_ITBI[r.ibge] ??= []).push(r);
}
for (const lista of Object.values(REGRAS_ITBI)) lista.sort((a, b) => b.vigenciaInicio.localeCompare(a.vigenciaInicio));

/** Municípios atendidos pelo motor (para listas do administrador). */
export const MUNICIPIOS_ITBI = Object.values(REGRAS_ITBI).map(([r]) => ({ ibge: r.ibge, municipio: r.municipio, uf: r.uf }));

const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

export function calcularItbi(dados: unknown): ResultadoItbi {
  const e = entradaItbi.parse(dados);
  const data = e.dataFatoGerador ?? hoje();
  const regras = REGRAS_ITBI[e.municipioIbge];
  if (!regras) throw new Error(`Município ${e.municipioIbge} ainda sem regra de ITBI cadastrada.`);
  const regra = regras.find((r) => r.vigenciaInicio <= data);
  if (!regra) throw new Error(`Sem regra de ITBI de ${regras[0].municipio} vigente em ${data}.`);
  const c = regra.calcular(e);
  return {
    municipioIbge: regra.ibge,
    municipio: regra.municipio,
    uf: regra.uf,
    regra: c.regra,
    baseUtilizada: centavos(c.base),
    imposto: centavos(c.parcelas.reduce((s, p) => s + p.valor, 0)),
    parcelas: c.parcelas,
    exigeValidacaoDocumental: !!c.validar,
    observacoes: [...(c.observacoes ?? []), AVISO_BASE],
    fonte: regra.fonte,
    vigenciaInicio: regra.vigenciaInicio,
    conferidoEm: regra.conferidoEm,
  };
}
