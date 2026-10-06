import { z } from 'zod';
import { calcularEscritura, entradaEscritura } from './escritura';
import { calcularDoacao, entradaDoacao } from './doacao';
import { calcularCaixa, calcularBancoPrivado, entradaCaixa, entradaBancoPrivado } from './financiamento';
import { calcularCorrecao, entradaCorrecao } from './correcao';
import { calcularValorVenal, entradaValorVenal } from './valorVenal';
import type { Resultado, TipoCalculo } from './tipos';

export * from './tipos';
export { MUNICIPIOS, MUNICIPIO_PADRAO, MUNICIPIO_OUTRA, obterMunicipio, percentual } from './municipios';
export { ROTULO_SUBTIPO_ESCRITURA } from './escritura';

/** Um lugar só para o site, a API e o agente do WhatsApp chamarem as mesmas fórmulas. */
export const CALCULADORAS: Record<TipoCalculo, { entrada: z.ZodTypeAny; calcular: (e: any) => Resultado }> = {
  escritura: { entrada: entradaEscritura, calcular: calcularEscritura },
  doacao: { entrada: entradaDoacao, calcular: calcularDoacao },
  financiamento_caixa: { entrada: entradaCaixa, calcular: calcularCaixa },
  banco_privado: { entrada: entradaBancoPrivado, calcular: calcularBancoPrivado },
  correcao: { entrada: entradaCorrecao, calcular: calcularCorrecao },
  valor_venal: { entrada: entradaValorVenal, calcular: calcularValorVenal },
};

export function calcular(tipo: TipoCalculo, dados: unknown): Resultado {
  const c = CALCULADORAS[tipo];
  if (!c) throw new Error(`Tipo de cálculo desconhecido: ${tipo}`);
  return c.calcular(c.entrada.parse(dados));
}

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
