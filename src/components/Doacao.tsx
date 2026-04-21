import React, { useState, useEffect, useCallback } from 'react';
import { 
  Handshake, 
  Calculator, 
  Share2, 
  FileDown, 
  RefreshCw,
  Info,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';
import { getNotaryFee } from '@/data/notaryFees';
import { cn } from '@/lib/utils';
import { generateClementePDF } from '@/lib/pdfGenerator';

// Constantes Fixas
const PRECO_FOLHA = 13.91;
const REGISTRO_BASE = 335.52;
const REGISTRO_REDUZIDO = 168.26;
const LIMITE_ITCD_25 = 440000.00;
const CERTIDOES_PADRAO = 400.00;
const HONORARIOS_PADRAO = 700.00;

type Subtype = 'Doação Simples' | 'Doação c/ Usufruto' | 'Renúncia de Usufruto';

interface CalculationResult {
  base: number | number[];
  itcd: number;
  lavratura: number | number[];
  arquivamento: number;
  registro: number | number[];
  certidões: number;
  honorários: number;
  total: number;
}

export function Doacao() {
  const [subtype, setSubtype] = useState<Subtype>('Doação Simples');
  const [inputs, setInputs] = useState({
    valorAtribuido: '',
    avaliacaoFazenda: '',
    folhas: '25',
    certidões: CERTIDOES_PADRAO.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    honorários: HONORARIOS_PADRAO.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
  });

  const [result, setResult] = useState<CalculationResult | null>(null);

  // Limpar campos ao trocar subtipo
  useEffect(() => {
    setInputs({
      valorAtribuido: '',
      avaliacaoFazenda: '',
      folhas: '25',
      certidões: CERTIDOES_PADRAO.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      honorários: HONORARIOS_PADRAO.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    });
    setResult(null);
  }, [subtype]);

  const parseCurrency = (val: string) => {
    if (!val) return 0;
    return Number(val.replace(/\D/g, '')) / 100;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleInputChange = (name: string, value: string) => {
    if (name === 'folhas') {
      setInputs(prev => ({ ...prev, [name]: value.replace(/\D/g, '') }));
      return;
    }

    const numericValue = value.replace(/\D/g, '');
    if (numericValue === '') {
      setInputs(prev => ({ ...prev, [name]: '' }));
      return;
    }
    
    const formatted = (Number(numericValue) / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
    });
    setInputs(prev => ({ ...prev, [name]: formatted }));
  };

  const calculate = useCallback(() => {
    const atrib = parseCurrency(inputs.valorAtribuido);
    const fazenda = parseCurrency(inputs.avaliacaoFazenda);
    const folhas = Number(inputs.folhas) || 0;
    const certidões = parseCurrency(inputs.certidões);
    const honorários = parseCurrency(inputs.honorários);
    const arquivamento = folhas * PRECO_FOLHA;

    let res: CalculationResult | null = null;

    if (subtype === 'Doação Simples') {
      const base = Math.max(atrib, fazenda);
      const itcd = base <= LIMITE_ITCD_25 ? base * 0.025 : base * 0.05;
      const lavratura = getNotaryFee(base);
      const registro = lavratura + REGISTRO_BASE;
      const total = itcd + lavratura + arquivamento + registro + certidões + honorários;
      res = { base, itcd, lavratura, arquivamento, registro, certidões, honorários, total };
    } else if (subtype === 'Doação c/ Usufruto') {
      const baseD = Math.max(atrib, fazenda);
      const baseU = baseD / 3;
      const itcd = baseD * 0.05;
      const lavD = getNotaryFee(baseD);
      const lavU = getNotaryFee(baseU);
      const regD = lavD + REGISTRO_BASE;
      const regU = lavU + REGISTRO_REDUZIDO;
      const total = itcd + lavD + lavU + arquivamento + regD + regU + certidões + honorários;
      res = { base: [baseD, baseU], itcd, lavratura: [lavD, lavU], arquivamento, registro: [regD, regU], certidões, honorários, total };
    } else if (subtype === 'Renúncia de Usufruto') {
      const base = Math.max(atrib, fazenda);
      const itcd = 0;
      const lavratura = getNotaryFee(base);
      const registro = 500.00;
      const total = lavratura + arquivamento + registro + certidões + honorários;
      res = { base, itcd, lavratura, arquivamento, registro, certidões, honorários, total };
    }

    setResult(res);
  }, [inputs, subtype]);

  const copyToWhatsApp = () => {
    if (!result) return;

    const sum = (val: number | number[]) => Array.isArray(val) ? val.reduce((a, b) => a + b, 0) : val;

    const text = `🤝 *ORÇAMENTO — DOAÇÃO*
Tipo: ${subtype}

Base de Cálculo: ${Array.isArray(result.base) ? result.base.map(formatCurrency).join(' + ') : formatCurrency(result.base)}
ITCD: ${formatCurrency(result.itcd)}
Lavratura: ${formatCurrency(sum(result.lavratura))}
Arquivamento: ${formatCurrency(result.arquivamento)}
Registro: ${formatCurrency(sum(result.registro))}
Certidões: ${formatCurrency(result.certidões)}
Honorários: ${formatCurrency(result.honorários)}

*TOTAL ESTIMADO: ${formatCurrency(result.total)}*

_Valores estimados. Sujeitos a alteração._`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const generatePDF = () => {
    if (!result) return;

    const sum = (val: number | number[]) => Array.isArray(val) ? val.reduce((a, b) => a + b, 0) : val;

    const itens = [
      { label: 'ITCD', valor: result.itcd },
    ];

    if (Array.isArray(result.lavratura)) {
      itens.push({ label: 'Lavratura Doação', valor: result.lavratura[0] });
      itens.push({ label: 'Lavratura Usufruto', valor: result.lavratura[1] });
    } else {
      itens.push({ label: 'Lavratura', valor: result.lavratura });
    }

    itens.push({ label: 'Arquivamento', valor: result.arquivamento });

    if (Array.isArray(result.registro)) {
      itens.push({ label: 'Registro Doação', valor: result.registro[0] });
      itens.push({ label: 'Registro Usufruto', valor: result.registro[1] });
    } else {
      itens.push({ label: 'Registro', valor: result.registro });
    }

    itens.push({ label: 'Certidões', valor: result.certidões });
    itens.push({ label: 'Honorários', valor: result.honorários });

    generateClementePDF({
      subtipo: `Doação - ${subtype}`,
      base: Array.isArray(result.base) ? result.base[0] : result.base,
      itens,
      total: result.total,
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center">
            <Handshake className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <h2 className="text-3xl font-serif text-white">Doação</h2>
        </div>
        <p className="text-white/60">Simule os custos para doações, com ou sem usufruto.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-xs text-white/40 uppercase tracking-widest font-bold">Subtipo</label>
              <select 
                value={subtype}
                onChange={(e) => setSubtype(e.target.value as Subtype)}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#D4AF37] outline-none transition-all appearance-none"
              >
                {['Doação Simples', 'Doação c/ Usufruto', 'Renúncia de Usufruto'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/60">Valor Atribuído</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">R$</span>
                  <input
                    type="text"
                    value={inputs.valorAtribuido}
                    onChange={(e) => handleInputChange('valorAtribuido', e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-[#D4AF37] outline-none transition-all"
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/60">Avaliação Fazenda (ITCD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">R$</span>
                  <input
                    type="text"
                    value={inputs.avaliacaoFazenda}
                    onChange={(e) => handleInputChange('avaliacaoFazenda', e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-[#D4AF37] outline-none transition-all"
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/60">Nº de Folhas</label>
                <input
                  type="text"
                  value={inputs.folhas}
                  onChange={(e) => handleInputChange('folhas', e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#D4AF37] outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/60">Certidões</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">R$</span>
                  <input
                    type="text"
                    value={inputs.certidões}
                    onChange={(e) => handleInputChange('certidões', e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-[#D4AF37] outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/60">Honorários</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">R$</span>
                  <input
                    type="text"
                    value={inputs.honorários}
                    onChange={(e) => handleInputChange('honorários', e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-[#D4AF37] outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={calculate}
              className="w-full bg-[#D4AF37] text-black font-bold py-4 rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-[#D4AF37]/20"
            >
              <Calculator className="w-5 h-5" />
              Calcular Orçamento
            </button>
          </div>
        </div>

        <div className="lg:sticky lg:top-8 h-fit">
          {result ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-br from-[#1a1f2e] to-[#0A0E1A] border border-[#D4AF37]/30 rounded-3xl p-8 shadow-2xl shadow-[#D4AF37]/5 space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-[#D4AF37]" />
                  <h3 className="text-2xl font-serif text-white">Orçamento</h3>
                </div>
                <span className="text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-1 rounded-full uppercase tracking-widest font-bold">
                  {subtype}
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-white/40 text-sm">Base de Cálculo</span>
                  <span className="text-white font-medium">
                    {Array.isArray(result.base) ? result.base.map(formatCurrency).join(' + ') : formatCurrency(result.base)}
                  </span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-white/40 text-sm">ITCD</span>
                  <span className="text-white font-medium">{formatCurrency(result.itcd)}</span>
                </div>
                
                {Array.isArray(result.lavratura) ? (
                  <>
                    <div className="flex justify-between items-end border-b border-white/5 pb-2">
                      <span className="text-white/40 text-sm">Lavratura Doação</span>
                      <span className="text-white font-medium">{formatCurrency(result.lavratura[0])}</span>
                    </div>
                    <div className="flex justify-between items-end border-b border-white/5 pb-2">
                      <span className="text-white/40 text-sm">Lavratura Usufruto</span>
                      <span className="text-white font-medium">{formatCurrency(result.lavratura[1])}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <span className="text-white/40 text-sm">Lavratura</span>
                    <span className="text-white font-medium">{formatCurrency(result.lavratura)}</span>
                  </div>
                )}

                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-white/40 text-sm">Arquivamento</span>
                  <span className="text-white font-medium">{formatCurrency(result.arquivamento)}</span>
                </div>

                {Array.isArray(result.registro) ? (
                  <>
                    <div className="flex justify-between items-end border-b border-white/5 pb-2">
                      <span className="text-white/40 text-sm">Registro Doação</span>
                      <span className="text-white font-medium">{formatCurrency(result.registro[0])}</span>
                    </div>
                    <div className="flex justify-between items-end border-b border-white/5 pb-2">
                      <span className="text-white/40 text-sm">Registro Usufruto</span>
                      <span className="text-white font-medium">{formatCurrency(result.registro[1])}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-end border-b border-white/5 pb-2">
                    <span className="text-white/40 text-sm">Registro</span>
                    <span className="text-white font-medium">{formatCurrency(result.registro)}</span>
                  </div>
                )}

                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-white/40 text-sm">Certidões</span>
                  <span className="text-white font-medium">{formatCurrency(result.certidões)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-white/40 text-sm">Honorários</span>
                  <span className="text-white font-medium">{formatCurrency(result.honorários)}</span>
                </div>

                <div className="pt-6">
                  <label className="text-xs text-[#D4AF37] uppercase tracking-[0.2em] font-bold block mb-1">Total Estimado</label>
                  <div className="text-5xl font-serif font-bold bg-gradient-to-r from-[#D4AF37] to-[#AA8A2E] bg-clip-text text-transparent">
                    {formatCurrency(result.total)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={generatePDF}
                    className="py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    <FileDown className="w-4 h-4" />
                    Gerar PDF
                  </button>
                  <button 
                    onClick={copyToWhatsApp}
                    className="py-3 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    WhatsApp
                  </button>
                </div>
                <button 
                  onClick={() => setResult(null)}
                  className="w-full py-3 rounded-xl text-white/40 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Nova Análise
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="h-full min-h-[400px] border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                <Calculator className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <p className="text-white/60 font-medium">Aguardando cálculo</p>
                <p className="text-white/20 text-sm max-w-xs">Preencha os dados à esquerda para visualizar o orçamento detalhado.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
