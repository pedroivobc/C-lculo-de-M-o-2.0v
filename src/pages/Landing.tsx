import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Plus } from 'lucide-react';
import { calcular, type Resultado } from '@/lib/calc';
import { centavosParaTexto, textoParaCentavos } from '@/lib/formato';
import { api } from '@/lib/api';
import { PLANOS, PRECO } from '@/lib/config';
import { Lockup } from '@/components/marca/Logo';
import { Orcamento } from '@/components/ui/Orcamento';
import { Aviso, BotaoLink } from '@/components/ui/Campos';
import { cn } from '@/lib/utils';

type Ato = 'escritura' | 'caixa' | 'doacao';

/** Simulação da landing: mesmos cálculos do app, com premissas fixas e explicadas abaixo do orçamento. */
function simular(ato: Ato, valor: number): Resultado | null {
  if (!valor) return null;
  try {
    if (ato === 'caixa') return calcular('financiamento_caixa', { modalidade: 'SBPE', valorDeclarado: valor, valorFinanciado: valor * 0.8, primeiroImovel: true });
    if (ato === 'doacao') return calcular('doacao', { subtipo: 'doacao_simples', valorAtribuido: valor, avaliacaoFazenda: valor });
    return calcular('escritura', { subtipo: 'compra_venda_simples', valorDeclarado: valor });
  } catch { return null; }
}

const NOTA: Record<Ato, string> = {
  escritura: 'Compra e venda simples, 25 folhas.',
  caixa: 'SBPE, 80% financiado, primeiro imóvel, taxa de 1,5%.',
  doacao: 'Doação simples, 25 folhas.',
};

const ETIQUETAS = [
  ['JUIZ DE FORA', 'bg-minas-claro text-minas-texto', 'ITBI pela regra da prefeitura, que muda de cidade para cidade.'],
  ['MG', 'bg-acao-claro text-acao-escuro', 'Lavratura, registro e arquivamento pela tabela de emolumentos de Minas, e o ITCD estadual na doação.'],
  ['BANCO', 'bg-cinza text-texto', 'Taxa da Caixa ou tarifa de contrato do Itaú, Bradesco e Santander.'],
  ['VOCÊ', 'bg-amarelo-claro text-amarelo-texto', 'Certidões e honorários: você define o valor e ele entra no orçamento.'],
];

const DUVIDAS = [
  ['Os valores são oficiais?', 'São estimativas feitas com a tabela de emolumentos de MG e as regras de ITBI de Juiz de Fora do ano corrente. Os valores finais são os do cartório e da prefeitura no dia do ato.'],
  ['Meu imóvel é em outra cidade de MG. Serve?', 'Sim. Juiz de Fora já tem a regra de ITBI cadastrada; nas outras cidades de MG você informa a alíquota no cadastro. Peça a sua cidade no formulário acima para ela ganhar a regra completa.'],
  ['Como o agente sabe que sou eu?', 'Pelo número que você confirma no cadastro com um código. Só esse número tem acesso aos seus orçamentos.'],
  ['Posso cancelar quando quiser?', 'Sim. No mensal, você não é cobrado no mês seguinte. O seu histórico continua disponível para exportar.'],
];

function PedirCidade() {
  const [cidade, setCidade] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [estado, setEstado] = useState<{ tom: 'verde' | 'vermelho'; texto: string } | null>(null);
  return (
    <form
      className="flex flex-1 basis-80 flex-col gap-3.5 rounded-[20px] bg-nevoa p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api('/api/cidades/pedido', { corpo: { cidade, whatsapp }, publico: true });
          setEstado({ tom: 'verde', texto: `Pedido registrado. Avisamos quando ${cidade} abrir.` });
          setCidade(''); setWhatsapp('');
        } catch (err) {
          setEstado({ tom: 'vermelho', texto: err instanceof Error ? err.message : String(err) });
        }
      }}
    >
      <h3 className="text-xl font-extrabold">Quero na minha cidade</h3>
      <label className="flex flex-col gap-1.5 font-bold">Cidade em MG
        <input required minLength={2} value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Barbacena" className="h-12 rounded-[10px] border border-borda bg-white px-3.5" />
      </label>
      <label className="flex flex-col gap-1.5 font-bold">Seu WhatsApp
        <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(32) 99999-0000" className="h-12 rounded-[10px] border border-borda bg-white px-3.5" />
      </label>
      <button type="submit" className="min-h-12 rounded-[10px] bg-tinta font-bold text-white">Avisar quando chegar</button>
      {estado && <Aviso tom={estado.tom}>{estado.texto}</Aviso>}
    </form>
  );
}

