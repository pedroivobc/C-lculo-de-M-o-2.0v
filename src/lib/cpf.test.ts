import { describe, expect, it } from 'vitest';
import { cpfValido, mascararCpf } from './cpf';

describe('CPF', () => {
  it('confere os dígitos verificadores', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('123')).toBe(false);
  });
  it('mascara enquanto digita', () => {
    expect(mascararCpf('529')).toBe('529');
    expect(mascararCpf('5299822')).toBe('529.982.2');
    expect(mascararCpf('52998224725')).toBe('529.982.247-25');
  });
});
