/**
 * Gera o modelo do orçamento (imagem, PDF e mensagem escrita) e simula a conversa do WhatsApp
 * com o motor de menus de verdade. Uso: npx tsx scripts/modelo-whatsapp.ts <pasta-de-saída>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brl, calcular, type Resultado } from '../src/lib/calc';
import { gerarPdfOrcamento, ESTILO_PADRAO } from '../server/pdf';
import { gerarJpegOrcamento } from '../server/imagem';
import { orcamentoEmTexto } from '../server/agente/orcamentoTexto';
import { passo, type Estado } from '../server/agente/menu';

const saida = process.argv[2] ?? 'modelo-whatsapp';
mkdirSync(saida, { recursive: true });
const meta = { numero: '#0143', data: new Date() };

/** Roda uma conversa no motor e devolve o roteiro em Markdown. */
function simular(titulo: string, mensagens: string[]) {
  const linhas = [`## ${titulo}`, ''];
  let estado: Estado | null = null;
  for (const m of mensagens) {
    linhas.push(`**🧑 Corretor:** ${m}`, '');
    const p = passo(estado, m, { nome: 'Pedro Ivo', formatoPadrao: 'jpeg' });
    estado = p.estado;
    if (p.acao?.tipo === 'calcular') {
      const r: Resultado = calcular(p.acao.calculo, p.acao.dados);
      const bot = p.acao.formato === 'texto' ? orcamentoEmTexto(r, meta, ESTILO_PADRAO)
        : `📎 orcamento-0143.${p.acao.formato === 'pdf' ? 'pdf' : 'jpg'} · Orçamento #0143 · Total ${brl(r.total)}`;
      linhas.push('**🤖 Orçaí:**', '', '```', bot, '```', '');
    }
    for (const b of p.mensagens) linhas.push('**🤖 Orçaí:**', '', '```', b.texto, '```', '');
  }
  return linhas.join('\n');
}

const escritura = calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: 350000 });
writeFileSync(join(saida, 'orcamento-modelo.jpg'), await gerarJpegOrcamento(escritura, meta));
writeFileSync(join(saida, 'orcamento-modelo.pdf'), await gerarPdfOrcamento(escritura, meta));
writeFileSync(join(saida, 'orcamento-modelo.txt'), orcamentoEmTexto(escritura, meta, ESTILO_PADRAO));
writeFileSync(join(saida, 'conversa-modelo.md'), [
  '# Conversa no WhatsApp · simulação com o motor real', '',
  simular('Escritura de compra e venda simples, recebendo em mensagem escrita', ['Oi', '1', '1', '1', '350 mil', '3']),
  simular('Financiamento Caixa SBPE com cota de 80%, recebendo em imagem', ['Bom dia', '2', '1', '1', '400000', '80%', '1', '1']),
  simular('Quando a pessoa digita algo fora das opções', ['oi', 'quero orçar', '0', '1', '2', '1', '350']),
].join('\n'));
console.log('ok', saida);
