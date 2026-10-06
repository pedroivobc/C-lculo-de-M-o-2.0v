import { describe, expect, it } from 'vitest';
import { extrairCodigo, mensagemDeConfirmacao } from './verificacao';

describe('código de confirmação do WhatsApp', () => {
  it('lê o código da mensagem pré-preenchida pelo site', () => {
    expect(extrairCodigo(mensagemDeConfirmacao('042917'))).toBe('042917');
  });
  it('aceita o código sozinho', () => {
    expect(extrairCodigo(' 042917 ')).toBe('042917');
  });
  it('não confunde valores de um pedido de orçamento com código', () => {
    expect(extrairCodigo('escritura de 350000 em JF')).toBeUndefined();
    expect(extrairCodigo('confirmar valor 3500000')).toBeUndefined();
    expect(extrairCodigo(undefined)).toBeUndefined();
  });
});
