import { describe, expect, it } from 'vitest';
import { EQUIPE, precoEquipe, usaWhatsapp } from './planos';

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
