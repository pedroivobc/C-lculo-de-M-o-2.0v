import { describe, expect, it } from 'vitest';
import { passo, type ContextoMenu } from './menu';
import { envioDe } from './whatsapp';
import { textoParaFala } from './voz';

const ctx: ContextoMenu = { nome: 'Pedro', formatoPadrao: 'jpeg', municipio: 'mg-juiz-de-fora' };
const comoResposta = (m: ReturnType<typeof passo>['mensagens'][number]) => ({ tipo: 'texto' as const, texto: m.texto, corpo: m.corpo, opcoes: m.opcoes });

describe('envio pela Evolution', () => {
  it('botões desligados: texto numerado de sempre', () => {
    const m = passo(null, 'oi', ctx).mensagens[0];
    expect(envioDe(comoResposta(m), false)).toEqual({ rota: 'sendText', corpo: { text: m.texto } });
  });

  it('menu inicial (4 opções) vira lista com a saudação', () => {
    const e = envioDe(comoResposta(passo(null, 'oi', ctx).mensagens[0]), true);
    expect(e.rota).toBe('sendList');
    if (e.rota !== 'sendList') return;
    expect(e.corpo.description).toBe('Olá, Pedro! 👋 Qual tipo de cálculo iremos fazer hoje?');
    expect(e.corpo.sections[0].rows.map((r) => [r.rowId, r.title])).toEqual([['1', 'Compra e venda'], ['2', 'Financiamento'], ['3', 'Doação'], ['4', 'Correção contratual']]);
  });

  it('até 3 opções curtas viram botões; a pergunta de valor leva só o Voltar', () => {
    const sim = envioDe(comoResposta(passo({ tela: 'endereco', etapa: 'pergunta', fluxo: 'cv_simples', dados: {}, origem: 'compra_venda' }, 'x', ctx).mensagens[0]), true);
    expect(sim.rota).toBe('sendButtons');
    if (sim.rota === 'sendButtons') expect(sim.corpo.buttons.map((b) => b.id)).toEqual(['1', '2', '0']);
    const valor = envioDe(comoResposta(passo(null, '1', ctx).mensagens[0]), true);
    expect(valor.rota).toBe('sendList'); // compra e venda: 3 tipos + Voltar
    const pergunta = passo({ tela: 'menu', id: 'compra_venda' }, '1', ctx).mensagens[0];
    const e = envioDe(comoResposta(pergunta), true);
    expect(e).toMatchObject({ rota: 'sendButtons', corpo: { buttons: [{ id: '0', displayText: 'Voltar' }] } });
    if (e.rota === 'sendButtons') expect(e.corpo.description).not.toContain('0️⃣');
  });

  it('linhas da lista respeitam 24 caracteres e levam a descrição', () => {
    const e = envioDe(comoResposta(passo({ tela: 'menu', id: 'caixa' }, 'x', ctx).mensagens[0]), true);
    if (e.rota !== 'sendList') throw new Error(e.rota);
    for (const r of e.corpo.sections[0].rows) expect(r.title.length).toBeLessThanOrEqual(24);
    expect(e.corpo.sections[0].rows.find((r) => r.title === 'Home equity')?.description).toBe('Empréstimo com o imóvel de garantia');
  });

  it('arquivos: imagem ou documento pelo mimetype', () => {
    expect(envioDe({ tipo: 'documento', url: 'https://x/a.jpg', nomeArquivo: 'a.jpg', mimetype: 'image/jpeg' }, true))
      .toEqual({ rota: 'sendMedia', corpo: { mediatype: 'image', mimetype: 'image/jpeg', media: 'https://x/a.jpg', fileName: 'a.jpg', caption: '' } });
  });

  it('resposta falada vai como mensagem de voz', () => {
    expect(envioDe({ tipo: 'audio', base64: 'UklGRg==', texto: 'Oi' }, false))
      .toEqual({ rota: 'sendWhatsAppAudio', corpo: { audio: 'UklGRg==', encoding: true } });
  });

  it('texto falado sai sem formatação nem emojis', () => {
    expect(textoParaFala('*Escritura* de _350 mil_ 👍 pronta ✅')).toBe('Escritura de 350 mil pronta');
  });
});
