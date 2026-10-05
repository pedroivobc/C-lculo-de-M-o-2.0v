import React, { useState, useEffect, useCallback } from 'react';
import { Upload, FileText, Loader2, RefreshCw, Calculator, Info } from 'lucide-react';
import { extractDataFromPDF, ExtractedData } from '@/services/geminiService';
import { LAND_VALUES } from '@/data/landValues';
import { CONSTRUCTION_PRICES, COMMERCIALIZATION_FACTORS } from '@/data/factors';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { generateClementePDF } from '@/lib/pdfGenerator';
import { FileDown, Share2 } from 'lucide-react';

export function ValorVenal({ userId }: { userId?: string }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [data, setData] = useState<ExtractedData | null>(null);
  const [manualValues, setManualValues] = useState({
    valorM2TerrenoPJF: 0,
    valorM2EdificacaoPJF: 0,
    fator: 1.0,
  });
  const [results, setResults] = useState({
    areaTerrenoM2: 0,
    areaEdificacaoM2: 0,
    valorTerrenoCorrigido: 0,
    valorEdificacaoCorrigida: 0,
    valorVenalTotal: 0,
  });

  const calculate = useCallback(() => {
    if (!data) return;

    const areaTerrenoM2 = (data.terreno.valorVenal || 0) / (data.terreno.valorM2 || 1);
    const areaEdificacaoM2 = (data.edificacao.valorVenal || 0) / (data.edificacao.valorM2 || 1);

    const valorTerrenoCorrigido = areaTerrenoM2 * manualValues.valorM2TerrenoPJF;
    const valorEdificacaoCorrigida = areaEdificacaoM2 * manualValues.valorM2EdificacaoPJF;
    
    const valorVenalTotal = (valorTerrenoCorrigido + valorEdificacaoCorrigida) * manualValues.fator;

    setResults({
      areaTerrenoM2,
      areaEdificacaoM2,
      valorTerrenoCorrigido,
      valorEdificacaoCorrigida,
      valorVenalTotal,
    });

    // Save to Supabase if user is logged in
    if (userId) {
      // Formato da migração supabase/migrations/20261005000000_schema_inicial.sql
      supabase.from('calculations').insert({
        user_id: userId,
        tipo: 'valor_venal',
        subtipo: data.edificacao.tipo,
        municipio: 'mg-juiz-de-fora',
        origem: 'site',
        descricao: [data.endereco, data.inscricao].filter(Boolean).join(' · ') || null,
        entrada: { extracted: data, manual: manualValues },
        resultado: {
          areaTerrenoM2,
          areaEdificacaoM2,
          valorTerrenoCorrigido,
          valorEdificacaoCorrigida,
          valorVenalTotal
        },
        total: Math.round(valorVenalTotal * 100) / 100,
      }).then(({ error }) => {
        if (error) console.error('Error saving calculation:', error);
      });
    }

    // Save to localStorage
    localStorage.setItem('ultimoValorVenal', JSON.stringify({
      valor: valorVenalTotal,
      inscricao: data.inscricao,
      endereco: data.endereco,
      timestamp: Date.now()
    }));
  }, [data, manualValues, userId]);

  useEffect(() => {
    calculate();
  }, [calculate]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProgress(10);
    setProgressStage('Lendo arquivo PDF...');

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          setProgress(30);
          setProgressStage('Enviando para inteligência artificial...');
          
          const base64 = (event.target?.result as string).split(',')[1];
          
          // Simulate some progress while waiting for Gemini
          const progressInterval = setInterval(() => {
            setProgress(prev => {
              if (prev < 85) return prev + 2;
              return prev;
            });
          }, 500);

          const extracted = await extractDataFromPDF(base64);
          
          clearInterval(progressInterval);
          setProgress(90);
          setProgressStage('Processando valores e tabelas...');

          setData(extracted);

        // Initial manual values from tables
        const isotima = extracted.terreno.areaIsotima?.replace(/\s/g, '').toUpperCase() || "";
        // Padding RE5 -> RE005
        let normalizedIsotima = isotima;
        if (isotima.startsWith('RE') && isotima.length < 5) {
          const num = isotima.replace('RE', '');
          normalizedIsotima = `RE${num.padStart(3, '0')}`;
        } else if (isotima.startsWith('CS') && isotima.length < 5) {
          const num = isotima.replace('CS', '');
          normalizedIsotima = `CS${num.padStart(3, '0')}`;
        }

        const vM2Terreno = LAND_VALUES[normalizedIsotima] || extracted.terreno.valorM2 || 0;
        const vM2Edificacao = (extracted.edificacao.tipo && extracted.edificacao.padrao) 
          ? CONSTRUCTION_PRICES[extracted.edificacao.tipo]?.[extracted.edificacao.padrao] || 0
          : 0;
        
        const factor = (normalizedIsotima && extracted.edificacao.tipo)
          ? COMMERCIALIZATION_FACTORS[normalizedIsotima]?.[extracted.edificacao.tipo] || 1.0
          : 1.0;

          setManualValues({
            valorM2TerrenoPJF: vM2Terreno,
            valorM2EdificacaoPJF: vM2Edificacao,
            fator: factor,
          });

          setProgress(100);
          setTimeout(() => {
            setIsProcessing(false);
            setProgress(0);
          }, 500);
        } catch (error) {
          console.error(error);
          alert("Erro ao processar PDF. Verifique o console.");
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      alert("Erro ao ler arquivo.");
      setIsProcessing(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const generatePDF = () => {
    if (!data) return;

    generateClementePDF({
      subtipo: 'Cálculo de Valor Venal',
      base: results.valorVenalTotal,
      itens: [
        { label: 'Terreno Corrigido', valor: results.valorTerrenoCorrigido },
        { label: 'Edificação Corrigida', valor: results.valorEdificacaoCorrigida },
        { label: 'Fator de Comercialização', valor: manualValues.fator },
      ],
      total: results.valorVenalTotal
    });
  };

  const copyToWhatsApp = () => {
    if (!data) return;

    const text = `🏠 *CÁLCULO DE VALOR VENAL*
Endereço: ${data.endereco}
Inscrição: ${data.inscricao}

Terreno Corrigido: ${formatCurrency(results.valorTerrenoCorrigido)}
Edificação Corrigida: ${formatCurrency(results.valorEdificacaoCorrigida)}
Fator: ${manualValues.fator.toFixed(2)}

*VALOR VENAL TOTAL: ${formatCurrency(results.valorVenalTotal)}*

_Estimativa baseada em dados do IPTU._`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-2">
        <h2 className="text-3xl font-serif text-white">Cálculo de Valor Venal</h2>
        <p className="text-white/60">Faça o upload do espelho do IPTU para análise automática.</p>
      </header>

      {!data && !isProcessing && (
        <div className="relative group">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="border-2 border-dashed border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center bg-white/[0.02] group-hover:bg-white/[0.04] transition-all group-hover:border-[#D4AF37]/40">
            <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-[#D4AF37]" />
            </div>
            <p className="text-lg font-medium text-white mb-1">Clique ou arraste o PDF aqui</p>
            <p className="text-white/40 text-sm">Espelho de IPTU da Prefeitura de Juiz de Fora</p>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="border border-white/10 rounded-3xl p-12 flex flex-col items-center justify-center bg-white/[0.02] space-y-8">
          <div className="relative">
            <Loader2 className="w-16 h-16 text-[#D4AF37] animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
              {progress}%
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <p className="text-xl font-medium text-white">{progressStage}</p>
            <p className="text-white/40 text-sm max-w-md mx-auto">
              Nossa IA está analisando cada campo do seu IPTU para garantir a máxima precisão no cálculo.
            </p>
          </div>

          <div className="w-full max-w-md h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-[#D4AF37] to-[#AA8A2E] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="grid grid-cols-4 gap-4 w-full max-w-md">
            {[
              { label: 'Upload', min: 0 },
              { label: 'IA', min: 30 },
              { label: 'Extração', min: 60 },
              { label: 'Cálculo', min: 90 }
            ].map((step) => (
              <div key={step.label} className="flex flex-col items-center gap-2">
                <div className={cn(
                  "w-2 h-2 rounded-full transition-all duration-500",
                  progress >= step.min ? "bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.6)]" : "bg-white/10"
                )} />
                <span className={cn(
                  "text-[10px] uppercase tracking-tighter",
                  progress >= step.min ? "text-[#D4AF37]" : "text-white/20"
                )}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Extracted Data Card */}
          <div className="space-y-6">
            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <FileText className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="text-xl font-serif text-white">Dados Extraídos</h3>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Inscrição</label>
                    <p className="text-white font-medium">{data.inscricao || '---'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Área Isótima</label>
                    <p className="text-white font-medium">{data.terreno.areaIsotima || '---'}</p>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Endereço</label>
                  <p className="text-white font-medium">{data.endereco || '---'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Tipo</label>
                    <p className="text-white font-medium">{data.edificacao.tipo || '---'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 uppercase tracking-widest block mb-1">Padrão</label>
                    <p className="text-white font-medium">{data.edificacao.padrao || '---'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Manual Adjustments */}
            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <RefreshCw className="w-5 h-5 text-[#D4AF37]" />
                <h3 className="text-xl font-serif text-white">Ajustes de Referência</h3>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-sm text-white/60 block mb-2">Valor Ref. m² Terreno (PJF)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">R$</span>
                    <input
                      type="number"
                      value={manualValues.valorM2TerrenoPJF}
                      onChange={(e) => setManualValues(prev => ({ ...prev, valorM2TerrenoPJF: Number(e.target.value) }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-[#D4AF37] outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-white/60 block mb-2">Valor Ref. m² Edificação (PJF)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">R$</span>
                    <input
                      type="number"
                      value={manualValues.valorM2EdificacaoPJF}
                      onChange={(e) => setManualValues(prev => ({ ...prev, valorM2EdificacaoPJF: Number(e.target.value) }))}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-[#D4AF37] outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-white/60 block mb-2">Fator de Comercialização</label>
                  <input
                    type="number"
                    step="0.01"
                    value={manualValues.fator}
                    onChange={(e) => setManualValues(prev => ({ ...prev, fator: Number(e.target.value) }))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#D4AF37] outline-none transition-all"
                  />
                  <p className="text-[10px] text-white/30 mt-1 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Fator decimal (ex: 1.60). Não é percentual.
                  </p>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => setData(null)}
              className="w-full py-4 rounded-2xl border border-white/10 text-white/60 hover:bg-white/5 transition-all"
            >
              Novo Cálculo
            </button>
          </div>

          {/* Results Card */}
          <div className="lg:sticky lg:top-8 h-fit">
            <div className="bg-gradient-to-br from-[#1a1f2e] to-[#0A0E1A] border border-[#D4AF37]/30 rounded-3xl p-8 shadow-2xl shadow-[#D4AF37]/5">
              <div className="flex items-center gap-3 mb-8">
                <Calculator className="w-6 h-6 text-[#D4AF37]" />
                <h3 className="text-2xl font-serif text-white">Resultado do Cálculo</h3>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-end border-b border-white/5 pb-4">
                  <span className="text-white/60">Valor Venal Terreno Corrigido</span>
                  <span className="text-white font-medium">{formatCurrency(results.valorTerrenoCorrigido)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-4">
                  <span className="text-white/60">Valor Venal Edificação Corrigida</span>
                  <span className="text-white font-medium">{formatCurrency(results.valorEdificacaoCorrigida)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-4">
                  <span className="text-white/60">Fator de Comercialização</span>
                  <span className="text-white font-medium">{manualValues.fator.toFixed(2)}</span>
                </div>

                <div className="pt-8 mt-4">
                  <label className="text-xs text-[#D4AF37] uppercase tracking-[0.2em] font-bold block mb-2">Valor Venal Total</label>
                  <div className="text-4xl md:text-5xl font-serif font-bold bg-gradient-to-r from-[#D4AF37] to-[#AA8A2E] bg-clip-text text-transparent">
                    {formatCurrency(results.valorVenalTotal)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-8">
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

                <div className="mt-8 p-4 rounded-2xl bg-[#D4AF37]/5 border border-[#D4AF37]/10">
                  <p className="text-xs text-white/40 leading-relaxed italic">
                    * Este cálculo é uma estimativa baseada nos dados extraídos do IPTU e tabelas de referência da PJF.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
