import { Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ContaProvider, useConta } from '@/hooks/useConta';
import { EXIGIR_ASSINATURA } from '@/lib/config';
import { telaSobDemanda, useVersaoNova } from '@/lib/versao';
import { AppLayout } from '@/components/layout/AppLayout';
import Landing from '@/pages/Landing';
import { Assinar, Cadastro, CompletarCpf, Configurar, Entrar, Verificar } from '@/pages/Acesso';
import { Privacidade, Termos } from '@/pages/Legal';

// Telas do app carregadas sob demanda (a landing fica leve).
const Inicio = telaSobDemanda(() => import('@/pages/app/Inicio'));
const Escrituras = telaSobDemanda(() => import('@/pages/app/Escrituras'));
const FinanciamentoCaixa = telaSobDemanda(() => import('@/pages/app/Financiamento').then((m) => ({ default: m.FinanciamentoCaixa })));
const BancoPrivado = telaSobDemanda(() => import('@/pages/app/Financiamento').then((m) => ({ default: m.BancoPrivado })));
const Correcao = telaSobDemanda(() => import('@/pages/app/Correcao'));
const AdminTabelas = telaSobDemanda(() => import('@/pages/app/AdminTabelas'));
const AdminGestao = telaSobDemanda(() => import('@/pages/app/AdminGestao'));
const AdminUsuarios = telaSobDemanda(() => import('@/pages/app/AdminUsuarios'));
const AdminEquipes = telaSobDemanda(() => import('@/pages/app/AdminEquipes'));
const Equipe = telaSobDemanda(() => import('@/pages/app/Equipe'));
const Parceiros = telaSobDemanda(() => import('@/pages/app/Parceiros'));
const Doacao = telaSobDemanda(() => import('@/pages/app/Doacao'));
const Historico = telaSobDemanda(() => import('@/pages/app/Historico'));
const Agente = telaSobDemanda(() => import('@/pages/app/Agente'));
const Conta = telaSobDemanda(() => import('@/pages/app/Conta'));

function Carregando() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Carregando">
      <Loader2 className="size-8 animate-spin text-acao" aria-hidden="true" />
    </div>
  );
}

/**
 * Exige login; opcionalmente cadastro concluído e assinatura ativa.
 * A identidade é confirmada pelo e-mail (Supabase Auth). O WhatsApp é opcional: só serve para usar o agente.
 */
function Protegido({ children, exigirWhatsapp = false }: { children: ReactNode; exigirWhatsapp?: boolean }) {
  const { user, perfil, ativa, liberado, carregando } = useConta();
  const local = useLocation();
  if (carregando) return <Carregando />;
  if (!user) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  // CPF único por conta: sem ele, nada além da tela de CPF.
  if (perfil && !perfil.cpf && local.pathname !== '/cpf') return <Navigate to={`/cpf${local.search}`} replace />;
  if (exigirWhatsapp && perfil && !perfil.configurado_em) return <Navigate to="/configurar" replace />;
  // Teste grátis em dia também entra; a conta continua acessível para pagar ou trocar o cartão.
  if (exigirWhatsapp && EXIGIR_ASSINATURA && !ativa && !liberado && local.pathname !== '/app/conta') return <Navigate to="/assinar" replace />;
  return <>{children}</>;
}

/** Gestão de Negócio: só o administrador; os demais voltam para o início. */
function SoAdmin({ children }: { children: ReactNode }) {
  const { perfil } = useConta();
  return perfil && perfil.papel !== 'admin' ? <Navigate to="/app" replace /> : <>{children}</>;
}

/** Recarrega na troca de tela quando saiu versão nova do site. */
function VigiaVersao() {
  useVersaoNova();
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <VigiaVersao />
      <ContaProvider>
        <Suspense fallback={<Carregando />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/termos" element={<Termos />} />
            <Route path="/privacidade" element={<Privacidade />} />
            <Route path="/entrar" element={<Entrar />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/cpf" element={<Protegido><CompletarCpf /></Protegido>} />
            <Route path="/verificar" element={<Protegido><Verificar /></Protegido>} />
            <Route path="/configurar" element={<Protegido><Configurar /></Protegido>} />
            <Route path="/assinar" element={<Protegido><Assinar /></Protegido>} />
            <Route path="/app" element={<Protegido exigirWhatsapp><AppLayout /></Protegido>}>
              <Route index element={<Inicio />} />
              <Route path="escrituras" element={<Escrituras />} />
              <Route path="financiamento-caixa" element={<FinanciamentoCaixa />} />
              <Route path="banco-privado" element={<BancoPrivado />} />
              <Route path="correcao" element={<Correcao />} />
              <Route path="admin/tabelas" element={<SoAdmin><AdminTabelas /></SoAdmin>} />
              <Route path="admin/gestao" element={<SoAdmin><AdminGestao /></SoAdmin>} />
              <Route path="admin/usuarios" element={<SoAdmin><AdminUsuarios /></SoAdmin>} />
              <Route path="admin/equipes" element={<SoAdmin><AdminEquipes /></SoAdmin>} />
              <Route path="equipe" element={<Equipe />} />
              <Route path="parceiros" element={<Parceiros />} />
              <Route path="doacao" element={<Doacao />} />
              <Route path="historico" element={<Historico />} />
              <Route path="agente" element={<Agente />} />
              <Route path="conta" element={<Conta />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ContaProvider>
    </BrowserRouter>
  );
}
