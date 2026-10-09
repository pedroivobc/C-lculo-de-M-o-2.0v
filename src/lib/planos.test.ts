import { describe, expect, it } from 'vitest';
import { cobranca, formasDoPeriodo, PERIODOS, preco, type Nivel, type Periodo } from './planos';

describe('cobrança', () => {
  it('as parcelas do cartão somam o total do período', () => {
    for (const nivel of ['usuario', 'pro'] as Nivel[]) {
      for (const periodo of ['trimestral', 'semestral', 'anual'] as Periodo[]) {
        expect(cobranca(nivel, periodo, 'cartao').centavos * PERIODOS[periodo].meses).toBe(preco(nivel, periodo).total);
      }
    }
  });

  it('cobra os valores combinados', () => {
    expect(cobranca('usuario', 'trimestral', 'cartao').centavos).toBe(2990);
    expect(cobranca('usuario', 'semestral', 'cartao').centavos).toBe(2691);
    expect(cobranca('usuario', 'anual', 'cartao').centavos).toBe(2392);
    expect(cobranca('pro', 'anual', 'cartao').centavos).toBe(3192);
    expect(cobranca('usuario', 'anual', 'pix').centavos).toBe(28704);
    expect(cobranca('pro', 'anual', 'pix').centavos).toBe(38304);
  });

  it('Pix só no anual', () => {
    expect(formasDoPeriodo('trimestral')).toEqual(['cartao']);
    expect(formasDoPeriodo('anual')).toEqual(['cartao', 'pix']);
    expect(() => cobranca('pro', 'semestral', 'pix')).toThrow();
  });
});
