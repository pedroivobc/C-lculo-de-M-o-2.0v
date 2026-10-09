import { useEffect } from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Building2, Briefcase, FileSpreadsheet, Home, History, LayoutDashboard, LogOut, MessageCircle, UserRound, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Lockup } from '@/components/marca/Logo';
import { useConta } from '@/hooks/useConta';
import { EXIGIR_ASSINATURA } from '@/lib/config';
import { cn } from '@/lib/utils';
import { MUNICIPIOS, MUNICIPIO_OUTRA, MUNICIPIO_PADRAO } from '@/lib/calc';

function CidadeCurta() {
  return <>{useCidade().nome}</>;
}

export const CALCULADORAS = [
  { para: '/app/escrituras', rotulo: 'Escrituras', nota: '6 tipos de ato' },
  { para: '/app/financiamento-caixa', rotulo: 'Financiamento Caixa', nota: 'ITBI pelo SFH' },
  { para: '/app/banco-privado', rotulo: 'Banco privado', nota: 'Itaú, Bradesco, Santander' },
  { para: '/app/doacao', rotulo: 'Doação', nota: 'ITCD e atos' },
  { para: '/app/correcao', rotulo: 'Correção contratual', nota: 'Pelo INCC · Juiz de Fora', soJuizDeFora: true },
];

/** A correção contratual (INCC) só aparece para quem atua em Juiz de Fora. */
export const MUNICIPIO_CORRECAO = 'mg-juiz-de-fora';

/** Calculadoras que esta conta vê. */
export function useCalculadoras() {
  const { perfil } = useConta();
  return CALCULADORAS.filter((c) => !c.soJuizDeFora || perfil?.municipio_padrao === MUNICIPIO_CORRECAO);
}

type Item = { para: string; rotulo: string; soGestor?: boolean };

const CONTA: Item[] = [
  { para: '/app/historico', rotulo: 'Histórico' },
  { para: '/app/equipe', rotulo: 'Minha equipe', soGestor: true },
  { para: '/app/agente', rotulo: 'Agente WhatsApp' },
  { para: '/app/conta', rotulo: 'Conta e assinatura' },
];

/** Gestão de Negócio: só o administrador, alternando pelo botão do topo. */
export const GESTAO = [
  { para: '/app/admin/gestao', rotulo: 'Visão geral', curto: 'Visão geral', icone: LayoutDashboard },
  { para: '/app/admin/usuarios', rotulo: 'Usuários e planos', curto: 'Usuários', icone: Users },
  { para: '/app/admin/equipes', rotulo: 'Equipes', curto: 'Equipes', icone: Building2 },
  { para: '/app/admin/tabelas', rotulo: 'Tabelas anuais', curto: 'Tabelas', icone: FileSpreadsheet },
];

const ABAS = [
  { para: '/app', rotulo: 'Início', icone: Home, fim: true },
  { para: '/app/historico', rotulo: 'Histórico', icone: History },
  { para: '/app/equipe', rotulo: 'Equipe', icone: Users, soGestor: true },
  { para: '/app/agente', rotulo: 'Agente', icone: MessageCircle },
  { para: '/app/conta', rotulo: 'Conta', icone: UserRound },
];

const ULTIMA = { espaco: 'orca.visao.espaco', gestao: 'orca.visao.gestao' };
const lembrar = (chave: string, valor?: string) => {
  try {
    if (valor === undefined) return sessionStorage.getItem(chave);
    sessionStorage.setItem(chave, valor);
  } catch { /* sem armazenamento: volta para o início de cada visão */ }
  return null;
};

/** Botão do topo (só administrador): alterna entre o espaço de trabalho Teams e a Gestão de Negócio. */
function AlternarVisao({ gestao, className }: { gestao: boolean; className?: string }) {
  const navegar = useNavigate();
  const { pathname, search } = useLocation();
  // Guarda onde a pessoa estava em cada visão, para voltar ao mesmo lugar.
  useEffect(() => { lembrar(gestao ? ULTIMA.gestao : ULTIMA.espaco, pathname + search); }, [gestao, pathname, search]);
  const ir = (paraGestao: boolean) => {
    if (paraGestao === gestao) return;
    navegar(lembrar(paraGestao ? ULTIMA.gestao : ULTIMA.espaco) ?? (paraGestao ? '/app/admin/gestao' : '/app'));
  };
  const opcao = (ativa: boolean) => cn('flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-bold whitespace-nowrap transition-colors sm:flex-none',
    ativa ? 'bg-tinta text-white' : 'text-suave hover:text-texto');
  return (
    <div role="group" aria-label="Visão" className={cn('flex rounded-full border border-linha bg-nevoa p-1', className)}>
      <button type="button" aria-pressed={!gestao} onClick={() => ir(false)} className={opcao(!gestao)}>
        <Briefcase className="size-4" strokeWidth={2} aria-hidden="true" />Meu espaço
      </button>
      <button type="button" aria-pressed={gestao} onClick={() => ir(true)} className={opcao(gestao)}>
        <BarChart3 className="size-4" strokeWidth={2} aria-hidden="true" />Gestão de Negócio
      </button>
    </div>
  );
}

