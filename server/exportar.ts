import type { CalculoSalvo } from './historico';
import { numeroCalculo } from './historico';

const cel = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const decimal = (n: number) => n.toFixed(2).replace('.', ',');

/** CSV no padrão do Excel brasileiro (separador ;, vírgula decimal, BOM UTF-8). Com `nomes`, a 1ª coluna é quem orçou (equipe). */
export function gerarCsv(calculos: CalculoSalvo[], nomes?: Map<string, string>): Buffer {
  const cab = [...(nomes ? ['Usuário'] : []), 'Nº', 'Data', 'Tipo', 'Subtipo', 'Município', 'Origem', 'Descrição', 'Base', 'Itens', 'Total'];
  const linhas = calculos.map((c) => [
    ...(nomes ? [nomes.get(c.user_id) ?? ''] : []),
    numeroCalculo(c.seq),
    new Date(c.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    c.tipo,
    c.subtipo ?? '',
    c.municipio ?? '',
    c.origem,
    c.descricao ?? '',
    (c.resultado.bases ?? []).map(decimal).join(' + '),
    c.resultado.linhas.map((l) => `${l.rotulo}: ${decimal(l.valor)}`).join(' | '),
    decimal(Number(c.total)),
  ].map(cel).join(';'));
  return Buffer.from('﻿' + [cab.join(';'), ...linhas].join('\r\n'), 'utf8');
}
