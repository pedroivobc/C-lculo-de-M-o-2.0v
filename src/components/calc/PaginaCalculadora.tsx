import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, FileDown, Save } from 'lucide-react';
import { calcular, type Resultado, type TipoCalculo } from '@/lib/calc';
import { api } from '@/lib/api';
import { brl, numeroCalculo } from '@/lib/formato';
import { Orcamento } from '@/components/ui/Orcamento';
import { Alternar, Aviso, Botao, Campo, Cartao } from '@/components/ui/Campos';
import { useConta } from '@/hooks/useConta';

type Formato = 'pdf' | 'jpeg';
const NOME_FORMATO: Record<Formato, string> = { pdf: 'PDF', jpeg: 'imagem' };

/** Cidade e alíquota do ITBI do perfil entram em todos os cálculos com ITBI (as telas não pedem de novo). */
function useEntradaComLocalidade(tipo: TipoCalculo, entrada: unknown) {
  const { perfil } = useConta();
  return useMemo(() => {
    if (!perfil || tipo === 'correcao' || typeof entrada !== 'object' || !entrada) return entrada;
    return {
      municipio: perfil.municipio_padrao,
      ...(perfil.cidade_nome ? { cidade: perfil.cidade_nome } : {}),
      ...(perfil.itbi_percentual != null ? { itbiPercentual: Number(perfil.itbi_percentual) } : {}),
      ...entrada,
    };
  }, [perfil, tipo, JSON.stringify(entrada)]);
}

/** Calcula no navegador com as mesmas fórmulas do servidor. Entrada inválida/incompleta → null. */
export function useResultado(tipo: TipoCalculo, entrada: unknown): Resultado | null {
  return useMemo(() => {
    try {
      const r = calcular(tipo, entrada);
      return r.bases.some((b) => b > 0) || r.total > 0 ? r : null;
    } catch {
      return null;
    }
  }, [tipo, JSON.stringify(entrada)]);
}

/** Salvar no histórico e baixar o orçamento em PDF ou imagem (pelo servidor, que guarda o arquivo). */
function useAcoes(tipo: TipoCalculo, entrada: unknown, endereco?: string) {
  const [salvo, setSalvo] = useState<{ numero: number; chave: string } | null>(null);
  const [ocupado, setOcupado] = useState<'salvar' | 'arquivo' | null>(null);
  const [mensagem, setMensagem] = useState<{ tom: 'verde' | 'vermelho'; texto: string } | null>(null);
  const chave = JSON.stringify([entrada, endereco ?? '']);
  const atual = salvo?.chave === chave ? salvo.numero : null;

  async function salvar() {
    if (atual) return atual;
    // O endereço do imóvel vai em `descricao` e aparece no orçamento.
    const r = await api<{ numero: number }>(`/api/calculos/${tipo}`, { corpo: { ...(entrada as object), ...(endereco ? { descricao: endereco } : {}) } });
    setSalvo({ numero: r.numero, chave });
    return r.numero;
  }

  return {
    numero: atual,
    ocupado,
    mensagem,
    async onSalvar() {
      setOcupado('salvar'); setMensagem(null);
      try {
        const n = await salvar();
        setMensagem({ tom: 'verde', texto: `Salvo no histórico como ${numeroCalculo(n)}.` });
      } catch (e) {
        setMensagem({ tom: 'vermelho', texto: e instanceof Error ? e.message : String(e) });
      } finally { setOcupado(null); }
    },
    async onArquivo(formato: Formato) {
      // Abre a aba antes do await para o navegador não bloquear o pop-up.
      const aba = window.open('', '_blank');
      setOcupado('arquivo'); setMensagem(null);
      try {
        const n = await salvar();
        const { url } = await api<{ url: string }>(`/api/calculos/${n}/arquivo?formato=${formato}`);
        if (aba) aba.location.href = url; else window.location.href = url;
        setMensagem({ tom: 'verde', texto: `Orçamento ${numeroCalculo(n)} gerado em ${NOME_FORMATO[formato]}.` });
      } catch (e) {
        aba?.close();
        setMensagem({ tom: 'vermelho', texto: e instanceof Error ? e.message : String(e) });
      } finally { setOcupado(null); }
    },
  };
}

