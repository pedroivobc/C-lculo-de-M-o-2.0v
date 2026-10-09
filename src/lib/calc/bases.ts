import type { Resultado } from './tipos';

export interface BaseRotulada { rotulo?: string; valor: number }

/** Nome de cada base, na ordem de `Resultado.bases`. Base única fica sem nome. */
function rotulosDasBases(r: Pick<Resultado, 'tipo' | 'subtipo'>): string[] {
  if (r.tipo === 'financiamento_caixa' || r.tipo === 'banco_privado') {
    return r.subtipo === 'EGI' ? ['Valor do imóvel', 'Financiamento'] : ['Compra e venda', 'Financiamento'];
  }
  switch (r.subtipo) {
    case 'interveniencia': return ['1º ato', '2º ato'];
    case 'compra_vinculo': return ['Compra', 'Vínculo'];
    case 'doacao_usufruto': return ['Doação', 'Usufruto (1/3)'];
    default: return [];
  }
}

/** Bases com o nome de cada uma (ex.: Compra e venda e Financiamento), sem as zeradas. */
export function basesRotuladas(r: Pick<Resultado, 'tipo' | 'subtipo' | 'bases'>): BaseRotulada[] {
  const rotulos = (r.bases ?? []).length > 1 ? rotulosDasBases(r) : [];
  return (r.bases ?? []).map((valor, i) => ({ rotulo: rotulos[i], valor })).filter((b) => b.valor > 0);
}

/** "Compra e venda: R$ 200.000,00 · Financiamento: R$ 120.000,00", ou só o valor quando a base é única. */
export function textoDasBases(r: Pick<Resultado, 'tipo' | 'subtipo' | 'bases'>, fmt: (n: number) => string): string {
  return basesRotuladas(r).map((b) => (b.rotulo ? `${b.rotulo}: ${fmt(b.valor)}` : fmt(b.valor))).join(' · ');
}
