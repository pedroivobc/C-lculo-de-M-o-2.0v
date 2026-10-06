import React, { useState, useEffect, useCallback } from 'react';
import { 
  PenTool, 
  Calculator, 
  Share2, 
  FileDown, 
  Plus, 
  Trash2, 
  Info, 
  Download,
  Import,
  RefreshCw,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';
import { getNotaryFee } from '@/data/notaryFees';
import { cn } from '@/lib/utils';
import { generateClementePDF } from '@/lib/pdfGenerator';

// Constantes Fixas
const PRECO_FOLHA = 13.91;
const REGISTRO_BASE = 496.74;
const REGISTRO_REDUZIDO = 248.37;
const LIMITE_ITCD_25 = 440000.00;
const CERTIDOES_PADRAO = 400.00;
const HONORARIOS_PADRAO = 700.00;

type Subtype = 
  | 'Compra e Venda Simples'
  | 'Com Interveniência'
  | 'Compra + Vínculo'
  | 'Doação Simples'
  | 'Doação c/ Usufruto'
  | 'Renúncia de Usufruto';

interface CalculationResult {
  base: number | number[];
  imposto: number | number[];
  impostoLabel: string;
  lavratura: number | number[];
  arquivamento: number;
  registro: number | number[];
  certidões: number;
  honorários: number;
  total: number;
}

export function Escrituras({ userId }: { userId?: string }) {
  const [subtype, setSubtype] = useState<Subtype>('Compra e Venda Simples');
  const [inputs, setInputs] = useState<Record<string, string>>({
    valorDeclarado: '',
    valorVenalCorrigido: '',
    valorDeclarado1: '',
    valorVenal1: '',
    valorDeclarado2: '',
    valorVenal2: '',
    valorDeclaradoCompra: '',
    valorVenalCompra: '',
    valorVinculo: '',
    valorAtribuido: '',
    avaliacaoFazenda: '',
    folhas: '25',
    certidões: CERTIDOES_PADRAO.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    honorários: HONORARIOS_PADRAO.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
  });

  const [result, setResult] = useState<CalculationResult | null>(null);

  // Limpar campos ao trocar subtipo
  useEffect(() => {
    setInputs(prev => ({
      ...prev,
      valorDeclarado: '',
      valorVenalCorrigido: '',
      valorDeclarado1: '',
      valorVenal1: '',
      valorDeclarado2: '',
      valorVenal2: '',
      valorDeclaradoCompra: '',
      valorVenalCompra: '',
      valorVinculo: '',
      valorAtribuido: '',
      avaliacaoFazenda: '',
      folhas: '25',
      certidões: CERTIDOES_PADRAO.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
      honorários: HONORARIOS_PADRAO.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    }));
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

  const importValorVenal = (field: string) => {
    const stored = localStorage.getItem('ultimoValorVenal');
    if (stored) {
      const { valor } = JSON.parse(stored);
      const formatted = valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      setInputs(prev => ({ ...prev, [field]: formatted }));
    } else {
      alert("Nenhum valor venal encontrado no histórico.");
    }
  };

  const calculate = () => {
    const folhas = Number(inputs.folhas) || 25;
    const certidões = parseCurrency(inputs.certidões) || 0;
    const honorários = parseCurrency(inputs.honorários) || 0;
    const arquivamento = folhas * PRECO_FOLHA;

    let res: CalculationResult | null = null;

    switch (subtype) {
      case 'Compra e Venda Simples': {
        const declarado = parseCurrency(inputs.valorDeclarado);
        const venal = parseCurrency(inputs.valorVenalCorrigido);
        const base = Math.max(declarado, venal);
        const itbi = base * 0.02;
        const lavratura = getNotaryFee(base);
        const registro = lavratura + REGISTRO_BASE;
        const total = itbi + lavratura + arquivamento + registro + certidões + honorários;
        res = { base, imposto: itbi, impostoLabel: 'ITBI (2%)', lavratura, arquivamento, registro, certidões, honorários, total };
        break;
      }
      case 'Com Interveniência': {
        const dec1 = parseCurrency(inputs.valorDeclarado1);
        const ven1 = parseCurrency(inputs.valorVenal1);
        const dec2 = parseCurrency(inputs.valorDeclarado2);
        const ven2 = parseCurrency(inputs.valorVenal2);
        const base1 = Math.max(dec1, ven1);
        const base2 = Math.max(dec2, ven2);
        const itbi1 = base1 * 0.02;
        const itbi2 = base2 * 0.02;
        const lav1 = getNotaryFee(base1);
        const lav2 = getNotaryFee(base2);
        const reg1 = lav1 + REGISTRO_BASE;
        const reg2 = lav2 + REGISTRO_REDUZIDO;
        const total = itbi1 + itbi2 + lav1 + lav2 + arquivamento + reg1 + reg2 + certidões + honorários;
        res = { 
          base: [base1, base2], 
          imposto: [itbi1, itbi2], 
          impostoLabel: 'ITBI (2% + 2%)', 
          lavratura: [lav1, lav2], 
          arquivamento, 
          registro: [reg1, reg2], 
          certidões, 
          honorários, 
          total 
        };
        break;
      }
      case 'Compra + Vínculo': {
        const decC = parseCurrency(inputs.valorDeclaradoCompra);
        const venC = parseCurrency(inputs.valorVenalCompra);
        const valV = parseCurrency(inputs.valorVinculo);
        const baseC = Math.max(decC, venC);
        const baseV = valV;
        const itbi = baseC * 0.02;
        const lavC = getNotaryFee(baseC);
        const lavV = getNotaryFee(baseV);
        const regC = lavC + REGISTRO_BASE;
        const regV = lavV + REGISTRO_REDUZIDO;
        const total = itbi + lavC + lavV + arquivamento + regC + regV + certidões + honorários;
        res = { 
          base: [baseC, baseV], 
          imposto: itbi, 
          impostoLabel: 'ITBI (2%)', 
          lavratura: [lavC, lavV], 
          arquivamento, 
          registro: [regC, regV], 
          certidões, 
          honorários, 
          total 
        };
        break;
      }
      case 'Doação Simples': {
        const atrib = parseCurrency(inputs.valorAtribuido);
        const fazenda = parseCurrency(inputs.avaliacaoFazenda);
        const base = Math.max(atrib, fazenda);
        const rate = base <= LIMITE_ITCD_25 ? 0.025 : 0.05;
        const itcd = base * rate;
        const lavratura = getNotaryFee(base);
        const registro = lavratura + REGISTRO_BASE;
        const total = itcd + lavratura + arquivamento + registro + certidões + honorários;
        res = { base, imposto: itcd, impostoLabel: `ITCD (${(rate * 100).toFixed(1)}%)`, lavratura, arquivamento, registro, certidões, honorários, total };
        break;
      }
      case 'Doação c/ Usufruto': {
        const atrib = parseCurrency(inputs.valorAtribuido);
        const fazenda = parseCurrency(inputs.avaliacaoFazenda);
        const baseD = Math.max(atrib, fazenda);
        const baseU = baseD / 3;
        const itcd = baseD * 0.05;
        const lavD = getNotaryFee(baseD);
        const lavU = getNotaryFee(baseU);
        const regD = lavD + REGISTRO_BASE;
        const regU = lavU + REGISTRO_REDUZIDO;
        const total = itcd + lavD + lavU + arquivamento + regD + regU + certidões + honorários;
        res = { 
          base: [baseD, baseU], 
          imposto: itcd, 
          impostoLabel: 'ITCD (5%)', 
          lavratura: [lavD, lavU], 
          arquivamento, 
          registro: [regD, regU], 
          certidões, 
          honorários, 
          total 
        };
        break;
      }
      case 'Renúncia de Usufruto': {
        const atrib = parseCurrency(inputs.valorAtribuido);
        const fazenda = parseCurrency(inputs.avaliacaoFazenda);
        const base = Math.max(atrib, fazenda);
        const lavratura = getNotaryFee(base);
        const registro = 500.00;
        const total = lavratura + arquivamento + registro + certidões + honorários;
        res = { base, imposto: 0, impostoLabel: 'Isento', lavratura, arquivamento, registro, certidões, honorários, total };
        break;
      }
    }

    setResult(res);
  };

  const copyToWhatsApp = () => {
    if (!result) return;

    const sum = (val: number | number[]) => Array.isArray(val) ? val.reduce((a, b) => a + b, 0) : val;

    const text = `📋 *ORÇAMENTO DE ESCRITURA*
Tipo: ${subtype}

Base de Cálculo: ${Array.isArray(result.base) ? result.base.map(formatCurrency).join(' + ') : formatCurrency(result.base)}
${result.impostoLabel}: ${formatCurrency(sum(result.imposto))}
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

    const tableData = [
      { item: result.impostoLabel, value: formatCurrency(sum(result.imposto)) },
      { item: 'Lavratura', value: Array.isArray(result.lavratura) ? result.lavratura.map(formatCurrency).join(' + ') : formatCurrency(result.lavratura as number) },
      { item: `Arquivamento (${inputs.folhas} folhas)`, value: formatCurrency(result.arquivamento) },
      { item: 'Registro', value: Array.isArray(result.registro) ? result.registro.map(formatCurrency).join(' + ') : formatCurrency(result.registro as number) },
      { item: 'Certidões', value: formatCurrency(result.certidões) },
      { item: 'Honorários', value: formatCurrency(result.honorários) },
    ];

    generateClementePDF({
      subtipo: subtype,
      base: Array.isArray(result.base) ? result.base[0] : result.base,
      itens: [
        { label: result.impostoLabel, valor: sum(result.imposto) },
        { label: 'Lavratura', valor: sum(result.lavratura) },
        { label: 'Arquivamento*', valor: result.arquivamento },
        { label: 'Registro*', valor: sum(result.registro) },
        { label: 'Certidões*', valor: result.certidões },
        { label: 'Honorários', valor: result.honorários },
      ],
      total: result.total
    });
  };

  const renderInput = (label: string, name: string, showImport = false) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm text-white/60">{label}</label>
        {showImport && (
          <button 
            onClick={() => importValorVenal(name)}
            className="text-[10px] text-[#D4AF37] hover:underline flex items-center gap-1"
          >
            <Import className="w-3 h-3" />
            Importar Valor Venal
          </button>
        )}
      </div>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">R$</span>
        <input
          type="text"
          value={inputs[name]}
          onChange={(e) => handleInputChange(name, e.target.value)}
          className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-[#D4AF37] outline-none transition-all"
          placeholder="0,00"
        />
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 print:p-0">
      <header className="flex flex-col gap-2 print:hidden">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center">
            <PenTool className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <h2 className="text-3xl font-serif text-white">Cálculo de Escrituras</h2>
        </div>
        <p className="text-white/60">Simule os custos totais para lavratura e registro de escrituras.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Coluna Esquerda - Formulário */}
        <div className="space-y-6 print:hidden">
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-xs text-white/40 uppercase tracking-widest font-bold">Subtipo de Escritura</label>
              <select 
                value={subtype}
                onChange={(e) => setSubtype(e.target.value as Subtype)}
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#D4AF37] outline-none transition-all appearance-none"
              >
                {[
                  'Compra e Venda Simples',
                  'Com Interveniência',
                  'Compra + Vínculo',
                  'Doação Simples',
                  'Doação c/ Usufruto',
                  'Renúncia de Usufruto'
                ].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {subtype === 'Compra e Venda Simples' && (
                <>
                  {renderInput('Valor Declarado', 'valorDeclarado')}
                  {renderInput('Valor Venal Corrigido', 'valorVenalCorrigido', true)}
                </>
              )}
              {subtype === 'Com Interveniência' && (
                <>
                  {renderInput('Valor Declarado 1', 'valorDeclarado1')}
                  {renderInput('Valor Venal 1', 'valorVenal1', true)}
                  {renderInput('Valor Declarado 2', 'valorDeclarado2')}
                  {renderInput('Valor Venal 2', 'valorVenal2')}
                </>
              )}
              {subtype === 'Compra + Vínculo' && (
                <>
                  {renderInput('Valor Declarado Compra', 'valorDeclaradoCompra')}
                  {renderInput('Valor Venal Compra', 'valorVenalCompra', true)}
                  {renderInput('Valor do Vínculo', 'valorVinculo')}
                </>
              )}
              {(subtype === 'Doação Simples' || subtype === 'Doação c/ Usufruto' || subtype === 'Renúncia de Usufruto') && (
                <>
                  {renderInput('Valor Atribuído', 'valorAtribuido')}
                  {renderInput('Avaliação Fazenda Estadual', 'avaliacaoFazenda')}
                </>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-white/5">
              <div className="space-y-2">
                <label className="text-sm text-white/60">Nº de Folhas</label>
                <input
                  type="text"
                  value={inputs.folhas}
                  onChange={(e) => handleInputChange('folhas', e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#D4AF37] outline-none transition-all"
                />
              </div>
              {renderInput('Certidões', 'certidões')}
              {renderInput('Honorários', 'honorários')}
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
                  <FileText className="w-6 h-6 text-[#D4AF37]" />
                  <h3 className="text-2xl font-serif text-white">Orçamento Estimado</h3>
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
                  <span className="text-white/40 text-sm">{result.impostoLabel}</span>
                  <span className="text-white font-medium">
                    {Array.isArray(result.imposto) ? result.imposto.map(formatCurrency).join(' + ') : formatCurrency(result.imposto as number)}
                  </span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-white/40 text-sm">Lavratura</span>
                  <span className="text-white font-medium">
                    {Array.isArray(result.lavratura) ? result.lavratura.map(formatCurrency).join(' + ') : formatCurrency(result.lavratura as number)}
                  </span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-white/40 text-sm">Arquivamento ({inputs.folhas} folhas)</span>
                  <span className="text-white font-medium">{formatCurrency(result.arquivamento)}</span>
                </div>
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <span className="text-white/40 text-sm">Registro</span>
                  <span className="text-white font-medium">
                    {Array.isArray(result.registro) ? result.registro.map(formatCurrency).join(' + ') : formatCurrency(result.registro as number)}
                  </span>
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
                  * Valores estimados com base na tabela de emolumentos vigente. Sujeitos a alteração após análise documental pelo cartório.
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
                <p className="text-white/20 text-sm max-w-xs">Preencha os dados à esquerda e clique em calcular para visualizar o orçamento detalhado.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View de Impressão */}
      <div className="hidden print:block text-black bg-white p-12 space-y-8 min-h-screen">
        <div className="flex justify-between items-start border-b-2 border-black pb-8">
          <div>
            <h1 className="text-4xl font-serif font-bold">Orçamento de Escritura</h1>
            <p className="text-gray-500 uppercase tracking-widest text-sm mt-2">Orçaí Imob - Assessoria Imobiliária</p>
          </div>
          <div className="text-right">
            <p className="font-bold">{new Date().toLocaleDateString('pt-BR')}</p>
            <p className="text-sm text-gray-500">Ref: {subtype}</p>
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
                  <td className="py-4 text-gray-600">Base de Cálculo</td>
                  <td className="py-4 text-right font-medium">{Array.isArray(result.base) ? result.base.map(formatCurrency).join(' + ') : formatCurrency(result.base)}</td>
                </tr>
                <tr>
                  <td className="py-4 text-gray-600">{result.impostoLabel}</td>
                  <td className="py-4 text-right font-medium">{Array.isArray(result.imposto) ? result.imposto.map(formatCurrency).join(' + ') : formatCurrency(result.imposto as number)}</td>
                </tr>
                <tr>
                  <td className="py-4 text-gray-600">Lavratura</td>
                  <td className="py-4 text-right font-medium">{Array.isArray(result.lavratura) ? result.lavratura.map(formatCurrency).join(' + ') : formatCurrency(result.lavratura as number)}</td>
                </tr>
                <tr>
                  <td className="py-4 text-gray-600">Arquivamento ({inputs.folhas} folhas)</td>
                  <td className="py-4 text-right font-medium">{formatCurrency(result.arquivamento)}</td>
                </tr>
                <tr>
                  <td className="py-4 text-gray-600">Registro</td>
                  <td className="py-4 text-right font-medium">{Array.isArray(result.registro) ? result.registro.map(formatCurrency).join(' + ') : formatCurrency(result.registro as number)}</td>
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
                * Este documento é uma estimativa de custos e não possui valor fiscal ou vinculativo. Os valores finais serão confirmados pelo cartório competente após análise da documentação.
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
