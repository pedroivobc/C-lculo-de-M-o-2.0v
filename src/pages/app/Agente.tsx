import { MessageCircle } from 'lucide-react';
import { useConta } from '@/hooks/useConta';
import { mesAtual, useCalculos } from '@/hooks/useCalculos';
import { Aviso, BotaoLink, Cartao } from '@/components/ui/Campos';
import { telefoneBonito } from '@/lib/formato';
import { AGENTE_WHATSAPP, usaWhatsapp } from '@/lib/config';

const EXEMPLOS = [
  ['"Escritura de 350 mil"', 'Calcula ITBI, escritura e registro e manda o orçamento.'],
  ['"Caixa SBPE, financiando 280 mil, primeiro imóvel"', 'Taxa da Caixa, ITBI pelo SFH e registro.'],
  ['"Exportar 2026-10"', 'Manda a planilha com todos os orçamentos do mês.'],
  ['"Me manda de novo o 142"', 'Reenvia o PDF de um orçamento do histórico.'],
];

export default function Agente() {
  const { perfil, ativa } = useConta();
  const { dados } = useCalculos(mesAtual());
  const doMes = dados?.filter((c) => c.origem === 'whatsapp').length;
  const verificado = !!perfil?.whatsapp_verified_at;

  if (perfil && !usaWhatsapp(perfil.papel)) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <span className="rotulo-secao">Agente WhatsApp</span>
          <h1 className="text-[28px] font-bold leading-[34px]">O agente do WhatsApp é do plano Pró</h1>
          <p className="text-suave">No Starter, os orçamentos são feitos aqui no site. No Pró, você também orça mandando uma mensagem no WhatsApp, com a sua logo e as suas cores.</p>
        </header>
        <Aviso tom="azul">Mude para o Pró quando quiser: o histórico e a configuração continuam os mesmos.</Aviso>
        <BotaoLink to="/assinar?nivel=pro" className="self-start">Conhecer o Pró</BotaoLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="rotulo-secao">Agente WhatsApp</span>
        <h1 className="text-[28px] font-bold leading-[34px]">Seu agente de orçamento no WhatsApp</h1>
        <p className="text-suave">Mande mensagem do número cadastrado. O agente reconhece você e salva tudo no seu histórico.</p>
      </header>

      <section className="flex flex-wrap items-center gap-6 rounded-3xl bg-tinta p-6 text-white sm:p-8">
        <div className="flex min-w-60 flex-1 flex-col gap-1.5">
          <span className={`self-start rounded-full px-2.5 py-1 text-xs font-bold ${ativa && verificado ? 'bg-[#1f2b44] text-[#5be3a5]' : 'bg-amarelo-claro text-amarelo-texto'}`}>
            {ativa && verificado ? 'Ativo' : !verificado ? 'Confirme seu WhatsApp' : 'Assinatura inativa'}
          </span>
          <span className="mt-1.5 text-sm text-[#c7cedb]">Número do agente</span>
          <span className="numero text-[26px] font-extrabold">{AGENTE_WHATSAPP ? telefoneBonito(`+${AGENTE_WHATSAPP}`) : 'a configurar'}</span>
        </div>
        <div className="flex min-w-52 flex-1 flex-col gap-1">
          <span className="text-sm text-[#c7cedb]">Seu WhatsApp vinculado</span>
          <span className="text-lg font-bold">{verificado ? telefoneBonito(perfil?.whatsapp_e164) : 'nenhum'}</span>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-60">
          {AGENTE_WHATSAPP && verificado && (
            <a href={`https://wa.me/${AGENTE_WHATSAPP}`} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white font-bold text-tinta no-underline">
              <MessageCircle className="size-5" aria-hidden="true" />Abrir conversa
            </a>
          )}
          <BotaoLink to="/verificar" variante="escuro" className="border border-[#3a4560]">{verificado ? 'Trocar número' : 'Confirmar meu WhatsApp'}</BotaoLink>
          {!ativa && <BotaoLink to="/assinar" variante="claro">Ver planos</BotaoLink>}
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Cartao titulo="O que você pode pedir">
          <ul className="flex flex-col gap-2">
            {EXEMPLOS.map(([pedido, faz]) => (
              <li key={pedido} className="flex flex-col gap-0.5 rounded-xl bg-nevoa px-3.5 py-3">
                <span className="font-bold">{pedido}</span>
                <span className="text-suave">{faz}</span>
              </li>
            ))}
          </ul>
        </Cartao>
        <Cartao titulo="Uso este mês">
          <span className="numero block text-[32px] font-bold">{doMes ?? '–'}</span>
          <span className="text-suave">orçamentos feitos pelo WhatsApp</span>
        </Cartao>
      </div>
    </div>
  );
}
