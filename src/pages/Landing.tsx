import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { brl, calcular, MUNICIPIO_PADRAO, MUNICIPIOS, type Linha, type Resultado } from '@/lib/calc';
import { api } from '@/lib/api';
import { DIAS_TESTE, DIAS_TESTE_INDICACAO, LANCAMENTO_TEXTO, OFERTA_LANCAMENTO, ORDEM_PERIODOS, PERIODOS, PLANOS, preco, type Periodo } from '@/lib/config';
import { EntradaMoeda } from '@/components/ui/Campos';
import { BotaoWhatsapp, linkTesteWhatsapp } from '@/components/ui/BotaoWhatsapp';
import './home.css';

type Ato = 'escritura' | 'financiamento_caixa' | 'doacao';

const ATOS: { id: Ato; rotulo: string; titulo: string; nota: string }[] = [
  { id: 'escritura', rotulo: 'Escritura', titulo: 'escritura', nota: 'Compra e venda simples, 25 folhas.' },
  { id: 'financiamento_caixa', rotulo: 'Financiamento Caixa', titulo: 'financiamento Caixa', nota: 'SBPE, 80% financiado, primeiro imóvel, taxa de 1,5%, contrato de 16 folhas.' },
  { id: 'doacao', rotulo: 'Doação', titulo: 'doação', nota: 'Doação simples, avaliação igual ao valor informado, 25 folhas.' },
];

const CIDADES = Object.values(MUNICIPIOS);
const NOMES_CIDADES = CIDADES.map((m) => m.nome).join(' e ');

/** Simulação da home: as mesmas fórmulas e tabelas do app, com premissas fixas e explicadas. */
function simular(ato: Ato, municipio: string, valor: number): Resultado | null {
  if (!valor) return null;
  try {
    if (ato === 'financiamento_caixa') return calcular(ato, { municipio, modalidade: 'SBPE', valorDeclarado: valor, valorFinanciado: valor * 0.8, primeiroImovel: true });
    if (ato === 'doacao') return calcular(ato, { municipio, subtipo: 'doacao_simples', valorAtribuido: valor, avaliacaoFazenda: valor });
    return calcular(ato, { municipio, subtipo: 'compra_venda_simples', valorDeclarado: valor });
  } catch { return null; }
}

/** Para a conversa e o orçamento de exemplo: certidões e honorários (valores do assinante) viram uma linha só. */
function linhasDoExemplo(r: Resultado): Linha[] {
  const doAssinante = r.linhas.filter((l) => l.origem === 'usuario');
  const juntas = doAssinante.length > 1
    ? [{ rotulo: 'Certidões e honorários', valor: doAssinante.reduce((s, l) => s + l.valor, 0), origem: 'usuario' as const, nota: 'Valores ajustáveis no aplicativo' }]
    : doAssinante;
  return [...r.linhas.filter((l) => l.origem !== 'usuario'), ...juntas];
}

const VALOR_EXEMPLO = 350000;

const DUVIDAS: [string, ReactNode][] = [
  ['Cálculo na Mão e Orça.ai são a mesma coisa?', 'Sim. Cálculo na Mão é o Orça.ai: o endereço continua levando ao produto de orçamento imobiliário.'],
  ['Posso experimentar sem cadastro?', 'Sim. A simulação desta página não exige conta, e no WhatsApp os 3 primeiros orçamentos com o agente são grátis. Para salvar histórico e usar os recursos do seu plano, crie uma conta.'],
  ['O valor calculado é definitivo?', 'É uma estimativa com as premissas informadas. Os valores finais são os do cartório e da prefeitura no dia do ato. Confira cidade, operação e composição antes de usar.'],
  ['Como começo a usar pelo WhatsApp?', 'Mande uma mensagem para o agente: os 3 primeiros orçamentos saem sem cadastro. Depois, o agente faz parte do plano Pró. No cadastro, confirme seu número com o código recebido e use esse número para pedir os orçamentos.'],
  ['Como o agente sabe que sou eu?', 'Pelo número que você confirma no cadastro com um código. Só esse número tem acesso aos seus orçamentos.'],
  ['Meu imóvel é em outra cidade?', <>Esta simulação cobre {NOMES_CIDADES}. No aplicativo, outras cidades de MG permitem informar a alíquota de ITBI. <a href="#cidades">Peça a sua cidade</a> para ela ganhar a regra completa.</>],
  ['Como funciona o cancelamento?', 'Pela página da conta. Nos primeiros 7 dias, o cancelamento é imediato com devolução do valor pago. Depois, no cartão, as cobranças seguem até o fim do período contratado. No Pix anual, basta não renovar.'],
];

