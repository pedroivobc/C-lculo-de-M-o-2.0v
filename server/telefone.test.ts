import { describe, expect, it } from 'vitest';
import { normalizarTelefone, telefoneDoJid, variantesTelefone } from './telefone';

describe('telefone', () => {
  it('normaliza formatos comuns', () => {
    expect(normalizarTelefone('(32) 99999-0000')).toBe('+5532999990000');
    expect(normalizarTelefone('+55 32 99999-0000')).toBe('+5532999990000');
    expect(normalizarTelefone('5532999990000@s.whatsapp.net')).toBe('+5532999990000');
    expect(normalizarTelefone('123')).toBeNull();
  });

  it('gera as duas grafias do celular (com e sem o 9)', () => {
    expect(variantesTelefone('+5532999990000')).toEqual(['+5532999990000', '+553299990000']);
    expect(variantesTelefone('+553299990000')).toEqual(['+5532999990000', '+553299990000']);
  });

  it('ignora grupos', () => {
    expect(telefoneDoJid('120363000000000000@g.us')).toBeNull();
    expect(telefoneDoJid('553299990000@s.whatsapp.net')).toBe('+553299990000');
  });
});
