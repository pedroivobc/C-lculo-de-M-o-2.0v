import { describe, expect, it } from 'vitest';
import { normalizarCodigo, prefixoDoNome } from './indicacao';

describe('cupom de indicação', () => {
  it('normaliza o que a pessoa digita', () => {
    expect(normalizarCodigo(' pedro-7k2 ')).toBe('PEDRO7K2');
    expect(normalizarCodigo('joão 9xy')).toBe('JOAO9XY');
  });
  it('usa o primeiro nome como prefixo', () => {
    expect(prefixoDoNome('Pedro Ivo Clemente')).toBe('PEDRO');
    expect(prefixoDoNome('Maximiliano Souza')).toBe('MAXIMILI');
    expect(prefixoDoNome('Zé')).toBe('ORCAI');
    expect(prefixoDoNome(null)).toBe('ORCAI');
  });
});
