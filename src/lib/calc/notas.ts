import { faixaComValor } from './registro';
import { parametros } from './parametros';

/**
 * Tabelionato de notas de MG (Tabela 1, Lei 15.424/2004), conferido com um orçamento de cartório de 09/09/2026
 * (base R$ 472.489,30: lavratura R$ 5.677,79; 25 folhas de arquivamento R$ 347,63).
 *
 * Cada ato custa: emolumentos brutos + TFJ + ISSQN sobre o líquido (bruto − Recompe de 7%).
 * No Registro de Imóveis de Juiz de Fora o ISSQN incide sobre o bruto (ver ./registro.ts).
 */
const RECOMPE = 0.07;
/** Tabela 8, código 8101: arquivamento, por folha (tabela vigente). */
const arquivamentoFolha = () => parametros().emolumentos.atos.arquivamentoFolha;

const emCentavos = (n: number) => Math.round(n * 100);

/** Valor ao usuário de `qtd` atos iguais, com o ISS calculado sobre o total da linha, como o cartório faz. */
function valorNotas(ato: { bruto: number; tfj: number }, iss: number, qtd = 1) {
  const bruto = emCentavos(ato.bruto) * qtd;
  const liquido = bruto - Math.round(emCentavos(ato.bruto) * RECOMPE) * qtd;
  return (bruto + emCentavos(ato.tfj) * qtd + Math.round(liquido * iss)) / 100;
}

/** Lavratura de escritura com conteúdo financeiro (Tabela 1, 4-b). */
export const lavratura = (base: number, iss: number) => valorNotas(faixaComValor(base), iss);

/** Arquivamento das folhas da escritura. */
export const arquivamento = (folhas: number, iss: number) => valorNotas(arquivamentoFolha(), iss, folhas);

/** Preço de uma folha, para a nota do orçamento. */
export const precoFolha = (iss: number) => valorNotas(arquivamentoFolha(), iss);
