import { describe, expect, it } from 'vitest';
import { calcular } from '../../src/lib/calc';
import { FLUXOS, MENUS, lerOpcao, lerValor, passo, type ContextoMenu, type Estado, type Passo } from './menu';

const ctx: ContextoMenu = { nome: 'Pedro Ivo', formatoPadrao: 'jpeg' };

/** Manda várias mensagens seguidas e devolve o último passo. */
function conversa(...mensagens: string[]): Passo {
  let estado: Estado | null = null;
  let p: Passo | undefined;
  for (const m of mensagens) { p = passo(estado, m, ctx); estado = p.estado; }
  return p!;
}

/** Caminho no menu até cada fluxo, a partir do menu inicial. */
function caminhoAte(fluxo: string): string[] {
  const busca = (menu: string, trilha: string[]): string[] | null => {
    for (const [i, o] of MENUS[menu].opcoes.entries()) {
      if (o.vai === `fluxo:${fluxo}`) return [...trilha, String(i + 1)];
      if (MENUS[o.vai] && o.vai !== 'inicio' && trilha.length < 4) {
        const r = busca(o.vai, [...trilha, String(i + 1)]);
        if (r) return r;
      }
    }
    return null;
  };
  return busca('inicio', [])!;
}

const RESPOSTA: Record<string, string> = { simnao: '1', ano: '2015', valor: '350 mil', valorOuZero: 'não sei' };

describe('menu do WhatsApp', () => {
  it('começa com saudação e o menu inicial', () => {
    const p = conversa('oi');
    expect(p.mensagens[0].texto).toContain('Olá, Pedro!');
    expect(p.mensagens[0].texto).toContain('1️⃣ Escritura');
    expect(p.mensagens[0].texto).toContain('2️⃣ Financiamento');
  });

  it('escritura → compra e venda → tipos, com "voltar" no fim', () => {
    const p = conversa('oi', '1', '1');
    expect(p.mensagens[0].texto).toMatch(/1️⃣ Compra e venda simples\n2️⃣ Compra e venda com vínculo\n3️⃣ Compra e venda com interveniência\n\n0️⃣ Voltar ao menu anterior/);
    expect(conversa('oi', '1', '1', '0').estado).toMatchObject({ tela: 'menu', id: 'escritura' });
    expect(conversa('oi', '1', '1', '0', '0').estado).toMatchObject({ tela: 'menu', id: 'inicio' });
  });

  it('todo fluxo chega a um cálculo válido', () => {
    for (const [id, f] of Object.entries(FLUXOS)) {
      const respostas = f.perguntas.map((q) => RESPOSTA[q.tipo]);
      if (f.perguntas.some((q) => q.campo === 'valorFinanciado')) respostas[1] = '280 mil';
      const p = conversa('oi', ...caminhoAte(id), ...respostas, '2');
      expect(p.acao, id).toMatchObject({ tipo: 'calcular', calculo: f.calculo, formato: 'pdf' });
      const acao = p.acao;
      if (acao?.tipo !== 'calcular') continue;
      expect(() => calcular(acao.calculo, acao.dados), id).not.toThrow();
      expect(p.mensagens[0].texto).toContain('Fazer outro orçamento');
    }
  });

  it('escritura simples de R$ 350 mil sai com o total de referência', () => {
    const p = conversa('oi', '1', '1', '1', '350.000,00', '3');
    expect(p.acao).toMatchObject({ tipo: 'calcular', formato: 'texto', dados: { subtipo: 'compra_venda_simples', valorDeclarado: 350000 } });
    if (p.acao?.tipo === 'calcular') expect(calcular('escritura', p.acao.dados).total).toBe(18743.56);
  });

  it('não aceita financiado maior que o imóvel nem valor baixo demais', () => {
    expect(conversa('oi', '2', '1', '1', '300000', '400000').mensagens[0].texto).toContain('não pode ser maior');
    expect(conversa('oi', '1', '1', '1', '350').mensagens[0].texto).toContain('parece baixo');
  });

  it('resposta fora das opções repete o menu', () => {
    const p = conversa('oi', 'banana');
    expect(p.estado).toMatchObject({ tela: 'menu', id: 'inicio' });
    expect(p.mensagens[0].texto).toContain('Não entendi');
  });

  it('aceita o nome da opção escrito', () => {
    expect(conversa('oi', 'financiamento', 'caixa').estado).toMatchObject({ tela: 'menu', id: 'caixa' });
  });

  it('pedido por extenso no início vai para o agente com IA', () => {
    expect(conversa('escritura de 350 mil em JF').acao).toEqual({ tipo: 'livre' });
  });

  it('depois do orçamento, permite receber em outro formato', () => {
    let p = conversa('oi', '1', '1', '1', '350000', '1');
    const estado = { ...p.estado, ultimo: 143 } as Estado;
    p = passo(estado, '2', ctx);
    expect(p.estado).toMatchObject({ tela: 'formato', reenvio: true });
    expect(passo(p.estado, '3', ctx).acao).toEqual({ tipo: 'reenviar', seq: 143, formato: 'texto' });
  });
});

describe('leitura das respostas', () => {
  it('valores em reais', () => {
    expect(lerValor('350000')).toBe(350000);
    expect(lerValor('R$ 350.000,00')).toBe(350000);
    expect(lerValor('350 mil')).toBe(350000);
    expect(lerValor('1,2 milhão')).toBe(1200000);
    expect(lerValor('1.5 mi')).toBe(1500000);
    expect(lerValor('350k')).toBe(350000);
    expect(lerValor('abc')).toBeNull();
  });
  it('opções por número, emoji ou nome', () => {
    const op = ['Escritura', 'Financiamento'];
    expect(lerOpcao('2', op)).toBe(2);
    expect(lerOpcao('2️⃣', op)).toBe(2);
    expect(lerOpcao('2)', op)).toBe(2);
    expect(lerOpcao('Escritura', op)).toBe(1);
    expect(lerOpcao('compra', ['Compra e venda simples', 'Compra e venda com vínculo'])).toBeNull();
  });
});