export default function Landing() {
  const [centavos, setCentavos] = useState(35000000);
  const [ato, setAto] = useState<Ato>('escritura');
  const [anual, setAnual] = useState(true);
  const resultado = useMemo(() => simular(ato, centavos / 100), [ato, centavos]);

  return (
    <div className="min-h-screen text-[15px] leading-[22px]">
      <div className="bg-tinta text-[13px] text-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-center gap-x-4 gap-y-1 px-6 py-2.5">
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="h-0 w-0 border-x-[5px] border-b-[9px] border-x-transparent border-b-[#ff5a62]" />
            Disponível em <strong>Juiz de Fora (MG)</strong>. Outras cidades mineiras em breve.
          </span>
          <a href="#cidades" className="font-bold text-marca-texto">Peça a sua cidade</a>
        </div>
      </div>

      <header className="border-b border-linha bg-white">
        <nav aria-label="Principal" className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3.5">
          <Link to="/" className="no-underline"><Lockup tamanho={22} /></Link>
          <div className="hidden flex-1 gap-6 md:flex">
            {[['#whatsapp', 'Pelo WhatsApp'], ['#preco', 'Preço'], ['#cidades', 'Cidades'], ['#duvidas', 'Dúvidas']].map(([h, r]) => (
              <a key={h} href={h} className="py-3 font-semibold text-texto no-underline hover:text-tinta">{r}</a>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/entrar" className="px-3 py-3 font-bold text-tinta no-underline">Entrar</Link>
            <BotaoLink to="/cadastro" className="min-h-11 px-4">Assinar</BotaoLink>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero: calculadora ao vivo */}
        <section className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-12 px-4 pt-10 sm:px-6 sm:pt-14">
          <div className="flex min-w-0 flex-1 basis-[420px] flex-col gap-5">
            <span className="rotulo-secao">Para corretores e despachantes de Juiz de Fora</span>
            <h1 className="text-[38px] font-[850] leading-[42px] sm:text-[60px] sm:leading-[62px]">
              Orçamento de escritura e ITBI <span className="marca-texto">em 10 segundos.</span>
            </h1>
            <p className="max-w-[520px] text-lg leading-7 text-texto sm:text-[19px] sm:leading-[29px]">
              Digite o valor do imóvel e veja quanto o cliente vai gastar com ITBI, cartório e registro. Pelo site ou mandando uma mensagem no WhatsApp.
            </p>
            <div className="flex flex-wrap gap-3">
              <BotaoLink to="/cadastro" className="min-h-14 px-6 text-[17px]">A partir de {PRECO.mensal}/mês</BotaoLink>
              <a href="#whatsapp" className="inline-flex min-h-14 items-center rounded-xl border-[1.5px] border-borda bg-white px-6 text-[17px] font-bold text-tinta no-underline">Ver no WhatsApp</a>
            </div>
            <span className="text-sm text-suave">Pix ou cartão · cancele quando quiser · emolumentos pela tabela de MG</span>
          </div>

          <div className="flex min-w-0 flex-1 basis-[420px] flex-col gap-4 rounded-[28px] bg-acao p-4 sm:p-7">
            <label className="flex flex-col gap-2 font-bold text-white">Valor do imóvel
              <span className="flex h-16 items-center gap-2.5 rounded-2xl bg-white px-4">
                <span className="display text-[22px] font-bold text-suave">R$</span>
                <input
                  inputMode="numeric"
                  aria-describedby="dica-valor"
                  value={centavos ? centavosParaTexto(centavos) : ''}
                  onChange={(e) => setCentavos(textoParaCentavos(e.target.value))}
                  className="numero w-full min-w-0 bg-transparent text-[26px] font-extrabold text-tinta outline-none sm:text-[28px]"
                />
              </span>
              <span id="dica-valor" className="text-[13px] font-medium text-[#d5ddff]">Use o valor declarado do imóvel.</span>
            </label>
            <div role="group" aria-label="Tipo de ato" className="flex flex-wrap gap-2">
              {([['escritura', 'Escritura'], ['caixa', 'Financiamento Caixa'], ['doacao', 'Doação']] as const).map(([v, r]) => (
                <button key={v} type="button" aria-pressed={ato === v} onClick={() => setAto(v)}
                  className={cn('min-h-11 rounded-full border-2 px-4 font-bold', ato === v ? 'border-white bg-white text-tinta' : 'border-[#8a9cf0] text-white')}>{r}</button>
              ))}
            </div>
            <Orcamento titulo={ato === 'caixa' ? 'financiamento Caixa' : ato === 'doacao' ? 'doação' : 'escritura'} resultado={resultado} />
            <span className="text-[13px] text-[#d5ddff]">{NOTA[ato]} Certidões e honorários você ajusta no app.</span>
          </div>
        </section>

        {/* Etiquetas */}
        <section className="mx-auto flex max-w-[1200px] flex-wrap gap-x-16 gap-y-8 px-4 pt-24 sm:px-6">
          <div className="flex flex-1 basis-80 flex-col gap-3">
            <h2 className="text-[30px] font-[850] leading-9 sm:text-[38px] sm:leading-[44px]">Cada linha diz de onde vem.</h2>
            <p className="text-[17px] leading-[27px] text-texto">Na hora de explicar o orçamento, o cliente quer saber o que é imposto da prefeitura, o que é cartório e o que é o seu serviço. A etiqueta mostra.</p>
          </div>
          <dl className="grid flex-[2] basis-[520px] gap-3 sm:grid-cols-2">
            {ETIQUETAS.map(([t, c, d]) => (
              <div key={t} className="flex flex-col gap-2 rounded-2xl border border-linha bg-white p-5">
                <dt><span className={cn('rounded-md px-2 py-0.5 text-xs font-extrabold', c)}>{t}</span></dt>
                <dd className="text-texto">{d}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* WhatsApp */}
        <section id="whatsapp" className="mx-auto max-w-[1200px] px-4 pt-24 sm:px-6">
          <div className="flex flex-wrap items-center gap-10 rounded-[28px] bg-tinta p-6 text-white sm:p-12">
            <div className="flex min-w-0 flex-1 basis-80 flex-col gap-4">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-marca-texto">Incluído na assinatura</span>
              <h2 className="text-[30px] font-[850] leading-9 sm:text-[38px] sm:leading-[44px]">O cliente perguntou no WhatsApp? Pergunte ao agente no WhatsApp.</h2>
              <p className="text-[17px] leading-[27px] text-[#c7cedb]">Escreva do jeito que você fala. O agente reconhece o seu número, calcula, devolve o PDF e guarda tudo no seu histórico.</p>
              <ul className="flex flex-col gap-2.5">
                {['Entende "350 mil", "1,2 mi" e pergunta só o que falta', 'Responde com o PDF pronto para encaminhar ao cliente', '"Exportar outubro" e a planilha do mês chega na hora'].map((t) => (
                  <li key={t} className="flex gap-2.5"><Check className="mt-0.5 size-5 shrink-0 text-[#5be3a5]" aria-hidden="true" />{t}</li>
                ))}
              </ul>
            </div>
            <div className="flex min-w-0 flex-1 basis-80 flex-col gap-2.5 rounded-[20px] bg-[#1b2438] p-4">
              <div className="max-w-[82%] self-end rounded-2xl rounded-br-[4px] bg-acao px-3.5 py-2.5">Escritura de um apê de 350 mil</div>
              <div className="flex max-w-[88%] flex-col gap-1.5 self-start rounded-2xl rounded-bl-[4px] bg-white px-3.5 py-3 text-tinta">
                <span>Compra e venda · base <strong>R$ 350.000,00</strong></span>
                <span className="numero whitespace-pre-line text-texto">{'ITBI: R$ 7.000,00\nEscritura: R$ 5.398,00\nRegistro: R$ 5.245,68\nCertidões e honorários: R$ 1.100,00'}</span>
                <span className="display text-xl font-black">Total: <span className="marca-texto">R$ 18.743,68</span></span>
              </div>
              <div className="flex items-center gap-2.5 self-start rounded-xl bg-white px-3.5 py-2.5 text-tinta">
                <span className="rounded-md bg-minas-claro p-1.5 text-[11px] font-extrabold text-minas-texto">PDF</span><span className="font-semibold">orcamento-0142.pdf</span>
              </div>
            </div>
          </div>
        </section>

        {/* Calculadoras */}
        <section className="mx-auto flex max-w-[1200px] flex-col gap-7 px-4 pt-24 sm:px-6">
          <h2 className="max-w-[720px] text-[30px] font-[850] leading-9 sm:text-[38px] sm:leading-[44px]">Tudo o que aparece na mesa de quem vende imóvel.</h2>
          <ul className="grid gap-x-8 border-t-2 border-tinta sm:grid-cols-2 lg:grid-cols-3">
            {[['Escrituras', 'compra e venda, interveniência, vínculo'], ['Financiamento Caixa', 'SBPE, MCMV, SFI, FGTS'], ['Banco privado', 'Itaú, Bradesco, Santander'], ['Doação', 'simples, com ou sem usufruto'], ['Correção contratual', 'pelo INCC']].map(([t, d]) => (
              <li key={t} className="flex justify-between gap-3 border-b border-[#d5dae2] py-4"><strong>{t}</strong><span className="text-right text-suave">{d}</span></li>
            ))}
          </ul>
        </section>

        {/* Cidades */}
        <section id="cidades" className="mx-auto max-w-[1200px] px-4 pt-24 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-16 gap-y-8 rounded-[28px] border border-linha bg-white p-6 sm:p-12">
            <div className="flex flex-1 basis-80 flex-col gap-3.5">
              <span className="rotulo-secao">Minas Gerais primeiro</span>
              <h2 className="text-[30px] font-[850] leading-9 sm:text-[38px] sm:leading-[44px]">Começamos por Juiz de Fora. A próxima cidade é você que escolhe.</h2>
              <p className="text-[17px] leading-[27px] text-texto">A tabela de cartório de MG já vale para o estado inteiro. Para abrir uma cidade nova, falta cadastrar a regra de ITBI da prefeitura. Vamos pela ordem dos pedidos.</p>
              <div className="flex items-center gap-3 rounded-xl bg-nevoa px-4 py-3.5">
                <span className="size-2.5 rounded-full bg-ok" aria-hidden="true" /><span><strong>Juiz de Fora</strong> · disponível</span>
              </div>
            </div>
            <PedirCidade />
          </div>
        </section>

        {/* Preço */}
        <section id="preco" className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 pt-24 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex max-w-[640px] flex-col gap-3">
              <h2 className="text-[30px] font-[850] leading-9 sm:text-[38px] sm:leading-[44px]">Dois planos. Tudo incluído.</h2>
              <p className="text-[17px] leading-[27px] text-texto">Os dois têm todas as calculadoras, o agente no WhatsApp, o histórico e a exportação. O Pró coloca a sua marca no orçamento.</p>
            </div>
            <div role="group" aria-label="Período" className="grid w-full max-w-[400px] grid-cols-2 gap-1 rounded-xl bg-cinza p-1 text-[15px]">
              {[[false, 'Mensal'], [true, 'Anual · 2 meses grátis']].map(([v, r]) => (
                <button key={String(v)} type="button" aria-pressed={anual === v} onClick={() => setAnual(v as boolean)}
                  className={cn('min-h-11 rounded-[9px] font-bold', anual === v ? 'bg-white text-tinta shadow-sm' : 'text-suave')}>{r as string}</button>
              ))}
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {(['usuario', 'pro'] as const).map((nivel) => {
              const p = PLANOS[nivel];
              const pro = nivel === 'pro';
              return (
                <div key={nivel} className={cn('mr-2 flex flex-col gap-5 rounded-3xl border-2 bg-white p-6 sm:p-8', pro ? 'border-tinta shadow-[8px_8px_0_#101828]' : 'border-linha')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xl font-[850]">{p.nome}</span>
                    {pro && <span className="rounded-full bg-acao px-3 py-1 text-xs font-bold text-white">Com a sua marca</span>}
                  </div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="numero text-[52px] font-black leading-[56px]">{anual ? p.anual.replace(',00', '') : p.mensal}</span>
                    <span className="text-[17px] text-suave">{anual ? 'por ano' : 'por mês'}</span>
                  </div>
                  <span className="self-start rounded-lg bg-amarelo-claro px-2.5 py-1 font-bold text-amarelo-texto">{anual ? `Sai a ${p.anualPorMes} por mês` : pro ? 'Sua marca em cada orçamento' : 'Menos que um café por semana'}</span>
                  <ul className="flex flex-col gap-2 text-texto">
                    {['Todas as calculadoras e o agente no WhatsApp', 'Histórico e exportação em planilha', p.resumo, ...(pro ? ['Escolha da cor do orçamento'] : [])].map((t) => (
                      <li key={t} className="flex gap-2"><Check className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden="true" />{t}</li>
                    ))}
                  </ul>
                  <BotaoLink to={`/cadastro?nivel=${nivel}&plano=${anual ? 'anual' : 'mensal'}`} variante={pro ? 'primario' : 'secundario'} className="mt-auto min-h-14 text-[17px]">Começar com o {p.nome}</BotaoLink>
                </div>
              );
            })}
          </div>
          <span className="text-center text-sm text-suave">3 dias grátis para testar · cartão de crédito no cadastro, mesmo pagando no Pix · cancele quando quiser</span>
        </section>

        {/* Dúvidas */}
        <section id="duvidas" className="mx-auto flex max-w-[820px] flex-col gap-5 px-4 pt-24 sm:px-6">
          <h2 className="text-[30px] font-[850] leading-9 sm:text-[38px] sm:leading-[44px]">Dúvidas de quem está assinando</h2>
          <div className="border-t-2 border-tinta">
            {DUVIDAS.map(([p, r]) => (
              <details key={p} className="group border-b border-[#d5dae2] py-4">
                <summary className="flex cursor-pointer list-none justify-between gap-4 text-[17px] font-bold [&::-webkit-details-marker]:hidden">
                  {p}<Plus className="size-6 shrink-0 text-acao transition-transform group-open:rotate-45" aria-hidden="true" />
                </summary>
                <p className="mt-3 text-texto">{r}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 py-24 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-[28px] bg-acao p-8 text-white sm:p-12">
            <h2 className="flex-1 basis-96 text-[28px] font-[850] leading-[34px] sm:text-[34px] sm:leading-10">Seu próximo orçamento sai em 10 segundos.</h2>
            <BotaoLink to="/cadastro" variante="claro" className="min-h-14 px-6 text-[17px]">A partir de {PRECO.mensal}/mês</BotaoLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-linha bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-x-8 gap-y-3 p-6 text-[13px] text-suave">
          <span>Orçaí Imob · Juiz de Fora, MG · um produto Clemente Assessoria</span>
          <span>Valores estimados. Confirme com o cartório e a prefeitura antes do ato.</span>
        </div>
      </footer>
    </div>
  );
}
