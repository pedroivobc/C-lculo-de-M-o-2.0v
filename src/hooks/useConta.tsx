import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export interface Perfil {
  id: string;
  full_name: string | null;
  email: string | null;
  whatsapp_e164: string | null;
  whatsapp_verified_at: string | null;
  municipio_padrao: string;
  pdf_header: string | null;
  uf: string;
  cidade_nome: string | null;
  itbi_percentual: number | null;
  pdf_logo_path: string | null;
  cor_primaria: string | null;
  formato_orcamento: 'pdf' | 'jpeg';
  configurado_em: string | null;
  /** Certidões e honorários padrão (jsonb, em reais). Ver src/lib/calc/custos.ts. */
  custos_padrao: unknown;
  /** CPF (só dígitos), único por conta. */
  cpf: string | null;
}

export interface Assinatura {
  /** 'mensal' só em assinaturas antigas; hoje: trimestral, semestral ou anual. */
  plan: 'mensal' | 'trimestral' | 'semestral' | 'anual';
  nivel: 'usuario' | 'pro';
  status: 'pendente' | 'ativa' | 'atrasada' | 'cancelada';
  current_period_end: string | null;
}

interface ContaValor {
  user: User | null;
  perfil: Perfil | null;
  assinatura: Assinatura | null;
  ativa: boolean;
  carregando: boolean;
  /** `silencioso` atualiza sem a tela de carregamento (usado na espera da confirmação do WhatsApp). */
  recarregar: (opcoes?: { silencioso?: boolean }) => Promise<void>;
}

const Contexto = createContext<ContaValor | null>(null);

/** Usuário logado + perfil + assinatura, lidos uma vez e compartilhados pelo app (protegidos por RLS). */
export function ContaProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async (opcoes: { silencioso?: boolean } = {}) => {
    if (!user) { setPerfil(null); setAssinatura(null); setCarregando(false); return; }
    if (!opcoes.silencioso) setCarregando(true);
    const [p, a] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, whatsapp_e164, whatsapp_verified_at, municipio_padrao, pdf_header, uf, cidade_nome, itbi_percentual, pdf_logo_path, cor_primaria, formato_orcamento, configurado_em, custos_padrao, cpf').eq('id', user.id).maybeSingle(),
      supabase.from('subscriptions').select('plan, nivel, status, current_period_end').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    setPerfil((p.data as Perfil) ?? null);
    setAssinatura((a.data as Assinatura) ?? null);
    setCarregando(false);
  }, [user]);

  useEffect(() => { if (!loading) recarregar(); }, [loading, recarregar]);

  const ativa = !!assinatura && assinatura.status === 'ativa'
    && (!assinatura.current_period_end || new Date(assinatura.current_period_end) > new Date());

  return (
    <Contexto.Provider value={{ user, perfil, assinatura, ativa, carregando: loading || carregando, recarregar }}>
      {children}
    </Contexto.Provider>
  );
}

export function useConta() {
  const v = useContext(Contexto);
  if (!v) throw new Error('useConta precisa estar dentro de <ContaProvider>');
  return v;
}
