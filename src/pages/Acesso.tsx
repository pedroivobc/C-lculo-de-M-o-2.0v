import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, supabaseConfigurado } from '@/lib/supabase';
import { api } from '@/lib/api';
import { useConta } from '@/hooks/useConta';
import { Lockup } from '@/components/marca/Logo';
import { Aviso, Botao, Campo } from '@/components/ui/Campos';
import { A_PARTIR_DE, AGENTE_WHATSAPP, DIAS_TESTE, formasDoPeriodo, DIAS_ARREPENDIMENTO, LANCAMENTO_TEXTO, OFERTA_LANCAMENTO, lerPeriodo, PERIODOS, PLANOS, preco, type Forma, type Nivel, type Periodo } from '@/lib/config';
import { SeletorPeriodo } from '@/components/ui/SeletorPeriodo';
import { telefoneBonito } from '@/lib/formato';
import { cpfValido, mascararCpf, soDigitosCpf } from '@/lib/cpf';
import { ConfiguracaoOrcamento } from '@/components/conta/ConfiguracaoOrcamento';
import { cn } from '@/lib/utils';

/** Moldura das telas de acesso: painel da marca à esquerda (some no celular), formulário à direita. */
function Moldura({ etapa, children, largo = false }: { etapa?: 1 | 2 | 3 | 4; children: ReactNode; largo?: boolean }) {
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
          {['Crie a conta com seu WhatsApp', 'Confirme o número enviando um código ao agente', 'Configure seu orçamento: cidade, ITBI, logo e formato', `Escolha o plano: a partir de ${A_PARTIR_DE}/mês`].map((t, i) => (
            <li key={t} className="flex items-center gap-3">
              <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full font-extrabold', etapa && i + 1 <= etapa ? 'bg-marca-texto text-tinta' : 'bg-[#1f2b44]')}>{i + 1}</span>{t}
            </li>
          ))}
        </ol>
      </section>
      <main className="flex flex-1 basis-[480px] flex-col">
        <header className="flex items-center justify-between px-5 py-4 lg:hidden">
          <Link to="/" className="no-underline"><Lockup tamanho={20} /></Link>
          {etapa && <span className="text-sm font-semibold text-suave">Etapa {etapa} de 4</span>}
        </header>
        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-6 sm:py-12">
          <div className={cn('flex w-full flex-col gap-5', largo ? 'max-w-[560px]' : 'max-w-[420px]')}>{children}</div>
        </div>
      </main>
    </div>
  );
}

function AvisoSemSupabase() {
  return supabaseConfigurado ? null : <Aviso tom="vermelho">Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env para o login funcionar.</Aviso>;
}

/** Lê o que o link do e-mail (convite, nova senha) deixou no endereço: o tipo do link ou o erro. */
function linkDoEmail() {
  const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const q = new URLSearchParams(window.location.search);
  return { tipo: h.get('type') ?? q.get('type'), erro: h.get('error_code') ?? q.get('error_code') };
}

