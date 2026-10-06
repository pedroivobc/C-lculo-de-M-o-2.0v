import { useEffect, useId, useState, type ChangeEvent } from 'react';
import { FileImage, FileText, ImagePlus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { useConta } from '@/hooks/useConta';
import { CUSTOS_SISTEMA, lerCustosPadrao, MUNICIPIOS, MUNICIPIO_OUTRA, MUNICIPIO_PADRAO, ROTULO_GRUPO, type CustosPadrao, type GrupoCustos } from '@/lib/calc';
import { MARCA } from '@/lib/config';
import { brl } from '@/lib/formato';
import { Aviso, Botao, Campo, CampoMoeda } from '@/components/ui/Campos';
import { cn } from '@/lib/utils';

const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];
/** Estados com a tabela de emolumentos de cartório já cadastrada. */
const UFS_ATENDIDAS = new Set(['MG']);
const CORES = ['#2342D6', '#0F766E', '#15803D', '#B45309', '#B91C1C', '#7E22CE', '#0E7490', '#101828'];
const COR_MARCA = '#2342D6';
const LOGO_TIPOS = ['image/png', 'image/jpeg', 'image/webp'];

type Formato = 'pdf' | 'jpeg';

/**
 * Configuração do orçamento: estado, cidade e alíquota do ITBI, certidões e honorários padrão, nome, logo, cor e formato.
 * Usada no cadastro (etapa "Seu orçamento") e na Conta.
 */
