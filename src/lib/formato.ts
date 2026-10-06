export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Valor em reais com máscara R$ 000.000,00. O que se digita são reais ("350000" = R$ 350.000,00);
 * a vírgula abre os centavos. O estado é guardado em centavos.
 */
export const centavosParaTexto = (c: number) => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Separa o que foi digitado em reais e centavos. Pontos são só separadores de milhar e são ignorados. */
function partes(t: string): { reais: string; centavos?: string } {
  const [reais = '', ...resto] = t.replace(/[^\d,]/g, '').split(',');
  return { reais: reais.replace(/^0+(?=\d)/, ''), centavos: resto.length ? resto.join('').slice(0, 2) : undefined };
}

export const textoParaCentavos = (t: string) => {
  const { reais, centavos = '' } = partes(t);
  return Number(reais || 0) * 100 + Number(centavos.padEnd(2, '0'));
};

/** Máscara enquanto a pessoa digita: "350000" → "350.000"; "350000,5" → "350.000,5". */
export function mascararDigitando(t: string): string {
  const { reais, centavos } = partes(t);
  if (!reais && centavos === undefined) return '';
  const inteiro = Number(reais || 0).toLocaleString('pt-BR');
  return centavos === undefined ? inteiro : `${inteiro},${centavos}`;
}

/** Telefone para exibição: +5532999990000 → (32) 99999-0000 */
export function telefoneBonito(e164?: string | null) {
  if (!e164) return '';
  const d = e164.replace(/\D/g, '').replace(/^55/, '');
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : e164;
}

export const numeroCalculo = (seq: number) => `#${String(seq).padStart(4, '0')}`;

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
