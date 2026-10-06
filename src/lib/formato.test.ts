import { describe, expect, it } from 'vitest';
import { centavosParaTexto, mascararDigitando, textoParaCentavos } from './formato';

describe('máscara de dinheiro R$ 000.000,00', () => {
  it('o que se digita são reais', () => {
    expect(textoParaCentavos('350000')).toBe(35000000);
    expect(mascararDigitando('350000')).toBe('350.000');
    expect(centavosParaTexto(textoParaCentavos('350000'))).toBe('350.000,00');
  });
  it('a vírgula abre os centavos', () => {
    expect(mascararDigitando('350000,5')).toBe('350.000,5');
    expect(textoParaCentavos('350.000,50')).toBe(35000050);
    expect(textoParaCentavos('1.234,567')).toBe(123456);
  });
  it('continuar digitando sobre o valor mascarado', () => {
    expect(mascararDigitando('350.0001')).toBe('3.500.001');
    expect(mascararDigitando('')).toBe('');
    expect(mascararDigitando(',')).toBe('0,');
  });
});
