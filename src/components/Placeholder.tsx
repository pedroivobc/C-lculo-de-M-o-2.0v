import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PlaceholderProps {
  title: string;
  icon: LucideIcon;
}

export function Placeholder({ title, icon: Icon }: PlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-[#D4AF37]/40" />
      </div>
      <h2 className="text-2xl font-serif text-white mb-2">{title}</h2>
      <p className="text-[#D4AF37] font-medium mb-1">Módulo em desenvolvimento</p>
      <p className="text-white/40 text-sm">Em breve disponível nesta versão</p>
    </div>
  );
}
