import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Key, Plus, Trash2, Copy, Check, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface ApiKey {
  id: string;
  key: string;
  status: string;
  created_at: string;
}

export function ApiKeys({ userId }: { userId: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, [userId]);

  const fetchKeys = async () => {
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (data) setKeys(data);
    setLoading(false);
  };

  const generateKey = async () => {
    setCreating(true);
    const newKey = `sk_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
    
    const { error } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        key: newKey,
        status: 'active'
      });

    if (error) alert(error.message);
    else fetchKeys();
    setCreating(false);
  };

  const revokeKey = async (id: string) => {
    const { error } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', id);

    if (error) alert(error.message);
    else fetchKeys();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-serif text-white">API Keys</h2>
          <p className="text-white/60">Gerencie suas chaves de acesso para integrações externas.</p>
        </div>
        <button
          onClick={generateKey}
          disabled={creating}
          className="bg-[#D4AF37] text-black font-bold px-6 py-3 rounded-xl flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Nova Chave
        </button>
      </header>

      <div className="space-y-4">
        {keys.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
              <Key className="w-8 h-8 text-white/20" />
            </div>
            <p className="text-white/40">Você ainda não possui chaves de API.</p>
          </div>
        ) : (
          keys.map((apiKey) => (
            <motion.div
              key={apiKey.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white/[0.03] border border-white/10 p-6 rounded-2xl flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-white/5 text-[#D4AF37]">
                  <Key className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="text-white font-mono bg-black/40 px-2 py-1 rounded border border-white/5">
                      {apiKey.key.substring(0, 8)}••••••••••••••••
                    </code>
                    <button
                      onClick={() => copyToClipboard(apiKey.key, apiKey.id)}
                      className="text-white/20 hover:text-[#D4AF37] transition-colors"
                    >
                      {copiedId === apiKey.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">
                    Criada em {new Date(apiKey.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="px-3 py-1 rounded-full bg-green-500/10 text-green-400 text-[10px] font-bold uppercase tracking-widest border border-green-500/20">
                  {apiKey.status}
                </span>
                <button
                  onClick={() => revokeKey(apiKey.id)}
                  className="p-2 text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <div className="bg-[#D4AF37]/5 border border-[#D4AF37]/10 p-6 rounded-3xl space-y-4">
        <h4 className="text-white font-serif flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#D4AF37]" />
          Como usar
        </h4>
        <p className="text-sm text-white/60 leading-relaxed">
          Envie sua chave no header <code className="text-[#D4AF37]">x-api-key</code> para autenticar suas requisições em nossa API REST.
        </p>
      </div>
    </div>
  );
}
