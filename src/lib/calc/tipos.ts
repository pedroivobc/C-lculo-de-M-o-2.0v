/** De onde vem cada valor do orçamento. Define o que muda ao abrir um município novo. */
export type Origem = 'municipio' | 'uf' | 'banco' | 'usuario';

/** Parte de uma linha (ex.: Escritura = lavratura + arquivamento), mostrada ao detalhar. */
export interface Detalhe {
  rotulo: string;
  valor: number;
  nota?: string;
}

export interface Linha {
  rotulo: string;
  valor: number;
  origem: Origem;
  nota?: string;
  /** Composição do valor, para o botão "Detalhar valores". A soma é igual a `valor`. */
  detalhes?: Detalhe[];
}

export type TipoCalculo =
  | 'escritura'
  | 'financiamento_caixa'
  | 'banco_privado'
  | 'doacao'
  | 'correcao';

export interface Resultado {
  tipo: TipoCalculo;
  subtipo: string;
  municipio: string;
  /** Nome para exibir (inclui a cidade informada pelo assinante em 'mg-outra'). */
  municipioNome?: string;
  /** Base(s) de cálculo usadas, na ordem dos atos. */
  bases: number[];
  linhas: Linha[];
  total: number;
  /** Dados extras que não são custo (ex.: índices da correção). */
  detalhes?: Record<string, number | string>;
}

export const somar = (linhas: Linha[]) =>
  Math.round(linhas.reduce((acc, l) => acc + l.valor, 0) * 100) / 100;
