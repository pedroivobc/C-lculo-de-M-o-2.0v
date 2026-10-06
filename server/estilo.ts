import { telefoneBonito } from '../src/lib/formato';
import { lerCustosPadrao, type CustosPadrao } from '../src/lib/calc';
import sharp from 'sharp';
import { config } from './config';
import { supabaseAdmin } from './supabase';

export type Formato = 'pdf' | 'jpeg';

/** Como o orçamento do assinante sai: cabeçalho, cor, logo e formato. */
export interface Estilo {
  cabecalho: string;
  /** Cor principal em hex (#RRGGBB). Sem personalização, é o azul da marca. */
  cor: string;
  /** Logo já normalizado em PNG (até 600×240). */
  logoPng?: Buffer;
  formato: Formato;
  /** true quando logo e cor do assinante aparecem (pro, trial e admin). */
  personalizado: boolean;
  /** Nome, WhatsApp e e-mail do assinante no orçamento (só quando personalizado). */
  contato?: { nome?: string; whatsapp?: string; email?: string };
}

export const COR_MARCA = '#2342D6';

/** Localidade padrão do assinante, aplicada aos cálculos quando a pessoa não informa outra. */
export interface Localidade {
  municipio: string;
  cidade?: string;
  itbiPercentual?: number;
}

export interface Configuracao {
  estilo: Estilo;
  localidade: Localidade;
  /** Certidões e honorários padrão do assinante (null = ainda não definiu; valem os sugeridos). */
  custos: CustosPadrao | null;
}

const LOGO_CACHE = new Map<string, { em: number; png: Buffer }>();

async function baixarLogo(caminho: string): Promise<Buffer | undefined> {
  const cache = LOGO_CACHE.get(caminho);
  if (cache && Date.now() - cache.em < 10 * 60_000) return cache.png;
  const { data, error } = await supabaseAdmin().storage.from('logos').download(caminho);
  if (error || !data) return undefined;
  const png = await sharp(Buffer.from(await data.arrayBuffer()))
    .resize({ width: 600, height: 240, fit: 'inside', withoutEnlargement: true })
    .png().toBuffer();
  LOGO_CACHE.set(caminho, { em: Date.now(), png });
  return png;
}

/** Lê do perfil a configuração do orçamento e aplica a regra do plano (situacao_acesso.personaliza_orcamento). */
export async function configuracaoDoUsuario(userId: string): Promise<Configuracao> {
  const db = supabaseAdmin();
  const [{ data: p }, { data: s }] = await Promise.all([
    db.from('profiles')
      .select('pdf_header, pdf_logo_path, cor_primaria, formato_orcamento, municipio_padrao, cidade_nome, itbi_percentual, custos_padrao, full_name, email, whatsapp_e164, whatsapp_verified_at')
      .eq('id', userId).maybeSingle(),
    db.rpc('situacao_acesso', { uid: userId }).maybeSingle<{ personaliza_orcamento: boolean }>(),
  ]);
  const personalizado = !!s?.personaliza_orcamento;
  const logoPng = personalizado && p?.pdf_logo_path ? await baixarLogo(p.pdf_logo_path).catch(() => undefined) : undefined;
  return {
    estilo: {
      cabecalho: p?.pdf_header || config.marca,
      cor: personalizado && p?.cor_primaria ? p.cor_primaria : COR_MARCA,
      logoPng,
      formato: p?.formato_orcamento === 'jpeg' ? 'jpeg' : 'pdf',
      personalizado,
      contato: personalizado ? {
        nome: p?.full_name || undefined,
        whatsapp: p?.whatsapp_verified_at && p?.whatsapp_e164 ? telefoneBonito(p.whatsapp_e164) : undefined,
        email: p?.email || undefined,
      } : undefined,
    },
    localidade: {
      municipio: p?.municipio_padrao ?? 'mg-juiz-de-fora',
      cidade: p?.cidade_nome ?? undefined,
      itbiPercentual: p?.itbi_percentual != null ? Number(p.itbi_percentual) : undefined,
    },
    custos: lerCustosPadrao(p?.custos_padrao),
  };
}

/** Preenche a localidade do assinante nos dados de um cálculo, sem sobrescrever o que veio informado. */
export function comLocalidade<T extends Record<string, unknown>>(dados: T, l: Localidade): T {
  if (dados.municipio && dados.municipio !== l.municipio) return dados; // outra cidade cadastrada: regra da prefeitura
  return {
    municipio: l.municipio,
    ...(l.cidade ? { cidade: l.cidade } : {}),
    ...(l.itbiPercentual !== undefined ? { itbiPercentual: l.itbiPercentual } : {}),
    ...dados,
  };
}

export const hexParaRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Mistura a cor com branco (0 = cor, 1 = branco). Usado no fundo do total. */
export const clarear = (hex: string, t: number) =>
  hexParaRgb(hex).map((c) => Math.round(c + (255 - c) * t)) as [number, number, number];
