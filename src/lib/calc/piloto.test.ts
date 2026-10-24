import { describe, expect, it } from 'vitest';
import { avisoDasTabelas, calcular, cidadeDoResultado } from './index';

// Capitais em teste piloto: valores de referência para R$ 500 mil (fontes em docs/piloto-capitais/README.md).
const linha = (r: ReturnType<typeof calcular>, rotulo: string) => r.linhas.find((l) => l.rotulo === rotulo)?.valor;
const escritura = (municipio: string) => calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 500000, municipio });
const caixa = (municipio: string) => calcular('financiamento_caixa', {
  modalidade: 'SBPE', valorDeclarado: 500000, valorFinanciado: 400000, primeiroImovel: true, municipio,
});

describe('capitais em teste piloto', () => {
  it.each([
    ['sp-sao-paulo', 15000, 5427.43, 3326.8],
    ['rj-rio-de-janeiro', 15000, 4079.07, 4033.24],
    ['df-brasilia', 10000, 2490.81, 1383.78],
    ['pr-curitiba', 13500, 2501.19, 1301.92],
    ['rs-porto-alegre', 15000, 2604.69, 2591.14],
    ['sc-balneario-camboriu', 15000, 3119.59, 3054.55],
  ])('escritura de compra e venda em %s', (municipio, itbi, notas, registro) => {
    const r = escritura(municipio);
    expect(linha(r, 'ITBI')).toBe(itbi);
    expect(linha(r, 'Escritura')).toBe(notas);
    expect(linha(r, 'Registro')).toBe(registro);
    expect(r.piloto).toBe(true);
  });

  it('São Paulo: 0,5% sobre o financiado até R$ 120.968,00 no SFH', () => {
    expect(linha(caixa('sp-sao-paulo'), 'ITBI (SFH)')).toBe(11975.8);
    const caro = calcular('financiamento_caixa', { modalidade: 'SBPE', valorDeclarado: 800000, valorFinanciado: 400000, municipio: 'sp-sao-paulo' });
    expect(linha(caro, 'ITBI (SFH)')).toBe(24000); // acima de R$ 725.808,00 não tem a faixa
  });

  it('Porto Alegre e Balneário Camboriú: alíquota menor sobre o financiado', () => {
    expect(linha(caixa('rs-porto-alegre'), 'ITBI (SFH)')).toBe(5000);
    expect(linha(caixa('sc-balneario-camboriu'), 'ITBI (SFH)')).toBe(7000);
  });

  it('Curitiba: faixa do financiamento vale sobre o valor inteiro', () => {
    const r = calcular('financiamento_caixa', { modalidade: 'SBPE', valorDeclarado: 200000, valorFinanciado: 160000, municipio: 'pr-curitiba' });
    expect(linha(r, 'ITBI (SFH)')).toBe(1000);
  });

  it('Curitiba: Funrejus de 0,2% entra no registro quando não há escritura', () => {
    const r = caixa('pr-curitiba');
    expect(linha(r, 'Registro')).toBe(2301.92);
    expect(r.linhas.find((l) => l.rotulo === 'Registro')?.detalhes?.some((d) => /Funrejus/.test(d.rotulo))).toBe(true);
  });

  it('Rio de Janeiro: sem redução de ITBI no financiamento', () => {
    expect(linha(caixa('rj-rio-de-janeiro'), 'ITBI (SFH)')).toBe(15000);
  });

  it('doação ainda não está disponível no piloto', () => {
    expect(() => calcular('doacao', { subtipo: 'doacao_simples', valorAtribuido: 300000, avaliacaoFazenda: 0, municipio: 'sp-sao-paulo' }))
      .toThrow(/Doação ainda não está disponível em São Paulo/);
  });

  it('o orçamento mostra a cidade e o aviso do piloto', () => {
    const r = escritura('df-brasilia');
    expect(cidadeDoResultado(r)).toContain('Brasília (DF)');
    expect(avisoDasTabelas(r)).toMatch(/piloto/);
  });
});
