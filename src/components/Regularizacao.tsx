import React from 'react';
import { Bookmark } from 'lucide-react';
import { motion } from 'motion/react';

export function Regularizacao() {
  return (
    <div className="max-w-4xl mx-auto h-[70vh] flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-500">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-32 h-32 rounded-full bg-[#D4AF37]/10 flex items-center justify-center"
      >
        <Bookmark className="w-16 h-16 text-[#D4AF37]" />
      </motion.div>

      <div className="text-center space-y-4">
        <div className="inline-block px-4 py-1.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 mb-2">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#D4AF37]">Em Breve</span>
        </div>
        <h2 className="text-4xl font-serif text-white">Regularização de Imóveis</h2>
        <p className="text-white/40 text-lg max-w-md mx-auto">
          Este módulo está em desenvolvimento e será disponibilizado em breve para auxiliar na regularização documental completa de seus bens.
        </p>
      </div>

      <div className="w-full max-w-md h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}