function Marca({ comoLink = true }: { comoLink?: boolean }) {
  const conteudo = (
    <>
      <img className="brand-icon" src="/marca/simbolo.svg" alt="" />
      <span>orça<span className="brand-ai">.ai</span></span> <small>IMOB</small>
    </>
  );
  return comoLink
    ? <a className="brand" href="#inicio" aria-label="Orça.ai, início">{conteudo}</a>
    : <span className="brand">{conteudo}</span>;
}

function PedirCidade() {
  const [cidade, setCidade] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null);
  return (
    <form
      className="simulator-form"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api('/api/cidades/pedido', { corpo: { cidade, whatsapp }, publico: true });
          setEstado({ ok: true, texto: `Pedido registrado. Avisamos quando ${cidade} abrir.` });
          setCidade(''); setWhatsapp('');
        } catch (err) {
          setEstado({ ok: false, texto: err instanceof Error ? err.message : String(err) });
        }
      }}
    >
      <h3>Quero na minha cidade</h3>
      <label>Cidade em MG
        <input required minLength={2} value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Barbacena" />
      </label>
      <label>Seu WhatsApp
        <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(32) 99999-0000" />
      </label>
      <button type="submit" className="button">Avisar quando chegar ↗</button>
      {estado && <p role="status" className={estado.ok ? 'form-ok' : 'form-erro'}>{estado.texto}</p>}
    </form>
  );
}

