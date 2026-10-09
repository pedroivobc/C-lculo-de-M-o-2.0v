import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { useConta } from '@/hooks/useConta';
import { Aviso, Botao, BotaoLink, Campo, Cartao } from '@/components/ui/Campos';
import { telefoneBonito } from '@/lib/formato';
import { DIAS_ARREPENDIMENTO, EQUIPE, LANCAMENTO_TEXTO, lerPeriodo, OFERTA_LANCAMENTO, PERIODOS, PLANOS, preco, UNLIMITED, type Nivel } from '@/lib/config';
import { ConfiguracaoOrcamento } from '@/components/conta/ConfiguracaoOrcamento';
import { Indicacao } from '@/components/conta/Indicacao';

const nivelDoPlano = (n?: string | null): Nivel => (n === 'pro' ? 'pro' : 'usuario');
const SITUACAO: Record<string, string> = { pendente: 'Aguardando pagamento', atrasada: 'Pagamento atrasado', cancelada: 'Cancelado' };
const data = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

export default function Conta() {
  const { perfil, assinatura, equipe, ativa, recarregar } = useConta();
  const navegar = useNavigate();
  const [nome, setNome] = useState('');
  const [aviso, setAviso] = useState<{ tom: 'verde' | 'vermelho'; texto: string } | null>(null);

  useEffect(() => {
    setNome(perfil?.full_name ?? '');
  }, [perfil]);

  async function salvar() {
    if (!perfil) return;
    const { error } = await supabase.from('profiles').update({ full_name: nome.trim() || null }).eq('id', perfil.id);
    setAviso(error ? { tom: 'vermelho', texto: error.message } : { tom: 'verde', texto: 'Alterações salvas.' });
    if (!error) recarregar();
  }

  const lancamento = assinatura?.plan === 'lancamento';
  // Pix anual: só dá para cancelar (com estorno) nos 7 primeiros dias.
  const arrependimento = assinatura?.forma_pagamento === 'pix' && !!assinatura.criada_em
    && Date.now() - new Date(assinatura.criada_em).getTime() < DIAS_ARREPENDIMENTO * 86400_000;
  const [ocupado, setOcupado] = useState<'portal' | 'cancelar' | null>(null);
  const [avisoPlano, setAvisoPlano] = useState<{ tom: 'verde' | 'vermelho'; texto: string } | null>(null);

  // Volta do Checkout: o webhook da Stripe pode levar alguns segundos para ativar.
  const [params] = useSearchParams();
  const voltouDoPagamento = params.get('assinatura') === 'ok';
  useEffect(() => {
    if (!voltouDoPagamento || ativa) return;
    let vezes = 0;
    const t = setInterval(() => { if (++vezes > 10) clearInterval(t); recarregar({ silencioso: true }); }, 3000);
    return () => clearInterval(t);
  }, [voltouDoPagamento, ativa, recarregar]);

  async function abrir(caminho: string) {
    setOcupado('portal');
    try {
      window.location.assign((await api<{ url: string }>(caminho, { corpo: {} })).url);
    } catch (e) {
      setAvisoPlano({ tom: 'vermelho', texto: e instanceof Error ? e.message : String(e) });
      setOcupado(null);
    }
  }

  async function cancelar() {
    if (!assinatura) return;
    const pergunta = 'Nos 7 primeiros dias, o cancelamento é imediato e o valor pago volta. Depois disso, as mensalidades seguem até o fim da fidelidade e o acesso termina ali. Cancelar?';
    if (!window.confirm(pergunta)) return;
    setOcupado('cancelar');
    try {
      const { cancelaEm } = await api<{ cancelaEm: string }>('/api/assinatura/cancelar', { corpo: {} });
      setAvisoPlano({ tom: 'verde', texto: `Cancelamento agendado para ${data(cancelaEm)}.` });
      await recarregar({ silencioso: true });
    } catch (e) {
      setAvisoPlano({ tom: 'vermelho', texto: e instanceof Error ? e.message : String(e) });
    }
    setOcupado(null);
  }

  async function sair() {
    await supabase.auth.signOut();
    navegar('/');
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="rotulo-secao">Conta</span>
        <h1 className="text-[28px] font-bold leading-[34px]">Conta e assinatura</h1>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Cartao titulo="Seus dados">
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
                <Campo rotulo="E-mail" value={perfil?.email ?? ''} disabled />
              </div>
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-nevoa p-4">
                <span className="flex min-w-56 flex-1 flex-col">
                  <span className="font-bold">WhatsApp do agente: {perfil?.whatsapp_verified_at ? telefoneBonito(perfil.whatsapp_e164) : 'não confirmado'}</span>
                  <span className="text-xs text-suave">Só este número é reconhecido pelo agente. Trocar exige um novo código.</span>
                </span>
                <BotaoLink to="/verificar" variante="secundario">{perfil?.whatsapp_verified_at ? 'Trocar número' : 'Confirmar'}</BotaoLink>
              </div>
              <Botao onClick={salvar} className="self-start">Salvar alterações</Botao>
              {aviso && <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>}
            </div>
          </Cartao>
          <Cartao titulo="Seus orçamentos">
            <ConfiguracaoOrcamento />
          </Cartao>
        </div>

        <div className="flex flex-col gap-6">
          {perfil?.papel === 'admin' ? (
          <section className="flex flex-col gap-3 rounded-2xl border-2 border-tinta bg-white p-6 shadow-[6px_6px_0_#101828]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{assinatura?.nivel === 'unlimited' ? `Plano ${UNLIMITED.nome}` : 'Administrador'}</h2>
              <span className="rounded-full bg-ok-claro px-2.5 py-1 text-xs font-bold text-ok">Ativo</span>
            </div>
            <span className="text-suave">{UNLIMITED.resumo}.{equipe ? <> Você é o gestor de <strong className="text-tinta">{equipe.nome}</strong>.</> : ' Monte a sua equipe para cadastrar colaboradores.'}</span>
            <BotaoLink to="/app/equipe">{equipe ? 'Gerenciar equipe' : 'Montar minha equipe'}</BotaoLink>
          </section>
          ) : equipe ? (
          <section className="flex flex-col gap-3 rounded-2xl border-2 border-tinta bg-white p-6 shadow-[6px_6px_0_#101828]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{equipe.tipo === 'clemente' ? 'Clemente Team' : EQUIPE.nome}</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ativa ? 'bg-ok-claro text-ok' : 'bg-amarelo-claro text-amarelo-texto'}`}>{ativa ? 'Ativo' : 'Inativo'}</span>
            </div>
            <span className="text-suave">Você faz parte de <strong className="text-tinta">{equipe.nome}</strong>{equipe.funcao === 'gestor' ? ' como gestor.' : '. O plano é cuidado pelo gestor da equipe.'}</span>
            {equipe.funcao === 'gestor' && <BotaoLink to="/app/equipe">Gerenciar equipe</BotaoLink>}
          </section>
          ) : (
          <section className="flex flex-col gap-3 rounded-2xl border-2 border-tinta bg-white p-6 shadow-[6px_6px_0_#101828]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{!assinatura ? 'Sem plano' : lancamento ? `${PLANOS[nivelDoPlano(assinatura.nivel)].nome}, ${OFERTA_LANCAMENTO.nome.toLowerCase()}` : `${PLANOS[nivelDoPlano(assinatura.nivel)].nome} ${PERIODOS[lerPeriodo(assinatura.plan)].nome.toLowerCase()}`}</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ativa ? 'bg-ok-claro text-ok' : 'bg-amarelo-claro text-amarelo-texto'}`}>{ativa ? 'Ativo' : SITUACAO[assinatura?.status ?? ''] ?? 'Inativo'}</span>
            </div>
            {voltouDoPagamento && !ativa && <Aviso tom="azul">Pagamento recebido pela Stripe. Estamos ativando a sua assinatura; no Pix pode levar alguns minutos.</Aviso>}
            {assinatura ? (
              <>
                {assinatura.forma_pagamento === 'pix' ? (
                  <span className="numero text-[32px] font-black">{preco(nivelDoPlano(assinatura.nivel), 'anual').totalTexto}<span className="text-sm font-medium text-suave"> no Pix, por 12 meses</span></span>
                ) : (
                  <span className="numero text-[32px] font-black">{lancamento ? LANCAMENTO_TEXTO : preco(nivelDoPlano(assinatura.nivel), lerPeriodo(assinatura.plan)).porMesTexto}<span className="text-sm font-medium text-suave">/mês no cartão</span></span>
                )}
                {assinatura.current_period_end && <span className="text-suave">{assinatura.forma_pagamento === 'pix' ? 'Pago até' : 'Mês pago até'} {data(assinatura.current_period_end)}</span>}
                {assinatura.forma_pagamento === 'cartao' && assinatura.fidelidade_ate && !assinatura.cancela_em && new Date(assinatura.fidelidade_ate) > new Date() && (
                  <span className="text-suave">Fidelidade até {data(assinatura.fidelidade_ate)}</span>
                )}
                {assinatura.cancela_em && <Aviso tom="amarelo">Cancelamento agendado: o acesso termina em {data(assinatura.cancela_em)}.</Aviso>}
                {assinatura.status === 'atrasada' && <Aviso tom="vermelho">O último pagamento não passou. Atualize o cartão para não perder o acesso.</Aviso>}
                {assinatura.forma_pagamento === 'cartao' && (
                  <Botao variante="secundario" onClick={() => abrir('/api/assinatura/portal')} disabled={!!ocupado}>{ocupado === 'portal' ? 'Abrindo…' : 'Trocar cartão e ver faturas'}</Botao>
                )}
                {assinatura.forma_pagamento === 'pix' && ativa && <BotaoLink to={`/assinar?nivel=${assinatura.nivel}&plano=anual`} variante="secundario">Renovar no Pix</BotaoLink>}
                {!ativa && <BotaoLink to="/assinar">Assinar de novo</BotaoLink>}
                {(assinatura.forma_pagamento === 'cartao' || arrependimento) && ativa && !assinatura.cancela_em && (
                  <button type="button" onClick={cancelar} disabled={!!ocupado} className="self-start text-sm font-bold text-suave underline">
                    {ocupado === 'cancelar' ? 'Cancelando…' : 'Cancelar assinatura'}
                  </button>
                )}
                {avisoPlano && <Aviso tom={avisoPlano.tom}>{avisoPlano.texto}</Aviso>}
              </>
            ) : (
              <BotaoLink to="/assinar">Ver planos</BotaoLink>
            )}
          </section>
          )}

          <Indicacao />

          <Cartao titulo="Privacidade">
            <p className="mb-3 text-suave">Não pedimos dados dos seus clientes: os orçamentos usam só valores. Seus orçamentos ficam guardados só para você, e as conversas com o agente, por 30 dias. Para baixar ou apagar seus dados, fale com o suporte pelo WhatsApp do agente. <Link to="/privacidade" className="font-bold text-acao">Política de privacidade</Link></p>
            <Botao variante="perigo" onClick={sair}>Sair da conta</Botao>
          </Cartao>
        </div>
      </div>
    </div>
  );
}
