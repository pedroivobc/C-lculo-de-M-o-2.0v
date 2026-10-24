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
    ['sp-sao-paulo', 15000, 5427.43, 3403.38],
    ['rj-rio-de-janeiro', 15000, 4132.41, 4269.91],
    ['df-brasilia', 10000, 2490.81, 1428.06],
    ['pr-curitiba', 13500, 2501.19, 1304.94],
    ['rs-porto-alegre', 15000, 2604.69, 2627.42],
    ['sc-balneario-camboriu', 15000, 3058.64, 2994.76],
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
    expect(linha(r, 'Registro')).toBe(2304.5);
    expect(r.linhas.find((l) => l.rotulo === 'Registro')?.detalhes?.some((d) => /Funrejus/.test(d.rotulo))).toBe(true);
  });

  it('Balneário Camboriú: escritura bate com a tabela 2026 do 1º Tabelionato', () => {
    const esc = (v: number) => linha(calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: v, municipio: 'sc-balneario-camboriu' }), 'Escritura');
    expect(esc(10000)).toBe(214.07);
    expect(esc(250000)).toBe(2745.56);
    expect(esc(500000)).toBe(3058.64);
    expect(esc(5000000)).toBe(7093.91); // teto da tabela
  });

  it('atos acessórios de cada tabela entram no registro e na escritura', () => {
    const detalhes = (r: ReturnType<typeof calcular>, rotulo: string) => r.linhas.find((l) => l.rotulo === rotulo)?.detalhes?.map((d) => d.rotulo) ?? [];
    expect(detalhes(escritura('rj-rio-de-janeiro'), 'Registro')).toEqual(expect.arrayContaining(['Prenotação', 'Certidão da matrícula (com ônus reais)']));
    expect(detalhes(escritura('rj-rio-de-janeiro'), 'Escritura')).toContain('Distribuição da escritura');
    expect(detalhes(escritura('sp-sao-paulo'), 'Registro')).toContain('Certidão da matrícula');
    expect(detalhes(escritura('sp-sao-paulo'), 'Registro')).not.toContain('Prenotação'); // descontada do registro em SP
    expect(detalhes(caixa('pr-curitiba'), 'Registro')).toEqual(expect.arrayContaining(['Prenotação', 'Arquivamento do contrato']));
    expect(detalhes(escritura('sc-balneario-camboriu'), 'Registro')).toEqual(['Ato de registro · compra e venda']); // certidão incluída
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
