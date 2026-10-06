export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Valor em reais digitado com máscara: guarda centavos, mostra "350.000,00". */
export const centavosParaTexto = (c: number) => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
export const textoParaCentavos = (t: string) => {
  const d = t.replace(/\D/g, '');
  return d ? Number(d) : 0;
};

/** Telefone para exibição: +5532999990000 → (32) 99999-0000 */
export function telefoneBonito(e164?: string | null) {
  if (!e164) return '';
  const d = e164.replace(/\D/g, '').replace(/^55/, '');
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : e164;
}

export const numeroCalculo = (seq: number) => `#${String(seq).padStart(4, '0')}`;

export const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
