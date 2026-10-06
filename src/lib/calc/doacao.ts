import { z } from 'zod';
import { camposLocalidade, obterMunicipio } from './municipios';
import { MG } from './uf';
import { atosDeDoacao } from './escritura';
import { Linha, Resultado, somar } from './tipos';

const valor = z.coerce.number().nonnegative();

export const entradaDoacao = z.object({
  subtipo: z.enum(['doacao_simples', 'doacao_usufruto', 'renuncia_usufruto']),
  valorAtribuido: valor,
  avaliacaoFazenda: valor,
  folhas: z.coerce.number().int().positive().default(25),
  certidoes: valor.default(400),
  honorarios: valor.default(700),
  ...camposLocalidade,
});
export type EntradaDoacao = z.infer<typeof entradaDoacao>;

/** Espelha src/components/Doacao.tsx (registro com os valores próprios da tela de Doação). */
export function calcularDoacao(dados: EntradaDoacao): Resultado {
  const e = entradaDoacao.parse(dados);
  const m = obterMunicipio(e.municipio, { cidade: e.cidade, itbiPercentual: e.itbiPercentual ?? 0 });
  let bases: number[] = [];
  const linhas: Linha[] = atosDeDoacao(e.subtipo, Math.max(e.valorAtribuido, e.avaliacaoFazenda), MG.registroDoacao, (b) => { bases = b; });
  linhas.push({ rotulo: 'Arquivamento', valor: e.folhas * MG.precoFolha, origem: 'uf', nota: `${e.folhas} folhas × R$ 13,91` });
  linhas.push({ rotulo: 'Certidões', valor: e.certidoes, origem: 'usuario' });
  linhas.push({ rotulo: 'Honorários', valor: e.honorarios, origem: 'usuario' });
  return { tipo: 'doacao', subtipo: e.subtipo, municipio: m.id, municipioNome: m.nome, bases, linhas, total: somar(linhas) };
}
