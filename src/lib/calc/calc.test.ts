import { describe, expect, it } from 'vitest';
import { calcular } from './index';

// Casos de referência. Registro conferido com o relatório final do 3º RI de Juiz de Fora (protocolo 229.352).
describe('cálculos de referência', () => {
  it('escritura compra e venda simples', () => {
    const r = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 320000, valorVenal: 350000 });
    expect(r.bases).toEqual([350000]);
    expect(r.total).toBe(18743.68);
    expect(r.linhas.find((l) => l.rotulo === 'ITBI')).toMatchObject({ valor: 7000, origem: 'municipio' });
  });

  it('financiamento Caixa SBPE, primeiro imóvel', () => {
    const r = calcular('financiamento_caixa', {
      modalidade: 'SBPE', valorDeclarado: 320000, valorVenal: 350000, valorFinanciado: 280000,
      primeiroImovel: true, honorarios: 1000,
    });
    expect(r.total).toBe(17823.87);
  });

  it('banco privado Itaú SBPE', () => {
    const r = calcular('banco_privado', {
      banco: 'itau', modalidade: 'SBPE', valorDeclarado: 480000, valorVenal: 500000, valorFinanciado: 400000,
    });
    expect(r.total).toBe(22367.45);
  });

  it('doação simples (tela de Doação)', () => {
    const r = calcular('doacao', { subtipo: 'doacao_simples', valorAtribuido: 280000, avaliacaoFazenda: 300000 });
    expect(r.total).toBe(19243.68);
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
    expect(r.total).toBe(18743.68);
  });

  it('recusa município ainda não atendido', () => {
    expect(() => calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 1, valorVenal: 1, municipio: 'mg-barbacena' }))
      .toThrow(/ainda não atendido/);
  });

  it('outra cidade de MG usa a alíquota informada pelo assinante', () => {
    const jf = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 320000, valorVenal: 350000 });
    const r = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 320000, valorVenal: 350000, municipio: 'mg-outra', cidade: 'Barbacena', itbiPercentual: 3 });
    const itbi = r.linhas.find((l) => l.rotulo === 'ITBI')!;
    expect(itbi.valor).toBe(10500);
    expect(itbi.origem).toBe('usuario');
    expect(r.municipioNome).toBe('Barbacena');
    expect(r.total).toBe(Math.round((jf.total + 3500) * 100) / 100);
  });

  it('outra cidade sem alíquota pede a alíquota', () => {
    expect(() => calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 1, valorVenal: 1, municipio: 'mg-outra' }))
      .toThrow(/alíquota/);
  });

  it('alíquota igual à da prefeitura não muda a origem', () => {
    const r = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 320000, valorVenal: 350000, itbiPercentual: 2 });
    expect(r.total).toBe(18743.68);
    expect(r.linhas.find((l) => l.rotulo === 'ITBI')!.origem).toBe('municipio');
  });

  it('SFH sem regra da cidade cai na alíquota cheia', () => {
    const r = calcular('financiamento_caixa', { modalidade: 'SBPE', valorDeclarado: 400000, valorVenal: 400000, valorFinanciado: 300000, municipio: 'mg-outra', itbiPercentual: 2 });
    expect(r.linhas.find((l) => l.rotulo.startsWith('ITBI'))!.valor).toBe(8000);
  });

  it('registro igual ao recibo do 3º RI de Juiz de Fora (base R$ 279.670,78)', () => {
    const r = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 279670.78, valorVenal: 0 });
    const reg = r.linhas.find((l) => l.rotulo === 'Registro')!;
    expect(reg.detalhes!.map((d) => [d.rotulo, d.valor])).toEqual([
      ['Ato de registro · compra e venda', 4925.61],
      ['Prenotação', 66.49],
      ['Certidão de inteiro teor', 42.60],
      ['Averbação de inscrição municipal', 37.65],
      ['Averbação de dados pessoais', 37.65],
    ]);
    expect(reg.valor).toBe(5110.00);
  });

  it('escritura = lavratura + arquivamento, com o detalhamento', () => {
    const r = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 350000, valorVenal: 0 });
    const esc = r.linhas.find((l) => l.rotulo === 'Escritura')!;
    expect(esc.detalhes!.map((d) => d.rotulo)).toEqual(['Lavratura', 'Arquivamento']);
    expect(esc.valor).toBe(5050.25 + 347.75);
    expect(r.linhas.some((l) => l.rotulo === 'Lavratura' || l.rotulo === 'Arquivamento')).toBe(false);
  });

  it('toda linha detalhada soma o próprio valor', () => {
    for (const [tipo, dados] of [
      ['escritura', { subtipo: 'interveniencia', valorDeclarado1: 200000, valorVenal1: 0, valorDeclarado2: 260000, valorVenal2: 0 }],
      ['doacao', { subtipo: 'doacao_usufruto', valorAtribuido: 300000, avaliacaoFazenda: 0 }],
      ['financiamento_caixa', { modalidade: 'SBPE', valorDeclarado: 350000, valorVenal: 0, valorFinanciado: 280000, primeiroImovel: true }],
    ] as const) {
      for (const l of calcular(tipo, dados).linhas.filter((x) => x.detalhes)) {
        expect(Math.round(l.detalhes!.reduce((s, d) => s + d.valor, 0) * 100) / 100).toBe(l.valor);
      }
    }
  });
});