export function Entrar() {
  const navegar = useNavigate();
  // Lido uma vez: o Supabase limpa o endereço assim que troca o link pela sessão.
  const [link] = useState(linkDoEmail);
  const [modo, setModo] = useState<'entrar' | 'esqueci' | 'definir'>(link.tipo === 'invite' || link.tipo === 'recovery' ? 'definir' : 'entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(link.erro
    ? link.erro === 'otp_expired' ? 'Este link expirou ou já foi usado. Digite seu e-mail em "Esqueci a senha" para receber um novo.' : 'Não conseguimos abrir este link. Peça um novo em "Esqueci a senha".'
    : null);
  const [ok, setOk] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((evento) => { if (evento === 'PASSWORD_RECOVERY') setModo('definir'); });
    return () => subscription.unsubscribe();
  }, []);

  function trocar(m: typeof modo) { setModo(m); setErro(null); setOk(null); }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true); setErro(null); setOk(null);
    if (modo === 'esqueci') {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/entrar` });
      setEnviando(false);
      if (error) return setErro(error.message);
      return setOk('Se este e-mail tiver conta, você vai receber um link para criar a senha. Confira também o spam.');
    }
    if (modo === 'definir') {
      if (senha !== confirmacao) { setEnviando(false); return setErro('As duas senhas não são iguais.'); }
      const { error } = await supabase.auth.updateUser({ password: senha });
      setEnviando(false);
      if (error) return setErro(error.message.includes('session') ? 'Este link expirou. Peça um novo em "Esqueci a senha".' : error.message);
      return navegar('/app');
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setEnviando(false);
    if (error) return setErro(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
    navegar('/app');
  }

  const titulo = { entrar: ['Entrar', 'Bem-vindo de volta.'], esqueci: ['Esqueci a senha', 'Mandamos um link para você criar uma senha nova.'], definir: ['Crie sua senha', 'É com ela que você vai entrar no site daqui pra frente.'] }[modo];
  return (
    <Moldura>
      <form onSubmit={enviar} className="flex flex-col gap-5">
        <div>
          <h2 className="text-[28px] font-bold leading-[34px]">{titulo[0]}</h2>
          <p className="text-suave">{titulo[1]}</p>
        </div>
        <AvisoSemSupabase />
        {modo !== 'definir' && <Campo rotulo="E-mail" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
        {modo === 'entrar' && <Campo rotulo="Senha" type="password" required autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />}
        {modo === 'definir' && <>
          <Campo rotulo="Nova senha" type="password" required minLength={8} autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} dica="Mínimo de 8 caracteres." />
          <Campo rotulo="Repita a senha" type="password" required minLength={8} autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
        </>}
        {erro && <Aviso tom="vermelho">{erro}</Aviso>}
        {ok && <Aviso tom="verde">{ok}</Aviso>}
        <Botao type="submit" disabled={enviando} className="min-h-[52px] text-base">
          {enviando ? 'Enviando…' : modo === 'entrar' ? 'Entrar' : modo === 'esqueci' ? 'Mandar link' : 'Salvar senha e entrar'}
        </Botao>
        {modo === 'entrar' && <button type="button" onClick={() => trocar('esqueci')} className="text-center font-bold text-acao">Esqueci a senha</button>}
        {modo === 'esqueci' && <button type="button" onClick={() => trocar('entrar')} className="text-center font-bold text-acao">Voltar para entrar</button>}
        {modo === 'entrar' && <p className="text-center text-suave">Ainda não tem conta? <Link to="/cadastro" className="font-bold text-acao">Criar conta</Link></p>}
      </form>
    </Moldura>
  );
}

const CHAVE_CPF = 'orcai:cpf';
const guardarCpf = (c: string | null) => { try { if (c) sessionStorage.setItem(CHAVE_CPF, c); else sessionStorage.removeItem(CHAVE_CPF); } catch { /* sem storage */ } };
const cpfGuardado = () => { try { return sessionStorage.getItem(CHAVE_CPF); } catch { return null; } };

/** Grava no servidor o CPF digitado no cadastro. */
async function aplicarCpfPendente(cpf = cpfGuardado()): Promise<{ ok: boolean; erro?: string }> {
  if (!cpf) return { ok: false };
  try {
    await api('/api/conta/cpf', { corpo: { cpf } });
    guardarCpf(null);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

const CHAVE_CUPOM = 'orcai:cupom';
const guardarCupom = (c: string | null) => { try { if (c) localStorage.setItem(CHAVE_CUPOM, c); else localStorage.removeItem(CHAVE_CUPOM); } catch { /* sem storage */ } };
const cupomGuardado = () => { try { return localStorage.getItem(CHAVE_CUPOM); } catch { return null; } };

/** Aplica o cupom de indicação guardado no cadastro (pode ficar para depois da confirmação do e-mail). */
async function aplicarCupomPendente(): Promise<string | null> {
  const c = cupomGuardado();
  if (!c) return null;
  try {
    const r = await api<{ nome: string; dias: number }>('/api/indicacao/usar', { corpo: { codigo: c } });
    return `Cupom de ${r.nome} aplicado: seu teste grátis é de ${r.dias} dias.`;
  } catch {
    return null; // cupom inválido ou já usado: segue sem ele
  } finally { guardarCupom(null); }
}

/** Campo do cupom de indicação: confere enquanto a pessoa digita e mostra de quem é. */
function CampoCupom({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  const [info, setInfo] = useState<{ valido: boolean; nome?: string; dias: number } | null>(null);
  useEffect(() => {
    const c = valor.trim();
    if (c.length < 4) { setInfo(null); return; }
    const t = setTimeout(() => {
      api<{ valido: boolean; nome?: string; dias: number }>(`/api/indicacao/validar?codigo=${encodeURIComponent(c)}`, { publico: true })
        .then((r) => setInfo(typeof r?.valido === 'boolean' ? r : null)).catch(() => setInfo(null));
    }, 400);
    return () => clearTimeout(t);
  }, [valor]);
  return (
    <Campo rotulo="Cupom de indicação (opcional)" value={valor} autoComplete="off" maxLength={20} placeholder="Ex.: PEDRO7K2"
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      dica={info?.valido ? `✅ Cupom de ${info.nome}: você ganha ${info.dias} dias grátis em vez de 3.`
        : info ? 'Cupom não encontrado. Confira as letras e os números.' : 'Com cupom de um assinante, o teste grátis é de 5 dias.'} />
  );
}

export function Cadastro() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const [d, setD] = useState({ nome: '', email: '', cpf: '', whatsapp: '', senha: '' });
  const [cupom, setCupom] = useState((params.get('cupom') ?? cupomGuardado() ?? '').toUpperCase());
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const muda = (k: keyof typeof d) => (e: ChangeEvent<HTMLInputElement>) => setD((s) => ({ ...s, [k]: e.target.value }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!cpfValido(d.cpf)) return setErro('CPF inválido. Confira os números.');
    setEnviando(true); setErro(null); setOk(null);
    try {
      const { data, error } = await supabase.auth.signUp({ email: d.email, password: d.senha, options: { data: { full_name: d.nome, telefone: d.whatsapp.replace(/\D/g, '') } } });
      if (error) throw error;
      guardarCupom(cupom.trim() || null);
      guardarCpf(soDigitosCpf(d.cpf));
      if (!data.session) {
        setOk('Conta criada! Abra o e-mail que enviamos, toque no link de confirmação e depois entre.');
        return;
      }
      // CPF repetido ou recusado: a tela de CPF explica e deixa corrigir.
      if (!(await aplicarCpfPendente()).ok) return navegar(`/cpf${params.toString() ? `?${params}` : ''}`);
      await aplicarCupomPendente();
      // Com o agente no ar, já gera o código do WhatsApp (dá para pular); sem ele, segue direto para a configuração.
      if (AGENTE_WHATSAPP && d.whatsapp.replace(/\D/g, '').length >= 10) {
        await pedirConfirmacao(d.whatsapp);
        return navegar(`/verificar${params.toString() ? `?${params}` : ''}`);
      }
      navegar(`/configurar${params.toString() ? `?${params}` : ''}`);
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
        <Campo rotulo="CPF" required inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={mascararCpf(d.cpf)}
          onChange={(e) => setD((s) => ({ ...s, cpf: soDigitosCpf(e.target.value) }))} aria-invalid={d.cpf.length === 11 && !cpfValido(d.cpf)}
          dica={d.cpf.length === 11 && !cpfValido(d.cpf) ? 'CPF inválido. Confira os números.' : 'Um CPF por conta. Também vai na nota fiscal da assinatura.'} />
        <Campo rotulo="WhatsApp com DDD" type="tel" required autoComplete="tel" placeholder="(32) 99999-0000" value={d.whatsapp} onChange={muda('whatsapp')}
          dica="Na próxima tela você confirma o número mandando um código para o agente. É por ele que o agente reconhece você." />
        <Campo rotulo="Senha" type="password" required minLength={8} autoComplete="new-password" value={d.senha} onChange={muda('senha')} dica="Mínimo de 8 caracteres." />
        <CampoCupom valor={cupom} onChange={setCupom} />
        <label className="flex items-start gap-2.5 text-suave">
          <input type="checkbox" required checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5 size-[18px] accent-acao" />
          <span>Li e aceito os <Link to="/termos" target="_blank" className="font-bold text-acao">termos de uso</Link> e a <Link to="/privacidade" target="_blank" className="font-bold text-acao">política de privacidade</Link> (LGPD).</span>
        </label>
        {erro && <Aviso tom="vermelho">{erro}</Aviso>}
        {ok && <Aviso tom="verde">{ok}</Aviso>}
        <Botao type="submit" disabled={enviando} className="min-h-[52px] text-base">{enviando ? 'Criando…' : 'Criar conta'}</Botao>
        <p className="text-center text-suave">Já tem conta? <Link to="/entrar" className="font-bold text-acao">Entrar</Link></p>
      </form>
    </Moldura>
  );
}

interface Pedido { whatsapp: string; codigo: string; mensagem: string }
const CHAVE_PEDIDO = 'orcai:verificacao';

function lerPedido(): Pedido | null {
  try { return JSON.parse(sessionStorage.getItem(CHAVE_PEDIDO) ?? 'null'); } catch { return null; }
}

/** Gera o código de confirmação e guarda na sessão para a tela de verificação. */
async function pedirConfirmacao(whatsapp: string): Promise<Pedido> {
  const pedido = await api<Pedido>('/api/whatsapp/codigo', { corpo: { whatsapp } });
  try { sessionStorage.setItem(CHAVE_PEDIDO, JSON.stringify(pedido)); } catch { /* sem sessionStorage: segue só em memória */ }
  return pedido;
}

/**
 * Confirmação do WhatsApp: o corretor envia ao agente a mensagem com o código.
 * A tela consulta o perfil a cada 3 s e avança quando o agente confirma o número.
 */
/** Conta sem CPF (antiga, ou CPF recusado no cadastro): pede o CPF antes de seguir. */
export function CompletarCpf() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const { perfil, recarregar } = useConta();
  const [cpf, setCpf] = useState(cpfGuardado() ?? '');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const jaTentou = useRef(false);

  async function enviar(e?: FormEvent) {
    e?.preventDefault();
    if (!cpfValido(cpf)) return setErro('CPF inválido. Confira os números.');
    setOcupado(true); setErro(null);
    const r = await aplicarCpfPendente(soDigitosCpf(cpf));
    if (!r.ok) { setOcupado(false); return setErro(r.erro ?? 'Não foi possível salvar o CPF.'); }
    await aplicarCupomPendente();
    await recarregar();
    setOcupado(false);
    navegar(`${AGENTE_WHATSAPP && !perfil?.whatsapp_verified_at ? '/verificar' : '/app'}${params.toString() ? `?${params}` : ''}`);
  }

  // Veio do cadastro com CPF recusado: mostra o motivo de cara.
  useEffect(() => {
    if (jaTentou.current || !cpfGuardado()) return;
    jaTentou.current = true;
    aplicarCpfPendente().then((r) => { if (r.ok) enviar(); else if (r.erro) setErro(r.erro); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Moldura etapa={1}>
      <form onSubmit={enviar} className="flex flex-col gap-5">
        <div>
          <h2 className="text-[28px] font-bold leading-[34px]">Informe seu CPF</h2>
          <p className="text-suave">Cada CPF tem uma conta só. Ele também vai na nota fiscal da assinatura.</p>
        </div>
        <Campo rotulo="CPF" required inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={mascararCpf(cpf)}
          onChange={(e) => setCpf(soDigitosCpf(e.target.value))} />
        {erro && <Aviso tom="vermelho">{erro}</Aviso>}
        <Botao type="submit" disabled={ocupado || soDigitosCpf(cpf).length !== 11} className="min-h-[52px] text-base">{ocupado ? 'Salvando…' : 'Continuar'}</Botao>
      </form>
    </Moldura>
  );
}

export function Verificar() {
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const { perfil, recarregar } = useConta();
  const [pedido, setPedido] = useState<Pedido | null>(lerPedido);
  const [whatsapp, setWhatsapp] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmadoAntes] = useState(perfil?.whatsapp_verified_at ?? null);
  const [avisoCupom, setAvisoCupom] = useState<string | null>(null);

  // Quem confirmou o e-mail antes de entrar chega aqui com o cupom ainda guardado.
  useEffect(() => { aplicarCupomPendente().then(setAvisoCupom); }, []);

  useEffect(() => {
    if (!pedido) return;
    const t = setInterval(() => { recarregar({ silencioso: true }); }, 3000);
    return () => clearInterval(t);
  }, [pedido, recarregar]);

  useEffect(() => {
    if (!pedido || !perfil?.whatsapp_verified_at || perfil.whatsapp_verified_at === confirmadoAntes) return;
    try { sessionStorage.removeItem(CHAVE_PEDIDO); } catch { /* ok */ }
    navegar(`/configurar${params.toString() ? `?${params}` : ''}`);
  }, [pedido, perfil?.whatsapp_verified_at, confirmadoAntes, navegar, params]);

  async function gerar(e?: FormEvent) {
    e?.preventDefault();
    setOcupado(true); setErro(null);
    try { setPedido(await pedirConfirmacao(whatsapp)); }
    catch (err) { setErro(err instanceof Error ? err.message : String(err)); }
    finally { setOcupado(false); }
  }

  const link = pedido && AGENTE_WHATSAPP ? `https://wa.me/${AGENTE_WHATSAPP}?text=${encodeURIComponent(pedido.mensagem)}` : null;
  const depois = () => navegar(`${perfil?.configurado_em ? '/app/conta' : '/configurar'}${params.toString() ? `?${params}` : ''}`);

  // Agente ainda não está no ar: o WhatsApp é opcional, então segue sem ele.
  if (!AGENTE_WHATSAPP) {
    return (
      <Moldura etapa={2}>
        <div>
          <h2 className="text-[28px] font-bold leading-[34px]">WhatsApp em breve</h2>
          <p className="text-suave">O agente do WhatsApp está sendo ativado. Você já pode usar tudo pelo site; quando ele estiver no ar, é só conectar o seu número em <strong className="text-tinta">Minha conta</strong>.</p>
        </div>
        <Botao onClick={depois} className="min-h-[52px] text-base">Continuar</Botao>
      </Moldura>
    );
  }

  return (
    <Moldura etapa={2}>
      <div>
        <h2 className="text-[28px] font-bold leading-[34px]">Confirme seu WhatsApp</h2>
        <p className="text-suave">
          {pedido ? <>Envie o código abaixo para o nosso agente <strong className="text-tinta">a partir do {telefoneBonito(pedido.whatsapp)}</strong>. É só tocar no botão e apertar enviar.</>
            : perfil?.whatsapp_verified_at ? `Número atual: ${telefoneBonito(perfil.whatsapp_e164)}. Informe o novo número.` : 'Informe o número que vai conversar com o agente.'}
        </p>
      </div>
      {!pedido ? (
        <form onSubmit={gerar} className="flex flex-col gap-4">
          <Campo rotulo="WhatsApp com DDD" type="tel" placeholder="(32) 99999-0000" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          <Botao type="submit" disabled={ocupado || whatsapp.replace(/\D/g, '').length < 10} className="min-h-[52px] text-base">{ocupado ? 'Gerando…' : 'Gerar código'}</Botao>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-borda bg-nevoa py-5 text-center">
            <span className="block text-xs font-bold uppercase tracking-[0.12em] text-suave">Seu código</span>
            <span className="numero mt-1 block text-[34px] font-black tracking-[0.3em] text-tinta" style={{ fontFamily: 'var(--font-display)' }}>{pedido.codigo}</span>
          </div>
          {link ? (
            <a href={link} target="_blank" rel="noreferrer" className="flex min-h-[52px] items-center justify-center rounded-xl bg-acao px-5 text-base font-bold text-white no-underline">Abrir o WhatsApp e enviar</a>
          ) : (
            <Aviso tom="vermelho">O número do agente não está configurado (VITE_AGENTE_WHATSAPP).</Aviso>
          )}
          {AGENTE_WHATSAPP && <p className="text-center text-sm text-suave">No computador? Envie <strong className="text-tinta">{pedido.codigo}</strong> pelo seu celular para {telefoneBonito(`+${AGENTE_WHATSAPP}`)}.</p>}
          <Aviso>Aguardando a sua mensagem… Esta tela avança sozinha assim que o agente confirmar.</Aviso>
          <div className="flex justify-between gap-3 text-sm">
            <button type="button" className="min-h-11 font-bold text-acao" disabled={ocupado} onClick={async () => { setOcupado(true); setErro(null); try { setPedido(await pedirConfirmacao(pedido.whatsapp)); } catch (err) { setErro(err instanceof Error ? err.message : String(err)); } finally { setOcupado(false); } }}>Gerar outro código</button>
            <button type="button" className="min-h-11 font-bold text-acao" onClick={() => { try { sessionStorage.removeItem(CHAVE_PEDIDO); } catch { /* ok */ } setPedido(null); }}>Usar outro número</button>
          </div>
        </div>
      )}
      {avisoCupom && <Aviso tom="verde">{avisoCupom}</Aviso>}
      {erro && <Aviso tom="vermelho">{erro}</Aviso>}
      <Aviso>É este número que o agente vai reconhecer. Use o WhatsApp que você leva no dia a dia.</Aviso>
      <button type="button" onClick={depois} className="min-h-11 text-sm font-bold text-suave">Fazer isso depois</button>
    </Moldura>
  );
}

