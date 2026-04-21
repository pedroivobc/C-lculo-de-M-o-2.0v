import React, { useState, useEffect, useCallback } from 'react';
import { 
  Home, 
  Calculator, 
  Share2, 
  FileDown, 
  Import,
  RefreshCw,
  Info,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { getNotaryFee } from '@/data/notaryFees';
import { cn } from '@/lib/utils';
import { generateClementePDF } from '@/lib/pdfGenerator';
import { calcularITBI_SFH } from '@/lib/calculations';

// Constantes Fixas
const PRENOTACAO = 66.67;
const ADICIONAL_REGISTRO = 247.48;
const CERTIDOES_PADRAO = 260.07;

type Modalidade = 'SBPE' | 'MCMV' | 'SFI' | 'EGI' | 'FGTS Total';

interface CalculationResult {
  base: number;
  taxaCaixa: number;
  itbi: number;
  prenotacao: number;
  registro: number;
  certidões: number;
  honorários: number;
  total: number;
}

export function FinanciamentoCaixa() {
  const [modalidade, setModalidade] = useState<Modalidade>('SBPE');
  const [isFirstProperty, setIsFirstProperty] = useState(false);
  const [inputs, setInputs] = useState({
    valorVenalCorrigido: '',
    valorDeclaradoCompra: '',
    valorFinanciamento: '',
    certidões: CERTIDOES_PADRAO.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    honorários: '700,00',
    taxaCaixaPercent: '1,50',
  });

  const [result, setResult] = useState<CalculationResult | null>(null);

  // Atualizar honorários padrão ao trocar modalidade
  useEffect(() => {
    const padrao = modalidade === 'FGTS Total' ? '1.200,00' : '700,00';
    setInputs(prev => ({ ...prev, honorários: padrao, taxaCaixaPercent: '1,50' }));
    setResult(null);
  }, [modalidade]);

  const parseCurrency = (val: string) => {
    if (!val) return 0;
    return Number(val.replace(/\D/g, '')) / 100;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleInputChange = (name: string, value: string) => {
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

  const importValorVenal = () => {
    const stored = localStorage.getItem('ultimoValorVenal');
    if (stored) {
      const { valor } = JSON.parse(stored);
      const formatted = valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      setInputs(prev => ({ ...prev, valorVenalCorrigido: formatted }));
    } else {
      alert("Nenhum valor venal encontrado no histórico.");
    }
  };

  const calculate = useCallback(() => {
    const venal = parseCurrency(inputs.valorVenalCorrigido);
    const declarado = parseCurrency(inputs.valorDeclaradoCompra);
    const financiado = parseCurrency(inputs.valorFinanciamento);
    const certidões = parseCurrency(inputs.certidões);
    const honorários = parseCurrency(inputs.honorários);

    const base = Math.max(venal, declarado);
    
    // 1. Taxa Caixa
    let taxaCaixa = 0;
    const percent = parseCurrency(inputs.taxaCaixaPercent) / 100;

    if (modalidade === 'SBPE') taxaCaixa = 1800 + (financiado * percent);
    else if (modalidade === 'MCMV') taxaCaixa = 1000 + (financiado * percent);
    else if (modalidade === 'SFI' || modalidade === 'EGI') taxaCaixa = 1800 + (financiado * percent);
    else if (modalidade === 'FGTS Total') taxaCaixa = base <= 350000 ? 1600 : 3200;

    // 2. ITBI
    let itbi = 0;
    if (modalidade === 'SBPE' || modalidade === 'MCMV') {
      itbi = calcularITBI_SFH(base, financiado);
    } else if (modalidade === 'SFI' || modalidade === 'FGTS Total') {
      itbi = base * 0.02;
    } else if (modalidade === 'EGI') {
      itbi = 0;
    }

    // 3. Registro
    let registro = 0;
    const lavBase = getNotaryFee(base);
    const lavFinanc = getNotaryFee(financiado);

    if (modalidade === 'SBPE' || modalidade === 'MCMV') {
      if (isFirstProperty) {
        registro = ((lavBase + lavFinanc) / 2) + ADICIONAL_REGISTRO;
      } else {
        registro = lavBase + lavFinanc + ADICIONAL_REGISTRO;
      }
    } else if (modalidade === 'SFI') {
      registro = lavBase + lavFinanc + ADICIONAL_REGISTRO;
    } else if (modalidade === 'EGI') {
      registro = lavFinanc + ADICIONAL_REGISTRO;
    } else if (modalidade === 'FGTS Total') {
      registro = lavBase + ADICIONAL_REGISTRO;
    }

    const total = taxaCaixa + itbi + PRENOTACAO + registro + certidões + honorários;

    setResult({
      base,
      taxaCaixa,
      itbi,
      prenotacao: PRENOTACAO,
      registro,
      certidões,
      honorários,
      total
    });
  }, [inputs, modalidade, isFirstProperty]);

  // Cálculo em tempo real
  useEffect(() => {
    if (inputs.valorFinanciamento || inputs.valorDeclaradoCompra || inputs.valorVenalCorrigido) {
      calculate();
    }
  }, [calculate, inputs.valorFinanciamento, inputs.valorDeclaradoCompra, inputs.valorVenalCorrigido]);

  const copyToWhatsApp = () => {
    if (!result) return;

    const text = `🏠 *ORÇAMENTO — FINANCIAMENTO CAIXA*
Modalidade: ${modalidade}

Base de Cálculo: ${formatCurrency(result.base)}
Taxa Caixa: ${formatCurrency(result.taxaCaixa)}
ITBI: ${formatCurrency(result.itbi)}
Prenotação: ${formatCurrency(result.prenotacao)}
Registro: ${formatCurrency(result.registro)}
Certidões: ${formatCurrency(result.certidões)}
Honorários: ${formatCurrency(result.honorários)}

*TOTAL ESTIMADO: ${formatCurrency(result.total)}*

_Valores estimados. Sujeitos a alteração._`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const generatePDF = () => {
    if (!result) return;

    generateClementePDF({
      subtipo: `Financiamento Caixa - ${modalidade}`,
      base: result.base,
      financiamento: parseCurrency(inputs.valorFinanciamento),
      itens: [
        { label: 'Taxa Caixa', valor: result.taxaCaixa },
        { label: 'ITBI', valor: result.itbi },
        { label: 'Prenotação*', valor: result.prenotacao },
        { label: 'Registro*', valor: result.registro },
        { label: 'Certidões*', valor: result.certidões },
        { label: 'Honorários', valor: result.honorários },
      ],
      total: result.total
    });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 print:p-0">
      <header className="flex flex-col gap-2 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center">
            <Home className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <h2 className="text-3xl font-serif text-white">Financiamento Caixa</h2>
        </div>
        <p className="text-white/60">Simule os custos de taxas, impostos e registros para financiamentos habitacionais.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Coluna Esquerda - Formulário */}
        <div className="space-y-6 print:hidden">
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-white/40 uppercase tracking-widest font-bold">Modalidade</label>
                <select 
                  value={modalidade}
                  onChange={(e) => setModalidade(e.target.value as Modalidade)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#D4AF37] outline-none transition-all appearance-none"
                >
                  {['SBPE', 'MCMV', 'SFI', 'EGI', 'FGTS Total'].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {modalidade !== 'FGTS Total' && (
                <div className="space-y-2 p-4 bg-white/5 rounded-2xl border border-white/5">
                  <label className="text-xs text-white/40 uppercase tracking-widest font-bold">Taxa Caixa</label>
                  <div className="flex items-center gap-2 text-sm text-white/80">
                    <span>{modalidade === 'MCMV' ? 'R$ 1.000,00' : 'R$ 1.800,00'} +</span>
                    <div className="relative w-20">
                      <input
                        type="text"
                        value={inputs.taxaCaixaPercent}
                        onChange={(e) => handleInputChange('taxaCaixaPercent', e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg py-1 px-2 text-white text-center focus:border-[#D4AF37] outline-none transition-all"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40">%</span>
                    </div>
                    <span>do financiamento</span>
                  </div>
                </div>
              )}

              {(modalidade === 'SBPE' || modalidade === 'MCMV') && (
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <Info className="w-5 h-5 text-[#D4AF37]" />
                    <div>
                      <p className="text-sm font-medium text-white">1º Imóvel</p>
                      <p className="text-xs text-white/40">Desconto de 50% no registro</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsFirstProperty(!isFirstProperty)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      isFirstProperty ? "bg-[#D4AF37]" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                      isFirstProperty ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm text-white/60">Valor Venal Corrigido</label>
                  <button 
                    onClick={importValorVenal}
                    className="text-[10px] text-[#D4AF37] hover:underline flex items-center gap-1"
                  >
                    <Import className="w-3 h-3" />
                    Importar
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">R$</span>
                  <input
                    type="text"
                    value={inputs.valorVenalCorrigido}
                    onChange={(e) => handleInputChange('valorVenalCorrigido', e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-[#D4AF37] outline-none transition-all"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/60">Valor Declarado de Compra</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">R$</span>
                  <input
                    type="text"
                    value={inputs.valorDeclaradoCompra}
                    onChange={(e) => handleInputChange('valorDeclaradoCompra', e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-[#D4AF37] outline-none transition-all"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white/60">Valor do Financiamento</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">R$</span>
                  <input
                    type="text"
                    value={inputs.valorFinanciamento}
                    onChange={(e) => handleInputChange('valorFinanciamento', e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-[#D4AF37] outline-none transition-all"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
            </div>

            <button 
              onClick={calculate}
              className="w-full bg-[#D4AF37] text-black font-bold py-4 rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-2 mt-4 shadow-lg shadow-[#D4AF37]/20"
            >
              <Calculator className="w-5 h-5" />
              Calcular Custos
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
                  <h3 className="text-2xl font-serif text-white">Orçamento</h3>
                </div>
                <span className="text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-1 rounded-full uppercase tracking-widest font-bold">
                  {modalidade}
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-white/40 text-sm">Taxa Caixa</span>
                  <span className="text-white font-medium">{formatCurrency(result.taxaCaixa)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-white/40 text-sm">ITBI</span>
                  <span className="text-white font-medium">{formatCurrency(result.itbi)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-white/40 text-sm">Prenotação</span>
                  <span className="text-white font-medium">{formatCurrency(result.prenotacao)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-white/40 text-sm">Registro</span>
                  <span className="text-white font-medium">{formatCurrency(result.registro)}</span>
                </div>
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

              <div className="grid grid-cols-1 gap-3 pt-4 print:hidden">
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

              <div className="p-4 rounded-2xl bg-[#D4AF37]/5 border border-[#D4AF37]/10">
                <p className="text-[10px] text-white/40 leading-relaxed italic text-center">
                  * Valores estimados com base nas taxas vigentes da Caixa Econômica Federal e Cartórios de Registro de Imóveis.
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="h-full min-h-[400px] border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center p-12 text-center space-y-4 print:hidden">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                <Calculator className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <p className="text-white/60 font-medium">Aguardando cálculo</p>
                <p className="text-white/20 text-sm max-w-xs">Preencha os dados do financiamento para visualizar o orçamento detalhado.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View de Impressão */}
      <div className="hidden print:block text-black bg-white p-12 space-y-8 min-h-screen">
        <div className="flex justify-between items-start border-b-2 border-black pb-8">
          <div>
            <h1 className="text-4xl font-serif font-bold">Orçamento de Financiamento</h1>
            <p className="text-gray-500 uppercase tracking-widest text-sm mt-2">Cálculo na Mão - Assessoria Imobiliária</p>
          </div>
          <div className="text-right">
            <p className="font-bold">{new Date().toLocaleDateString('pt-BR')}</p>
            <p className="text-sm text-gray-500">Modalidade: {modalidade}</p>
          </div>
        </div>

        {result && (
          <div className="space-y-6">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-4 font-bold uppercase text-xs tracking-widest">Descrição</th>
                  <th className="py-4 font-bold uppercase text-xs tracking-widest text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-4 text-gray-600">Taxa Caixa</td>
                  <td className="py-4 text-right font-medium">{formatCurrency(result.taxaCaixa)}</td>
                </tr>
                <tr>
                  <td className="py-4 text-gray-600">ITBI</td>
                  <td className="py-4 text-right font-medium">{formatCurrency(result.itbi)}</td>
                </tr>
                <tr>
                  <td className="py-4 text-gray-600">Prenotação</td>
                  <td className="py-4 text-right font-medium">{formatCurrency(result.prenotacao)}</td>
                </tr>
                <tr>
                  <td className="py-4 text-gray-600">Registro</td>
                  <td className="py-4 text-right font-medium">{formatCurrency(result.registro)}</td>
                </tr>
                <tr>
                  <td className="py-4 text-gray-600">Certidões</td>
                  <td className="py-4 text-right font-medium">{formatCurrency(result.certidões)}</td>
                </tr>
                <tr>
                  <td className="py-4 text-gray-600">Honorários</td>
                  <td className="py-4 text-right font-medium">{formatCurrency(result.honorários)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black">
                  <td className="py-6 text-xl font-bold">TOTAL ESTIMADO</td>
                  <td className="py-6 text-right text-2xl font-bold">{formatCurrency(result.total)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="pt-12 border-t border-gray-100 space-y-4">
              <p className="text-sm text-gray-500 italic">
                * Este documento é uma estimativa de custos e não possui valor fiscal ou vinculativo. Os valores finais serão confirmados pelos órgãos competentes.
              </p>
              <div className="flex justify-between pt-12">
                <div className="w-64 border-t border-black pt-2 text-center text-xs uppercase tracking-widest text-gray-400">Assinatura do Responsável</div>
                <div className="w-64 border-t border-black pt-2 text-center text-xs uppercase tracking-widest text-gray-400">Assinatura do Cliente</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
