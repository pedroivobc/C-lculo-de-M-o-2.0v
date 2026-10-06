import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import { api } from '@/lib/api';
import { useConta } from '@/hooks/useConta';
import { Lockup } from '@/components/marca/Logo';
import { Aviso, Botao, Campo } from '@/components/ui/Campos';
import { PLANOS, PRECO, type Nivel } from '@/lib/config';
import { telefoneBonito } from '@/lib/formato';
import { cn } from '@/lib/utils';

/** Moldura das telas de acesso: painel da marca à esquerda (some no celular), formulário à direita. */
function Moldura({ etapa, children }: { etapa?: 1 | 2 | 3; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-wrap">
      <section className="hidden flex-1 basis-[440px] flex-col gap-8 bg-tinta p-12 text-white lg:flex">
        <Link to="/" className="no-underline"><Lockup tamanho={24} escuro /></Link>
        <div className="mt-auto flex max-w-[480px] flex-col gap-4">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-marca-texto">Seu WhatsApp é a sua chave</span>
          <h1 className="text-4xl font-extrabold leading-[44px]">Cadastre o número que vai conversar com o agente.</h1>
          <p className="text-base leading-[26px] text-[#c7cedb]">Depois da assinatura, qualquer mensagem desse número cai direto na sua conta: o agente reconhece você, calcula e guarda tudo no seu histórico.</p>
        </div>
        <ol className="flex max-w-[480px] flex-col gap-3">
          {['Crie a conta com seu WhatsApp', 'Confirme o número com o código', `Escolha o plano: a partir de ${PRECO.mensal}/mês`].map((t, i) => (
            <li key={t} className="flex items-center gap-3">
              <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full font-extrabold', etapa && i + 1 <= etapa ? 'bg-marca-texto text-tinta' : 'bg-[#1f2b44]')}>{i + 1}</span>{t}
            </li>
          ))}
        </ol>
      </section>
      <main className="flex flex-1 basis-[480px] flex-col">
        <header className="flex items-center justify-between px-5 py-4 lg:hidden">
          <Link to="/" className="no-underline"><Lockup tamanho={20} /></Link>
          {etapa && <span className="text-sm font-semibold text-suave">Etapa {etapa} de 3</span>}
        </header>
        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-6 sm:py-12">
          <div className="flex w-full max-w-[420px] flex-col gap-5">{children}</div>
        </div>
      </main>
    </div>
  );
}

function AvisoSemSupabase() {
  return supabaseConfigurado ? null : <Aviso tom="vermelho">Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env para o login funcionar.</Aviso>;
}

export function Entrar() {
  const navegar = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true); setErro(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setEnviando(false);
    if (error) return setErro(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
    navegar('/app');
  }

  return (
    <Moldura>
      <form onSubmit={enviar} className="flex flex-col gap-5">
        <div>
          <h2 className="text-[28px] font-bold leading-[34px]">Entrar</h2>
          <p className="text-suave">Bem-vindo de volta.</p>
        </div>
        <AvisoSemSupabase />
        <Campo rotulo="E-mail" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Campo rotulo="Senha" type="password" required autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        {erro && <Aviso tom="vermelho">{erro}</Aviso>}
        <Botao type="submit" disabled={enviando} className="min-h-[52px] text-base">{enviando ? 'Entrando…' : 'Entrar'}</Botao>
        <p className="text-center text-suave">Ainda não tem conta? <Link to="/cadastro" className="font-bold text-acao">Criar conta</Link></p>
      </form>
    </Moldura>
  );
}

export function Cadastro() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const [d, setD] = useState({ nome: '', email: '', whatsapp: '', senha: '' });
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const muda = (k: keyof typeof d) => (e: ChangeEvent<HTMLInputElement>) => setD((s) => ({ ...s, [k]: e.target.value }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true); setErro(null);
    try {
      const { data, error } = await supabase.auth.signUp({ email: d.email, password: d.senha, options: { data: { full_name: d.nome } } });
      if (error) throw error;
      if (!data.session) {
        setErro('Conta criada. Confirme o e-mail que enviamos e depois entre para validar o WhatsApp.');
        return;
      }
      await api('/api/whatsapp/codigo', { corpo: { whatsapp: d.whatsapp } });
      sessionStorage.setItem('orcai:whatsapp', d.whatsapp);
      navegar(`/verificar${params.toString() ? `?${params}` : ''}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally { setEnviando(false); }
  }

  return (
    <Moldura etapa={1}>
      <form onSubmit={enviar} className="flex flex-col gap-5">
        <div>
          <h2 className="text-[28px] font-bold leading-[34px]">Criar conta</h2>
          <p className="text-suave">Leva menos de um minuto.</p>
        </div>
        <AvisoSemSupabase />
        <Campo rotulo="Nome completo" required autoComplete="name" value={d.nome} onChange={muda('nome')} />
        <Campo rotulo="E-mail" type="email" required autoComplete="email" value={d.email} onChange={muda('email')} />
        <Campo rotulo="WhatsApp com DDD" type="tel" required autoComplete="tel" placeholder="(32) 99999-0000" value={d.whatsapp} onChange={muda('whatsapp')}
          dica="Enviaremos um código para confirmar. É por ele que o agente reconhece você." />
        <Campo rotulo="Senha" type="password" required minLength={8} autoComplete="new-password" value={d.senha} onChange={muda('senha')} dica="Mínimo de 8 caracteres." />
        <label className="flex items-start gap-2.5 text-suave">
          <input type="checkbox" required checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5 size-[18px] accent-acao" />
          <span>Li e aceito os termos de uso e a política de privacidade (LGPD).</span>
        </label>
        {erro && <Aviso tom="vermelho">{erro}</Aviso>}
        <Botao type="submit" disabled={enviando} className="min-h-[52px] text-base">{enviando ? 'Enviando…' : 'Enviar código no WhatsApp'}</Botao>
        <p className="text-center text-suave">Já tem conta? <Link to="/entrar" className="font-bold text-acao">Entrar</Link></p>
      </form>
    </Moldura>
  );
}

export function Verificar() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const { perfil, recarregar } = useConta();
  const [whatsapp, setWhatsapp] = useState(sessionStorage.getItem('orcai:whatsapp') ?? '');
  const [enviado, setEnviado] = useState(!!sessionStorage.getItem('orcai:whatsapp'));
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [espera, setEspera] = useState(enviado ? 60 : 0);

  useEffect(() => {
    if (!espera) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function pedirCodigo() {
    setOcupado(true); setErro(null);
    try {
      await api('/api/whatsapp/codigo', { corpo: { whatsapp } });
      sessionStorage.setItem('orcai:whatsapp', whatsapp);
      setEnviado(true); setEspera(60);
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setOcupado(false); }
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true); setErro(null);
    try {
      await api('/api/whatsapp/verificar', { corpo: { codigo } });
      sessionStorage.removeItem('orcai:whatsapp');
      await recarregar();
      navegar(`/assinar${params.toString() ? `?${params}` : ''}`);
    } catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
    finally { setOcupado(false); }
  }

  return (
    <Moldura etapa={2}>
      <div>
        <h2 className="text-[28px] font-bold leading-[34px]">Confirme seu WhatsApp</h2>
        <p className="text-suave">
          {enviado ? <>Mandamos um código de 6 dígitos para <strong className="text-tinta">{telefoneBonito(whatsapp.startsWith('+') ? whatsapp : `+55${whatsapp.replace(/\D/g, '')}`)}</strong>.</>
            : perfil?.whatsapp_verified_at ? `Número atual: ${telefoneBonito(perfil.whatsapp_e164)}. Informe o novo número.` : 'Informe o número que vai conversar com o agente.'}
        </p>
      </div>
      {!enviado ? (
        <>
          <Campo rotulo="WhatsApp com DDD" type="tel" placeholder="(32) 99999-0000" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          <Botao onClick={pedirCodigo} disabled={ocupado || whatsapp.replace(/\D/g, '').length < 10} className="min-h-[52px] text-base">{ocupado ? 'Enviando…' : 'Enviar código'}</Botao>
        </>
      ) : (
        <form onSubmit={confirmar} className="flex flex-col gap-4">
          <Campo rotulo="Código" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} style={{ fontFamily: 'var(--font-display)', textAlign: 'center', fontSize: 24, letterSpacing: '0.5em' }} />
          <Botao type="submit" disabled={ocupado || codigo.length !== 6} className="min-h-[52px] text-base">{ocupado ? 'Confirmando…' : 'Confirmar'}</Botao>
          <div className="flex justify-between gap-3 text-sm">
            <button type="button" className="min-h-11 font-bold text-acao disabled:text-suave" disabled={!!espera || ocupado} onClick={pedirCodigo}>{espera ? `Reenviar em 0:${String(espera).padStart(2, '0')}` : 'Reenviar código'}</button>
            <button type="button" className="min-h-11 font-bold text-acao" onClick={() => { setEnviado(false); setCodigo(''); }}>Usar outro número</button>
          </div>
        </form>
      )}
      {erro && <Aviso tom="vermelho">{erro}</Aviso>}
      <Aviso>É este número que o agente vai reconhecer. Use o WhatsApp que você leva no dia a dia.</Aviso>
    </Moldura>
  );
}

export function Assinar() {
  const [params] = useSearchParams();
  const [nivel, setNivel] = useState<Nivel>(params.get('nivel') === 'usuario' ? 'usuario' : 'pro');
  const [anual, setAnual] = useState(params.get('plano') !== 'mensal');
  const { perfil } = useConta();
  const plano = PLANOS[nivel];

  return (
    <Moldura etapa={3}>
      <div>
        <h2 className="text-[28px] font-bold leading-[34px]">Escolha seu plano</h2>
        <p className="text-suave">Os dois têm calculadoras, agente no WhatsApp, leitura do IPTU e exportação.</p>
      </div>
      <div role="group" aria-label="Plano" className="flex flex-col gap-2.5">
        {(['pro', 'usuario'] as const).map((n) => (
          <button key={n} type="button" aria-pressed={nivel === n} onClick={() => setNivel(n)}
            className={cn('flex flex-col gap-1 rounded-2xl border-2 bg-white p-4 text-left', nivel === n ? 'border-acao' : 'border-linha')}>
            <span className="flex w-full items-center justify-between gap-2">
              <span className="text-base font-bold">{PLANOS[n].nome}</span>
              {n === 'pro' && <span className="rounded-full bg-acao-claro px-2.5 py-0.5 text-xs font-bold text-acao">Sua logo e cores</span>}
            </span>
            <span className="numero text-[26px] font-extrabold">{anual ? `${PLANOS[n].anual}/ano` : `${PLANOS[n].mensal}/mês`}</span>
            <span className="text-suave">{PLANOS[n].resumo}</span>
          </button>
        ))}
      </div>
      <div role="group" aria-label="Período" className="grid grid-cols-2 gap-1 rounded-xl bg-cinza p-1">
        {[[true, 'Anual · 2 meses grátis'], [false, 'Mensal']].map(([v, r]) => (
          <button key={String(v)} type="button" aria-pressed={anual === v} onClick={() => setAnual(v as boolean)}
            className={cn('min-h-11 rounded-[9px] text-sm font-bold', anual === v ? 'bg-white text-tinta shadow-sm' : 'text-suave')}>{r as string}</button>
        ))}
      </div>
      {anual && <p className="text-suave">Equivale a {plano.anualPorMes}/mês.</p>}
      <Aviso tom="azul">
        O pagamento online (Pix e cartão) entra na próxima etapa. Por enquanto a ativação é feita pela equipe: chame no WhatsApp e informe o plano {plano.nome} {anual ? 'anual' : 'mensal'}{perfil?.email ? ` e o e-mail ${perfil.email}` : ''}.
      </Aviso>
      <Link to="/app" className="inline-flex min-h-[52px] items-center justify-center rounded-xl bg-acao text-base font-bold text-white no-underline">Ir para o app</Link>
    </Moldura>
  );
}
