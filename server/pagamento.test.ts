import { describe, expect, it } from 'vitest';
import { chaveDoPreco, dataDoCancelamento, somarMeses, statusDaStripe } from './pagamento';

describe('pagamento', () => {
  it('soma meses sem pular para o mês seguinte', () => {
    expect(somarMeses(new Date('2026-01-31T12:00:00Z'), 1).toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(somarMeses(new Date('2026-10-09T12:00:00Z'), 3).toISOString().slice(0, 10)).toBe('2027-01-09');
    expect(somarMeses(new Date('2026-10-09T12:00:00Z'), 12).toISOString().slice(0, 10)).toBe('2027-10-09');
  });

  it('cancelamento só vale depois da fidelidade', () => {
    const agora = new Date('2026-11-01T00:00:00Z');
    const fidelidade = new Date('2027-01-09T00:00:00Z');
    const mesPago = new Date('2026-11-09T00:00:00Z');
    expect(dataDoCancelamento(fidelidade, mesPago, agora)).toEqual(fidelidade);
    // Fidelidade cumprida: vale no fim do mês já pago.
    expect(dataDoCancelamento(new Date('2026-10-01T00:00:00Z'), mesPago, agora)).toEqual(mesPago);
  });

  it('traduz o status da Stripe', () => {
    expect(statusDaStripe('active')).toBe('ativa');
    expect(statusDaStripe('past_due')).toBe('atrasada');
    expect(statusDaStripe('canceled')).toBe('cancelada');
    expect(statusDaStripe('incomplete')).toBe('pendente');
  });

  it('um preço por plano, período e forma', () => {
    expect(chaveDoPreco('pro', 'anual', 'pix')).toBe('orcai_pro_anual_pix');
  });
});