export function Configurar() {
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const { perfil } = useConta();
  // O administrador não assina: segue direto para o app.
  const seguir = () => navegar(perfil?.papel === 'admin' ? '/app' : `/assinar${params.toString() ? `?${params}` : ''}`);
  return (
    <Moldura etapa={3} largo>
      <div>
        <h2 className="text-[28px] font-bold leading-[34px]">Seu orçamento</h2>
        <p className="text-suave">Onde você atua, a sua marca e o formato que o cliente recebe. Dá para mudar depois em Conta.</p>
      </div>
      <ConfiguracaoOrcamento textoSalvar="Salvar e continuar" aoSalvar={seguir} />
    </Moldura>
  );
}

export function Assinar() {
  const [params] = useSearchParams();
  const [nivel, setNivel] = useState<Nivel>(params.get('nivel') === 'usuario' ? 'usuario' : 'pro');
  const [periodo, setPeriodo] = useState<Periodo>(lerPeriodo(params.get('plano')));
  const [forma, setForma] = useState<Forma>('cartao');
  const [temCartao, setTemCartao] = useState<boolean | null>(null);
  const [indo, setIndo] = useState<'assinar' | 'cartao' | 'lancamento' | null>(null);
  const [vagas, setVagas] = useState(0);
  const [erro, setErro] = useState('');
  const { ativa, perfil } = useConta();
  const valor = preco(nivel, periodo);
  const formas = formasDoPeriodo(periodo);
  const formaValida: Forma = formas.includes(forma) ? forma : 'cartao';

  useEffect(() => {
    supabase.rpc('minha_situacao_acesso').maybeSingle<{ tem_cartao: boolean }>()
      .then(({ data }) => setTemCartao(data?.tem_cartao ?? false));
    api<{ vagas: number }>('/api/oferta', { publico: true }).then((r) => setVagas(r.vagas)).catch(() => setVagas(0));
  }, []);

  /** Abre a página de pagamento da Stripe (o cartão é digitado lá, não aqui). */
  async function irPara(caminho: string, corpo: unknown, qual: 'assinar' | 'cartao' | 'lancamento') {
    setErro('');
    setIndo(qual);
    try {
      const { url } = await api<{ url: string }>(caminho, { corpo });
      window.location.assign(url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setIndo(null);
    }
  }

  if (perfil?.papel === 'admin') return <Navigate to="/app" replace />;

  return (
    <Moldura etapa={4}>
      <div>
        <h2 className="text-[28px] font-bold leading-[34px]">Escolha seu plano</h2>
        <p className="text-suave">Os dois têm calculadoras, agente no WhatsApp, histórico e exportação.</p>
      </div>
      {vagas > 0 && !ativa && (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-tinta bg-amarelo-claro p-4 shadow-[4px_4px_0_#101828]">
          <span className="flex items-center justify-between gap-2">
            <span className="text-base font-bold">{OFERTA_LANCAMENTO.nome}</span>
            <span className="rounded-full bg-tinta px-2.5 py-0.5 text-xs font-bold text-white">{vagas === 1 ? 'Última vaga' : `Restam ${vagas} vagas`}</span>
          </span>
          <span className="numero text-[26px] font-extrabold">{LANCAMENTO_TEXTO}/mês</span>
          <span className="text-texto">Plano {PLANOS[OFERTA_LANCAMENTO.nivel].nome} anual, cobrado mês a mês, para os {OFERTA_LANCAMENTO.vagas} primeiros corretores, com benefícios exclusivos de fundador. {OFERTA_LANCAMENTO.diasTeste} dias para testar com o cartão cadastrado; a primeira cobrança é no {OFERTA_LANCAMENTO.diasTeste + 1}º dia. Fidelidade de 12 meses, com cancelamento grátis nos {DIAS_ARREPENDIMENTO} primeiros dias.</span>
          <Botao onClick={() => irPara('/api/assinatura/lancamento', {}, 'lancamento')} disabled={!!indo} className="min-h-[52px] text-base">
            {indo === 'lancamento' ? 'Abrindo o pagamento…' : `Garantir por ${LANCAMENTO_TEXTO}/mês`}
          </Botao>
        </div>
      )}
      <div role="group" aria-label="Plano" className="flex flex-col gap-2.5">
        {(['pro', 'usuario'] as const).map((n) => (
          <button key={n} type="button" aria-pressed={nivel === n} onClick={() => setNivel(n)}
            className={cn('flex flex-col gap-1 rounded-2xl border-2 bg-white p-4 text-left', nivel === n ? 'border-acao' : 'border-linha')}>
            <span className="flex w-full items-center justify-between gap-2">
              <span className="text-base font-bold">{PLANOS[n].nome}</span>
              {n === 'pro' && <span className="rounded-full bg-acao-claro px-2.5 py-0.5 text-xs font-bold text-acao">Sua logo e cores</span>}
            </span>
            <span className="numero text-[26px] font-extrabold">{preco(n, periodo).porMesTexto}/mês</span>
            <span className="text-suave">{PLANOS[n].resumo}</span>
          </button>
        ))}
      </div>
      <SeletorPeriodo periodo={periodo} onChange={setPeriodo} className="text-sm" />
      {formas.length > 1 && (
        <div role="group" aria-label="Forma de pagamento" className="grid grid-cols-2 gap-1 rounded-xl bg-cinza p-1 text-sm">
          {formas.map((f) => (
            <button key={f} type="button" aria-pressed={formaValida === f} onClick={() => setForma(f)}
              className={cn('min-h-12 rounded-[9px] px-1 font-bold', formaValida === f ? 'bg-white text-tinta shadow-sm' : 'text-suave')}>
              {f === 'cartao' ? 'Cartão, mês a mês' : 'Pix, à vista'}
            </button>
          ))}
        </div>
      )}
      <p className="text-suave">
        {formaValida === 'pix'
          ? <>Pagamento único de <strong className="text-tinta">{valor.totalTexto}</strong> no Pix, válido por 12 meses{valor.descontoTexto ? ` (${valor.descontoTexto})` : ''}.</>
          : <><strong className="text-tinta">{valor.porMesTexto}</strong> por mês no cartão, {PERIODOS[periodo].cobranca}{valor.descontoTexto ? ` (${valor.descontoTexto})` : ''}. Depois, renova mês a mês até você cancelar.</>}
      </p>
      {erro && <Aviso tom="vermelho">{erro}</Aviso>}
      {ativa ? (
        <Aviso tom="verde">Sua assinatura está ativa. Para trocar de plano, fale com o suporte.</Aviso>
      ) : (
        <Botao onClick={() => irPara('/api/assinatura/checkout', { nivel, periodo, forma: formaValida }, 'assinar')} disabled={!!indo} className="min-h-[52px] text-base">
          {indo === 'assinar' ? 'Abrindo o pagamento…' : `Assinar o ${PLANOS[nivel].nome}`}
        </Botao>
      )}
      {temCartao === false && !ativa && (
        <div className="flex flex-col gap-2 rounded-xl bg-nevoa p-4">
          <span className="text-suave">Quer testar antes? Cadastre um cartão de crédito (nada é cobrado agora) e use grátis por {DIAS_TESTE} dias. O cartão é pedido mesmo para quem vai pagar no Pix.</span>
          <Botao variante="secundario" onClick={() => irPara('/api/assinatura/cartao', {}, 'cartao')} disabled={!!indo}>
            {indo === 'cartao' ? 'Abrindo…' : 'Cadastrar cartão e testar grátis'}
          </Botao>
        </div>
      )}
      <span className="text-xs text-suave">Mudou de ideia? Nos {DIAS_ARREPENDIMENTO} primeiros dias você cancela na página da conta e recebe de volta o que pagou. O pagamento é feito na página segura da Stripe. Não guardamos o número do cartão.</span>
      <Link to="/app" className="text-center font-bold text-acao">Ir para o app</Link>
    </Moldura>
  );
}