/** Moldura comum das calculadoras: cabeçalho, opções, formulário e o orçamento ao lado. */
export function PaginaCalculadora({ tipo, entrada, rotulo, titulo, descricao, tituloOrcamento, rotuloTotal, opcoes, avisoFormulario, children }: {
  tipo: TipoCalculo;
  entrada: unknown;
  rotulo: string;
  titulo: string;
  descricao: string;
  tituloOrcamento: string;
  rotuloTotal?: string;
  opcoes?: ReactNode;
  avisoFormulario?: ReactNode;
  children: ReactNode;
}) {
  const comLocalidade = useEntradaComLocalidade(tipo, entrada);
  const resultado = useResultado(tipo, comLocalidade);
  const [comEndereco, setComEndereco] = useState(false);
  const [endereco, setEndereco] = useState('');
  const enderecoFinal = comEndereco ? endereco.replace(/\s+/g, ' ').trim().slice(0, 120) || undefined : undefined;
  const acoes = useAcoes(tipo, comLocalidade, enderecoFinal);
  const { perfil } = useConta();
  const formato: Formato = perfil?.formato_orcamento ?? 'pdf';
  const outro: Formato = formato === 'pdf' ? 'jpeg' : 'pdf';
  const textoGerar = acoes.ocupado === 'arquivo' ? 'Gerando…' : `Gerar ${NOME_FORMATO[formato]}`;

  return (
    <div className="flex flex-col gap-6 pb-32 lg:pb-0">
      <Link to="/app" className="-mt-2 inline-flex items-center gap-1 self-start font-semibold text-suave no-underline lg:hidden">
        <ChevronLeft className="size-5" aria-hidden="true" />Início
      </Link>
      <header className="flex flex-col gap-1">
        <span className="rotulo-secao">{rotulo}</span>
        <h1 className="text-[26px] font-bold leading-8 sm:text-[28px] sm:leading-[34px]">{titulo}</h1>
        <p className="text-suave">{descricao}</p>
      </header>

      {opcoes}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Cartao titulo="Dados">
          <div className="flex flex-col gap-4">
            {children}
            {tipo !== 'correcao' && (
              <div className="flex flex-col gap-3">
                <Alternar rotulo="Colocar o endereço do imóvel no orçamento" ligado={comEndereco} onChange={setComEndereco} />
                {comEndereco && (
                  <Campo rotulo="Endereço do imóvel" value={endereco} maxLength={120} autoComplete="off"
                    placeholder="Ex.: Rua Halfeld, 100, apto 201 · Centro" onChange={(e) => setEndereco(e.target.value)} />
                )}
              </div>
            )}
            {avisoFormulario}
          </div>
        </Cartao>

        <div id="orcamento" className="flex scroll-mt-20 flex-col gap-3 lg:sticky lg:top-6">
          <Orcamento titulo={tituloOrcamento} resultado={resultado} rotuloTotal={rotuloTotal} />
          <div className="hidden flex-wrap gap-2 lg:flex">
            <Botao className="flex-1" onClick={() => acoes.onArquivo(formato)} disabled={!resultado || !!acoes.ocupado}>
              <FileDown className="size-5" aria-hidden="true" />{textoGerar}
            </Botao>
            <Botao variante="secundario" onClick={acoes.onSalvar} disabled={!resultado || !!acoes.ocupado || !!acoes.numero}>
              <Save className="size-5" aria-hidden="true" />{acoes.numero ? `Salvo · ${numeroCalculo(acoes.numero)}` : acoes.ocupado === 'salvar' ? 'Salvando…' : 'Salvar no histórico'}
            </Botao>
          </div>
          <button type="button" onClick={() => acoes.onArquivo(outro)} disabled={!resultado || !!acoes.ocupado}
            className="min-h-10 self-start text-sm font-bold text-acao disabled:text-suave">Baixar em {NOME_FORMATO[outro]}</button>
          {acoes.mensagem && <Aviso tom={acoes.mensagem.tom}>{acoes.mensagem.texto}</Aviso>}
        </div>
      </div>

      {/* Botões fixos no celular */}
      <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t border-linha bg-white px-4 pt-2.5 pb-[max(env(safe-area-inset-bottom),16px)] shadow-[0_-8px_24px_rgba(16,24,40,.08)] lg:hidden">
        <a href="#orcamento" className="col-span-2 flex items-baseline justify-between text-tinta no-underline">
          <span className="text-sm font-semibold text-suave">{rotuloTotal ?? 'Total estimado'}</span>
          <span className="numero marca-texto text-xl font-black">{resultado ? brl(resultado.total) : 'R$ 0,00'}</span>
        </a>
        <Botao variante="secundario" onClick={acoes.onSalvar} disabled={!resultado || !!acoes.ocupado || !!acoes.numero}>
          {acoes.numero ? numeroCalculo(acoes.numero) : 'Salvar'}
        </Botao>
        <Botao onClick={() => acoes.onArquivo(formato)} disabled={!resultado || !!acoes.ocupado}>{textoGerar}</Botao>
      </div>
    </div>
  );
}

/** Grade de 2 colunas para os campos. */
export function Grade({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
