import { describe, expect, it } from 'vitest';
import { brl, calcular, linhaRegistro, textoDasBases } from './index';

// Casos de referência. Registro conferido com o relatório final do 3º RI de Juiz de Fora (protocolo 229.352).
describe('cálculos de referência', () => {
  it('escritura compra e venda simples', () => {
    const r = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 350000 });
    expect(r.bases).toEqual([350000]); // a base é o valor declarado
    expect(r.total).toBe(18743.56);
    expect(r.linhas.find((l) => l.rotulo === 'ITBI')).toMatchObject({ valor: 7000, origem: 'municipio' });
  });

  it('financiamento Caixa SBPE, primeiro imóvel', () => {
    const r = calcular('financiamento_caixa', {
      modalidade: 'SBPE', valorDeclarado: 350000, valorFinanciado: 280000,
      primeiroImovel: true, honorarios: 1000,
    });
    expect(r.total).toBe(17862.20); // com o arquivamento de 16 folhas do contrato
  });

  it('banco privado Itaú SBPE', () => {
    const r = calcular('banco_privado', {
      banco: 'itau', modalidade: 'SBPE', valorDeclarado: 500000, valorFinanciado: 400000,
    });
    expect(r.total).toBe(22590.49); // com o arquivamento de 16 folhas do contrato
  });

  it('doação simples (tela de Doação)', () => {
    const r = calcular('doacao', { subtipo: 'doacao_simples', valorAtribuido: 280000, avaliacaoFazenda: 300000 });
    expect(r.total).toBe(19243.56);
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
    const r = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: '350000' });
    expect(r.total).toBe(18743.56);
  });

  it('recusa município ainda não atendido', () => {
    expect(() => calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 1, municipio: 'mg-barbacena' }))
      .toThrow(/ainda não atendido/);
  });

  it('outra cidade de MG usa a alíquota informada pelo assinante', () => {
    const jf = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 350000 });
    const r = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 350000, municipio: 'mg-outra', cidade: 'Barbacena', itbiPercentual: 3 });
    const itbi = r.linhas.find((l) => l.rotulo === 'ITBI')!;
    expect(itbi.valor).toBe(10500);
    expect(itbi.origem).toBe('usuario');
    expect(r.municipioNome).toBe('Barbacena');
    expect(r.total).toBe(Math.round((jf.total + 3500) * 100) / 100);
  });

  it('Belo Horizonte cobra ITBI de 3% como regra da prefeitura', () => {
    const jf = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 350000 });
    const r = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 350000, municipio: 'mg-belo-horizonte' });
    expect(r.linhas.find((l) => l.rotulo === 'ITBI')).toMatchObject({ valor: 10500, origem: 'municipio' });
    expect(r.municipioNome).toBe('Belo Horizonte');
    // ISS de cartório de 2% em BH (5% em JF): escritura e registro saem um pouco abaixo.
    expect(r.linhas.find((l) => l.rotulo === 'Escritura')!.valor).toBeLessThan(jf.linhas.find((l) => l.rotulo === 'Escritura')!.valor);
    expect(r.total).toBe(22049.57);
  });

  it('outra cidade sem alíquota pede a alíquota', () => {
    expect(() => calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 1, municipio: 'mg-outra' }))
      .toThrow(/alíquota/);
  });

  it('alíquota igual à da prefeitura não muda a origem', () => {
    const r = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 350000, itbiPercentual: 2 });
    expect(r.total).toBe(18743.56);
    expect(r.linhas.find((l) => l.rotulo === 'ITBI')!.origem).toBe('municipio');
  });

  it('SFH sem regra da cidade cai na alíquota cheia', () => {
    const r = calcular('financiamento_caixa', { modalidade: 'SBPE', valorDeclarado: 400000, valorFinanciado: 300000, municipio: 'mg-outra', itbiPercentual: 2 });
    expect(r.linhas.find((l) => l.rotulo.startsWith('ITBI'))!.valor).toBe(8000);
  });

  it('imóvel acima do teto do SFH (R$ 2,25 mi) perde a regra do SFH e os 50% do registro', () => {
    const dentro = calcular('financiamento_caixa', { modalidade: 'SBPE', valorDeclarado: 2250000, valorFinanciado: 1500000, primeiroImovel: true });
    const fora = calcular('financiamento_caixa', { modalidade: 'SBPE', valorDeclarado: 2250000.01, valorFinanciado: 1500000, primeiroImovel: true });
    expect(dentro.linhas.find((l) => l.rotulo.startsWith('ITBI'))!.rotulo).toBe('ITBI (SFH)');
    const itbi = fora.linhas.find((l) => l.rotulo.startsWith('ITBI'))!;
    expect(itbi.rotulo).toBe('ITBI');
    expect(itbi.valor).toBeCloseTo(45000, 1);
    expect(itbi.nota).toMatch(/teto do SFH/);
    const reg = (r: typeof fora) => r.linhas.find((l) => l.rotulo === 'Registro')!.valor;
    expect(reg(fora)).toBeGreaterThan(reg(dentro));
    const banco = calcular('banco_privado', { banco: 'itau', modalidade: 'SBPE', valorDeclarado: 3000000, valorFinanciado: 2000000 });
    expect(banco.linhas.find((l) => l.rotulo.startsWith('ITBI'))!.valor).toBe(60000);
  });

  it('registro igual ao recibo do 3º RI de Juiz de Fora (base R$ 279.670,78)', () => {
    const r = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 279670.78});
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

  // Recibos finais do 1º RGI de Juiz de Fora. Os recibos não trazem o ISS, por isso ISS 0 aqui.
  // O cartório arredonda a TFJ da folha de arquivamento para baixo (1,605 → 1,60): até 1 centavo por folha.
  it('financiamento MCMV, 1º imóvel, igual ao recibo do 1º RGI (protocolo 264.014)', () => {
    const reg = linhaRegistro(
      [{ rotulo: 'Ato de registro · compra e venda', base: 251700 }, { rotulo: 'Ato de registro · alienação fiduciária', base: 100000 }],
      { iss: 0, folhas: 14, reducao: 0.5 },
    );
    expect(reg.detalhes!.map((d) => [d.rotulo, d.valor])).toEqual([
      ['Ato de registro · compra e venda', 2386.04],
      ['Ato de registro · alienação fiduciária', 1464.03],
      ['Prenotação', 31.92],
      ['Arquivamento do contrato', 94.08], // recibo: 93,94
      ['Certidão de inteiro teor', 20.54],
      ['Averbação de inscrição municipal', 18.14],
      ['Averbação de dados pessoais', 36.27], // cobrada sem a redução
    ]);
    expect(reg.valor).toBeCloseTo(4050.88, 0);
  });

  it('financiamento SBPE, 1º imóvel: atos iguais ao recibo do 1º RGI (protocolo 263.001)', () => {
    const reg = linhaRegistro(
      [{ rotulo: 'Compra e venda', base: 290000 }, { rotulo: 'Alienação fiduciária', base: 203000 }],
      { iss: 0, folhas: 16, reducao: 0.5 },
    );
    const valor = (r: string) => reg.detalhes!.find((d) => d.rotulo === r)!.valor;
    expect(valor('Compra e venda')).toBe(2451.77);
    expect(valor('Alienação fiduciária')).toBe(2119.16);
    expect(valor('Prenotação')).toBe(31.92);
    expect(valor('Certidão de inteiro teor')).toBe(20.54);
    expect(valor('Arquivamento do contrato')).toBeCloseTo(107.36, 0);
  });

  it('MCMV tem 50% no registro sempre; SBPE só no 1º imóvel', () => {
    const reg = (modalidade: string, primeiroImovel: boolean) =>
      calcular('financiamento_caixa', { modalidade, valorDeclarado: 251700, valorFinanciado: 100000, primeiroImovel })
        .linhas.find((l) => l.rotulo === 'Registro')!;
    const mcmv = reg('MCMV', false);
    expect(mcmv.detalhes![0].nota).toContain('MCMV: 50%');
    expect(mcmv.valor).toBe(reg('MCMV', true).valor);
    expect(mcmv.valor).toBe(reg('SBPE', true).valor);
    expect(reg('SBPE', false).valor).toBeGreaterThan(mcmv.valor * 1.9);
    expect(reg('SBPE', false).detalhes![0].nota).not.toContain('50%');
  });

  it('financiamento traz o arquivamento do contrato no registro (folhas ajustáveis)', () => {
    const r = calcular('financiamento_caixa', { modalidade: 'SBPE', valorDeclarado: 350000, valorFinanciado: 280000, folhasContrato: 14 });
    const arq = r.linhas.find((l) => l.rotulo === 'Registro')!.detalhes!.find((d) => d.rotulo === 'Arquivamento do contrato')!;
    expect(arq.nota).toContain('14 folhas');
    expect(arq.valor).toBe(195.16); // 14 × (10,22 + 3,21 + ISS 0,51)
  });

  it('escritura igual ao orçamento do cartório de notas (base R$ 472.489,30, 25 folhas)', () => {
    const r = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 472489.30, folhas: 25 });
    const escritura = r.linhas.find((l) => l.rotulo === 'Escritura')!;
    expect(escritura.detalhes!.map((d) => d.valor)).toEqual([5677.79, 347.63]);
    expect(escritura.valor).toBe(6025.42);
  });

  it('escritura = lavratura + arquivamento, com o detalhamento', () => {
    const r = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 350000});
    const esc = r.linhas.find((l) => l.rotulo === 'Escritura')!;
    expect(esc.detalhes!.map((d) => d.rotulo)).toEqual(['Lavratura', 'Arquivamento']);
    expect(esc.valor).toBe(5397.88); // 5.050,25 + 347,63
    expect(r.linhas.some((l) => l.rotulo === 'Lavratura' || l.rotulo === 'Arquivamento')).toBe(false);
  });

  it('toda linha detalhada soma o próprio valor', () => {
    for (const [tipo, dados] of [
      ['escritura', { subtipo: 'interveniencia', valorDeclarado1: 200000, valorDeclarado2: 260000}],
      ['doacao', { subtipo: 'doacao_usufruto', valorAtribuido: 300000, avaliacaoFazenda: 0 }],
      ['financiamento_caixa', { modalidade: 'SBPE', valorDeclarado: 350000, valorFinanciado: 280000, primeiroImovel: true }],
    ] as const) {
      for (const l of calcular(tipo, dados).linhas.filter((x) => x.detalhes)) {
        expect(Math.round(l.detalhes!.reduce((s, d) => s + d.valor, 0) * 100) / 100).toBe(l.valor);
      }
    }
  });
});

describe('base de cálculo com o nome de cada parte', () => {
  it('financiamento separa compra e venda e financiamento', () => {
    const r = calcular('financiamento_caixa', { modalidade: 'SBPE', valorDeclarado: 200000, valorFinanciado: 120000 });
    expect(textoDasBases(r, brl)).toBe(`Compra e venda: ${brl(200000)} · Financiamento: ${brl(120000)}`);
  });
  it('base única sai só com o valor', () => {
    const r = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 350000 });
    expect(textoDasBases(r, brl)).toBe(brl(350000));
  });
});
