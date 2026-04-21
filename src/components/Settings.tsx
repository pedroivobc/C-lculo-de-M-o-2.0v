import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Camera, Loader2, Save, Moon, Sun, LogOut, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string;
  theme: string;
}

export function Settings({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [perfilUsuario, setPerfilUsuario] = useState({
    nome: '',
    telefone: '',
    email: ''
  });
  const [salvo, setSalvo] = useState(false);
  const { theme, toggleTheme } = useTheme(userId);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) setProfile(data);
      setLoading(false);
    };

    // Carregar perfil do localStorage
    const savedPerfil = localStorage.getItem('perfilUsuario');
    if (savedPerfil) {
      setPerfilUsuario(JSON.parse(savedPerfil));
    }

    fetchProfile();
  }, [userId]);

  const handleSavePerfilUsuario = () => {
    console.log('Perfil salvo:', perfilUsuario);
    localStorage.setItem('perfilUsuario', JSON.stringify(perfilUsuario));
    setSalvo(true);
    setTimeout(() => setSalvo(false), 3000);
  };

  const maskPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setUpdating(true);

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        updated_at: new Date().toISOString(),
      });

    if (error) alert(error.message);
    setUpdating(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUpdating(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Math.random()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) {
      alert(uploadError.message);
      setUpdating(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
    
    await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    setUpdating(false);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-2">
        <h2 className="text-3xl font-serif text-white">Configurações</h2>
        <p className="text-white/60">Gerencie seu perfil e preferências do sistema.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="md:col-span-2 space-y-6">
          <form onSubmit={handleUpdateProfile} className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 space-y-8">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <div className="relative group">
                <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-white/20" />
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#D4AF37] rounded-lg flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-lg">
                  <Camera className="w-4 h-4 text-black" />
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </label>
              </div>

              <div className="flex-1 space-y-4 w-full text-center sm:text-left">
                <h3 className="text-xl font-serif text-white">Informações Pessoais</h3>
                <p className="text-white/40 text-sm">Atualize seu nome e foto de perfil.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest block mb-2">Nome Completo</label>
                <input
                  type="text"
                  value={profile?.full_name || ''}
                  onChange={(e) => setProfile(prev => prev ? { ...prev, full_name: e.target.value } : null)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#D4AF37] outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={updating}
              className="w-full sm:w-auto px-8 py-3 bg-[#D4AF37] text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Alterações
            </button>
          </form>

          {/* Meus Dados (Responsável PDF) */}
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 space-y-8">
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-serif text-white">Meus Dados (Responsável PDF)</h3>
              <p className="text-white/40 text-sm">Estas informações aparecerão no rodapé dos orçamentos gerados.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="text-xs text-white/40 uppercase tracking-widest block mb-2">Nome Completo</label>
                <input
                  type="text"
                  value={perfilUsuario.nome}
                  onChange={(e) => setPerfilUsuario(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#D4AF37] outline-none transition-all"
                  placeholder="Seu nome completo"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest block mb-2">Telefone</label>
                <input
                  type="text"
                  value={perfilUsuario.telefone}
                  onChange={(e) => setPerfilUsuario(prev => ({ ...prev, telefone: maskPhone(e.target.value) }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#D4AF37] outline-none transition-all"
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                />
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-widest block mb-2">E-mail</label>
                <input
                  type="email"
                  value={perfilUsuario.email}
                  onChange={(e) => setPerfilUsuario(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-[#D4AF37] outline-none transition-all"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <button
              onClick={handleSavePerfilUsuario}
              className={cn(
                "w-full sm:w-auto px-8 py-3 font-bold rounded-xl flex items-center justify-center gap-2 transition-all",
                salvo ? "bg-green-600 text-white" : "bg-[#D4AF37] text-black hover:opacity-90"
              )}
            >
              {salvo ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {salvo ? "Dados Salvos!" : "Salvar Meus Dados"}
            </button>
          </div>
        </div>

        {/* Preferences Card */}
        <div className="space-y-6">
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 space-y-6">
            <h3 className="text-xl font-serif text-white">Preferências</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? <Moon className="w-5 h-5 text-[#D4AF37]" /> : <Sun className="w-5 h-5 text-[#D4AF37]" />}
                  <span className="text-white font-medium">Modo Escuro</span>
                </div>
                <button
                  onClick={toggleTheme}
                  className={`w-12 h-6 rounded-full transition-colors relative ${theme === 'dark' ? 'bg-[#D4AF37]' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${theme === 'dark' ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <button
                onClick={() => supabase.auth.signOut()}
                className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 transition-colors py-2"
              >
                <LogOut className="w-4 h-4" />
                Sair da Conta
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
