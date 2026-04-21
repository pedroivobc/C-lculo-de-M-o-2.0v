/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ValorVenal } from './components/ValorVenal';
import { Placeholder } from './components/Placeholder';
import { Auth } from './components/Auth';
import { Settings as SettingsPage } from './components/Settings';
import { Analytics } from './components/Analytics';
import { ApiKeys } from './components/ApiKeys';
import { Invites } from './components/Invites';
import { Escrituras } from './components/Escrituras';
import { FinanciamentoCaixa } from './components/FinanciamentoCaixa';
import { FinanciamentoBancoPrivado } from './components/FinanciamentoBancoPrivado';
import { CorrecaoContratual } from './components/CorrecaoContratual';
import { Doacao } from './components/Doacao';
import { Regularizacao } from './components/Regularizacao';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { 
  Menu, 
  PenTool, 
  Home, 
  Building2, 
  Handshake, 
  Settings,
  BarChart3,
  Key,
  UserPlus,
  Loader2
} from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();
  const { theme } = useTheme(user?.id);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-[#D4AF37]" />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} />;
      case 'valor-venal':
        return <ValorVenal userId={user.id} />;
      case 'escrituras':
        return <Escrituras userId={user.id} />;
      case 'financiamento-caixa':
        return <FinanciamentoCaixa />;
      case 'financiamento-privado':
        return <FinanciamentoBancoPrivado />;
      case 'correcao-contratual':
        return <CorrecaoContratual />;
      case 'doacao':
        return <Doacao />;
      case 'regularizacao':
        return <Regularizacao />;
      case 'analytics':
        return <Analytics />;
      case 'api-keys':
        return <ApiKeys userId={user.id} />;
      case 'invites':
        return <Invites userId={user.id} />;
      case 'configuracoes':
        return <SettingsPage userId={user.id} />;
      default:
        return <Dashboard onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${theme === 'dark' ? 'bg-[#050505] text-white' : 'bg-[#f5f5f5] text-black'} font-sans selection:bg-[#D4AF37]/30 selection:text-[#D4AF37]`}>
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      {/* Mobile Header */}
      <header className={`lg:hidden flex items-center justify-between p-4 border-b border-white/10 ${theme === 'dark' ? 'bg-[#050505]/80' : 'bg-white/80'} backdrop-blur-md sticky top-0 z-30`}>
        <h1 className="text-xl font-serif text-[#D4AF37] font-bold">Cálculo na Mão</h1>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          <Menu className={`w-6 h-6 ${theme === 'dark' ? 'text-white' : 'text-black'}`} />
        </button>
      </header>

      <main className="lg:ml-64 p-4 md:p-8 lg:p-12 min-h-screen">
        <div className="max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>

      {/* Background Accents */}
      <div className="fixed top-0 right-0 -z-10 w-[500px] h-[500px] bg-[#D4AF37]/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-0 left-64 -z-10 w-[300px] h-[300px] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />
    </div>
  );
}

