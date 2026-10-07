import { describe, expect, it } from 'vitest';
import { calcular } from '../../src/lib/calc';
import { FLUXOS, MENUS, lerOpcao, lerValor, passo, type ContextoMenu, type Estado, type Passo } from './menu';

const ctx: ContextoMenu = { nome: 'Pedro Ivo', formatoPadrao: 'jpeg', municipio: 'mg-juiz-de-fora' };

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

  it('correção contratual só aparece para Juiz de Fora', () => {
    expect(conversa('oi').mensagens[0].texto).toContain('3️⃣ Atualizar valor de contrato');
    const bh: ContextoMenu = { ...ctx, municipio: 'mg-belo-horizonte' };
    const p = passo(null, 'oi', bh);
    expect(p.mensagens[0].texto).not.toContain('Atualizar valor de contrato');
    expect(passo(p.estado, '3', bh).mensagens[0].texto).toContain('Não entendi');
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
      const endereco = f.calculo === 'correcao' ? [] : ['2']; // "Não" para o endereço
      const p = conversa('oi', ...caminhoAte(id), ...respostas, ...endereco, '2');
      expect(p.acao, id).toMatchObject({ tipo: 'calcular', calculo: f.calculo, formato: 'pdf' });
      const acao = p.acao;
      if (acao?.tipo !== 'calcular') continue;
      expect(() => calcular(acao.calculo, acao.dados), id).not.toThrow();
      expect(p.mensagens[0].texto).toContain('Fazer outro orçamento');
    }
  });

  it('escritura simples de R$ 350 mil sai com o total de referência', () => {
    const p = conversa('oi', '1', '1', '1', '350.000,00', '2', '3');
    expect(p.acao).toMatchObject({ tipo: 'calcular', formato: 'texto', dados: { subtipo: 'compra_venda_simples', valorDeclarado: 350000 } });
    if (p.acao?.tipo === 'calcular') expect(calcular('escritura', p.acao.dados).total).toBe(18743.56);
  });

  it('mostra cada valor entendido em reais', () => {
    expect(conversa('oi', '2', '1', '1', '400000').mensagens[0].texto).toMatch(/^✅ Valor do imóvel: \*R\$\s400\.000,00\*/);
    expect(conversa('oi', '1', '1', '1', '350000').mensagens[0].texto).toMatch(/^✅ Valor do imóvel: \*R\$\s350\.000,00\*\n\n\*Endereço do imóvel\*/);
    expect(conversa('oi', '1', '1', '1', '350000', '2').mensagens[0].texto).toMatch(/^Certidões: \*R\$\s400,00\*\nHonorários: \*R\$\s700,00\*/);
    expect(conversa('oi', '1', '2', '1', '350000', 'não sei').mensagens[0].texto).toContain('✅ Avaliação da Fazenda: *ainda não tem*');
  });

  it('financiado pode ser o valor ou a cota em % do imóvel', () => {
    const pergunta = conversa('oi', '2', '1', '1', '125000');
    expect(pergunta.mensagens[0].texto).toContain('Digite o valor ou a cota em %.');
    expect(pergunta.mensagens[0].texto).toMatch(/Ex\.: 100000 ou 80% \(= R\$\s100\.000,00\)/);
    for (const resposta of ['80%', '80 %', '80', '80 por cento']) {
      const p = conversa('oi', '2', '1', '1', '125000', resposta);
      expect(p.estado, resposta).toMatchObject({ dados: { valorFinanciado: 100000 } });
      expect(p.mensagens[0].texto, resposta).toMatch(/^✅ Valor financiado: \*R\$\s100\.000,00\* \(80% de R\$\s125\.000,00\)/);
    }
    expect(conversa('oi', '2', '1', '1', '125000', '100000').estado).toMatchObject({ dados: { valorFinanciado: 100000 } });
    expect(conversa('oi', '2', '1', '1', '125000', '87,5%').estado).toMatchObject({ dados: { valorFinanciado: 109375 } });
    expect(conversa('oi', '2', '1', '1', '125000', '120%').mensagens[0].texto).toContain('A cota vai de 1% a 100%');
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

  it('pergunta antes se quer o endereço do imóvel e leva o texto para o orçamento', () => {
    const base = ['oi', '1', '1', '1', '350000'];
    expect(conversa(...base, '1').mensagens[0].texto).toContain('Digite o endereço');
    expect(conversa(...base, '1', '1').mensagens[0].texto).toContain('Escreva o endereço com rua e número');
    expect(conversa(...base, '1', '0').estado).toMatchObject({ tela: 'endereco', etapa: 'pergunta' });
    const p = conversa(...base, '1', 'Rua Halfeld, 100, apto 201 · Centro');
    expect(p.mensagens[0].texto).toMatch(/^✅ Endereço: \*Rua Halfeld, 100, apto 201 · Centro\*/);
    expect(passo(p.estado, '3', ctx).acao).toMatchObject({ tipo: 'calcular', endereco: 'Rua Halfeld, 100, apto 201 · Centro' });
    expect(conversa(...base, '2', '3').acao).toMatchObject({ tipo: 'calcular', endereco: undefined });
    expect(conversa(...base, '2', '0').estado).toMatchObject({ tela: 'endereco', etapa: 'pergunta' });
  });

  it('depois do orçamento, permite receber em outro formato', () => {
    let p = conversa('oi', '1', '1', '1', '350000', '2', '1');
    const estado = { ...p.estado, ultimo: 143 } as Estado;
    p = passo(estado, '2', ctx);
    expect(p.estado).toMatchObject({ tela: 'formato', reenvio: true });
    expect(passo(p.estado, '3', ctx).acao).toEqual({ tipo: 'reenviar', seq: 143, formato: 'texto' });
  });
});

