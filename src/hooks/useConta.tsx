import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import type { Papel } from '@/lib/planos';

export interface Perfil {
  id: string;
  full_name: string | null;
  email: string | null;
  /** Telefone de contato impresso no orçamento (só dígitos, com DDD). */
  telefone: string | null;
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
  papel: Papel;
}

export interface Assinatura {
  /** 'mensal' só em assinaturas antigas; hoje: trimestral, semestral ou anual. */
  plan: 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'lancamento';
  nivel: 'usuario' | 'pro' | 'teams' | 'unlimited';
  status: 'pendente' | 'ativa' | 'atrasada' | 'cancelada';
  current_period_end: string | null;
  forma_pagamento: 'cartao' | 'pix' | null;
  /** Fim da fidelidade (cartão). */
  fidelidade_ate: string | null;
  /** Cancelamento agendado. */
  cancela_em: string | null;
  criada_em: string | null;
}

/** Equipe (imobiliária ou Clemente Team) de que a pessoa faz parte. */
export interface Equipe {
  id: string;
  nome: string;
  tipo: 'teams' | 'clemente';
  funcao: 'gestor' | 'colaborador';
}

interface ContaValor {
  user: User | null;
  perfil: Perfil | null;
  assinatura: Assinatura | null;
  equipe: Equipe | null;
  /** Assinatura própria ativa, equipe com o plano em dia, ou administrador. */
  ativa: boolean;
  /** Pode usar o app agora: assinatura ativa, teste grátis em dia ou admin (situacao_acesso no banco). */
  liberado: boolean;
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
  const [equipe, setEquipe] = useState<Equipe | null>(null);
  const [liberado, setLiberado] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async (opcoes: { silencioso?: boolean } = {}) => {
    if (!user) { setPerfil(null); setAssinatura(null); setEquipe(null); setLiberado(false); setCarregando(false); return; }
    if (!opcoes.silencioso) setCarregando(true);
    const [p, a, e, situacao] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, telefone, whatsapp_e164, whatsapp_verified_at, municipio_padrao, pdf_header, uf, cidade_nome, itbi_percentual, pdf_logo_path, cor_primaria, formato_orcamento, configurado_em, custos_padrao, cpf, papel').eq('id', user.id).maybeSingle(),
      supabase.from('subscriptions').select('plan, nivel, status, current_period_end, forma_pagamento, fidelidade_ate, cancela_em, criada_em:created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('organizacao_membros').select('funcao, organizacao:organizacoes(id, nome, tipo)').eq('user_id', user.id).is('removido_em', null).maybeSingle(),
      supabase.rpc('minha_situacao_acesso').maybeSingle<{ liberado: boolean }>(),
    ]);
    const org = e.data?.organizacao as unknown as Omit<Equipe, 'funcao'> | null;
    const eq = org ? { ...org, funcao: e.data!.funcao as Equipe['funcao'] } : null;
    setPerfil((p.data as Perfil) ?? null);
    setAssinatura((a.data as Assinatura) ?? null);
    setEquipe(eq);
    setLiberado(!!situacao.data?.liberado);
    setCarregando(false);
  }, [user]);

  useEffect(() => { if (!loading) recarregar(); }, [loading, recarregar]);

  // Administrador: acesso completo, sem assinatura (o banco também libera em situacao_acesso).
  // Na equipe, quem diz se o acesso está em dia é o banco (situacao_acesso), não a assinatura da pessoa.
  const ativa = perfil?.papel === 'admin' ? true : equipe ? liberado : !!assinatura && assinatura.status === 'ativa'
    && (!assinatura.current_period_end || new Date(assinatura.current_period_end) > new Date());

  return (
    <Contexto.Provider value={{ user, perfil, assinatura, equipe, ativa, liberado, carregando: loading || carregando, recarregar }}>
      {children}
    </Contexto.Provider>
  );
}

export function useConta() {
  const v = useContext(Contexto);
  if (!v) throw new Error('useConta precisa estar dentro de <ContaProvider>');
  return v;
}
