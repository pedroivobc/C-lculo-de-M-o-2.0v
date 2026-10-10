import { describe, expect, it } from 'vitest';
import { calcularItbi } from './itbi';

const SP = '3550308', RJ = '3304557', DF = '5300108', FOR = '2304400', SSA = '2927408';
const fin = { tipoAquisicao: 'financiamento', valorFinanciado: 400000 };

// Casos de teste da pesquisa "Motor de cálculo de ITBI — 5 principais capitais" (10/10/2026).
const CASOS: [string, Record<string, unknown>, number][] = [
  ['SP_AVISTA_500K', { municipioIbge: SP, baseCalculo: 500000 }, 15000],
  ['SP_SFH_500K', { municipioIbge: SP, baseCalculo: 500000, ...fin, sistemaFinanciamento: 'SFH' }, 11975.8],
  ['SP_SFI_500K', { municipioIbge: SP, baseCalculo: 500000, ...fin, sistemaFinanciamento: 'SFI' }, 15000],
  ['SP_ISENTO_240K', { municipioIbge: SP, baseCalculo: 240000, primeiraAquisicao: true, imovelResidencial: true }, 0],
  ['RJ_AVISTA_500K', { municipioIbge: RJ, baseCalculo: 500000 }, 15000],
  ['RJ_FIN_500K', { municipioIbge: RJ, baseCalculo: 500000, ...fin, sistemaFinanciamento: 'SFH' }, 15000],
  ['DF_NOVO_500K', { municipioIbge: DF, baseCalculo: 500000, primeiraTransmissaoImovelNovo: true, atendeDefinicaoImovelNovoDf: true }, 5000],
  ['DF_USADO_500K', { municipioIbge: DF, baseCalculo: 500000 }, 10000],
  ['FOR_AV_ANT_500K', { municipioIbge: FOR, baseCalculo: 500000, pagamentoItbiAntecipado: true }, 10000],
  ['FOR_AV_NANT_500K', { municipioIbge: FOR, baseCalculo: 500000 }, 20000],
  ['FOR_SFH_ANT_500K', { municipioIbge: FOR, baseCalculo: 500000, ...fin, sistemaFinanciamento: 'SFH', pagamentoItbiAntecipado: true }, 4139.92],
  ['FOR_SFH_NANT_500K', { municipioIbge: FOR, baseCalculo: 500000, ...fin, sistemaFinanciamento: 'SFH' }, 6326.47],
  ['SSA_GERAL_500K', { municipioIbge: SSA, baseCalculo: 500000 }, 15000],
  ['SSA_POP_200K', { municipioIbge: SSA, baseCalculo: 200000, imovelPopularReconhecido: true }, 2000],
];

describe('motor de ITBI — 5 capitais', () => {
  it.each(CASOS)('%s', (_id, entrada, esperado) => {
    expect(calcularItbi({ dataFatoGerador: '2026-10-10', ...entrada }).imposto).toBe(esperado);
  });

  it('SP no SFH mostra as duas parcelas', () => {
    const r = calcularItbi({ municipioIbge: SP, baseCalculo: 500000, ...fin, sistemaFinanciamento: 'SFH' });
    expect(r.parcelas.map((p) => p.valor)).toEqual([604.84, 11370.96]);
    expect(r.regra).toBe('SP-2026:sfh');
  });

  it('SP acima do teto de R$ 725.808,00 perde a faixa de 0,5%', () => {
    const r = calcularItbi({ municipioIbge: SP, baseCalculo: 800000, ...fin, sistemaFinanciamento: 'SFH' });
    expect(r.imposto).toBe(24000);
  });

  it('Fortaleza: corretagem com NFS-e reduz a base (FOR-5)', () => {
    const r = calcularItbi({ municipioIbge: FOR, baseCalculo: 500000, valorCorretagemComNfse: 25000, pagamentoItbiAntecipado: true });
    expect(r.baseUtilizada).toBe(475000);
    expect(r.imposto).toBe(9500);
    expect(r.exigeValidacaoDocumental).toBe(true);
  });

  it('isenções e benefícios pedem validação documental', () => {
    expect(calcularItbi({ municipioIbge: SP, baseCalculo: 240000, primeiraAquisicao: true, imovelResidencial: true }).exigeValidacaoDocumental).toBe(true);
    expect(calcularItbi({ municipioIbge: SSA, baseCalculo: 200000, imovelPopularReconhecido: true }).exigeValidacaoDocumental).toBe(true);
    expect(calcularItbi({ municipioIbge: RJ, baseCalculo: 500000 }).exigeValidacaoDocumental).toBe(false);
  });

  it('Salvador não aplica 1% só pelo preço baixo', () => {
    expect(calcularItbi({ municipioIbge: SSA, baseCalculo: 150000 }).imposto).toBe(4500);
  });

  it('recusa município sem regra e data antes da vigência', () => {
    expect(() => calcularItbi({ municipioIbge: '3136702', baseCalculo: 1 })).toThrow(/sem regra/);
    expect(() => calcularItbi({ municipioIbge: DF, baseCalculo: 1, dataFatoGerador: '2024-06-01' })).toThrow(/vigente/);
  });
});