export function ConfiguracaoOrcamento({ textoSalvar = 'Salvar', aoSalvar }: { textoSalvar?: string; aoSalvar?: () => void }) {
  const { perfil, recarregar } = useConta();
  const [uf, setUf] = useState('MG');
  const [municipio, setMunicipio] = useState(MUNICIPIO_PADRAO);
  const [cidade, setCidade] = useState('');
  const [aliquota, setAliquota] = useState('2');
  const [cabecalho, setCabecalho] = useState('');
  const [cor, setCor] = useState(COR_MARCA);
  const [formato, setFormato] = useState<Formato>('pdf');
  const [logoArquivo, setLogoArquivo] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [removerLogo, setRemoverLogo] = useState(false);
  /** Em centavos, por grupo (escritura/doação e financiamento). */
  const [custos, setCustos] = useState<Record<GrupoCustos, { certidoes: number; honorarios: number }>>(() => paraCentavos(CUSTOS_SISTEMA));
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tom: 'verde' | 'vermelho' | 'azul'; texto: string } | null>(null);
  const idLogo = useId();

  // Carrega o que já está salvo.
  useEffect(() => {
    if (!perfil) return;
    setUf(perfil.uf ?? 'MG');
    setMunicipio(perfil.municipio_padrao ?? MUNICIPIO_PADRAO);
    setCidade(perfil.cidade_nome ?? '');
    const padrao = MUNICIPIOS[perfil.municipio_padrao]?.itbi.aliquota;
    setAliquota(perfil.itbi_percentual != null ? String(perfil.itbi_percentual).replace('.', ',') : padrao ? String(padrao * 100).replace('.', ',') : '');
    setCabecalho(perfil.pdf_header ?? '');
    setCor(perfil.cor_primaria ?? COR_MARCA);
    setFormato(perfil.formato_orcamento ?? 'pdf');
    setCustos(paraCentavos(lerCustosPadrao(perfil.custos_padrao) ?? CUSTOS_SISTEMA));
    if (perfil.pdf_logo_path) {
      supabase.storage.from('logos').createSignedUrl(perfil.pdf_logo_path, 3600).then(({ data }) => setLogoUrl(data?.signedUrl ?? null));
    }
  }, [perfil]);

  const outra = municipio === MUNICIPIO_OUTRA;
  const daPrefeitura = MUNICIPIOS[municipio]?.itbi.aliquota;
  const pct = Number(aliquota.replace(',', '.'));
  const pctValido = aliquota.trim() !== '' && Number.isFinite(pct) && pct >= 0 && pct <= 10;
  const ufAtendida = UFS_ATENDIDAS.has(uf);
  const podeSalvar = ufAtendida && pctValido && (!outra || cidade.trim().length >= 2);

  function escolherLogo(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!LOGO_TIPOS.includes(f.type)) return setAviso({ tom: 'vermelho', texto: 'Use um arquivo PNG, JPG ou WEBP.' });
    if (f.size > 2 * 1024 * 1024) return setAviso({ tom: 'vermelho', texto: 'O logo precisa ter até 2 MB.' });
    setAviso(null);
    setLogoArquivo(f);
    setRemoverLogo(false);
    setLogoUrl(URL.createObjectURL(f));
  }

  async function avisarEstado() {
    await api('/api/cidades/pedido', { corpo: { cidade: `Estado ${uf}`, uf, whatsapp: perfil?.whatsapp_e164 ?? undefined } }).catch(() => null);
    setAviso({ tom: 'verde', texto: `Anotado. Avisamos no seu WhatsApp quando ${uf} abrir.` });
  }

  async function salvar() {
    if (!perfil || !podeSalvar) return;
    setOcupado(true); setAviso(null);
    try {
      let pdf_logo_path: string | null = removerLogo ? null : perfil.pdf_logo_path;
      if (logoArquivo) {
        const ext = logoArquivo.type === 'image/png' ? 'png' : logoArquivo.type === 'image/webp' ? 'webp' : 'jpg';
        const caminho = `${perfil.id}/logo-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('logos').upload(caminho, logoArquivo, { contentType: logoArquivo.type, upsert: true });
        if (error) throw new Error(`Não foi possível enviar o logo: ${error.message}`);
        pdf_logo_path = caminho;
      }
      // Alíquota igual à da prefeitura fica nula: assim, se a prefeitura mudar, o orçamento acompanha.
      const itbi_percentual = outra || daPrefeitura === undefined || Math.abs(pct / 100 - daPrefeitura) > 1e-9 ? pct : null;
      const { error } = await supabase.from('profiles').update({
        uf, municipio_padrao: municipio, cidade_nome: outra ? cidade.trim() : null, itbi_percentual,
        pdf_header: cabecalho.trim() || null, cor_primaria: cor === COR_MARCA ? null : cor, pdf_logo_path,
        formato_orcamento: formato,
        custos_padrao: Object.fromEntries((Object.keys(custos) as GrupoCustos[]).map((g) => [g, { certidoes: custos[g].certidoes / 100, honorarios: custos[g].honorarios / 100 }])),
        configurado_em: perfil.configurado_em ?? new Date().toISOString(),
      }).eq('id', perfil.id);
      if (error) throw new Error(error.message);
      if (perfil.pdf_logo_path && perfil.pdf_logo_path !== pdf_logo_path) {
        await supabase.storage.from('logos').remove([perfil.pdf_logo_path]);
      }
      setLogoArquivo(null);
      await recarregar();
      setAviso({ tom: 'verde', texto: 'Configuração salva.' });
      aoSalvar?.();
    } catch (e) {
      setAviso({ tom: 'vermelho', texto: e instanceof Error ? e.message : String(e) });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Onde você atua */}
      <fieldset className="flex flex-col gap-3">
        <legend className="rotulo-secao mb-3">Onde você atua</legend>
        <label className="flex flex-col gap-1.5 font-semibold">
          Estado
          <select value={uf} onChange={(e) => { setUf(e.target.value); setAviso(null); }}
            className="h-12 rounded-[10px] border border-borda bg-white px-3 font-semibold outline-none focus:border-acao focus:ring-2 focus:ring-acao/20">
            {UFS.map((u) => <option key={u} value={u}>{u}{UFS_ATENDIDAS.has(u) ? '' : ' · em breve'}</option>)}
          </select>
        </label>
        {!ufAtendida ? (
          <Aviso tom="azul">
            <span className="flex flex-col items-start gap-2">
              Ainda não temos a tabela de cartório de {uf}. Hoje o {MARCA} atende Minas Gerais.
              <button type="button" onClick={avisarEstado} className="min-h-11 font-bold text-acao underline">Quero ser avisado quando {uf} abrir</button>
            </span>
          </Aviso>
        ) : (
          <>
            <div role="radiogroup" aria-label="Cidade onde você atua" className="grid gap-2 sm:grid-cols-2">
              {[...Object.values(MUNICIPIOS).map((m) => ({ id: m.id, nome: m.nome, nota: 'Regra da prefeitura cadastrada' })), { id: MUNICIPIO_OUTRA, nome: 'Outra cidade de MG', nota: 'Você informa a alíquota do ITBI' }].map((m) => (
                <button key={m.id} type="button" role="radio" aria-checked={municipio === m.id}
                  onClick={() => { setMunicipio(m.id); const a = MUNICIPIOS[m.id]?.itbi.aliquota; if (a !== undefined) setAliquota(String(a * 100).replace('.', ',')); }}
                  className={cn('flex flex-col rounded-xl border-2 bg-white p-3 text-left', municipio === m.id ? 'border-acao' : 'border-linha')}>
                  <span className="font-bold">{m.nome}</span>
                  <span className="text-xs text-suave">{m.nota}</span>
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {outra && <Campo rotulo="Nome da cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Barbacena" maxLength={80} />}
              <Campo rotulo="Alíquota do ITBI (%)" inputMode="decimal" value={aliquota} onChange={(e) => setAliquota(e.target.value.replace(/[^\d,.]/g, ''))}
                placeholder="Ex.: 2" aria-invalid={!pctValido}
                dica={outra ? 'Confira com a prefeitura. Vale para os seus cálculos de escritura e financiamento.'
                  : `Prefeitura: ${String((daPrefeitura ?? 0) * 100).replace('.', ',')}%. Mude só se a sua cidade tiver outra alíquota para o seu caso.`} />
            </div>
            <p className="rounded-xl bg-nevoa px-4 py-3 text-sm text-texto">
              Nos seus orçamentos: ITBI de <strong className="text-tinta">{pctValido ? `${String(pct).replace('.', ',')}%` : '—'}</strong>
              {' '}({outra ? (cidade.trim() || 'sua cidade') : MUNICIPIOS[municipio]?.nome}) e emolumentos de cartório pela <strong className="text-tinta">tabela de {uf} de {new Date().getFullYear()}</strong>.
            </p>
          </>
        )}
      </fieldset>

      {/* Certidões e honorários */}
      <fieldset className="flex flex-col gap-3">
        <legend className="rotulo-secao mb-1">Certidões e honorários</legend>
        <p className="text-sm text-suave">Valores que entram em todo orçamento. Na hora de calcular, dá para trocar e voltar a eles com um toque; no WhatsApp, escreva por exemplo <strong className="text-tinta">honorarios 900</strong>.</p>
        {(Object.keys(ROTULO_GRUPO) as GrupoCustos[]).map((g) => (
          <div key={g} className="flex flex-col gap-2">
            <span className="font-bold">{ROTULO_GRUPO[g]}</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <CampoMoeda rotulo="Certidões" centavos={custos[g].certidoes} onChange={(c) => setCustos((v) => ({ ...v, [g]: { ...v[g], certidoes: c } }))} />
              <CampoMoeda rotulo="Honorários" centavos={custos[g].honorarios} onChange={(c) => setCustos((v) => ({ ...v, [g]: { ...v[g], honorarios: c } }))} />
            </div>
          </div>
        ))}
      </fieldset>

      {/* Marca no orçamento */}
      <fieldset className="flex flex-col gap-3">
        <legend className="rotulo-secao mb-3">Sua marca no orçamento</legend>
        <Campo rotulo="Nome no topo do orçamento" value={cabecalho} onChange={(e) => setCabecalho(e.target.value)} placeholder="Ex.: Silva Moura Assessoria" maxLength={60} />
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-20 w-44 items-center justify-center overflow-hidden rounded-xl border border-dashed border-borda bg-nevoa">
            {logoUrl && !removerLogo ? <img src={logoUrl} alt="Seu logo" className="max-h-16 max-w-40 object-contain" /> : <span className="text-xs text-suave">Sem logo</span>}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={idLogo} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-[1.5px] border-borda bg-white px-4 font-bold hover:border-tinta">
              <ImagePlus className="size-5" aria-hidden="true" />{logoUrl && !removerLogo ? 'Trocar logo' : 'Enviar logo'}
            </label>
            <input id={idLogo} type="file" accept={LOGO_TIPOS.join(',')} className="sr-only" onChange={escolherLogo} />
            {logoUrl && !removerLogo && (
              <button type="button" onClick={() => { setRemoverLogo(true); setLogoArquivo(null); }} className="inline-flex min-h-9 items-center gap-1.5 text-sm font-bold text-minas-texto">
                <Trash2 className="size-4" aria-hidden="true" />Remover
              </button>
            )}
          </div>
          <span className="basis-full text-xs text-suave">PNG, JPG ou WEBP até 2 MB. Fundo transparente fica melhor.</span>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-semibold">Cor do orçamento</span>
          <div className="flex flex-wrap items-center gap-2">
            {CORES.map((c) => (
              <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={cor.toUpperCase() === c}
                onClick={() => setCor(c)} className={cn('size-11 rounded-full border-4', cor.toUpperCase() === c ? 'border-tinta' : 'border-white shadow-[0_0_0_1px_#d5dae2]')} style={{ background: c }} />
            ))}
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-linha bg-white px-3 text-sm font-bold">
              <input type="color" value={cor} onChange={(e) => setCor(e.target.value.toUpperCase())} className="size-6 cursor-pointer border-0 bg-transparent p-0" />
              Outra
            </label>
          </div>
        </div>
        <Aviso tom="azul">Logo e cor aparecem no teste de 3 dias e no plano Pró. No Essencial, o orçamento sai com a marca {MARCA}, e o que você configurar aqui fica guardado.</Aviso>
      </fieldset>

      {/* Formato */}
      <fieldset className="flex flex-col gap-3">
        <legend className="rotulo-secao mb-3">Formato do orçamento</legend>
        <div role="radiogroup" aria-label="Formato" className="grid gap-2 sm:grid-cols-2">
          {([['pdf', 'PDF', 'Para e-mail, impressão e arquivo', FileText], ['jpeg', 'Imagem (JPEG)', 'Abre direto na conversa do WhatsApp', FileImage]] as const).map(([v, nome, nota, Icone]) => (
            <button key={v} type="button" role="radio" aria-checked={formato === v} onClick={() => setFormato(v)}
              className={cn('flex items-start gap-3 rounded-xl border-2 bg-white p-3 text-left', formato === v ? 'border-acao' : 'border-linha')}>
              <Icone className={cn('mt-0.5 size-6 shrink-0', formato === v ? 'text-acao' : 'text-suave')} aria-hidden="true" />
              <span className="flex flex-col"><span className="font-bold">{nome}</span><span className="text-xs text-suave">{nota}</span></span>
            </button>
          ))}
        </div>
        <span className="text-xs text-suave">Você pode pedir o outro formato a qualquer momento, no site ou para o agente.</span>
      </fieldset>

      <Previa cabecalho={cabecalho || MARCA} cor={cor} logoUrl={removerLogo ? null : logoUrl} formato={formato}
        cidade={outra ? (cidade || 'Sua cidade') : MUNICIPIOS[municipio]?.nome ?? ''} aliquota={pctValido ? pct : 0} />

      {aviso && <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>}
      <Botao onClick={salvar} disabled={ocupado || !podeSalvar} className="min-h-[52px] text-base">{ocupado ? 'Salvando…' : textoSalvar}</Botao>
    </div>
  );
}

const paraCentavos = (c: CustosPadrao) => ({
  escritura: { certidoes: Math.round(c.escritura.certidoes * 100), honorarios: Math.round(c.escritura.honorarios * 100) },
  financiamento: { certidoes: Math.round(c.financiamento.certidoes * 100), honorarios: Math.round(c.financiamento.honorarios * 100) },
});

/** Prévia do topo e do total do orçamento com a marca escolhida. */
function Previa({ cabecalho, cor, logoUrl, formato, cidade, aliquota }: { cabecalho: string; cor: string; logoUrl: string | null; formato: Formato; cidade: string; aliquota: number }) {
  const base = 350000; // mesmo exemplo da landing: escritura de R$ 350 mil (demais custos: R$ 12.044,99)
  const itbi = base * aliquota / 100;
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-xs font-bold uppercase tracking-[0.08em] text-suave">Prévia · {formato === 'pdf' ? 'PDF' : 'Imagem'}</figcaption>
      <div className={cn('flex flex-col gap-3 rounded-2xl border border-linha bg-white p-5 shadow-sm', formato === 'jpeg' && 'max-w-[340px]')}>
        {logoUrl && <img src={logoUrl} alt="" className="max-h-12 max-w-48 self-start object-contain" />}
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-extrabold">{cabecalho}</span>
          <span className="shrink-0 text-xs text-suave">Orçamento #0001</span>
        </div>
        <span className="h-1 rounded-full" style={{ background: cor }} />
        <span className="font-bold">Escritura · {cidade}</span>
        <span className="flex justify-between text-sm"><span>ITBI {String(aliquota).replace('.', ',')}%</span><span className="numero font-bold">{brl(itbi)}</span></span>
        <span className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: `color-mix(in srgb, ${cor} 20%, white)` }}>
          <span className="font-bold">Total estimado</span><span className="numero text-lg font-black">{brl(itbi + 12044.99)}</span>
        </span>
      </div>
    </figure>
  );
}

