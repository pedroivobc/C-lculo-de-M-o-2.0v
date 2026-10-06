import { z } from 'zod';
import { MUNICIPIO_PADRAO, obterMunicipio } from './municipios';
import { Resultado } from './tipos';

const num = z.coerce.number().nonnegative();

/** Dados lidos do espelho do IPTU (mesmo formato de ExtractedData) + ajustes opcionais. */
export const entradaValorVenal = z.object({
  areaIsotima: z.string().nullish(),
  tipo: z.enum(['APTO', 'CASA', 'SALA', 'LOJA', 'TELHEIRO', 'GALPAO']).nullish(),
  padrao: z.enum(['OTIMO', 'BOM', 'REGULAR', 'BAIXO', 'POPULAR']).nullish(),
  terrenoValorVenal: num,
  terrenoValorM2: num,
  edificacaoValorVenal: num.default(0),
  edificacaoValorM2: num.default(0),
  valorM2TerrenoPJF: num.optional(),
  valorM2EdificacaoPJF: num.optional(),
  fator: z.coerce.number().positive().optional(),
  municipio: z.string().default(MUNICIPIO_PADRAO),
});
export type EntradaValorVenal = z.infer<typeof entradaValorVenal>;

/** RE5 → RE005, CS12 → CS012 (como em ValorVenal.tsx). */
export function normalizarIsotima(codigo?: string | null): string {
  const c = (codigo ?? '').replace(/\s/g, '').toUpperCase();
  const m = c.match(/^(RE|CS)(\d{1,2})$/);
  return m ? `${m[1]}${m[2].padStart(3, '0')}` : c;
}

/** Espelha o cálculo de src/components/ValorVenal.tsx. */
export function calcularValorVenal(dados: EntradaValorVenal): Resultado {
  const e = entradaValorVenal.parse(dados);
  const m = obterMunicipio(e.municipio, { itbiPercentual: 0 });
  const t = m.valorVenal;
  if (!t) throw new Error(`Valor venal ainda não disponível para ${m.nome}`);

  const isotima = normalizarIsotima(e.areaIsotima);
  const m2Terreno = e.valorM2TerrenoPJF ?? t.valorM2Terreno[isotima] ?? e.terrenoValorM2;
  const m2Edif = e.valorM2EdificacaoPJF ?? ((e.tipo && e.padrao && t.valorM2Edificacao[e.tipo]?.[e.padrao]) || 0);
  const fator = e.fator ?? ((isotima && e.tipo && t.fatorComercializacao[isotima]?.[e.tipo]) || 1);

  const areaTerreno = e.terrenoValorVenal / (e.terrenoValorM2 || 1);
  const areaEdif = e.edificacaoValorVenal / (e.edificacaoValorM2 || 1);
  const terreno = areaTerreno * m2Terreno;
  const edificacao = areaEdif * m2Edif;
  const total = Math.round((terreno + edificacao) * fator * 100) / 100;

  return {
    tipo: 'valor_venal',
    subtipo: e.tipo ?? 'imovel',
    municipio: m.id,
    municipioNome: m.nome,
    bases: [],
    linhas: [
      { rotulo: 'Terreno corrigido', valor: terreno, origem: 'municipio', nota: `${areaTerreno.toFixed(2)} m² × R$ ${m2Terreno.toFixed(2)}` },
      { rotulo: 'Edificação corrigida', valor: edificacao, origem: 'municipio', nota: `${areaEdif.toFixed(2)} m² × R$ ${m2Edif.toFixed(2)}` },
    ],
    total,
    detalhes: { areaIsotima: isotima, fator, areaTerrenoM2: areaTerreno, areaEdificacaoM2: areaEdif },
  };
}
