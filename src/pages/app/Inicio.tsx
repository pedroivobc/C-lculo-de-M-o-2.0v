import { Link } from 'react-router-dom';
import { ChevronRight, MessageCircle, Plus } from 'lucide-react';
import { useConta } from '@/hooks/useConta';
import { NOME_TIPO, mesAtual, useCalculos } from '@/hooks/useCalculos';
import { useCalculadoras } from '@/components/layout/AppLayout';
import { BotaoLink, Cartao } from '@/components/ui/Campos';
import { brl, dataHora, numeroCalculo } from '@/lib/formato';
import { AGENTE_WHATSAPP } from '@/lib/config';

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export default function Inicio() {
  const { perfil } = useConta();
  const calculadoras = useCalculadoras();
  const { dados, erro } = useCalculos(mesAtual());
  const pelosite = dados?.filter((c) => c.origem === 'site').length ?? 0;
  const pelozap = dados?.filter((c) => c.origem === 'whatsapp').length ?? 0;
  const primeiroNome = perfil?.full_name?.split(' ')[0];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold leading-[34px]">{saudacao()}{primeiroNome ? `, ${primeiroNome}` : ''}</h1>
          <p className="text-suave">O que vamos orçar hoje?</p>
        </div>
        <BotaoLink to="/app/escrituras"><Plus className="size-5" aria-hidden="true" />Novo orçamento</BotaoLink>
      </header>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[['Este mês', dados?.length], ['WhatsApp', pelozap], ['Site', pelosite]].map(([rotulo, n]) => (
          <div key={rotulo as string} className="rounded-2xl border border-linha bg-white p-4 sm:p-5">
            <span className="text-sm font-semibold text-suave">{rotulo}</span>
            <span className="numero block text-[28px] font-bold leading-9 sm:text-[32px]">{dados ? n : '–'}</span>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Cartao titulo="Calculadoras">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {calculadoras.map((c) => (
                <Link key={c.para} to={c.para} className="flex min-h-16 flex-col gap-0.5 rounded-xl bg-nevoa p-3.5 text-tinta no-underline transition-colors hover:bg-acao-claro">
                  <span className="font-bold">{c.rotulo}</span>
                  <span className="text-xs text-suave">{c.nota}</span>
                </Link>
              ))}
            </div>
          </Cartao>

          <Cartao titulo="Últimos orçamentos" acao={<Link to="/app/historico" className="font-bold text-acao">Ver histórico</Link>}>
            {erro && <p className="text-minas-texto">{erro}</p>}
            {!erro && !dados && <p className="text-suave">Carregando…</p>}
            {dados && dados.length === 0 && <p className="text-suave">Nenhum orçamento este mês. Comece por uma calculadora ou mande uma mensagem ao agente.</p>}
            <ul>
              {dados?.slice(0, 5).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-linha py-3 last:border-0">
                  <span className="flex flex-col">
                    <span className="font-bold">{NOME_TIPO[c.tipo] ?? c.tipo}{c.descricao ? ` · ${c.descricao}` : ''}</span>
                    <span className="text-xs text-suave">{numeroCalculo(c.seq)} · {dataHora(c.created_at)} · {c.origem === 'whatsapp' ? 'WhatsApp' : 'site'}</span>
                  </span>
                  <span className="numero font-bold">{brl(Number(c.total))}</span>
                </li>
              ))}
            </ul>
          </Cartao>
        </div>

        <aside className="flex flex-col gap-3.5 rounded-2xl bg-tinta p-6 text-white">
          <span className="self-start rounded-full bg-[#1f2b44] px-2.5 py-1 text-xs font-bold text-[#5be3a5]">Agente no WhatsApp</span>
          <h2 className="text-lg font-bold">Orce pelo WhatsApp</h2>
          <p className="text-[#c7cedb]">Mande do seu número cadastrado: "escritura de 350 mil".</p>
          {AGENTE_WHATSAPP ? (
            <a href={`https://wa.me/${AGENTE_WHATSAPP}`} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white font-bold text-tinta no-underline">
              <MessageCircle className="size-5" aria-hidden="true" />Abrir conversa
            </a>
          ) : (
            <span className="text-sm text-[#c7cedb]">O número do agente aparece aqui quando estiver configurado.</span>
          )}
          <Link to="/app/agente" className="inline-flex items-center gap-1 font-bold text-marca-texto">Como funciona<ChevronRight className="size-4" aria-hidden="true" /></Link>
        </aside>
      </div>
    </div>
  );
}