const itemMenu = ({ isActive }: { isActive: boolean }) =>
  cn('block rounded-[10px] px-3 py-2.5 font-semibold no-underline transition-colors', isActive ? 'bg-tinta font-bold text-white' : 'text-texto hover:bg-nevoa');

/** Cidade do assinante (definida no cadastro); troca em Conta. */
function useCidade() {
  const { perfil } = useConta();
  const nome = perfil?.municipio_padrao === MUNICIPIO_OUTRA ? perfil.cidade_nome ?? 'Sua cidade' : MUNICIPIOS[perfil?.municipio_padrao ?? MUNICIPIO_PADRAO]?.nome ?? 'Juiz de Fora';
  const pct = perfil?.itbi_percentual != null ? Number(perfil.itbi_percentual)
    : (MUNICIPIOS[perfil?.municipio_padrao ?? MUNICIPIO_PADRAO]?.itbi.aliquota ?? 0) * 100;
  return { nome, itbi: `${String(pct).replace('.', ',')}%` };
}

function SeletorMunicipio({ className }: { className?: string }) {
  const { nome, itbi } = useCidade();
  return (
    <div className={cn('flex flex-col gap-1.5 text-xs font-bold text-suave', className)}>
      Município
      <Link to="/app/conta" className="flex min-h-11 items-center gap-2 rounded-[10px] border border-borda bg-white px-3 no-underline hover:border-tinta" aria-label={`Município: ${nome}, ITBI ${itbi}. Alterar em Conta`}>
        <span aria-hidden="true" className="h-0 w-0 shrink-0 border-x-[6px] border-b-[10px] border-x-transparent border-b-minas" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-bold text-tinta">{nome} · MG</span>
          <span className="text-[11px] font-semibold text-suave">ITBI {itbi}</span>
        </span>
        <span className="text-xs font-bold text-acao">Alterar</span>
      </Link>
    </div>
  );
}

/** Encerra a sessão e volta para a página inicial. */
function useSair() {
  const navegar = useNavigate();
  return async () => {
    await supabase.auth.signOut();
    navegar('/');
  };
}

