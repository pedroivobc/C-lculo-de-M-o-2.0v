import { brl, type Resultado } from '../../src/lib/calc';
import { config } from '../config';
import type { Estilo } from '../estilo';
import { tituloDoDocumento } from '../documento';

/**
 * Orçamento em mensagem de WhatsApp, pronto para o corretor encaminhar ao cliente.
 * Vai sozinho numa mensagem (sem menu junto), para o encaminhamento sair limpo.
 */
export function orcamentoEmTexto(r: Resultado, meta: { numero: string; data: Date }, estilo: Pick<Estilo, 'cabecalho' | 'personalizado'>, comDetalhes = false): string {
  const l: string[] = [];
  if (estilo.personalizado && estilo.cabecalho) l.push(`*${estilo.cabecalho}*`);
  l.push(`*ORÇAMENTO ${meta.numero.replace('#', 'Nº ')}* · ${meta.data.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  l.push(tituloDoDocumento(r));
  if (r.municipioNome && r.municipio !== 'n/a') l.push(`📍 Imóvel em ${r.municipioNome} (MG)`);
  if (r.bases.length) l.push(`Base de cálculo: ${r.bases.filter((b) => b > 0).map(brl).join(' + ')}`);
  l.push('');
  for (const linha of r.linhas) {
    l.push(`▪️ ${linha.rotulo}: *${brl(linha.valor)}*`);
    if (comDetalhes) for (const d of linha.detalhes ?? []) l.push(`      ◦ ${d.rotulo}: ${brl(d.valor)}`);
  }
  l.push('');
  l.push(`💰 *${r.tipo === 'correcao' ? 'VALOR CORRIGIDO' : 'TOTAL ESTIMADO'}: ${brl(r.total)}*`);
  l.push('');
  l.push('_Valores estimados com as tabelas vigentes de MG. Confirme com o cartório e a prefeitura antes do ato._');
  if (!estilo.personalizado) l.push(`_Feito com ${config.marca}_`);
  return l.join('\n');
}
