import { describe, expect, it } from 'vitest';
import { lerNome, origemDaMensagem } from './teste';

describe('teste grátis pelo WhatsApp', () => {
  it('lê o nome em respostas comuns', () => {
    expect(lerNome('Pedro')).toEqual({ nome: 'Pedro', sobrenome: null });
    expect(lerNome('meu nome é pedro ivo clemente')).toEqual({ nome: 'Pedro', sobrenome: 'Ivo Clemente' });
    expect(lerNome('Oi, sou a Maria da Silva.')).toEqual({ nome: 'Maria', sobrenome: 'da Silva' });
    expect(lerNome('Me chamo João')).toEqual({ nome: 'João', sobrenome: null });
  });

  it('não confunde pedido com nome', () => {
    expect(lerNome('escritura de 350 mil')).toBeNull();
    expect(lerNome('1')).toBeNull();
    expect(lerNome('')).toBeNull();
  });

  it('origem pelo código da mensagem do botão do site', () => {
    expect(origemDaMensagem('Quero testar o Orça.ai grátis! Código: site-inicio')).toBe('site-inicio');
    expect(origemDaMensagem('oi')).toBe('whatsapp');
  });
});
