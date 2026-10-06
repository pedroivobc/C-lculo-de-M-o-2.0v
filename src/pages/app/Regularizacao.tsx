import { Bookmark } from 'lucide-react';
import { BotaoLink } from '@/components/ui/Campos';

export default function Regularizacao() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="rotulo-secao">Regularização</span>
        <h1 className="text-[28px] font-bold leading-[34px]">Regularização de imóveis</h1>
      </header>
      <section className="flex max-w-3xl flex-col gap-5 rounded-3xl border border-linha bg-white p-6 sm:p-10">
        <span className="flex size-16 items-center justify-center rounded-[20px] bg-amarelo-claro text-minas"><Bookmark className="size-8" aria-hidden="true" /></span>
        <span className="self-start rounded-full bg-amarelo-claro px-3 py-1 text-xs font-bold text-amarelo-texto">Em breve</span>
        <h2 className="text-2xl font-extrabold">Estamos montando esta calculadora</h2>
        <p className="text-lg text-suave">Ela vai estimar os atos de cartório para colocar o imóvel em dia, com a mesma memória de cálculo das outras.</p>
        <ul className="grid gap-2.5 sm:grid-cols-3">
          {['Averbação de construção', 'Retificação de área', 'Desmembramento e unificação'].map((t) => (
            <li key={t} className="rounded-xl bg-nevoa p-3.5 font-semibold">{t}</li>
          ))}
        </ul>
        <p className="text-suave">Assinantes recebem o aviso de lançamento pelo WhatsApp.</p>
        <BotaoLink to="/app" variante="secundario" className="self-start">Voltar ao início</BotaoLink>
      </section>
    </div>
  );
}
