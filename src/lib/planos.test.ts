import { describe, expect, it } from 'vitest';
import { cobranca, descontoMaximo, EQUIPE, formasDoPeriodo, PERIODOS, preco, precoEquipe, usaWhatsapp, type Nivel, type Periodo } from './planos';

describe('cobrança', () => {
  it('as parcelas do cartão somam o total do período', () => {
    for (const nivel of ['usuario', 'pro'] as Nivel[]) {
      for (const periodo of ['trimestral', 'semestral', 'anual'] as Periodo[]) {
        expect(cobranca(nivel, periodo, 'cartao').centavos * PERIODOS[periodo].meses).toBe(preco(nivel, periodo).total);
      }
    }
  });

  it('cobra os valores combinados', () => {
    expect(cobranca('usuario', 'trimestral', 'cartao').centavos).toBe(1290);
    expect(cobranca('usuario', 'semestral', 'cartao').centavos).toBe(1190);
    expect(cobranca('usuario', 'anual', 'cartao').centavos).toBe(990);
    expect(cobranca('pro', 'trimestral', 'cartao').centavos).toBe(2490);
    expect(cobranca('pro', 'semestral', 'cartao').centavos).toBe(2190);
    expect(cobranca('pro', 'anual', 'cartao').centavos).toBe(1990);
    expect(cobranca('usuario', 'anual', 'pix').centavos).toBe(11880);
    expect(cobranca('pro', 'anual', 'pix').centavos).toBe(23880);
  });

  it('mostra o desconto sobre o trimestral', () => {
    expect(preco('usuario', 'anual').descontoTexto).toBe('23% off');
    expect(preco('pro', 'anual').descontoTexto).toBe('20% off');
    expect(preco('pro', 'trimestral').descontoTexto).toBe('');
    expect(descontoMaximo('semestral')).toBe(12);
  });

  it('Pix só no anual', () => {
    expect(formasDoPeriodo('trimestral')).toEqual(['cartao']);
    expect(formasDoPeriodo('anual')).toEqual(['cartao', 'pix']);
    expect(() => cobranca('pro', 'semestral', 'pix')).toThrow();
  });
});

describe('plano de equipe', () => {
  it('cobra só o fixo dentro do pacote', () => {
    const p = precoEquipe(EQUIPE.assentosBase);
    expect(p.adicionais).toBe(0);
    expect(p.mensal).toBe(EQUIPE.fixoMensalCentavos);
  });

  it('soma um adicional por usuário além do pacote', () => {
    const p = precoEquipe(8, 5);
    expect(p.adicionais).toBe(3);
    expect(p.mensal).toBe(EQUIPE.fixoMensalCentavos + 3 * EQUIPE.adicionalMensalCentavos);
  });

  it('Starter não usa o WhatsApp; os demais perfis usam', () => {
    expect(usaWhatsapp('usuario')).toBe(false);
    for (const p of ['admin', 'teams', 'pro', 'trial', 'clemente'] as const) expect(usaWhatsapp(p)).toBe(true);
  });
});

describe('cobrança da equipe', () => {
  it('não tem plano mensal: só trimestral, semestral (10% off) e anual (20% off)', () => {
    const p = precoEquipe(5, 5);
    expect(Object.keys(p.periodos)).toEqual(['trimestral', 'semestral', 'anual']);
    expect(p.periodos.trimestral.total).toBe(EQUIPE.fixoMensalCentavos * 3);
    expect(p.periodos.anual.total).toBe(Math.round(EQUIPE.fixoMensalCentavos * 12 * 0.8));
  });
});