export default function Landing() {
  const raiz = useRef<HTMLDivElement>(null);
  const [movimento, setMovimento] = useState(false);

  // Simulador
  const [municipio, setMunicipio] = useState(MUNICIPIO_PADRAO);
  const [centavos, setCentavos] = useState(VALOR_EXEMPLO * 100);
  const [ato, setAto] = useState<Ato>('escritura');
  const atual = ATOS.find((a) => a.id === ato)!;
  const resultado = useMemo(() => simular(ato, municipio, centavos / 100), [ato, municipio, centavos]);

  // Exemplo da conversa e do orçamento: escritura de R$ 350 mil em Juiz de Fora, com as tabelas em vigor.
  const exemplo = useMemo(() => simular('escritura', MUNICIPIO_PADRAO, VALOR_EXEMPLO), []);
  const linhasExemplo = exemplo ? linhasDoExemplo(exemplo) : [];

  // Conversa ilustrativa
  const [visiveis, setVisiveis] = useState(3);
  const [tocando, setTocando] = useState(false);
  const [jaTocou, setJaTocou] = useState(false);
  const timers = useRef<number[]>([]);

  const [detalhado, setDetalhado] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo>('anual');
  const [vagas, setVagas] = useState(0);

  useEffect(() => { api<{ vagas: number }>('/api/oferta', { publico: true }).then((r) => setVagas(r.vagas)).catch(() => setVagas(0)); }, []);

  const reduzir = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Seções aparecem ao rolar (sem animação para quem pediu menos movimento).
  useEffect(() => {
    if (reduzir || !raiz.current) return;
    setMovimento(true);
    const observador = new IntersectionObserver((entradas) => entradas.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('visible'); observador.unobserve(e.target); }
    }), { threshold: 0.08 });
    raiz.current.querySelectorAll('.reveal').forEach((el) => observador.observe(el));
    return () => observador.disconnect();
  }, [reduzir]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function tocarConversa() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setVisiveis(0);
    setTocando(true);
    for (let i = 0; i < 3; i++) {
      timers.current.push(window.setTimeout(() => {
        setVisiveis(i + 1);
        if (i === 2) { setTocando(false); setJaTocou(true); }
      }, reduzir ? 0 : 500 + i * 1300));
    }
  }

  const rolarPara = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: reduzir ? 'instant' : 'smooth' });

  return (
    <div ref={raiz} className={movimento ? 'home motion-ready' : 'home'}>
      <header>
        <Marca />
        <nav aria-label="Principal">
          <a href="#como">Como funciona</a>
          <a href="#whatsapp">No WhatsApp</a>
          <a href="#simular">Simular</a>
          <a href="#planos">Planos</a>
        </nav>
        <div className="header-actions">
          <Link className="login-link" to="/entrar">Entrar</Link>
          <Link className="button small" to="/cadastro">Começar agora ↗</Link>
        </div>
      </header>

      <main>
        <section className="hero" id="inicio">
          <div className="eyebrow"><span /> MENOS CONTA. MAIS CONVERSA.</div>
          <h1>O cliente perguntou.<br />Já está <em>na mão.</em><span className="spark" aria-hidden="true">✳</span></h1>
          <p>Orçamento de ITBI, escritura e registro para corretores.<br className="desktop" /> Pelo site ou no WhatsApp, pronto para apresentar ao cliente.</p>
          <a className="button yellow" href="#simular">Simular meu orçamento <span aria-hidden="true">↗</span></a>
          <div className="hero-caption">Sem cadastro para simular · {NOMES_CIDADES} / MG</div>
          <div className="hero-scene">
            <div className="photo">
              <img
                src="/home/corretora.webp"
                srcSet="/home/corretora-768.webp 768w, /home/corretora.webp 1536w"
                sizes="(max-width: 800px) 90vw, 840px"
                alt="Imagem ilustrativa de uma profissional usando o celular em um apartamento"
                fetchPriority="high"
              />
              <span className="photo-label">Mais presença.<br />Menos planilha.</span>
            </div>
            <div className="floating-message" aria-hidden="true">
              <img className="mini-avatar" src="/marca/avatar-whatsapp.svg" alt="" />
              <div><strong>Orça.ai</strong><p>Seu orçamento está pronto.</p></div>
              <span>✓✓</span>
            </div>
            <div className="receipt" aria-hidden="true">
              <div className="receipt-top">SEU PRÓXIMO NEGÓCIO <span>↗</span></div>
              <div className="receipt-body">
                <small>Orçamento organizado</small>
                <strong>Do valor do imóvel<br />ao PDF do cliente.</strong>
                <div className="receipt-tags"><span>ITBI</span><span>Escritura</span><span>Registro</span></div>
              </div>
              <div className="receipt-bottom">Tudo na mesma conversa. <span>✦</span></div>
            </div>
            <span className="scene-star" aria-hidden="true">✳</span>
          </div>
        </section>

        <div className="ticker" aria-hidden="true">
          <div>Escritura ✳ ITBI ✳ Registro ✳ No WhatsApp ✳ Na sua rotina ✳ Escritura ✳ ITBI ✳ Registro ✳ No WhatsApp ✳ Na sua rotina ✳</div>
        </div>

        <section className="simulator-section" id="simular">
          <div className="section-intro">
            <div className="eyebrow">EXPERIMENTE ANTES DE CRIAR SUA CONTA</div>
            <h2>Seu próximo orçamento<br /><em>começa aqui.</em></h2>
            <p>Escolha a cidade e a operação. Veja a estimativa mudar na hora.</p>
          </div>
          <div className="simulator-layout">
            <form className="simulator-form" onSubmit={(e) => e.preventDefault()}>
              <label>Cidade
                <select value={municipio} onChange={(e) => setMunicipio(e.target.value)}>
                  {CIDADES.map((m) => <option key={m.id} value={m.id}>{m.nome} / {m.uf}</option>)}
                </select>
              </label>
              <label>Valor do imóvel (R$)
                <EntradaMoeda centavos={centavos} onChange={setCentavos} />
              </label>
              <fieldset>
                <legend>Operação</legend>
                <div className="operation-tabs">
                  {ATOS.map((a) => (
                    <button key={a.id} type="button" aria-pressed={ato === a.id} onClick={() => setAto(a.id)}>{a.rotulo}</button>
                  ))}
                </div>
              </fieldset>
              <p className="calc-assumptions">{atual.nota} Certidões e honorários: valores de exemplo, que você ajusta no aplicativo.</p>
              <p className="calc-source">Cálculo com a tabela de emolumentos de Minas Gerais e as regras de ITBI de cada cidade, as mesmas do aplicativo. Estimativa; os valores finais devem ser confirmados com cartório e prefeitura.</p>
            </form>
            <article className="live-result" aria-live="polite">
              <div className="result-top">
                <img src="/marca/simbolo.svg" alt="" width={32} height={32} />
                <span>Orçamento de {atual.titulo}</span>
                <small>ESTIMATIVA</small>
              </div>
              <p>{MUNICIPIOS[municipio]?.nome} / MG · Imóvel de {brl(centavos / 100)}</p>
              {resultado ? (
                <>
                  <div>
                    {resultado.linhas.map((l) => (
                      <div key={l.rotulo} className="live-line">
                        <span>{l.rotulo}{l.nota && <small>{l.nota}</small>}</span>
                        <strong>{brl(l.valor)}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="live-total"><span>Total estimado</span><strong>{brl(resultado.total)}</strong></div>
                  <details className="calc-details">
                    <summary>Ver premissas e composição</summary>
                    <div>
                      {resultado.linhas.map((l) => (
                        <div key={l.rotulo}>
                          <p>{l.rotulo}: {brl(l.valor)}{l.nota ? ` · ${l.nota}` : ''}</p>
                          {l.detalhes?.map((d) => <p key={d.rotulo}>{d.rotulo}: {brl(d.valor)}{d.nota ? ` · ${d.nota}` : ''}</p>)}
                        </div>
                      ))}
                    </div>
                  </details>
                </>
              ) : (
                <div className="live-total"><span>Total estimado</span><strong>Informe um valor válido</strong></div>
              )}
              <Link className="button" to="/cadastro">Criar conta e salvar orçamentos ↗</Link>
              <small>Esta simulação é gratuita. O PDF personalizado e o agente no WhatsApp estão no plano Pró.</small>
            </article>
          </div>
        </section>

        <section className="statement" id="como">
          <div className="eyebrow">DA PERGUNTA À RESPOSTA</div>
          <h2 className="reveal">O tempo de fazer contas<br />pode virar tempo de<br /><span>fechar boas conversas.</span></h2>
          <div className="steps">
            <article className="reveal"><span>01 /</span><h3>Conte o que precisa.</h3><p>Informe o valor do imóvel e o tipo de operação, pelo site ou pelo WhatsApp.</p></article>
            <article className="reveal"><span>02 /</span><h3>Veja tudo organizado.</h3><p>ITBI, escritura, registro e os custos que compõem o orçamento, no mesmo lugar.</p></article>
            <article className="reveal"><span>03 /</span><h3>Leve para o cliente.</h3><p>No plano Pró, o PDF pode levar a sua marca, as suas cores e o seu contato.</p></article>
          </div>
        </section>

        <section className="whatsapp" id="whatsapp">
          <div className="wa-copy reveal">
            <div className="eyebrow">A SUA ROTINA JÁ ACONTECE AQUI</div>
            <h2>Uma mensagem.<br />Um orçamento.<br /><em>Próxima conversa.</em></h2>
            <p>Escreva como você fala. O Orça.ai organiza a resposta e deixa o orçamento pronto para encaminhar.</p>
            <button type="button" className="button yellow" onClick={tocarConversa} disabled={tocando}>
              {tocando ? 'A conversa está acontecendo…' : jaTocou ? 'Reproduzir de novo ↗' : 'Reproduzir conversa ↗'}
            </button>
            <small className="demo-note">Demonstração ilustrativa · nenhuma mensagem é enviada</small>
            <div className="wa-real">
              <strong>Quer falar com o agente de verdade?</strong>
              <p>Os 3 primeiros orçamentos no WhatsApp são grátis, sem cadastro.</p>
              <a href={linkTesteWhatsapp('site-conversa')} target="_blank" rel="noreferrer">Abrir o WhatsApp do Orça.ai ↗</a>
            </div>
          </div>
          <div className="phone-wrap reveal">
            <span className="phone-star" aria-hidden="true">✳</span>
            <div className="phone">
              <div className="phone-status">9:41 <span className="status-icons" aria-hidden="true"><svg viewBox="0 0 24 16"><path d="M2 14V11M7 14V8M12 14V5M17 14V2" stroke="currentColor" strokeWidth="3" /><rect x="20" y="5" width="3" height="9" fill="currentColor" /></svg></span></div>
              <div className="phone-head">
                <span>‹</span>
                <img className="mini-avatar" src="/marca/avatar-whatsapp.svg" alt="" />
                <div><strong>Orça.ai</strong><small>Demonstração</small></div>
                <span>⋮</span>
              </div>
              <div className="chat">
                <span className="demo-badge">EXEMPLO ILUSTRATIVO · NÃO É O AGENTE REAL</span>
                <span className="today">HOJE</span>
                <div className={visiveis >= 1 ? 'bubble outgoing' : 'bubble outgoing hidden-message'}>
                  Preciso de um orçamento de escritura. Imóvel de 350 mil em Juiz de Fora.
                  <small>09:41 <span className="read-receipt">✓✓</span></small>
                </div>
                <div className={visiveis >= 2 ? 'bubble incoming' : 'bubble incoming hidden-message'}>
                  Seu orçamento está pronto.<br /><br />
                  {linhasExemplo.map((l) => <span key={l.rotulo}>{l.rotulo} <b>{brl(l.valor)}</b><br /></span>)}
                  <hr />
                  Total estimado<br />
                  <strong className="total">{exemplo ? brl(exemplo.total) : ''}</strong>
                  <small>09:41</small>
                </div>
                <div className={visiveis >= 3 ? 'bubble incoming document' : 'bubble incoming document hidden-message'}>
                  <span>PDF</span>
                  <div><strong>orcamento-imovel.pdf</strong><small>PDF · Orçamento ilustrativo</small></div>
                  <button type="button" onClick={() => rolarPara('orcamento')} aria-label="Ver orçamento demonstrativo">↗</button>
                </div>
                {tocando && <div className="typing" style={{ display: 'block' }} aria-live="polite">Preparando demonstração…</div>}
              </div>
              <div className="phone-input">Mensagem <span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3" /></svg></span></div>
            </div>
          </div>
        </section>

        <section className="budget-section" id="orcamento">
          <div className="budget-heading reveal">
            <div className="eyebrow">CLAREZA PARA SEGUIR EM FRENTE</div>
            <h2>Uma boa resposta<br />também tem <em>boa apresentação.</em></h2>
            <p>Explore o orçamento que apareceu na conversa.</p>
          </div>
          <div className="budget-layout">
            <div className="budget-note reveal">
              <span className="big-arrow" aria-hidden="true">↘</span>
              <h3>Cada custo,<br />no seu lugar.</h3>
              <p>Uma entrega legível para explicar ao cliente o que está incluído na estimativa.</p>
              <div className="city">↗ {CIDADES.map((m) => m.nome).join(' & ')}<small>Atendimento em Minas Gerais</small></div>
            </div>
            <article className="budget-sheet reveal">
              <div className="sheet-head"><Marca comoLink={false} /><span>EXEMPLO ILUSTRATIVO<br />001 / {new Date().getFullYear()}</span></div>
              <small>COMPRA E VENDA · JUIZ DE FORA / MG</small>
              <h3>Seu orçamento<br />sem complicação.</h3>
              <div className="property-value"><span>Valor do imóvel</span><strong>{brl(VALOR_EXEMPLO)}</strong></div>
              <button type="button" className="detail-toggle" aria-expanded={detalhado} onClick={() => setDetalhado((d) => !d)}>
                Ver composição dos custos <span>{detalhado ? '−' : '＋'}</span>
              </button>
              <div className={detalhado ? 'costs expanded' : 'costs'}>
                {linhasExemplo.map((l) => (
                  <div key={l.rotulo}><span>{l.rotulo} {l.nota && <small>{l.nota}</small>}</span><strong>{brl(l.valor)}</strong></div>
                ))}
              </div>
              <div className="sheet-total"><span>Total estimado</span><strong>{exemplo ? brl(exemplo.total) : ''}</strong></div>
              <p className="sheet-disclaimer">Orçamento ilustrativo. Valores estimados; confirme com o cartório e a prefeitura antes do ato.</p>
              <button type="button" className="print-button" onClick={() => window.print()}>Imprimir ou salvar orçamento em PDF ↓</button>
            </article>
          </div>
        </section>

        <section className="plans-section" id="planos">
          <div className="section-intro">
            <div className="eyebrow">ESCOLHA COMO QUER TRABALHAR</div>
            <h2>O site no Starter.<br /><em>Sua marca e WhatsApp no Pró.</em></h2>
            <p>Todas as calculadoras e histórico nos dois planos.</p>
          </div>
          <div className="period-tabs" role="group" aria-label="Período do plano">
            {ORDEM_PERIODOS.map((p) => (
              <button key={p} type="button" aria-pressed={periodo === p} onClick={() => setPeriodo(p)}>{PERIODOS[p].nome}</button>
            ))}
          </div>
          {vagas > 0 && (
            <div className="founder">
              <div>
                <span className="plan-label">OFERTA DE LANÇAMENTO</span>
                <h3>{OFERTA_LANCAMENTO.nome}: {LANCAMENTO_TEXTO}/mês</h3>
                <p>Plano {PLANOS[OFERTA_LANCAMENTO.nivel].nome} anual, cobrado mês a mês, para os {OFERTA_LANCAMENTO.vagas} primeiros corretores, com benefícios exclusivos de fundador. {OFERTA_LANCAMENTO.diasTeste} dias de teste com o cartão cadastrado, fidelidade de 12 meses e cancelamento grátis nos 7 primeiros dias. {vagas === 1 ? 'Resta 1 vaga.' : `Restam ${vagas} vagas.`}</p>
              </div>
              <Link className="button yellow" to="/cadastro?oferta=lancamento">Garantir minha vaga ↗</Link>
            </div>
          )}
          <div className="plan-grid">
            {(['usuario', 'pro'] as const).map((nivel) => {
              const p = PLANOS[nivel];
              const v = preco(nivel, periodo);
              const pro = nivel === 'pro';
              const itens = pro ? ['Tudo do Starter', p.resumo, 'Agente de orçamento no WhatsApp'] : ['Todas as calculadoras', 'Histórico e exportação em planilha', p.resumo];
              const fidelidade = PERIODOS[periodo].cobranca;
              return (
                <article key={nivel} className={pro ? 'plan-card featured' : 'plan-card'}>
                  <span className="plan-label">{pro ? 'COM A SUA MARCA' : 'PARA COMEÇAR'}</span>
                  <h3>{p.nome}</h3>
                  <div className="plan-price"><strong>{v.porMesTexto}</strong> <span>/mês</span></div>
                  <p>
                    Cartão: {PERIODOS[periodo].meses} cobranças de {v.porMesTexto}. Total do período: {v.totalTexto}. {fidelidade.charAt(0).toUpperCase() + fidelidade.slice(1)}.
                    {periodo === 'anual' && ` Ou ${v.totalTexto} à vista no Pix.`}
                  </p>
                  <ul>{itens.map((t) => <li key={t}>{t}</li>)}</ul>
                  <Link className={pro ? 'button yellow' : 'button'} to={`/cadastro?nivel=${nivel}&plano=${periodo}`}>Escolher {p.nome} ↗</Link>
                </article>
              );
            })}
          </div>
          <p className="plan-disclosure">{DIAS_TESTE} dias de teste ({DIAS_TESTE_INDICACAO} com cupom de indicação) · cartão exigido no cadastro, inclusive para pagamento no Pix. Cartão cobrado mês a mês com fidelidade do período escolhido. Pix disponível apenas no anual.</p>
        </section>

        <section className="trust-section">
          <div>
            <div className="eyebrow">EXPERIÊNCIA IMOBILIÁRIA POR TRÁS DO PRODUTO</div>
            <h2>Clareza no orçamento.<br />Contexto em cada valor.</h2>
            <p>Um produto da Clemente Assessoria, de Juiz de Fora. As estimativas usam tabelas de emolumentos de Minas Gerais e regras municipais cadastradas.</p>
          </div>
          <div className="trust-points">
            <article><h3>{NOMES_CIDADES}</h3><p>Escolha sua cidade na simulação. A cobertura e as regras municipais ficam explícitas.</p></article>
            <article><h3>Custos separados e explicados</h3><p>Veja a composição e as premissas antes de apresentar o orçamento.</p></article>
            <article><h3>Seu jeito de atender</h3><p>O plano Pró leva a sua identidade para o PDF e inclui o agente no WhatsApp.</p></article>
          </div>
        </section>

        <section className="cities-section" id="cidades">
          <div>
            <div className="eyebrow">MINAS GERAIS PRIMEIRO</div>
            <h2>A próxima cidade<br /><em>é você que escolhe.</em></h2>
            <p>A tabela de cartório de MG já vale para o estado inteiro. Para abrir uma cidade nova, falta cadastrar a regra de ITBI da prefeitura. Vamos pela ordem dos pedidos.</p>
            <ul className="city-list">
              {CIDADES.map((m) => <li key={m.id}><span aria-hidden="true" /> <strong>{m.nome}</strong> · disponível</li>)}
            </ul>
          </div>
          <PedirCidade />
        </section>

        <section className="faq-section" id="duvidas">
          <div className="section-intro">
            <div className="eyebrow">ANTES DE COMEÇAR</div>
            <h2>Dúvidas resolvidas.</h2>
          </div>
          {DUVIDAS.map(([p, r]) => <details key={p}><summary>{p}</summary><p>{r}</p></details>)}
        </section>

        <section className="closing">
          <div className="eyebrow">ORÇA.AI IMOB</div>
          <h2>Mais conversa.<br /><em>Menos conta.</em></h2>
          <Link className="button yellow" to="/cadastro">Criar minha conta ↗</Link>
          <p>Cálculo na Mão é o Orça.ai.</p>
        </section>
      </main>

      <footer>
        <Marca />
        <p>Orça.ai Imob · Juiz de Fora, MG · um produto Clemente Assessoria. Valores estimados; confirme com o cartório e a prefeitura antes do ato.</p>
        <Link className="footer-link" to="/entrar">Acessar minha conta ↗</Link>
        <div className="footer-legal"><Link to="/termos">Termos de uso</Link><Link to="/privacidade">Privacidade</Link></div>
      </footer>
      <BotaoWhatsapp />
    </div>
  );
}
