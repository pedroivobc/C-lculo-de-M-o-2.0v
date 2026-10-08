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
