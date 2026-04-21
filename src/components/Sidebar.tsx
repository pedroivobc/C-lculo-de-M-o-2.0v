import React from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  PenTool, 
  Home, 
  Building2, 
  TrendingUp,
  Handshake, 
  Bookmark,
  Settings,
  BarChart3,
  Key,
  UserPlus,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  theme?: 'light' | 'dark';
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'valor-venal', label: 'Valor Venal', icon: FileText },
  { id: 'escrituras', label: 'Escrituras', icon: PenTool },
  { id: 'financiamento-caixa', label: 'Financiamento Caixa', icon: Home },
  { id: 'financiamento-privado', label: 'Financiamento Banco Privado', icon: Building2 },
  { id: 'correcao-contratual', label: 'Correção Contratual', icon: TrendingUp },
  { id: 'doacao', label: 'Doação', icon: Handshake },
  { id: 'regularizacao', label: 'Regularização', icon: Bookmark },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'invites', label: 'Convites', icon: UserPlus },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
];

export function Sidebar({ activeTab, setActiveTab, isOpen, setIsOpen, theme = 'dark' }: SidebarProps) {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full w-64 border-r z-50 transition-transform duration-300 lg:translate-x-0",
        theme === 'dark' ? "bg-[#050505] border-white/10" : "bg-white border-black/5",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6">
          <h1 className="text-2xl font-serif text-[#D4AF37] font-bold tracking-tight">
            Cálculo na Mão
          </h1>
          <p className={cn(
            "text-xs mt-1 uppercase tracking-widest",
            theme === 'dark' ? "text-white/40" : "text-black/40"
          )}>
            Assessoria Imobiliária
          </p>
        </div>

        <nav className="mt-6 px-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group",
                activeTab === item.id 
                  ? "bg-[#D4AF37]/10 text-[#D4AF37]" 
                  : theme === 'dark' 
                    ? "text-white/60 hover:bg-white/5 hover:text-white"
                    : "text-black/60 hover:bg-black/5 hover:text-black"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-colors",
                activeTab === item.id 
                  ? "text-[#D4AF37]" 
                  : theme === 'dark' 
                    ? "text-white/40 group-hover:text-white/80"
                    : "text-black/40 group-hover:text-black/80"
              )} />
              <span className="font-medium">{item.label}</span>
              {activeTab === item.id && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
              )}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-8 left-6 right-6">
          <div className={cn(
            "p-4 rounded-xl border",
            theme === 'dark' ? "bg-white/5 border-white/10" : "bg-black/5 border-black/5"
          )}>
            <p className={cn(
              "text-xs uppercase tracking-widest mb-1",
              theme === 'dark' ? "text-white/40" : "text-black/40"
            )}>Versão</p>
            <p className={cn(
              "text-sm font-medium",
              theme === 'dark' ? "text-white/80" : "text-black/80"
            )}>v2.0 Premium</p>
          </div>
        </div>
      </aside>
    </>
  );
}