export function AppLayout() {
  const { ativa, carregando } = useConta();
  const { pathname } = useLocation();
  const telaDeCalculo = CALCULADORAS.some((c) => pathname.startsWith(c.para));
  const calculadoras = useCalculadoras();
  const { perfil, equipe } = useConta();
  const admin = perfil?.papel === 'admin';
  const modoGestao = admin && pathname.startsWith('/app/admin');
  // O administrador trabalha como gestor de equipe; sem equipe ainda, "Minha equipe" mostra como criar a dele.
  const gestor = equipe?.funcao === 'gestor' || (admin && !equipe);
  const conta = CONTA.filter((c) => !c.soGestor || gestor);
  const abas = modoGestao
    ? GESTAO.map((g) => ({ para: g.para, rotulo: g.curto, icone: g.icone, fim: false }))
    : ABAS.filter((a) => !a.soGestor || gestor);
  const sair = useSair();

  return (
    <div className="min-h-screen lg:flex">
      {/* Menu lateral (computador) */}
      <aside className="hidden w-64 shrink-0 flex-col gap-5 border-r border-linha bg-white px-4 py-5 lg:sticky lg:top-0 lg:flex lg:h-screen lg:overflow-y-auto">
        <Link to="/app" className="px-2 py-1 no-underline"><Lockup tamanho={22} /></Link>
        {modoGestao ? (
          <nav aria-label="Gestão de Negócio" className="flex flex-col gap-0.5">
            <span className="px-3 pt-1 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-suave">Gestão de Negócio</span>
            {GESTAO.map((g) => <NavLink key={g.para} to={g.para} className={itemMenu}>{g.rotulo}</NavLink>)}
          </nav>
        ) : (
          <>
            <SeletorMunicipio className="px-1" />
            <nav aria-label="Menu principal" className="flex flex-col gap-0.5">
              <NavLink to="/app" end className={itemMenu}>Início</NavLink>
              <span className="px-3 pt-4 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-suave">Calcular</span>
              {calculadoras.map((c) => <NavLink key={c.para} to={c.para} className={itemMenu}>{c.rotulo}</NavLink>)}
              <span className="px-3 pt-4 pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-suave">Minha conta</span>
              {conta.map((c) => <NavLink key={c.para} to={c.para} className={itemMenu}>{c.rotulo}</NavLink>)}
            </nav>
          </>
        )}
        {!modoGestao && (equipe ? (
          <div className="mt-auto flex flex-col gap-1.5 rounded-2xl border border-dashed border-borda p-3.5">
            <span className="font-bold">{equipe.nome}</span>
            <span className="text-sm text-suave">{carregando ? '…' : ativa ? (equipe.tipo === 'clemente' ? 'Clemente Team' : 'Plano Teams ativo') : 'Plano da equipe inativo'}</span>
            {gestor && <Link to="/app/equipe" className="font-bold text-acao">Gerenciar equipe</Link>}
          </div>
        ) : admin ? (
          <div className="mt-auto flex flex-col gap-1.5 rounded-2xl border border-dashed border-borda p-3.5">
            <span className="font-bold">Administrador</span>
            <span className="text-sm text-suave">Acesso completo, sem assinatura</span>
            <Link to="/app/equipe" className="font-bold text-acao">Montar minha equipe</Link>
          </div>
        ) : (
          <div className="mt-auto flex flex-col gap-1.5 rounded-2xl border border-dashed border-borda p-3.5">
            <span className="font-bold">{carregando ? '…' : ativa ? 'Assinatura ativa' : 'Sem assinatura ativa'}</span>
            <Link to={ativa ? '/app/conta' : '/assinar'} className="font-bold text-acao">{ativa ? 'Gerenciar assinatura' : 'Ver planos'}</Link>
          </div>
        ))}
        <button type="button" onClick={sair} className={cn(modoGestao ? 'mt-auto' : '-mt-2', 'flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-left font-semibold text-suave transition-colors hover:bg-nevoa hover:text-texto')}>
          <LogOut className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
          Sair
        </button>
      </aside>

      <div className="min-w-0 flex-1 pb-24 lg:pb-0">
        {/* Topo (celular) */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-linha bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
          <Link to="/app" className="no-underline"><Lockup tamanho={18} /></Link>
          <div className="flex items-center gap-1">
            {!modoGestao && (
              <span className="flex items-center gap-1.5 rounded-full bg-nevoa px-3 py-1.5 text-xs font-bold">
                <span aria-hidden="true" className="h-0 w-0 border-x-[5px] border-b-[8px] border-x-transparent border-b-minas" /><CidadeCurta />
              </span>
            )}
            <button type="button" onClick={sair} aria-label="Sair da conta" className="flex size-11 items-center justify-center rounded-full text-suave hover:bg-nevoa hover:text-texto">
              <LogOut className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </header>

        {admin && (
          <div className="flex items-center justify-between gap-3 border-b border-linha bg-white/95 px-4 py-2 backdrop-blur lg:sticky lg:top-0 lg:z-10 lg:px-8">
            <span className="hidden text-sm font-semibold text-suave sm:block">{modoGestao ? 'Gestão de Negócio · visão do administrador' : 'Meu espaço · cálculos e equipe'}</span>
            <AlternarVisao gestao={modoGestao} className="w-full sm:w-auto" />
          </div>
        )}

        {!carregando && !ativa && !admin && !equipe && !EXIGIR_ASSINATURA && (
          <div className="border-b border-[#f5df8a] bg-amarelo-claro px-4 py-2.5 text-sm font-medium text-amarelo-texto lg:px-8">
            Sua conta ainda não tem assinatura ativa: o agente do WhatsApp só responde a assinantes. <Link to="/assinar" className="font-bold text-amarelo-texto underline">Ver planos</Link>
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      {/* Barra inferior (celular) — some nas telas de cálculo, que têm botões fixos próprios */}
      {!telaDeCalculo && (
        <nav aria-label="Navegação" className="fixed inset-x-0 bottom-0 z-30 grid auto-cols-fr grid-flow-col gap-1 border-t border-linha bg-white px-2 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] lg:hidden">
          {abas.map(({ para, rotulo, icone: Icone, fim }) => (
            <NavLink
              key={para}
              to={para}
              end={fim}
              className={({ isActive }) => cn('flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-bold no-underline', isActive ? 'bg-acao-claro text-acao' : 'text-suave')}
            >
              <Icone className="size-[22px]" strokeWidth={1.75} aria-hidden="true" />
              {rotulo}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
