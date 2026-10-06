import React, { useState, useEffect } from 'react';
import { TrendingUp, Clock, FileText, ArrowRight } from 'lucide-react';

export function Dashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [lastCalc, setLastCalc] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem('ultimoValorVenal');
    if (saved) {
      setLastCalc(JSON.parse(saved));
    }
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-3xl font-serif text-white mb-2">Bem-vindo ao Orçaí Imob</h2>
        <p className="text-white/60">Sistema premium de assessoria imobiliária Juiz de Fora.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4">
            <TrendingUp className="w-6 h-6 text-blue-500" />
          </div>
          <h3 className="text-white font-medium mb-1">Mercado JF</h3>
          <p className="text-white/40 text-sm">Tabelas atualizadas conforme diretrizes da PJF 2026.</p>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4">
            <Clock className="w-6 h-6 text-purple-500" />
          </div>
          <h3 className="text-white font-medium mb-1">Agilidade</h3>
          <p className="text-white/40 text-sm">Extração de dados via IA em menos de 10 segundos.</p>
        </div>
        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
          <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/10 flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <h3 className="text-white font-medium mb-1">Precisão</h3>
          <p className="text-white/40 text-sm">Cálculos baseados em isótimas e fatores oficiais.</p>
        </div>
      </div>

      {lastCalc && (
        <div className="bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 rounded-3xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-serif text-white">Último Cálculo Realizado</h3>
            <span className="text-xs text-white/40 uppercase tracking-widest">
              {new Date(lastCalc.timestamp).toLocaleDateString('pt-BR')}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-white/40 text-sm mb-1">Endereço</p>
              <p className="text-white font-medium mb-4">{lastCalc.endereco || 'Não informado'}</p>
              
              <p className="text-white/40 text-sm mb-1">Inscrição</p>
              <p className="text-white font-medium">{lastCalc.inscricao || '---'}</p>
            </div>
            
            <div className="bg-black/40 rounded-2xl p-6 border border-white/5">
              <p className="text-[#D4AF37] text-xs uppercase tracking-widest font-bold mb-1">Valor Venal</p>
              <p className="text-3xl font-serif text-white">{formatCurrency(lastCalc.valor)}</p>
              
              <button 
                onClick={() => onNavigate('valor-venal')}
                className="mt-6 flex items-center gap-2 text-[#D4AF37] text-sm font-medium hover:gap-3 transition-all"
              >
                Ver detalhes <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button 
          onClick={() => onNavigate('valor-venal')}
          className="group relative overflow-hidden rounded-3xl bg-[#D4AF37] p-8 text-left transition-all hover:scale-[1.02]"
        >
          <div className="relative z-10">
            <h3 className="text-2xl font-serif text-black font-bold mb-2">Novo Cálculo</h3>
            <p className="text-black/60 text-sm max-w-[200px]">Inicie uma nova avaliação de valor venal agora.</p>
          </div>
          <FileText className="absolute -right-4 -bottom-4 w-32 h-32 text-black/5 group-hover:scale-110 transition-transform" />
        </button>
        
        <div className="rounded-3xl bg-white/[0.03] border border-white/10 p-8">
          <h3 className="text-xl font-serif text-white mb-4">Status do Sistema</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-sm">Conexão Gemini AI</span>
              <span className="flex items-center gap-2 text-green-500 text-xs font-medium">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Online
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-sm">Base de Dados PJF</span>
              <span className="text-white/40 text-xs">Atualizada 2026</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