describe('certidões e honorários no WhatsApp', () => {
  const padrao = { escritura: { certidoes: 350, honorarios: 900 }, financiamento: { certidoes: 260.07, honorarios: 800 } };
  const comPadrao: ContextoMenu = { ...ctx, custosPadrao: padrao };
  const rodar = (c: ContextoMenu, ...mensagens: string[]) => {
    let estado: Estado | null = null; let p: Passo | undefined;
    for (const m of mensagens) { p = passo(estado, m, c); estado = p.estado; }
    return p!;
  };

  it('mostra os valores padrão do assinante antes de escolher o formato', () => {
    const p = rodar(comPadrao, 'oi', '1', '1', '1', '350000', '2');
    expect(p.mensagens[0].texto).toMatch(/Certidões: \*R\$\s350,00\*\nHonorários: \*R\$\s900,00\*/);
    expect(p.mensagens[0].texto).toContain('*honorarios 900*');
  });

  it('"honorarios 1200" troca só neste orçamento e entra no cálculo', () => {
    const p = rodar(comPadrao, 'oi', '1', '1', '1', '350000', '2', 'honorarios 1.200');
    expect(p.mensagens[0].texto).toMatch(/^✅ Honorários deste orçamento: \*R\$\s1\.200,00\*/);
    expect(p.mensagens[0].texto).toMatch(/Honorários: \*R\$\s1\.200,00\*/);
    const fim = passo(p.estado, '3', comPadrao);
    expect(fim.acao).toMatchObject({ tipo: 'calcular', dados: { honorarios: 1200 } });
    expect(fim.estado.custos).toBeUndefined(); // o próximo orçamento volta ao padrão
  });

  it('o comando funciona no meio das perguntas e antes de escolher o tipo', () => {
    const p = rodar(comPadrao, 'oi', 'certidoes 500', '2', '1', '1', '400000', '80%', '1', '2');
    expect(p.mensagens[0].texto).toMatch(/Certidões: \*R\$\s500,00\*\nHonorários: \*R\$\s800,00\*/);
  });

  it('"honorarios padrao" volta ao valor do assinante e sem valor explica o uso', () => {
    const p = rodar(comPadrao, 'oi', '1', '1', '1', '350000', '2', 'honorarios 1200', 'honorarios padrao');
    expect(p.mensagens[0].texto).toMatch(/Honorários: \*R\$\s900,00\*/);
    expect(rodar(comPadrao, 'oi', 'honorarios').mensagens[0].texto).toContain('Ex.: *honorarios 900*');
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
