import React, { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  Calculator, 
  Share2, 
  FileDown, 
  RefreshCw,
  Info,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { generateClementePDF } from '@/lib/pdfGenerator';

const INDICES: Record<number, number> = {
  1997: 30.25, 1998: 31.92, 1999: 32.45, 2000: 35.14,
  2001: 37.45, 2002: 40.30, 2003: 44.71, 2004: 49.64,
  2005: 53.23, 2006: 56.54, 2007: 58.25, 2008: 60.69,
  2009: 64.57, 2010: 67.29, 2011: 71.08, 2012: 75.80,
  2013: 79.99, 2014: 84.61, 2015: 90.16, 2016: 99.61,
  2017: 106.57, 2018: 109.55, 2019: 113.99, 2020: 117.72,
  2021: 122.79, 2022: 135.98, 2023: 144.00, 2024: 150.74,
  2025: 157.40, 2026: 165.54
};

const ANO_BASE = 2026;
const INDICE_BASE = 165.54;

export function CorrecaoContratual() {
  const [valorCompra, setValorCompra] = useState('');
  const [anoContrato, setAnoContrato] = useState<number>(2026);
  const [result, setResult] = useState<{
    valorCompra: number;
    valorCorrigido: number;
    indiceAno: number;
    variacao: number;
  } | null>(null);

  const parseCurrency = (val: string) => {
    if (!val) return 0;
    return Number(val.replace(/\D/g, '')) / 100;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatPercent = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'percent', 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: 'always'
    }).format(val / 100);
  };

  const calculate = useCallback(() => {
    const valor = parseCurrency(valorCompra);
    if (valor <= 0) {
      setResult(null);
      return;
    }

    const indiceAno = INDICES[anoContrato];
    let valorCorrigido = valor;
    
    if (anoContrato !== ANO_BASE) {
      valorCorrigido = (valor / indiceAno) * INDICE_BASE;
    }

    const variacao = ((valorCorrigido - valor) / valor) * 100;

    setResult({
      valorCompra: valor,
      valorCorrigido,
      indiceAno,
      variacao
    });
  }, [valorCompra, anoContrato]);

  // Cálculo automático
  useEffect(() => {
    calculate();
  }, [calculate]);

  const handleInputChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    if (numericValue === '') {
      setValorCompra('');
      return;
    }
    
    const formatted = (Number(numericValue) / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
    });
    setValorCompra(formatted);
  };

  const copyToWhatsApp = () => {
    if (!result) return;

    const text = `📈 *CORREÇÃO CONTRATUAL — INCC*

Valor de Compra: ${formatCurrency(result.valorCompra)}
Ano do Contrato: ${anoContrato}
Índice do Ano: ${result.indiceAno.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Índice 2026: ${INDICE_BASE.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}

*VALOR CORRIGIDO: ${formatCurrency(result.valorCorrigido)}*
Variação: ${formatPercent(result.variacao)}

_Correção pelo INCC. Valores estimados._`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const generatePDF = () => {
    if (!result) return;

    generateClementePDF({
      subtipo: 'CORREÇÃO CONTRATUAL — INCC',
      base: result.valorCompra,
      itens: [
        { label: `Ano Contrato: ${anoContrato}`, valor: result.indiceAno },
        { label: `Ano Base: ${ANO_BASE}`, valor: INDICE_BASE },
        { label: 'Variação Percentual', valor: result.variacao }, // Note: pdfGenerator expects 'valor' as number, but it formats as currency. 
        // We might need to adjust pdfGenerator or pass formatted string if it allowed.
        // Looking at pdfGenerator.ts, it uses fmt(item.valor) which is currency.
        // I'll pass the values as they are, but maybe I should pass the variation as a "valor" that looks like a number if possible.
        // Actually, the requirement says "itens alternados, total em destaque dourado".
        // I'll pass the variation as a fake currency value or just pass the corrected value as total.
      ],
      total: result.valorCorrigido
    });
  };

  // Re-evaluating generatePDF because generateClementePDF formats all item values as currency.
  // I will pass the items as requested but the "valor" will be formatted as currency by the generator.
  // For variation, it might look weird as R$. 
  // Let's check pdfGenerator.ts again.
  
  const generatePDFFixed = () => {
    if (!result) return;

    generateClementePDF({
      subtipo: 'CORREÇÃO CONTRATUAL — INCC',
      base: result.valorCompra,
      itens: [
        { label: `Índice ${anoContrato}`, valor: result.indiceAno },
        { label: `Índice ${ANO_BASE}`, valor: INDICE_BASE },
        { label: 'Valor de Compra Original', valor: result.valorCompra },
      ],
      total: result.valorCorrigido
    });
  };

  const anos = Object.keys(INDICES).map(Number).sort((a, b) => b - a);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <h2 className="text-3xl font-serif text-white">Correção Contratual</h2>
        </div>
        <p className="text-white/60">Atualize valores de contratos antigos pelo índice INCC.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Coluna Esquerda - Formulário */}
        <div className="space-y-6">
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm text-white/60">Valor de Compra Original</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">R$</span>
                <input
                  type="text"
                  value={valorCompra}
                  onChange={(e) => handleInputChange(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-[#D4AF37] outline-none transition-all"
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/60">Ano do Contrato</label>
              <select 
                value={anoContrato}
                onChange={(e) => setAnoContrato(Number(e.target.value))}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#D4AF37] outline-none transition-all appearance-none"
              >
                {anos.map(ano => (
                  <option key={ano} value={ano}>{ano}</option>
                ))}
              </select>
            </div>

            {anoContrato === ANO_BASE && (
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                <p className="text-sm text-blue-200/80">
                  Contrato já está no ano base ({ANO_BASE}), nenhuma correção necessária.
                </p>
              </div>
            )}

            <button 
              onClick={calculate}
              className="w-full bg-[#D4AF37] text-black font-bold py-4 rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-[#D4AF37]/20"
            >
              <Calculator className="w-5 h-5" />
              Calcular Correção
            </button>
          </div>
        </div>

        {/* Coluna Direita - Resultado */}
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
                  <h3 className="text-2xl font-serif text-white">Resultado</h3>
                </div>
                <span className="text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-1 rounded-full uppercase tracking-widest font-bold">
                  INCC
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-white/40 text-sm">Valor de Compra</span>
                  <span className="text-white font-medium">{formatCurrency(result.valorCompra)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-white/40 text-sm">Índice {anoContrato}</span>
                  <span className="text-white font-medium">{result.indiceAno.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-white/40 text-sm">Índice {ANO_BASE}</span>
                  <span className="text-white font-medium">{INDICE_BASE.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-white/40 text-sm">Variação Percentual</span>
                  <span className={cn(
                    "font-medium",
                    result.variacao > 0 ? "text-green-400" : "text-white"
                  )}>
                    {formatPercent(result.variacao)}
                  </span>
                </div>

                <div className="pt-6">
                  <label className="text-xs text-[#D4AF37] uppercase tracking-[0.2em] font-bold block mb-1">Valor Corrigido</label>
                  <div className="text-5xl font-serif font-bold bg-gradient-to-r from-[#D4AF37] to-[#AA8A2E] bg-clip-text text-transparent">
                    {formatCurrency(result.valorCorrigido)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={generatePDFFixed}
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
                  onClick={() => {
                    setValorCompra('');
                    setAnoContrato(2026);
                    setResult(null);
                  }}
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
                <p className="text-white/60 font-medium">Aguardando dados</p>
                <p className="text-white/20 text-sm max-w-xs">Informe o valor de compra e o ano do contrato para calcular a correção.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
