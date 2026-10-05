import { describe, expect, it } from 'vitest';
import { calcular } from './index';

// Casos de referência: os mesmos números das telas atuais (seção 5 do plano).
describe('cálculos de referência', () => {
  it('escritura compra e venda simples', () => {
    const r = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 320000, valorVenal: 350000 });
    expect(r.bases).toEqual([350000]);
    expect(r.total).toBe(19044.99);
    expect(r.linhas.find((l) => l.rotulo === 'ITBI')).toMatchObject({ valor: 7000, origem: 'municipio' });
  });

  it('financiamento Caixa SBPE, primeiro imóvel', () => {
    const r = calcular('financiamento_caixa', {
      modalidade: 'SBPE', valorDeclarado: 320000, valorVenal: 350000, valorFinanciado: 280000,
      primeiroImovel: true, honorarios: 1000,
    });
    expect(r.total).toBe(17942.73);
  });

  it('banco privado Itaú SBPE', () => {
    const r = calcular('banco_privado', {
      banco: 'itau', modalidade: 'SBPE', valorDeclarado: 480000, valorVenal: 500000, valorFinanciado: 400000,
    });
    expect(r.total).toBe(22474.22);
  });

  it('doação simples (tela de Doação)', () => {
    const r = calcular('doacao', { subtipo: 'doacao_simples', valorAtribuido: 280000, avaliacaoFazenda: 300000 });
    expect(r.total).toBe(19383.77);
  });

  it('ITCD sobe para 5% acima de R$ 440 mil', () => {
    const r = calcular('doacao', { subtipo: 'doacao_simples', valorAtribuido: 500000, avaliacaoFazenda: 0 });
    expect(r.linhas[0].valor).toBe(25000);
  });

  it('correção INCC de 2015', () => {
    const r = calcular('correcao', { valorOriginal: 180000, anoContrato: 2015 });
    expect(r.total).toBe(330492.46);
    expect(r.detalhes?.variacaoPercent).toBe(83.61);
  });

  it('aceita números vindos como texto (agente/API)', () => {
    const r = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: '320000', valorVenal: '350000' });
    expect(r.total).toBe(19044.99);
  });

  it('recusa município ainda não atendido', () => {
    expect(() => calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 1, valorVenal: 1, municipio: 'mg-barbacena' }))
      .toThrow(/ainda não atendido/);
  });
});
