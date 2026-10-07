import { useEffect, useState } from 'react';
import { Copy, Gift, Share2 } from 'lucide-react';
import { api } from '@/lib/api';
import { DIAS_TESTE, DIAS_TESTE_INDICACAO, MARCA } from '@/lib/config';
import { Aviso, Botao, Cartao } from '@/components/ui/Campos';

interface Resumo {
  recompensa?: { liberados: number; usados: number; aguardandoAnual: number };
  codigo: string | null;
  link: string | null;
  indicados: { nome: string; em: string; situacao: 'em_teste' | 'teste_encerrado' | 'assinante' }[];
}

const SITUACAO: Record<Resumo['indicados'][number]['situacao'], string> = {
  em_teste: 'em teste', teste_encerrado: 'teste encerrado', assinante: 'assinante',
};

/** Cupom de indicação do assinante: gerar, copiar, mandar pelo WhatsApp e ver quem usou. */
export function Indicacao() {
  const [r, setR] = useState<Resumo | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tom: 'verde' | 'vermelho'; texto: string } | null>(null);

  useEffect(() => { api<Resumo>('/api/indicacao').then(setR).catch(() => setR({ codigo: null, link: null, indicados: [] })); }, []);

  async function gerar() {
    setOcupado(true); setAviso(null);
    try {
      const novo = await api<{ codigo: string; link: string }>('/api/indicacao/codigo', { metodo: 'POST' });
      setR((v) => ({ indicados: v?.indicados ?? [], ...novo }));
    } catch (e) { setAviso({ tom: 'vermelho', texto: e instanceof Error ? e.message : String(e) }); }
    finally { setOcupado(false); }
  }

  const mensagem = r?.codigo && r.link
    ? `Uso o ${MARCA} para fazer orçamento de escritura, ITBI e financiamento em segundos, direto no WhatsApp. Cadastre-se com o meu cupom ${r.codigo} e ganhe ${DIAS_TESTE_INDICACAO} dias grátis: ${r.link}`
    : '';

  async function copiar() {
    try { await navigator.clipboard.writeText(mensagem); setAviso({ tom: 'verde', texto: 'Mensagem copiada. É só colar para o seu colega.' }); }
    catch { setAviso({ tom: 'vermelho', texto: 'Não deu para copiar. Selecione o cupom e copie à mão.' }); }
  }

  return (
    <Cartao titulo="Indique um colega">
      <div className="flex flex-col gap-3">
        <p className="text-suave">Quem se cadastra com o seu cupom ganha <strong className="text-tinta">{DIAS_TESTE_INDICACAO} dias grátis</strong> em vez de {DIAS_TESTE}. E você ganha <strong className="text-tinta">1 mês grátis</strong> para cada indicado que assinar o <strong className="text-tinta">plano anual</strong>. No WhatsApp do agente, escreva <strong className="text-tinta">cupom</strong> para receber a mensagem pronta.</p>
        {r?.recompensa && (r.recompensa.liberados > 0 || r.recompensa.aguardandoAnual > 0 || r.recompensa.usados > 0) && (
          <div className="grid grid-cols-3 gap-2 text-center">
            {([['liberados', 'mês grátis a usar', 'meses grátis a usar'], ['aguardandoAnual', 'aguardando anual', 'aguardando anual'], ['usados', 'já usado', 'já usados']] as const).map(([k, um, varios]) => (
              <div key={k} className="rounded-xl bg-nevoa px-2 py-2.5">
                <span className="numero block text-xl font-black text-tinta">{r.recompensa![k]}</span>
                <span className="text-xs text-suave">{r.recompensa![k] === 1 ? um : varios}</span>
              </div>
            ))}
          </div>
        )}
        {!r ? <span className="text-suave">Carregando…</span> : !r.codigo ? (
          <Botao onClick={gerar} disabled={ocupado}><Gift className="size-5" aria-hidden="true" />{ocupado ? 'Gerando…' : 'Gerar meu cupom'}</Botao>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 rounded-xl border-2 border-dashed border-borda bg-nevoa px-4 py-3">
              <span className="numero text-2xl font-black tracking-[0.12em] text-tinta">{r.codigo}</span>
              <button type="button" onClick={copiar} className="inline-flex min-h-11 items-center gap-1.5 font-bold text-acao"><Copy className="size-4" aria-hidden="true" />Copiar</button>
            </div>
            <a href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-acao px-5 font-bold text-white no-underline">
              <Share2 className="size-5" aria-hidden="true" />Mandar pelo WhatsApp
            </a>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold">{r.indicados.length ? `${r.indicados.length} ${r.indicados.length === 1 ? 'pessoa usou' : 'pessoas usaram'} o seu cupom` : 'Ninguém usou o seu cupom ainda.'}</span>
              {r.indicados.length > 0 && (
                <ul className="flex flex-col divide-y divide-linha rounded-xl border border-linha text-sm">
                  {r.indicados.map((i, k) => (
                    <li key={k} className="flex justify-between gap-3 px-3 py-2">
                      <span className="font-semibold">{i.nome}</span>
                      <span className="text-suave">{SITUACAO[i.situacao]} · {new Date(i.em).toLocaleDateString('pt-BR')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
        {aviso && <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>}
      </div>
    </Cartao>
  );
}
