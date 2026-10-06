import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Resultado } from '@/lib/calc';

export interface CalculoSalvo {
  id: string;
  seq: number;
  tipo: string;
  subtipo: string | null;
  origem: 'site' | 'whatsapp';
  descricao: string | null;
  resultado: Resultado;
  total: number;
  created_at: string;
}

export const NOME_TIPO: Record<string, string> = {
  escritura: 'Escritura', doacao: 'Doação', financiamento_caixa: 'Financiamento Caixa',
  banco_privado: 'Banco privado', correcao: 'Correção contratual', valor_venal: 'Valor venal',
};

export const mesAtual = () => new Date().toISOString().slice(0, 7);

/** Cálculos do usuário num mês (AAAA-MM), via API. */
export function useCalculos(mes: string) {
  const [dados, setDados] = useState<CalculoSalvo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    setDados(null); setErro(null);
    api<CalculoSalvo[]>(`/api/calculos?mes=${mes}`)
      .then((d) => ativo && setDados(d))
      .catch((e) => ativo && setErro(e.message));
    return () => { ativo = false; };
  }, [mes]);
  return { dados, erro };
}

export async function abrirPdf(seq: number) {
  const aba = window.open('', '_blank');
  try {
    const { url } = await api<{ url: string }>(`/api/calculos/${seq}/pdf`);
    if (aba) aba.location.href = url; else window.location.href = url;
  } catch (e) {
    aba?.close();
    throw e;
  }
}
