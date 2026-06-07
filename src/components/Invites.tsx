import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Mail, Send, Loader2, UserPlus, Clock, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

interface Invite {
  id: string;
  email: string;
  expires_at: string;
  created_at: string;
}

export function Invites({ userId }: { userId: string }) {
  const [email, setEmail] = useState('');
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchInvites();
  }, [userId]);

  const fetchInvites = async () => {
    const q = query(collection(db, 'invites'), orderBy('created_at', 'desc'));
    const snap = await getDocs(q);
    setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invite)));
    setLoading(false);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    try {
      await addDoc(collection(db, 'invites'), {
        email,
        token,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      });
      console.log(`Invite link: ${window.location.origin}/accept-invite?token=${token}`);
      setEmail('');
      fetchInvites();
    } catch (error: any) {
      alert(error.message);
    }
    setSending(false);
  };

  const deleteInvite = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'invites', id));
      fetchInvites();
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-2">
        <h2 className="text-3xl font-serif text-white">Sistema de Convites</h2>
        <p className="text-white/60">Convide novos membros para sua organização.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Send Invite Form */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSendInvite} className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 space-y-6 sticky top-8">
            <div className="w-12 h-12 bg-[#D4AF37]/10 rounded-2xl flex items-center justify-center text-[#D4AF37]">
              <UserPlus className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-serif text-white">Novo Convite</h3>
              <p className="text-white/40 text-sm">O link expira em 7 dias.</p>
            </div>

            <div className="space-y-4">
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-[#D4AF37] transition-colors" />
                <input
                  type="email"
                  placeholder="E-mail do convidado"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-[#D4AF37] outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="w-full bg-[#D4AF37] text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  Enviar Convite
                  <Send className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Pending Invites List */}
        <div className="lg:col-span-2 space-y-4">
          <h4 className="text-white/40 text-xs uppercase tracking-widest font-bold">Convites Pendentes</h4>

          {invites.length === 0 ? (
            <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-12 text-center">
              <p className="text-white/20">Nenhum convite pendente.</p>
            </div>
          ) : (
            invites.map((invite) => (
              <motion.div
                key={invite.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/[0.03] border border-white/10 p-6 rounded-2xl flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-white font-medium">{invite.email}</p>
                    <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-widest">
                      <Clock className="w-3 h-3" />
                      Expira em {new Date(invite.expires_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => deleteInvite(invite.id)}
                  className="p-2 text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
