import { describe, expect, it } from 'vitest';
import { ehAutonomo } from './parceiro';

describe('ehAutonomo', () => {
  it('reconhece as formas de escrever autônomo', () => {
    for (const t of ['Autônomo', 'autonomo', ' AUTÔNOMO ', 'Corretor autônomo', 'autônoma']) expect(ehAutonomo(t)).toBe(true);
  });
  it('não confunde com imobiliária', () => {
    for (const t of ['Imobiliária Autônomo Centro', '', null, 'Clemente']) expect(ehAutonomo(t)).toBe(false);
  });
});
