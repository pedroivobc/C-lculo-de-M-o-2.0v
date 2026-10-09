import type { Resposta } from './ferramentas';

/**
 * Como cada resposta sai pela Evolution API (v2). O n8n só faz POST em /message/<rota>/<instância>
 * com { number, ...corpo }, então ligar ou desligar os botões é só a variável WHATSAPP_BOTOES.
 *
 * Limites do WhatsApp: até 3 botões (texto de até 20 caracteres); lista com até 10 linhas
 * (título de até 24). Acima disso, ou com os botões desligados, vai o texto com as opções numeradas,
 * que funciona em qualquer aparelho. A resposta de um botão chega com o id ("1", "2", "0").
 */
export type Envio =
  | { rota: 'sendText'; corpo: { text: string } }
  | { rota: 'sendButtons'; corpo: { title: string; description: string; footer: string; buttons: { type: 'reply'; displayText: string; id: string }[] } }
  | { rota: 'sendList'; corpo: { title: string; description: string; buttonText: string; footerText: string; sections: { title: string; rows: { title: string; description: string; rowId: string }[] }[] } }
  | { rota: 'sendMedia'; corpo: { mediatype: 'image' | 'document'; mimetype: string; media: string; fileName: string; caption: string } };

const TITULO = 'Orça.ai';
const cabe = (t: string, n: number) => (t.length <= n ? t : `${t.slice(0, n - 1)}…`);

export function envioDe(r: Resposta, botoes: boolean): Envio {
  if (r.tipo === 'documento') {
    return { rota: 'sendMedia', corpo: { mediatype: r.mimetype.startsWith('image/') ? 'image' : 'document', mimetype: r.mimetype, media: r.url, fileName: r.nomeArquivo, caption: r.legenda ?? '' } };
  }
  const opcoes = r.opcoes ?? [];
  if (!botoes || !opcoes.length || !r.corpo || opcoes.length > 10) return { rota: 'sendText', corpo: { text: r.texto } };

  const corpo = r.corpo.trim();
  if (opcoes.length <= 3 && opcoes.every((o) => o.titulo.length <= 20)) {
    return {
      rota: 'sendButtons',
      corpo: { title: TITULO, description: corpo, footer: 'Toque numa opção', buttons: opcoes.map((o) => ({ type: 'reply', displayText: o.titulo, id: o.id })) },
    };
  }
  return {
    rota: 'sendList',
    corpo: {
      title: TITULO, description: corpo, buttonText: 'Ver opções', footerText: 'Toque em Ver opções para escolher',
      sections: [{ title: 'Escolha uma opção', rows: opcoes.map((o) => ({ title: cabe(o.titulo, 24), description: cabe(o.descricao ?? (o.titulo.length > 24 ? o.titulo : ''), 72), rowId: o.id })) }],
    },
  };
}
